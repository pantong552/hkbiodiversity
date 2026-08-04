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

interface CommunityPhoto {
  id: string;
  created_at: string;
  taxa_id: string;
  image_url: string;
  author_name: string;
  license: string;
  user_id: string;
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

export function useInaturalistSpeciesPhotos(inatId: number | string | undefined, taxaId?: string) {
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
    const idToUse = taxaId || inatId;
    if (!idToUse) return [];
    try {
      const { data, error } = await supabase
        .from('species_community_photos')
        .select('*')
        .eq('taxa_id', idToUse.toString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const communityData = data as CommunityPhoto[];

      return communityData.map(p => {
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
  }, [inatId, taxaId, supabase]);

  const fetchInternal = useCallback(async (pageNum: number, scope: 'hongkong' | 'global', isInitial: boolean) => {
    if (!inatId) return;
    
    // 獲取當前登入使用者的授權資訊
    const { data: { session } } = await supabase.auth.getSession();
    let currentUserInatName = '';
    let allowAllRightsReserved = false;

    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('inaturalist_username, allow_all_rights_reserved_usage')
        .eq('id', session.user.id)
        .maybeSingle();
      
      if (profile) {
        currentUserInatName = profile.inaturalist_username || '';
        allowAllRightsReserved = profile.allow_all_rights_reserved_usage || false;
      }
    }
    
    const placeParam = scope === 'hongkong' ? '&place_id=7613' : '';
    const fields = '(id:!t,observed_on:!t,photos:(id:!t,url:!t,small_url:!t,medium_url:!t,large_url:!t,original_url:!t,attribution:!t,license_code:!t))';
    const url = `https://api.inaturalist.org/v2/observations?taxon_id=${inatId}&quality_grade=research${placeParam}&per_page=12&page=${pageNum}&order=desc&order_by=votes&fields=${fields}`;

    const data = await fetchWithRetry(url);
    
    const mappedPhotos: InatGalleryPhoto[] = (data.results || []).flatMap((obs: any) => 
      (obs.photos || [])
        .filter((p: any) => {
          // 如果照片本身有授權 (非 null)，則允許顯示
          if (p.license_code !== null) return true;

          // 如果照片是 All Rights Reserved (license_code 為 null)，檢查目前使用者是否為作者且已授權
          if (allowAllRightsReserved && currentUserInatName) {
            const attribution = (p.attribution || '').toLowerCase();
            const searchName = currentUserInatName.toLowerCase();
            
            // 檢查作者名稱是否包含填寫的 iNat 帳號
            return attribution.includes(searchName);
          }

          return false;
        })
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
            url: getProxyUrl(p.url, inatId || 'image', 'original'),
            small_url: getProxyUrl(p.small_url || convertInatUrl(p.url, 'small'), inatId || 'image', 'small'),
            medium_url: getProxyUrl(p.medium_url || convertInatUrl(p.url, 'medium'), inatId || 'image', 'medium'),
            large_url: getProxyUrl(p.large_url || convertInatUrl(p.url, 'large'), inatId || 'image', 'large'),
            original_url: getProxyUrl(p.original_url || convertInatUrl(p.url, 'original'), inatId || 'image', 'original'),
            attribution: `© ${author} (${p.license_code?.toUpperCase() || 'All Rights Reserved'})`,

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
  }, [inatId, supabase]);

  const loadData = useCallback(async (targetPage: number, targetScope: 'hongkong' | 'global', isInitial: boolean) => {
    if ((!inatId && !taxaId) || isFetchingRef.current) return;
    
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
      let result = inatId ? await fetchInternal(targetPage, targetScope, isInitial) : null;
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
          
          // 計算目前已載入的 iNaturalist 圖片數量（扣除 communityPhotos）
          const currentInatPhotosCount = uniquePhotos.filter(p => !p.observedOn || typeof p.id === 'number' || (typeof p.id === 'string' && !p.id.startsWith('photo-'))).length;
          
          return {
            photos: uniquePhotos,
            isLoading: false,
            hasMore: fetchedInatPhotos.length > 0 && (currentInatPhotosCount < result.totalResults || result.photos.length === 12),
            totalCount: result.totalResults,
            dataScope: targetScope,
            hasHkPhotos: targetScope === 'hongkong' ? (uniquePhotos.length > 0) : prev.hasHkPhotos,
            page: targetPage
          };
        });
      } else if (isInitial) {
        // No inatId case - just community photos
        setState(prev => ({
          ...prev,
          photos: communityPhotos,
          isLoading: false,
          hasMore: false,
          totalCount: communityPhotos.length,
          hasHkPhotos: communityPhotos.length > 0,
          page: 1
        }));
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    } finally {
      isFetchingRef.current = false;
    }
  }, [inatId, fetchInternal, fetchCommunityPhotos]);

  // Keep a ref to current state to avoid stale closure issues in loadMore
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Initial load when inatId or taxaId changes
  useEffect(() => {
    const mainId = inatId || taxaId;
    if (mainId && currentTaxonIdRef.current !== mainId) {
      currentTaxonIdRef.current = mainId;
      loadData(1, 'hongkong', true);
    }
  }, [inatId, taxaId, loadData]);

  const loadMore = useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState.isLoading && currentState.hasMore && !isFetchingRef.current) {
      loadData(currentState.page + 1, currentState.dataScope, false);
    }
  }, [loadData]);

  const setScope = useCallback((newScope: 'hongkong' | 'global') => {
    loadData(1, newScope, true);
  }, [loadData]);

  return {
    ...state,
    loadMore,
    setScope
  };
}
