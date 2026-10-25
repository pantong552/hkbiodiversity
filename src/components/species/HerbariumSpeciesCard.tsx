'use client';

import Image from 'next/image';
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Expand, ExternalLink, Flower2, Info, Leaf, Link as LinkIcon, Loader2, ShieldCheck, Sprout, X } from 'lucide-react';
import type { InatGalleryPhoto } from '@/hooks/useInaturalistSpeciesPhotos';
import EnrichedLightbox from '@/components/ui/EnrichedLightbox';

const HERBARIUM_ORIGIN = 'https://herbarium.gov.hk';

interface HerbariumPhoto {
  filepath?: string;
  filepath_thumbnail?: string;
}

interface HerbariumSpecies {
  id?: string;
  family_no?: string;
  scientific_name?: string[];
  species_name?: string;
  species_authority?: string;
  scientific_name_with_authority?: string[];
  scientific_name_with_authority_format?: string[];
  plant_type_eng?: string;
  plant_type_chi?: string;
  genus_name?: string;
  genus_name_chi?: string;
  family_name?: string;
  family_name_chi?: string;
  locality_eng?: string;
  locality_chi?: string;
  common_name?: string[];
  chinese_name?: string[];
  rec_in_hk?: string;
  native?: string;
  exotic?: string;
  naturalized?: string;
  cultivated?: string;
  type_specimen_in_hk?: string;
  cap96?: string;
  cap586?: string;
  iucn?: string;
  rare_plant_hk?: string[];
  china_plant_red_data?: string;
  china_higher_plant_red_list?: string;
  flower_period?: { from_value?: number; to_value?: number }[];
  fruit_period?: { from_value?: number; to_value?: number }[];
  photo?: HerbariumPhoto[];
  illustration_filepath?: string;
  flora_of_hk_title?: string;
  flora_of_hk_title_chi?: string;
}

interface FloraEntry {
  content?: string;
}

interface FloraResponse {
  eng?: FloraEntry[];
  chi?: FloraEntry[];
  sc?: FloraEntry[];
}

interface HerbariumSpeciesCardProps {
  oid: number;
  language: 'zh' | 'en';
}

interface HerbariumCacheEntry {
  species?: HerbariumSpecies;
  floraHtml?: string;
  hasFlora?: boolean;
}

const herbariumCache = new Map<number, HerbariumCacheEntry>();

const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'caption', 'div', 'em', 'h1', 'h2', 'h3',
  'h4', 'hr', 'i', 'img', 'li', 'ol', 'p', 'small', 'span', 'strong',
  'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
]);
const DROP_TAGS = new Set(['iframe', 'object', 'script', 'style', 'svg', 'math', 'template']);

function sanitizeFloraHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');

  const sanitizeElement = (element: Element) => {
    const tag = element.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      if (DROP_TAGS.has(tag)) {
        element.remove();
      } else {
        Array.from(element.children).forEach(sanitizeElement);
        element.replaceWith(...Array.from(element.childNodes));
      }
      return;
    }

    Array.from(element.attributes).forEach(({ name, value }) => {
      const attribute = name.toLowerCase();
      if (attribute === 'style') {
        if (/url\s*\(|expression\s*\(|javascript\s*:/i.test(value)) {
          element.removeAttribute(name);
        } else if (element.tagName.toLowerCase() === 'div' && element.id.startsWith('eng_para_')) {
          (element as HTMLElement).style.marginBottom = '0';
        }
        return;
      }
      if (attribute === 'class' || attribute === 'id' || attribute === 'title' || attribute === 'alt') return;
      if (attribute === 'href' && tag === 'a') {
        if (/^(https?:\/\/|\/(?!\/)|#)/i.test(value)) return;
      } else if (attribute === 'src' && tag === 'img') {
        if (/^(\/plantdb\/|https:\/\/herbarium\.gov\.hk\/plantdb\/)/i.test(value)) return;
      } else if ((attribute === 'width' || attribute === 'height') && /^\d+$/.test(value)) {
        return;
      } else if (attribute === 'target' && value === '_blank' && tag === 'a') {
        element.setAttribute('rel', 'noopener noreferrer');
        return;
      }
      element.removeAttribute(name);
    });

    Array.from(element.children).forEach(sanitizeElement);
  };

  Array.from(document.body.children).forEach(sanitizeElement);
  return document.body.innerHTML;
}

function sanitizeScientificNameHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const removeTags = new Set(['iframe', 'object', 'script', 'style', 'svg', 'math', 'template']);

  const sanitizeElement = (element: Element) => {
    const tag = element.tagName.toLowerCase();
    if (removeTags.has(tag)) {
      element.remove();
      return;
    }
    if (tag !== 'i') {
      Array.from(element.children).forEach(sanitizeElement);
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach(({ name }) => element.removeAttribute(name));
    Array.from(element.children).forEach(sanitizeElement);
  };

  Array.from(document.body.children).forEach(sanitizeElement);
  return document.body.innerHTML;
}

function displayValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.filter(Boolean).join('、');
  return value?.trim() ?? '';
}

function formatPeriod(
  periods: HerbariumSpecies['flower_period'],
  language: 'zh' | 'en',
): string {
  const monthName = (month: number) => language === 'zh'
    ? `${month}月`
    : new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, month - 1, 1)));

  return (periods ?? [])
    .filter(period => Number.isInteger(period.from_value) && Number.isInteger(period.to_value))
    .map(({ from_value: from, to_value: to }) => {
      if (!from || !to || from < 1 || from > 12 || to < 1 || to > 12) return '';
      if (from === to) return monthName(from);
      const nextYear = from > to ? (language === 'zh' ? '翌年' : 'next year ') : '';
      return `${monthName(from)} - ${nextYear}${monthName(to)}`;
    })
    .filter(Boolean)
    .join(language === 'zh' ? '、' : ', ');
}

function isRecorded(value: string | undefined): boolean {
  return value === 'Y' || value === 'Yes';
}

function StatusSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Leaf;
  children: React.ReactNode;
}) {
  return (
    <section>
      <StatusHeading title={title} icon={Icon} />
      <dl className="space-y-2 px-4 py-3 text-sm sm:px-6">{children}</dl>
    </section>
  );
}

function StatusHeading({ title, icon: Icon }: { title: string; icon: typeof Leaf }) {
  return (
    <h3 className="flex items-center gap-2 border-b border-emerald-200 pb-1.5 text-sm font-bold text-emerald-800">
      <Icon className="h-5 w-5 text-emerald-700/70" />
      {title}
    </h3>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
      <dt className="font-medium text-slate-700">{label}</dt>
      <dd className="text-slate-600">{value}</dd>
    </div>
  );
}

function HerbariumPhotoCarousel({
  photos,
  commonName,
  scientificName,
  language,
}: {
  photos: { url: string; alt: string; key: string }[];
  commonName: string;
  scientificName: string;
  language: 'zh' | 'en';
}) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const lightboxPhotos: InatGalleryPhoto[] = photos.map((photo, index) => ({
    id: photo.key || index,
    url: photo.url,
    small_url: photo.url,
    medium_url: photo.url,
    large_url: photo.url,
    original_url: photo.url,
    attribution: '',
    licenseCode: null,
    nativePageUrl: null,
    observationUrl: null,
    observedOn: null,
  }));
  const currentPhoto = photos[currentIndex];

  const navigate = (direction: -1 | 1) => {
    setCurrentIndex(index => (index + direction + photos.length) % photos.length);
  };

  return (
    <section>
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 shadow-lg">
        <button
          type="button"
          onClick={() => setLightboxIndex(currentIndex)}
          aria-label={language === 'zh' ? `放大查看相片 ${currentIndex + 1}` : `Enlarge photo ${currentIndex + 1}`}
          className="group relative block aspect-[16/10] w-full cursor-zoom-in"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentPhoto.key}
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={(_, info) => {
                if (info.offset.x < -50) navigate(1);
                if (info.offset.x > 50) navigate(-1);
              }}
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
            >
              <Image
                src={currentPhoto.url}
                alt={currentPhoto.alt || commonName || scientificName}
                fill
                priority={currentIndex === 0}
                sizes="(max-width: 768px) 100vw, 800px"
                unoptimized
                className="object-contain"
              />
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent px-4 pb-4 pt-12 text-white">
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold">{commonName || scientificName}</p>
              <p className="mt-0.5 text-xs text-white/70">{currentIndex + 1} / {photos.length}</p>
            </div>
            <span className="rounded-full border border-white/20 bg-white/10 p-2 backdrop-blur-sm transition-colors group-hover:bg-emerald-500">
              <Expand className="h-4 w-4" />
            </span>
          </div>
        </button>
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={photos.length < 2}
              aria-label={language === 'zh' ? '上一張相片' : 'Previous photo'}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-slate-950/40 p-2.5 text-white shadow-md backdrop-blur-md transition-colors hover:bg-emerald-500"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              disabled={photos.length < 2}
              aria-label={language === 'zh' ? '下一張相片' : 'Next photo'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-slate-950/40 p-2.5 text-white shadow-md backdrop-blur-md transition-colors hover:bg-emerald-500"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-1 flex items-center gap-4 overflow-x-auto px-3 py-4">
          {photos.map((photo, index) => (
            <button
              key={photo.key}
              type="button"
              onClick={() => setCurrentIndex(index)}
              aria-label={language === 'zh' ? `查看相片 ${index + 1}` : `View photo ${index + 1}`}
              aria-current={index === currentIndex}
              className={`relative w-24 aspect-square shrink-0 overflow-hidden rounded-2xl transition-all duration-300 ${
                index === currentIndex
                  ? 'scale-105 ring-4 ring-emerald-500 ring-offset-4 ring-offset-slate-50 shadow-xl'
                  : 'opacity-65 hover:opacity-100'
              }`}
            >
              <Image src={photo.url} alt="" fill sizes="96px" unoptimized className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <EnrichedLightbox
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        photos={lightboxPhotos}
        currentIndex={lightboxIndex ?? 0}
        onNavigate={index => {
          setLightboxIndex(index);
          setCurrentIndex(index);
        }}
        commonName={commonName}
        scientificName={scientificName}
        hideInfoFooter
      />
    </section>
  );
}

function HerbariumIllustration({
  url,
  alt,
  commonName,
  scientificName,
}: {
  url: string;
  alt: string;
  commonName: string;
  scientificName: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const lightboxPhoto: InatGalleryPhoto = {
    id: url,
    url,
    small_url: url,
    medium_url: url,
    large_url: url,
    original_url: url,
    attribution: '',
    licenseCode: null,
    nativePageUrl: null,
    observationUrl: null,
    observedOn: null,
  };

  return (
    <>
      <section>
        <StatusHeading title={alt} icon={Leaf} />
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={alt}
          className="relative mt-3 block aspect-[4/3] w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-50"
        >
          <Image src={url} alt={alt} fill sizes="(max-width: 768px) 100vw, 672px" unoptimized className="object-contain" />
        </button>
      </section>
      <EnrichedLightbox
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        photos={[lightboxPhoto]}
        currentIndex={0}
        onNavigate={() => undefined}
        commonName={commonName}
        scientificName={scientificName}
        hideInfoFooter
      />
    </>
  );
}

function imageUrl(path: string | undefined): string | null {
  if (!path?.startsWith('/plantdb/')) return null;
  return `${HERBARIUM_ORIGIN}${path}`;
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export default function HerbariumSpeciesCard({ oid, language }: HerbariumSpeciesCardProps) {
  const [species, setSpecies] = React.useState<HerbariumSpecies | null>(() => herbariumCache.get(oid)?.species ?? null);
  const [floraHtml, setFloraHtml] = React.useState(() => herbariumCache.get(oid)?.floraHtml ?? '');
  const [speciesLoading, setSpeciesLoading] = React.useState(() => !herbariumCache.get(oid)?.species);
  const [floraLoading, setFloraLoading] = React.useState(() => !herbariumCache.get(oid)?.hasFlora);
  const [speciesError, setSpeciesError] = React.useState('');
  const [floraError, setFloraError] = React.useState('');
  const [isCopyrightOpen, setIsCopyrightOpen] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    const cached = herbariumCache.get(oid);
    setSpecies(cached?.species ?? null);
    setFloraHtml(cached?.floraHtml ?? '');
    setSpeciesError('');
    setFloraError('');
    setSpeciesLoading(!cached?.species);
    setFloraLoading(!cached?.hasFlora);

    const encodedOid = encodeURIComponent(String(oid));
    if (!cached?.species) {
      fetchJson<HerbariumSpecies>(`/herbarium-api/GetSpecies.php?id=${encodedOid}`, controller.signal)
        .then(result => {
          if (controller.signal.aborted) return;
          const formattedResult = {
            ...result,
            scientific_name_with_authority_format: result.scientific_name_with_authority_format
              ?.map(sanitizeScientificNameHtml),
          };
          const entry = herbariumCache.get(oid) ?? {};
          entry.species = formattedResult;
          herbariumCache.set(oid, entry);
          setSpecies(formattedResult);
        })
        .catch(error => {
          if (controller.signal.aborted) return;
          setSpeciesError(language === 'zh' ? '暫時無法載入香港植物標本室資料。' : 'Unable to load Hong Kong Herbarium data.');
          console.error('[Herbarium] Unable to load species details:', error);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSpeciesLoading(false);
        });
    }

    if (!cached?.hasFlora) {
      fetchJson<FloraResponse>(`/herbarium-api/GetFloraOfHk.php?parent_type=species&id=${encodedOid}`, controller.signal)
        .then(result => {
          if (controller.signal.aborted) return;
          const html = (result.eng ?? []).map(entry => entry.content ?? '').filter(Boolean).map(sanitizeFloraHtml).join('');
          const entry = herbariumCache.get(oid) ?? {};
          entry.floraHtml = html;
          entry.hasFlora = true;
          herbariumCache.set(oid, entry);
          setFloraHtml(html);
        })
        .catch(error => {
          if (controller.signal.aborted) return;
          setFloraError(language === 'zh' ? '暫時無法載入《香港植物誌》內容。' : 'Unable to load Flora of Hong Kong content.');
          console.error('[Herbarium] Unable to load Flora of Hong Kong content:', error);
        })
        .finally(() => {
          if (!controller.signal.aborted) setFloraLoading(false);
        });
    }

    return () => controller.abort();
  }, [oid, language]);

  if (speciesLoading) {
    return (
      <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
        {language === 'zh' ? '正在載入香港植物標本室資料…' : 'Loading Hong Kong Herbarium data…'}
      </div>
    );
  }

  if (speciesError && !species) {
    return <p role="alert" className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{speciesError}</p>;
  }

  if (!species) return null;

  const chineseNames = species.chinese_name ?? [];
  const englishNames = species.common_name ?? [];
  const scientificNames = species.scientific_name_with_authority_format ?? species.scientific_name_with_authority ?? [];
  const commonName = language === 'zh' ? chineseNames[0] : englishNames[0];
  const otherChineseNames = chineseNames.slice(1).join('、');
  const scientificNameHtml = scientificNames[0];
  const synonymHtml = scientificNames.slice(1);
  const plantType = language === 'zh' ? species.plant_type_chi : species.plant_type_eng;
  const family = language === 'zh'
    ? [species.family_name_chi, species.family_name].filter(Boolean).join(' ')
    : species.family_name;
  const yes = language === 'zh' ? '是' : 'Yes';
  const no = language === 'zh' ? '否' : 'No';
  const isChinese = language === 'zh';
  const conservationRows = [
    [isChinese ? '已列入香港法例第96章' : 'Listed under Hong Kong Cap. 96', isRecorded(species.cap96) ? yes : no],
    [isChinese ? '已列入香港法例第586章' : 'Listed under Hong Kong Cap. 586', isRecorded(species.cap586) ? yes : no],
    [isChinese ? '列入《香港稀有及珍貴植物》' : 'Listed in Rare and Precious Plants of Hong Kong', displayValue(species.rare_plant_hk) === 'Yes' ? yes : isChinese ? '沒有列入' : 'Not listed'],
    [isChinese ? '列入《中國植物紅皮書》' : 'Listed in China Plant Red Data Book', isRecorded(species.china_plant_red_data) ? yes : isChinese ? '沒有列入' : 'Not listed'],
  ];
  const photos = (species.photo ?? []).map((photo, index) => ({
      url: imageUrl(photo.filepath),
      alt: language === 'zh' ? `植物標本室相片 ${index + 1}` : `Herbarium photo ${index + 1}`,
      key: photo.filepath ?? `photo-${index}`,
    })).filter((photo): photo is { url: string; alt: string; key: string } => Boolean(photo.url));
  const illustrationUrl = imageUrl(species.illustration_filepath);
  const floraTitle = language === 'zh'
    ? species.flora_of_hk_title_chi || species.flora_of_hk_title
    : species.flora_of_hk_title;
  const flowerPeriod = formatPeriod(species.flower_period, language);
  const fruitPeriod = formatPeriod(species.fruit_period, language);

  return (
    <div className="space-y-6">
      {photos.length > 0 && (
        <HerbariumPhotoCarousel
          photos={photos}
          commonName={commonName ?? ''}
          scientificName={scientificNames[0] ?? species.scientific_name ?? ''}
          language={language}
        />
      )}

      {speciesError && <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{speciesError}</p>}
      <div className="rounded-[1.75rem] bg-[#f0f3e3] px-6 py-5 sm:px-8 sm:py-6">
        {commonName && (
          <h3 className="text-base font-bold text-emerald-800">
            {commonName}
            {isChinese && otherChineseNames && <span className="ml-1 text-sm font-normal">（{otherChineseNames}）</span>}
          </h3>
        )}
        {scientificNameHtml && (
          species.scientific_name_with_authority_format?.[0]
            ? <p className="mt-1 text-sm text-amber-900" dangerouslySetInnerHTML={{ __html: scientificNameHtml }} />
            : <p className="mt-1 text-sm italic text-amber-900">{scientificNameHtml}</p>
        )}
        {family && <p className="mt-1 text-sm text-slate-600">{family}</p>}
        <dl className="mt-4 space-y-2 border-t border-emerald-900/15 pt-4 text-sm">
          {synonymHtml.length > 0 && (
            <div className="grid grid-cols-[minmax(0,6rem)_1fr] gap-3">
              <dt className="font-medium text-slate-700">{isChinese ? '異名' : 'Synonym'}</dt>
              <dd className="space-y-1 text-slate-600">
                {synonymHtml.map((synonym, index) => (
                  <div
                    key={`${index}-${synonym}`}
                    className={species.scientific_name_with_authority_format?.[index + 1] ? '' : 'italic'}
                    dangerouslySetInnerHTML={species.scientific_name_with_authority_format?.[index + 1] ? { __html: synonym } : undefined}
                  >
                    {species.scientific_name_with_authority_format?.[index + 1] ? undefined : synonym}
                  </div>
                ))}
              </dd>
            </div>
          )}
          {[
            [isChinese ? '英文名' : 'English name', englishNames[0]],
            [isChinese ? '植物種類' : 'Plant type', plantType],
          ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
            <div key={label} className="grid grid-cols-[minmax(0,6rem)_1fr] gap-3">
              <dt className="font-medium text-slate-700">{label}</dt>
              <dd className="text-slate-600">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-5 md:grid-cols-2">
        <StatusSection title={isChinese ? '生態資料' : 'Ecology'} icon={Sprout}>
          <StatusRow
            label={isChinese ? '生態狀況' : 'Status'}
            value={isRecorded(species.native) ? (isChinese ? '原生' : 'Native') : isRecorded(species.exotic) ? (isChinese ? '外來' : 'Exotic') : isRecorded(species.cultivated) ? (isChinese ? '栽培' : 'Cultivated') : (isChinese ? '未有記錄' : 'Not recorded')}
          />
          {displayValue(species.native) === 'Y' && isRecorded(species.naturalized) && (
            <StatusRow label={isChinese ? '歸化' : 'Naturalized'} value={yes} />
          )}
        </StatusSection>

        <StatusSection title={isChinese ? '保育狀況' : 'Conservation'} icon={ShieldCheck}>
          {conservationRows.map(([label, value]) => <StatusRow key={label} label={label} value={value} />)}
        </StatusSection>

        {(flowerPeriod || fruitPeriod) && (
          <StatusSection title={isChinese ? '花果期' : 'Flowering and fruiting'} icon={Flower2}>
            {flowerPeriod && <StatusRow label={isChinese ? '花期' : 'Flowering period'} value={flowerPeriod} />}
            {fruitPeriod && <StatusRow label={isChinese ? '果期' : 'Fruiting period'} value={fruitPeriod} />}
          </StatusSection>
        )}

        <StatusSection title={isChinese ? '其他' : 'Other information'} icon={Info}>
          <StatusRow
            label={isChinese ? '模式標本採自香港' : 'Type specimen collected in Hong Kong'}
            value={isRecorded(species.type_specimen_in_hk) ? yes : no}
          />
        </StatusSection>
      </div>

      {(floraLoading || floraError || floraTitle || floraHtml || illustrationUrl) && (
        <div className="space-y-2">
          {(floraLoading || floraError || floraTitle || floraHtml) && (
            <section>
              {floraTitle && (
                <h3 className="flex items-center gap-2 border-b border-emerald-200 pb-1.5 text-sm font-bold text-emerald-800">
                  <Leaf className="h-5 w-5 text-emerald-700/70" />
                  {floraTitle}
                </h3>
              )}
              {floraLoading ? (
                <div className="px-8 py-2 text-sm text-slate-500">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-emerald-600" />
                  {language === 'zh' ? '正在載入《香港植物誌》內容…' : 'Loading Flora of Hong Kong content…'}
                </div>
              ) : floraError ? (
                <p role="alert" className="px-8 py-2 text-sm text-rose-700">{floraError}</p>
              ) : floraHtml ? (
                <div className="max-w-none px-8 pt-2 pb-0 text-sm leading-relaxed text-slate-700 [&_p:last-child]:!mb-0" dangerouslySetInnerHTML={{ __html: floraHtml }} />
              ) : (
                <p className="px-8 py-2 text-sm text-slate-500">{language === 'zh' ? '暫無《香港植物誌》內容。' : 'No Flora of Hong Kong content is available.'}</p>
              )}
            </section>
          )}

          {illustrationUrl && (
            <HerbariumIllustration
              url={illustrationUrl}
              alt={language === 'zh' ? '插圖' : 'Illustration'}
              commonName={commonName ?? ''}
              scientificName={scientificNames[0] ?? species.scientific_name ?? ''}
            />
          )}
        </div>
      )}

      <div className="-mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setIsCopyrightOpen(true)}
          title={isChinese ? '香港植物標本室版權告示' : 'Hong Kong Herbarium Copyright Notice'}
          aria-label={isChinese ? '查看香港植物標本室版權告示' : 'View Hong Kong Herbarium copyright notice'}
          className="rounded-full p-2 text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
        >
          <Info className="h-4 w-4" />
        </button>
        <a
          href={`https://herbarium.gov.hk/${isChinese ? 'tc' : 'en'}/hk-plant-database/plant-detail/index.html?pType=species&oID=${encodeURIComponent(String(oid))}`}
          target="_blank"
          rel="noopener noreferrer"
          title={isChinese ? '在香港植物標本室查看此物種' : 'View this species on Hong Kong Herbarium'}
          aria-label={isChinese ? '在香港植物標本室查看此物種' : 'View this species on Hong Kong Herbarium'}
          className="shrink-0 rounded-full p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900"
        >
          <ExternalLink className="h-5 w-5" />
        </a>
      </div>

      <AnimatePresence>
        {isCopyrightOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md"
            onMouseDown={event => {
              if (event.target === event.currentTarget) setIsCopyrightOpen(false);
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="herbarium-copyright-title"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 p-5 text-white shadow-md">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-2.5 backdrop-blur-sm">
                    <Info className="h-5 w-5 text-emerald-100" />
                  </div>
                  <h3 id="herbarium-copyright-title" className="text-base font-black tracking-tight md:text-lg">
                    {isChinese ? '香港植物標本室版權告示' : 'Hong Kong Herbarium Copyright Notice'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCopyrightOpen(false)}
                  aria-label={isChinese ? '關閉' : 'Close'}
                  className="rounded-full p-2 text-white/90 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-6 text-sm leading-relaxed text-slate-700">
                {isChinese ? (
                  <>
                    <p>本頁香港植物標本室資料的展示與使用方式，依照其「版權告示」處理，僅作非商業用途，並註明香港植物標本室及漁農自然護理署為資料來源。</p>
                    <p>該告示亦指出，商業用途須事先取得漁農自然護理署書面授權，並說明香港植物標本室及漁農自然護理署對使用相關資訊所引致的損失不承擔責任。</p>
                  </>
                ) : (
                  <>
                    <p>The display and use of Hong Kong Herbarium data on this page follows its Copyright Notice: the data is used for non-commercial purposes, with the Hong Kong Herbarium and AFCD acknowledged as the source.</p>
                    <p>The notice also states that commercial use requires prior written authorization from AFCD and that the Hong Kong Herbarium and AFCD accept no liability for losses arising from use of the information.</p>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4">
                <a
                  href={isChinese
                    ? 'https://herbarium.gov.hk/tc/important-notices/index.html'
                    : 'https://herbarium.gov.hk/en/important-notices/index.html'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  {isChinese ? '開啟連結' : 'Visit Site'}
                </a>
                <button
                  type="button"
                  onClick={() => setIsCopyrightOpen(false)}
                  className="rounded-xl bg-slate-800 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-900"
                >
                  {isChinese ? '關閉' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
