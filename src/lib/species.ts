import { supabase } from './supabase';
import { Species } from '@/types/species';

/**
 * Fetch a single species by ID (Supports taxa_id, numeric ID, or legacy inat_id)
 */
export async function getSpeciesById(id: string | number): Promise<Species | null> {
  const inputId = String(id);
  const isFaunaId = inputId.startsWith('fauna_');
  const isFloraId = inputId.startsWith('flora_');
  const numericId = !isNaN(Number(inputId)) ? parseInt(inputId, 10) : null;

  // 1. 嘗試依照 taxa_id 格式進行精準查詢
  if (isFaunaId) {
    const { data } = await supabase.from('species').select('*').eq('taxa_id', inputId).maybeSingle();
    return data as Species | null;
  }

  if (isFloraId) {
    const { data: plantData } = await supabase.from('plant_species').select('*').eq('taxa_id', inputId).maybeSingle();
    if (plantData) return mapPlantToSpecies(plantData);
  }

  // 2. 兼容性查詢 (舊版數字 ID)
  if (numericId !== null) {
    // 優先查動物表 (id 或 inat_id)
    const { data: faunaData } = await supabase.from('species').select('*')
      .or(`id.eq.${numericId},inat_id.eq.${numericId}`).maybeSingle();
    if (faunaData) return faunaData as Species;

    // 再查植物表 (inat_id)
    const { data: plantData } = await supabase.from('plant_species').select('*')
      .eq('inat_id', numericId).maybeSingle();
    if (plantData) return mapPlantToSpecies(plantData);
  }

  return null;
}

// 輔助函數：將植物資料映射為 Species 結構以便 Metadata 使用
function mapPlantToSpecies(plantData: any): Species {
  return {
    ...plantData,
    taxa_group: 'FLORA',
    common_name_chi: plantData.common_name_chi,
    common_name_eng: plantData.common_name_eng,
    scientific_name: plantData.scientific_name,
    family_chi: plantData.family_chi,
    family_eng: plantData.family_eng,
    genus_chi: plantData.genus_chi,
    genus_eng: plantData.genus_eng,
    class_chi: plantData.category_chi,
    class_eng: plantData.category_eng,
    order_eng: plantData.family_eng,
    habitat_chi: plantData.habitat_chi,
    habitat_eng: plantData.habitat_eng,
    description_chi: plantData.description_chi,
    description_eng: plantData.description_eng,
    remarks_chi: plantData.remark_chi,
    remarks_eng: plantData.remark_eng,
  } as unknown as Species;
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
 * Get the best available species image URL (Now fully dynamic via iNaturalist)
 */
export async function getSpeciesImageUrl(species: Species): Promise<string | null> {
  let finalUrl: string | null = null;
  
  if (species.inat_id) {
    finalUrl = await getInaturalistPhoto(species.inat_id);
  }
  
  if (!finalUrl) return null;
  
  // Ensure HTTPS
  return finalUrl.startsWith('http:') ? finalUrl.replace('http:', 'https:') : finalUrl;
}
