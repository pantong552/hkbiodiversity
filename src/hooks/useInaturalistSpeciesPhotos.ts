'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
            url: p.url,
            small_url: p.small_url || convertInatUrl(p.url, 'small'),
            medium_url: p.medium_url || convertInatUrl(p.url, 'medium'),
            large_url: p.large_url || convertInatUrl(p.url, 'large'),
            original_url: p.original_url || convertInatUrl(p.url, 'original'),
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
          const newPhotos = isInitial ? result.photos : [...prev.photos, ...result.photos];
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
