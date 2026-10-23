'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ExternalLink, Info, Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { fetchHkbihSpeciesDetails, HkbihSpeciesDetails } from '@/utils/bgis';
import { renderFormattedText } from '@/utils/formatters';
import BgisAttributionModal from './BgisAttributionModal';

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

export default function HkbihSpeciesCard({
  scientificName,
  hkbihScientificName,
  chineseName
}: HkbihSpeciesCardProps) {
  const { language } = useLanguage();
  const isChinese = language === 'zh';
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);
  const [isAttributionOpen, setIsAttributionOpen] = useState(false);
  const preferredName = hkbihScientificName?.trim() || scientificName?.trim() || '';
  const queryKey = `${preferredName}|${chineseName || ''}`;
  const hasSearchName = Boolean(preferredName || chineseName);
  const currentResult = loadResult?.queryKey === queryKey ? loadResult : null;
  const details = currentResult?.details || null;
  const loadState: LoadState = !hasSearchName
    ? 'not-found'
    : currentResult?.status || 'loading';

  useEffect(() => {
    const controller = new AbortController();

    if (!preferredName && !chineseName) {
      return () => controller.abort();
    }

    fetchHkbihSpeciesDetails(preferredName, chineseName, controller.signal)
      .then(result => {
        setLoadResult({
          queryKey,
          status: result ? 'loaded' : 'not-found',
          details: result
        });
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        console.error('[HKBIH] Unable to load species details:', error);
        setLoadResult({ queryKey, status: 'error', details: null });
      });

    return () => controller.abort();
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
    },
    {
      key: 'global-distribution',
      title: isChinese ? '全球分布' : 'Global Distribution',
      text: isChinese
        ? details.global_distribution_tc || details.global_distribution_en
        : details.global_distribution_en || details.global_distribution_tc
    }
  ].filter(field => Boolean(field.text)) : [];
  const hasDetails = identityFields.length > 0 || descriptiveFields.length > 0;

  const statusMessage = loadState === 'loading'
    ? (isChinese ? '正在載入 HKBIH 物種資料…' : 'Loading HKBIH species information…')
    : loadState === 'error'
      ? (isChinese ? '暫時無法載入 HKBIH 資料，請稍後再試。' : 'HKBIH data could not be loaded. Please try again later.')
      : (isChinese ? 'HKBIH 暫無此物種的相關資料。' : 'No HKBIH information is available for this species.');

  return (
    <>
      <section className="relative rounded-[2rem] sm:rounded-[2.5rem] shadow-sm bg-white p-6 border border-slate-100">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/images/partners/hkbih.webp"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-contain"
            />
            <h3 className="font-black text-slate-800">
              {isChinese ? '香港生物多樣性資訊站' : 'Hong Kong Biodiversity Information Hub'}
            </h3>
            <button
              type="button"
              onClick={() => setIsAttributionOpen(true)}
              title={isChinese ? 'BGIS / HKBIH 資料來源與條款聲明' : 'BGIS / HKBIH Data Attribution & Terms'}
              aria-label={isChinese ? '查看 HKBIH 資料來源與條款' : 'View HKBIH data attribution and terms'}
              className="shrink-0 rounded-full p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
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
                  <dl className="divide-y divide-slate-100">
                    {identityFields.map(field => (
                      <div key={field.key} className="grid grid-cols-[minmax(7rem,9rem)_minmax(0,1fr)] gap-3 py-2.5 first:pt-0 last:pb-0">
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

          </>
        )}
      </section>
      <BgisAttributionModal
        isOpen={isAttributionOpen}
        onClose={() => setIsAttributionOpen(false)}
        language={language}
      />
    </>
  );
}
