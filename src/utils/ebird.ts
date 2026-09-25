import { createClient } from '@/utils/supabase/client';

export interface EbirdRecord {
  hs: number;    // hotspot: 1 or 0
  e: string;     // e.g. "N", "P"
  rec: number;   // recent record flag
  n: string;     // location ID, e.g. "L1012793"
  y: number;     // latitude
  x: number;     // longitude
}

export interface EbirdGridSummary {
  species_code: string;
  points_count: number;
  total_records: number;
  monthly_counts: Record<string, number> | string | null;
  grid_json: Record<string, number> | string | null;
  updated_at?: string | null;
}

function parseJsonObject<T>(value: T | string | null | undefined): T | null {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function fetchEbirdGridSummary(speciesCode: string): Promise<EbirdGridSummary | null> {
  if (!speciesCode.trim()) return null;
  const { data, error } = await createClient()
    .from('ebird_species_summary')
    .select('species_code, points_count, total_records, monthly_counts, grid_json, updated_at')
    .eq('species_code', speciesCode.trim())
    .maybeSingle();

  if (error) {
    console.error('[eBird summary] Failed to load species summary:', error.message);
    return null;
  }
  if (!data) return null;
  return {
    ...data,
    monthly_counts: parseJsonObject<Record<string, number>>(data.monthly_counts),
    grid_json: parseJsonObject<Record<string, number>>(data.grid_json)
  };
}

export function getEbirdObservationStats(monthlyCounts: Record<string, number> | null | undefined) {
  const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: 0 }));
  const years: Record<number, number> = {};
  for (const [key, rawCount] of Object.entries(monthlyCounts || {})) {
    const match = /^(\d{4})-(\d{2})$/.exec(key);
    const count = Number(rawCount);
    if (!match || !Number.isFinite(count)) continue;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) continue;
    months[month - 1].count += count;
    years[year] = (years[year] || 0) + count;
  }
  return {
    seasonality: months,
    history: Object.entries(years).map(([year, count]) => ({ year: Number(year), count })).sort((a, b) => a.year - b.year)
  };
}

export interface EbirdLocInfo {
  subID: string;         // checklist ID, e.g. "S154481294"
  howMany: string;       // 數量（字串）
  obsDt: string;         // 日期，e.g. "2023-11-15"
  userDisplayName: string; // 觀察者名稱
  evidence: string;      // 證據類型，e.g. "N", "P", "A"
}

export interface EbirdLocInfoResponse {
  loc: {
    locId: string;
    name: string;
    latitude: number;
    longitude: number;
    hierarchicalName: string;
  };
  infoList: EbirdLocInfo[];
}

export interface EbirdPointsOptions {
  bmo?: number;
  emo?: number;
  byr?: number;
  eyr?: number;
  yr?: string;
}

export async function fetchEbirdMapPoints(
  ebirdSpeciesCode: string,
  options?: EbirdPointsOptions
): Promise<EbirdRecord[]> {
  if (!ebirdSpeciesCode || !ebirdSpeciesCode.trim()) {
    return [];
  }

  const code = ebirdSpeciesCode.trim();
  const params = new URLSearchParams({ speciesCode: code });
  if (options?.bmo !== undefined) params.set('bmo', String(options.bmo));
  if (options?.emo !== undefined) params.set('emo', String(options.emo));
  if (options?.byr !== undefined) params.set('byr', String(options.byr));
  if (options?.eyr !== undefined) params.set('eyr', String(options.eyr));
  if (options?.yr !== undefined) params.set('yr', String(options.yr));

  const url = `/api/ebird/points?${params.toString()}`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`[eBird API Proxy] Fetch failed with status ${res.status}`);
      return [];
    }

    const data: EbirdRecord[] = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[eBird API] Error fetching map points via proxy:', err);
    return [];
  }
}

export async function fetchEbirdLocInfo(
  locID: string,
  speciesCode: string
): Promise<EbirdLocInfoResponse | null> {
  if (!locID || !speciesCode) return null;

  try {
    const url = `/api/ebird/locinfo?locID=${encodeURIComponent(locID)}&speciesCode=${encodeURIComponent(speciesCode)}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`[eBird LocInfo] Fetch failed with status ${res.status}`);
      return null;
    }

    const data: EbirdLocInfoResponse = await res.json();
    return data;
  } catch (err) {
    console.error('[eBird LocInfo] Error fetching locinfo via proxy:', err);
    return null;
  }
}

/** 將 eBird 證據代碼轉換為可讀文字 */
export function getEbirdEvidenceLabel(evidence: string, lang: 'zh' | 'en' = 'en'): string {
  const labels: Record<string, { zh: string; en: string }> = {
    N: { zh: '一般目視', en: 'Visual Only' },
    P: { zh: '拍照記錄', en: 'Photo' },
    A: { zh: '聲音記錄', en: 'Audio' },
    V: { zh: '影片記錄', en: 'Video' },
  };
  return labels[evidence]?.[lang] ?? evidence;
}


const ebirdStatsCache = new Map<string, { seasonality: { month: number; count: number }[]; history: { year: number; count: number }[] }>();
const ebirdPendingPromises = new Map<string, Promise<{ seasonality: { month: number; count: number }[]; history: { year: number; count: number }[] }>>();

/**
 * 獲取 eBird 的季節性 (1-12月) 及歷史年份觀察統計
 */
export async function fetchEbirdObservationStats(
  ebirdSpeciesCode: string,
  mode: 'seasonality' | 'history' | 'both' = 'both'
): Promise<{
  seasonality: { month: number; count: number }[];
  history: { year: number; count: number }[];
}> {
  const emptyResult = {
    seasonality: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0 })),
    history: []
  };

  if (!ebirdSpeciesCode || !ebirdSpeciesCode.trim()) {
    return emptyResult;
  }

  const cacheKey = ebirdSpeciesCode.trim().toLowerCase();
  if (ebirdStatsCache.has(cacheKey)) {
    return ebirdStatsCache.get(cacheKey)!;
  }

  if (ebirdPendingPromises.has(cacheKey)) {
    return ebirdPendingPromises.get(cacheKey)!;
  }

  const promise = (async () => {
    const currentYear = new Date().getFullYear();
    const startYear = 2012;
    const yearList: number[] = [];
    for (let y = startYear; y <= currentYear; y++) {
      yearList.push(y);
    }

    const monthList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    try {
      const [seasonalityResults, historyResults] = await Promise.all([
        // 1. Seasonality (12 months)
        Promise.all(
          monthList.map(async (m) => {
            try {
              const pts = await fetchEbirdMapPoints(ebirdSpeciesCode, { bmo: m, emo: m });
              return { month: m, count: pts.length };
            } catch {
              return { month: m, count: 0 };
            }
          })
        ),
        // 2. History (years)
        Promise.all(
          yearList.map(async (y) => {
            try {
              const pts = await fetchEbirdMapPoints(ebirdSpeciesCode, { byr: y, eyr: y, yr: String(y) });
              return { year: y, count: pts.length };
            } catch {
              return { year: y, count: 0 };
            }
          })
        )
      ]);

      const finalResult = {
        seasonality: seasonalityResults,
        history: historyResults
      };
      ebirdStatsCache.set(cacheKey, finalResult);
      ebirdPendingPromises.delete(cacheKey);
      return finalResult;
    } catch (err) {
      console.error('[eBird Stats] 獲取統計資料失敗:', err);
      ebirdPendingPromises.delete(cacheKey);
      return emptyResult;
    }
  })();

  ebirdPendingPromises.set(cacheKey, promise);
  return promise;
}
