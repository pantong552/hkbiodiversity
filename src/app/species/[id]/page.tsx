import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { Species } from '@/types/species';
import SpeciesDetailClient from './SpeciesDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

async function getSpecies(id: string): Promise<Species | null> {
  const { data, error } = await supabase
    .from('species')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Species;
}

// 獲取 iNaturalist 圖片的輔助函數（伺服器端）
async function getInaturalistPhoto(taxonId: number | string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`, {
      next: { revalidate: 86400 } // 快取 24 小時
    });
    if (!response.ok) return null;
    const data = await response.json();
    const result = data.results?.[0];
    if (!result) return null;

    const photo = result.default_photo || result.taxon_photos?.[0]?.photo;
    if (!photo) return null;

    // 將 square 改為 medium 或 large
    return (photo.medium_url || photo.url || '').replace('/square.', '/medium.');
  } catch (error) {
    console.error('Error fetching iNaturalist photo:', error);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const species = await getSpecies(id);

  if (!species) {
    return {
      title: 'Species Not Found | HK Biodiversity Collective',
    };
  }

  const title = `香港生物多樣性 | ${species.common_name_chi} (${species.scientific_name})`;
  const description = `${species.common_name_chi} (${species.scientific_name}) - 詳盡的香港生物多樣性資料。類別：${species.class_chi} ${species.order_chi} ${species.family_chi}`;
  
  // 獲取縮圖 URL
  let imageUrl = species.image_url;
  if (!imageUrl && species.inat_id) {
    imageUrl = await getInaturalistPhoto(species.inat_id) || '';
  }

  // 預設縮圖（如果都沒有）
  if (!imageUrl) {
    imageUrl = 'https://hkbiodiversity.org/logo.svg'; // 稍後會改為自動生成的 OG 圖片
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: imageUrl ? [{ url: imageUrl }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

export default async function SpeciesPage({ params }: Props) {
  const { id } = await params;
  const species = await getSpecies(id);

  return (
    <SpeciesDetailClient id={id} initialSpecies={species} />
  );
}
