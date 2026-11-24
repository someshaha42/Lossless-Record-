import {
  CropFeasibilityResult,
  CropMediaKind,
  MediaInspectionResult,
  NormalizedCropRect,
  isFullFrameCrop,
} from '../types/crop';
import { CropCoordinateMapper } from './cropCoordinateMapper';

const KNOWN_VIDEO_EXTS = new Set([
  'mp4', 'm4v', 'mov', 'mkv', 'webm', '3gp', '3g2', 'avi', 'flv', 'ts', 'm2ts', 'mts', 'wmv', 'asf', 'ogv', 'mpg', 'mpeg',
]);

const KNOWN_IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'jpe', 'png', 'webp', 'heic', 'heif', 'avif', 'gif', 'bmp', 'wbmp', 'ico', 'tif', 'tiff', 'svg',
]);

function labelPhotoContainer(mime: string, ext: string): string {
  if (mime.includes('png') || ext === 'png') return 'PNG (Lossless)';
  if (mime.includes('webp') || ext === 'webp') return 'WebP';
  if (mime.includes('heic') || mime.includes('heif') || ext === 'heic' || ext === 'heif') return 'HEIF / HEIC';
  if (mime.includes('avif') || ext === 'avif') return 'AVIF';
  if (mime.includes('gif') || ext === 'gif') return 'GIF';
  if (mime.includes('bmp') || ext === 'bmp') return 'BMP';
  if (mime.includes('svg') || ext === 'svg') return 'SVG';
  if (mime.includes('icon') || mime.includes('ico') || ext === 'ico') return 'ICO';
  if (mime.includes('tiff') || ext === 'tif' || ext === 'tiff') return 'TIFF';
  return 'JPEG';
}

function labelVideoContainer(mime: string, ext: string): string {
  if (mime.includes('webm') || ext === 'webm') return 'WebM';
  if (mime.includes('matroska') || ext === 'mkv') return 'MKV';
  if (mime.includes('quicktime') || ext === 'mov') return 'MOV';
  if (mime.includes('3gpp') || ext === '3gp' || ext === '3g2') return '3GP';
  if (mime.includes('msvideo') || mime.includes('avi') || ext === 'avi') return 'AVI';
  if (mime.includes('flv') || ext === 'flv') return 'FLV';
  if (mime.includes('ogg') || ext === 'ogv') return 'OGV';
  return 'MP4';
}

async function sniffHeader(file: File): Promise<{
  mime: string;
  isVideo: boolean;
  isImage: boolean;
}> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const typeLower = (file.type || '').toLowerCase();

  try {
    const slice = file.slice(0, 32);
    const buf = new Uint8Array(await slice.arrayBuffer());
    if (buf.length >= 12) {
      if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return { mime: 'image/jpeg', isImage: true, isVideo: false };
      }
      if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
        return { mime: 'image/png', isImage: true, isVideo: false };
      }
      if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
        return { mime: 'image/gif', isImage: true, isVideo: false };
      }
      const riffTag = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
      if (riffTag === 'RIFF') {
        const fourcc = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
        if (fourcc === 'WEBP') return { mime: 'image/webp', isImage: true, isVideo: false };
        if (fourcc === 'AVI ') return { mime: 'video/x-msvideo', isImage: false, isVideo: true };
      }
      if (buf[0] === 0x42 && buf[1] === 0x4d) {
        return { mime: 'image/bmp', isImage: true, isVideo: false };
      }
      const ftyp = String.fromCharCode(buf[4], buf[5], buf[6], buf[7]);
      if (ftyp === 'ftyp') {
        const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]).toLowerCase();
        if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
          return { mime: 'image/heic', isImage: true, isVideo: false };
        }
        if (['avif', 'avis'].includes(brand)) {
          return { mime: 'image/avif', isImage: true, isVideo: false };
        }
        if (brand === 'qt  ') {
          return { mime: 'video/quicktime', isImage: false, isVideo: true };
        }
        return { mime: 'video/mp4', isImage: false, isVideo: true };
      }
      if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
        const isWebm = ext === 'webm' || typeLower.includes('webm');
        return {
          mime: isWebm ? 'video/webm' : 'video/x-matroska',
          isImage: false,
          isVideo: true,
        };
      }
    }
  } catch {
    // Fallback to MIME / extension
  }

  if (typeLower.startsWith('video/') || KNOWN_VIDEO_EXTS.has(ext)) {
    return { mime: typeLower || `video/${ext || 'mp4'}`, isImage: false, isVideo: true };
  }
  if (typeLower.startsWith('image/') || KNOWN_IMAGE_EXTS.has(ext)) {
    return { mime: typeLower || `image/${ext || 'jpeg'}`, isImage: true, isVideo: false };
  }
  return { mime: typeLower || 'application/octet-stream', isImage: false, isVideo: false };
}

function loadImageDimensions(objectUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      } else {
        reject(new Error('Image has zero dimensions'));
      }
    };
    img.onerror = () => reject(new Error('Unable to decode image'));
    img.src = objectUrl;
  });
}

function loadVideoMetadata(
  objectUrl: string,
): Promise<{ width: number; height: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const dur = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0;
      if (w > 0 && h > 0) {
        resolve({ width: w, height: h, durationMs: dur });
      } else {
        reject(new Error('Video track has zero dimensions'));
      }
    };
    video.onerror = () => reject(new Error('Unable to decode video metadata'));
    video.src = objectUrl;
  });
}

export async function inspectMediaFile(file: File): Promise<MediaInspectionResult | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const sniff = await sniffHeader(file);
  const objectUrl = URL.createObjectURL(file);

  if (sniff.isVideo) {
    try {
      const meta = await loadVideoMetadata(objectUrl);
      const containerLabel = labelVideoContainer(sniff.mime, ext);
      const codecLabel = containerLabel === 'WebM' ? 'VP9 / VP8' : 'H.264 / HEVC';
      const bitrateBps =
        meta.durationMs > 0
          ? Math.max(100_000, Math.round((file.size * 8 * 1000) / meta.durationMs))
          : null;
      return {
        file,
        objectUrl,
        kind: CropMediaKind.VIDEO,
        displayName: file.name,
        mimeType: sniff.mime || 'video/mp4',
        containerLabel,
        codecLabel,
        audioCodecLabel: 'Audio Track',
        rawWidth: meta.width,
        rawHeight: meta.height,
        rotationDegrees: 0,
        displayWidth: meta.width,
        displayHeight: meta.height,
        durationMs: meta.durationMs,
        frameRate: 30,
        bitrateBps,
        fileSizeBytes: file.size,
        colorInfoLabel: 'BT.709 (SDR)',
      };
    } catch {
      URL.revokeObjectURL(objectUrl);
      return null;
    }
  }

  if (sniff.isImage) {
    try {
      const dims = await loadImageDimensions(objectUrl);
      const containerLabel = labelPhotoContainer(sniff.mime, ext);
      return {
        file,
        objectUrl,
        kind: CropMediaKind.PHOTO,
        displayName: file.name,
        mimeType: sniff.mime || 'image/jpeg',
        containerLabel,
        codecLabel: containerLabel,
        audioCodecLabel: null,
        rawWidth: dims.width,
        rawHeight: dims.height,
        rotationDegrees: 0,
        displayWidth: dims.width,
        displayHeight: dims.height,
        durationMs: 0,
        frameRate: null,
        bitrateBps: null,
        fileSizeBytes: file.size,
        colorInfoLabel: 'sRGB',
      };
    } catch {
      URL.revokeObjectURL(objectUrl);
      return null;
    }
  }

  try {
    const dims = await loadImageDimensions(objectUrl);
    const containerLabel = labelPhotoContainer(sniff.mime, ext);
    return {
      file,
      objectUrl,
      kind: CropMediaKind.PHOTO,
      displayName: file.name,
      mimeType: sniff.mime || 'image/jpeg',
      containerLabel,
      codecLabel: containerLabel,
      audioCodecLabel: null,
      rawWidth: dims.width,
      rawHeight: dims.height,
      rotationDegrees: 0,
      displayWidth: dims.width,
      displayHeight: dims.height,
      durationMs: 0,
      frameRate: null,
      bitrateBps: null,
      fileSizeBytes: file.size,
      colorInfoLabel: 'sRGB',
    };
  } catch {
    try {
      const meta = await loadVideoMetadata(objectUrl);
      const containerLabel = labelVideoContainer(sniff.mime, ext);
      return {
        file,
        objectUrl,
        kind: CropMediaKind.VIDEO,
        displayName: file.name,
        mimeType: sniff.mime || 'video/mp4',
        containerLabel,
        codecLabel: containerLabel === 'WebM' ? 'VP9 / VP8' : 'H.264 / HEVC',
        audioCodecLabel: 'Audio Track',
        rawWidth: meta.width,
        rawHeight: meta.height,
        rotationDegrees: 0,
        displayWidth: meta.width,
        displayHeight: meta.height,
        durationMs: meta.durationMs,
        frameRate: 30,
        bitrateBps:
          meta.durationMs > 0
            ? Math.max(100_000, Math.round((file.size * 8 * 1000) / meta.durationMs))
            : null,
        fileSizeBytes: file.size,
        colorInfoLabel: 'BT.709 (SDR)',
      };
    } catch {
      URL.revokeObjectURL(objectUrl);
      return null;
    }
  }
}

export function evaluateCropFeasibility(
  inspection: MediaInspectionResult,
  cropRect: NormalizedCropRect,
): CropFeasibilityResult {
  if (isFullFrameCrop(cropRect)) {
    if (inspection.kind === CropMediaKind.PHOTO) {
      return {
        type: 'original_copy',
        summary: `Full-frame selection allows 1:1 original file copy (${inspection.containerLabel}) with zero decode or re-encode.`,
      };
    }
    return {
      type: 'original_copy',
      summary: `Full-frame selection allows 1:1 original bitstream copy (${inspection.containerLabel} · ${inspection.codecLabel}) with zero transcode.`,
    };
  }

  if (inspection.kind === CropMediaKind.PHOTO) {
    const rawCrop = CropCoordinateMapper.toDisplayPixelRect(
      cropRect,
      inspection.displayWidth,
      inspection.displayHeight,
      false,
    );
    return {
      type: 'requires_consent',
      title: 'Photo Crop Export Confirmation',
      reason: `Cropping a sub-region (${rawCrop.width}×${rawCrop.height} from ${inspection.displayWidth}×${inspection.displayHeight}) of a ${inspection.containerLabel} photo requires decoding pixels and encoding into a new _cropped image file.`,
      technicalDetails: [
        `Source Format: ${inspection.containerLabel} (${inspection.mimeType})`,
        `Codec / Decoder: ${inspection.codecLabel}`,
        `Source: ${inspection.displayWidth}×${inspection.displayHeight} px · Rot ${inspection.rotationDegrees}°`,
        `Crop Target: ${rawCrop.width}×${rawCrop.height} px (EXIF preserved)`,
        ...(inspection.colorInfoLabel ? [`Color Profile: ${inspection.colorInfoLabel}`] : []),
      ],
    };
  }

  const cropped = CropCoordinateMapper.toDisplayPixelRect(
    cropRect,
    inspection.displayWidth,
    inspection.displayHeight,
    true,
  );
  return {
    type: 'requires_consent',
    title: 'Video Rendering & Re-Encoding Required',
    reason: `Non-rendering bitstream cropping (${cropped.width}×${cropped.height} from ${inspection.displayWidth}×${inspection.displayHeight}) is not supported by ${inspection.containerLabel} (${inspection.codecLabel}) without decoding and re-encoding.`,
    technicalDetails: [
      `Source Container: ${inspection.containerLabel} (${inspection.mimeType})`,
      `Video Codec: ${inspection.codecLabel}`,
      ...(inspection.audioCodecLabel
        ? [`Audio Track: ${inspection.audioCodecLabel} (preserved when supported)`]
        : []),
      `Source: ${inspection.displayWidth}×${inspection.displayHeight} px${
        inspection.frameRate ? ` · ${inspection.frameRate} FPS` : ''
      }`,
      ...(inspection.bitrateBps
        ? [`Source Bitrate: ${(inspection.bitrateBps / 1_000_000).toFixed(1)} Mbps`]
        : []),
      `Crop Area: ${cropped.width}×${cropped.height} px`,
    ],
  };
}

export function formatMediaSize(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;
  if (bytes >= gb) return `${(bytes / gb).toFixed(2)} GB`;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / kb))} KB`;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatDateShort(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
