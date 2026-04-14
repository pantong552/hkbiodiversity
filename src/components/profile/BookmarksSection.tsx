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
  species_id: number;
  common_name_chi: string;
  common_name_eng: string;
  scientific_name: string;
  image_url: string;
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
  const { addSpecies } = useSpeciesPanel();
  
  // 獲取與 SpeciesCard 同款的動態圖片
  const { imageUrl: inatPhoto, isLoading: isInatLoading } = useInaturalistPhoto(species.species_id);

  // 將圖片解析度調整為最細 (square) 以節省列表載入資源
  const getSmallPhoto = (url: string | null) => {
    if (!url) return null;
    return url.replace('/medium.', '/square.').replace('/large.', '/square.').replace('size=medium', 'size=square');
  };

  const displayImage = getSmallPhoto(species.image_url || inatPhoto);

  return (
    <div
      className="group flex items-center gap-4 p-3 bg-white hover:bg-emerald-50/50 border border-slate-100 hover:border-emerald-200 rounded-2xl transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-left-4 duration-500"
      style={{ animationDelay: `${idx * 50}ms` }}
      onClick={() => addSpecies(species.id)}
    >
      {/* 物種縮圖 */}
      <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-100">
        {isInatLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-slate-50">
            <Loader2 className="w-4 h-4 text-emerald-300 animate-spin" />
          </div>
        ) : displayImage ? (
          <Image
            src={displayImage}
            alt={language === 'zh' ? species.common_name_chi : species.common_name_eng}
            fill
            sizes="56px"
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-emerald-50">
            <Heart className="w-5 h-5 text-emerald-300" />
          </div>
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
        .select(`
          id,
          species_id,
          created_at,
          species:species_id (
            id,
            species_id,
            common_name_chi,
            common_name_eng,
            scientific_name,
            image_url,
            iucn,
            informal_group_eng,
            informal_group_chi
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || [])
        .filter((item: any) => item.species)
        .map((item: any) => ({
          ...item.species,
          favorite_id: item.id,
          bookmarked_at: item.created_at,
        }));

      setBookmarks(mapped);
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
