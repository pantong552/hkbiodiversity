'use client';

import { useState, useEffect } from 'react';

const PHOTO_CACHE_KEY = 'inat_photo_cache';
const pendingRequests = new Map<string, Promise<any>>();

// --- Concurrency Control Queue ---
const MAX_CONCURRENT = 3; 
let currentActive = 0;
const queue: (() => void)[] = [];

async function enqueueRequest() {
  if (currentActive < MAX_CONCURRENT) {
    currentActive++;
    return;
  }
  return new Promise<void>(resolve => {
    queue.push(resolve);
  });
}

function releaseRequest() {
  currentActive--;
  const next = queue.shift();
  if (next) {
    currentActive++;
    next();
  }
}

export interface InatPhoto {
  url: string;
  attribution: string;
  licenseCode: string | null;
  nativePageUrl: string | null;
}

/**
 * Helper to fetch with retry, exponential backoff, AND concurrency control
 */
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<any> {
  // Wait for our turn in the queue
  await enqueueRequest();
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        // Rate limited - release early, wait, then will re-enqueue in next retry
        releaseRequest();
        await new Promise(resolve => setTimeout(resolve, delay * 2));
        return fetchWithRetry(url, retries - 1, delay * 2);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    if (retries > 0) {
      releaseRequest();
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, retries - 1, delay * 1.5);
    }
    throw error;
  } finally {
    // Release the spot in the queue
    releaseRequest();
  }
}

/**
 * Hook to fetch species representative photo from iNaturalist API
 * Supports scanning multiple photos to find one with an open license (non-ARR)
 * Includes retry, deduplication, and concurrency control for maximum stability
 */
export function useInaturalistPhoto(taxonId: number | string | undefined) {
  const [photoData, setPhotoData] = useState<InatPhoto | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!taxonId) return;

    const tId = taxonId.toString();

    // 1. Try Cache First
    const cached = sessionStorage.getItem(`${PHOTO_CACHE_KEY}_${tId}`);
    if (cached) {
      try {
        setPhotoData(JSON.parse(cached));
        return;
      } catch (e) {
        sessionStorage.removeItem(`${PHOTO_CACHE_KEY}_${tId}`);
      }
    }

    // 2. Fetch from API with Deduplication & Queue Control
    let isMounted = true;
    async function fetchPhoto() {
      setIsLoading(true);
      try {
        let requestPromise = pendingRequests.get(tId);
        
        if (!requestPromise) {
          requestPromise = fetchWithRetry(`https://api.inaturalist.org/v1/taxa/${tId}`);
          pendingRequests.set(tId, requestPromise);
          
          requestPromise.finally(() => {
            pendingRequests.delete(tId);
          });
        }

        const data = await requestPromise;
        if (!isMounted) return;

        const result = data.results?.[0];
        if (!result) return;

        const allPhotos = [
          result.default_photo,
          ...(result.taxon_photos || []).map((tp: any) => tp.photo)
        ].filter(p => p !== undefined && p !== null);

        const validPhoto = allPhotos.find(p => p.license_code !== null);

        if (validPhoto) {
          let author = 'Unknown';
          if (validPhoto.attribution_name) {
            author = validPhoto.attribution_name;
          } else if (validPhoto.attribution) {
            author = validPhoto.attribution
              .replace(/\(c\)/gi, '')
              .replace(/some rights reserved/gi, '')
              .replace(/uploaded by.*/gi, '')
              .replace(/licensed under.*/gi, '')
              .replace(/,\s*,/g, ',')
              .split('(')[0]
              .split(',')[0]
              .trim();
          }
          
          const licenseDisplay = validPhoto.license_code?.toUpperCase() || '';
          const simplifiedAttribution = `${author} (${licenseDisplay})`;
          const nativeUrl = validPhoto.native_page_url || `https://www.inaturalist.org/photos/${validPhoto.id}`;

          const finalData: InatPhoto = {
            url: validPhoto.medium_url || validPhoto.url,
            attribution: simplifiedAttribution,
            licenseCode: validPhoto.license_code,
            nativePageUrl: nativeUrl
          };
          
          if (isMounted) {
            setPhotoData(finalData);
            sessionStorage.setItem(`${PHOTO_CACHE_KEY}_${tId}`, JSON.stringify(finalData));
          }
        } else {
          if (isMounted) setPhotoData(null);
        }
      } catch (error) {
        console.error(`Failed to fetch iNaturalist photo for taxon ${tId}:`, error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchPhoto();
    return () => { isMounted = false; };
  }, [taxonId]);

  return { 
    imageUrl: photoData?.url || null, 
    attribution: photoData?.attribution || null,
    licenseCode: photoData?.licenseCode || null,
    nativePageUrl: photoData?.nativePageUrl || null,
    isLoading 
  };
}
