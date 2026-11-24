import React, { useEffect, useRef, useState } from 'react';
import { Check, Move, RotateCcw, X } from 'lucide-react';
import {
  DEFAULT_NORMALIZED_REGION,
  NormalizedRegion,
  RegionAnimationOption,
} from '../types/recorder';
import {
  applyOverlayAspectRatioPreset,
  clamp,
  normalizeRegion,
  toPixelRegion,
} from '../utils/regionSelection';
import { RegionBorderCanvas } from './RegionBorderCanvas';

interface AspectPresetItem {
  id: string;
  label: string;
  ratio: number | null;
}

const ASPECT_PRESETS: AspectPresetItem[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '16_9', label: '16:9', ratio: 16 / 9 },
  { id: '9_16', label: '9:16', ratio: 9 / 16 },
  { id: '4_3', label: '4:3', ratio: 4 / 3 },
  { id: '1_1', label: '1:1', ratio: 1 },
];

type DragKind =
  | 'move'
  | 'top_left'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_right'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right';

interface RegionSelectorOverlayProps {
  initialRegion: NormalizedRegion;
  screenWidthPx: number;
  screenHeightPx: number;
  regionAnimation: RegionAnimationOption;
  draftRegion: NormalizedRegion;
  selectedPresetIndex: number;
  onDraftChanged: (region: NormalizedRegion) => void;
  onPresetChanged: (index: number) => void;
  onConfirm: (region: NormalizedRegion) => void;
  onCancel: () => void;
}

const MIN_SPAN_FRAC = 0.12;

export const RegionSelectorOverlay: React.FC<RegionSelectorOverlayProps> = ({
  initialRegion,
  screenWidthPx,
  screenHeightPx,
  regionAnimation,
  draftRegion,
  selectedPresetIndex,
  onDraftChanged,
  onPresetChanged,
  onConfirm,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [boxSize, setBoxSize] = useState({
    width: Math.max(1, screenWidthPx),
    height: Math.max(1, screenHeightPx),
  });
  const [draft, setDraft] = useState<NormalizedRegion>(() =>
    normalizeRegion(draftRegion ?? initialRegion),
  );

  const dragStateRef = useRef<{
    kind: DragKind;
    startX: number;
    startY: number;
    startRegion: NormalizedRegion;
  } | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setBoxSize({ width: r.width, height: r.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const commitDraft = (next: NormalizedRegion) => {
    const clean = normalizeRegion(next);
    setDraft(clean);
    onDraftChanged(clean);
  };

  const pixelRegion = toPixelRegion(draft, screenWidthPx, screenHeightPx);
  const showRedBorder = regionAnimation === RegionAnimationOption.SHOW;
  const hudAtTop = draft.bottom > 0.78 && draft.top > 0.24;

  const startDrag = (kind: DragKind, e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStateRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startRegion: draft,
    };
  };

  const moveDrag = (e: React.PointerEvent) => {
    const st = dragStateRef.current;
    if (!st) return;
    const dx = (e.clientX - st.startX) / Math.max(1, boxSize.width);
    const dy = (e.clientY - st.startY) / Math.max(1, boxSize.height);
    const s = st.startRegion;

    if (st.kind === 'move') {
      const w = s.right - s.left;
      const h = s.bottom - s.top;
      const newLeft = clamp(s.left + dx, 0, 1 - w);
      const newTop = clamp(s.top + dy, 0, 1 - h);
      commitDraft({
        left: newLeft,
        top: newTop,
        right: newLeft + w,
        bottom: newTop + h,
      });
      return;
    }

    onPresetChanged(0);
    let { left, top, right, bottom } = s;
    switch (st.kind) {
      case 'top_left':
        left = clamp(s.left + dx, 0, s.right - MIN_SPAN_FRAC);
        top = clamp(s.top + dy, 0, s.bottom - MIN_SPAN_FRAC);
        break;
      case 'top_right':
        right = clamp(s.right + dx, s.left + MIN_SPAN_FRAC, 1);
        top = clamp(s.top + dy, 0, s.bottom - MIN_SPAN_FRAC);
        break;
      case 'bottom_left':
        left = clamp(s.left + dx, 0, s.right - MIN_SPAN_FRAC);
        bottom = clamp(s.bottom + dy, s.top + MIN_SPAN_FRAC, 1);
        break;
      case 'bottom_right':
        right = clamp(s.right + dx, s.left + MIN_SPAN_FRAC, 1);
        bottom = clamp(s.bottom + dy, s.top + MIN_SPAN_FRAC, 1);
        break;
      case 'top':
        top = clamp(s.top + dy, 0, s.bottom - MIN_SPAN_FRAC);
        break;
      case 'bottom':
        bottom = clamp(s.bottom + dy, s.top + MIN_SPAN_FRAC, 1);
        break;
      case 'left':
        left = clamp(s.left + dx, 0, s.right - MIN_SPAN_FRAC);
        break;
      case 'right':
        right = clamp(s.right + dx, s.left + MIN_SPAN_FRAC, 1);
        break;
    }
    commitDraft({ left, top, right, bottom });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragStateRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      dragStateRef.current = null;
    }
  };

  const canvasAspect = clamp(screenWidthPx / Math.max(1, screenHeightPx), 0.35, 2.5);

  const renderHandle = (
    kind: DragKind,
    leftPct: number,
    topPct: number,
    isCorner: boolean,
    label: string,
    cursor: string,
  ) => (
    <div
      key={kind}
      role="slider"
      aria-label={label}
      tabIndex={0}
      data-testid={`handle_${kind}`}
      onPointerDown={(e) => startDrag(kind, e)}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        left: `${leftPct * 100}%`,
        top: `${topPct * 100}%`,
        cursor,
      }}
      className="absolute z-20 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center"
    >
      <div
        className={`h-4 w-4 rounded-full border-2 border-[#0D0F14] shadow ${
          isCorner ? 'bg-[#DC2626]' : 'bg-white'
        }`}
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Region Selector Overlay"
    >
      <div
        ref={containerRef}
        style={{ aspectRatio: `${canvasAspect}` }}
        className="relative max-h-[78vh] w-full max-w-[92vw] overflow-hidden rounded-[14px] border border-white/20 bg-[#151821]"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <RegionBorderCanvas
          leftFraction={draft.left}
          topFraction={draft.top}
          rightFraction={draft.right}
          bottomFraction={draft.bottom}
          animate={showRedBorder}
          showBorder={showRedBorder}
          strokeWidthPx={3}
          scrimColor="rgba(0, 0, 0, 0.58)"
          neutralGuideColor="rgba(255, 255, 255, 0.72)"
          accentColor="#DC2626"
          className="pointer-events-none absolute inset-0"
        />

        <div
          onPointerDown={(e) => startDrag('move', e)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            left: `${draft.left * 100}%`,
            top: `${draft.top * 100}%`,
            width: `${(draft.right - draft.left) * 100}%`,
            height: `${(draft.bottom - draft.top) * 100}%`,
          }}
          className="absolute z-10 flex cursor-move touch-none items-center justify-center"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow">
            <Move className="h-5 w-5" />
          </div>
        </div>

        {renderHandle('top_left', draft.left, draft.top, true, 'Resize top left corner', 'nwse-resize')}
        {renderHandle('top_right', draft.right, draft.top, true, 'Resize top right corner', 'nesw-resize')}
        {renderHandle('bottom_left', draft.left, draft.bottom, true, 'Resize bottom left corner', 'nesw-resize')}
        {renderHandle('bottom_right', draft.right, draft.bottom, true, 'Resize bottom right corner', 'nwse-resize')}

        {renderHandle('top', (draft.left + draft.right) / 2, draft.top, false, 'Adjust top edge', 'ns-resize')}
        {renderHandle('bottom', (draft.left + draft.right) / 2, draft.bottom, false, 'Adjust bottom edge', 'ns-resize')}
        {renderHandle('left', draft.left, (draft.top + draft.bottom) / 2, false, 'Adjust left edge', 'ew-resize')}
        {renderHandle('right', draft.right, (draft.top + draft.bottom) / 2, false, 'Adjust right edge', 'ew-resize')}
      </div>

      <div
        className={`fixed left-1/2 z-50 w-[calc(100%-2rem)] max-w-[520px] -translate-x-1/2 rounded-[20px] border border-[var(--fc-outline)] bg-[var(--fc-surface)]/95 p-4 shadow-2xl backdrop-blur-md ${
          hudAtTop ? 'top-4' : 'bottom-4'
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="font-mono-tnum text-[16px] font-semibold text-[var(--fc-on-surface)]">
              {pixelRegion.width} × {pixelRegion.height} px
            </div>
            <div className="font-mono-tnum text-[12px] text-[var(--fc-on-surface-variant)]">
              Origin ({pixelRegion.left}, {pixelRegion.top})
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="reset_region_button"
              aria-label="Reset region"
              onClick={() => {
                onPresetChanged(0);
                commitDraft({ ...DEFAULT_NORMALIZED_REGION });
              }}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)] focus-visible:outline-2 focus-visible:outline-[var(--fc-primary)]"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            <button
              type="button"
              data-testid="cancel_region_button"
              aria-label="Cancel region selection"
              onClick={onCancel}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)] focus-visible:outline-2 focus-visible:outline-[var(--fc-primary)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {ASPECT_PRESETS.map((preset, idx) => {
            const active = selectedPresetIndex === idx;
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`aspect_chip_${preset.id}`}
                onClick={() => {
                  onPresetChanged(idx);
                  if (preset.ratio != null) {
                    commitDraft(
                      applyOverlayAspectRatioPreset(
                        draft,
                        preset.ratio,
                        boxSize.width,
                        boxSize.height,
                      ),
                    );
                  }
                }}
                className={`h-8 cursor-pointer rounded-[8px] px-3 text-[12px] font-medium transition-colors ${
                  active
                    ? 'bg-[var(--fc-primary)] text-[var(--fc-on-primary)]'
                    : 'border border-[var(--fc-outline)] bg-[var(--fc-surface-variant)] text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-high)]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          data-testid="confirm_region_button"
          onClick={() => onConfirm(normalizeRegion(draft))}
          className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--fc-record-accent)] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Check className="h-4 w-4" />
          <span>Confirm Region</span>
        </button>
      </div>
    </div>
  );
};
