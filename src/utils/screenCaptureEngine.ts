import {
  AudioSourceOption,
  PixelRegion,
  RecordingMode,
  RecordingSettings,
  getEffectiveAudioBitrateBps,
  getEffectiveVideoBitrateMbps,
  getEffectiveVideoFps,
} from '../types/recorder';

export interface ActiveCaptureHandle {
  pause: () => void;
  resume: () => void;
  stop: () => Promise<{
    blob: Blob;
    mimeType: string;
    width: number;
    height: number;
    durationMs: number;
    displayName: string;
  }>;
  resolvedWidth: number;
  resolvedHeight: number;
  encoderLabel: string;
  audioLabel: string;
  warningMessage: string | null;
}

function pickSupportedMimeType(): { mimeType: string; ext: string; label: string } {
  const candidates = [
    { mimeType: 'video/mp4;codecs=hvc1,mp4a.40.2', ext: 'mp4', label: 'HEVC / MP4' },
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4', label: 'H.264 / MP4' },
    { mimeType: 'video/mp4', ext: 'mp4', label: 'MP4' },
    { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm', label: 'VP9 / WebM' },
    { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm', label: 'VP8 / WebM' },
    { mimeType: 'video/webm', ext: 'webm', label: 'WebM' },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }
  return { mimeType: '', ext: 'webm', label: 'WebM' };
}

function formatTimestampName(ext: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `FrameCut_${stamp}.${ext}`;
}

export async function startBrowserScreenCapture(
  settings: RecordingSettings,
  selectedPixelRegion: PixelRegion,
  onUnexpectedEnd: () => void,
): Promise<ActiveCaptureHandle> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error(
      'Screen capture (getDisplayMedia) is not supported in this browser or context.',
    );
  }

  const targetFps = getEffectiveVideoFps(settings);
  const wantInternalAudio = settings.audioSource === AudioSourceOption.INTERNAL;

  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: targetFps },
    },
    audio: wantInternalAudio,
  });

  const videoTrack = displayStream.getVideoTracks()[0];
  if (!videoTrack) {
    displayStream.getTracks().forEach((t) => t.stop());
    throw new Error('No display video track was provided.');
  }

  let micStream: MediaStream | null = null;
  let warningMessage: string | null = null;
  let audioLabel = wantInternalAudio ? 'Internal Audio' : 'Microphone';

  if (settings.audioSource === AudioSourceOption.MICROPHONE) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: settings.customAudioSampleRateHz ?? 48_000,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
    } catch {
      warningMessage = 'Microphone permission denied. Recording video only.';
      audioLabel = 'Video Only';
    }
  } else if (displayStream.getAudioTracks().length === 0) {
    warningMessage =
      'No internal tab/system audio track was shared. Check "Share audio" in the browser picker to include audio.';
    audioLabel = 'Video Only';
  }

  const trackSettings = videoTrack.getSettings();
  const srcWidth = trackSettings.width || window.screen.width || 1920;
  const srcHeight = trackSettings.height || window.screen.height || 1080;

  let outputStream: MediaStream;
  let resolvedWidth = srcWidth;
  let resolvedHeight = srcHeight;
  let canvasCleanup: (() => void) | null = null;

  if (settings.recordingMode === RecordingMode.REGION) {
    const norm = settings.selectedRegion;
    const cropLeft = Math.max(0, Math.round(norm.left * srcWidth));
    const cropTop = Math.max(0, Math.round(norm.top * srcHeight));
    const cropW = Math.max(128, Math.floor(Math.round((norm.right - norm.left) * srcWidth) / 2) * 2);
    const cropH = Math.max(128, Math.floor(Math.round((norm.bottom - norm.top) * srcHeight) / 2) * 2);

    resolvedWidth = Math.min(cropW, srcWidth - cropLeft);
    resolvedHeight = Math.min(cropH, srcHeight - cropTop);
    if (resolvedWidth % 2 !== 0) resolvedWidth = Math.max(2, resolvedWidth - 1);
    if (resolvedHeight % 2 !== 0) resolvedHeight = Math.max(2, resolvedHeight - 1);

    const hiddenVideo = document.createElement('video');
    hiddenVideo.srcObject = new MediaStream([videoTrack]);
    hiddenVideo.muted = true;
    hiddenVideo.playsInline = true;
    await hiddenVideo.play();

    const canvas = document.createElement('canvas');
    canvas.width = resolvedWidth;
    canvas.height = resolvedHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      displayStream.getTracks().forEach((t) => t.stop());
      micStream?.getTracks().forEach((t) => t.stop());
      throw new Error('Unable to initialize 2D crop surface.');
    }

    let rafId = 0;
    let active = true;
    const drawFrame = () => {
      if (!active) return;
      if (hiddenVideo.readyState >= 2) {
        ctx.drawImage(
          hiddenVideo,
          cropLeft,
          cropTop,
          resolvedWidth,
          resolvedHeight,
          0,
          0,
          resolvedWidth,
          resolvedHeight,
        );
      }
      rafId = requestAnimationFrame(drawFrame);
    };
    rafId = requestAnimationFrame(drawFrame);

    const canvasStream = canvas.captureStream(targetFps);
    const combinedTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
    if (micStream) {
      combinedTracks.push(...micStream.getAudioTracks());
    } else {
      combinedTracks.push(...displayStream.getAudioTracks());
    }
    outputStream = new MediaStream(combinedTracks);

    canvasCleanup = () => {
      active = false;
      cancelAnimationFrame(rafId);
      hiddenVideo.pause();
      hiddenVideo.srcObject = null;
      canvasStream.getTracks().forEach((t) => t.stop());
    };
  } else {
    resolvedWidth = selectedPixelRegion.screenWidth > 0 ? srcWidth : srcWidth;
    resolvedHeight = selectedPixelRegion.screenHeight > 0 ? srcHeight : srcHeight;
    const combinedTracks: MediaStreamTrack[] = [videoTrack];
    if (micStream) {
      combinedTracks.push(...micStream.getAudioTracks());
    } else {
      combinedTracks.push(...displayStream.getAudioTracks());
    }
    outputStream = new MediaStream(combinedTracks);
  }

  const codec = pickSupportedMimeType();
  const requestedBps = Math.min(getEffectiveVideoBitrateMbps(settings) * 1_000_000, 50_000_000);
  const audioBps = getEffectiveAudioBitrateBps(settings);

  const recorderOptions: MediaRecorderOptions = {
    videoBitsPerSecond: requestedBps,
    audioBitsPerSecond: audioBps,
  };
  if (codec.mimeType) {
    recorderOptions.mimeType = codec.mimeType;
  }

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(outputStream, recorderOptions);
  } catch {
    recorder = new MediaRecorder(outputStream);
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  let stopCalled = false;
  videoTrack.onended = () => {
    if (!stopCalled) {
      onUnexpectedEnd();
    }
  };

  const startedAt = performance.now();
  recorder.start(250);

  return {
    resolvedWidth,
    resolvedHeight,
    encoderLabel: codec.label,
    audioLabel,
    warningMessage,
    pause: () => {
      if (recorder.state === 'recording') {
        recorder.pause();
      }
    },
    resume: () => {
      if (recorder.state === 'paused') {
        recorder.resume();
      }
    },
    stop: () => {
      stopCalled = true;
      return new Promise((resolve) => {
        const finalize = () => {
          canvasCleanup?.();
          displayStream.getTracks().forEach((t) => t.stop());
          micStream?.getTracks().forEach((t) => t.stop());
          const finalMime = recorder.mimeType || codec.mimeType || 'video/webm';
          const ext = finalMime.includes('mp4') ? 'mp4' : 'webm';
          const blob = new Blob(chunks, { type: finalMime });
          resolve({
            blob,
            mimeType: finalMime,
            width: resolvedWidth,
            height: resolvedHeight,
            durationMs: Math.max(500, Math.round(performance.now() - startedAt)),
            displayName: formatTimestampName(ext),
          });
        };

        if (recorder.state === 'inactive') {
          finalize();
          return;
        }
        recorder.onstop = finalize;
        recorder.stop();
      });
    },
  };
}
