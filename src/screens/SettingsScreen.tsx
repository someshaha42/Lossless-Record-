import React from 'react';
import {
  ArrowLeft,
  Contrast,
  Cpu,
  Gauge,
  HardDrive,
  Layers,
  Lock,
  Music,
  Palette,
  Sliders,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';
import {
  AudioFormatOption,
  BitrateModeOption,
  ColorDepthOption,
  ColorRangeOption,
  GopIntervalOption,
  RecordingSettings,
  VideoFpsOption,
} from '../types/recorder';
import {
  AudioFormatCustomBoxes,
  CustomNumericInputBox,
  DefinedOptionTile,
  DefinedSectionCard,
  formatGopDisplay,
  parseCustomGopInput,
} from '../components/DefinedCards';

interface SettingsScreenProps {
  settings: RecordingSettings;
  isIdle: boolean;
  fpsDraft: string | null;
  gopDraft: string | null;
  audioKhzDraft: string | null;
  audioKbpsDraft: string | null;
  onFpsDraftChange: (v: string | null) => void;
  onGopDraftChange: (v: string | null) => void;
  onAudioKhzDraftChange: (v: string | null) => void;
  onAudioKbpsDraftChange: (v: string | null) => void;
  onBack: () => void;
  onSelectBitrateMode: (mode: BitrateModeOption) => void;
  onSelectColorDepth: (depth: ColorDepthOption) => void;
  onSelectVideoFps: (fps: VideoFpsOption) => void;
  onSelectGopInterval: (gop: GopIntervalOption) => void;
  onSelectColorRange: (range: ColorRangeOption) => void;
  onSelectAudioFormat: (fmt: AudioFormatOption) => void;
  onSaveCustomFps: (fps: number) => void;
  onResetCustomFps: () => void;
  onSaveCustomGopSeconds: (sec: number) => void;
  onResetCustomGop: () => void;
  onSaveCustomAudio: (sampleRateHz: number | null, bitrateBps: number | null) => void;
  onResetCustomAudio: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  isIdle,
  fpsDraft,
  gopDraft,
  audioKhzDraft,
  audioKbpsDraft,
  onFpsDraftChange,
  onGopDraftChange,
  onAudioKhzDraftChange,
  onAudioKbpsDraftChange,
  onBack,
  onSelectBitrateMode,
  onSelectColorDepth,
  onSelectVideoFps,
  onSelectGopInterval,
  onSelectColorRange,
  onSelectAudioFormat,
  onSaveCustomFps,
  onResetCustomFps,
  onSaveCustomGopSeconds,
  onResetCustomGop,
  onSaveCustomAudio,
  onResetCustomAudio,
}) => {
  return (
    <div className="min-h-screen bg-[var(--fc-bg)] text-[var(--fc-on-surface)]">
      <header className="sticky top-0 z-30 border-b border-[var(--fc-outline-variant)] bg-[var(--fc-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            data-testid="settings_back_button"
            aria-label="Navigate back"
            onClick={onBack}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] transition-colors hover:bg-[var(--fc-surface-variant)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-[18px] leading-tight font-bold text-[var(--fc-on-surface)]">
              Encoding Settings
            </h1>
            <p className="text-[12px] text-[var(--fc-on-surface-variant)]">
              H.265/HEVC Hardware Surface Pipeline
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-4 py-5 sm:px-6">
        {!isIdle && (
          <div
            data-testid="settings_locked_banner"
            className="mb-4 flex items-center gap-3 rounded-[14px] bg-[var(--fc-paused-container)] px-4 py-3 text-[13px] font-medium text-[var(--fc-on-surface)]"
          >
            <Lock className="h-4.5 w-4.5 shrink-0 text-[var(--fc-paused-accent)]" />
            <span>Stop active recording to change pipeline settings.</span>
          </div>
        )}

        <div
          className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
            !isIdle ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <div className="flex flex-col gap-4">
            <DefinedSectionCard
              title="Bitrate Mode"
              subtitle="Controls bitrate allocation behavior"
              icon={<Sliders className="h-4.5 w-4.5" />}
            >
              <div className="flex gap-2.5">
                <DefinedOptionTile
                  title="VBR"
                  subtitle="Balanced adaptive quality"
                  icon={<Gauge className="h-4 w-4" />}
                  selected={settings.bitrateMode === BitrateModeOption.VBR}
                  enabled={isIdle}
                  onClick={() => onSelectBitrateMode(BitrateModeOption.VBR)}
                  testTag="bitrate_mode_vbr"
                />
                <DefinedOptionTile
                  title="CQ"
                  subtitle="Constant target quality"
                  icon={<Sparkles className="h-4 w-4" />}
                  selected={settings.bitrateMode === BitrateModeOption.CQ}
                  enabled={isIdle}
                  onClick={() => onSelectBitrateMode(BitrateModeOption.CQ)}
                  testTag="bitrate_mode_cq"
                />
              </div>
            </DefinedSectionCard>

            <DefinedSectionCard
              title="Frame Rate (FPS)"
              subtitle="Sets capture smoothness per second"
              icon={<Gauge className="h-4.5 w-4.5" />}
            >
              <div className="flex gap-2.5">
                <DefinedOptionTile
                  title="30 FPS"
                  subtitle="Saves battery & heat"
                  icon={<Timer className="h-4 w-4" />}
                  selected={
                    settings.customVideoFps == null && settings.videoFps === VideoFpsOption.FPS_30
                  }
                  enabled={isIdle}
                  onClick={() => onSelectVideoFps(VideoFpsOption.FPS_30)}
                  testTag="fps_30"
                />
                <DefinedOptionTile
                  title="60 FPS"
                  subtitle="Fluid motion capture"
                  icon={<Zap className="h-4 w-4" />}
                  selected={
                    settings.customVideoFps == null && settings.videoFps === VideoFpsOption.FPS_60
                  }
                  enabled={isIdle}
                  onClick={() => onSelectVideoFps(VideoFpsOption.FPS_60)}
                  testTag="fps_60"
                />
              </div>
              <CustomNumericInputBox
                label="Custom FPS"
                placeholder="Enter target FPS"
                suffixText="FPS"
                savedValueText={
                  settings.customVideoFps != null ? String(settings.customVideoFps) : ''
                }
                activeBadgeText={
                  settings.customVideoFps != null
                    ? `Custom FPS: ${settings.customVideoFps} FPS`
                    : null
                }
                allowDecimal={false}
                enabled={isIdle}
                testTagPrefix="custom_fps"
                draftText={fpsDraft}
                onDraftChange={onFpsDraftChange}
                onParseAndSave={(raw) => {
                  const fps = Number.parseInt(raw.trim(), 10);
                  if (Number.isFinite(fps) && fps > 0) {
                    onSaveCustomFps(fps);
                    return true;
                  }
                  return false;
                }}
                onReset={onResetCustomFps}
              />
            </DefinedSectionCard>

            <DefinedSectionCard
              title="Output Container"
              subtitle="Active MP4 / WebM muxing container format"
              icon={<HardDrive className="h-4.5 w-4.5" />}
            >
              <DefinedOptionTile
                title="Standard MP4"
                subtitle="Browser MediaRecorder MP4 / WebM Muxer"
                icon={<HardDrive className="h-4 w-4" />}
                selected={true}
                enabled={true}
                onClick={() => {}}
                testTag="muxer_standard_mp4_active"
              />
            </DefinedSectionCard>

            <DefinedSectionCard
              title="Keyframe Interval (GOP)"
              subtitle="Controls seeking & edit precision"
              icon={<Timer className="h-4.5 w-4.5" />}
            >
              <div className="flex gap-2.5">
                <DefinedOptionTile
                  title="1 Second"
                  subtitle="Smaller file size"
                  icon={<Timer className="h-4 w-4" />}
                  selected={
                    settings.customGopSeconds == null &&
                    settings.gopInterval === GopIntervalOption.SEC_1
                  }
                  enabled={isIdle}
                  onClick={() => onSelectGopInterval(GopIntervalOption.SEC_1)}
                  testTag="gop_1s"
                />
                <DefinedOptionTile
                  title="0.5 Second"
                  subtitle="Faster video scrubbing"
                  icon={<Zap className="h-4 w-4" />}
                  selected={
                    settings.customGopSeconds == null &&
                    settings.gopInterval === GopIntervalOption.SEC_0_5
                  }
                  enabled={isIdle}
                  onClick={() => onSelectGopInterval(GopIntervalOption.SEC_0_5)}
                  testTag="gop_0_5s"
                />
              </div>
              <CustomNumericInputBox
                label="Custom Keyframe Interval (sec)"
                placeholder="≤ 1s supports decimal (e.g. 0.5), > 1s seconds"
                suffixText="s"
                savedValueText={formatGopDisplay(settings.customGopSeconds)}
                activeBadgeText={
                  settings.customGopSeconds != null
                    ? `Custom GOP: ${formatGopDisplay(settings.customGopSeconds)} s`
                    : null
                }
                supportingHint="≤ 1s supports decimal (e.g. 0.5), > 1s seconds"
                allowDecimal={true}
                enabled={isIdle}
                testTagPrefix="custom_gop"
                draftText={gopDraft}
                onDraftChange={onGopDraftChange}
                onParseAndSave={(raw) => {
                  const sec = parseCustomGopInput(raw);
                  if (sec != null) {
                    onSaveCustomGopSeconds(sec);
                    return true;
                  }
                  return false;
                }}
                onReset={onResetCustomGop}
              />
            </DefinedSectionCard>

            <DefinedSectionCard
              title="Audio Format"
              subtitle="Selects mono 48 kHz audio encoder"
              icon={<Music className="h-4.5 w-4.5" />}
            >
              <div className="flex gap-2.5">
                <DefinedOptionTile
                  title="Mono AAC"
                  subtitle="48 kHz · 128 kbps"
                  icon={<Music className="h-4 w-4" />}
                  selected={settings.audioFormat === AudioFormatOption.MONO_AAC}
                  enabled={isIdle}
                  onClick={() => onSelectAudioFormat(AudioFormatOption.MONO_AAC)}
                  testTag="audio_fmt_aac"
                />
                <DefinedOptionTile
                  title="Mono MP3"
                  subtitle="48 kHz · 128 kbps"
                  icon={<Music className="h-4 w-4" />}
                  selected={settings.audioFormat === AudioFormatOption.MONO_MP3}
                  enabled={isIdle}
                  onClick={() => onSelectAudioFormat(AudioFormatOption.MONO_MP3)}
                  testTag="audio_fmt_mp3"
                />
              </div>
              <AudioFormatCustomBoxes
                savedSampleRateHz={settings.customAudioSampleRateHz}
                savedBitrateBps={settings.customAudioBitrateBps}
                enabled={isIdle}
                khzDraft={audioKhzDraft}
                kbpsDraft={audioKbpsDraft}
                onKhzDraftChange={onAudioKhzDraftChange}
                onKbpsDraftChange={onAudioKbpsDraftChange}
                onSaveCustomAudio={onSaveCustomAudio}
                onResetCustomAudio={onResetCustomAudio}
              />
            </DefinedSectionCard>
          </div>

          <div className="flex flex-col gap-4">
            <DefinedSectionCard
              title="Color Depth"
              subtitle="Selects hardware HEVC bit precision"
              icon={<Layers className="h-4.5 w-4.5" />}
            >
              <div className="flex gap-2.5">
                <DefinedOptionTile
                  title="8-Bit"
                  subtitle="Standard smooth playback"
                  icon={<Palette className="h-4 w-4" />}
                  selected={settings.colorDepth === ColorDepthOption.BIT_8}
                  enabled={isIdle}
                  onClick={() => onSelectColorDepth(ColorDepthOption.BIT_8)}
                  testTag="color_depth_8bit"
                />
                <DefinedOptionTile
                  title="10-Bit"
                  subtitle="Richer gradient depth"
                  icon={<Palette className="h-4 w-4" />}
                  selected={settings.colorDepth === ColorDepthOption.BIT_10}
                  enabled={isIdle}
                  onClick={() => onSelectColorDepth(ColorDepthOption.BIT_10)}
                  testTag="color_depth_10bit"
                />
              </div>
            </DefinedSectionCard>

            <DefinedSectionCard
              title="Color Standard"
              subtitle="Fixed hardware display color gamut"
              icon={<Palette className="h-4.5 w-4.5" />}
            >
              <DefinedOptionTile
                title="BT.709 (SDR)"
                subtitle="Fixed accurate SDR color"
                icon={<Palette className="h-4 w-4" />}
                selected={true}
                enabled={true}
                onClick={() => {}}
                testTag="color_std_bt709_active"
              />
            </DefinedSectionCard>

            <DefinedSectionCard
              title="Rendering Pipeline"
              subtitle="Fixed zero-copy surface callback pipeline"
              icon={<Cpu className="h-4.5 w-4.5" />}
            >
              <DefinedOptionTile
                title="Asynchronous Rendering"
                subtitle="Direct Surface + Async Callback"
                icon={<Zap className="h-4 w-4" />}
                selected={true}
                enabled={true}
                onClick={() => {}}
                testTag="rendering_async_active"
              />
            </DefinedSectionCard>

            <DefinedSectionCard
              title="Color Range"
              subtitle="Sets luminance & contrast span"
              icon={<Contrast className="h-4.5 w-4.5" />}
            >
              <div className="flex gap-2.5">
                <DefinedOptionTile
                  title="Limited (16–235)"
                  subtitle="Standard safe compatibility"
                  icon={<Contrast className="h-4 w-4" />}
                  selected={settings.colorRange === ColorRangeOption.LIMITED}
                  enabled={isIdle}
                  onClick={() => onSelectColorRange(ColorRangeOption.LIMITED)}
                  testTag="color_range_limited"
                />
                <DefinedOptionTile
                  title="Full (0–255)"
                  subtitle="Maximum tonal contrast"
                  icon={<Contrast className="h-4 w-4" />}
                  selected={settings.colorRange === ColorRangeOption.FULL}
                  enabled={isIdle}
                  onClick={() => onSelectColorRange(ColorRangeOption.FULL)}
                  testTag="color_range_full"
                />
              </div>
            </DefinedSectionCard>

            <DefinedSectionCard
              title="Chroma Subsampling"
              subtitle="Active hardware surface color sampling"
              icon={<Palette className="h-4.5 w-4.5" />}
            >
              <DefinedOptionTile
                title="4:2:0"
                subtitle="Hardware native YUV420/P010"
                icon={<Palette className="h-4 w-4" />}
                selected={true}
                enabled={true}
                onClick={() => {}}
                testTag="chroma_420_active"
              />
            </DefinedSectionCard>
          </div>
        </div>
      </main>
    </div>
  );
};
