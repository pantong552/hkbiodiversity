'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ExternalLink, Info, Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { fetchHkbihSpeciesDetails, HkbihSpeciesDetails, HkbihSpeciesMedia } from '@/utils/bgis';
import { renderFormattedText } from '@/utils/formatters';
import type { InatGalleryPhoto } from '@/hooks/useInaturalistSpeciesPhotos';
import BgisAttributionModal from './BgisAttributionModal';
import EnrichedLightbox from '../ui/EnrichedLightbox';

interface HkbihSpeciesCardProps {
  scientificName?: string;
  hkbihScientificName?: string;
  chineseName?: string;
}

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error';
type LoadResult = {
  queryKey: string;
  status: Exclude<LoadState, 'loading'>;
  details: HkbihSpeciesDetails | null;
};
type HkbihDetailsCacheEntry = {
  result?: LoadResult;
  request?: Promise<LoadResult>;
};

const hkbihDetailsCache = new Map<string, HkbihDetailsCacheEntry>();

function getHkbihMediaUrl(path?: string | null): string | null {
  if (!path?.startsWith('/Multimedia/multimedia-dataset/')) return null;
  return `https://bih.gov.hk${path}`;
}

export default function HkbihSpeciesCard({
  scientificName,
  hkbihScientificName,
  chineseName
}: HkbihSpeciesCardProps) {
  const { language } = useLanguage();
  const isChinese = language === 'zh';
  const preferredName = hkbihScientificName?.trim() || scientificName?.trim() || '';
  const queryKey = `${preferredName}|${chineseName || ''}`;
  const [loadResult, setLoadResult] = useState<LoadResult | null>(() => (
    hkbihDetailsCache.get(queryKey)?.result || null
  ));
  const [isAttributionOpen, setIsAttributionOpen] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null);
  const [mediaImageStates, setMediaImageStates] = useState<Record<string, 'loaded' | 'error'>>({});
  const hasSearchName = Boolean(preferredName || chineseName);
  const currentResult = loadResult?.queryKey === queryKey
    ? loadResult
    : hkbihDetailsCache.get(queryKey)?.result || null;
  const details = currentResult?.details || null;
  const loadState: LoadState = !hasSearchName
    ? 'not-found'
    : currentResult?.status || 'loading';

  useEffect(() => {
    if (!preferredName && !chineseName) {
      return;
    }

    const cacheEntry = hkbihDetailsCache.get(queryKey);

    if (cacheEntry?.result) return;
    let isActive = true;

    let request = cacheEntry?.request;
    if (!request) {
      const entry: HkbihDetailsCacheEntry = {};
      request = fetchHkbihSpeciesDetails(preferredName, chineseName)
        .then(result => {
          const loadResult: LoadResult = {
            queryKey,
            status: result ? 'loaded' : 'not-found',
            details: result
          };
          entry.result = loadResult;
          delete entry.request;
          return loadResult;
        })
        .catch(error => {
          console.error('[HKBIH] Unable to load species details:', error);
          if (hkbihDetailsCache.get(queryKey) === entry) {
            hkbihDetailsCache.delete(queryKey);
          }
          return { queryKey, status: 'error', details: null };
        });
      entry.request = request;
      hkbihDetailsCache.set(queryKey, entry);
    }

    request.then(result => {
      if (isActive) setLoadResult(result);
    });

    return () => {
      isActive = false;
    };
  }, [preferredName, chineseName, queryKey]);

  const identityFields = details ? [
    {
      key: 'scientific-name',
      title: isChinese ? '學名' : 'Scientific Name',
      text: details.scientific_name,
      italic: true
    },
    {
      key: 'authority',
      title: isChinese ? '命名者' : 'Authority',
      text: details.authority_sp
    },
    {
      key: 'synonym',
      title: isChinese ? '異名' : 'Synonym',
      text: details.synonym
    },
    {
      key: 'common-name',
      title: isChinese ? '英文俗名' : 'Common Name',
      text: details.common_name
    },
    {
      key: 'alias-common-name',
      title: isChinese ? '英文別名' : 'Common Name Aliases',
      text: details.alias_common_name
    },
    {
      key: 'chinese-name',
      title: isChinese ? '中文名' : 'Chinese Name',
      text: details.chinese_name_tc
    },
    {
      key: 'alias-chinese-name',
      title: isChinese ? '中文別名' : 'Chinese Name Aliases',
      text: details.alias_chinese_name_tc
    }
  ].filter(field => Boolean(field.text)) : [];

  const descriptiveFields = details ? [
    {
      key: 'description',
      title: isChinese ? '描述' : 'Description',
      text: isChinese
        ? details.description_tc || details.description_en
        : details.description_en || details.description_tc
    },
    {
      key: 'local-distribution',
      title: isChinese ? '香港分布' : 'Local Distribution',
      text: isChinese
        ? details.local_distribution_tc || details.local_distribution_en
        : details.local_distribution_en || details.local_distribution_tc
    }
  ].filter(field => Boolean(field.text)) : [];
  const hasDetails = identityFields.length > 0 || descriptiveFields.length > 0;
  const media = (details?.media || []).filter(
    item => item.multimedia_type === 'photo' && getHkbihMediaUrl(item.filename)
  );
  const lightboxPhotos: InatGalleryPhoto[] = media.flatMap((item, index) => {
    const originalUrl = getHkbihMediaUrl(item.filename);
    const thumbnailUrl = getHkbihMediaUrl(item.filename_t) || originalUrl;
    if (!originalUrl || !thumbnailUrl) return [];
    return [{
      id: `hkbih-${details?.species_id}-${index}`,
      url: thumbnailUrl,
      small_url: thumbnailUrl,
      medium_url: originalUrl,
      large_url: originalUrl,
      original_url: originalUrl,
      attribution: '',
      licenseCode: null,
      nativePageUrl: null,
      observationUrl: null,
      observedOn: null
    }];
  });
  const activeMedia = activeMediaIndex === null ? null : media[activeMediaIndex] || null;

  const getMediaSummary = (item: HkbihSpeciesMedia) => {
    const localizedValue = (english?: string | null, chinese?: string | null, simplifiedChinese?: string | null) =>
      isChinese ? chinese || english || simplifiedChinese : english || chinese || simplifiedChinese;
    return [
      { key: 'photographer', label: isChinese ? '攝影者' : 'Photographer', value: localizedValue(item.photographer_en, item.photographer_tc, item.photographer_sc) },
      { key: 'data-owner', label: isChinese ? '資料擁有人' : 'Data owner', value: localizedValue(item.data_owner_en, item.data_owner_tc, item.data_owner_sc) },
      { key: 'sex', label: isChinese ? '性別' : 'Sex', value: localizedValue(item.sex_en, item.sex_tc, item.sex_sc) },
      { key: 'life-stage', label: isChinese ? '生命階段' : 'Life stage', value: localizedValue(item.stage_of_life_en, item.stage_of_life_tc, item.stage_of_life_sc) }
    ].filter(row => Boolean(row.value?.trim()));
  };

  const statusMessage = loadState === 'loading'
    ? (isChinese ? '正在載入 HKBIH 物種資料…' : 'Loading HKBIH species information…')
    : loadState === 'error'
      ? (isChinese ? '暫時無法載入 HKBIH 資料，請稍後再試。' : 'HKBIH data could not be loaded. Please try again later.')
      : (isChinese ? 'HKBIH 暫無此物種的相關資料。' : 'No HKBIH information is available for this species.');

  return (
    <>
      <div className="relative">
        {loadState !== 'loaded' ? (
          <div className="flex items-center gap-2 text-sm text-slate-500" role={loadState === 'loading' ? 'status' : undefined}>
            {loadState === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
            <span>{statusMessage}</span>
          </div>
        ) : (
          <>
            {hasDetails ? (
              <div className="space-y-5">
                {identityFields.length > 0 && (
                  <dl>
                    {identityFields.map(field => (
                      <div key={field.key} className="grid grid-cols-[minmax(7rem,9rem)_minmax(0,1fr)] gap-3 py-2.5">
                        <dt className="text-sm font-bold text-slate-700">{field.title}</dt>
                        <dd className={`min-w-0 whitespace-pre-line text-sm leading-relaxed text-slate-600 ${'italic' in field && field.italic ? 'italic' : ''}`}>
                          {renderFormattedText(field.text)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {descriptiveFields.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {descriptiveFields.map(field => (
                      <div key={field.key} className="rounded-2xl bg-slate-50 p-4">
                        <h4 className="mb-1 text-sm font-black text-slate-800">{field.title}</h4>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{renderFormattedText(field.text)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{isChinese ? 'HKBIH 暫無所選資料欄位。' : 'The selected HKBIH fields are not available.'}</p>
            )}

            {media.length > 0 && (
              <div className="mt-5">
                <div className="-mx-2 flex gap-3 overflow-x-auto px-2 py-2">
                  {media.map((item, index) => {
                    const thumbnailUrl = getHkbihMediaUrl(item.filename_t) || getHkbihMediaUrl(item.filename);
                    if (!thumbnailUrl) return null;
                    const imageState = mediaImageStates[thumbnailUrl];
                    return (
                      <button
                        key={`${item.filename}-${index}`}
                        type="button"
                        onClick={() => setActiveMediaIndex(index)}
                        aria-label={isChinese ? `放大查看第 ${index + 1} 張圖片` : `View photo ${index + 1}`}
                        className="group relative aspect-square w-24 shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-slate-100 opacity-80 shadow-sm transition-opacity duration-300 hover:opacity-100 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-500 focus:ring-offset-2"
                      >
                        {imageState !== 'error' && (
                          <div className={`absolute inset-0 z-10 flex items-center justify-center bg-slate-100 transition-opacity ${imageState === 'loaded' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                            <Loader2 className="relative z-10 h-5 w-5 animate-spin text-emerald-500" />
                          </div>
                        )}
                        <Image
                          src={thumbnailUrl}
                          alt={details?.scientific_name || ''}
                          fill
                          sizes="96px"
                          className={`pointer-events-none object-cover transition-transform duration-300 group-hover:scale-105 ${imageState === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
                          onLoad={() => setMediaImageStates(previous => ({ ...previous, [thumbnailUrl]: 'loaded' }))}
                          onError={() => setMediaImageStates(previous => ({ ...previous, [thumbnailUrl]: 'error' }))}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsAttributionOpen(true)}
            title={isChinese ? 'BGIS / HKBIH 資料來源與條款聲明' : 'BGIS / HKBIH Data Attribution & Terms'}
            aria-label={isChinese ? '查看 HKBIH 資料來源與條款' : 'View HKBIH data attribution and terms'}
            className="rounded-full p-2 text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
          >
            <Info className="h-4 w-4" />
          </button>
          {details && (
            <a
              href={`https://bih.gov.hk/tc/species-database/species-information/index.html?id=${details.species_id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={isChinese ? '在 HKBIH 查看物種資料' : 'View species on HKBIH'}
              aria-label={isChinese ? '在 HKBIH 查看物種資料' : 'View species on HKBIH'}
              className="shrink-0 rounded-full p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
          )}
        </div>
      </div>
      <EnrichedLightbox
        isOpen={activeMediaIndex !== null && lightboxPhotos.length > 0}
        onClose={() => setActiveMediaIndex(null)}
        photos={lightboxPhotos}
        currentIndex={activeMediaIndex ?? 0}
        onNavigate={setActiveMediaIndex}
        commonName={details?.common_name || details?.scientific_name || ''}
        scientificName={details?.scientific_name || ''}
        footerContent={activeMedia ? (
          <dl className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
            {getMediaSummary(activeMedia).map(row => (
              <div key={row.key} className="min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-left shadow-lg backdrop-blur-xl">
                <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/55">{row.label}</dt>
                <dd className="mt-0.5 break-words text-xs font-semibold leading-snug text-white">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      />
      <BgisAttributionModal
        isOpen={isAttributionOpen}
        onClose={() => setIsAttributionOpen(false)}
        language={language}
      />
    </>
  );
}
