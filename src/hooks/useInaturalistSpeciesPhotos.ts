'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

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
  observedOn: string | null;
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
  if (url.includes('inaturalist')) {
    return `/api/image/transform?url=${encodeURIComponent(url)}&id=${id}&size=${size}`;
  }
  return url;
};


async function fetchWithRetry(url: string, retries = 3): Promise<any> {

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      if (response.status === 429 && i < retries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
}

export function useInaturalistSpeciesPhotos(taxonId: number | string | undefined) {
  const supabase = createClient();
  
  const [state, setState] = useState({
    photos: [] as InatGalleryPhoto[],
    isLoading: false,
    hasMore: true,
    totalCount: 0,
    dataScope: 'hongkong' as 'hongkong' | 'global',
    hasHkPhotos: true, // Assume true until proven otherwise
    page: 1
  });

  // Use a ref to prevent overlapping fetches and infinite loops
  const isFetchingRef = useRef(false);
  const currentTaxonIdRef = useRef<string | number | undefined>(undefined);

  const fetchCommunityPhotos = useCallback(async () => {
    if (!taxonId) return [];
    try {
      const { data, error } = await supabase
        .from('species_community_photos')
        .select('*')
        .eq('taxa_id', taxonId.toString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(p => {
        let imageUrl = p.image_url;
        
        // 如果是 Cloudinary 網址，加入優化參數 (f_auto, q_auto)
        if (imageUrl.includes('res.cloudinary.com')) {
          imageUrl = imageUrl.replace('/upload/', '/upload/f_auto,q_auto/');
        }

        return {
          id: p.id,
          url: imageUrl,
          small_url: imageUrl.includes('res.cloudinary.com') ? imageUrl.replace('/upload/f_auto,q_auto/', '/upload/f_auto,q_auto,w_400,c_limit/') : imageUrl,
          medium_url: imageUrl.includes('res.cloudinary.com') ? imageUrl.replace('/upload/f_auto,q_auto/', '/upload/f_auto,q_auto,w_800,c_limit/') : imageUrl,
          large_url: imageUrl,
          original_url: imageUrl,
          attribution: `© ${p.author_name} (${p.license})`,
          licenseCode: p.license,
          nativePageUrl: null,
          observationUrl: null,
          observedOn: p.created_at
        };
      });
    } catch (err) {
      console.error('Error fetching community photos:', err);
      return [];
    }
  }, [taxonId, supabase]);

  const fetchInternal = useCallback(async (pageNum: number, scope: 'hongkong' | 'global', isInitial: boolean) => {
    if (!taxonId) return;
    
    const placeParam = scope === 'hongkong' ? '&place_id=7613' : '';
    const fields = '(id:!t,observed_on:!t,photos:(id:!t,url:!t,small_url:!t,medium_url:!t,large_url:!t,original_url:!t,attribution:!t,license_code:!t))';
    const url = `https://api.inaturalist.org/v2/observations?taxon_id=${taxonId}&quality_grade=research${placeParam}&per_page=12&page=${pageNum}&order=desc&order_by=votes&fields=${fields}`;

    const data = await fetchWithRetry(url);
    
    const mappedPhotos: InatGalleryPhoto[] = (data.results || []).flatMap((obs: any) => 
      (obs.photos || [])
        .filter((p: any) => p.license_code !== null)
        .map((p: any) => {
          let author = 'Unknown';
          if (p.attribution) {
            author = p.attribution
              .replace(/\(c\)/gi, '')
              .replace(/some rights reserved/gi, '')
              .replace(/uploaded by.*/gi, '')
              .replace(/licensed under.*/gi, '')
              .split('(')[0].split(',')[0].trim();
          }

          return {
            id: p.id || `photo-${Math.random()}`,
            url: getProxyUrl(p.url, taxonId || 'image', 'original'),
            small_url: getProxyUrl(p.small_url || convertInatUrl(p.url, 'small'), taxonId || 'image', 'small'),
            medium_url: getProxyUrl(p.medium_url || convertInatUrl(p.url, 'medium'), taxonId || 'image', 'medium'),
            large_url: getProxyUrl(p.large_url || convertInatUrl(p.url, 'large'), taxonId || 'image', 'large'),
            original_url: getProxyUrl(p.original_url || convertInatUrl(p.url, 'original'), taxonId || 'image', 'original'),
            attribution: `© ${author} (${p.license_code?.toUpperCase() || 'CC0'})`,


            licenseCode: p.license_code,
            nativePageUrl: `https://www.inaturalist.org/photos/${p.id}`,
            observationUrl: obs.id ? `https://www.inaturalist.org/observations/${obs.id}` : null,
            observedOn: obs.observed_on || null
          };
        })
    );

    return {
      photos: mappedPhotos,
      totalResults: data.total_results || 0
    };
  }, [taxonId]);

  const loadData = useCallback(async (targetPage: number, targetScope: 'hongkong' | 'global', isInitial: boolean) => {
    if (!taxonId || isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    
    // When switching scopes or loading a new taxon, clear everything first to avoid UI lag
    if (isInitial) {
      setState(prev => ({ 
        ...prev, 
        isLoading: true, 
        photos: [], 
        dataScope: targetScope 
      }));
    } else {
      setState(prev => ({ ...prev, isLoading: true }));
    }

    try {
      let result = await fetchInternal(targetPage, targetScope, isInitial);
      let communityPhotos: any[] = [];
      
      if (isInitial) {
        communityPhotos = await fetchCommunityPhotos();
      }
      
      // FALLBACK LOGIC: If HK requested but empty
      if (isInitial && targetScope === 'hongkong' && (!result || result.photos.length === 0)) {
        const globalResult = await fetchInternal(1, 'global', true);
        if (globalResult) {
          setState({
            photos: globalResult.photos,
            isLoading: false,
            hasMore: globalResult.photos.length > 0 && globalResult.photos.length < globalResult.totalResults,
            totalCount: globalResult.totalResults,
            dataScope: 'global',
            hasHkPhotos: false,
            page: 1
          });
          return;
        }
      }

      // NORMAL UPDATE
      if (result) {
        setState(prev => {
          const fetchedInatPhotos = result?.photos || [];
          const newPhotos = isInitial 
            ? [...communityPhotos, ...fetchedInatPhotos] 
            : [...prev.photos, ...fetchedInatPhotos];
          const uniquePhotos = Array.from(new Map(newPhotos.map(p => [p.id, p])).values());
          
          return {
            photos: uniquePhotos,
            isLoading: false,
            hasMore: uniquePhotos.length < result.totalResults,
            totalCount: result.totalResults,
            dataScope: targetScope,
            hasHkPhotos: targetScope === 'hongkong' ? (uniquePhotos.length > 0) : prev.hasHkPhotos,
            page: targetPage
          };
        });
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    } finally {
      isFetchingRef.current = false;
    }
  }, [taxonId, fetchInternal]);

  // Initial load when taxonId changes
  useEffect(() => {
    if (taxonId && currentTaxonIdRef.current !== taxonId) {
      currentTaxonIdRef.current = taxonId;
      loadData(1, 'hongkong', true);
    }
  }, [taxonId, loadData]);

  const loadMore = useCallback(() => {
    if (!state.isLoading && state.hasMore) {
      loadData(state.page + 1, state.dataScope, false);
    }
  }, [state, loadData]);

  const setScope = useCallback((newScope: 'hongkong' | 'global') => {
    loadData(1, newScope, true);
  }, [loadData]);

  return {
    ...state,
    loadMore,
    setScope
  };
}
