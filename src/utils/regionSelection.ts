import {
  DEFAULT_NORMALIZED_REGION,
  NormalizedRegion,
  OrientationMode,
  PixelRegion,
} from '../types/recorder';

const MIN_SPAN_FRAC = 0.12;
const MIN_PIXEL_SPAN = 128;

export function clamp(val: number, min: number, max: number): number {
  if (min > max) return min;
  return Math.min(Math.max(val, min), max);
}

export function alignEven(value: number): number {
  const v = Math.floor(value);
  return v % 2 === 0 ? v : Math.max(2, v - 1);
}

export function normalizeRegion(region: NormalizedRegion): NormalizedRegion {
  const left = clamp(region.left, 0, 1 - MIN_SPAN_FRAC);
  const top = clamp(region.top, 0, 1 - MIN_SPAN_FRAC);
  const right = clamp(region.right, left + MIN_SPAN_FRAC, 1);
  const bottom = clamp(region.bottom, top + MIN_SPAN_FRAC, 1);
  return { left, top, right, bottom };
}

export function resolveFullScreenDimensions(
  rawWidth: number,
  rawHeight: number,
  orientationMode: OrientationMode = OrientationMode.PORTRAIT,
): { width: number; height: number } {
  const evenW = alignEven(Math.max(128, rawWidth));
  const evenH = alignEven(Math.max(128, rawHeight));
  if (orientationMode === OrientationMode.PORTRAIT) {
    return { width: Math.min(evenW, evenH), height: Math.max(evenW, evenH) };
  }
  return { width: Math.max(evenW, evenH), height: Math.min(evenW, evenH) };
}

export function toPixelRegion(
  normalized: NormalizedRegion,
  screenWidth: number,
  screenHeight: number,
): PixelRegion {
  const safeScreenW = alignEven(Math.max(MIN_PIXEL_SPAN, screenWidth));
  const safeScreenH = alignEven(Math.max(MIN_PIXEL_SPAN, screenHeight));
  const clean = normalizeRegion(normalized);

  const left = clamp(alignEven(Math.round(clean.left * safeScreenW)), 0, safeScreenW - MIN_PIXEL_SPAN);
  const top = clamp(alignEven(Math.round(clean.top * safeScreenH)), 0, safeScreenH - MIN_PIXEL_SPAN);
  let right = clamp(
    alignEven(Math.round(clean.right * safeScreenW)),
    left + MIN_PIXEL_SPAN,
    safeScreenW,
  );
  let bottom = clamp(
    alignEven(Math.round(clean.bottom * safeScreenH)),
    top + MIN_PIXEL_SPAN,
    safeScreenH,
  );

  if ((right - left) % 2 !== 0) {
    right = right > left + MIN_PIXEL_SPAN ? right - 1 : Math.min(safeScreenW, right + 1);
  }
  if ((bottom - top) % 2 !== 0) {
    bottom = bottom > top + MIN_PIXEL_SPAN ? bottom - 1 : Math.min(safeScreenH, bottom + 1);
  }
  if (left === right) right = Math.min(safeScreenW, left + 2);
  if (top === bottom) bottom = Math.min(safeScreenH, top + 2);

  return {
    left,
    top,
    right,
    bottom,
    screenWidth: safeScreenW,
    screenHeight: safeScreenH,
    width: Math.max(2, right - left),
    height: Math.max(2, bottom - top),
  };
}

export function fromPixelBounds(
  left: number,
  top: number,
  right: number,
  bottom: number,
  containerWidth: number,
  containerHeight: number,
): NormalizedRegion {
  if (containerWidth <= 0 || containerHeight <= 0) return { ...DEFAULT_NORMALIZED_REGION };
  return normalizeRegion({
    left: left / containerWidth,
    top: top / containerHeight,
    right: right / containerWidth,
    bottom: bottom / containerHeight,
  });
}

export function applyOverlayAspectRatioPreset(
  current: NormalizedRegion,
  targetRatio: number,
  screenW: number,
  screenH: number,
): NormalizedRegion {
  const centerX = (current.left + current.right) / 2;
  const centerY = (current.top + current.bottom) / 2;
  const curW = (current.right - current.left) * screenW;

  let targetW = curW;
  let targetH = targetW / targetRatio;
  if (targetH > screenH * 0.85) {
    targetH = screenH * 0.85;
    targetW = targetH * targetRatio;
  }
  if (targetW > screenW * 0.9) {
    targetW = screenW * 0.9;
    targetH = targetW / targetRatio;
  }

  const halfFracW = targetW / screenW / 2;
  const halfFracH = targetH / screenH / 2;
  const clampedCx = clamp(centerX, halfFracW, 1 - halfFracW);
  const clampedCy = clamp(centerY, halfFracH, 1 - halfFracH);

  return normalizeRegion({
    left: clampedCx - halfFracW,
    top: clampedCy - halfFracH,
    right: clampedCx + halfFracW,
    bottom: clampedCy + halfFracH,
  });
}
