import React, { useRef } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Crop,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Maximize,
  RotateCcw,
  ShieldCheck,
  Sliders,
  X,
} from 'lucide-react';
import {
  CROP_ASPECT_PRESET_META,
  CropAspectRatioPreset,
  CropExportState,
  CropMediaCategory,
  CropMediaKind,
  MediaInspectionResult,
  NormalizedCropRect,
  PHOTO_OUTPUT_FORMAT_META,
  PhotoCropFallbackConfig,
  PhotoOutputFormatPreset,
  VIDEO_CROP_FPS_META,
  VIDEO_CROP_RES_META,
  VIDEO_OUTPUT_FORMAT_META,
  VideoCropFallbackConfig,
  VideoCropFpsPreset,
  VideoCropResolutionPreset,
  VideoOutputFormatPreset,
  isFullFrameCrop,
} from '../types/crop';
import { CropCoordinateMapper } from '../utils/cropCoordinateMapper';
import { resolvePhotoOutputSpec, resolveVideoOutputSpec } from '../utils/mediaCropEngine';
import { formatMediaSize } from '../utils/mediaCropInspector';
import { CropEditorCanvas } from '../components/CropEditorCanvas';

export interface CropUiState {
  category: CropMediaCategory;
  isLoadingMedia: boolean;
  inspection: MediaInspectionResult | null;
  loadErrorMessage: string | null;
  cropRect: NormalizedCropRect;
  aspectPreset: CropAspectRatioPreset;
  videoFallbackConfig: VideoCropFallbackConfig;
  photoFallbackConfig: PhotoCropFallbackConfig;
  exportState: CropExportState;
}

interface CropToolScreenProps {
  cropUiState: CropUiState;
  onBack: () => void;
  onSelectCategory: (cat: CropMediaCategory) => void;
  onFileSelected: (file: File) => void;
  onCropRectChange: (rect: NormalizedCropRect) => void;
  onSelectAspectPreset: (preset: CropAspectRatioPreset) => void;
  onResetCrop: () => void;
  onSelectFullFrame: () => void;
  onRequestExport: () => void;
  onDismissConsent: () => void;
  onConfirmConsent: () => void;
  onUpdateVideoResolution: (preset: VideoCropResolutionPreset) => void;
  onUpdateVideoFps: (preset: VideoCropFpsPreset) => void;
  onUpdateVideoOutputFormat: (fmt: VideoOutputFormatPreset) => void;
  onUpdateVideoBitrateMbps: (mbps: number) => void;
  onUpdatePhotoFallback: (cfg: PhotoCropFallbackConfig) => void;
  onStartAuthorizedExport: () => void;
  onCancelExport: () => void;
}

function downloadBlob(objectUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const CropToolScreen: React.FC<CropToolScreenProps> = ({
  cropUiState,
  onBack,
  onSelectCategory,
  onFileSelected,
  onCropRectChange,
  onSelectAspectPreset,
  onResetCrop,
  onSelectFullFrame,
  onRequestExport,
  onDismissConsent,
  onConfirmConsent,
  onUpdateVideoResolution,
  onUpdateVideoFps,
  onUpdateVideoOutputFormat,
  onUpdateVideoBitrateMbps,
  onUpdatePhotoFallback,
  onStartAuthorizedExport,
  onCancelExport,
}) => {
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const anyFileInputRef = useRef<HTMLInputElement | null>(null);

  const isBusy = cropUiState.isLoadingMedia || cropUiState.exportState.status === 'exporting';
  const inspection = cropUiState.inspection;
  const isFullFrame = isFullFrameCrop(cropUiState.cropRect);

  const acceptForCategory =
    cropUiState.category === CropMediaCategory.PHOTO
      ? 'image/*'
      : cropUiState.category === CropMediaCategory.VIDEO
      ? 'video/*'
      : 'image/*,video/*';

  const triggerPickMedia = (cat: CropMediaCategory) => {
    onSelectCategory(cat);
    if (mediaInputRef.current) {
      mediaInputRef.current.accept =
        cat === CropMediaCategory.PHOTO
          ? 'image/*'
          : cat === CropMediaCategory.VIDEO
          ? 'video/*'
          : 'image/*,video/*';
      mediaInputRef.current.value = '';
      mediaInputRef.current.click();
    }
  };

  const triggerBrowseAny = () => {
    if (anyFileInputRef.current) {
      anyFileInputRef.current.value = '';
      anyFileInputRef.current.click();
    }
  };

  const liveCropPixels = inspection
    ? CropCoordinateMapper.toDisplayPixelRect(
        cropUiState.cropRect,
        inspection.displayWidth,
        inspection.displayHeight,
        inspection.kind === CropMediaKind.VIDEO,
      )
    : null;

  return (
    <div className="min-h-screen bg-[var(--fc-bg)] text-[var(--fc-on-surface)]">
      <input
        ref={mediaInputRef}
        type="file"
        accept={acceptForCategory}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelected(f);
        }}
      />
      <input
        ref={anyFileInputRef}
        type="file"
        accept="*/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelected(f);
        }}
      />

      <header className="sticky top-0 z-30 border-b border-[var(--fc-outline-variant)] bg-[var(--fc-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            data-testid="crop_back_button"
            aria-label="Navigate back"
            onClick={onBack}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] transition-colors hover:bg-[var(--fc-surface-variant)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-[18px] leading-tight font-bold text-[var(--fc-on-surface)]">
              Media Crop Tool
            </h1>
            <p className="text-[12px] text-[var(--fc-on-surface-variant)]">
              Universal Photo &amp; Video Crop
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-4 pb-10 sm:px-6">
        <div className="mb-4 grid grid-cols-3 border-b border-[var(--fc-outline-variant)]">
          {[CropMediaCategory.ALL, CropMediaCategory.PHOTO, CropMediaCategory.VIDEO].map(
            (cat) => {
              const selected = cropUiState.category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  disabled={isBusy}
                  data-testid={`crop_tab_${cat.toLowerCase()}`}
                  onClick={() => triggerPickMedia(cat)}
                  className={`relative h-12 cursor-pointer text-[13px] transition-colors ${
                    selected
                      ? 'font-bold text-[var(--fc-primary)]'
                      : 'font-medium text-[var(--fc-on-surface-variant)] hover:text-[var(--fc-on-surface)]'
                  }`}
                >
                  {cat}
                  {selected && (
                    <span className="absolute right-6 bottom-0 left-6 h-[2.5px] rounded-full bg-[var(--fc-primary)]" />
                  )}
                </button>
              );
            },
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={isBusy}
              data-testid="crop_pick_media_btn"
              onClick={() => triggerPickMedia(cropUiState.category)}
              className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[var(--fc-outline)] bg-[var(--fc-surface)] px-4 text-[13px] font-semibold text-[var(--fc-on-surface)] transition-colors hover:bg-[var(--fc-surface-variant)]"
            >
              <ImageIcon className="h-4 w-4" />
              <span>{inspection ? `Pick ${cropUiState.category}` : 'Pick Media from Gallery'}</span>
            </button>
            <button
              type="button"
              disabled={isBusy}
              data-testid="crop_browse_files_btn"
              onClick={triggerBrowseAny}
              className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[var(--fc-outline)] bg-[var(--fc-surface)] px-4 text-[13px] font-semibold text-[var(--fc-on-surface)] transition-colors hover:bg-[var(--fc-surface-variant)]"
            >
              <FolderOpen className="h-4 w-4" />
              <span>Browse Any File</span>
            </button>
          </div>

          {cropUiState.isLoadingMedia && (
            <div className="rounded-[14px] border border-[var(--fc-outline-variant)] bg-[var(--fc-surface)] p-4">
              <div className="mb-2 text-[14px] font-semibold">
                Inspecting media streams &amp; orientation…
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--fc-surface-variant)]">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--fc-primary)]" />
              </div>
            </div>
          )}

          {cropUiState.loadErrorMessage && (
            <div className="flex items-center gap-2.5 rounded-[14px] bg-[var(--fc-error-container)] p-3.5 text-[13px] text-[var(--fc-on-error-container)]">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
              <span>{cropUiState.loadErrorMessage}</span>
            </div>
          )}

          {!inspection && !cropUiState.isLoadingMedia && (
            <div className="flex flex-col items-center gap-4 rounded-[18px] border border-[var(--fc-outline-variant)] bg-[var(--fc-surface)] p-8 text-center">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-[var(--fc-primary-container)] text-[var(--fc-on-primary-container)]">
                <Crop className="h-8 w-8" />
              </div>
              <h2 className="font-display text-[17px] font-semibold text-[var(--fc-on-surface)]">
                Select {cropUiState.category} Media to Crop
              </h2>
              <p className="max-w-xl text-[13px] leading-relaxed text-[var(--fc-on-surface-variant)]">
                Supports JPEG, PNG, WebP, GIF, BMP, MP4, MOV, MKV, and WebM. Full-frame exports keep
                1:1 original bitstreams; sub-region crops request confirmation and save a new{' '}
                <span className="font-mono-tnum">_cropped</span> file.
              </p>
              <div className="flex w-full max-w-md gap-2.5">
                <button
                  type="button"
                  data-testid="crop_empty_pick_btn"
                  onClick={() => triggerPickMedia(cropUiState.category)}
                  className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-[var(--fc-primary)] px-4 text-[13px] font-semibold text-white hover:opacity-95"
                >
                  <ImageIcon className="h-4 w-4" />
                  <span>Pick Media from Gallery</span>
                </button>
                <button
                  type="button"
                  data-testid="crop_empty_browse_btn"
                  onClick={triggerBrowseAny}
                  className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[var(--fc-outline)] px-4 text-[13px] font-semibold text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>Browse Any File</span>
                </button>
              </div>
            </div>
          )}

          {inspection && liveCropPixels && (
            <>
              <div className="rounded-[14px] border border-[var(--fc-outline-variant)] bg-[var(--fc-surface)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-semibold text-[var(--fc-on-surface)]">
                    {inspection.displayName}
                  </span>
                  <span className="font-mono-tnum shrink-0 text-[12px] text-[var(--fc-on-surface-variant)]">
                    {formatMediaSize(inspection.fileSizeBytes)}
                  </span>
                </div>
                <div className="font-mono-tnum mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--fc-on-surface-variant)]">
                  <span>
                    {inspection.containerLabel} · {inspection.codecLabel}
                  </span>
                  <span>·</span>
                  <span>
                    Src {inspection.displayWidth}×{inspection.displayHeight}
                  </span>
                  <span>·</span>
                  <span className="font-semibold text-[var(--fc-on-surface)]">
                    Crop {liveCropPixels.width}×{liveCropPixels.height}
                  </span>
                  {inspection.frameRate && (
                    <>
                      <span>·</span>
                      <span>{inspection.frameRate} FPS</span>
                    </>
                  )}
                  {inspection.bitrateBps && (
                    <>
                      <span>·</span>
                      <span>{(inspection.bitrateBps / 1_000_000).toFixed(1)} Mbps</span>
                    </>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--fc-on-surface-variant)]">
                  <ShieldCheck
                    className={`h-4 w-4 shrink-0 ${
                      isFullFrame ? 'text-[var(--fc-primary)]' : 'text-[var(--fc-tertiary)]'
                    }`}
                  />
                  <span>
                    {isFullFrame
                      ? 'Full Frame: True 1:1 original stream copy (no re-encoding)'
                      : 'Sub-region crop: Will ask CANCEL / CONTINUE before re-encoding'}
                  </span>
                </div>
              </div>

              <CropEditorCanvas
                inspection={inspection}
                cropRect={cropUiState.cropRect}
                aspectPreset={cropUiState.aspectPreset}
                enabled={!isBusy}
                onCropRectChange={onCropRectChange}
              />

              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(CROP_ASPECT_PRESET_META) as CropAspectRatioPreset[]).map((preset) => {
                  const selected = cropUiState.aspectPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={isBusy}
                      data-testid={`crop_aspect_${preset.toLowerCase()}`}
                      onClick={() => onSelectAspectPreset(preset)}
                      className={`h-9 cursor-pointer rounded-[8px] px-3 text-[12px] font-medium transition-colors ${
                        selected
                          ? 'bg-[var(--fc-primary)] text-white'
                          : 'border border-[var(--fc-outline)] bg-[var(--fc-surface)] text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]'
                      }`}
                    >
                      {CROP_ASPECT_PRESET_META[preset].label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={isBusy}
                  data-testid="crop_reset_btn"
                  onClick={onResetCrop}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[var(--fc-outline)] bg-[var(--fc-surface)] px-3 text-[12px] font-medium text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  data-testid="crop_full_frame_btn"
                  onClick={onSelectFullFrame}
                  className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-medium transition-colors ${
                    isFullFrame
                      ? 'bg-[var(--fc-secondary-container)] text-[var(--fc-on-secondary-container)]'
                      : 'border border-[var(--fc-outline)] bg-[var(--fc-surface)] text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]'
                  }`}
                >
                  <Maximize className="h-3.5 w-3.5" />
                  <span>Full Frame</span>
                </button>
              </div>

              {cropUiState.exportState.status === 'configuring_fallback' ? (
                <FallbackConfigurationCard
                  inspection={cropUiState.exportState.inspection}
                  croppedWidth={liveCropPixels.width}
                  croppedHeight={liveCropPixels.height}
                  videoConfig={cropUiState.videoFallbackConfig}
                  photoConfig={cropUiState.photoFallbackConfig}
                  onUpdateVideoResolution={onUpdateVideoResolution}
                  onUpdateVideoFps={onUpdateVideoFps}
                  onUpdateVideoOutputFormat={onUpdateVideoOutputFormat}
                  onUpdateVideoBitrateMbps={onUpdateVideoBitrateMbps}
                  onUpdatePhotoFallback={onUpdatePhotoFallback}
                  onStartExport={onStartAuthorizedExport}
                  onCancel={onDismissConsent}
                />
              ) : cropUiState.exportState.status === 'exporting' ? (
                <div
                  data-testid="crop_export_progress_card"
                  className="rounded-[18px] border border-[var(--fc-outline-variant)] bg-[var(--fc-surface)] p-5"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold">
                      {cropUiState.exportState.statusText}
                    </span>
                    <span className="font-mono-tnum text-[14px] font-bold">
                      {Math.round(cropUiState.exportState.progressFraction * 100)}%
                    </span>
                  </div>
                  <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-[var(--fc-surface-variant)]">
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(2, cropUiState.exportState.progressFraction * 100))}%`,
                      }}
                      className="h-full rounded-full bg-[var(--fc-primary)] transition-all duration-150"
                    />
                  </div>
                  <button
                    type="button"
                    data-testid="crop_cancel_export_btn"
                    onClick={onCancelExport}
                    className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[12px] border border-[var(--fc-outline)] text-[13px] font-semibold hover:bg-[var(--fc-surface-variant)]"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancel Export</span>
                  </button>
                </div>
              ) : cropUiState.exportState.status === 'completed' ? (
                <div
                  data-testid="crop_completed_card"
                  className="rounded-[18px] bg-[var(--fc-secondary-container)] p-5 text-[var(--fc-on-secondary-container)]"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <h3 className="font-display text-[16px] font-semibold">
                      {cropUiState.exportState.output.usedOriginalStreamCopy
                        ? 'Saved 1:1 Original Stream Copy'
                        : 'Saved New Cropped Copy'}
                    </h3>
                  </div>
                  <p className="font-mono-tnum mb-4 text-[13px]">
                    {cropUiState.exportState.output.displayName} ·{' '}
                    {cropUiState.exportState.output.outputWidth}×
                    {cropUiState.exportState.output.outputHeight} ·{' '}
                    {formatMediaSize(cropUiState.exportState.output.sizeBytes)}
                  </p>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      data-testid="crop_done_btn"
                      onClick={onDismissConsent}
                      className="h-11 flex-1 cursor-pointer rounded-[12px] border border-current/30 text-[13px] font-semibold hover:bg-black/10"
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      data-testid="crop_download_btn"
                      onClick={() => {
                        if (cropUiState.exportState.status === 'completed') {
                          downloadBlob(
                            cropUiState.exportState.output.objectUrl,
                            cropUiState.exportState.output.displayName,
                          );
                        }
                      }}
                      className="inline-flex h-11 flex-[1.3] cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-[var(--fc-primary)] px-4 text-[13px] font-semibold text-white hover:opacity-95"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download File</span>
                    </button>
                  </div>
                </div>
              ) : cropUiState.exportState.status === 'failed' ? (
                <div className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--fc-error-container)] p-4 text-[13px] text-[var(--fc-on-error-container)]">
                  <span>{cropUiState.exportState.errorMessage}</span>
                  <button
                    type="button"
                    onClick={onDismissConsent}
                    className="cursor-pointer font-semibold underline"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isBusy}
                  data-testid="crop_export_button"
                  onClick={onRequestExport}
                  className="flex h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-[16px] bg-[var(--fc-primary)] px-6 font-display text-[16px] font-semibold text-white transition-opacity hover:opacity-95"
                >
                  <Crop className="h-5 w-5" />
                  <span>
                    {isFullFrame ? 'Export 1:1 Original Stream Copy' : 'Export Cropped Media'}
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </main>

      {cropUiState.exportState.status === 'awaiting_consent' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-[20px] border border-[var(--fc-outline)] bg-[var(--fc-surface)] p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2.5">
              <Sliders className="h-5 w-5 text-[var(--fc-primary)]" />
              <h2 className="font-display text-[18px] font-bold text-[var(--fc-on-surface)]">
                {cropUiState.exportState.feasibility.title}
              </h2>
            </div>
            <p className="text-[14px] leading-relaxed text-[var(--fc-on-surface)]">
              {cropUiState.exportState.feasibility.reason}
            </p>
            <div className="my-4 space-y-1.5 rounded-[14px] bg-[var(--fc-surface-variant)] p-3.5 text-[12px] text-[var(--fc-on-surface-variant)]">
              {cropUiState.exportState.feasibility.technicalDetails.map((line) => (
                <div key={line}>• {line}</div>
              ))}
            </div>
            <p className="text-[12px] text-[var(--fc-on-surface-variant)]">
              Your original file is never overwritten. Tap CONTINUE to configure export settings
              before encoding starts.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                data-testid="crop_consent_cancel"
                onClick={onDismissConsent}
                className="h-10 cursor-pointer rounded-[10px] px-4 text-[13px] font-semibold text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]"
              >
                CANCEL
              </button>
              <button
                type="button"
                data-testid="crop_consent_continue"
                onClick={onConfirmConsent}
                className="h-10 cursor-pointer rounded-[10px] bg-[var(--fc-primary)] px-4 text-[13px] font-semibold text-white hover:opacity-95"
              >
                CONTINUE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface FallbackConfigurationCardProps {
  inspection: MediaInspectionResult;
  croppedWidth: number;
  croppedHeight: number;
  videoConfig: VideoCropFallbackConfig;
  photoConfig: PhotoCropFallbackConfig;
  onUpdateVideoResolution: (preset: VideoCropResolutionPreset) => void;
  onUpdateVideoFps: (preset: VideoCropFpsPreset) => void;
  onUpdateVideoOutputFormat: (fmt: VideoOutputFormatPreset) => void;
  onUpdateVideoBitrateMbps: (mbps: number) => void;
  onUpdatePhotoFallback: (cfg: PhotoCropFallbackConfig) => void;
  onStartExport: () => void;
  onCancel: () => void;
}

const FallbackConfigurationCard: React.FC<FallbackConfigurationCardProps> = ({
  inspection,
  croppedWidth,
  croppedHeight,
  videoConfig,
  photoConfig,
  onUpdateVideoResolution,
  onUpdateVideoFps,
  onUpdateVideoOutputFormat,
  onUpdateVideoBitrateMbps,
  onUpdatePhotoFallback,
  onStartExport,
  onCancel,
}) => {
  const isVideo = inspection.kind === CropMediaKind.VIDEO;

  if (isVideo) {
    const targetSpec = resolveVideoOutputSpec(inspection, videoConfig.outputFormat);
    const { width: outW, height: outH } = CropCoordinateMapper.computeVideoOutputDimensions(
      croppedWidth,
      croppedHeight,
      videoConfig.resolutionPreset,
    );
    const range = CropCoordinateMapper.computeDynamicBitrateRange(
      videoConfig.resolutionPreset,
      videoConfig.fpsPreset,
      outW,
      outH,
      inspection.bitrateBps,
      inspection.frameRate,
    );
    const croppedLongEdge = Math.max(croppedWidth, croppedHeight);
    const resOptions = (Object.keys(VIDEO_CROP_RES_META) as VideoCropResolutionPreset[]).filter(
      (p) =>
        p === VideoCropResolutionPreset.ORIGINAL ||
        VIDEO_CROP_RES_META[p].maxLongEdge < croppedLongEdge ||
        videoConfig.resolutionPreset === p,
    );
    const effectiveSourceFps = Math.max(1, inspection.frameRate ?? 30);
    const fpsOptions = (Object.keys(VIDEO_CROP_FPS_META) as VideoCropFpsPreset[]).filter(
      (f) =>
        f === VideoCropFpsPreset.ORIGINAL ||
        VIDEO_CROP_FPS_META[f].fps < effectiveSourceFps ||
        videoConfig.fpsPreset === f,
    );

    return (
      <div
        data-testid="crop_fallback_config_card"
        className="space-y-4 rounded-[18px] border border-[var(--fc-outline-variant)] bg-[var(--fc-surface)] p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[16px] font-semibold">
            Video Crop Export Configuration
          </h3>
          <span className="font-mono-tnum text-[12px] text-[var(--fc-on-surface-variant)]">
            {targetSpec.containerName} · {targetSpec.codecShortName}
          </span>
        </div>

        <div>
          <div className="mb-1.5 text-[12px] font-semibold text-[var(--fc-on-surface-variant)]">
            Output File Format
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VIDEO_OUTPUT_FORMAT_META) as VideoOutputFormatPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onUpdateVideoOutputFormat(preset)}
                className={`h-9 cursor-pointer rounded-[8px] px-3 text-[12px] font-medium ${
                  videoConfig.outputFormat === preset
                    ? 'bg-[var(--fc-primary)] text-white'
                    : 'border border-[var(--fc-outline)] hover:bg-[var(--fc-surface-variant)]'
                }`}
              >
                {preset === VideoOutputFormatPreset.ORIGINAL
                  ? `Original (${inspection.containerLabel})`
                  : VIDEO_OUTPUT_FORMAT_META[preset].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[12px] font-semibold text-[var(--fc-on-surface-variant)]">
            Resolution (Output: {outW}×{outH} · Max = Original)
          </div>
          <div className="flex flex-wrap gap-2">
            {resOptions.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onUpdateVideoResolution(preset)}
                className={`h-9 cursor-pointer rounded-[8px] px-3 text-[12px] font-medium ${
                  videoConfig.resolutionPreset === preset
                    ? 'bg-[var(--fc-primary)] text-white'
                    : 'border border-[var(--fc-outline)] hover:bg-[var(--fc-surface-variant)]'
                }`}
              >
                {preset === VideoCropResolutionPreset.ORIGINAL
                  ? `Original (${croppedWidth}×${croppedHeight})`
                  : VIDEO_CROP_RES_META[preset].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[12px] font-semibold text-[var(--fc-on-surface-variant)]">
            Frame Rate (Max = Original)
          </div>
          <div className="flex flex-wrap gap-2">
            {fpsOptions.map((fpsPreset) => (
              <button
                key={fpsPreset}
                type="button"
                onClick={() => onUpdateVideoFps(fpsPreset)}
                className={`h-9 cursor-pointer rounded-[8px] px-3 text-[12px] font-medium ${
                  videoConfig.fpsPreset === fpsPreset
                    ? 'bg-[var(--fc-primary)] text-white'
                    : 'border border-[var(--fc-outline)] hover:bg-[var(--fc-surface-variant)]'
                }`}
              >
                {fpsPreset === VideoCropFpsPreset.ORIGINAL
                  ? `Original (${inspection.frameRate ?? 30} FPS)`
                  : VIDEO_CROP_FPS_META[fpsPreset].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-[12px]">
            <span className="font-semibold">Target Bitrate: {videoConfig.bitrateMbps} Mbps</span>
            <span className="text-[var(--fc-on-surface-variant)]">
              Suggested: {range.suggestedMbps} Mbps
            </span>
          </div>
          <input
            type="range"
            min={range.minMbps}
            max={Math.max(range.minMbps + 1, range.maxMbps)}
            value={Math.min(
              Math.max(range.minMbps, videoConfig.bitrateMbps),
              Math.max(range.minMbps + 1, range.maxMbps),
            )}
            onChange={(e) => onUpdateVideoBitrateMbps(Number.parseInt(e.target.value, 10))}
            className="w-full accent-[var(--fc-primary)]"
          />
          <div className="flex justify-between text-[11px] text-[var(--fc-on-surface-variant)]">
            <span>{range.minMbps} Mbps (Smaller)</span>
            <span>{range.maxMbps} Mbps (Max Original)</span>
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-[var(--fc-outline-variant)] pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 cursor-pointer rounded-[12px] border border-[var(--fc-outline)] text-[13px] font-semibold hover:bg-[var(--fc-surface-variant)]"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="crop_start_reencode_btn"
            onClick={onStartExport}
            className="h-11 flex-[1.4] cursor-pointer rounded-[12px] bg-[var(--fc-primary)] text-[13px] font-semibold text-white hover:opacity-95"
          >
            Start Re-Encode Export
          </button>
        </div>
      </div>
    );
  }

  const effectiveSpec = resolvePhotoOutputSpec(
    inspection.mimeType,
    inspection.displayName,
    photoConfig.outputFormat,
  );
  const isPngLossless = effectiveSpec.mimeType.includes('png');
  const scaledW = Math.max(1, Math.round((croppedWidth * photoConfig.scalePercent) / 100));
  const scaledH = Math.max(1, Math.round((croppedHeight * photoConfig.scalePercent) / 100));

  return (
    <div
      data-testid="crop_fallback_config_card"
      className="space-y-4 rounded-[18px] border border-[var(--fc-outline-variant)] bg-[var(--fc-surface)] p-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[16px] font-semibold">Photo Crop Export Configuration</h3>
        <span className="font-mono-tnum text-[12px] text-[var(--fc-on-surface-variant)]">
          {effectiveSpec.extension.toUpperCase()} · {scaledW}×{scaledH}
        </span>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold text-[var(--fc-on-surface-variant)]">
          Output File Format
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PHOTO_OUTPUT_FORMAT_META) as PhotoOutputFormatPreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onUpdatePhotoFallback({ ...photoConfig, outputFormat: preset })}
              className={`h-9 cursor-pointer rounded-[8px] px-3 text-[12px] font-medium ${
                photoConfig.outputFormat === preset
                  ? 'bg-[var(--fc-primary)] text-white'
                  : 'border border-[var(--fc-outline)] hover:bg-[var(--fc-surface-variant)]'
              }`}
            >
              {preset === PhotoOutputFormatPreset.ORIGINAL
                ? `Original (${inspection.containerLabel})`
                : PHOTO_OUTPUT_FORMAT_META[preset].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold text-[var(--fc-on-surface-variant)]">
          Output Size: {photoConfig.scalePercent}% ({scaledW}×{scaledH})
        </div>
        <div className="mb-2 flex flex-wrap gap-2">
          {[100, 75, 50, 25].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => onUpdatePhotoFallback({ ...photoConfig, scalePercent: pct })}
              className={`h-8 cursor-pointer rounded-[8px] px-3 text-[12px] font-medium ${
                photoConfig.scalePercent === pct
                  ? 'bg-[var(--fc-primary)] text-white'
                  : 'border border-[var(--fc-outline)] hover:bg-[var(--fc-surface-variant)]'
              }`}
            >
              {pct === 100 ? 'Original (100%)' : `${pct}%`}
            </button>
          ))}
        </div>
        <input
          type="range"
          min={25}
          max={100}
          value={photoConfig.scalePercent}
          onChange={(e) =>
            onUpdatePhotoFallback({
              ...photoConfig,
              scalePercent: Number.parseInt(e.target.value, 10),
            })
          }
          className="w-full accent-[var(--fc-primary)]"
        />
      </div>

      <div>
        <div className="mb-1 text-[12px] font-semibold text-[var(--fc-on-surface-variant)]">
          {isPngLossless
            ? 'Compression: PNG Lossless (100%)'
            : photoConfig.qualityPercent === 100
            ? 'Encoding Quality: 100% (Max Original)'
            : `Encoding Quality: ${photoConfig.qualityPercent}%`}
        </div>
        <input
          type="range"
          min={25}
          max={100}
          disabled={isPngLossless}
          value={isPngLossless ? 100 : photoConfig.qualityPercent}
          onChange={(e) =>
            onUpdatePhotoFallback({
              ...photoConfig,
              qualityPercent: Number.parseInt(e.target.value, 10),
            })
          }
          className="w-full accent-[var(--fc-primary)] disabled:opacity-50"
        />
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold">Preserve EXIF &amp; Orientation Metadata</div>
          <div className="text-[12px] text-[var(--fc-on-surface-variant)]">
            Keeps camera tags &amp; normalizes crop orientation
          </div>
        </div>
        <input
          type="checkbox"
          checked={photoConfig.preserveExifAndColor}
          onChange={(e) =>
            onUpdatePhotoFallback({ ...photoConfig, preserveExifAndColor: e.target.checked })
          }
          className="h-4 w-4 accent-[var(--fc-primary)]"
        />
      </label>

      <div className="flex gap-2.5 border-t border-[var(--fc-outline-variant)] pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 cursor-pointer rounded-[12px] border border-[var(--fc-outline)] text-[13px] font-semibold hover:bg-[var(--fc-surface-variant)]"
        >
          Cancel
        </button>
        <button
          type="button"
          data-testid="crop_start_reencode_btn"
          onClick={onStartExport}
          className="h-11 flex-[1.4] cursor-pointer rounded-[12px] bg-[var(--fc-primary)] text-[13px] font-semibold text-white hover:opacity-95"
        >
          Start Crop Export
        </button>
      </div>
    </div>
  );
};
