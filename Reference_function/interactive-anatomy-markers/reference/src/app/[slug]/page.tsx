import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpeciesByCode } from "@/lib/db";
import ChecklistDetailPage from "@/components/ChecklistDetailPage";

export const revalidate = 3600; // ISR: 1 小時快取，大幅降低 Supabase 查詢次數與頁面載入延遲

import mapUrls from "@/data/mapUrls.json";
import lookerStudioUrls from "@/data/lookerStudioUrls.json";
import silhouetteUrls from "@/data/silhouetteUrls.json";

import { 
  ArrowLeft, Compass, Shield, Activity, Volume2, 
  MapPin, Calendar, HelpCircle, Layers, ExternalLink, Info
} from "lucide-react";
import EcholocationSection from "@/components/EcholocationSection";
import InteractiveAnatomy from "@/components/InteractiveAnatomy";
import DietComposition from "@/components/DietComposition";
import DietFoodList from "@/components/DietFoodList";
import RoostingPlants from "@/components/RoostingPlants";
import ReferencesList from "@/components/ReferencesList";
import SimilarSpecies from "@/components/SimilarSpecies";
import PhotoGallery from "@/components/PhotoGallery";
import ImageLightbox from "@/components/ImageLightbox";
import React from "react";
import { getOptimizedImageUrl } from "@/lib/cloudinary";
import { formatRichText } from "@/lib/utils";

function formatSynonym(syn: string) {
  const words = syn.split(/\s+/);
  const formatted: React.ReactNode[] = [];
  
  let isNextSubspecies = false;

  words.forEach((word, index) => {
    const cleanWord = word.replace(/[(),]/g, '');
    
    let isItalic = false;

    if (index === 0) {
      isItalic = true;
    } else if (index === 1) {
      if (/^[a-z]/.test(cleanWord) && cleanWord !== 'ssp' && cleanWord !== 'var') {
        isItalic = true;
      }
    } else {
      if (cleanWord === 'ssp.' || cleanWord === 'ssp' || cleanWord === 'var.' || cleanWord === 'var') {
        isItalic = false;
        isNextSubspecies = true;
      } else if (isNextSubspecies && /^[a-z]/.test(cleanWord)) {
        isItalic = true;
        isNextSubspecies = false;
      } else {
        isItalic = false;
      }
    }

    formatted.push(
      <span key={index} className={isItalic ? "italic font-medium text-foreground" : "text-muted-accent"}>
        {word}
      </span>
    );
    
    if (index < words.length - 1) {
      formatted.push(<span key={`space-${index}`}> </span>);
    }
  });

  return formatted;
}



interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  if (slug.endsWith("_checklist")) {
    const checklistCode = slug.replace("_checklist", "");
    return {
      title: `${checklistCode} 名錄 | 香港蝙蝠資料庫 HKBR`,
      description: `香港蝙蝠資料庫的 ${checklistCode} 名錄頁面。`,
    };
  }

  const species = await getSpeciesByCode(slug);
  if (!species) {
    return {
      title: "物種未找到 | 香港蝙蝠資料庫 HKBR",
    };
  }

  const d = species.zh;
  const title = `${d.commonName} (${species.scientificName}) | 香港蝙蝠物種資訊 - HKBR`;
  const description = `${d.commonName} (學名: ${species.scientificName}) 是香港常見的蝙蝠物種之一。科別：${species.family.zh} (${species.family.scientific})。分佈：${d.distribution.local || "香港各地"}。此頁面提供詳細的外形特徵、生態習性、體型測量及回聲定位等學術資料。`;

  const imageUrl = species.photos && species.photos.length > 0 
    ? getOptimizedImageUrl(species.photos[0].url) 
    : species.imageUrl 
      ? getOptimizedImageUrl(species.imageUrl) 
      : "https://res.cloudinary.com/dusun9dtd/image/upload/hkbr/logo/logo.png";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 600,
          alt: d.commonName,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function SpeciesDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  if (slug.endsWith("_checklist")) {
    const checklistCode = slug.replace("_checklist", "");
    return <ChecklistDetailPage code={checklistCode} />;
  }

  const code = slug;
  const species = await getSpeciesByCode(code);
  if (!species) {
    notFound();
  }

  const d = species.zh;
  const maps = (mapUrls as Record<string, { localMap: string | null; globalMap: string | null }>)[code] || { localMap: null, globalMap: null };
  const lookerStudioUrl = (lookerStudioUrls as Record<string, string | null>)[code];



  // 提取參考文獻 URL 與純文字
  let refText = species.wingParams.reference || "";
  let refUrl = "";
  if (species.wingParams.reference) {
    const anchorMatch = species.wingParams.reference.match(/href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (anchorMatch) {
      refUrl = anchorMatch[1];
      refText = anchorMatch[2];
    } else {
      refText = species.wingParams.reference.replace(/<[^>]*>/g, "");
    }
  }

  const schemaImageUrl = species.photos && species.photos.length > 0 
    ? getOptimizedImageUrl(species.photos[0].url) 
    : species.imageUrl 
      ? getOptimizedImageUrl(species.imageUrl) 
      : undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-6 species-page-container">
      {/* Schema.org Taxon Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Taxon",
            "name": species.scientificName,
            "scientificName": species.scientificName,
            "alternateName": species.scientificNameAuthor || undefined,
            "commonName": d.commonName,
            "taxonRank": "Species",
            "description": `${d.commonName} (學名: ${species.scientificName}) 的詳細物種特徵、分佈與生態資料。`,
            "image": schemaImageUrl,
            "parentTaxon": {
              "@type": "Taxon",
              "name": species.genus.scientific,
              "commonName": species.genus.zh,
              "taxonRank": "Genus",
              "parentTaxon": {
                "@type": "Taxon",
                "name": species.family.scientific,
                "commonName": species.family.zh,
                "taxonRank": "Family"
              }
            }
          })
        }}
      />
      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/checklist"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-accent hover:text-primary-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回物種名錄</span>
        </Link>
      </div>

      {/* 物種大標題區段 (現代化高質感卡片 Banner - 簡化版) */}
      <div className="relative mb-8 bg-gradient-to-r from-card-bg/60 via-card-bg/40 to-background/5 border border-border-custom/30 rounded-3xl p-6 md:p-8 backdrop-blur-md overflow-hidden shadow-lg flex flex-col gap-6">
        {/* 背景微小雷達雷射紋理點綴 */}
        <div className="absolute right-0 bottom-0 top-0 w-96 opacity-5 pointer-events-none select-none">
          <svg className="w-full h-full text-primary-accent" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="50" r="45" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="100" cy="50" r="30" stroke="currentColor" strokeWidth="1" />
            <circle cx="100" cy="50" r="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="100" y1="50" x2="55" y2="20" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>

        {/* 左側：俗名與學名學術名稱區 */}
        <div className="z-10 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-primary-accent/10 border border-primary-accent/20 text-primary-accent select-none">
              {species.family.zh}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/5 border border-white/10 text-muted-accent select-none">
              {species.genus.zh}
            </span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight drop-shadow-sm">
            {d.commonName}
          </h1>
          
          {/* 微型主色裝飾線條 */}
          <div className="w-16 h-1 bg-gradient-to-r from-primary-accent to-transparent rounded-full mt-3.5 mb-2.5" />

          <div className="space-y-1">
            {species.en?.commonName && (
              <p className="text-xs sm:text-sm text-muted-accent font-semibold">
                {species.en.commonName}
              </p>
            )}
            <p className="text-xs sm:text-sm text-muted-accent font-serif flex flex-wrap gap-x-1.5 items-center">
              <span className="italic font-medium text-foreground">{species.scientificName}</span>
              {species.scientificNameAuthor && (
                <span className="text-muted-accent">{species.scientificNameAuthor}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 滿版 Carousel 畫廊 */}
      <div className="w-full mb-8 md:mb-12">
        {species.photos && species.photos.length > 0 && (
          <PhotoGallery 
            lang="zh" 
            photos={species.photos} 
            speciesName={d.commonName} 
          />
        )}
      </div>

      {/* 分類學與名稱 (Full Width, 兩分欄) */}
      <div className="w-full bg-card-bg border border-border-custom rounded-3xl p-6 md:p-8 shadow-sm mb-8 md:mb-12">
        <div className="flex items-center gap-2 mb-6">
          <Layers className="w-5 h-5 text-primary-accent" />
          <h2 className="text-lg sm:text-xl font-bold text-foreground">分類學與名稱</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
          {/* 左欄：科、屬、本地中文俗名、其他中文俗名 */}
          <div className="space-y-4">
            <div className="border-b border-border-custom/50 pb-2">
              <span className="block text-xs font-bold text-muted-accent uppercase">科</span>
              <span className="text-foreground font-semibold mt-1 block">
                {species.family.zh} <span className="text-xs text-muted-accent italic font-normal">({species.family.scientific})</span>
              </span>
            </div>
            <div className="border-b border-border-custom/50 pb-2">
              <span className="block text-xs font-bold text-muted-accent uppercase">屬</span>
              <span className="text-foreground font-semibold mt-1 block">
                {species.genus.zh} <span className="text-xs text-muted-accent italic font-normal">({species.genus.scientific})</span>
              </span>
            </div>
            <div className="border-b border-border-custom/50 pb-2">
              <span className="block text-xs font-bold text-muted-accent uppercase">本地中文俗名</span>
              <span className="text-foreground font-semibold mt-1 block">{d.commonName}</span>
            </div>
            {d.otherCommonNames.length > 0 && (
              <div className="border-b border-border-custom/50 pb-2">
                <span className="block text-xs font-bold text-muted-accent uppercase">其他中文俗名</span>
                <span className="text-foreground mt-1 block text-sm">
                  {d.otherCommonNames.join("、")}
                </span>
              </div>
            )}
          </div>

          {/* 右欄：異名、分類註釋 */}
          <div className="space-y-4">
            {species.synonyms && species.synonyms.length > 0 && (
              <div className="border-b border-border-custom/50 pb-2">
                <span className="block text-xs font-bold text-muted-accent uppercase">異名</span>
                <ul className="text-xs text-muted-accent mt-1.5 space-y-1.5 list-none">
                  {species.synonyms.map((syn, idx) => (
                    <li key={idx} className="flex flex-wrap gap-x-1.5 items-center">
                      <span className="italic font-serif font-medium text-foreground">{syn.name}</span>
                      {syn.author && (
                        <span className="text-muted-accent">{syn.author}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="bg-background/40 backdrop-blur-xs rounded-2xl p-4 border border-border-custom/40">
              <span className="block text-xs font-bold text-muted-accent uppercase mb-1">分類註釋</span>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.taxonomicNotes)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 互動式外形特徵 (Full Width) */}
      <div className="mb-8 md:mb-12">
        <InteractiveAnatomy speciesCode={code} lang="zh" hotspots={species.hotspots} />
      </div>

      {/* 外形特徵與測量參數 (3-Column Bento Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-6 md:gap-8 mb-8 md:mb-12">
        {/* Column 1: 外形特徵文字說明 */}
        <div className="bg-card-bg border border-border-custom rounded-3xl p-6 shadow-sm flex flex-col justify-between md:col-span-3">
          <div>
            <h3 className="font-bold text-foreground text-sm tracking-wider uppercase mb-4 flex items-center gap-1.5 border-b border-border-custom/40 pb-2">
              <Info className="w-4 h-4 text-primary-accent" />
              外形特徵說明
              <ImageLightbox
                label="身體結構圖"
                zhImageUrl="/wp-uploads/2024/02/Bat-anatomy.png"
                enImageUrl="/wp-uploads/2024/02/Bat-anatomy_eng.png"
                alt="蝙蝠身體結構圖 Bat Anatomy"
                lang="zh"
              />
            </h3>
            <div className="space-y-3.5 text-xs">
              <div className="border-b border-border-custom/30 pb-2">
                <span className="text-primary-accent font-bold block mb-1">毛色</span>
                <p className="text-muted-accent leading-relaxed">{formatRichText(d.features.fur)}</p>
              </div>
              <div className="border-b border-border-custom/30 pb-2">
                <span className="text-primary-accent font-bold block mb-1">耳朵</span>
                <p className="text-muted-accent leading-relaxed">{formatRichText(d.features.ears)}</p>
              </div>
              <div className="border-b border-border-custom/30 pb-2">
                <span className="text-primary-accent font-bold block mb-1">頭部</span>
                <p className="text-muted-accent leading-relaxed">{formatRichText(d.features.head)}</p>
              </div>
              <div className="border-b border-border-custom/30 pb-2">
                <span className="text-primary-accent font-bold block mb-1">四肢</span>
                <p className="text-muted-accent leading-relaxed">{formatRichText(d.features.limbs)}</p>
              </div>
              <div className="border-b border-border-custom/30 pb-2">
                <span className="text-primary-accent font-bold block mb-1">尾部</span>
                <p className="text-muted-accent leading-relaxed">{formatRichText(d.features.tail)}</p>
              </div>
              {d.features.other && (
                <div className="pb-1">
                  <span className="text-primary-accent font-bold block mb-1">其他</span>
                  <p className="text-muted-accent leading-relaxed">{formatRichText(d.features.other)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: 體形與體重測量 */}
        <div className="bg-card-bg border border-border-custom rounded-3xl p-6 shadow-sm flex flex-col justify-between md:col-span-2">
          <div>
            <h3 className="font-bold text-foreground text-sm tracking-wider uppercase mb-4 flex items-center gap-1.5 border-b border-border-custom/40 pb-2">
              <Activity className="w-4 h-4 text-primary-accent" />
              體形與體重測量
              <ImageLightbox
                label="測量參考圖"
                zhImageUrl="/wp-uploads/2023/12/Bat-measurment.png"
                enImageUrl="/wp-uploads/2023/12/Bat-measurment_eng.png"
                alt="蝙蝠體形測量參考圖 Bat Measurement Reference"
                lang="zh"
              />
            </h3>
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">體型分類</span>
                <span className="font-bold text-foreground">{d.bodySizeType}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">軀幹長 (Head-body)</span>
                <span className="font-bold text-foreground">{species.measurements.headBody}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">尾長 (Tail)</span>
                <span className="font-bold text-foreground">{species.measurements.tail}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">耳長 (Ear)</span>
                <span className="font-bold text-foreground">{species.measurements.ear}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">後足長 (Hind foot)</span>
                <span className="font-bold text-foreground">{species.measurements.hindFoot}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">前臂長 (Forearm)</span>
                <span className="font-bold text-foreground">{species.measurements.forearm}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted-accent">體重 (Weight)</span>
                <span className="font-bold text-foreground">{species.measurements.weight}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: 翼形與飛行參數 */}
        <div className="bg-card-bg border border-border-custom rounded-3xl p-6 shadow-sm flex flex-col justify-between md:col-span-2">
          <div>
            <h3 className="font-bold text-foreground text-sm tracking-wider uppercase mb-4 flex items-center gap-1.5 border-b border-border-custom/40 pb-2 flex-wrap">
              <Compass className="w-4 h-4 text-primary-accent flex-shrink-0" />
              <span className="flex-1">翼形與飛行參數</span>
              {(silhouetteUrls as Record<string, string>)[code] && (
                <ImageLightbox
                  label="飛行剪影圖"
                  zhImageUrl={(silhouetteUrls as Record<string, string>)[code]}
                  enImageUrl={(silhouetteUrls as Record<string, string>)[code]}
                  alt={`${d.commonName} 飛行剪影`}
                  lang="zh"
                  buttonText="查看剪影"
                  showLangSwitch={false}
                />
              )}
            </h3>
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">翼長 (Wing length)</span>
                <span className="font-bold text-foreground">{species.wingParams.length}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">翼面積 (Wing area)</span>
                <span className="font-bold text-foreground">{species.wingParams.area}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">翼載 (Wing loading)</span>
                <span className="font-bold text-foreground">{species.wingParams.loading}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">翼展比 (Aspect ratio)</span>
                <span className="font-bold text-foreground">{species.wingParams.aspectRatio}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted-accent">翼尖指數 (Tip index)</span>
                <span className="font-bold text-foreground">{species.wingParams.tipIndex}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border-custom/40 text-[10px] text-muted-accent flex items-center gap-1">
            <span>數據參考文獻: {refText}</span>
            {refUrl && (
              <a 
                href={refUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-primary-accent hover:text-primary-accent/80 transition-colors ml-0.5"
                title="查看文獻來源"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Ecology Details */}
      <div className="bg-card-bg border border-border-custom rounded-3xl p-6 md:p-8 mb-8 md:mb-12 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Compass className="w-5 h-5 text-primary-accent" />
          <h2 className="text-lg sm:text-xl font-bold text-foreground">生態與習性</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {d.ecology.habitat && (
            <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
              <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">生境</h4>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.habitat)}</p>
            </div>
          )}
          {d.ecology.habits && (
            <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
              <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">習性與社交</h4>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.habits)}</p>
            </div>
          )}
          {d.ecology.reproduction && (
            <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
              <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">繁殖與育幼</h4>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.reproduction)}</p>
            </div>
          )}
          {d.ecology.hibernation && (
            <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
              <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">冬眠</h4>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.hibernation)}</p>
            </div>
          )}
          {d.ecology.flight && (
            <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
              <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">飛行能力</h4>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.flight)}</p>
            </div>
          )}
          {d.ecology.foraging && (
            <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
              <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">覓食行為</h4>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.foraging)}</p>
            </div>
          )}
          {d.ecology.diet && (
            <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
              <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">食性</h4>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.diet)}</p>
            </div>
          )}
          {d.ecology.lifespan && (
            <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
              <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">壽命</h4>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.lifespan)}</p>
            </div>
          )}
          {d.ecology.migration && (
            <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
              <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">遷徙</h4>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.migration)}</p>
            </div>
          )}
          {d.ecology.homeRange && (
            <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
              <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">活動範圍</h4>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.homeRange)}</p>
            </div>
          )}
          {d.ecology.vocalizations && (
            <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
              <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">發聲</h4>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.vocalizations)}</p>
            </div>
          )}
        </div>

        {/* 詳細食性比例進度條 */}
        <DietComposition data={d.ecology.dietComposition} lang="zh" />
        {/* 非百分比食性列表 */}
        <DietFoodList data={d.ecology.dietFoodLists} lang="zh" />
        {/* 棲息植物 */}
        <RoostingPlants data={d.ecology.roostingPlants} lang="zh" />
      </div>



      {/* 分布概況 Section (Full Width) */}
      <div className="bg-card-bg border border-border-custom rounded-3xl p-6 md:p-8 mb-8 md:mb-12 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <MapPin className="w-5 h-5 text-primary-accent" />
          <h2 className="text-lg sm:text-xl font-bold text-foreground">分布概況</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 text-xs">
          {/* 左欄: 本地分布 */}
          <div className="bg-background/40 p-5 rounded-2xl border border-border-custom/50 flex flex-col justify-between">
            <div>
              <span className="font-bold text-foreground block mb-2 text-sm">本地分布</span>
              <p className="text-muted-accent leading-relaxed mb-4">{d.distribution.local}</p>
            </div>
            {lookerStudioUrl ? (
              <div className="rounded-xl border border-border-custom/30 overflow-hidden bg-background/20 aspect-[3/2] w-full relative group">
                <iframe 
                  src={lookerStudioUrl} 
                  className="w-full h-full border-0 bg-transparent" 
                  scrolling="no" 
                  allowFullScreen
                  loading="lazy"
                  title="本地分布地圖"
                />
              </div>
            ) : (
              <div className="aspect-[3/2] w-full rounded-xl border border-border-custom/30 bg-background/30 flex flex-col items-center justify-center text-muted-accent/70 relative overflow-hidden">
                <MapPin className="w-5 h-5 text-primary-accent/50 mb-1.5" />
                <span className="text-[11px] font-bold tracking-wider">本地分布地圖</span>
                <span className="text-[9px] text-muted-accent/40">有待收集</span>
              </div>
            )}
          </div>

          {/* 右欄: 全球分布 */}
          <div className="bg-background/40 p-5 rounded-2xl border border-border-custom/50 flex flex-col justify-between">
            <div>
              <span className="font-bold text-foreground block mb-2 text-sm">全球分布與亞種</span>
              <div className="divide-y divide-border-custom/40 max-h-[150px] overflow-y-auto pr-1 mb-4 scrollbar-thin">
                {d.distribution.global.map((g) => (
                  <div key={g.name} className="py-2 first:pt-0 last:pb-0">
                    <span className="font-bold text-primary-accent block italic mb-0.5">{g.name}</span>
                    <p className="text-muted-accent leading-relaxed text-[11px]">{g.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            {maps.globalMap ? (
              <div className="rounded-xl border border-border-custom/30 overflow-hidden bg-background/20 aspect-video flex items-center justify-center relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={getOptimizedImageUrl(maps.globalMap)} 
                  alt="全球分布地圖" 
                  className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-500" 
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="aspect-video w-full rounded-xl border border-border-custom/30 bg-background/30 flex flex-col items-center justify-center text-muted-accent/70 relative overflow-hidden">
                <MapPin className="w-5 h-5 text-primary-accent/50 mb-1.5" />
                <span className="text-[11px] font-bold tracking-wider">全球分布地圖</span>
                <span className="text-[9px] text-muted-accent/40">有待收集</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 本地狀況與保護名錄 Section (Full Width) */}
      <div className="bg-card-bg border border-border-custom rounded-3xl p-6 md:p-8 mb-8 md:mb-12 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-primary-accent" />
          <h2 className="text-lg sm:text-xl font-bold text-foreground">本地狀況及保護名錄</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div className="bg-background/60 p-4 rounded-xl border border-border-custom/50">
            <span className="text-muted-accent block">首次記錄年份</span>
            <span className="font-bold text-foreground text-sm mt-1 block flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary-accent" />
              {species.firstRecord}
            </span>
          </div>
          <div className="bg-background/60 p-4 rounded-xl border border-border-custom/50">
            <span className="text-muted-accent block">物種來源</span>
            <span className="font-bold text-foreground text-sm mt-1 block">{species.origin.zh}</span>
          </div>
          <div className="bg-background/60 p-4 rounded-xl border border-border-custom/50">
            <span className="text-muted-accent block">本地生存現況</span>
            <span className="font-bold text-foreground text-sm mt-1 block">{species.localStatus.zh}</span>
          </div>
          <div className="bg-background/60 p-4 rounded-xl border border-border-custom/50">
            <span className="text-muted-accent block">國內現況 (中國脊椎動物紅色名錄)</span>
            <span className="font-bold text-red-500 dark:text-red-400 text-sm mt-1 block">
              {species.chinaStatus.zh ? species.chinaStatus.zh.replace(/\s*[\(（](?:中國脊椎動物紅色名錄|紅色名錄)[\)）]/g, "") : ""}
            </span>
          </div>
          <div className="bg-background/60 p-4 rounded-xl border border-border-custom/50 col-span-2 md:col-span-1">
            <span className="text-muted-accent block">全球現況 (IUCN紅色名錄)</span>
            <span className="font-bold text-green-500 dark:text-green-400 text-sm mt-1 block">
              {species.globalStatus.zh ? species.globalStatus.zh.replace(/\s*[\(（](?:IUCN紅色名錄|IUCN)[\)）]/g, "") : ""}
            </span>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border-custom/50">
          <span className="block text-xs font-bold text-muted-accent uppercase mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-red-500" />
            <span>潛在威脅與保護倡議</span>
          </span>
          <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.threats)}</p>
        </div>
      </div>

      {/* Echolocation Section */}
      {species.echolocations && species.echolocations.length > 0 && (
        <EcholocationSection data={species.echolocations} chirovoxUrl={species.chirovoxUrl} lang="zh" />
      )}

      {/* 相似物種 (Similar Species) */}
      <SimilarSpecies lang="zh" data={species.similarSpecies} currentCode={code} />

      {/* 參考文獻 (References) with client side expand/collapse */}
      <ReferencesList references={d.references} lang="zh" />
    </div>
  );
}


