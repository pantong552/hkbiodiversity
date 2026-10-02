import {
  AnatomyIllustration,
  AnatomyImageRect,
  AnatomyMarker
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
  if (!value || typeof value.id !== 'string' || !value.id.trim()) return false;
  if (typeof value.titleZh !== 'string' || typeof value.titleEn !== 'string') return false;
  if (typeof value.photoUrl !== 'string' || !isAllowedAnatomyImageUrl(value.photoUrl) || !Array.isArray(value.markers)) return false;
  if (typeof value.photoAttribution !== 'string' || typeof value.photoLink !== 'string') return false;
  if (value.photoLink && !/^https:\/\/(www\.)?inaturalist\.org\//i.test(value.photoLink)) return false;
  if (!Number.isFinite(value.zoom) || value.zoom < 1 || value.zoom > 4) return false;
  if (!Number.isFinite(value.offsetX) || Math.abs(value.offsetX) > 100) return false;
  if (!Number.isFinite(value.offsetY) || Math.abs(value.offsetY) > 100) return false;

  const keys = new Set<string>();
  return value.markers.every((marker) => {
    if (!marker || typeof marker.key !== 'string' || !marker.key.trim() || marker.key.length > 50 || keys.has(marker.key.trim())) return false;
    if (!Number.isFinite(marker.x) || !Number.isFinite(marker.y)) return false;
    if (marker.x < 0 || marker.x > 100 || marker.y < 0 || marker.y > 100) return false;
    const hasAnchor = marker.anchorX !== undefined || marker.anchorY !== undefined;
    if (hasAnchor && (
      typeof marker.anchorX !== 'number' || !Number.isFinite(marker.anchorX) ||
      typeof marker.anchorY !== 'number' || !Number.isFinite(marker.anchorY) ||
      marker.anchorX < 0 || marker.anchorX > 100 ||
      marker.anchorY < 0 || marker.anchorY > 100
    )) return false;
    if (typeof marker.zh !== 'string' || typeof marker.en !== 'string') return false;
    keys.add(marker.key.trim());
    return true;
  });
}

export function isValidAnatomyIllustrations(illustrations: AnatomyIllustration[]): boolean {
  if (!Array.isArray(illustrations)) return false;
  const ids = new Set<string>();
  return illustrations.every((illustration) => {
    if (!isValidAnatomyIllustration(illustration) || ids.has(illustration.id)) return false;
    ids.add(illustration.id);
    return true;
  });
}

export function normalizeAnatomyMarkers(markers: AnatomyMarker[]): AnatomyMarker[] {
  return markers.map((marker, index) => ({ ...marker, key: String(index + 1) }));
}

export function fitAnatomyImage(frameWidth: number, frameHeight: number, imageWidth: number, imageHeight: number) {
  if (frameWidth <= 0 || frameHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  return { width: imageWidth * scale, height: imageHeight * scale };
}

export function getAnatomyPanLimits(frameWidth: number, frameHeight: number, imageWidth: number, imageHeight: number, zoom: number) {
  return {
    x: imageWidth > 0 ? Math.max(0, ((imageWidth * zoom - frameWidth) / (2 * imageWidth)) * 100) : 0,
    y: imageHeight > 0 ? Math.max(0, ((imageHeight * zoom - frameHeight) / (2 * imageHeight)) * 100) : 0
  };
}

export function clampAnatomyPan(offsetX: number, offsetY: number, limits: { x: number; y: number }) {
  return {
    offsetX: Math.max(-limits.x, Math.min(limits.x, offsetX)),
    offsetY: Math.max(-limits.y, Math.min(limits.y, offsetY))
  };
}

export function getAnatomyZoomPan(
  currentZoom: number,
  nextZoom: number,
  cursorOffsetX: number,
  cursorOffsetY: number,
  imageWidth: number,
  imageHeight: number,
  offsetX: number,
  offsetY: number,
  limits: { x: number; y: number }
) {
  const nextOffsetX = offsetX + ((currentZoom - nextZoom) * cursorOffsetX / imageWidth) * 100;
  const nextOffsetY = offsetY + ((currentZoom - nextZoom) * cursorOffsetY / imageHeight) * 100;
  return clampAnatomyPan(nextOffsetX, nextOffsetY, limits);
}

export function getAnatomyPanOffset(currentOffset: number, pointerDelta: number, imageLength: number, zoom: number) {
  if (imageLength <= 0 || zoom <= 0) return currentOffset;
  return currentOffset + (pointerDelta / (imageLength * zoom)) * 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRawMarker(value: unknown): value is Record<string, unknown> & { key: string } {
  return isRecord(value) && typeof value.key === 'string';
}

export function mapAnatomyIllustration(row: unknown, fallbackId = 'illustration-1'): AnatomyIllustration {
  const source = isRecord(row) ? row : {};
  const markers = Array.isArray(source.markers) ? source.markers.filter(isRawMarker) : [];
  const getString = (camelKey: string, snakeKey: string, fallback = '') => {
    const value = source[camelKey] ?? source[snakeKey];
    return typeof value === 'string' ? value : fallback;
  };
  const getNumber = (camelKey: string, snakeKey: string, fallback: number) => {
    const value = source[camelKey] ?? source[snakeKey];
    return value === undefined || value === null ? fallback : Number(value);
  };
  return {
    id: getString('id', 'id', fallbackId),
    titleZh: getString('titleZh', 'title_zh'),
    titleEn: getString('titleEn', 'title_en'),
    photoUrl: getString('photoUrl', 'photo_url'),
    photoAttribution: getString('photoAttribution', 'photo_attribution'),
    photoLink: getString('photoLink', 'photo_link'),
    zoom: getNumber('zoom', 'image_zoom', 1),
    offsetX: getNumber('offsetX', 'image_offset_x', 0),
    offsetY: getNumber('offsetY', 'image_offset_y', 0),
    markers: normalizeAnatomyMarkers(markers
      .map((marker): AnatomyMarker => ({
        key: marker.key,
        x: Number(marker.x),
        y: Number(marker.y),
        anchorX: marker.anchorX !== undefined && marker.anchorX !== null && Number.isFinite(Number(marker.anchorX)) ? Number(marker.anchorX) : Number(marker.x),
        anchorY: marker.anchorY !== undefined && marker.anchorY !== null && Number.isFinite(Number(marker.anchorY)) ? Number(marker.anchorY) : Number(marker.y),
        placement: typeof marker.placement === 'string' ? marker.placement : 'top',
        zh: typeof marker.zh === 'string' ? marker.zh : '',
        en: typeof marker.en === 'string' ? marker.en : ''
      }))
      .filter((marker: AnatomyMarker) =>
        Number.isFinite(marker.x) && marker.x >= 0 && marker.x <= 100 &&
        Number.isFinite(marker.y) && marker.y >= 0 && marker.y <= 100
      ))
  };
}

export function mapAnatomyIllustrations(row: unknown): AnatomyIllustration[] {
  if (!isRecord(row)) return [];
  if (Array.isArray(row.illustrations)) {
    return row.illustrations.map((illustration, index) =>
      mapAnatomyIllustration(illustration, `illustration-${index + 1}`)
    );
  }

  const legacyIllustration = mapAnatomyIllustration(row);
  return legacyIllustration.photoUrl || legacyIllustration.markers.length > 0 ? [legacyIllustration] : [];
}

export function anatomyIllustrationToDatabase(illustration: AnatomyIllustration) {
  return {
    id: illustration.id,
    title_zh: illustration.titleZh,
    title_en: illustration.titleEn,
    photo_url: illustration.photoUrl,
    photo_attribution: illustration.photoAttribution,
    photo_link: illustration.photoLink,
    markers: illustration.markers,
    image_zoom: illustration.zoom,
    image_offset_x: illustration.offsetX,
    image_offset_y: illustration.offsetY
  };
}

export function anatomyIllustrationToLegacyColumns(illustration: AnatomyIllustration) {
  const databaseIllustration = anatomyIllustrationToDatabase(illustration);
  return {
    title_zh: databaseIllustration.title_zh,
    title_en: databaseIllustration.title_en,
    photo_url: databaseIllustration.photo_url,
    photo_attribution: databaseIllustration.photo_attribution,
    photo_link: databaseIllustration.photo_link,
    markers: databaseIllustration.markers,
    image_zoom: databaseIllustration.image_zoom,
    image_offset_x: databaseIllustration.image_offset_x,
    image_offset_y: databaseIllustration.image_offset_y
  };
}

export function getAnatomyCoordinates(clientX: number, clientY: number, rect: AnatomyImageRect) {
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: Math.round(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)) * 10) / 10,
    y: Math.round(Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)) * 10) / 10
  };
}