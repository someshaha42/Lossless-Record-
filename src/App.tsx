import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppRoute,
  AudioFormatOption,
  AudioSourceOption,
  BitrateModeOption,
  ColorDepthOption,
  ColorRangeOption,
  DEFAULT_NORMALIZED_REGION,
  GopIntervalOption,
  NormalizedRegion,
  OrientationMode,
  RecordedVideoItem,
  RecordingMode,
  RecordingPhase,
  RecordingSessionState,
  RecordingSettings,
  RegionAnimationOption,
  VideoBitrateOption,
  VideoFpsOption,
  getEffectiveVideoBitrateMbps,
} from './types/recorder';
import {
  CropAspectRatioPreset,
  CropMediaCategory,
  CropMediaKind,
  DEFAULT_CROP_RECT,
  FULL_FRAME_CROP_RECT,
  NormalizedCropRect,
  PhotoCropFallbackConfig,
  PhotoOutputFormatPreset,
  VideoCropFallbackConfig,
  VideoCropFpsPreset,
  VideoCropResolutionPreset,
  VideoOutputFormatPreset,
} from './types/crop';
import { CropCoordinateMapper } from './utils/cropCoordinateMapper';
import {
  exportCroppedPhoto,
  exportCroppedVideo,
  exportFullFrameCopy,
} from './utils/mediaCropEngine';
import { evaluateCropFeasibility, inspectMediaFile } from './utils/mediaCropInspector';
import {
  deleteRecordingFromDb,
  loadAllRecordings,
  loadStoredSettings,
  saveRecordingToDb,
  saveStoredSettings,
} from './utils/recordingsDb';
import {
  normalizeRegion,
  resolveFullScreenDimensions,
  toPixelRegion,
} from './utils/regionSelection';
import { ActiveCaptureHandle, startBrowserScreenCapture } from './utils/screenCaptureEngine';
import { RegionSelectorOverlay } from './components/RegionSelectorOverlay';
import { CropToolScreen, CropUiState } from './screens/CropToolScreen';
import { MainScreen } from './screens/MainScreen';
import { RecordingsScreen } from './screens/RecordingsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

function createInitialSession(settings: RecordingSettings): RecordingSessionState {
  return {
    phase: RecordingPhase.IDLE,
    elapsedMillis: 0,
    activeMode: settings.recordingMode,
    activeAudioLabel:
      settings.audioSource === AudioSourceOption.INTERNAL ? 'Internal Audio' : 'Microphone',
    activeEncoderName: 'MP4 / WebM',
    activeBitrateMbps: getEffectiveVideoBitrateMbps(settings),
    activeResolutionLabel: '',
    activeRegion: null,
    showRegionBorder: false,
    lastSavedId: null,
    lastSavedName: null,
    warningMessage: null,
    errorMessage: null,
  };
}

function createInitialVideoFallbackConfig(): VideoCropFallbackConfig {
  return {
    resolutionPreset: VideoCropResolutionPreset.ORIGINAL,
    fpsPreset: VideoCropFpsPreset.ORIGINAL,
    outputFormat: VideoOutputFormatPreset.ORIGINAL,
    bitrateMbps: 14,
    hasUserAdjustedBitrate: false,
  };
}

function createInitialPhotoFallbackConfig(): PhotoCropFallbackConfig {
  return {
    preserveExifAndColor: true,
    qualityPercent: 100,
    scalePercent: 100,
    outputFormat: PhotoOutputFormatPreset.ORIGINAL,
  };
}

function createInitialCropUiState(): CropUiState {
  return {
    category: CropMediaCategory.ALL,
    isLoadingMedia: false,
    inspection: null,
    loadErrorMessage: null,
    cropRect: { ...DEFAULT_CROP_RECT },
    aspectPreset: CropAspectRatioPreset.FREE,
    videoFallbackConfig: createInitialVideoFallbackConfig(),
    photoFallbackConfig: createInitialPhotoFallbackConfig(),
    exportState: { status: 'idle' },
  };
}

export function App() {
  const [settings, setSettings] = useState<RecordingSettings>(() => loadStoredSettings());
  const [activeRoute, setActiveRoute] = useState<AppRoute>('main');

  const [rawScreenSize, setRawScreenSize] = useState(() => ({
    width: Math.max(640, window.screen?.width || window.innerWidth || 1920),
    height: Math.max(480, window.screen?.height || window.innerHeight || 1080),
  }));
  const [isEditingRegion, setIsEditingRegion] = useState(false);
  const [draftRegion, setDraftRegion] = useState<NormalizedRegion>(() => settings.selectedRegion);
  const [draftPresetIndex, setDraftPresetIndex] = useState(0);

  const [bitrateDraft, setBitrateDraft] = useState<string | null>(null);
  const [fpsDraft, setFpsDraft] = useState<string | null>(null);
  const [gopDraft, setGopDraft] = useState<string | null>(null);
  const [audioKhzDraft, setAudioKhzDraft] = useState<string | null>(null);
  const [audioKbpsDraft, setAudioKbpsDraft] = useState<string | null>(null);

  const [recordings, setRecordings] = useState<RecordedVideoItem[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);
  const [playingRecordingId, setPlayingRecordingId] = useState<number | null>(null);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);

  const [session, setSession] = useState<RecordingSessionState>(() => createInitialSession(settings));
  const captureHandleRef = useRef<ActiveCaptureHandle | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const accumulatedMsRef = useRef<number>(0);
  const isStoppingRef = useRef(false);

  const [cropUiState, setCropUiState] = useState<CropUiState>(() => createInitialCropUiState());
  const cropExportCancelledRef = useRef(false);
  const cropUiStateRef = useRef(cropUiState);
  cropUiStateRef.current = cropUiState;

  const isDarkTheme = settings.darkThemeOverride ?? true;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkTheme);
  }, [isDarkTheme]);

  useEffect(() => {
    saveStoredSettings(settings);
  }, [settings]);

  useEffect(() => {
    const onResize = () => {
      setRawScreenSize({
        width: Math.max(640, window.screen?.width || window.innerWidth || 1920),
        height: Math.max(480, window.screen?.height || window.innerHeight || 1080),
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const refreshRecordings = useCallback(async () => {
    setIsLoadingRecordings(true);
    const list = await loadAllRecordings();
    setRecordings(list);
    setIsLoadingRecordings(false);
  }, []);

  useEffect(() => {
    void refreshRecordings();
  }, [refreshRecordings]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current != null) {
        window.clearInterval(timerIntervalRef.current);
      }
      const st = cropUiStateRef.current;
      if (st.inspection?.objectUrl) {
        URL.revokeObjectURL(st.inspection.objectUrl);
      }
      if (st.exportState.status === 'completed') {
        URL.revokeObjectURL(st.exportState.output.objectUrl);
      }
    };
  }, []);

  const { width: canvasWidthPx, height: canvasHeightPx } = useMemo(
    () =>
      resolveFullScreenDimensions(
        rawScreenSize.width,
        rawScreenSize.height,
        settings.orientationMode,
      ),
    [rawScreenSize.width, rawScreenSize.height, settings.orientationMode],
  );

  const selectedPixelRegion = useMemo(
    () => toPixelRegion(settings.selectedRegion, canvasWidthPx, canvasHeightPx),
    [settings.selectedRegion, canvasWidthPx, canvasHeightPx],
  );

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current != null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    const handle = captureHandleRef.current;
    if (!handle || isStoppingRef.current) return;
    isStoppingRef.current = true;
    stopTimer();

    setSession((prev) => ({
      ...prev,
      phase: RecordingPhase.FINALIZING,
    }));

    try {
      const result = await handle.stop();
      captureHandleRef.current = null;

      const saved = await saveRecordingToDb(
        {
          displayName: result.displayName,
          width: result.width,
          height: result.height,
          durationMs: result.durationMs,
          sizeBytes: result.blob.size,
          dateAddedSec: Math.floor(Date.now() / 1000),
          mimeType: result.mimeType,
        },
        result.blob,
      );

      await refreshRecordings();

      setSession((prev) => ({
        ...prev,
        phase: RecordingPhase.IDLE,
        elapsedMillis: 0,
        showRegionBorder: false,
        lastSavedId: saved.id,
        lastSavedName: saved.displayName,
      }));
    } catch (err) {
      captureHandleRef.current = null;
      setSession((prev) => ({
        ...prev,
        phase: RecordingPhase.IDLE,
        elapsedMillis: 0,
        showRegionBorder: false,
        errorMessage: err instanceof Error ? err.message : 'Failed to finalize recording.',
      }));
    } finally {
      isStoppingRef.current = false;
    }
  }, [refreshRecordings, stopTimer]);

  const handleStartRecord = useCallback(async () => {
    if (session.phase !== RecordingPhase.IDLE) return;

    setSession((prev) => ({
      ...prev,
      warningMessage: null,
      errorMessage: null,
    }));

    try {
      const handle = await startBrowserScreenCapture(settings, selectedPixelRegion, () => {
        void handleStopRecording();
      });

      captureHandleRef.current = handle;
      accumulatedMsRef.current = 0;
      startedAtRef.current = performance.now();

      stopTimer();
      timerIntervalRef.current = window.setInterval(() => {
        setSession((prev) => {
          if (prev.phase !== RecordingPhase.RECORDING) return prev;
          const elapsed =
            accumulatedMsRef.current + Math.max(0, performance.now() - startedAtRef.current);
          return { ...prev, elapsedMillis: Math.round(elapsed) };
        });
      }, 100);

      setSession((prev) => ({
        ...prev,
        phase: RecordingPhase.RECORDING,
        elapsedMillis: 0,
        activeMode: settings.recordingMode,
        activeAudioLabel: handle.audioLabel,
        activeEncoderName: handle.encoderLabel,
        activeBitrateMbps: getEffectiveVideoBitrateMbps(settings),
        activeResolutionLabel: `${handle.resolvedWidth}×${handle.resolvedHeight}`,
        activeRegion:
          settings.recordingMode === RecordingMode.REGION ? selectedPixelRegion : null,
        showRegionBorder:
          settings.recordingMode === RecordingMode.REGION &&
          settings.regionAnimation === RegionAnimationOption.SHOW,
        warningMessage: handle.warningMessage,
        errorMessage: null,
      }));
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Screen capture permission was cancelled or denied.'
          : err instanceof Error
          ? err.message
          : 'Unable to start screen recording.';
      setSession((prev) => ({
        ...prev,
        phase: RecordingPhase.IDLE,
        errorMessage: msg,
      }));
    }
  }, [handleStopRecording, selectedPixelRegion, session.phase, settings, stopTimer]);

  const handlePauseResume = useCallback(() => {
    const handle = captureHandleRef.current;
    if (!handle) return;

    if (session.phase === RecordingPhase.RECORDING) {
      handle.pause();
      accumulatedMsRef.current += Math.max(0, performance.now() - startedAtRef.current);
      setSession((prev) => ({
        ...prev,
        phase: RecordingPhase.PAUSED,
        elapsedMillis: Math.round(accumulatedMsRef.current),
      }));
    } else if (session.phase === RecordingPhase.PAUSED) {
      handle.resume();
      startedAtRef.current = performance.now();
      setSession((prev) => ({
        ...prev,
        phase: RecordingPhase.RECORDING,
      }));
    }
  }, [session.phase]);

  const handleDeleteRecording = useCallback(
    async (item: RecordedVideoItem) => {
      await deleteRecordingFromDb(item.id);
      if (playingRecordingId === item.id) {
        setPlayingRecordingId(null);
        setPlaybackPositionMs(0);
      }
      await refreshRecordings();
    },
    [playingRecordingId, refreshRecordings],
  );

  const updateSettingsIfIdle = useCallback(
    (updater: (prev: RecordingSettings) => RecordingSettings) => {
      if (session.phase !== RecordingPhase.IDLE) return;
      setSettings(updater);
    },
    [session.phase],
  );

  const handleCropFileSelected = useCallback(async (file: File) => {
    cropExportCancelledRef.current = true;

    setCropUiState((prev) => {
      if (prev.inspection?.objectUrl) {
        URL.revokeObjectURL(prev.inspection.objectUrl);
      }
      if (prev.exportState.status === 'completed') {
        URL.revokeObjectURL(prev.exportState.output.objectUrl);
      }
      return {
        ...prev,
        isLoadingMedia: true,
        inspection: null,
        loadErrorMessage: null,
        exportState: { status: 'idle' },
      };
    });

    const inspection = await inspectMediaFile(file);
    if (!inspection) {
      setCropUiState((prev) => ({
        ...prev,
        isLoadingMedia: false,
        loadErrorMessage: 'Unable to decode selected file as a supported photo or video.',
      }));
      return;
    }

    const defaultCrop = { ...DEFAULT_CROP_RECT };
    const croppedPixels = CropCoordinateMapper.toDisplayPixelRect(
      defaultCrop,
      inspection.displayWidth,
      inspection.displayHeight,
      inspection.kind === CropMediaKind.VIDEO,
    );
    const range = CropCoordinateMapper.computeDynamicBitrateRange(
      VideoCropResolutionPreset.ORIGINAL,
      VideoCropFpsPreset.ORIGINAL,
      croppedPixels.width,
      croppedPixels.height,
      inspection.bitrateBps,
      inspection.frameRate,
    );

    setCropUiState((prev) => ({
      ...prev,
      isLoadingMedia: false,
      inspection,
      loadErrorMessage: null,
      cropRect: defaultCrop,
      aspectPreset: CropAspectRatioPreset.FREE,
      videoFallbackConfig: {
        ...createInitialVideoFallbackConfig(),
        bitrateMbps: range.suggestedMbps,
      },
      photoFallbackConfig: createInitialPhotoFallbackConfig(),
      exportState: { status: 'idle' },
    }));
  }, []);

  const handleSelectCropAspectPreset = useCallback((preset: CropAspectRatioPreset) => {
    setCropUiState((prev) => {
      if (!prev.inspection) return { ...prev, aspectPreset: preset };
      const nextRect = CropCoordinateMapper.applyAspectRatioPreset(
        prev.cropRect,
        preset,
        prev.inspection.displayWidth,
        prev.inspection.displayHeight,
      );
      return {
        ...prev,
        aspectPreset: preset,
        cropRect: nextRect,
        exportState:
          prev.exportState.status === 'completed' || prev.exportState.status === 'failed'
            ? { status: 'idle' }
            : prev.exportState,
      };
    });
  }, []);

  const handleCropRectChange = useCallback((rect: NormalizedCropRect) => {
    setCropUiState((prev) => ({
      ...prev,
      cropRect: rect,
      exportState:
        prev.exportState.status === 'completed' || prev.exportState.status === 'failed'
          ? { status: 'idle' }
          : prev.exportState,
    }));
  }, []);

  const handleRequestCropExport = useCallback(async () => {
    const st = cropUiStateRef.current;
    if (!st.inspection) return;
    const inspection = st.inspection;
    const feasibility = evaluateCropFeasibility(inspection, st.cropRect);

    if (feasibility.type === 'original_copy') {
      setCropUiState((prev) => ({
        ...prev,
        exportState: {
          status: 'exporting',
          progressFraction: 0.5,
          statusText: 'Copying 1:1 original bitstream…',
        },
      }));
      try {
        const output = await exportFullFrameCopy(inspection);
        setCropUiState((prev) => {
          if (prev.exportState.status === 'completed') {
            URL.revokeObjectURL(prev.exportState.output.objectUrl);
          }
          return {
            ...prev,
            exportState: { status: 'completed', output },
          };
        });
      } catch (err) {
        setCropUiState((prev) => ({
          ...prev,
          exportState: {
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : 'Failed to copy original media.',
          },
        }));
      }
      return;
    }

    setCropUiState((prev) => ({
      ...prev,
      exportState: {
        status: 'awaiting_consent',
        inspection,
        feasibility,
      },
    }));
  }, []);

  const handleConfirmCropConsent = useCallback(() => {
    setCropUiState((prev) => {
      if (prev.exportState.status !== 'awaiting_consent') return prev;
      const { inspection, feasibility } = prev.exportState;
      let nextVideoCfg = prev.videoFallbackConfig;

      if (inspection.kind === CropMediaKind.VIDEO && !nextVideoCfg.hasUserAdjustedBitrate) {
        const pixelRect = CropCoordinateMapper.toDisplayPixelRect(
          prev.cropRect,
          inspection.displayWidth,
          inspection.displayHeight,
          true,
        );
        const outDims = CropCoordinateMapper.computeVideoOutputDimensions(
          pixelRect.width,
          pixelRect.height,
          nextVideoCfg.resolutionPreset,
        );
        const range = CropCoordinateMapper.computeDynamicBitrateRange(
          nextVideoCfg.resolutionPreset,
          nextVideoCfg.fpsPreset,
          outDims.width,
          outDims.height,
          inspection.bitrateBps,
          inspection.frameRate,
        );
        nextVideoCfg = { ...nextVideoCfg, bitrateMbps: range.suggestedMbps };
      }

      return {
        ...prev,
        videoFallbackConfig: nextVideoCfg,
        exportState: {
          status: 'configuring_fallback',
          inspection,
          feasibility,
        },
      };
    });
  }, []);

  const updateVideoFallbackWithBitrateRecalc = useCallback(
    (updater: (cfg: VideoCropFallbackConfig) => VideoCropFallbackConfig) => {
      setCropUiState((prev) => {
        const nextCfg = updater(prev.videoFallbackConfig);
        if (!prev.inspection || nextCfg.hasUserAdjustedBitrate) {
          return { ...prev, videoFallbackConfig: nextCfg };
        }
        const pixelRect = CropCoordinateMapper.toDisplayPixelRect(
          prev.cropRect,
          prev.inspection.displayWidth,
          prev.inspection.displayHeight,
          true,
        );
        const outDims = CropCoordinateMapper.computeVideoOutputDimensions(
          pixelRect.width,
          pixelRect.height,
          nextCfg.resolutionPreset,
        );
        const range = CropCoordinateMapper.computeDynamicBitrateRange(
          nextCfg.resolutionPreset,
          nextCfg.fpsPreset,
          outDims.width,
          outDims.height,
          prev.inspection.bitrateBps,
          prev.inspection.frameRate,
        );
        return {
          ...prev,
          videoFallbackConfig: { ...nextCfg, bitrateMbps: range.suggestedMbps },
        };
      });
    },
    [],
  );

  const handleStartAuthorizedExport = useCallback(async () => {
    const st = cropUiStateRef.current;
    if (!st.inspection) return;
    const inspection = st.inspection;
    cropExportCancelledRef.current = false;

    setCropUiState((prev) => ({
      ...prev,
      exportState: {
        status: 'exporting',
        progressFraction: 0.05,
        statusText:
          inspection.kind === CropMediaKind.PHOTO
            ? 'Cropping & encoding photo…'
            : 'Rendering & re-encoding cropped video…',
      },
    }));

    try {
      const output =
        inspection.kind === CropMediaKind.PHOTO
          ? await exportCroppedPhoto(
              inspection,
              st.cropRect,
              st.photoFallbackConfig,
              (fraction) => {
                if (!cropExportCancelledRef.current) {
                  setCropUiState((prev) => ({
                    ...prev,
                    exportState: {
                      status: 'exporting',
                      progressFraction: fraction,
                      statusText: 'Cropping & encoding photo…',
                    },
                  }));
                }
              },
            )
          : await exportCroppedVideo(
              inspection,
              st.cropRect,
              st.videoFallbackConfig,
              () => cropExportCancelledRef.current,
              (fraction) => {
                if (!cropExportCancelledRef.current) {
                  setCropUiState((prev) => ({
                    ...prev,
                    exportState: {
                      status: 'exporting',
                      progressFraction: fraction,
                      statusText: 'Rendering & re-encoding cropped video…',
                    },
                  }));
                }
              },
            );

      if (cropExportCancelledRef.current) {
        URL.revokeObjectURL(output.objectUrl);
        return;
      }

      setCropUiState((prev) => {
        if (prev.exportState.status === 'completed') {
          URL.revokeObjectURL(prev.exportState.output.objectUrl);
        }
        return {
          ...prev,
          exportState: { status: 'completed', output },
        };
      });
    } catch (err) {
      if (cropExportCancelledRef.current) {
        setCropUiState((prev) => ({
          ...prev,
          exportState: { status: 'idle' },
        }));
        return;
      }
      setCropUiState((prev) => ({
        ...prev,
        exportState: {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : 'Crop export failed.',
        },
      }));
    }
  }, []);

  return (
    <>
      {activeRoute === 'main' && (
        <MainScreen
          settings={settings}
          session={session}
          canvasWidthPx={canvasWidthPx}
          canvasHeightPx={canvasHeightPx}
          selectedPixelRegion={selectedPixelRegion}
          recordingsCount={recordings.length}
          isDarkTheme={isDarkTheme}
          bitrateDraft={bitrateDraft}
          onBitrateDraftChange={setBitrateDraft}
          onToggleTheme={() =>
            setSettings((prev) => ({
              ...prev,
              darkThemeOverride: !(prev.darkThemeOverride ?? true),
            }))
          }
          onOpenCropTool={() => setActiveRoute('crop_tool')}
          onOpenRecordings={() => setActiveRoute('recordings')}
          onOpenSettings={() => setActiveRoute('settings')}
          onStartRecord={() => void handleStartRecord()}
          onPauseResume={handlePauseResume}
          onStop={() => void handleStopRecording()}
          onDismissMessages={() =>
            setSession((prev) => ({ ...prev, warningMessage: null, errorMessage: null }))
          }
          onSelectMode={(mode: RecordingMode) =>
            updateSettingsIfIdle((prev) => ({ ...prev, recordingMode: mode }))
          }
          onSelectOrientation={(mode: OrientationMode) =>
            updateSettingsIfIdle((prev) => ({ ...prev, orientationMode: mode }))
          }
          onSelectAudioSource={(source: AudioSourceOption) =>
            updateSettingsIfIdle((prev) => ({ ...prev, audioSource: source }))
          }
          onSelectBitrate={(bitrate: VideoBitrateOption) => {
            setBitrateDraft(null);
            updateSettingsIfIdle((prev) => ({
              ...prev,
              videoBitrate: bitrate,
              customVideoBitrateMbps: null,
            }));
          }}
          onSaveCustomBitrateMbps={(mbps: number) =>
            updateSettingsIfIdle((prev) => ({ ...prev, customVideoBitrateMbps: mbps }))
          }
          onResetCustomBitrate={() => {
            setBitrateDraft(null);
            updateSettingsIfIdle((prev) => ({ ...prev, customVideoBitrateMbps: null }));
          }}
          onSelectRegionAnimation={(anim: RegionAnimationOption) => {
            setSettings((prev) => ({ ...prev, regionAnimation: anim }));
            setSession((prev) => ({
              ...prev,
              showRegionBorder:
                prev.phase !== RecordingPhase.IDLE &&
                prev.activeMode === RecordingMode.REGION &&
                anim === RegionAnimationOption.SHOW,
            }));
          }}
          onEditRegion={() => {
            if (session.phase !== RecordingPhase.IDLE) return;
            setDraftRegion(settings.selectedRegion);
            setDraftPresetIndex(0);
            setIsEditingRegion(true);
          }}
        />
      )}

      {activeRoute === 'settings' && (
        <SettingsScreen
          settings={settings}
          isIdle={session.phase === RecordingPhase.IDLE}
          fpsDraft={fpsDraft}
          gopDraft={gopDraft}
          audioKhzDraft={audioKhzDraft}
          audioKbpsDraft={audioKbpsDraft}
          onFpsDraftChange={setFpsDraft}
          onGopDraftChange={setGopDraft}
          onAudioKhzDraftChange={setAudioKhzDraft}
          onAudioKbpsDraftChange={setAudioKbpsDraft}
          onBack={() => setActiveRoute('main')}
          onSelectBitrateMode={(mode: BitrateModeOption) =>
            updateSettingsIfIdle((prev) => ({ ...prev, bitrateMode: mode }))
          }
          onSelectColorDepth={(depth: ColorDepthOption) =>
            updateSettingsIfIdle((prev) => ({ ...prev, colorDepth: depth }))
          }
          onSelectVideoFps={(fps: VideoFpsOption) => {
            setFpsDraft(null);
            updateSettingsIfIdle((prev) => ({ ...prev, videoFps: fps, customVideoFps: null }));
          }}
          onSelectGopInterval={(gop: GopIntervalOption) => {
            setGopDraft(null);
            updateSettingsIfIdle((prev) => ({
              ...prev,
              gopInterval: gop,
              customGopSeconds: null,
            }));
          }}
          onSelectColorRange={(range: ColorRangeOption) =>
            updateSettingsIfIdle((prev) => ({ ...prev, colorRange: range }))
          }
          onSelectAudioFormat={(fmt: AudioFormatOption) =>
            updateSettingsIfIdle((prev) => ({ ...prev, audioFormat: fmt }))
          }
          onSaveCustomFps={(fps: number) =>
            updateSettingsIfIdle((prev) => ({ ...prev, customVideoFps: fps }))
          }
          onResetCustomFps={() => {
            setFpsDraft(null);
            updateSettingsIfIdle((prev) => ({ ...prev, customVideoFps: null }));
          }}
          onSaveCustomGopSeconds={(sec: number) =>
            updateSettingsIfIdle((prev) => ({ ...prev, customGopSeconds: sec }))
          }
          onResetCustomGop={() => {
            setGopDraft(null);
            updateSettingsIfIdle((prev) => ({ ...prev, customGopSeconds: null }));
          }}
          onSaveCustomAudio={(sampleRateHz, bitrateBps) =>
            updateSettingsIfIdle((prev) => ({
              ...prev,
              customAudioSampleRateHz: sampleRateHz,
              customAudioBitrateBps: bitrateBps,
            }))
          }
          onResetCustomAudio={() => {
            setAudioKhzDraft(null);
            setAudioKbpsDraft(null);
            updateSettingsIfIdle((prev) => ({
              ...prev,
              customAudioSampleRateHz: null,
              customAudioBitrateBps: null,
            }));
          }}
        />
      )}

      {activeRoute === 'recordings' && (
        <RecordingsScreen
          recordings={recordings}
          isLoading={isLoadingRecordings}
          playingRecordingId={playingRecordingId}
          playbackPositionMs={playbackPositionMs}
          onBack={() => setActiveRoute('main')}
          onDelete={(item) => void handleDeleteRecording(item)}
          onPlayingRecordingChange={(id, posMs = 0) => {
            setPlayingRecordingId(id);
            setPlaybackPositionMs(posMs);
          }}
          onPlaybackPositionChange={setPlaybackPositionMs}
        />
      )}

      {activeRoute === 'crop_tool' && (
        <CropToolScreen
          cropUiState={cropUiState}
          onBack={() => setActiveRoute('main')}
          onSelectCategory={(cat) => setCropUiState((prev) => ({ ...prev, category: cat }))}
          onFileSelected={(file) => void handleCropFileSelected(file)}
          onCropRectChange={handleCropRectChange}
          onSelectAspectPreset={handleSelectCropAspectPreset}
          onResetCrop={() => {
            setCropUiState((prev) => ({
              ...prev,
              cropRect: { ...DEFAULT_CROP_RECT },
              aspectPreset: CropAspectRatioPreset.FREE,
              exportState:
                prev.exportState.status === 'completed' || prev.exportState.status === 'failed'
                  ? { status: 'idle' }
                  : prev.exportState,
            }));
          }}
          onSelectFullFrame={() => {
            setCropUiState((prev) => ({
              ...prev,
              cropRect: { ...FULL_FRAME_CROP_RECT },
              aspectPreset: CropAspectRatioPreset.FREE,
              exportState:
                prev.exportState.status === 'completed' || prev.exportState.status === 'failed'
                  ? { status: 'idle' }
                  : prev.exportState,
            }));
          }}
          onRequestExport={() => void handleRequestCropExport()}
          onDismissConsent={() =>
            setCropUiState((prev) => {
              if (prev.exportState.status === 'completed') {
                URL.revokeObjectURL(prev.exportState.output.objectUrl);
              }
              return { ...prev, exportState: { status: 'idle' } };
            })
          }
          onConfirmConsent={handleConfirmCropConsent}
          onUpdateVideoResolution={(preset) =>
            updateVideoFallbackWithBitrateRecalc((cfg) => ({
              ...cfg,
              resolutionPreset: preset,
            }))
          }
          onUpdateVideoFps={(preset) =>
            updateVideoFallbackWithBitrateRecalc((cfg) => ({
              ...cfg,
              fpsPreset: preset,
            }))
          }
          onUpdateVideoOutputFormat={(fmt) =>
            setCropUiState((prev) => ({
              ...prev,
              videoFallbackConfig: { ...prev.videoFallbackConfig, outputFormat: fmt },
            }))
          }
          onUpdateVideoBitrateMbps={(mbps) =>
            setCropUiState((prev) => ({
              ...prev,
              videoFallbackConfig: {
                ...prev.videoFallbackConfig,
                bitrateMbps: mbps,
                hasUserAdjustedBitrate: true,
              },
            }))
          }
          onUpdatePhotoFallback={(cfg) =>
            setCropUiState((prev) => ({ ...prev, photoFallbackConfig: cfg }))
          }
          onStartAuthorizedExport={() => void handleStartAuthorizedExport()}
          onCancelExport={() => {
            cropExportCancelledRef.current = true;
            setCropUiState((prev) => ({
              ...prev,
              exportState: { status: 'idle' },
            }));
          }}
        />
      )}

      {isEditingRegion && (
        <RegionSelectorOverlay
          initialRegion={settings.selectedRegion ?? DEFAULT_NORMALIZED_REGION}
          screenWidthPx={canvasWidthPx}
          screenHeightPx={canvasHeightPx}
          regionAnimation={settings.regionAnimation}
          draftRegion={draftRegion}
          selectedPresetIndex={draftPresetIndex}
          onDraftChanged={(r) => setDraftRegion(normalizeRegion(r))}
          onPresetChanged={setDraftPresetIndex}
          onConfirm={(confirmed) => {
            const clean = normalizeRegion(confirmed);
            setSettings((prev) => ({ ...prev, selectedRegion: clean }));
            setIsEditingRegion(false);
          }}
          onCancel={() => setIsEditingRegion(false)}
        />
      )}
    </>
  );
}

export default App;
