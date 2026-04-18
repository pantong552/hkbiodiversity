import { Suspense } from 'react';
import HomeClient from '@/components/HomeClient';
import { Metadata } from 'next';
import { getSpeciesById, getSpeciesImageUrl } from '@/lib/species';

export async function generateMetadata({ 
  searchParams 
}: { 
  searchParams: { species?: string } 
}): Promise<Metadata> {
  const speciesId = searchParams.species;
  
  // Default metadata for home page
  const defaultTitle = 'Hong Kong Biodiversity Collective | 香港生物多樣性';
  const defaultDescription = 'A comprehensive biodiversity encyclopedia of Hong Kong, covering approximately 10,000 species.';
  
  if (!speciesId) {
    return {
      title: defaultTitle,
      description: defaultDescription,
      openGraph: {
        title: defaultTitle,
        description: defaultDescription,
        type: 'website',
      }
    };
  }

  // Fetch species data for dynamic metadata if ID is present
  const species = await getSpeciesById(speciesId);
  if (!species) return { title: defaultTitle };

  const commonName = species.common_name_chi || species.common_name_eng || species.scientific_name;
  const scientificName = species.scientific_name;
  const imageUrl = await getSpeciesImageUrl(species);

  const dynamicTitle = `${commonName} (${scientificName}) | HK Biodiversity`;
  const dynamicDescription = `在香港生物多樣性圖鑑查看 ${commonName} 的詳細資料。分類：${species.class_eng || ''} ${species.order_eng || ''} ${species.family_eng || ''}`;

  return {
    title: dynamicTitle,
    description: dynamicDescription,
    openGraph: {
      title: dynamicTitle,
      description: dynamicDescription,
      images: imageUrl ? [{ url: imageUrl }] : [],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: dynamicTitle,
      description: dynamicDescription,
      images: imageUrl ? [imageUrl] : [],
    }
  };
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-slate-400 font-bold uppercase tracking-widest text-xs">LOADING...</div>}>
      <HomeClient />
    </Suspense>
  );
}
