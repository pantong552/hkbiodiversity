'use client';

import { useState, useEffect, useCallback } from 'react';

export interface InatGalleryPhoto {
  id: string | number;
  url: string;
  small_url: string;
  medium_url: string;
  large_url: string;
  original_url: string;
  attribution: string;
  licenseCode: string | null;
  nativePageUrl: string | null;
  observationUrl: string | null;
}

/**
 * iNaturalist 圖片解析度轉換輔助函數
 * 防止 API 回傳 null 時導致圖片過於模糊 (預設 url 通常是 75x75 的 square.jpg)
 */
const convertInatUrl = (url: string, size: 'square' | 'small' | 'medium' | 'large' | 'original') => {
  if (!url) return '';
  // iNaturalist 的網址通常包含尺寸字串，如 /square.jpg 或 ?size=square
  // 在 API v2 中，通常是將 "square" 替換為其他尺寸
  return url
    .replace('/square.', `/${size}.`)
    .replace('/medium.', `/${size}.`)
    .replace('/large.', `/${size}.`)
    .replace('/small.', `/${size}.`)
    .replace('size=square', `size=${size}`)
    .replace('size=medium', `size=${size}`);
};

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

async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<any> {
  await enqueueRequest();
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        releaseRequest();
        await new Promise(resolve => setTimeout(resolve, delay * 2));
        return fetchWithRetry(url, retries - 1, delay * 2);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (retries > 0) {
      releaseRequest();
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, retries - 1, delay * 1.5);
    }
    throw error;
  } finally {
    releaseRequest();
  }
}

/**
 * Hook to fetch species gallery photos from iNaturalist API v2
 * Supports pagination ("Load More")
 */
export function useInaturalistSpeciesPhotos(taxonId: number | string | undefined) {
  const [photos, setPhotos] = useState<InatGalleryPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPhotos = useCallback(async (pageNum: number, isInitial = false) => {
    if (!taxonId) return;
    setIsLoading(true);

    try {
      // Using API v2 Observations endpoint to get more photos
      // Fields selection for performance, including all resolutions and outer id
      // Filtered by: quality_grade=research, place_id=7613 (Hong Kong)
      const fields = '(id:!t,photos:(id:!t,url:!t,small_url:!t,medium_url:!t,large_url:!t,original_url:!t,attribution:!t,license_code:!t))';
      const url = `https://api.inaturalist.org/v2/observations?taxon_id=${taxonId}&quality_grade=research&place_id=7613&per_page=12&page=${pageNum}&order=desc&order_by=votes&fields=${fields}`;
      
      const data = await fetchWithRetry(url);
      
      const newPhotos: InatGalleryPhoto[] = (data.results || []).flatMap((obs: any) => 
        (obs.photos || [])
          .filter((p: any) => p.license_code !== null) // 僅保留有開放授權的照片 (All Rights Reserved 的為 null)
          .map((p: any) => {
            let author = 'Unknown';
          if (p.attribution) {
            author = p.attribution
              .replace(/\(c\)/gi, '')
              .replace(/some rights reserved/gi, '')
              .replace(/uploaded by.*/gi, '')
              .replace(/licensed under.*/gi, '')
              .split('(')[0]
              .split(',')[0]
              .trim();
          }

          return {
            id: p.id || `photo-${Math.random()}`,
            url: p.url,
            small_url: p.small_url || convertInatUrl(p.url, 'small'),
            medium_url: p.medium_url || convertInatUrl(p.url, 'medium'),
            large_url: p.large_url || convertInatUrl(p.url, 'large'),
            original_url: p.original_url || convertInatUrl(p.url, 'original'),
            attribution: `© ${author} (${p.license_code?.toUpperCase() || 'CC0'})`,
            licenseCode: p.license_code,
            nativePageUrl: `https://www.inaturalist.org/photos/${p.id}`,
            observationUrl: obs.id ? `https://www.inaturalist.org/observations/${obs.id}` : null
          };
        })
      );

      // Deduplicate by ID
      setPhotos(prev => {
        const combined = isInitial ? newPhotos : [...prev, ...newPhotos];
        const unique = Array.from(new Map(combined.map(p => [p.id, p])).values());
        return unique;
      });

      setTotalCount(data.total_results || 0);
      setHasMore(newPhotos.length > 0 && (pageNum * 12) < (data.total_results || 1000));
    } catch (error) {
      console.error('Failed to fetch iNaturalist gallery photos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [taxonId]);

  useEffect(() => {
    if (taxonId) {
      setPhotos([]);
      setPage(1);
      setHasMore(true);
      fetchPhotos(1, true);
    }
  }, [taxonId, fetchPhotos]);

  const loadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPhotos(nextPage);
    }
  };

  return {
    photos,
    isLoading,
    hasMore,
    totalCount,
    loadMore
  };
}
