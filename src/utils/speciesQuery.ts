import { createClient } from '@/utils/supabase/client';

/**
 * 強健的多層次物種正本查詢工具
 * 能完美處理 fauna_/flora_/fungi_ 前綴、純數字 ID、UUID 以及跨 species/plant_species/fungi_species 表查詢
 */
export async function fetchSpeciesOrPlantRow(rawId: string, preferredTable?: string) {
  if (!rawId) return null;
  const supabase = createClient();
  const cleanId = String(rawId).trim();
  const numericId = cleanId.replace(/^(fauna_|flora_|fungi_)/, '');

  const isFungi = preferredTable === 'fungi_species' || cleanId.startsWith('fungi_');
  const isPlant = preferredTable === 'plant_species' || cleanId.startsWith('flora_');
  const primaryTable = isFungi ? 'fungi_species' : (isPlant ? 'plant_species' : 'species');
  const candidateTables = [primaryTable, 'species', 'plant_species', 'fungi_species'].filter((t, idx, arr) => arr.indexOf(t) === idx);

  const tryFetch = async (tableName: string) => {
    // 1. 如果包含 '-' (UUID 格式)，同時查詢 id 或 taxa_id
    if (cleanId.includes('-')) {
      const { data } = await supabase
        .from(tableName)
        .select('*')
        .or(`id.eq.${cleanId},taxa_id.eq.${cleanId}`)
        .maybeSingle();
      if (data) return data;
    }

    // 2. 用完整的 cleanId (如 'fauna_1445' 或 'fungi_1' 或 '1445') 比對 taxa_id 或 id
    const { data: d1 } = await supabase
      .from(tableName)
      .select('*')
      .or(`taxa_id.eq.${cleanId},id.eq.${cleanId}`)
      .maybeSingle();
    if (d1) return d1;

    // 3. 用去掉前綴後的 numericId (如 '1445') 比對 taxa_id 或 id
    if (numericId !== cleanId) {
      const { data: d2 } = await supabase
        .from(tableName)
        .select('*')
        .or(`taxa_id.eq.${numericId},id.eq.${numericId}`)
        .maybeSingle();
      if (d2) return d2;
    }

    return null;
  };

  // 依序在候選資料表搜尋
  for (const table of candidateTables) {
    const result = await tryFetch(table);
    if (result) return result;
  }

  return null;
}
