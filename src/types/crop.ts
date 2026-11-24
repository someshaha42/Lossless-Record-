export enum CropMediaCategory {
  ALL = 'ALL',
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
}

export enum CropMediaKind {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
}

export enum CropAspectRatioPreset {
  FREE = 'FREE',
  RATIO_1_1 = 'RATIO_1_1',
  RATIO_4_3 = 'RATIO_4_3',
  RATIO_16_9 = 'RATIO_16_9',
  RATIO_9_16 = 'RATIO_9_16',
}

export const CROP_ASPECT_PRESET_META: Record<
  CropAspectRatioPreset,
  { label: string; widthFactor: number | null; heightFactor: number | null }
> = {
  [CropAspectRatioPreset.FREE]: { label: 'Free', widthFactor: null, heightFactor: null },
  [CropAspectRatioPreset.RATIO_1_1]: { label: '1:1', widthFactor: 1, heightFactor: 1 },
  [CropAspectRatioPreset.RATIO_4_3]: { label: '4:3', widthFactor: 4, heightFactor: 3 },
  [CropAspectRatioPreset.RATIO_16_9]: { label: '16:9', widthFactor: 16, heightFactor: 9 },
  [CropAspectRatioPreset.RATIO_9_16]: { label: '9:16', widthFactor: 9, heightFactor: 16 },
};

export enum CropDragHandle {
  TOP_LEFT = 'TOP_LEFT',
  TOP_CENTER = 'TOP_CENTER',
  TOP_RIGHT = 'TOP_RIGHT',
  MIDDLE_LEFT = 'MIDDLE_LEFT',
  MIDDLE_RIGHT = 'MIDDLE_RIGHT',
  BOTTOM_LEFT = 'BOTTOM_LEFT',
  BOTTOM_CENTER = 'BOTTOM_CENTER',
  BOTTOM_RIGHT = 'BOTTOM_RIGHT',
  MOVE_BOX = 'MOVE_BOX',
}

export enum PhotoOutputFormatPreset {
  ORIGINAL = 'ORIGINAL',
  JPEG = 'JPEG',
  PNG = 'PNG',
  WEBP = 'WEBP',
}

export const PHOTO_OUTPUT_FORMAT_META: Record<
  PhotoOutputFormatPreset,
  { label: string; mimeType: string | null; extension: string | null }
> = {
  [PhotoOutputFormatPreset.ORIGINAL]: { label: 'Original', mimeType: null, extension: null },
  [PhotoOutputFormatPreset.JPEG]: { label: 'JPEG', mimeType: 'image/jpeg', extension: 'jpg' },
  [PhotoOutputFormatPreset.PNG]: { label: 'PNG (Lossless)', mimeType: 'image/png', extension: 'png' },
  [PhotoOutputFormatPreset.WEBP]: { label: 'WebP', mimeType: 'image/webp', extension: 'webp' },
};

export enum VideoOutputFormatPreset {
  ORIGINAL = 'ORIGINAL',
  MP4_H264 = 'MP4_H264',
  MP4_HEVC = 'MP4_HEVC',
  WEBM = 'WEBM',
}

export const VIDEO_OUTPUT_FORMAT_META: Record<VideoOutputFormatPreset, { label: string }> = {
  [VideoOutputFormatPreset.ORIGINAL]: { label: 'Original' },
  [VideoOutputFormatPreset.MP4_H264]: { label: 'MP4 (H.264)' },
  [VideoOutputFormatPreset.MP4_HEVC]: { label: 'MP4 (HEVC)' },
  [VideoOutputFormatPreset.WEBM]: { label: 'WebM (VP9)' },
};

export interface NormalizedCropRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const CROP_MIN_FRACTION = 0.08;

export const DEFAULT_CROP_RECT: NormalizedCropRect = {
  left: 0.08,
  top: 0.08,
  right: 0.92,
  bottom: 0.92,
};

export const FULL_FRAME_CROP_RECT: NormalizedCropRect = {
  left: 0,
  top: 0,
  right: 1,
  bottom: 1,
};

export function isFullFrameCrop(rect: NormalizedCropRect, tolerance = 0.008): boolean {
  return (
    rect.left <= tolerance &&
    rect.top <= tolerance &&
    rect.right >= 1 - tolerance &&
    rect.bottom >= 1 - tolerance
  );
}

export interface PixelCropRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
}

export interface MediaInspectionResult {
  file: File;
  objectUrl: string;
  kind: CropMediaKind;
  displayName: string;
  mimeType: string;
  containerLabel: string;
  codecLabel: string;
  audioCodecLabel: string | null;
  rawWidth: number;
  rawHeight: number;
  rotationDegrees: number;
  displayWidth: number;
  displayHeight: number;
  durationMs: number;
  frameRate: number | null;
  bitrateBps: number | null;
  fileSizeBytes: number;
  colorInfoLabel: string | null;
}

export type CropFeasibilityResult =
  | {
      type: 'original_copy';
      summary: string;
    }
  | {
      type: 'requires_consent';
      title: string;
      reason: string;
      technicalDetails: string[];
    };

export enum VideoCropResolutionPreset {
  ORIGINAL = 'ORIGINAL',
  UHD_4K = 'UHD_4K',
  QHD_2K = 'QHD_2K',
  FHD_1080P = 'FHD_1080P',
  HD_720P = 'HD_720P',
}

export const VIDEO_CROP_RES_META: Record<
  VideoCropResolutionPreset,
  { label: string; maxLongEdge: number; shortEdgeHint: number }
> = {
  [VideoCropResolutionPreset.ORIGINAL]: {
    label: 'Original',
    maxLongEdge: Number.MAX_SAFE_INTEGER,
    shortEdgeHint: Number.MAX_SAFE_INTEGER,
  },
  [VideoCropResolutionPreset.UHD_4K]: { label: '4K', maxLongEdge: 3840, shortEdgeHint: 2160 },
  [VideoCropResolutionPreset.QHD_2K]: { label: '2K', maxLongEdge: 2560, shortEdgeHint: 1440 },
  [VideoCropResolutionPreset.FHD_1080P]: { label: '1080P', maxLongEdge: 1920, shortEdgeHint: 1080 },
  [VideoCropResolutionPreset.HD_720P]: { label: '720P', maxLongEdge: 1280, shortEdgeHint: 720 },
};

export enum VideoCropFpsPreset {
  ORIGINAL = 'ORIGINAL',
  FPS_60 = 'FPS_60',
  FPS_30 = 'FPS_30',
  FPS_24 = 'FPS_24',
}

export const VIDEO_CROP_FPS_META: Record<VideoCropFpsPreset, { fps: number; label: string }> = {
  [VideoCropFpsPreset.ORIGINAL]: { fps: 0, label: 'Original' },
  [VideoCropFpsPreset.FPS_60]: { fps: 60, label: '60 FPS' },
  [VideoCropFpsPreset.FPS_30]: { fps: 30, label: '30 FPS' },
  [VideoCropFpsPreset.FPS_24]: { fps: 24, label: '24 FPS' },
};

export interface DynamicBitrateRange {
  minMbps: number;
  maxMbps: number;
  suggestedMbps: number;
}

export interface VideoCropFallbackConfig {
  resolutionPreset: VideoCropResolutionPreset;
  fpsPreset: VideoCropFpsPreset;
  outputFormat: VideoOutputFormatPreset;
  bitrateMbps: number;
  hasUserAdjustedBitrate: boolean;
}

export interface PhotoCropFallbackConfig {
  preserveExifAndColor: boolean;
  qualityPercent: number;
  scalePercent: number;
  outputFormat: PhotoOutputFormatPreset;
}

export interface CropExportOutput {
  blob: Blob;
  objectUrl: string;
  displayName: string;
  mimeType: string;
  outputWidth: number;
  outputHeight: number;
  sizeBytes: number;
  usedOriginalStreamCopy: boolean;
}

export type CropExportState =
  | { status: 'idle' }
  | { status: 'inspecting'; message: string }
  | {
      status: 'awaiting_consent';
      inspection: MediaInspectionResult;
      feasibility: Extract<CropFeasibilityResult, { type: 'requires_consent' }>;
    }
  | {
      status: 'configuring_fallback';
      inspection: MediaInspectionResult;
      feasibility: Extract<CropFeasibilityResult, { type: 'requires_consent' }>;
    }
  | { status: 'exporting'; progressFraction: number; statusText: string }
  | { status: 'completed'; output: CropExportOutput }
  | { status: 'failed'; errorMessage: string };
