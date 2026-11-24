export enum RecordingMode {
  FULL_SCREEN = 'FULL_SCREEN',
  REGION = 'REGION',
}

export enum OrientationMode {
  PORTRAIT = 'PORTRAIT',
  LANDSCAPE = 'LANDSCAPE',
}

export enum AudioSourceOption {
  INTERNAL = 'INTERNAL',
  MICROPHONE = 'MICROPHONE',
}

export enum VideoBitrateOption {
  MBPS_100 = 'MBPS_100',
  MBPS_150 = 'MBPS_150',
  MBPS_200 = 'MBPS_200',
  MBPS_250 = 'MBPS_250',
  MBPS_300 = 'MBPS_300',
  MBPS_350 = 'MBPS_350',
}

export const VIDEO_BITRATE_META: Record<
  VideoBitrateOption,
  { targetBitsPerSecond: number; mbps: number; label: string; id: string; testTag: string }
> = {
  [VideoBitrateOption.MBPS_100]: {
    targetBitsPerSecond: 100_000_000,
    mbps: 100,
    label: '100 Mbps',
    id: 'chip_bitrate_100',
    testTag: 'bitrate_mbps_100',
  },
  [VideoBitrateOption.MBPS_150]: {
    targetBitsPerSecond: 150_000_000,
    mbps: 150,
    label: '150 Mbps',
    id: 'chip_bitrate_150',
    testTag: 'bitrate_mbps_150',
  },
  [VideoBitrateOption.MBPS_200]: {
    targetBitsPerSecond: 200_000_000,
    mbps: 200,
    label: '200 Mbps',
    id: 'chip_bitrate_200',
    testTag: 'bitrate_mbps_200',
  },
  [VideoBitrateOption.MBPS_250]: {
    targetBitsPerSecond: 250_000_000,
    mbps: 250,
    label: '250 Mbps',
    id: 'chip_bitrate_250',
    testTag: 'bitrate_mbps_250',
  },
  [VideoBitrateOption.MBPS_300]: {
    targetBitsPerSecond: 300_000_000,
    mbps: 300,
    label: '300 Mbps',
    id: 'chip_bitrate_300',
    testTag: 'bitrate_mbps_300',
  },
  [VideoBitrateOption.MBPS_350]: {
    targetBitsPerSecond: 350_000_000,
    mbps: 350,
    label: '350 Mbps',
    id: 'chip_bitrate_350',
    testTag: 'bitrate_mbps_350',
  },
};

export enum RegionAnimationOption {
  SHOW = 'SHOW',
  HIDE = 'HIDE',
}

export enum BitrateModeOption {
  VBR = 'VBR',
  CQ = 'CQ',
}

export enum ColorDepthOption {
  BIT_8 = 'BIT_8',
  BIT_10 = 'BIT_10',
}

export enum VideoFpsOption {
  FPS_30 = 'FPS_30',
  FPS_60 = 'FPS_60',
}

export const VIDEO_FPS_VALUES: Record<VideoFpsOption, number> = {
  [VideoFpsOption.FPS_30]: 30,
  [VideoFpsOption.FPS_60]: 60,
};

export enum GopIntervalOption {
  SEC_1 = 'SEC_1',
  SEC_0_5 = 'SEC_0_5',
}

export const GOP_SECONDS_VALUES: Record<GopIntervalOption, number> = {
  [GopIntervalOption.SEC_1]: 1.0,
  [GopIntervalOption.SEC_0_5]: 0.5,
};

export enum ColorRangeOption {
  LIMITED = 'LIMITED',
  FULL = 'FULL',
}

export enum AudioFormatOption {
  MONO_AAC = 'MONO_AAC',
  MONO_MP3 = 'MONO_MP3',
}

export interface NormalizedRegion {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const DEFAULT_NORMALIZED_REGION: NormalizedRegion = {
  left: 0.1,
  top: 0.2,
  right: 0.9,
  bottom: 0.7,
};

export interface PixelRegion {
  left: number;
  top: number;
  right: number;
  bottom: number;
  screenWidth: number;
  screenHeight: number;
  width: number;
  height: number;
}

export interface RecordingSettings {
  recordingMode: RecordingMode;
  orientationMode: OrientationMode;
  audioSource: AudioSourceOption;
  videoBitrate: VideoBitrateOption;
  regionAnimation: RegionAnimationOption;
  selectedRegion: NormalizedRegion;
  bitrateMode: BitrateModeOption;
  colorDepth: ColorDepthOption;
  videoFps: VideoFpsOption;
  gopInterval: GopIntervalOption;
  colorRange: ColorRangeOption;
  audioFormat: AudioFormatOption;
  darkThemeOverride: boolean | null;
  customVideoBitrateMbps: number | null;
  customVideoFps: number | null;
  customGopSeconds: number | null;
  customAudioSampleRateHz: number | null;
  customAudioBitrateBps: number | null;
}

export const DEFAULT_RECORDING_SETTINGS: RecordingSettings = {
  recordingMode: RecordingMode.FULL_SCREEN,
  orientationMode: OrientationMode.LANDSCAPE,
  audioSource: AudioSourceOption.INTERNAL,
  videoBitrate: VideoBitrateOption.MBPS_150,
  regionAnimation: RegionAnimationOption.SHOW,
  selectedRegion: { ...DEFAULT_NORMALIZED_REGION },
  bitrateMode: BitrateModeOption.VBR,
  colorDepth: ColorDepthOption.BIT_8,
  videoFps: VideoFpsOption.FPS_30,
  gopInterval: GopIntervalOption.SEC_1,
  colorRange: ColorRangeOption.LIMITED,
  audioFormat: AudioFormatOption.MONO_AAC,
  darkThemeOverride: true,
  customVideoBitrateMbps: null,
  customVideoFps: null,
  customGopSeconds: null,
  customAudioSampleRateHz: null,
  customAudioBitrateBps: null,
};

export const InternalRecordingConfig = {
  AUDIO_SAMPLE_RATE_HZ: 48_000,
  AUDIO_BITRATE_BPS: 128_000,
  CHROMA_SUBSAMPLING_LABEL: '4:2:0',
  OUTPUT_CONTAINER_LABEL: 'Standard MP4',
  COLOR_STANDARD_LABEL: 'BT.709 (SDR)',
  RENDERING_MODE_LABEL: 'Asynchronous Rendering (Direct Surface + Async Callback)',
};

export function getEffectiveVideoBitrateMbps(s: RecordingSettings): number {
  return Math.max(1, s.customVideoBitrateMbps ?? VIDEO_BITRATE_META[s.videoBitrate].mbps);
}

export function getEffectiveVideoFps(s: RecordingSettings): number {
  return Math.max(1, s.customVideoFps ?? VIDEO_FPS_VALUES[s.videoFps]);
}

export function getEffectiveGopSeconds(s: RecordingSettings): number {
  return Math.max(0.05, s.customGopSeconds ?? GOP_SECONDS_VALUES[s.gopInterval]);
}

export function getEffectiveAudioSampleRateHz(s: RecordingSettings): number {
  return Math.max(8_000, s.customAudioSampleRateHz ?? InternalRecordingConfig.AUDIO_SAMPLE_RATE_HZ);
}

export function getEffectiveAudioBitrateBps(s: RecordingSettings): number {
  return Math.max(16_000, s.customAudioBitrateBps ?? InternalRecordingConfig.AUDIO_BITRATE_BPS);
}

export enum RecordingPhase {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
  FINALIZING = 'FINALIZING',
}

export interface RecordingSessionState {
  phase: RecordingPhase;
  elapsedMillis: number;
  activeMode: RecordingMode;
  activeAudioLabel: string;
  activeEncoderName: string;
  activeBitrateMbps: number;
  activeResolutionLabel: string;
  activeRegion: PixelRegion | null;
  showRegionBorder: boolean;
  lastSavedId: number | null;
  lastSavedName: string | null;
  warningMessage: string | null;
  errorMessage: string | null;
}

export interface RecordedVideoItem {
  id: number;
  displayName: string;
  width: number;
  height: number;
  durationMs: number;
  sizeBytes: number;
  dateAddedSec: number;
  mimeType: string;
}

export type AppRoute = 'main' | 'settings' | 'recordings' | 'crop_tool';
