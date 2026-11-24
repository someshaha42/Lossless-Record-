import React from 'react';
import {
  Crop,
  Film,
  Fullscreen,
  Gauge,
  Library,
  Maximize2,
  Mic,
  Moon,
  Pause,
  Play,
  Radio,
  RectangleHorizontal,
  RectangleVertical,
  Settings,
  SlidersHorizontal,
  Square,
  Sun,
  Volume2,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import {
  AudioSourceOption,
  OrientationMode,
  PixelRegion,
  RecordingMode,
  RecordingPhase,
  RecordingSessionState,
  RecordingSettings,
  RegionAnimationOption,
  VIDEO_BITRATE_META,
  VideoBitrateOption,
} from '../types/recorder';
import {
  CustomNumericInputBox,
  DefinedOptionTile,
  DefinedSectionCard,
} from '../components/DefinedCards';
import { RegionBorderCanvas } from '../components/RegionBorderCanvas';

interface MainScreenProps {
  settings: RecordingSettings;
  session: RecordingSessionState;
  canvasWidthPx: number;
  canvasHeightPx: number;
  selectedPixelRegion: PixelRegion;
  recordingsCount: number;
  isDarkTheme: boolean;
  bitrateDraft: string | null;
  onBitrateDraftChange: (draft: string | null) => void;
  onToggleTheme: () => void;
  onOpenCropTool: () => void;
  onOpenRecordings: () => void;
  onOpenSettings: () => void;
  onStartRecord: () => void;
  onPauseResume: () => void;
  onStop: () => void;
  onDismissMessages: () => void;
  onSelectMode: (mode: RecordingMode) => void;
  onSelectOrientation: (mode: OrientationMode) => void;
  onSelectAudioSource: (source: AudioSourceOption) => void;
  onSelectBitrate: (bitrate: VideoBitrateOption) => void;
  onSaveCustomBitrateMbps: (mbps: number) => void;
  onResetCustomBitrate: () => void;
  onSelectRegionAnimation: (anim: RegionAnimationOption) => void;
  onEditRegion: () => void;
}

function formatElapsedTimer(elapsedMs: number): string {
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

export const MainScreen: React.FC<MainScreenProps> = ({
  settings,
  session,
  canvasWidthPx,
  canvasHeightPx,
  selectedPixelRegion,
  recordingsCount,
  isDarkTheme,
  bitrateDraft,
  onBitrateDraftChange,
  onToggleTheme,
  onOpenCropTool,
  onOpenRecordings,
  onOpenSettings,
  onStartRecord,
  onPauseResume,
  onStop,
  onDismissMessages,
  onSelectMode,
  onSelectOrientation,
  onSelectAudioSource,
  onSelectBitrate,
  onSaveCustomBitrateMbps,
  onResetCustomBitrate,
  onSelectRegionAnimation,
  onEditRegion,
}) => {
  const isIdle = session.phase === RecordingPhase.IDLE;
  const isRecordingActive = session.phase === RecordingPhase.RECORDING;
  const bannerText = session.errorMessage ?? session.warningMessage;
  const isError = session.errorMessage != null;

  const statusMeta = (() => {
    switch (session.phase) {
      case RecordingPhase.IDLE:
        return {
          label: 'Ready to record',
          accent: 'var(--fc-ready-accent)',
          container: 'var(--fc-ready-container)',
        };
      case RecordingPhase.RECORDING:
        return {
          label: 'Recording',
          accent: 'var(--fc-record-accent)',
          container: 'var(--fc-record-container)',
        };
      case RecordingPhase.PAUSED:
        return {
          label: 'Paused',
          accent: 'var(--fc-paused-accent)',
          container: 'var(--fc-paused-container)',
        };
      case RecordingPhase.FINALIZING:
        return {
          label: 'Finalizing MP4…',
          accent: 'var(--fc-secondary)',
          container: 'var(--fc-secondary-container)',
        };
    }
  })();

  const orientationLabel =
    settings.orientationMode === OrientationMode.PORTRAIT ? 'Portrait' : 'Landscape';
  const modeSummary =
    settings.recordingMode === RecordingMode.FULL_SCREEN
      ? `Full Screen (${canvasWidthPx}×${canvasHeightPx})`
      : `Region / Area (${selectedPixelRegion.width}×${selectedPixelRegion.height})`;
  const audioSummary =
    settings.audioSource === AudioSourceOption.INTERNAL ? 'Internal Audio' : 'Microphone';

  const subtitleText = isIdle
    ? `${modeSummary} · ${orientationLabel} · ${audioSummary}`
    : [session.activeResolutionLabel, orientationLabel, session.activeAudioLabel]
        .filter(Boolean)
        .join(' · ');

  const previewAspect = Math.min(2.5, Math.max(0.35, canvasWidthPx / Math.max(1, canvasHeightPx)));

  return (
    <div className="min-h-screen bg-[var(--fc-bg)] text-[var(--fc-on-surface)]">
      <header className="sticky top-0 z-30 border-b border-[var(--fc-outline-variant)] bg-[var(--fc-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-[var(--fc-record-container)]">
              <span
                className="h-3 w-3 rounded-full bg-[var(--fc-record-accent)]"
                aria-hidden="true"
              />
            </div>
            <span className="font-display text-[22px] font-bold tracking-tight text-[var(--fc-on-surface)] whitespace-nowrap">
              FrameCut
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="theme_toggle_button"
              aria-label={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={onToggleTheme}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] transition-colors hover:bg-[var(--fc-surface-variant)] focus-visible:outline-2 focus-visible:outline-[var(--fc-primary)]"
            >
              {isDarkTheme ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              data-testid="crop_nav_button"
              aria-label="Open photo and video crop tool"
              onClick={onOpenCropTool}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] transition-colors hover:bg-[var(--fc-surface-variant)] focus-visible:outline-2 focus-visible:outline-[var(--fc-primary)]"
            >
              <Crop className="h-5 w-5" />
            </button>
            <button
              type="button"
              data-testid="recordings_nav_button"
              aria-label="Open recorded videos"
              onClick={onOpenRecordings}
              className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] transition-colors hover:bg-[var(--fc-surface-variant)] focus-visible:outline-2 focus-visible:outline-[var(--fc-primary)]"
            >
              <Library className="h-5 w-5" />
              {recordingsCount > 0 && (
                <span className="font-mono-tnum absolute top-1.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--fc-primary)] px-1 text-[10px] font-bold text-white">
                  {recordingsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              data-testid="settings_nav_button"
              aria-label="Open encoding settings"
              onClick={onOpenSettings}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] transition-colors hover:bg-[var(--fc-surface-variant)] focus-visible:outline-2 focus-visible:outline-[var(--fc-primary)]"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(310px,385px)_1fr] lg:items-start">
          <div className="flex flex-col gap-4">
            {bannerText && (
              <div
                role="alert"
                className={`flex items-center justify-between gap-3 rounded-[14px] px-4 py-3 text-[13px] ${
                  isError
                    ? 'bg-[var(--fc-error-container)] text-[var(--fc-on-error-container)]'
                    : 'bg-[var(--fc-paused-container)] text-[var(--fc-on-surface)]'
                }`}
              >
                <span className="flex-1 leading-snug">{bannerText}</span>
                <button
                  type="button"
                  onClick={onDismissMessages}
                  aria-label="Close message"
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[8px] px-2 text-[12px] font-semibold hover:bg-black/10"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Close</span>
                </button>
              </div>
            )}

            <section className="overflow-hidden rounded-[24px] border border-[var(--fc-outline-variant)] bg-[var(--fc-surface)]">
              <div
                className="flex flex-col items-center gap-4 p-5 text-center"
                style={{
                  background: `linear-gradient(180deg, color-mix(in srgb, ${statusMeta.container} 35%, transparent) 0%, transparent 65%)`,
                }}
              >
                <div
                  data-testid="recording_status_badge"
                  style={{
                    backgroundColor: statusMeta.container,
                    color: statusMeta.accent,
                  }}
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                >
                  <span
                    style={{ backgroundColor: statusMeta.accent }}
                    className={`h-2 w-2 rounded-full ${
                      isRecordingActive ? 'animate-pulse' : ''
                    }`}
                  />
                  <span>{statusMeta.label}</span>
                </div>

                <div
                  data-testid="recording_timer"
                  className="font-mono-tnum text-[40px] leading-[46px] font-semibold tracking-[-0.5px] text-[var(--fc-on-surface)]"
                >
                  {formatElapsedTimer(session.elapsedMillis)}
                </div>

                <p className="font-mono-tnum text-[12px] leading-[16px] text-[var(--fc-on-surface-variant)]">
                  {subtitleText}
                </p>

                {session.phase === RecordingPhase.IDLE && (
                  <button
                    type="button"
                    data-testid="record_button"
                    onClick={onStartRecord}
                    className="flex h-[56px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[16px] bg-[var(--fc-record-accent)] px-6 font-display text-[16px] font-semibold text-white transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fc-record-accent)]"
                  >
                    <Radio className="h-5 w-5" />
                    <span>Record</span>
                  </button>
                )}

                {(session.phase === RecordingPhase.RECORDING ||
                  session.phase === RecordingPhase.PAUSED) && (
                  <div className="flex w-full gap-3">
                    <button
                      type="button"
                      data-testid="pause_resume_button"
                      onClick={onPauseResume}
                      className="flex h-[54px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[16px] bg-[var(--fc-secondary-container)] px-4 text-[14px] font-semibold text-[var(--fc-on-secondary-container)] transition-opacity hover:opacity-90"
                    >
                      {session.phase === RecordingPhase.PAUSED ? (
                        <>
                          <Play className="h-4 w-4" />
                          <span>Resume</span>
                        </>
                      ) : (
                        <>
                          <Pause className="h-4 w-4" />
                          <span>Pause</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      data-testid="stop_button"
                      onClick={onStop}
                      className="flex h-[54px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[16px] bg-[var(--fc-record-accent)] px-4 text-[14px] font-semibold text-white transition-opacity hover:opacity-95"
                    >
                      <Square className="h-4 w-4 fill-current" />
                      <span>Stop</span>
                    </button>
                  </div>
                )}

                {session.phase === RecordingPhase.FINALIZING && (
                  <button
                    type="button"
                    disabled
                    data-testid="finalizing_button"
                    className="flex h-[54px] w-full cursor-wait items-center justify-center rounded-[16px] bg-[var(--fc-surface-variant)] px-6 text-[14px] font-semibold text-[var(--fc-on-surface-variant)]"
                  >
                    Finalizing MP4…
                  </button>
                )}
              </div>
            </section>

            {isIdle && session.lastSavedName && (
              <button
                type="button"
                data-testid="last_saved_banner"
                onClick={onOpenRecordings}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] bg-[var(--fc-ready-container)] px-4 py-3 text-left transition-opacity hover:opacity-95"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[var(--fc-ready-accent)]">
                    Saved to Recordings
                  </div>
                  <div className="truncate text-[13px] text-[var(--fc-on-surface)]">
                    {session.lastSavedName}
                  </div>
                </div>
                <span className="shrink-0 text-[13px] font-semibold text-[var(--fc-ready-accent)]">
                  Play
                </span>
              </button>
            )}

            <button
              type="button"
              data-testid="open_recordings_button"
              onClick={onOpenRecordings}
              className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-[var(--fc-outline)] bg-transparent px-4 text-[14px] font-semibold text-[var(--fc-on-surface)] transition-colors hover:bg-[var(--fc-surface-variant)]"
            >
              <Film className="h-4.5 w-4.5 text-[var(--fc-primary)]" />
              <span>
                {recordingsCount === 0
                  ? 'Recorded Videos'
                  : `Recorded Videos (${recordingsCount})`}
              </span>
            </button>
          </div>

          <div
            className={`grid grid-cols-1 gap-4 xl:grid-cols-2 ${
              !isIdle ? 'pointer-events-none opacity-65' : ''
            }`}
          >
            <div className="flex flex-col gap-4">
              <DefinedSectionCard
                title="Recording Mode"
                icon={<Fullscreen className="h-4.5 w-4.5" />}
              >
                <div className="flex gap-2.5">
                  <DefinedOptionTile
                    title="Full Screen"
                    subtitle="Entire display capture"
                    icon={<Fullscreen className="h-4 w-4" />}
                    selected={settings.recordingMode === RecordingMode.FULL_SCREEN}
                    enabled={isIdle}
                    onClick={() => onSelectMode(RecordingMode.FULL_SCREEN)}
                    testTag="mode_fullscreen"
                  />
                  <DefinedOptionTile
                    title="Region / Area"
                    subtitle="Hardware-sized region capture"
                    icon={<Maximize2 className="h-4 w-4" />}
                    selected={settings.recordingMode === RecordingMode.REGION}
                    enabled={isIdle}
                    onClick={() => onSelectMode(RecordingMode.REGION)}
                    testTag="mode_region"
                  />
                </div>
              </DefinedSectionCard>

              {settings.recordingMode === RecordingMode.REGION && (
                <DefinedSectionCard
                  title="Selected Region"
                  icon={<Maximize2 className="h-4.5 w-4.5" />}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      style={{ aspectRatio: `${previewAspect}` }}
                      className="w-[74px] shrink-0 overflow-hidden rounded-[10px] bg-[var(--fc-surface-variant)]"
                    >
                      <RegionBorderCanvas
                        leftFraction={settings.selectedRegion.left}
                        topFraction={settings.selectedRegion.top}
                        rightFraction={settings.selectedRegion.right}
                        bottomFraction={settings.selectedRegion.bottom}
                        animate={
                          settings.regionAnimation === RegionAnimationOption.SHOW &&
                          isRecordingActive
                        }
                        showBorder={settings.regionAnimation === RegionAnimationOption.SHOW}
                        strokeWidthPx={2}
                        scrimColor="rgba(0,0,0,0.45)"
                        neutralGuideColor="var(--fc-outline)"
                        accentColor="var(--fc-record-accent)"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="font-mono-tnum text-[16px] font-semibold text-[var(--fc-on-surface)]">
                        {selectedPixelRegion.width} × {selectedPixelRegion.height} px
                      </div>
                      <div className="font-mono-tnum text-[12px] text-[var(--fc-on-surface-variant)]">
                        Position ({selectedPixelRegion.left}, {selectedPixelRegion.top})
                      </div>
                      <button
                        type="button"
                        disabled={!isIdle}
                        data-testid="adjust_region_button"
                        onClick={onEditRegion}
                        className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[12px] bg-[var(--fc-secondary-container)] px-3 text-[13px] font-semibold text-[var(--fc-on-secondary-container)] transition-opacity hover:opacity-90"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>Adjust Region</span>
                      </button>
                    </div>
                  </div>
                  <div className="rounded-[12px] bg-[var(--fc-surface-variant)]/55 px-3 py-2 text-[12px] text-[var(--fc-on-surface-variant)]">
                    Real-time canvas cropper slices the shared display cleanly to your selected region.
                  </div>
                </DefinedSectionCard>
              )}

              <DefinedSectionCard
                title="Orientation"
                icon={<RectangleVertical className="h-4.5 w-4.5" />}
              >
                <div className="flex gap-2.5">
                  <DefinedOptionTile
                    title="Portrait"
                    subtitle="Vertical for Full Screen & Region"
                    icon={<RectangleVertical className="h-4 w-4" />}
                    selected={settings.orientationMode === OrientationMode.PORTRAIT}
                    enabled={isIdle}
                    onClick={() => onSelectOrientation(OrientationMode.PORTRAIT)}
                    testTag="orientation_portrait"
                  />
                  <DefinedOptionTile
                    title="Landscape"
                    subtitle="Horizontal for Full Screen & Region"
                    icon={<RectangleHorizontal className="h-4 w-4" />}
                    selected={settings.orientationMode === OrientationMode.LANDSCAPE}
                    enabled={isIdle}
                    onClick={() => onSelectOrientation(OrientationMode.LANDSCAPE)}
                    testTag="orientation_landscape"
                  />
                </div>
              </DefinedSectionCard>
            </div>

            <div className="flex flex-col gap-4">
              <DefinedSectionCard
                title="Audio Source"
                icon={<Volume2 className="h-4.5 w-4.5" />}
              >
                <div className="flex gap-2.5">
                  <DefinedOptionTile
                    title="Internal Audio"
                    subtitle="Tab & system media playback"
                    icon={<Volume2 className="h-4 w-4" />}
                    selected={settings.audioSource === AudioSourceOption.INTERNAL}
                    enabled={isIdle}
                    onClick={() => onSelectAudioSource(AudioSourceOption.INTERNAL)}
                    testTag="audio_internal"
                  />
                  <DefinedOptionTile
                    title="Microphone"
                    subtitle="External mic prioritized automatically"
                    icon={<Mic className="h-4 w-4" />}
                    selected={settings.audioSource === AudioSourceOption.MICROPHONE}
                    enabled={isIdle}
                    onClick={() => onSelectAudioSource(AudioSourceOption.MICROPHONE)}
                    testTag="audio_microphone"
                  />
                </div>
              </DefinedSectionCard>

              <DefinedSectionCard
                title="Video Bitrate"
                icon={<Gauge className="h-4.5 w-4.5" />}
              >
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(VIDEO_BITRATE_META) as VideoBitrateOption[]).map((opt) => {
                    const meta = VIDEO_BITRATE_META[opt];
                    const selected =
                      settings.customVideoBitrateMbps == null && settings.videoBitrate === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={!isIdle}
                        data-testid={meta.testTag}
                        aria-pressed={selected}
                        onClick={() => onSelectBitrate(opt)}
                        className={`font-mono-tnum h-10 cursor-pointer rounded-[8px] px-3 text-[13px] font-medium transition-colors ${
                          selected
                            ? 'bg-[var(--fc-primary-container)] text-[var(--fc-on-primary-container)] ring-1 ring-[var(--fc-primary)]'
                            : 'border border-[var(--fc-outline)] bg-transparent text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>

                <CustomNumericInputBox
                  label="Custom Bitrate (Mbps)"
                  placeholder="Enter any Mbps value"
                  suffixText="Mbps"
                  savedValueText={
                    settings.customVideoBitrateMbps != null
                      ? String(settings.customVideoBitrateMbps)
                      : ''
                  }
                  activeBadgeText={
                    settings.customVideoBitrateMbps != null
                      ? `Custom Bitrate: ${settings.customVideoBitrateMbps} Mbps`
                      : null
                  }
                  allowDecimal={false}
                  enabled={isIdle}
                  testTagPrefix="custom_bitrate"
                  draftText={bitrateDraft}
                  onDraftChange={onBitrateDraftChange}
                  onParseAndSave={(raw) => {
                    const mbps = Number.parseInt(raw.trim(), 10);
                    if (Number.isFinite(mbps) && mbps > 0) {
                      onSaveCustomBitrateMbps(mbps);
                      return true;
                    }
                    return false;
                  }}
                  onReset={onResetCustomBitrate}
                />
              </DefinedSectionCard>

              <div className="pointer-events-auto opacity-100">
                <DefinedSectionCard
                  title="Region Border Animation"
                  icon={<Eye className="h-4.5 w-4.5" />}
                >
                  <div className="flex gap-2.5">
                    <DefinedOptionTile
                      title="Show"
                      subtitle="Animated red dashed frame"
                      icon={<Eye className="h-4 w-4" />}
                      selected={settings.regionAnimation === RegionAnimationOption.SHOW}
                      enabled={true}
                      onClick={() => onSelectRegionAnimation(RegionAnimationOption.SHOW)}
                      testTag="anim_show"
                    />
                    <DefinedOptionTile
                      title="Hide"
                      subtitle="Border animation disabled"
                      icon={<EyeOff className="h-4 w-4" />}
                      selected={settings.regionAnimation === RegionAnimationOption.HIDE}
                      enabled={true}
                      onClick={() => onSelectRegionAnimation(RegionAnimationOption.HIDE)}
                      testTag="anim_hide"
                    />
                  </div>
                </DefinedSectionCard>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
