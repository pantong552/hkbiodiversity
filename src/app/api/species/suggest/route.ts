import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export interface SuggestionItem {
  taxa_id: string;
  id?: number | string;
  common_name_chi?: string;
  common_name_eng?: string;
  scientific_name: string;
  taxa_group: 'FAUNA' | 'FLORA';
  category?: string;
  family_eng?: string;
  order_eng?: string;
  class_eng?: string;
  inat_id?: number | null;
  photo_url?: string | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || '';
  const type = searchParams.get('type') || 'all'; // fauna, flora, all
  const limit = Math.min(parseInt(searchParams.get('limit') || '8', 10), 20);

  if (!q || q.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const sanitizeQuery = q.replace(/[%_]/g, '\\$&');
    const searchPattern = `%${sanitizeQuery}%`;

    let faunaResults: SuggestionItem[] = [];
    let floraResults: SuggestionItem[] = [];

    // 1. 檢索 Fauna (動物)
    if (type === 'fauna' || type === 'all') {
      const { data: faunaData, error: faunaErr } = await supabase
        .from('species')
        .select('taxa_id, id, common_name_chi, common_name_eng, scientific_name, class_eng, family_eng, order_eng, inat_id')
        .or(`common_name_chi.ilike.${searchPattern},common_name_eng.ilike.${searchPattern},scientific_name.ilike.${searchPattern},alias_common_name_chi.ilike.${searchPattern},alias_scientific_name.ilike.${searchPattern}`)
        .limit(limit);

      if (!faunaErr && faunaData) {
        faunaResults = faunaData.map((item: any) => ({
          ...item,
          taxa_group: 'FAUNA' as const,
          category: item.class_eng || item.order_eng || item.family_eng || 'Fauna',
        }));
      }
    }

    // 2. 檢索 Flora (植物)
    if (type === 'flora' || type === 'all') {
      const { data: floraData, error: floraErr } = await supabase
        .from('plant_species')
        .select('taxa_id, id, common_name_chi, common_name_eng, scientific_name, category_eng, family_eng, genus_eng, inat_id')
        .or(`common_name_chi.ilike.${searchPattern},common_name_eng.ilike.${searchPattern},scientific_name.ilike.${searchPattern},alias_common_name_chi.ilike.${searchPattern},alias_common_name_eng.ilike.${searchPattern},alias_scientific_name.ilike.${searchPattern}`)
        .limit(limit);

      if (!floraErr && floraData) {
        floraResults = floraData.map((item: any) => ({
          taxa_id: item.taxa_id || `flora_${item.id}`,
          id: item.id,
          common_name_chi: item.common_name_chi,
          common_name_eng: item.common_name_eng,
          scientific_name: item.scientific_name,
          taxa_group: 'FLORA' as const,
          category: item.category_eng || item.family_eng || 'Flora',
          inat_id: item.inat_id,
        }));
      }
    }

    // 3. 依據相關度進行簡單排序（精確開頭匹配優先）
    const qLower = q.toLowerCase();
    const combined = [...faunaResults, ...floraResults];

    combined.sort((a, b) => {
      const aExactChi = a.common_name_chi?.toLowerCase().startsWith(qLower) ? 0 : 1;
      const bExactChi = b.common_name_chi?.toLowerCase().startsWith(qLower) ? 0 : 1;
      if (aExactChi !== bExactChi) return aExactChi - bExactChi;

      const aExactSci = a.scientific_name?.toLowerCase().startsWith(qLower) ? 0 : 1;
      const bExactSci = b.scientific_name?.toLowerCase().startsWith(qLower) ? 0 : 1;
      if (aExactSci !== bExactSci) return aExactSci - bExactSci;

      return 0;
    });

    const suggestions = combined.slice(0, limit);

    return NextResponse.json({ suggestions });
  } catch (err: any) {
    console.error('[Suggest API Error]:', err);
    return NextResponse.json({ suggestions: [], error: err.message }, { status: 500 });
  }
}
