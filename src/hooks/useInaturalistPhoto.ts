'use client';

import { useState, useEffect } from 'react';

const PHOTO_CACHE_KEY = 'inat_photo_cache';

/**
 * Hook to fetch species representative photo from iNaturalist API
 * @param taxonId iNaturalist Taxon ID
 * @returns { imageUrl: string | null, isLoading: boolean }
 */
export function useInaturalistPhoto(taxonId: number | string | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!taxonId) return;

    // 1. Try Cache First (sessionStorage for performance)
    const cachedData = sessionStorage.getItem(`${PHOTO_CACHE_KEY}_${taxonId}`);
    if (cachedData) {
      setImageUrl(cachedData);
      return;
    }

    // 2. Fetch from API
    async function fetchPhoto() {
      setIsLoading(true);
      try {
        const response = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
        if (!response.ok) throw new Error('API request failed');
        
        const data = await response.json();
        const photoUrl = data.results?.[0]?.default_photo?.medium_url || null;

        if (photoUrl) {
          setImageUrl(photoUrl);
          sessionStorage.setItem(`${PHOTO_CACHE_KEY}_${taxonId}`, photoUrl);
        }
      } catch (error) {
        console.error(`Failed to fetch iNaturalist photo for taxon ${taxonId}:`, error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPhoto();
  }, [taxonId]);

  return { imageUrl, isLoading };
}
