import { supabase } from './supabase';
import { Species } from '@/types/species';

/**
 * Fetch a single species by ID
 */
export async function getSpeciesById(id: string | number): Promise<Species | null> {
  const { data, error } = await supabase
    .from('species')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Species;
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

    // Convert square to medium or large
    return (photo.medium_url || photo.url || '').replace('/square.', '/medium.');
  } catch (error) {
    console.error('Error fetching iNaturalist photo:', error);
    return null;
  }
}

/**
 * Get the best available species image URL
 */
export async function getSpeciesImageUrl(species: Species): Promise<string | null> {
  if (species.image_url) return species.image_url;
  if (species.species_id) {
    return await getInaturalistPhoto(species.species_id);
  }
  return null;
}
