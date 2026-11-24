import React, { useEffect, useRef } from 'react';

interface RegionBorderCanvasProps {
  leftFraction: number;
  topFraction: number;
  rightFraction: number;
  bottomFraction: number;
  animate: boolean;
  showBorder: boolean;
  strokeWidthPx?: number;
  scrimColor?: string;
  neutralGuideColor?: string;
  accentColor?: string;
  className?: string;
}

function resolveCssColor(val: string, el: HTMLElement): string {
  const match = /^var\((--[^)]+)\)$/.exec(val.trim());
  if (match) {
    const resolved = getComputedStyle(el).getPropertyValue(match[1]).trim();
    return resolved || '#dc2626';
  }
  return val;
}

export const RegionBorderCanvas: React.FC<RegionBorderCanvasProps> = ({
  leftFraction,
  topFraction,
  rightFraction,
  bottomFraction,
  animate,
  showBorder,
  strokeWidthPx = 2.5,
  scrimColor = 'transparent',
  neutralGuideColor = 'transparent',
  accentColor = '#dc2626',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();

    const draw = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const l = Math.min(Math.max(leftFraction * w, 0), w);
      const t = Math.min(Math.max(topFraction * h, 0), h);
      const r = Math.min(Math.max(rightFraction * w, l), w);
      const b = Math.min(Math.max(bottomFraction * h, t), h);

      if (scrimColor !== 'transparent') {
        ctx.fillStyle = resolveCssColor(scrimColor, canvas);
        ctx.fillRect(0, 0, w, t);
        ctx.fillRect(0, b, w, Math.max(0, h - b));
        ctx.fillRect(0, t, l, Math.max(0, b - t));
        ctx.fillRect(r, t, Math.max(0, w - r), Math.max(0, b - t));
      }

      const rectW = Math.max(1, r - l);
      const rectH = Math.max(1, b - t);

      if (showBorder) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = strokeWidthPx + 2;
        ctx.strokeRect(l, t, rectW, rectH);
        ctx.restore();

        const period = 20;
        const phase = animate ? -(((now - startTime) % 900) / 900) * period : 0;
        ctx.save();
        ctx.strokeStyle = resolveCssColor(accentColor, canvas);
        ctx.lineWidth = strokeWidthPx;
        ctx.setLineDash([12, 8]);
        ctx.lineDashOffset = phase;
        ctx.strokeRect(l, t, rectW, rectH);
        ctx.restore();
      } else if (neutralGuideColor !== 'transparent') {
        ctx.save();
        ctx.strokeStyle = resolveCssColor(neutralGuideColor, canvas);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(l, t, rectW, rectH);
        ctx.restore();
      }

      ctx.restore();

      if (showBorder && animate) {
        rafId = requestAnimationFrame(draw);
      }
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [
    leftFraction,
    topFraction,
    rightFraction,
    bottomFraction,
    animate,
    showBorder,
    strokeWidthPx,
    scrimColor,
    neutralGuideColor,
    accentColor,
  ]);

  return <canvas ref={canvasRef} className={`h-full w-full ${className}`} />;
};
