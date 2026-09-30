import {
  AnatomyIllustration,
  AnatomyImageRect,
  AnatomyMarker,
  EMPTY_ANATOMY_ILLUSTRATION
} from '../types/anatomy';

export function isAllowedAnatomyImageUrl(value: string): boolean {
  const url = value.trim();
  if (!url) return true;
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) return true;

  try {
    const parsedUrl = new URL(url);
    const allowedHosts = new Set([
      'images.unsplash.com',
      'res.cloudinary.com',
      'picsum.photos',
      'lh3.googleusercontent.com',
      'inaturalist-open-data.s3.amazonaws.com'
    ]);
    return parsedUrl.protocol === 'https:' && (
      allowedHosts.has(parsedUrl.hostname) || parsedUrl.hostname.endsWith('.inaturalist.org')
    );
  } catch {
    return false;
  }
}

export function isValidAnatomyIllustration(value: AnatomyIllustration): boolean {
  if (!value || typeof value.photoUrl !== 'string' || !isAllowedAnatomyImageUrl(value.photoUrl) || !Array.isArray(value.markers)) return false;

  const keys = new Set<string>();
  return value.markers.every((marker) => {
    if (!marker || typeof marker.key !== 'string' || !marker.key.trim() || marker.key.length > 50 || keys.has(marker.key.trim())) return false;
    if (!Number.isFinite(marker.x) || !Number.isFinite(marker.y)) return false;
    if (marker.x < 0 || marker.x > 100 || marker.y < 0 || marker.y > 100) return false;
    if (typeof marker.zh !== 'string' || typeof marker.en !== 'string') return false;
    keys.add(marker.key.trim());
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRawMarker(value: unknown): value is Record<string, unknown> & { key: string } {
  return isRecord(value) && typeof value.key === 'string';
}

export function mapAnatomyIllustration(row: unknown): AnatomyIllustration {
  if (!isRecord(row)) return EMPTY_ANATOMY_ILLUSTRATION;

  const markers = Array.isArray(row.markers) ? row.markers.filter(isRawMarker) : [];
  return {
    photoUrl: typeof row.photo_url === 'string' ? row.photo_url : '',
    markers: markers
      .map((marker): AnatomyMarker => ({
        key: marker.key,
        x: Number(marker.x),
        y: Number(marker.y),
        placement: typeof marker.placement === 'string' ? marker.placement : 'top',
        zh: typeof marker.zh === 'string' ? marker.zh : '',
        en: typeof marker.en === 'string' ? marker.en : ''
      }))
      .filter((marker: AnatomyMarker) =>
        Number.isFinite(marker.x) && marker.x >= 0 && marker.x <= 100 &&
        Number.isFinite(marker.y) && marker.y >= 0 && marker.y <= 100
      )
  };
}

export function getAnatomyCoordinates(clientX: number, clientY: number, rect: AnatomyImageRect) {
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: Math.round(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)) * 10) / 10,
    y: Math.round(Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)) * 10) / 10
  };
}