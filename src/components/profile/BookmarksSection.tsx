'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, Trash2, Loader2, BookmarkX } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { useInaturalistPhoto } from '@/hooks/useInaturalistPhoto';
import { formatScientificName } from '@/utils/formatters';

interface BookmarkedSpecies {
  id: number;
  taxa_id: string;
  inat_id: number;
  common_name_chi: string;
  common_name_eng: string;
  scientific_name: string;
  iucn: string;
  informal_group_eng: string;
  informal_group_chi: string;
  favorite_id: string;
  bookmarked_at: string;
}

/**
 * 獨立的子元件，用來動態讀取 iNaturalist 圖片
 */
function BookmarkItem({ 
  species, 
  onRemove, 
  isRemoving, 
  idx 
}: { 
  species: BookmarkedSpecies, 
  onRemove: (id: string) => void,
  isRemoving: boolean,
  idx: number
}) {
  const { language } = useLanguage();
  const { addSpecies, setIsAccountOpen } = useSpeciesPanel();
  const [imgLoaded, setImgLoaded] = useState(false);
  
  // 獲取與 SpeciesCard 同款的動態圖片
  const { imageUrl: inatPhoto, isLoading: isInatLoading } = useInaturalistPhoto(species.inat_id);

  const displayImage = inatPhoto;

  return (
    <div
      className="group flex items-center gap-4 p-3 bg-white hover:bg-emerald-50/50 border border-slate-100 hover:border-emerald-200 rounded-2xl transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-left-4 duration-500"
      style={{ animationDelay: `${idx * 50}ms` }}
      onClick={() => {
        addSpecies(species.taxa_id);
        setIsAccountOpen(false);
      }}
    >
      {/* 物種縮圖 */}
      <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-50 border border-slate-100 flex items-center justify-center">
        {(!displayImage || !imgLoaded) && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
            {isInatLoading ? (
              <Loader2 className="w-4 h-4 text-emerald-300 animate-spin" />
            ) : !displayImage ? (
              <img 
                src="/images/placeholder/no-species-image.svg" 
                alt="No species image" 
                className="w-full h-full object-cover opacity-80"
              />
            ) : null}
          </div>
        )}
        
        {displayImage && (
          <Image
            src={displayImage}
            alt={language === 'zh' ? species.common_name_chi : species.common_name_eng}
            fill
            sizes="56px"
            unoptimized={displayImage.includes('/api/image/transform')}
            className={`object-cover group-hover:scale-110 transition-all duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
          />
        )}
      </div>

      {/* 物種資訊 */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">
          {language === 'zh' ? species.common_name_chi : species.common_name_eng}
        </h4>
        <div className="text-xs text-slate-400 font-serif tracking-wide truncate">
          {formatScientificName(species.scientific_name)}
        </div>
      </div>

      {/* 物種分類小標 */}
      <span className="hidden sm:inline-flex px-2.5 py-1 bg-slate-50 text-[10px] font-bold text-slate-400 rounded-lg border border-slate-100 flex-shrink-0 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
        {language === 'zh' ? species.informal_group_chi : species.informal_group_eng}
      </span>

      {/* 移除按鈕 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(species.favorite_id);
        }}
        disabled={isRemoving}
        className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-300 opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-pointer border border-transparent hover:border-red-100"
      >
        {isRemoving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

export default function BookmarksSection() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const supabase = createClient();

  const [bookmarks, setBookmarks] = useState<BookmarkedSpecies[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('id, taxa_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (!data || data.length === 0) {
          setBookmarks([]);
          setIsLoading(false);
          return;
      }

      // 使用 taxa_id 全局獲取功能獲取物種細節
      const fetchPromises = data.map(async (fav: any) => {
          if (!fav.taxa_id) return null;
          
          const isFauna = fav.taxa_id.startsWith('fauna_');
          const isFlora = fav.taxa_id.startsWith('flora_');
          
          let speciesInfo: any = null;
          if (isFauna) {
              const { data: s } = await supabase.from('species').select('*').eq('taxa_id', fav.taxa_id).maybeSingle();
              if (s) {
                  speciesInfo = {
                      ...s,
                      favorite_id: fav.id,
                      bookmarked_at: fav.created_at
                  };
              }
          } else if (isFlora) {
              const { data: p } = await supabase.from('plant_species').select('*').eq('taxa_id', fav.taxa_id).maybeSingle();
              if (p) {
                  speciesInfo = {
                      id: p.id,
                      taxa_id: p.taxa_id,
                      inat_id: p.inat_id,
                      common_name_chi: p.common_name_chi,
                      common_name_eng: p.common_name_eng,
                      scientific_name: p.scientific_name,
                      iucn: '',
                      informal_group_eng: p.category_eng,
                      informal_group_chi: p.category_chi,
                      favorite_id: fav.id,
                      bookmarked_at: fav.created_at,

                  };
              }
          }
          return speciesInfo;
      });

      const results = await Promise.all(fetchPromises);
      const validResults = results.filter(r => r !== null && r.inat_id !== undefined) as BookmarkedSpecies[];
      setBookmarks(validResults);
    } catch (err) {
      console.error('Error fetching bookmarks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const removeBookmark = async (favoriteId: string) => {
    setRemovingId(favoriteId);
    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('id', favoriteId);

      if (error) throw error;

      setBookmarks((prev) => prev.filter((b) => b.favorite_id !== favoriteId));
    } catch (err) {
      console.error('Error removing bookmark:', err);
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-sm font-bold text-slate-400">Loading...</p>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5">
        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center border border-slate-100">
          <BookmarkX className="w-10 h-10 text-slate-300" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-bold text-slate-500">{t('account.bookmarks_empty')}</p>
          <p className="text-sm text-slate-400 max-w-xs">{t('account.bookmarks_empty_hint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
          {bookmarks.length} {language === 'zh' ? '個收藏' : (bookmarks.length === 1 ? 'Bookmark' : 'Bookmarks')}
        </p>
      </div>

      <div className="grid gap-3">
        {bookmarks.map((species, idx) => (
          <BookmarkItem 
            key={species.favorite_id}
            species={species}
            onRemove={removeBookmark}
            isRemoving={removingId === species.favorite_id}
            idx={idx}
          />
        ))}
      </div>
    </div>
  );
}
