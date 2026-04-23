import { Metadata } from 'next';
import { Suspense } from 'react';
import HomeClient from '@/components/HomeClient';
import { getSpeciesById, getSpeciesImageUrl } from '@/lib/species';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(props: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined }
}): Promise<Metadata> {
  // 適配不同版本的 Next.js searchParams 處理
  const searchParams = 'then' in props.searchParams ? await props.searchParams : props.searchParams;
  const speciesId = typeof searchParams.species === 'string' ? searchParams.species : undefined;
  
  const baseUrl = 'https://hkbiodiversity.org';
  const defaultTitle = 'Hong Kong Biodiversity Collective | 香港自然生態匯誌';
  const defaultDescription = 'A collaborative biodiversity encyclopedia of Hong Kong, covering approximately 10,000 species.';

  if (!speciesId) {
    return {
      title: defaultTitle,
      description: defaultDescription,
      alternates: {
        canonical: baseUrl,
      },
      openGraph: {
        title: defaultTitle,
        description: defaultDescription,
        type: 'website',
        url: baseUrl,
        images: [
          {
            url: `${baseUrl}/api/og`,
            width: 1200,
            height: 630,
            alt: defaultTitle,
          }
        ]
      },
      twitter: {
        card: 'summary_large_image',
        title: defaultTitle,
        description: defaultDescription,
        images: [`${baseUrl}/api/og`],
      }
    };
  }

  // Fetch species data for dynamic metadata if ID is present
  const species = await getSpeciesById(speciesId);
  if (!species) return { title: defaultTitle };

  const commonName = species.common_name_chi || species.common_name_eng || species.scientific_name;
  const scientificName = species.scientific_name;
  const imageUrl = await getSpeciesImageUrl(species);
  const canonicalUrl = `${baseUrl}/?species=${speciesId}`;

  const dynamicTitle = `${commonName} (${scientificName}) | HK Biodiversity Collective`;
  const dynamicDescription = `在香港自然生態匯誌查看 ${commonName} 的詳細資料。分類：${species.class_eng || ''} ${species.order_eng || ''} ${species.family_eng || ''}`;
  
  // Default social image fallback
  const finalImageUrl = imageUrl || `${baseUrl}/api/og`;

  return {
    title: dynamicTitle,
    description: dynamicDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: dynamicTitle,
      description: dynamicDescription,
      images: [
        {
          url: finalImageUrl,
          width: 1200,
          height: 630,
          alt: commonName,
        }
      ],
      type: 'article',
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: dynamicTitle,
      description: dynamicDescription,
      images: [finalImageUrl],
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
