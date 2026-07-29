export interface EbirdRecord {
  hs: number;    // hotspot: 1 or 0
  e: string;     // e.g. "N", "P"
  rec: number;   // recent record flag
  n: string;     // location ID, e.g. "L1012793"
  y: number;     // latitude
  x: number;     // longitude
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

export async function fetchEbirdMapPoints(ebirdSpeciesCode: string): Promise<EbirdRecord[]> {
  if (!ebirdSpeciesCode || !ebirdSpeciesCode.trim()) {
    return [];
  }

  const code = ebirdSpeciesCode.trim();
  const url = `/api/ebird/points?speciesCode=${encodeURIComponent(code)}`;

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
