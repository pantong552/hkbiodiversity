import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpeciesByCode } from "@/lib/db";

export const revalidate = 3600; // ISR: 1-hour cache to reduce Supabase queries and improve page load speed

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





interface PageProps {
  params: Promise<{ species_code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const code = resolvedParams.species_code;

  const species = await getSpeciesByCode(code);
  if (!species) {
    return {
      title: "Species Not Found | HKBR",
    };
  }

  const d = species.en;
  const title = `${d.commonName} (${species.scientificName}) | Hong Kong Bat Species Information - HKBR`;
  const description = `${d.commonName} (Scientific: ${species.scientificName}) is one of the bat species found in Hong Kong. Family: ${species.family.en} (${species.family.scientific}). Distribution: ${d.distribution.local || "Hong Kong"}. Get detailed morphometrics, ecology, habits, echolocation frequencies, and scientific references.`;

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

export default async function EnSpeciesDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const code = resolvedParams.species_code;

  const species = await getSpeciesByCode(code);
  if (!species) {
    notFound();
  }

  const d = species.en;
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
            "description": `Detailed profile of ${d.commonName} (${species.scientificName}), including morphology, ecology, distribution, and echolocation data.`,
            "image": schemaImageUrl,
            "parentTaxon": {
              "@type": "Taxon",
              "name": species.genus.scientific,
              "commonName": species.genus.en,
              "taxonRank": "Genus",
              "parentTaxon": {
                "@type": "Taxon",
                "name": species.family.scientific,
                "commonName": species.family.en,
                "taxonRank": "Family"
              }
            }
          })
        }}
      />
      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/en/checklist"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-accent hover:text-primary-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Checklist</span>
        </Link>
      </div>

      {/* Species Title Section (Modernized Card Banner - Simplified) */}
      <div className="relative mb-8 bg-gradient-to-r from-card-bg/60 via-card-bg/40 to-background/5 border border-border-custom/30 rounded-3xl p-6 md:p-8 backdrop-blur-md overflow-hidden shadow-lg flex flex-col gap-6">
        {/* Background Radar Vector Effect */}
        <div className="absolute right-0 bottom-0 top-0 w-96 opacity-5 pointer-events-none select-none">
          <svg className="w-full h-full text-primary-accent" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="50" r="45" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="100" cy="50" r="30" stroke="currentColor" strokeWidth="1" />
            <circle cx="100" cy="50" r="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="100" y1="50" x2="55" y2="20" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Left: Names & Taxonomy badges */}
        <div className="z-10 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-primary-accent/10 border border-primary-accent/20 text-primary-accent select-none">
              {species.family.en}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/5 border border-white/10 text-muted-accent select-none">
              {species.genus.scientific}
            </span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight drop-shadow-sm">
            {d.commonName}
          </h1>
          
          {/* Micro Accent Decoration Line */}
          <div className="w-16 h-1 bg-gradient-to-r from-primary-accent to-transparent rounded-full mt-3.5 mb-2.5" />

          <div className="space-y-1">
            {d.otherCommonNames.length > 0 && (
              <p className="text-xs sm:text-sm text-muted-accent font-semibold">
                {d.otherCommonNames.join(", ")}
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

      {/* Full Width Gallery Carousel */}
      <div className="w-full mb-8 md:mb-12">
        {species.photos && species.photos.length > 0 && (
          <PhotoGallery 
            lang="en" 
            photos={species.photos} 
            speciesName={d.commonName} 
          />
        )}
      </div>

      {/* Taxonomy & Nomenclature (Full Width, 2 Columns) */}
      <div className="w-full bg-card-bg border border-border-custom rounded-3xl p-6 md:p-8 shadow-sm mb-8 md:mb-12">
        <div className="flex items-center gap-2 mb-6">
          <Layers className="w-5 h-5 text-primary-accent" />
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Taxonomy & Nomenclature</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
          {/* Left Column: Family, Genus, Common Names */}
          <div className="space-y-4">
            <div className="border-b border-border-custom/50 pb-2">
              <span className="block text-xs font-bold text-muted-accent uppercase">Family</span>
              <span className="text-foreground font-semibold mt-1 block">
                {species.family.en}
              </span>
            </div>
            <div className="border-b border-border-custom/50 pb-2">
              <span className="block text-xs font-bold text-muted-accent uppercase">Genus</span>
              <span className="text-foreground font-semibold mt-1 block">
                {species.genus.scientific}
              </span>
            </div>
            <div className="border-b border-border-custom/50 pb-2">
              <span className="block text-xs font-bold text-muted-accent uppercase">Local Common Name</span>
              <span className="text-foreground font-semibold mt-1 block">{d.commonName}</span>
            </div>
            {d.otherCommonNames.length > 0 && (
              <div className="border-b border-border-custom/50 pb-2">
                <span className="block text-xs font-bold text-muted-accent uppercase">Other Common Names</span>
                <span className="text-foreground mt-1 block">
                  {d.otherCommonNames.join(", ")}
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Synonyms, Taxonomic Notes */}
          <div className="space-y-4">
            {species.synonyms && species.synonyms.length > 0 && (
              <div className="border-b border-border-custom/50 pb-2">
                <span className="block text-xs font-bold text-muted-accent uppercase">Synonyms</span>
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
              <span className="block text-xs font-bold text-muted-accent uppercase mb-1">Taxonomic Notes</span>
              <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.taxonomicNotes)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 互動式外形特徵 (Full Width) */}
      <div className="mb-8 md:mb-12">
        <InteractiveAnatomy speciesCode={code} lang="en" hotspots={species.hotspots} />
      </div>

      {/* 外形特徵與測量參數 (3-Column Bento Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-6 md:gap-8 mb-8 md:mb-12">
        {/* Column 1: 外形特徵文字說明 */}
        <div className="bg-card-bg border border-border-custom rounded-3xl p-6 shadow-sm flex flex-col justify-between md:col-span-3">
          <div>
            <h3 className="font-bold text-foreground text-sm tracking-wider uppercase mb-4 flex items-center gap-1.5 border-b border-border-custom/40 pb-2">
              <Info className="w-4 h-4 text-primary-accent" />
              Morphological Features
              <ImageLightbox
                label="Body Structure Diagram"
                zhImageUrl="/wp-uploads/2024/02/Bat-anatomy.png"
                enImageUrl="/wp-uploads/2024/02/Bat-anatomy_eng.png"
                alt="Bat Anatomy Diagram"
                lang="en"
              />
            </h3>
            <div className="space-y-3.5 text-xs">
              <div className="border-b border-border-custom/30 pb-2">
                <span className="text-primary-accent font-bold block mb-1">Pelage</span>
                <p className="text-muted-accent leading-relaxed">{formatRichText(d.features.fur)}</p>
              </div>
              <div className="border-b border-border-custom/30 pb-2">
                <span className="text-primary-accent font-bold block mb-1">Ears</span>
                <p className="text-muted-accent leading-relaxed">{formatRichText(d.features.ears)}</p>
              </div>
              <div className="border-b border-border-custom/30 pb-2">
                <span className="text-primary-accent font-bold block mb-1">Head</span>
                <p className="text-muted-accent leading-relaxed">{formatRichText(d.features.head)}</p>
              </div>
              <div className="border-b border-border-custom/30 pb-2">
                <span className="text-primary-accent font-bold block mb-1">Limbs</span>
                <p className="text-muted-accent leading-relaxed">{formatRichText(d.features.limbs)}</p>
              </div>
              <div className="border-b border-border-custom/30 pb-2">
                <span className="text-primary-accent font-bold block mb-1">Tail</span>
                <p className="text-muted-accent leading-relaxed">{formatRichText(d.features.tail)}</p>
              </div>
              {d.features.other && (
                <div className="pb-1">
                  <span className="text-primary-accent font-bold block mb-1">Other</span>
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
              Morphometrics & Weight
              <ImageLightbox
                label="Measurement Reference"
                zhImageUrl="/wp-uploads/2023/12/Bat-measurment.png"
                enImageUrl="/wp-uploads/2023/12/Bat-measurment_eng.png"
                alt="Bat Measurement Reference Diagram"
                lang="en"
              />
            </h3>
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">Body Size Type</span>
                <span className="font-bold text-foreground">{d.bodySizeType}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">Head-body</span>
                <span className="font-bold text-foreground">{species.measurements.headBody}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">Tail</span>
                <span className="font-bold text-foreground">{species.measurements.tail}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">Ear</span>
                <span className="font-bold text-foreground">{species.measurements.ear}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">Hind foot</span>
                <span className="font-bold text-foreground">{species.measurements.hindFoot}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">Forearm</span>
                <span className="font-bold text-foreground">{species.measurements.forearm}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted-accent">Weight</span>
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
              <span className="flex-1">Wing Parameters</span>
              {(silhouetteUrls as Record<string, string>)[code] && (
                <ImageLightbox
                  label="Flight Silhouettes"
                  zhImageUrl={(silhouetteUrls as Record<string, string>)[code]}
                  enImageUrl={(silhouetteUrls as Record<string, string>)[code]}
                  alt={`${d.commonName} Flight Silhouettes`}
                  lang="en"
                  buttonText="View Silhouettes"
                  showLangSwitch={false}
                />
              )}
            </h3>
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">Wing length</span>
                <span className="font-bold text-foreground">{species.wingParams.length}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">Wing area</span>
                <span className="font-bold text-foreground">{species.wingParams.area}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">Wing loading</span>
                <span className="font-bold text-foreground">{species.wingParams.loading}</span>
              </div>
              <div className="flex justify-between border-b border-border-custom/30 pb-2">
                <span className="text-muted-accent">Aspect ratio</span>
                <span className="font-bold text-foreground">{species.wingParams.aspectRatio}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted-accent">Tip index</span>
                <span className="font-bold text-foreground">{species.wingParams.tipIndex}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border-custom/40 text-[10px] text-muted-accent flex items-center gap-1">
            <span>Reference: {refText}</span>
            {refUrl && (
              <a 
                href={refUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-primary-accent hover:text-primary-accent/80 transition-colors ml-0.5"
                title="View Reference Source"
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
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Ecology & Behavior</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
            <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">Roost & Habitat</h4>
            <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.habitat)}</p>
          </div>
          <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
            <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">Habits & Sociality</h4>
            <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.habits)}</p>
          </div>
          <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
            <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">Reproduction</h4>
            <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.reproduction)}</p>
          </div>
          <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
            <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">Flight Capabilities</h4>
            <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.flight)}</p>
          </div>
          <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
            <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">Foraging Behavior</h4>
            <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.foraging)}</p>
          </div>
          <div className="bg-background/40 backdrop-blur-xs p-5 md:p-6 rounded-2xl border border-border-custom/40 hover:-translate-y-1 hover:border-primary-accent/30 transition-all duration-300 shadow-inner group/eco">
            <h4 className="font-bold text-foreground text-sm border-l-3 border-primary-accent pl-2.5 mb-3 group-hover/eco:text-primary-accent transition-colors">Diet</h4>
            <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.ecology.diet)}</p>
          </div>
        </div>

        {/* Detailed Diet Progress Bars */}
        <DietComposition data={d.ecology.dietComposition} lang="en" />
        {/* Non-percentage Diet Food Lists */}
        <DietFoodList data={d.ecology.dietFoodLists} lang="en" />
        {/* Roosting Plants */}
        <RoostingPlants data={d.ecology.roostingPlants} lang="en" />
      </div>



      {/* Distribution Section (Full Width) */}
      <div className="bg-card-bg border border-border-custom rounded-3xl p-6 md:p-8 mb-8 md:mb-12 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <MapPin className="w-5 h-5 text-primary-accent" />
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Distribution</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 text-xs">
          {/* Left Column: Local Distribution */}
          <div className="bg-background/40 p-5 rounded-2xl border border-border-custom/50 flex flex-col justify-between">
            <div>
              <span className="font-bold text-foreground block mb-2 text-sm">Local Distribution</span>
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
                  title="Local Distribution Map"
                />
              </div>
            ) : (
              <div className="aspect-[3/2] w-full rounded-xl border border-border-custom/30 bg-background/30 flex flex-col items-center justify-center text-muted-accent/70 relative overflow-hidden">
                <MapPin className="w-5 h-5 text-primary-accent/50 mb-1.5" />
                <span className="text-[11px] font-bold tracking-wider">Local Distribution Map</span>
                <span className="text-[9px] text-muted-accent/40">Pending Map Integration</span>
              </div>
            )}
          </div>

          {/* Right Column: Global Distribution */}
          <div className="bg-background/40 p-5 rounded-2xl border border-border-custom/50 flex flex-col justify-between">
            <div>
              <span className="font-bold text-foreground block mb-2 text-sm">Global Distribution & Subspecies</span>
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
                  alt="Global Distribution Map" 
                  className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-500" 
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="aspect-video w-full rounded-xl border border-border-custom/30 bg-background/30 flex flex-col items-center justify-center text-muted-accent/70 relative overflow-hidden">
                <MapPin className="w-5 h-5 text-primary-accent/50 mb-1.5" />
                <span className="text-[11px] font-bold tracking-wider">Global Distribution Map</span>
                <span className="text-[9px] text-muted-accent/40">Pending Map Integration</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status & Red Lists Section (Full Width) */}
      <div className="bg-card-bg border border-border-custom rounded-3xl p-6 md:p-8 mb-8 md:mb-12 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-primary-accent" />
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Status & Red Lists</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div className="bg-background/60 p-4 rounded-xl border border-border-custom/50">
            <span className="text-muted-accent block">First Record Year</span>
            <span className="font-bold text-foreground text-sm mt-1 block flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary-accent" />
              {species.firstRecord}
            </span>
          </div>
          <div className="bg-background/60 p-4 rounded-xl border border-border-custom/50">
            <span className="text-muted-accent block">Origin</span>
            <span className="font-bold text-foreground text-sm mt-1 block">{species.origin.en}</span>
          </div>
          <div className="bg-background/60 p-4 rounded-xl border border-border-custom/50">
            <span className="text-muted-accent block">Local Status</span>
            <span className="font-bold text-foreground text-sm mt-1 block">{species.localStatus.en}</span>
          </div>
          <div className="bg-background/60 p-4 rounded-xl border border-border-custom/50">
            <span className="text-muted-accent block">National Status (China Red List of Vertebrates)</span>
            <span className="font-bold text-red-500 dark:text-red-400 text-sm mt-1 block">
              {species.chinaStatus.en ? species.chinaStatus.en.replace(/\s*[\(（](?:China Red List|Red List)[\)）]/gi, "") : ""}
            </span>
          </div>
          <div className="bg-background/60 p-4 rounded-xl border border-border-custom/50 col-span-2 md:col-span-1">
            <span className="text-muted-accent block">Global Status (IUCN Red List)</span>
            <span className="font-bold text-green-500 dark:text-green-400 text-sm mt-1 block">
              {species.globalStatus.en ? species.globalStatus.en.replace(/\s*[\(（](?:IUCN Red List|IUCN)[\)）]/gi, "") : ""}
            </span>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border-custom/50">
          <span className="block text-xs font-bold text-muted-accent uppercase mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-red-500" />
            <span>Threats & Conservation</span>
          </span>
          <p className="text-muted-accent text-xs leading-relaxed">{formatRichText(d.threats)}</p>
        </div>
      </div>

      {/* Echolocation Section */}
      {species.echolocations && species.echolocations.length > 0 && (
        <EcholocationSection data={species.echolocations} chirovoxUrl={species.chirovoxUrl} lang="en" />
      )}

      {/* Similar Species */}
      <SimilarSpecies lang="en" data={species.similarSpecies} currentCode={code} />

      {/* References with client side expand/collapse */}
      <ReferencesList references={d.references} lang="en" />
    </div>
  );
}


