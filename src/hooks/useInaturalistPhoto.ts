'use client';

import { useState, useEffect } from 'react';

const PHOTO_CACHE_KEY = 'inat_photo_cache_v2';
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

const convertInatUrl = (url: string, size: 'square' | 'small' | 'medium' | 'large' | 'original') => {
  if (!url) return '';
  return url
    .replace('/square.', `/${size}.`)
    .replace('/medium.', `/${size}.`)
    .replace('/large.', `/${size}.`)
    .replace('/small.', `/${size}.`)
    .replace('size=square', `size=${size}`)
    .replace('size=medium', `size=${size}`);
};

/**
 * 將圖片 URL 轉換為自建的 WebP 代理 API URL
 */
const getProxyUrl = (url: string, id: string | number, size: string = 'medium') => {
  if (!url) return '';
  // 僅代理 iNaturalist 的圖片
  if (url.includes('inaturalist')) {
    return `/api/image/transform?url=${encodeURIComponent(url)}&id=${id}&size=${size}`;
  }
  return url;
};


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
  // 若有 taxonId，初始就是載入中狀態，避免短暫 placeholder 閃爍的 Race Condition
  const [isLoading, setIsLoading] = useState(!!taxonId);

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

        const allTaxonPhotos = [
          result.default_photo,
          ...(result.taxon_photos || []).map((tp: any) => tp.photo)
        ].filter(p => p !== undefined && p !== null);

        // 優先從 Taxa 官方圖中找有授權的
        let validPhoto = allTaxonPhotos.find((p: any) => p.license_code !== null);

        // --- FALLBACK: Try Observations API ---
        if (!validPhoto) {
          // 1. 嘗試抓取香港區域 (place_id=7613) 的研究級觀測
          const hkObsUrl = `https://api.inaturalist.org/v1/observations?taxon_id=${tId}&quality_grade=research&place_id=7613&per_page=5&order_by=votes`;
          const hkObsData = await fetchWithRetry(hkObsUrl);
          
          if (hkObsData.results && hkObsData.results.length > 0) {
            for (const obs of hkObsData.results) {
              const p = obs.photos?.find((p: any) => p.license_code !== null);
              if (p) {
                validPhoto = p;
                break;
              }
            }
          }

          // 2. 如果香港沒有，嘗試抓取全球 (Global) 的研究級觀測
          if (!validPhoto) {
            const globalObsUrl = `https://api.inaturalist.org/v1/observations?taxon_id=${tId}&quality_grade=research&per_page=5&order_by=votes`;
            const globalObsData = await fetchWithRetry(globalObsUrl);
            
            if (globalObsData.results && globalObsData.results.length > 0) {
              for (const obs of globalObsData.results) {
                const p = obs.photos?.find((p: any) => p.license_code !== null);
                if (p) {
                  validPhoto = p;
                  break;
                }
              }
            }
          }
        }

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
            // Use medium resolution for cards to balance quality and mobile loading speed
            url: getProxyUrl(convertInatUrl(validPhoto.medium_url || validPhoto.url, 'medium'), tId, 'medium'),
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
