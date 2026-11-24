import {
  CropExportOutput,
  MediaInspectionResult,
  NormalizedCropRect,
  PHOTO_OUTPUT_FORMAT_META,
  PhotoCropFallbackConfig,
  PhotoOutputFormatPreset,
  VIDEO_CROP_FPS_META,
  VideoCropFallbackConfig,
  VideoCropFpsPreset,
  VideoOutputFormatPreset,
} from '../types/crop';
import { CropCoordinateMapper } from './cropCoordinateMapper';

function stripExt(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

function extFromName(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : '';
}

export function resolvePhotoOutputSpec(
  sourceMime: string,
  sourceName: string,
  preset: PhotoOutputFormatPreset,
): { mimeType: string; extension: string } {
  const meta = PHOTO_OUTPUT_FORMAT_META[preset];
  if (meta.mimeType && meta.extension) {
    return { mimeType: meta.mimeType, extension: meta.extension };
  }
  const lower = sourceMime.toLowerCase();
  const ext = extFromName(sourceName);
  if (lower.includes('png') || ext === 'png') return { mimeType: 'image/png', extension: 'png' };
  if (lower.includes('webp') || ext === 'webp') return { mimeType: 'image/webp', extension: 'webp' };
  return { mimeType: 'image/jpeg', extension: 'jpg' };
}

export function resolveVideoOutputSpec(
  inspection: MediaInspectionResult,
  preset: VideoOutputFormatPreset,
): { containerName: string; codecShortName: string; mimeType: string; extension: string; isWebM: boolean } {
  if (preset === VideoOutputFormatPreset.WEBM) {
    return {
      containerName: 'WebM',
      codecShortName: 'VP9',
      mimeType: 'video/webm',
      extension: 'webm',
      isWebM: true,
    };
  }
  if (preset === VideoOutputFormatPreset.MP4_HEVC) {
    return {
      containerName: 'MP4',
      codecShortName: 'HEVC',
      mimeType: 'video/mp4',
      extension: 'mp4',
      isWebM: false,
    };
  }
  if (preset === VideoOutputFormatPreset.MP4_H264) {
    return {
      containerName: 'MP4',
      codecShortName: 'H.264',
      mimeType: 'video/mp4',
      extension: 'mp4',
      isWebM: false,
    };
  }
  const isWebM = inspection.containerLabel.toLowerCase() === 'webm';
  if (isWebM) {
    return {
      containerName: 'WebM',
      codecShortName: 'VP9',
      mimeType: 'video/webm',
      extension: 'webm',
      isWebM: true,
    };
  }
  return {
    containerName: 'MP4',
    codecShortName: 'H.264',
    mimeType: 'video/mp4',
    extension: 'mp4',
    isWebM: false,
  };
}

export async function exportFullFrameCopy(
  inspection: MediaInspectionResult,
): Promise<CropExportOutput> {
  const base = stripExt(inspection.displayName);
  const ext = extFromName(inspection.displayName) || (inspection.kind === 'PHOTO' ? 'jpg' : 'mp4');
  const displayName = `${base}_copy.${ext}`;
  const blob = inspection.file.slice(0, inspection.file.size, inspection.mimeType);
  const objectUrl = URL.createObjectURL(blob);
  return {
    blob,
    objectUrl,
    displayName,
    mimeType: inspection.mimeType,
    outputWidth: inspection.displayWidth,
    outputHeight: inspection.displayHeight,
    sizeBytes: blob.size,
    usedOriginalStreamCopy: true,
  };
}

export async function exportCroppedPhoto(
  inspection: MediaInspectionResult,
  cropRect: NormalizedCropRect,
  config: PhotoCropFallbackConfig,
  onProgress: (fraction: number) => void,
): Promise<CropExportOutput> {
  onProgress(0.15);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to decode source image'));
    el.src = inspection.objectUrl;
  });

  onProgress(0.4);
  const pixelRect = CropCoordinateMapper.toDisplayPixelRect(
    cropRect,
    inspection.displayWidth,
    inspection.displayHeight,
    false,
  );
  const scale = Math.min(100, Math.max(25, config.scalePercent)) / 100;
  const outW = Math.max(1, Math.round(pixelRect.width * scale));
  const outH = Math.max(1, Math.round(pixelRect.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create 2D crop canvas');

  ctx.drawImage(
    img,
    pixelRect.left,
    pixelRect.top,
    pixelRect.width,
    pixelRect.height,
    0,
    0,
    outW,
    outH,
  );

  onProgress(0.75);
  const spec = resolvePhotoOutputSpec(inspection.mimeType, inspection.displayName, config.outputFormat);
  const quality = spec.mimeType === 'image/png' ? undefined : config.qualityPercent / 100;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode cropped image'))),
      spec.mimeType,
      quality,
    );
  });

  onProgress(1);
  const displayName = `${stripExt(inspection.displayName)}_cropped.${spec.extension}`;
  const objectUrl = URL.createObjectURL(blob);
  return {
    blob,
    objectUrl,
    displayName,
    mimeType: spec.mimeType,
    outputWidth: outW,
    outputHeight: outH,
    sizeBytes: blob.size,
    usedOriginalStreamCopy: false,
  };
}

export async function exportCroppedVideo(
  inspection: MediaInspectionResult,
  cropRect: NormalizedCropRect,
  config: VideoCropFallbackConfig,
  isCancelled: () => boolean,
  onProgress: (fraction: number) => void,
): Promise<CropExportOutput> {
  const pixelRect = CropCoordinateMapper.toDisplayPixelRect(
    cropRect,
    inspection.displayWidth,
    inspection.displayHeight,
    true,
  );
  const { width: outW, height: outH } = CropCoordinateMapper.computeVideoOutputDimensions(
    pixelRect.width,
    pixelRect.height,
    config.resolutionPreset,
  );

  const targetFps =
    config.fpsPreset === VideoCropFpsPreset.ORIGINAL
      ? inspection.frameRate ?? 30
      : VIDEO_CROP_FPS_META[config.fpsPreset].fps;

  const video = document.createElement('video');
  video.src = inspection.objectUrl;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load source video for cropping'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create 2D video crop canvas');

  const stream = canvas.captureStream(targetFps);
  const spec = resolveVideoOutputSpec(inspection, config.outputFormat);
  const preferredMimes = spec.isWebM
    ? ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    : ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];

  const chosenMime =
    preferredMimes.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ??
    '';

  const recorderOpts: MediaRecorderOptions = {
    videoBitsPerSecond: Math.max(1, config.bitrateMbps) * 1_000_000,
  };
  if (chosenMime) recorderOpts.mimeType = chosenMime;

  const recorder = new MediaRecorder(stream, recorderOpts);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  return await new Promise<CropExportOutput>((resolve, reject) => {
    let rafId = 0;
    const cleanup = () => {
      cancelAnimationFrame(rafId);
      video.pause();
      stream.getTracks().forEach((t) => t.stop());
    };

    recorder.onstop = () => {
      cleanup();
      if (isCancelled()) {
        reject(new Error('Export cancelled'));
        return;
      }
      const finalMime = recorder.mimeType || chosenMime || 'video/webm';
      const ext = finalMime.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: finalMime });
      const objectUrl = URL.createObjectURL(blob);
      resolve({
        blob,
        objectUrl,
        displayName: `${stripExt(inspection.displayName)}_cropped.${ext}`,
        mimeType: finalMime,
        outputWidth: outW,
        outputHeight: outH,
        sizeBytes: blob.size,
        usedOriginalStreamCopy: false,
      });
    };

    const duration = Math.max(0.1, video.duration || inspection.durationMs / 1000 || 1);
    const step = () => {
      if (isCancelled()) {
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }
      ctx.drawImage(
        video,
        pixelRect.left,
        pixelRect.top,
        pixelRect.width,
        pixelRect.height,
        0,
        0,
        outW,
        outH,
      );
      onProgress(Math.min(0.98, Math.max(0.05, video.currentTime / duration)));
      if (video.ended || video.currentTime >= duration) {
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }
      rafId = requestAnimationFrame(step);
    };

    video.onended = () => {
      if (recorder.state !== 'inactive') recorder.stop();
    };

    video.currentTime = 0;
    recorder.start(200);
    video
      .play()
      .then(() => {
        rafId = requestAnimationFrame(step);
      })
      .catch((err) => {
        cleanup();
        reject(err);
      });
  });
}
