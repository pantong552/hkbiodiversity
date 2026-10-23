export interface BgisDatasetItem {
  datasetID: number;
  count: number;
  refs: Record<string, unknown>;
  datapoints: unknown[];
}

export interface BgisGridRecord {
  no: number;
  count: number;
  dataset: BgisDatasetItem[];
}

export interface BgisSearchRecord {
  species_id: number;
  scientific_name: string;
  chinese_name?: string;
  english_name?: string;
  [key: string]: unknown;
}

export interface HkbihSpeciesDetails {
  species_id: number;
  scientific_name?: string | null;
  authority_sp?: string | null;
  synonym?: string | null;
  common_name?: string | null;
  alias_common_name?: string | null;
  chinese_name_tc?: string | null;
  alias_chinese_name_tc?: string | null;
  local_distribution_en?: string | null;
  local_distribution_tc?: string | null;
  global_distribution_en?: string | null;
  global_distribution_tc?: string | null;
  description_en?: string | null;
  description_tc?: string | null;
  media?: HkbihSpeciesMedia[] | null;
}

export interface HkbihSpeciesMedia {
  filename?: string | null;
  filename_t?: string | null;
  multimedia_order?: string | null;
  multimedia_type?: string | null;
  data_provider_en?: string | null;
  data_provider_tc?: string | null;
  data_provider_sc?: string | null;
  data_owner_en?: string | null;
  data_owner_tc?: string | null;
  data_owner_sc?: string | null;
  title_en?: string | null;
  title_tc?: string | null;
  title_sc?: string | null;
  photographer_en?: string | null;
  photographer_tc?: string | null;
  photographer_sc?: string | null;
  date_of_photo?: string | null;
  location_en?: string | null;
  location_tc?: string | null;
  location_sc?: string | null;
  remark_en?: string | null;
  remark_tc?: string | null;
  remark_sc?: string | null;
  sex_en?: string | null;
  sex_tc?: string | null;
  sex_sc?: string | null;
  stage_of_life_en?: string | null;
  stage_of_life_tc?: string | null;
  stage_of_life_sc?: string | null;
  behaviour_en?: string | null;
  behaviour_tc?: string | null;
  behaviour_sc?: string | null;
}

interface HkbihSpeciesSearchRecord {
  species_id: number;
  scientific_name: string;
  chinese_name_tc?: string | null;
  [key: string]: unknown;
}

function isHkbihSpeciesMedia(value: unknown): value is HkbihSpeciesMedia {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;

  return [
    'filename',
    'filename_t',
    'multimedia_order',
    'multimedia_type',
    'data_provider_en',
    'data_provider_tc',
    'data_provider_sc',
    'data_owner_en',
    'data_owner_tc',
    'data_owner_sc',
    'title_en',
    'title_tc',
    'title_sc',
    'photographer_en',
    'photographer_tc',
    'photographer_sc',
    'date_of_photo',
    'location_en',
    'location_tc',
    'location_sc',
    'remark_en',
    'remark_tc',
    'remark_sc',
    'sex_en',
    'sex_tc',
    'sex_sc',
    'stage_of_life_en',
    'stage_of_life_tc',
    'stage_of_life_sc',
    'behaviour_en',
    'behaviour_tc',
    'behaviour_sc'
  ].every(field => {
    if (!(field in record)) return true;
    const fieldValue = record[field];
    return fieldValue === null || typeof fieldValue === 'string';
  });
}

function isHkbihSpeciesDetails(value: unknown): value is HkbihSpeciesDetails {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.species_id !== 'number') return false;

  return [
    'scientific_name',
    'authority_sp',
    'synonym',
    'common_name',
    'alias_common_name',
    'chinese_name_tc',
    'alias_chinese_name_tc',
    'local_distribution_en',
    'local_distribution_tc',
    'global_distribution_en',
    'global_distribution_tc',
    'description_en',
    'description_tc',
    'media'
  ].every(field => {
    if (!(field in record)) return true;
    const fieldValue = record[field];
    if (field === 'media') {
      return fieldValue === null || (
        Array.isArray(fieldValue)
        && fieldValue.every(isHkbihSpeciesMedia)
      );
    }
    return fieldValue === null || typeof fieldValue === 'string';
  });
}

export const BGIS_DATASETS: Record<number, { zh: string; en: string }> = {
  62: {
    zh: '香港生物數據庫',
    en: 'Hong Kong Biodiversity Database'
  },
  109: {
    zh: '香港海洋哺乳類動物監察',
    en: 'Monitoring of Marine Mammals in Hong Kong Waters'
  },
  113: {
    zh: '在香港試驗使用環境基因技術監測幼鱟',
    en: 'Field trial of juvenile horseshoe crab monitoring in Hong Kong using environmental DNA technique'
  }
};

export async function fetchHkbihSpeciesDetails(
  scientificName: string,
  chineseName?: string,
  signal?: AbortSignal
): Promise<HkbihSpeciesDetails | null> {
  const keywordsToTry = [scientificName, chineseName].filter(Boolean) as string[];
  let targetItem: HkbihSpeciesSearchRecord | null = null;
  let lastError: unknown;

  for (const kw of keywordsToTry) {
    try {
      const searchParams = new URLSearchParams({
        action: 'list_species',
        search_type: 'Animal',
        kw,
        page: '1',
        page_size: '20',
        order_by: 'family'
      });
      const searchRes = await fetch(`/hkbih-database/process.aspx?${searchParams}`, { signal });

      if (!searchRes.ok) {
        throw new Error(`HKBIH species search failed: ${searchRes.status}`);
      }

      const searchData: { records?: HkbihSpeciesSearchRecord[] } = await searchRes.json();
      const records = Array.isArray(searchData.records) ? searchData.records : [];
      if (records.length > 0) {
        const normalizedScientificName = scientificName.trim().toLowerCase();
        const normalizedChineseName = chineseName?.trim();
        targetItem = records.find(record =>
          record.scientific_name?.trim().toLowerCase() === normalizedScientificName
          || (normalizedChineseName && record.chinese_name_tc?.trim() === normalizedChineseName)
        ) || records[0];
        break;
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      console.error(`[HKBIH] Species search failed (kw: ${kw}):`, error);
    }
  }

  if (!targetItem) {
    if (lastError) throw lastError;
    return null;
  }

  const detailRes = await fetch(
    `/hkbih-database/process.aspx?action=get_species&id=${encodeURIComponent(String(targetItem.species_id))}`,
    { signal }
  );
  if (!detailRes.ok) {
    throw new Error(`HKBIH species details failed: ${detailRes.status}`);
  }

  const responseData: unknown = await detailRes.json();
  if (!isHkbihSpeciesDetails(responseData)) {
    throw new Error('HKBIH returned invalid species details');
  }
  return responseData;
}

/**
 * 透過 BGIS API 獲取指定物種的 1km 網格分佈數據
 * @param scientificName 學名 (例如: "Sousa chinensis")
 * @param chineseName 中文名 (選填，作為搜尋備用)
 */
export async function fetchBgisSpeciesList(
  scientificName: string,
  chineseName?: string
): Promise<BgisGridRecord[]> {
  if (!scientificName && !chineseName) {
    return [];
  }

  const searchUrl = '/bgis-api/species/search';
  const listUrl = '/bgis-api/occurrence/speciesList';

  const keywordsToTry = [scientificName, chineseName].filter(Boolean) as string[];

  let targetItem: BgisSearchRecord | null = null;

  for (const kw of keywordsToTry) {
    try {
      const searchRes = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*'
        },
        body: JSON.stringify({
          action: "list_species",
          type: "species",
          kw: kw,
          animal_group: 0,
          dataset: [],
          months: [],
          years: [],
          page: 1,
          originMonthFilter: "",
          originYearFilter: ""
        })
      });

      if (!searchRes.ok) {
        console.warn(`[BGIS] 搜尋 API 傳回錯誤狀態: ${searchRes.status} (kw: ${kw})`);
        continue;
      }

      const searchData = await searchRes.json();
      const records: BgisSearchRecord[] = searchData.records || [];

      if (records.length > 0) {
        // 嘗試精確匹配學名或取第一個紀錄
        const exactMatch = records.find(
          r => r.scientific_name?.toLowerCase() === scientificName?.toLowerCase()
        );
        targetItem = exactMatch || records[0];
        break;
      }
    } catch (err) {
      console.error(`[BGIS] 搜尋時發生錯誤 (kw: ${kw}):`, err);
    }
  }

  if (!targetItem) {
    console.log(`[BGIS] 未找到記錄 (kw: ${scientificName})`);
    return [];
  }

  try {
    const listPayload = {
      id: targetItem.species_id,
      name: targetItem.scientific_name,
      GRID_NO: [],
      dataset: [],
      month: [],
      year: []
    };

    const listRes = await fetch(listUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify(listPayload)
    });

    if (!listRes.ok) {
      console.error(`[BGIS] SpeciesList API 傳回錯誤狀態: ${listRes.status}`);
      return [];
    }

    const listData = await listRes.json();
    if (Array.isArray(listData)) {
      // 僅保留 Dataset ID 為 62、109 及 113 的資料
      const filteredGridList: BgisGridRecord[] = listData
        .map((item: BgisGridRecord) => {
          const validDatasets = (item.dataset || []).filter(
            ds => ds.datasetID === 62 || ds.datasetID === 109 || ds.datasetID === 113
          );
          const validCount = validDatasets.reduce((sum, ds) => sum + ds.count, 0);
          return {
            ...item,
            count: validCount,
            dataset: validDatasets
          };
        })
        .filter(item => item.count > 0);

      return filteredGridList;
    }
    return [];
  } catch (err) {
    console.error('[BGIS] 獲取 SpeciesList 失敗:', err);
    return [];
  }
}

const bgisStatsCache = new Map<string, { seasonality: { month: number; count: number }[]; history: { year: number; count: number }[] }>();
const bgisPendingPromises = new Map<string, Promise<{ seasonality: { month: number; count: number }[]; history: { year: number; count: number }[] }>>();

/**
 * 獲取 BGIS / HKBIH 的季節性 (1-12月) 及歷史年份觀察統計
 */
export async function fetchBgisObservationStats(
  scientificName: string,
  chineseName?: string
): Promise<{
  seasonality: { month: number; count: number }[];
  history: { year: number; count: number }[];
}> {
  const emptyResult = {
    seasonality: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0 })),
    history: []
  };

  if (!scientificName && !chineseName) {
    return emptyResult;
  }

  const cacheKey = `${scientificName.trim().toLowerCase()}_${(chineseName || '').trim().toLowerCase()}`;
  if (bgisStatsCache.has(cacheKey)) {
    return bgisStatsCache.get(cacheKey)!;
  }

  if (bgisPendingPromises.has(cacheKey)) {
    return bgisPendingPromises.get(cacheKey)!;
  }

  const promise = (async () => {
    const searchUrl = '/bgis-api/species/search';
    const listUrl = '/bgis-api/occurrence/speciesList';
    const keywordsToTry = [scientificName, chineseName].filter(Boolean) as string[];

    let targetItem: BgisSearchRecord | null = null;

    for (const kw of keywordsToTry) {
      try {
        const searchRes = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*'
          },
          body: JSON.stringify({
            action: "list_species",
            type: "species",
            kw: kw,
            animal_group: 0,
            dataset: [],
            months: [],
            years: [],
            page: 1,
            originMonthFilter: "",
            originYearFilter: ""
          })
        });

        if (!searchRes.ok) continue;
        const searchData = await searchRes.json();
        const records: BgisSearchRecord[] = searchData.records || [];

        if (records.length > 0) {
          const exactMatch = records.find(
            r => r.scientific_name?.toLowerCase() === scientificName?.toLowerCase()
          );
          targetItem = exactMatch || records[0];
          break;
        }
      } catch (err) {
        console.error(`[BGIS Stats] 搜尋錯誤:`, err);
      }
    }

    if (!targetItem) {
      bgisStatsCache.set(cacheKey, emptyResult);
      bgisPendingPromises.delete(cacheKey);
      return emptyResult;
    }

    try {
      const currentYear = new Date().getFullYear();
      const startYear = 2012;
      const yearList: number[] = [];
      for (let y = startYear; y <= currentYear; y++) {
        yearList.push(y);
      }

      const monthList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

      const [seasonalityResults, historyResults] = await Promise.all([
        // 1. Seasonality (12 months)
        Promise.all(
          monthList.map(async (m) => {
            try {
              const res = await fetch(listUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: targetItem!.species_id,
                  name: targetItem!.scientific_name,
                  GRID_NO: [],
                  dataset: [],
                  month: [m],
                  year: []
                })
              });
              if (!res.ok) return { month: m, count: 0 };
              const listData = await res.json();
              let count = 0;
              if (Array.isArray(listData)) {
                listData.forEach((item: BgisGridRecord) => {
                  const validDatasets = (item.dataset || []).filter(
                    ds => ds.datasetID === 62 || ds.datasetID === 109 || ds.datasetID === 113
                  );
                  count += validDatasets.reduce((sum, ds) => sum + ds.count, 0);
                });
              }
              return { month: m, count };
            } catch {
              return { month: m, count: 0 };
            }
          })
        ),
        // 2. History (years)
        Promise.all(
          yearList.map(async (y) => {
            try {
              const res = await fetch(listUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: targetItem!.species_id,
                  name: targetItem!.scientific_name,
                  GRID_NO: [],
                  dataset: [],
                  month: [],
                  year: [y]
                })
              });
              if (!res.ok) return { year: y, count: 0 };
              const listData = await res.json();
              let count = 0;
              if (Array.isArray(listData)) {
                listData.forEach((item: BgisGridRecord) => {
                  const validDatasets = (item.dataset || []).filter(
                    ds => ds.datasetID === 62 || ds.datasetID === 109 || ds.datasetID === 113
                  );
                  count += validDatasets.reduce((sum, ds) => sum + ds.count, 0);
                });
              }
              return { year: y, count };
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
      bgisStatsCache.set(cacheKey, finalResult);
      bgisPendingPromises.delete(cacheKey);
      return finalResult;
    } catch (err) {
      console.error('[BGIS Stats] 獲取統計資料失敗:', err);
      bgisPendingPromises.delete(cacheKey);
      return emptyResult;
    }
  })();

  bgisPendingPromises.set(cacheKey, promise);
  return promise;
}
