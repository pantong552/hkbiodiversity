'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/utils/supabase/client';
import { useInaturalistSpeciesPhotos } from '@/hooks/useInaturalistSpeciesPhotos';
import { AnatomyIllustration, AnatomyMarker, EMPTY_ANATOMY_ILLUSTRATION } from '@/types/anatomy';
import { getAnatomyCoordinates, isAllowedAnatomyImageUrl, mapAnatomyIllustration } from '@/utils/anatomy';

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

export function SpeciesAnatomyEditor({ value, inatId, taxaId, disabled = false, onChange }: SpeciesAnatomyEditorProps) {
  const { language } = useLanguage();
  const { photos, isLoading: photosLoading, hasMore, loadMore } = useInaturalistSpeciesPhotos(inatId, taxaId);
  const imageRef = useRef<HTMLImageElement>(null);
  const draggingKeyRef = useRef<string | null>(null);
  const markerCounterRef = useRef(0);
  const [activeKey, setActiveKey] = useState<string | null>(value.markers[0]?.key || null);
  const [imageErrorUrl, setImageErrorUrl] = useState<string | null>(null);
  const [markerError, setMarkerError] = useState('');
  const isZh = language === 'zh';
  const imageUrlAllowed = isAllowedAnatomyImageUrl(value.photoUrl);
  const imageError = imageErrorUrl === value.photoUrl;
  const activeMarker = value.markers.find((marker) => marker.key === activeKey) || value.markers[0] || null;

  const updateMarker = (key: string, changes: Partial<AnatomyMarker>) => {
    onChange({ ...value, markers: value.markers.map((marker) => marker.key === key ? { ...marker, ...changes } : marker) });
  };

  const addMarker = (clientX?: number, clientY?: number) => {
    let key = `part_${markerCounterRef.current++}`;
    while (value.markers.some((marker) => marker.key === key)) key = `part_${markerCounterRef.current++}`;
    const point = clientX !== undefined && clientY !== undefined && imageRef.current
      ? getAnatomyCoordinates(clientX, clientY, imageRef.current.getBoundingClientRect())
      : { x: 50, y: 50 };
    const marker: AnatomyMarker = {
      key,
      x: point.x,
      y: point.y,
      placement: 'top',
      zh: '',
      en: ''
    };
    onChange({ ...value, markers: [...value.markers, marker] });
    setActiveKey(key);
    setMarkerError('');
  };

  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !imageRef.current || (event.target as HTMLElement).closest('[data-anatomy-marker]')) return;
    addMarker(event.clientX, event.clientY);
    setMarkerError('');
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const key = draggingKeyRef.current;
    if (!key || !imageRef.current) return;
    updateMarker(key, getAnatomyCoordinates(event.clientX, event.clientY, imageRef.current.getBoundingClientRect()));
  };

  const handlePointerUp = () => {
    draggingKeyRef.current = null;
  };

  const handleKeyChange = (key: string, nextKey: string) => {
    const normalizedKey = nextKey.trim();
    if (value.markers.some((marker) => marker.key === normalizedKey && marker.key !== key)) {
      setMarkerError(isZh ? '標記 key 必須在此物種內唯一。' : 'Marker keys must be unique for this species.');
      return;
    }
    setMarkerError('');
    setActiveKey(normalizedKey);
    updateMarker(key, { key: nextKey });
  };

  const removeMarker = (key: string) => {
    onChange({ ...value, markers: value.markers.filter((marker) => marker.key !== key) });
    setActiveKey(value.markers.find((marker) => marker.key !== key)?.key || null);
    setMarkerError('');
  };

  const labelClass = 'mb-1 block text-[11px] font-bold text-slate-500';
  const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';

  return (
    <div className="space-y-5">
      <label className="block">
        <span className={labelClass}>{isZh ? '特徵插圖圖片 URL' : 'Illustration image URL'}</span>
        <input
          type="text"
          value={value.photoUrl}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, photoUrl: event.target.value })}
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
                  onClick={() => onChange({ ...value, photoUrl })}
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

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-5">
        {value.photoUrl && imageUrlAllowed && !imageError ? (
          <div
            className="relative mx-auto w-fit max-w-full cursor-crosshair touch-none"
            onClick={handleImageClick}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              ref={imageRef}
              src={value.photoUrl}
              alt={isZh ? '特徵插圖預覽' : 'Anatomy illustration preview'}
              className="block max-h-[42vh] max-w-full select-none object-contain"
              draggable={false}
              onError={() => setImageErrorUrl(value.photoUrl)}
            />
            {value.markers.map((marker) => (
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
                style={{ left: `${marker.x}%`, top: `${marker.y}%`, touchAction: 'none' }}
                className={`absolute z-10 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-xs font-black shadow-md ${activeKey === marker.key ? 'border-emerald-700 bg-emerald-600 text-white' : 'border-white bg-white text-slate-800'} disabled:cursor-default`}
              >
                +
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
            {imageError ? <AlertCircle className="size-5 text-rose-500" /> : null}
            <span>{!imageUrlAllowed && value.photoUrl ? (isZh ? '圖片 URL 不在允許的來源清單內。' : 'This image URL is not from an allowed image source.') : imageError ? (isZh ? '圖片無法載入，請檢查 URL。' : 'Image failed to load. Check the URL.') : (isZh ? '輸入圖片 URL 後即可在圖片上點擊新增標記。' : 'Add an image URL to place markers on the illustration.')}</span>
          </div>
        )}
        {value.photoUrl && !imageError && (
          <p className="mt-3 text-center text-[11px] text-slate-500">
            {isZh ? '點擊圖片新增標記；拖曳圓點調整位置。' : 'Click the image to add a marker; drag a marker to reposition it.'}
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

      {markerError && <p role="alert" className="text-xs font-semibold text-rose-600">{markerError}</p>}
      {!activeMarker ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
          {isZh ? '選取或新增標記以編輯雙語描述。' : 'Select or add a marker to edit its bilingual descriptions.'}
        </p>
      ) : (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_100px_100px_auto] sm:items-end">
            <label>
              <span className={labelClass}>Key</span>
              <input value={activeMarker.key} disabled={disabled} onChange={(event) => handleKeyChange(activeMarker.key, event.target.value)} className={inputClass} maxLength={50} />
            </label>
            <label>
              <span className={labelClass}>X (%)</span>
              <input type="number" min="0" max="100" step="0.1" value={activeMarker.x} disabled={disabled} onChange={(event) => updateMarker(activeMarker.key, { x: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Y (%)</span>
              <input type="number" min="0" max="100" step="0.1" value={activeMarker.y} disabled={disabled} onChange={(event) => updateMarker(activeMarker.key, { y: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} className={inputClass} />
            </label>
            <button type="button" disabled={disabled} onClick={() => removeMarker(activeMarker.key)} title={isZh ? '刪除標記' : 'Delete marker'} className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
              <Trash2 className="size-3.5" /><span className="sm:hidden">{isZh ? '刪除' : 'Delete'}</span>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label>
              <span className={labelClass}>繁體中文</span>
              <textarea rows={4} value={activeMarker.zh} disabled={disabled} onChange={(event) => updateMarker(activeMarker.key, { zh: event.target.value })} className={`${inputClass} resize-y`} />
            </label>
            <label>
              <span className={labelClass}>English</span>
              <textarea rows={4} value={activeMarker.en} disabled={disabled} onChange={(event) => updateMarker(activeMarker.key, { en: event.target.value })} className={`${inputClass} resize-y`} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SpeciesAnatomyCard({ tableName, speciesTaxaId, refreshKey = 0 }: SpeciesAnatomyCardProps) {
  const { language } = useLanguage();
  const supabase = createClient();
  const [illustration, setIllustration] = useState<AnatomyIllustration>(EMPTY_ANATOMY_ILLUSTRATION);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const isZh = language === 'zh';

  useEffect(() => {
    let cancelled = false;
    async function loadIllustration() {
      setLoading(true);
      setLoadError(false);
      setImageError(false);
      const { data, error } = await supabase
        .from('species_anatomy_illustrations')
        .select('photo_url, markers')
        .eq('table_name', tableName)
        .eq('species_taxa_id', speciesTaxaId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError(true);
      } else {
        setIllustration(mapAnatomyIllustration(data));
      }
      setLoading(false);
    }
    loadIllustration();
    return () => { cancelled = true; };
  }, [speciesTaxaId, tableName, refreshKey, supabase]);

  const selectedMarker = illustration.markers.find((marker) => marker.key === (hoveredKey || activeKey));
  const imageUrlAllowed = isAllowedAnatomyImageUrl(illustration.photoUrl);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-end justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Field guide</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">{isZh ? '互動特徵圖鑑' : 'Interactive Anatomy'}</h2>
        </div>
        {!loading && !loadError && <span className="text-xs font-semibold text-slate-400">{illustration.markers.length} {isZh ? '個標記' : 'markers'}</span>}
      </div>

      {loading ? (
        <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />{isZh ? '載入圖鑑…' : 'Loading illustration…'}</div>
      ) : loadError ? (
        <div role="alert" className="flex min-h-32 items-center justify-center gap-2 text-sm text-rose-700"><AlertCircle className="size-4" />{isZh ? '圖鑑載入失敗，請稍後重試。' : 'Could not load the illustration. Please try again later.'}</div>
      ) : !illustration.photoUrl ? (
        <div className="flex min-h-28 items-center justify-center text-sm text-slate-400">{isZh ? '此物種尚未提供特徵插圖。' : 'No anatomy illustration is available for this species yet.'}</div>
      ) : imageError || !imageUrlAllowed ? (
        <div role="alert" className="flex min-h-32 items-center justify-center gap-2 text-sm text-rose-700"><AlertCircle className="size-4" />{isZh ? '插圖無法載入。' : 'The illustration could not be loaded.'}</div>
      ) : (
        <>
          <div className="rounded-xl bg-slate-50 p-3 sm:p-5">
            <div className="relative mx-auto w-fit max-w-full" onClick={() => { setActiveKey(null); setHoveredKey(null); }}>
              <img src={illustration.photoUrl} alt={isZh ? '物種特徵插圖' : 'Species anatomy illustration'} className="block max-h-[520px] max-w-full select-none object-contain" onError={() => setImageError(true)} />
              {illustration.markers.map((marker) => {
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
                    style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                    className={`absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 shadow-md transition-transform ${selected ? 'scale-110 border-emerald-700 bg-emerald-600 text-white' : 'border-white bg-white text-slate-800 hover:scale-110'}`}
                  >+</button>
                );
              })}
            </div>
          </div>
          {selectedMarker && (
            <div className="mt-4 border-l-4 border-emerald-600 bg-emerald-50/70 px-4 py-3" aria-live="polite">
              <p className="mb-1 text-xs font-black uppercase text-emerald-800">{selectedMarker.key}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{isZh ? selectedMarker.zh : selectedMarker.en}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
