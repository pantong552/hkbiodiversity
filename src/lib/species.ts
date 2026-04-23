import { supabase } from './supabase';
import { Species } from '@/types/species';

/**
 * Fetch a single species by ID
 */
export async function getSpeciesById(id: string | number): Promise<Species | null> {
  const numericId = typeof id === 'string' && !isNaN(Number(id)) ? parseInt(id, 10) : null;
  const isUuid = typeof id === 'string' && id.includes('-');

  // 1. 嘗試從動物表 (Fauna) 查詢
  let faunaQuery = supabase.from('species').select('*');
  if (numericId !== null) {
      faunaQuery = faunaQuery.or(`id.eq.${numericId},inat_id.eq.${numericId}`);
  } else {
      // 找不到數字表示不可能在 fauna 的 ID 或 species_id 查到
      faunaQuery = faunaQuery.eq('id', -1); // Dummy query that fails
  }

  const { data: faunaData } = await faunaQuery.maybeSingle();

  if (faunaData) {
      return faunaData as Species;
  }

  // 2. 如果動物表沒有，嘗試從植物表 (Flora) 查詢
  let floraQuery = supabase.from('plant_species').select('*');
  if (isUuid) {
      floraQuery = floraQuery.eq('id', id);
  } else if (numericId !== null) {
      floraQuery = floraQuery.eq('inat_id', numericId);
  } else {
      return null;
  }

  const { data: plantData } = await floraQuery.maybeSingle();

  if (plantData) {
      // 將植物資料映射為 Species 結構以便 Metadata 使用
      return {
          ...plantData,
          id: plantData.inat_id, // 使用 inat_id 作為回傳的 id
          taxa_group: 'FLORA',
          common_name_chi: plantData.common_name_zh,
          common_name_eng: plantData.common_name_en,
          scientific_name: plantData.scientific_name,
          class_eng: plantData.category_en,
          order_eng: plantData.family_en,
          family_eng: plantData.family_en,
          image_url: plantData.image_url,
          inat_id: plantData.inat_id
      } as unknown as Species;
  }

  return null;
}

/**
 * Fetch iNaturalist photo URL for a given taxon ID
 */
export async function getInaturalistPhoto(taxonId: number | string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`, {
      next: { revalidate: 86400 } // Cache for 24 hours
    });
    if (!response.ok) return null;
    const data = await response.json();
    const result = data.results?.[0];
    if (!result) return null;

    const photo = result.default_photo || result.taxon_photos?.[0]?.photo;
    if (!photo) return null;

    const photoUrl = (photo.medium_url || photo.url || '').replace('/square.', '/medium.');
    if (!photoUrl) return null;
    return photoUrl.startsWith('http:') ? photoUrl.replace('http:', 'https:') : photoUrl;
  } catch (error) {
    console.error('Error fetching iNaturalist photo:', error);
    return null;
  }
}

/**
 * Get the best available species image URL
 */
export async function getSpeciesImageUrl(species: Species): Promise<string | null> {
  let finalUrl: string | null = null;
  
  if (species.image_url && species.image_url !== '') {
    finalUrl = species.image_url;
  } else if (species.inat_id) {
    finalUrl = await getInaturalistPhoto(species.inat_id);
  }
  
  if (!finalUrl) return null;
  
  // Ensure HTTPS
  return finalUrl.startsWith('http:') ? finalUrl.replace('http:', 'https:') : finalUrl;
}
