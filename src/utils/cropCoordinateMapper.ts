import {
  CROP_ASPECT_PRESET_META,
  CROP_MIN_FRACTION,
  CropAspectRatioPreset,
  CropDragHandle,
  DynamicBitrateRange,
  NormalizedCropRect,
  PixelCropRect,
  VIDEO_CROP_FPS_META,
  VIDEO_CROP_RES_META,
  VideoCropFpsPreset,
  VideoCropResolutionPreset,
} from '../types/crop';
import { clamp } from './regionSelection';

function getDisplayAspectRatio(preset: CropAspectRatioPreset): number | null {
  const meta = CROP_ASPECT_PRESET_META[preset];
  if (meta.widthFactor == null || meta.heightFactor == null) return null;
  return meta.widthFactor / meta.heightFactor;
}

function clampFree(rect: NormalizedCropRect): NormalizedCropRect {
  const minSpan = CROP_MIN_FRACTION;
  const left = clamp(rect.left, 0, 1 - minSpan);
  const top = clamp(rect.top, 0, 1 - minSpan);
  const right = clamp(rect.right, left + minSpan, 1);
  const bottom = clamp(rect.bottom, top + minSpan, 1);
  return { left, top, right, bottom };
}

function alignEvenDown(value: number, minValue: number): number {
  const even = Math.floor(value / 2) * 2;
  return Math.max(minValue, even);
}

export const CropCoordinateMapper = {
  hitTestHandle(
    touchX: number,
    touchY: number,
    cropLeftPx: number,
    cropTopPx: number,
    cropRightPx: number,
    cropBottomPx: number,
    handleRadiusPx: number,
  ): CropDragHandle | null {
    const midX = (cropLeftPx + cropRightPx) * 0.5;
    const midY = (cropTopPx + cropBottomPx) * 0.5;

    const handles: Array<[CropDragHandle, number]> = [
      [CropDragHandle.TOP_LEFT, Math.hypot(touchX - cropLeftPx, touchY - cropTopPx)],
      [CropDragHandle.TOP_RIGHT, Math.hypot(touchX - cropRightPx, touchY - cropTopPx)],
      [CropDragHandle.BOTTOM_LEFT, Math.hypot(touchX - cropLeftPx, touchY - cropBottomPx)],
      [CropDragHandle.BOTTOM_RIGHT, Math.hypot(touchX - cropRightPx, touchY - cropBottomPx)],
      [CropDragHandle.TOP_CENTER, Math.hypot(touchX - midX, touchY - cropTopPx)],
      [CropDragHandle.BOTTOM_CENTER, Math.hypot(touchX - midX, touchY - cropBottomPx)],
      [CropDragHandle.MIDDLE_LEFT, Math.hypot(touchX - cropLeftPx, touchY - midY)],
      [CropDragHandle.MIDDLE_RIGHT, Math.hypot(touchX - cropRightPx, touchY - midY)],
    ];

    let closest: [CropDragHandle, number] | null = null;
    for (const entry of handles) {
      if (!closest || entry[1] < closest[1]) closest = entry;
    }

    if (closest && closest[1] <= handleRadiusPx) {
      return closest[0];
    }

    if (touchX >= cropLeftPx && touchX <= cropRightPx && touchY >= cropTopPx && touchY <= cropBottomPx) {
      return CropDragHandle.MOVE_BOX;
    }
    return null;
  },

  applyAspectRatioPreset(
    current: NormalizedCropRect,
    preset: CropAspectRatioPreset,
    mediaDisplayWidth: number,
    mediaDisplayHeight: number,
  ): NormalizedCropRect {
    const targetDisplayAspect = getDisplayAspectRatio(preset);
    if (targetDisplayAspect == null) return clampFree(current);

    const mediaAspect = clamp(
      Math.max(1, mediaDisplayWidth) / Math.max(1, mediaDisplayHeight),
      0.1,
      10,
    );
    const normRatio = clamp(targetDisplayAspect / mediaAspect, 0.1, 10);

    const centerX = clamp((current.left + current.right) * 0.5, 0.1, 0.9);
    const centerY = clamp((current.top + current.bottom) * 0.5, 0.1, 0.9);
    const curW = clamp(current.right - current.left, CROP_MIN_FRACTION, 1);
    const curH = clamp(current.bottom - current.top, CROP_MIN_FRACTION, 1);

    let normW = curW;
    let normH = normW / normRatio;

    if (normH > curH) {
      normH = curH;
      normW = normH * normRatio;
    }

    const minW = Math.max(CROP_MIN_FRACTION, CROP_MIN_FRACTION * normRatio);
    const minH = Math.max(CROP_MIN_FRACTION, CROP_MIN_FRACTION / normRatio);
    normW = clamp(normW, Math.min(1, minW), 1);
    normH = clamp(normW / normRatio, Math.min(1, minH), 1);
    if (normW > 1 || normH > 1) {
      const s = Math.min(1 / normW, 1 / normH);
      normW *= s;
      normH *= s;
    }

    let left = centerX - normW * 0.5;
    let right = centerX + normW * 0.5;
    let top = centerY - normH * 0.5;
    let bottom = centerY + normH * 0.5;

    if (left < 0) {
      right -= left;
      left = 0;
    }
    if (right > 1) {
      left -= right - 1;
      right = 1;
    }
    if (top < 0) {
      bottom -= top;
      top = 0;
    }
    if (bottom > 1) {
      top -= bottom - 1;
      bottom = 1;
    }

    const finalLeft = clamp(left, 0, 1 - CROP_MIN_FRACTION);
    const finalTop = clamp(top, 0, 1 - CROP_MIN_FRACTION);
    return {
      left: finalLeft,
      top: finalTop,
      right: clamp(right, finalLeft + 0.02, 1),
      bottom: clamp(bottom, finalTop + 0.02, 1),
    };
  },

  applyDrag(
    current: NormalizedCropRect,
    handle: CropDragHandle,
    deltaNormX: number,
    deltaNormY: number,
    aspectPreset: CropAspectRatioPreset,
    mediaDisplayWidth: number,
    mediaDisplayHeight: number,
  ): NormalizedCropRect {
    if (handle === CropDragHandle.MOVE_BOX) {
      const w = clamp(current.right - current.left, CROP_MIN_FRACTION, 1);
      const h = clamp(current.bottom - current.top, CROP_MIN_FRACTION, 1);
      const newLeft = clamp(current.left + deltaNormX, 0, 1 - w);
      const newTop = clamp(current.top + deltaNormY, 0, 1 - h);
      return {
        left: newLeft,
        top: newTop,
        right: newLeft + w,
        bottom: newTop + h,
      };
    }

    const minSpan = CROP_MIN_FRACTION;
    let { left, top, right, bottom } = current;

    switch (handle) {
      case CropDragHandle.TOP_LEFT:
        left = clamp(left + deltaNormX, 0, right - minSpan);
        top = clamp(top + deltaNormY, 0, bottom - minSpan);
        break;
      case CropDragHandle.TOP_RIGHT:
        right = clamp(right + deltaNormX, left + minSpan, 1);
        top = clamp(top + deltaNormY, 0, bottom - minSpan);
        break;
      case CropDragHandle.BOTTOM_LEFT:
        left = clamp(left + deltaNormX, 0, right - minSpan);
        bottom = clamp(bottom + deltaNormY, top + minSpan, 1);
        break;
      case CropDragHandle.BOTTOM_RIGHT:
        right = clamp(right + deltaNormX, left + minSpan, 1);
        bottom = clamp(bottom + deltaNormY, top + minSpan, 1);
        break;
      case CropDragHandle.TOP_CENTER:
        top = clamp(top + deltaNormY, 0, bottom - minSpan);
        break;
      case CropDragHandle.BOTTOM_CENTER:
        bottom = clamp(bottom + deltaNormY, top + minSpan, 1);
        break;
      case CropDragHandle.MIDDLE_LEFT:
        left = clamp(left + deltaNormX, 0, right - minSpan);
        break;
      case CropDragHandle.MIDDLE_RIGHT:
        right = clamp(right + deltaNormX, left + minSpan, 1);
        break;
    }

    const targetAspect = getDisplayAspectRatio(aspectPreset);
    if (targetAspect == null) {
      return clampFree({ left, top, right, bottom });
    }

    const mediaAspect = clamp(
      Math.max(1, mediaDisplayWidth) / Math.max(1, mediaDisplayHeight),
      0.1,
      10,
    );
    const normRatio = clamp(targetAspect / mediaAspect, 0.1, 10);

    switch (handle) {
      case CropDragHandle.TOP_LEFT: {
        const wFromX = Math.max(minSpan, right - left);
        const hFromY = Math.max(minSpan, bottom - top);
        const useWidth = Math.abs(deltaNormX) >= Math.abs(deltaNormY);
        let w = useWidth ? wFromX : hFromY * normRatio;
        let h = w / normRatio;
        const maxW = Math.min(right, bottom * normRatio);
        if (w > maxW) {
          w = maxW;
          h = w / normRatio;
        }
        if (h < minSpan) {
          h = minSpan;
          w = h * normRatio;
        }
        return { left: Math.max(0, right - w), top: Math.max(0, bottom - h), right, bottom };
      }
      case CropDragHandle.TOP_RIGHT: {
        const wFromX = Math.max(minSpan, right - left);
        const hFromY = Math.max(minSpan, bottom - top);
        const useWidth = Math.abs(deltaNormX) >= Math.abs(deltaNormY);
        let w = useWidth ? wFromX : hFromY * normRatio;
        let h = w / normRatio;
        const maxW = Math.min(1 - left, bottom * normRatio);
        if (w > maxW) {
          w = maxW;
          h = w / normRatio;
        }
        if (h < minSpan) {
          h = minSpan;
          w = h * normRatio;
        }
        return { left, top: Math.max(0, bottom - h), right: Math.min(1, left + w), bottom };
      }
      case CropDragHandle.BOTTOM_LEFT: {
        const wFromX = Math.max(minSpan, right - left);
        const hFromY = Math.max(minSpan, bottom - top);
        const useWidth = Math.abs(deltaNormX) >= Math.abs(deltaNormY);
        let w = useWidth ? wFromX : hFromY * normRatio;
        let h = w / normRatio;
        const maxW = Math.min(right, (1 - top) * normRatio);
        if (w > maxW) {
          w = maxW;
          h = w / normRatio;
        }
        if (h < minSpan) {
          h = minSpan;
          w = h * normRatio;
        }
        return { left: Math.max(0, right - w), top, right, bottom: Math.min(1, top + h) };
      }
      case CropDragHandle.BOTTOM_RIGHT: {
        const wFromX = Math.max(minSpan, right - left);
        const hFromY = Math.max(minSpan, bottom - top);
        const useWidth = Math.abs(deltaNormX) >= Math.abs(deltaNormY);
        let w = useWidth ? wFromX : hFromY * normRatio;
        let h = w / normRatio;
        const maxW = Math.min(1 - left, (1 - top) * normRatio);
        if (w > maxW) {
          w = maxW;
          h = w / normRatio;
        }
        if (h < minSpan) {
          h = minSpan;
          w = h * normRatio;
        }
        return { left, top, right: Math.min(1, left + w), bottom: Math.min(1, top + h) };
      }
      case CropDragHandle.TOP_CENTER:
      case CropDragHandle.BOTTOM_CENTER: {
        let h = Math.max(minSpan, bottom - top);
        let w = h * normRatio;
        if (w > 1) {
          w = 1;
          h = w / normRatio;
        }
        const cx = clamp((left + right) * 0.5, w * 0.5, 1 - w * 0.5);
        const newLeft = cx - w * 0.5;
        const newRight = cx + w * 0.5;
        if (handle === CropDragHandle.TOP_CENTER) {
          return { left: newLeft, top: Math.max(0, bottom - h), right: newRight, bottom };
        }
        return { left: newLeft, top, right: newRight, bottom: Math.min(1, top + h) };
      }
      case CropDragHandle.MIDDLE_LEFT:
      case CropDragHandle.MIDDLE_RIGHT: {
        let w = Math.max(minSpan, right - left);
        let h = w / normRatio;
        if (h > 1) {
          h = 1;
          w = h * normRatio;
        }
        const cy = clamp((top + bottom) * 0.5, h * 0.5, 1 - h * 0.5);
        const newTop = cy - h * 0.5;
        const newBottom = cy + h * 0.5;
        if (handle === CropDragHandle.MIDDLE_LEFT) {
          return { left: Math.max(0, right - w), top: newTop, right, bottom: newBottom };
        }
        return { left, top: newTop, right: Math.min(1, left + w), bottom: newBottom };
      }
      default:
        return current;
    }
  },

  toDisplayPixelRect(
    crop: NormalizedCropRect,
    displayWidth: number,
    displayHeight: number,
    evenAlign = false,
  ): PixelCropRect {
    const safeW = Math.max(2, displayWidth);
    const safeH = Math.max(2, displayHeight);
    let left = clamp(Math.round(clamp(crop.left, 0, 1) * safeW), 0, safeW - 2);
    let top = clamp(Math.round(clamp(crop.top, 0, 1) * safeH), 0, safeH - 2);
    let right = clamp(Math.round(clamp(crop.right, 0, 1) * safeW), left + 2, safeW);
    let bottom = clamp(Math.round(clamp(crop.bottom, 0, 1) * safeH), top + 2, safeH);

    if (evenAlign) {
      left = Math.floor(left / 2) * 2;
      top = Math.floor(top / 2) * 2;
      const minSize = Math.max(2, Math.min(16, safeW));
      const minH = Math.max(2, Math.min(16, safeH));
      let w = Math.max(minSize, Math.floor((right - left) / 2) * 2);
      let h = Math.max(minH, Math.floor((bottom - top) / 2) * 2);
      if (left + w > safeW) {
        w = Math.floor((safeW - left) / 2) * 2;
      }
      if (top + h > safeH) {
        h = Math.floor((safeH - top) / 2) * 2;
      }
      right = Math.min(safeW, left + w);
      bottom = Math.min(safeH, top + h);
    }

    return {
      left,
      top,
      right,
      bottom,
      sourceWidth: safeW,
      sourceHeight: safeH,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    };
  },

  computeVideoOutputDimensions(
    croppedDisplayWidth: number,
    croppedDisplayHeight: number,
    preset: VideoCropResolutionPreset,
  ): { width: number; height: number } {
    const srcW = Math.max(16, croppedDisplayWidth);
    const srcH = Math.max(16, croppedDisplayHeight);
    if (preset === VideoCropResolutionPreset.ORIGINAL) {
      return { width: alignEvenDown(srcW, 16), height: alignEvenDown(srcH, 16) };
    }

    const meta = VIDEO_CROP_RES_META[preset];
    const srcLong = Math.max(srcW, srcH);
    const srcShort = Math.min(srcW, srcH);

    const scaleLong = meta.maxLongEdge / srcLong;
    const scaleShort = meta.shortEdgeHint / srcShort;
    const targetScale = Math.min(1.0, Math.min(scaleLong, scaleShort));

    return {
      width: alignEvenDown(Math.round(srcW * targetScale), 16),
      height: alignEvenDown(Math.round(srcH * targetScale), 16),
    };
  },

  computeDynamicBitrateRange(
    preset: VideoCropResolutionPreset,
    fps: VideoCropFpsPreset,
    outWidth: number,
    outHeight: number,
    sourceBitrateBps: number | null = null,
    sourceFps: number | null = null,
  ): DynamicBitrateRange {
    const pixelArea = Math.max(64, outWidth) * Math.max(64, outHeight);
    const pixelScale = clamp(pixelArea / (1920 * 1080), 0.25, 8.0);
    const effectiveFps =
      fps === VideoCropFpsPreset.ORIGINAL
        ? clamp(sourceFps ?? 30, 15, 240)
        : VIDEO_CROP_FPS_META[fps].fps;
    const fpsMultiplier = clamp(effectiveFps / 30.0, 0.8, 4.0);

    const sourceMbps =
      sourceBitrateBps != null && sourceBitrateBps > 0
        ? Math.max(1, Math.floor((sourceBitrateBps + 500_000) / 1_000_000))
        : null;

    const minMbps = 1;
    let basePresetMaxRaw: number;
    switch (preset) {
      case VideoCropResolutionPreset.ORIGINAL:
        basePresetMaxRaw = Math.round(45.0 * clamp(pixelScale, 0.6, 5.0) * fpsMultiplier);
        break;
      case VideoCropResolutionPreset.UHD_4K:
        basePresetMaxRaw = Math.round(55.0 * fpsMultiplier);
        break;
      case VideoCropResolutionPreset.QHD_2K:
        basePresetMaxRaw = Math.round(35.0 * fpsMultiplier);
        break;
      case VideoCropResolutionPreset.FHD_1080P:
        basePresetMaxRaw = Math.round(24.0 * fpsMultiplier);
        break;
      case VideoCropResolutionPreset.HD_720P:
        basePresetMaxRaw = Math.round(14.0 * fpsMultiplier);
        break;
    }
    const basePresetMax = clamp(basePresetMaxRaw, 12, 240);
    const maxMbps = Math.max(minMbps, Math.max(basePresetMax, sourceMbps ?? 0));

    let areaSuggested: number;
    switch (preset) {
      case VideoCropResolutionPreset.ORIGINAL:
        areaSuggested = Math.round(14.0 * clamp(pixelScale, 0.45, 5.0) * fpsMultiplier);
        break;
      case VideoCropResolutionPreset.UHD_4K:
        areaSuggested = Math.round(34.0 * clamp(pixelScale, 0.45, 4.0) * fpsMultiplier);
        break;
      case VideoCropResolutionPreset.QHD_2K:
        areaSuggested = Math.round(20.0 * clamp(pixelScale, 0.45, 2.5) * fpsMultiplier);
        break;
      case VideoCropResolutionPreset.FHD_1080P:
        areaSuggested = Math.round(12.0 * clamp(pixelScale, 0.45, 1.5) * fpsMultiplier);
        break;
      case VideoCropResolutionPreset.HD_720P:
        areaSuggested = Math.round(6.0 * clamp(pixelScale, 0.45, 1.2) * fpsMultiplier);
        break;
    }

    let suggested: number;
    if (
      sourceMbps != null &&
      preset === VideoCropResolutionPreset.ORIGINAL &&
      fps === VideoCropFpsPreset.ORIGINAL
    ) {
      suggested = clamp(sourceMbps, minMbps, maxMbps);
    } else if (sourceMbps != null) {
      suggested = clamp(Math.max(areaSuggested, Math.min(sourceMbps, basePresetMax)), minMbps, maxMbps);
    } else {
      suggested = clamp(areaSuggested, minMbps, maxMbps);
    }

    return { minMbps, maxMbps, suggestedMbps: suggested };
  },
};
