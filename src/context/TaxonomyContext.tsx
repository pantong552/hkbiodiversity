'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface TaxonomyMapping {
  rank: string;
  taxa_type: string;
  name_eng: string;
  name_chi: string;
}

interface TaxonomyContextType {
  getTaxonomyChi: (rank: string, taxaType: string, nameEng: string) => string;
  isLoading: boolean;
}

const TaxonomyContext = createContext<TaxonomyContextType | undefined>(undefined);

export const TaxonomyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMappings = async () => {
      try {
        setIsLoading(true);
        let allData: TaxonomyMapping[] = [];
        let offset = 0;
        const limit = 1000;
        
        while (true) {
          const { data, error } = await supabase
            .from('taxonomy_mappings')
            .select('rank, taxa_type, name_eng, name_chi')
            .range(offset, offset + limit - 1);

          if (error) throw error;
          if (!data || data.length === 0) break;
          
          allData = [...allData, ...data];
          if (data.length < limit) break;
          offset += limit;
        }

        // 建立快取鍵值對: "rank:taxaType:nameEng" -> "nameChi"
        const cache: Record<string, string> = {};
        allData.forEach((m: TaxonomyMapping) => {
          if (m.name_eng && m.name_chi) {
            const key = `${m.rank.toLowerCase()}:${m.taxa_type.toLowerCase()}:${m.name_eng.trim().toLowerCase()}`;
            cache[key] = m.name_chi.trim();
          }
        });

        setMappings(cache);
      } catch (err) {
        console.error('Failed to fetch taxonomy mappings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMappings();
  }, []);

  const getTaxonomyChi = useCallback((rank: string, taxaType: string, nameEng: string): string => {
    if (!nameEng) return '';
    
    // 標準化 taxaType 為 fauna 或 flora
    const normalizedType = taxaType === 'plant' ? 'flora' : (taxaType === 'fauna' ? 'fauna' : taxaType.toLowerCase());
    
    // 標準化 rank 名稱，確保 informal_group_eng 也能匹配到 informal_group
    const normalizedRank = rank.toLowerCase() === 'informal_group_eng' ? 'informal_group' : rank.toLowerCase();
    
    const key = `${normalizedRank}:${normalizedType}:${nameEng.trim().toLowerCase()}`;
    const result = mappings[key];
    
    return result || nameEng; // 如果找不到，退而求其次顯示英文名
  }, [mappings]);

  return (
    <TaxonomyContext.Provider value={{ getTaxonomyChi, isLoading }}>
      {children}
    </TaxonomyContext.Provider>
  );
};

export const useTaxonomy = () => {
  const context = useContext(TaxonomyContext);
  if (context === undefined) {
    throw new Error('useTaxonomy must be used within a TaxonomyProvider');
  }
  return context;
};
