import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import {
  CropAspectRatioPreset,
  CropDragHandle,
  CropMediaKind,
  MediaInspectionResult,
  NormalizedCropRect,
} from '../types/crop';
import { CropCoordinateMapper } from '../utils/cropCoordinateMapper';

interface CropEditorCanvasProps {
  inspection: MediaInspectionResult;
  cropRect: NormalizedCropRect;
  aspectPreset: CropAspectRatioPreset;
  enabled: boolean;
  onCropRectChange: (rect: NormalizedCropRect) => void;
}

export const CropEditorCanvas: React.FC<CropEditorCanvasProps> = ({
  inspection,
  cropRect,
  aspectPreset,
  enabled,
  onCropRectChange,
}) => {
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeHandleRef = useRef<CropDragHandle | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setIsPlayingVideo(false);
  }, [inspection.objectUrl]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlayingVideo) {
      vid.play().catch(() => setIsPlayingVideo(false));
    } else {
      vid.pause();
    }
  }, [isPlayingVideo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(2, Math.round(rect.width));
    const h = Math.max(2, Math.round(rect.height));

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    const styles = getComputedStyle(canvas);
    const primary = styles.getPropertyValue('--fc-primary').trim() || '#dc2626';
    const onPrimary = styles.getPropertyValue('--fc-on-primary').trim() || '#ffffff';

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const cLeft = cropRect.left * w;
    const cTop = cropRect.top * h;
    const cRight = cropRect.right * w;
    const cBottom = cropRect.bottom * h;
    const cWidth = Math.max(2, cRight - cLeft);
    const cHeight = Math.max(2, cBottom - cTop);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fillRect(0, 0, w, cTop);
    ctx.fillRect(0, cBottom, w, Math.max(0, h - cBottom));
    ctx.fillRect(0, cTop, cLeft, cHeight);
    ctx.fillRect(cRight, cTop, Math.max(0, w - cRight), cHeight);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    const v1 = cLeft + cWidth / 3;
    const v2 = cLeft + (cWidth * 2) / 3;
    const h1 = cTop + cHeight / 3;
    const h2 = cTop + (cHeight * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(v1, cTop);
    ctx.lineTo(v1, cBottom);
    ctx.moveTo(v2, cTop);
    ctx.lineTo(v2, cBottom);
    ctx.moveTo(cLeft, h1);
    ctx.lineTo(cRight, h1);
    ctx.moveTo(cLeft, h2);
    ctx.lineTo(cRight, h2);
    ctx.stroke();

    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    ctx.strokeRect(cLeft, cTop, cWidth, cHeight);

    const corners: Array<[number, number]> = [
      [cLeft, cTop],
      [cRight, cTop],
      [cLeft, cBottom],
      [cRight, cBottom],
    ];
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fillStyle = primary;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = onPrimary;
      ctx.stroke();
    }

    const midX = (cLeft + cRight) * 0.5;
    const midY = (cTop + cBottom) * 0.5;
    const pillLen = 18;
    const pillThick = 5;
    ctx.fillStyle = primary;

    const drawPill = (x: number, y: number, pw: number, ph: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, pw, ph, pillThick * 0.5);
      ctx.fill();
    };
    drawPill(midX - pillLen * 0.5, cTop - pillThick * 0.5, pillLen, pillThick);
    drawPill(midX - pillLen * 0.5, cBottom - pillThick * 0.5, pillLen, pillThick);
    drawPill(cLeft - pillThick * 0.5, midY - pillLen * 0.5, pillThick, pillLen);
    drawPill(cRight - pillThick * 0.5, midY - pillLen * 0.5, pillThick, pillLen);

    ctx.restore();
  }, [cropRect, inspection.displayWidth, inspection.displayHeight]);

  const mediaAspect = Math.min(
    6,
    Math.max(0.15, Math.max(1, inspection.displayWidth) / Math.max(1, inspection.displayHeight)),
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!enabled || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const handle = CropCoordinateMapper.hitTestHandle(
      x,
      y,
      cropRect.left * rect.width,
      cropRect.top * rect.height,
      cropRect.right * rect.width,
      cropRect.bottom * rect.height,
      28,
    );
    activeHandleRef.current = handle;
    lastPointRef.current = { x, y };
    if (handle) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const handle = activeHandleRef.current;
    const last = lastPointRef.current;
    if (!handle || !last || !enabled || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = (x - last.x) / Math.max(2, rect.width);
    const dy = (y - last.y) / Math.max(2, rect.height);
    lastPointRef.current = { x, y };

    const updated = CropCoordinateMapper.applyDrag(
      cropRect,
      handle,
      dx,
      dy,
      aspectPreset,
      inspection.displayWidth,
      inspection.displayHeight,
    );
    onCropRectChange(updated);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeHandleRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      activeHandleRef.current = null;
      lastPointRef.current = null;
    }
  };

  return (
    <div className="relative flex min-h-[260px] max-h-[440px] w-full items-center justify-center rounded-[18px] border border-[var(--fc-outline-variant)] bg-[var(--fc-surface)] p-3">
      <div
        style={{ aspectRatio: `${mediaAspect}` }}
        className="relative max-h-[410px] w-full max-w-full overflow-hidden rounded-[12px] bg-[var(--fc-surface-variant)]"
      >
        {inspection.kind === CropMediaKind.PHOTO ? (
          <img
            src={inspection.objectUrl}
            alt="Selected media preview"
            className="h-full w-full object-fill select-none"
            draggable={false}
          />
        ) : (
          <video
            ref={videoRef}
            src={inspection.objectUrl}
            muted
            loop
            playsInline
            className="h-full w-full object-fill"
          />
        )}

        <canvas
          ref={canvasRef}
          data-testid="crop_editor_canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
        />
      </div>

      {inspection.kind === CropMediaKind.VIDEO && (
        <button
          type="button"
          data-testid="crop_video_preview_toggle"
          aria-label={isPlayingVideo ? 'Pause video preview' : 'Play video preview'}
          onClick={() => setIsPlayingVideo((v) => !v)}
          className="absolute top-5 right-5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[var(--fc-surface)]/85 text-[var(--fc-on-surface)] shadow backdrop-blur-xs hover:bg-[var(--fc-surface)]"
        >
          {isPlayingVideo ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
      )}
    </div>
  );
};
