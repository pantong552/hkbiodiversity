export interface BgisDatasetItem {
  datasetID: number;
  count: number;
  refs: any;
  datapoints: any;
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
  [key: string]: any;
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

/**
 * 獲取 BGIS / HKBIH 的季節性 (1-12月) 及歷史年份觀察統計
 */
export async function fetchBgisObservationStats(
  scientificName: string,
  chineseName?: string,
  mode: 'seasonality' | 'history' | 'both' = 'both'
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
      mode === 'history' ? Promise.resolve(emptyResult.seasonality) : Promise.all(
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
      mode === 'seasonality' ? Promise.resolve(emptyResult.history) : Promise.all(
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

    return {
      seasonality: seasonalityResults,
      history: historyResults
    };
  } catch (err) {
    console.error('[BGIS Stats] 獲取統計資料失敗:', err);
    return emptyResult;
  }
}

