'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, BookOpen, ChevronLeft, ChevronRight, ExternalLink, Loader2, Mouse, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/utils/supabase/client';
import { useInaturalistSpeciesPhotos } from '@/hooks/useInaturalistSpeciesPhotos';
import { AnatomyIllustration, AnatomyMarker, EMPTY_ANATOMY_ILLUSTRATION } from '@/types/anatomy';
import { clampAnatomyPan, fitAnatomyImage, getAnatomyCoordinates, getAnatomyPanLimits, getAnatomyPanOffset, getAnatomyZoomPan, isAllowedAnatomyImageUrl, mapAnatomyIllustrations, normalizeAnatomyMarkers } from '@/utils/anatomy';

interface SpeciesAnatomyCardProps {
  tableName: string;
  speciesTaxaId: string;
  refreshKey?: number;
}

interface SpeciesAnatomyEditorProps {
  value: AnatomyIllustration;
  inatId?: number | string;
  taxaId?: string;
  disabled?: boolean;
  onChange: (value: AnatomyIllustration) => void;
}

function useFittedAnatomyImage(photoUrl: string) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [loadedImage, setLoadedImage] = useState<{ url: string; width: number; height: number } | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      setFrameSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [photoUrl]);

  const naturalWidth = loadedImage?.url === photoUrl ? loadedImage.width : 0;
  const naturalHeight = loadedImage?.url === photoUrl ? loadedImage.height : 0;
  const imageSize = fitAnatomyImage(frameSize.width, frameSize.height, naturalWidth, naturalHeight);
  const onImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setLoadedImage({ url: photoUrl, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
  };

  return { frameRef, frameSize, imageSize, onImageLoad };
}

export function SpeciesAnatomyEditor({ value, inatId, taxaId, disabled = false, onChange }: SpeciesAnatomyEditorProps) {
  const { language } = useLanguage();
  const { photos, isLoading: photosLoading, hasMore, loadMore } = useInaturalistSpeciesPhotos(inatId, taxaId);
  const { frameRef, frameSize, imageSize, onImageLoad } = useFittedAnatomyImage(value.photoUrl);
  const imagePlaneRef = useRef<HTMLDivElement>(null);
  const draggingKeyRef = useRef<string | null>(null);
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const pointerStartedOnImageRef = useRef(false);
  const suppressImageClickRef = useRef(false);
  const [activeKey, setActiveKey] = useState<string | null>(value.markers[0]?.key || null);
  const [imageErrorUrl, setImageErrorUrl] = useState<string | null>(null);
  const isZh = language === 'zh';
  const imageUrlAllowed = isAllowedAnatomyImageUrl(value.photoUrl);
  const imageError = imageErrorUrl === value.photoUrl;

  const updateMarker = (key: string, changes: Partial<AnatomyMarker>) => {
    onChange({ ...value, markers: value.markers.map((marker) => marker.key === key ? { ...marker, ...changes } : marker) });
  };

  const addMarker = (clientX?: number, clientY?: number) => {
    const point = clientX !== undefined && clientY !== undefined && imagePlaneRef.current
      ? getAnatomyCoordinates(clientX, clientY, imagePlaneRef.current.getBoundingClientRect())
      : { x: 50, y: 50 };
    const marker: AnatomyMarker = {
      key: '',
      x: point.x,
      y: point.y,
      placement: 'top',
      zh: '',
      en: ''
    };
    const markers = normalizeAnatomyMarkers([...value.markers, marker]);
    onChange({ ...value, markers });
    setActiveKey(markers[markers.length - 1].key);
  };

  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const startedOnImage = pointerStartedOnImageRef.current;
    pointerStartedOnImageRef.current = false;
    if (suppressImageClickRef.current) {
      suppressImageClickRef.current = false;
      return;
    }
    if (disabled || !startedOnImage || !imagePlaneRef.current) return;
    addMarker(event.clientX, event.clientY);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (disabled || !target.closest('[data-image-plane]') || target.closest('[data-anatomy-marker]')) return;
    pointerStartedOnImageRef.current = true;
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: value.offsetX,
      offsetY: value.offsetY,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const key = draggingKeyRef.current;
    if (key && imagePlaneRef.current) {
      updateMarker(key, getAnatomyCoordinates(event.clientX, event.clientY, imagePlaneRef.current.getBoundingClientRect()));
      return;
    }

    const start = panStartRef.current;
    if (!start || !imageSize.width || !imageSize.height) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) start.moved = true;
    if (start.moved) suppressImageClickRef.current = true;

    const limits = getAnatomyPanLimits(frameSize.width, frameSize.height, imageSize.width, imageSize.height, value.zoom);
    const offsets = clampAnatomyPan(
      getAnatomyPanOffset(start.offsetX, deltaX, imageSize.width, value.zoom),
      getAnatomyPanOffset(start.offsetY, deltaY, imageSize.height, value.zoom),
      limits
    );
    onChange({ ...value, ...offsets });
  };

  const handlePointerUp = () => {
    draggingKeyRef.current = null;
    panStartRef.current = null;
  };

  const handlePointerCancel = () => {
    pointerStartedOnImageRef.current = false;
    suppressImageClickRef.current = false;
    handlePointerUp();
  };

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const handleWheel = (event: WheelEvent) => {
      if (disabled || !imageSize.width || !imageSize.height) return;
      event.preventDefault();
      const nextZoom = Math.max(1, Math.min(4, value.zoom * Math.exp(-event.deltaY * 0.001)));
      if (nextZoom === value.zoom) return;
      const frameRect = frame.getBoundingClientRect();
      const cursorOffsetX = event.clientX - (frameRect.left + frameRect.width / 2);
      const cursorOffsetY = event.clientY - (frameRect.top + frameRect.height / 2);
      const limits = getAnatomyPanLimits(frameRect.width, frameRect.height, imageSize.width, imageSize.height, nextZoom);
      const offsets = getAnatomyZoomPan(
        value.zoom,
        nextZoom,
        cursorOffsetX,
        cursorOffsetY,
        imageSize.width,
        imageSize.height,
        value.offsetX,
        value.offsetY,
        limits
      );
      onChange({ ...value, zoom: nextZoom, ...offsets });
    };

    frame.addEventListener('wheel', handleWheel, { passive: false });
    return () => frame.removeEventListener('wheel', handleWheel);
  }, [disabled, frameRef, imageError, imageSize.height, imageSize.width, imageUrlAllowed, onChange, value]);

  const changePhoto = (photoUrl: string, photoAttribution = '', photoLink = '') => {
    onChange({ ...value, photoUrl, photoAttribution, photoLink, zoom: 1, offsetX: 0, offsetY: 0 });
  };

  const removeMarker = (key: string) => {
    const markerIndex = value.markers.findIndex((marker) => marker.key === key);
    const markers = normalizeAnatomyMarkers(value.markers.filter((marker) => marker.key !== key));
    onChange({ ...value, markers });
    setActiveKey(markers[Math.min(markerIndex, markers.length - 1)]?.key || null);
  };

  const labelClass = 'mb-1 block text-[11px] font-bold text-slate-500';
  const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label>
          <span className={labelClass}>Title（繁體中文）</span>
          <input
            value={value.titleZh}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, titleZh: event.target.value })}
            placeholder="輸入圖鑑標題"
            className={inputClass}
          />
        </label>
        <label>
          <span className={labelClass}>Title (English)</span>
          <input
            value={value.titleEn}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, titleEn: event.target.value })}
            placeholder="Enter illustration title"
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>{isZh ? '特徵插圖圖片 URL' : 'Illustration image URL'}</span>
        <input
          type="text"
          value={value.photoUrl}
          disabled={disabled}
          onChange={(event) => changePhoto(event.target.value)}
          placeholder="https://… or /images/…"
          className={inputClass}
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className={labelClass}>{isZh ? '從物種照片選擇' : 'Choose from species photos'}</span>
          {photos.length > 0 && <span className="text-[10px] text-slate-400">{photos.length}</span>}
        </div>
        {photosLoading && photos.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-xs text-slate-500"><Loader2 className="size-3.5 animate-spin" />{isZh ? '載入 iNaturalist 照片…' : 'Loading iNaturalist photos…'}</div>
        ) : photos.length === 0 ? (
          <p className="py-2 text-xs text-slate-400">{isZh ? '目前沒有可選照片；你仍可輸入自訂 URL。' : 'No selectable photos found. You can still enter a custom URL.'}</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.map((photo) => {
              const photoUrl = photo.large_url || photo.medium_url || photo.url;
              const isSelected = value.photoUrl === photoUrl;
              return (
                <button
                  key={photo.id}
                  type="button"
                  disabled={disabled}
                  aria-label={`${isZh ? '選擇照片' : 'Select photo'}: ${photo.attribution}`}
                  aria-pressed={isSelected}
                  title={photo.attribution}
                  onClick={() => changePhoto(photoUrl, photo.attribution, photo.observationUrl || photo.nativePageUrl || '')}
                  className={`relative size-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition ${isSelected ? 'border-emerald-600 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-emerald-400'} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <Image
                    src={photo.small_url || photoUrl}
                    alt={photo.attribution}
                    fill
                    sizes="64px"
                    unoptimized={(photo.small_url || photoUrl).includes('/api/image/transform')}
                    className="object-cover"
                  />
                </button>
              );
            })}
            {hasMore && (
              <button
                type="button"
                disabled={photosLoading || disabled}
                onClick={loadMore}
                className="flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-[9px] font-bold text-slate-500 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50"
              >
                {photosLoading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {isZh ? '更多' : 'More'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {value.photoUrl && imageUrlAllowed && !imageError ? (
          <>
            <div
              ref={frameRef}
              className="relative mx-auto aspect-[4/3] w-full max-w-[820px] touch-none overflow-hidden rounded-[2rem] bg-slate-900 sm:rounded-[2.5rem]"
              onClick={handleImageClick}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              style={{ overscrollBehavior: 'contain' }}
            >
              <div
                ref={imagePlaneRef}
                data-image-plane
                className="absolute left-1/2 top-1/2 origin-center"
                style={{
                  width: imageSize.width || frameSize.width,
                  height: imageSize.height || frameSize.height,
                  transform: `translate(calc(-50% + ${value.offsetX}%), calc(-50% + ${value.offsetY}%)) scale(${value.zoom})`
                }}
              >
                <img
                  src={value.photoUrl}
                  alt={isZh ? '特徵插圖預覽' : 'Anatomy illustration preview'}
                  className={`block size-full select-none ${imageSize.width ? 'object-fill' : 'object-contain opacity-0'}`}
                  draggable={false}
                  onLoad={onImageLoad}
                  onError={() => setImageErrorUrl(value.photoUrl)}
                />
                {imageSize.width > 0 && value.markers.map((marker) => (
                    <button
                      key={marker.key}
                      type="button"
                      data-anatomy-marker
                      disabled={disabled}
                      aria-label={`${isZh ? '移動標記' : 'Move marker'} ${marker.key}`}
                      onPointerDown={(event) => {
                        if (disabled) return;
                        event.preventDefault();
                        event.stopPropagation();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        draggingKeyRef.current = marker.key;
                        setActiveKey(marker.key);
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveKey(marker.key);
                      }}
                      style={{ left: `${marker.x}%`, top: `${marker.y}%`, scale: 1 / value.zoom, touchAction: 'none' }}
                      className={`absolute z-10 grid size-5 sm:size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border sm:border-2 text-[9px] sm:text-xs font-black shadow-md ${activeKey === marker.key ? 'border-emerald-700 bg-emerald-600 text-white' : 'border-white bg-white text-slate-800'} disabled:cursor-default`}
                    >
                      {marker.key}
                    </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <Mouse className="size-4 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 text-xs text-slate-600">{isZh ? '游標移到相框內，滾動滑鼠滾輪縮放' : 'Hover over the frame and scroll to zoom'}</span>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">{Math.round(value.zoom * 100)}%</span>
              <button
                type="button"
                disabled={disabled || (value.zoom === 1 && value.offsetX === 0 && value.offsetY === 0)}
                onClick={() => onChange({ ...value, zoom: 1, offsetX: 0, offsetY: 0 })}
                title={isZh ? '重設圖片位置與縮放' : 'Reset image position and zoom'}
                aria-label={isZh ? '重設圖片位置與縮放' : 'Reset image position and zoom'}
                className="grid size-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-40"
              >
                <RotateCcw className="size-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
            {imageError ? <AlertCircle className="size-5 text-rose-500" /> : null}
            <span>{!imageUrlAllowed && value.photoUrl ? (isZh ? '圖片 URL 不在允許的來源清單內。' : 'This image URL is not from an allowed image source.') : imageError ? (isZh ? '圖片無法載入，請檢查 URL。' : 'Image failed to load. Check the URL.') : (isZh ? '輸入圖片 URL 後即可在圖片上點擊新增標記。' : 'Add an image URL to place markers on the illustration.')}</span>
          </div>
        )}
        {value.photoUrl && !imageError && imageUrlAllowed && (
          <p className="text-center text-[11px] text-slate-500">
            {isZh ? '拖曳插圖調整位置；點擊圖片新增標記，拖曳編號移動標記。' : 'Drag the image to pan, click to add a marker, or drag a number to move it.'}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-slate-800">
          {isZh ? '特徵標記' : 'Anatomy markers'} <span className="font-medium text-slate-400">({value.markers.length})</span>
        </h3>
        <button
          type="button"
          disabled={disabled}
          onClick={() => addMarker()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          <Plus className="size-3.5" />{isZh ? '新增標記' : 'Add marker'}
        </button>
      </div>

      {value.markers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
          {isZh ? '目前沒有標記。點擊插圖或新增標記即可開始。' : 'There are no markers yet. Click the image or add a marker to begin.'}
        </p>
      ) : (
        <div className="space-y-3">
          {value.markers.map((marker) => (
            <section key={marker.key} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-full bg-emerald-100 text-xs font-black text-emerald-800">{marker.key}</span>
                  <span className="text-xs font-bold text-slate-600">{isZh ? `標記 ${marker.key}` : `Marker ${marker.key}`}</span>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeMarker(marker.key)}
                  title={isZh ? '刪除標記' : 'Delete marker'}
                  aria-label={`${isZh ? '刪除標記' : 'Delete marker'} ${marker.key}`}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label>
                  <span className={labelClass}>繁體中文</span>
                  <textarea rows={3} value={marker.zh} disabled={disabled} onChange={(event) => updateMarker(marker.key, { zh: event.target.value })} className={`${inputClass} resize-y`} />
                </label>
                <label>
                  <span className={labelClass}>English</span>
                  <textarea rows={3} value={marker.en} disabled={disabled} onChange={(event) => updateMarker(marker.key, { en: event.target.value })} className={`${inputClass} resize-y`} />
                </label>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

interface SpeciesAnatomyCollectionEditorProps {
  value: AnatomyIllustration[];
  inatId?: number | string;
  taxaId?: string;
  disabled?: boolean;
  onChange: (value: AnatomyIllustration[]) => void;
}

export function SpeciesAnatomyCollectionEditor({ value, inatId, taxaId, disabled = false, onChange }: SpeciesAnatomyCollectionEditorProps) {
  const { language } = useLanguage();
  const [activeId, setActiveId] = useState(value[0]?.id || '');
  const activeIllustration = value.find((illustration) => illustration.id === activeId) || value[0] || null;
  const isZh = language === 'zh';

  const addIllustration = () => {
    let index = value.length + 1;
    while (value.some((illustration) => illustration.id === `illustration-${index}`)) index += 1;
    const illustration = { ...EMPTY_ANATOMY_ILLUSTRATION, id: `illustration-${index}` };
    onChange([...value, illustration]);
    setActiveId(illustration.id);
  };

  const removeIllustration = (id: string) => {
    const index = value.findIndex((illustration) => illustration.id === id);
    const remaining = value.filter((illustration) => illustration.id !== id);
    onChange(remaining);
    setActiveId(remaining[Math.min(index, remaining.length - 1)]?.id || '');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {value.map((illustration, index) => {
          const title = (isZh ? illustration.titleZh || illustration.titleEn : illustration.titleEn || illustration.titleZh).trim();
          return (
          <div key={illustration.id} className={`flex items-center rounded-lg border ${activeIllustration?.id === illustration.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <button
              type="button"
              role="tab"
              aria-selected={activeIllustration?.id === illustration.id}
              onClick={() => setActiveId(illustration.id)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700"
            >
              <span className="grid size-5 place-items-center rounded-full bg-emerald-100 text-[10px] text-emerald-800">{index + 1}</span>
              {title || `${isZh ? '圖片' : 'Image'} ${index + 1}`}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeIllustration(illustration.id)}
              title={isZh ? `刪除圖片 ${index + 1}` : `Remove image ${index + 1}`}
              aria-label={isZh ? `刪除圖片 ${index + 1}` : `Remove image ${index + 1}`}
              className="mr-1 grid size-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          onClick={addIllustration}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          <Plus className="size-3.5" />{isZh ? '新增圖片' : 'Add image'}
        </button>
      </div>

      {activeIllustration ? (
        <SpeciesAnatomyEditor
          value={activeIllustration}
          inatId={inatId}
          taxaId={taxaId}
          disabled={disabled}
          onChange={(nextIllustration) => onChange(value.map((illustration) => illustration.id === activeIllustration.id ? nextIllustration : illustration))}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          {isZh ? '尚未新增特徵圖片。' : 'No anatomy images have been added.'}
        </div>
      )}
    </div>
  );
}

function AnatomyIllustrationDisplay({ illustration, isZh, title }: { illustration: AnatomyIllustration; isZh: boolean; title: string }) {
  const { frameRef, frameSize, imageSize, onImageLoad } = useFittedAnatomyImage(illustration.photoUrl);
  const [imageError, setImageError] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  if (!isAllowedAnatomyImageUrl(illustration.photoUrl)) {
    return <div role="alert" className="flex min-h-32 items-center justify-center gap-2 text-sm text-rose-700"><AlertCircle className="size-4" />{isZh ? '插圖來源不受支援。' : 'The illustration source is not allowed.'}</div>;
  }
  if (imageError) {
    return <div role="alert" className="flex min-h-32 items-center justify-center gap-2 text-sm text-rose-700"><AlertCircle className="size-4" />{isZh ? '插圖無法載入。' : 'The illustration could not be loaded.'}</div>;
  }

  return (
    <div className="space-y-3">
      <div ref={frameRef} className="relative mx-auto aspect-[4/3] w-full max-w-[820px] overflow-hidden rounded-[2rem] bg-slate-900 sm:rounded-[2.5rem]" onClick={() => { setActiveKey(null); setHoveredKey(null); }}>
        <div
          className="absolute left-1/2 top-1/2 origin-center"
          style={{
            width: imageSize.width || frameSize.width,
            height: imageSize.height || frameSize.height,
            transform: `translate(calc(-50% + ${illustration.offsetX}%), calc(-50% + ${illustration.offsetY}%)) scale(${illustration.zoom})`
          }}
        >
          <img src={illustration.photoUrl} alt={isZh ? '物種特徵插圖' : 'Species anatomy illustration'} className={`block size-full select-none ${imageSize.width ? 'object-fill' : 'object-contain opacity-0'}`} onLoad={onImageLoad} onError={() => setImageError(true)} />
          {imageSize.width > 0 && illustration.markers.map((marker) => {
            const selected = marker.key === hoveredKey || marker.key === activeKey;
            return (
              <button
                key={marker.key}
                type="button"
                aria-label={`${isZh ? '特徵標記' : 'Anatomy marker'} ${marker.key}`}
                title={marker.key}
                onMouseEnter={() => setHoveredKey(marker.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(marker.key)}
                onBlur={() => setHoveredKey(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveKey(activeKey === marker.key ? null : marker.key);
                }}
                style={{ left: `${marker.x}%`, top: `${marker.y}%`, scale: 1 / illustration.zoom }}
                className={`absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-[9px] shadow-md transition-colors sm:size-7 sm:border-2 sm:text-xs ${selected ? 'border-emerald-700 bg-emerald-600 text-white' : 'border-white bg-white text-slate-800'}`}
              >{marker.key}</button>
            );
          })}
        </div>
        {illustration.photoAttribution && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <p className="min-w-0 truncate text-xs font-bold text-white drop-shadow-md sm:text-sm">{illustration.photoAttribution}</p>
              {illustration.photoLink && (
                <a
                  href={illustration.photoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={isZh ? '開啟 iNaturalist 照片/觀察' : 'Open iNaturalist photo/observation'}
                  title={isZh ? '在 iNaturalist 查看' : 'View on iNaturalist'}
                  className="pointer-events-auto shrink-0 rounded-lg border border-white/20 bg-white/10 p-1.5 text-white backdrop-blur-md transition-all hover:bg-emerald-500 active:scale-95"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      <h3 className="px-2 pt-1 text-center text-base font-bold text-slate-800 sm:text-lg">{title}</h3>
      {illustration.markers.length > 0 && (
        <div className="grid grid-cols-1 gap-x-3 gap-y-4 pt-1 sm:grid-cols-2 xl:grid-cols-3">
          {illustration.markers.map((marker) => {
            const isHighlighted = marker.key === hoveredKey || marker.key === activeKey;
            return (
              <article
                key={marker.key}
                onMouseEnter={() => setHoveredKey(marker.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className={`relative rounded-lg border px-3 pb-3 pt-4 transition-colors ${isHighlighted ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-200 bg-white'}`}
              >
                <span className={`absolute -top-2 left-3 px-1.5 text-[10px] font-bold leading-4 ${isHighlighted ? 'bg-emerald-50 text-emerald-800' : 'bg-white text-slate-500'}`}>No. {marker.key}</span>
                <p className={`whitespace-pre-wrap text-sm leading-relaxed ${isHighlighted ? 'text-slate-900' : 'text-slate-700'}`}>{isZh ? marker.zh : marker.en}</p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SpeciesAnatomyCard({ tableName, speciesTaxaId, refreshKey = 0 }: SpeciesAnatomyCardProps) {
  const { language } = useLanguage();
  const supabase = createClient();
  const [illustrations, setIllustrations] = useState<AnatomyIllustration[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const isZh = language === 'zh';

  useEffect(() => {
    let cancelled = false;
    async function loadIllustration() {
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase
        .from('species_anatomy_illustrations')
        .select('illustrations, photo_url, photo_attribution, photo_link, markers, image_zoom, image_offset_x, image_offset_y')
        .eq('table_name', tableName)
        .eq('species_taxa_id', speciesTaxaId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError(true);
      } else {
        setIllustrations(mapAnatomyIllustrations(data));
        setActiveImageIndex(0);
      }
      setLoading(false);
    }
    loadIllustration();
    return () => { cancelled = true; };
  }, [speciesTaxaId, tableName, refreshKey, supabase]);

  const currentImageIndex = Math.min(activeImageIndex, Math.max(illustrations.length - 1, 0));
  const currentIllustration = illustrations[currentImageIndex];
  const currentTitle = currentIllustration
    ? (isZh ? currentIllustration.titleZh || currentIllustration.titleEn : currentIllustration.titleEn || currentIllustration.titleZh).trim()
    : '';

  const showImage = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= illustrations.length || nextIndex === currentImageIndex) return;
    setSlideDirection(nextIndex > currentImageIndex ? 1 : -1);
    setActiveImageIndex(nextIndex);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-center gap-2 sm:gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 sm:size-10 sm:rounded-2xl">
          <BookOpen className="size-4 text-emerald-500 sm:size-5" />
        </div>
        <h2 className="truncate text-xl font-black text-slate-800 sm:text-2xl">{isZh ? '互動特徵圖鑑' : 'Interactive Anatomy'}</h2>
      </div>

      {loading ? (
        <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />{isZh ? '載入圖鑑…' : 'Loading illustration…'}</div>
      ) : loadError ? (
        <div role="alert" className="flex min-h-32 items-center justify-center gap-2 text-sm text-rose-700"><AlertCircle className="size-4" />{isZh ? '圖鑑載入失敗，請稍後重試。' : 'Could not load the illustration. Please try again later.'}</div>
      ) : illustrations.length === 0 ? (
        <div className="flex min-h-28 items-center justify-center text-sm text-slate-400">{isZh ? '此物種尚未提供特徵插圖。' : 'No anatomy illustration is available for this species yet.'}</div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden">
            <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
              <motion.div
                key={currentIllustration.id}
                custom={slideDirection}
                initial={{ opacity: 0, x: slideDirection * 48 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: slideDirection * -48 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="space-y-3"
              >
                <AnatomyIllustrationDisplay
                  illustration={currentIllustration}
                  isZh={isZh}
                  title={currentTitle || (isZh ? `圖鑑圖片 ${currentImageIndex + 1}` : `Illustration ${currentImageIndex + 1}`)}
                />
              </motion.div>
            </AnimatePresence>
          </div>
          {illustrations.length > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label={isZh ? '上一張圖鑑圖片' : 'Previous illustration'}
                disabled={currentImageIndex === 0}
                onClick={() => showImage(currentImageIndex - 1)}
                className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-12 text-center text-xs font-semibold tabular-nums text-slate-500">{currentImageIndex + 1} / {illustrations.length}</span>
              <button
                type="button"
                aria-label={isZh ? '下一張圖鑑圖片' : 'Next illustration'}
                disabled={currentImageIndex === illustrations.length - 1}
                onClick={() => showImage(currentImageIndex + 1)}
                className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
