import { supabase, isClientConfigured } from "./supabaseClient";
import { Species } from "@/types/species";
import speciesGalleries from "@/data/speciesGalleries.json";


// Supabase 回傳的關聯型別宣告
interface SupabaseSpeciesRow {
  id: string;
  species_code: string;
  scientific_name: string;
  synonyms: string[] | null;
  scientific_name_author: string | null;
  synonym_authors: string[] | null;
  wing_length: string | null;
  wing_area: string | null;
  wing_loading: string | null;
  aspect_ratio: string | null;
  wing_tip_index: string | null;
  wing_reference: string | null;
  head_body_range: string | null;
  tail_range: string | null;
  ear_range: string | null;
  hind_foot_range: string | null;
  forearm_range: string | null;
  weight_range: string | null;
  first_record: string | null;
  image_url: string | null;
  anatomy_diagram_url: string | null;
  measurement_diagram_url: string | null;
  audio_url: string | null;
  chirovox_url: string | null;
  species_translations: Array<{
    lang: string;
    common_name: string;
    other_common_names: string[] | null;
    taxonomic_notes: string | null;
    body_size_type: string | null;
    feature_fur: string | null;
    feature_ears: string | null;
    feature_head: string | null;
    feature_limbs: string | null;
    feature_tail: string | null;
    feature_other: string | null;
    ecology_habitat: string | null;
    ecology_habits: string | null;
    ecology_reproduction: string | null;
    ecology_hibernation: string | null;
    ecology_flight: string | null;
    ecology_foraging: string | null;
    ecology_diet: string | null;
    ecology_lifespan: string | null;
    ecology_migration: string | null;
    ecology_home_range: string | null;
    ecology_vocalizations: string | null;
    local_distribution: string | null;
    global_distribution: Array<{ name: string; desc: string }> | null;
    origin_type: string | null;
    local_status: string | null;
    china_status: string | null;
    global_status: string | null;
    potential_threats: string | null;
    references: string[] | null;
  }>;
  species_photos?: Array<{
    url: string;
    credit: string | null;
    original_url: string | null;
    sort_order: number;
  }>;
  genera: {
    scientific_name: string;
    genus_translations?: Array<{ lang: string; common_name: string }>;
    families: {
      scientific_name: string;
      family_translations?: Array<{ lang: string; common_name: string; description?: string }>;
    };
  };
  diet_compositions?: Array<{
    title_zh: string;
    title_en: string;
    source: string | null;
    source_url: string | null;
    items: Array<{ name_zh: string; name_en: string; percentage: number }>;
  }>;
  roosting_plants?: Array<{
    title_zh: string;
    title_en: string;
    source: string | null;
    source_url: string | null;
    items: Array<{ plant_zh: string; plant_en: string; location_zh: string; location_en: string }>;
  }>;
  diet_food_lists?: Array<{
    title_zh: string;
    title_en: string;
    source: string | null;
    source_url: string | null;
    items: Array<{ plant_zh: string; plant_en: string; food_zh: string; food_en: string }>;
  }>;
  species_similar?: Array<{
    sort_order: number;
    image_url: string | null;
    similar_species: {
      species_code: string;
      scientific_name: string;
      image_url: string | null;
      species_translations: Array<{
        lang: string;
        common_name: string;
      }>;
    };
    species_similar_translations: Array<{
      lang: string;
      comparison_features: Array<{ title: string; value: string }>;
    }>;
  }>;
  species_echolocation?: Array<{
    id: string;
    call_structure: string | null;
    duration: string | null;
    inter_pulse_interval: string | null;
    peak_frequency: string | null;
    highest_frequency: string | null;
    lowest_frequency: string | null;
    start_frequency: string | null;
    end_frequency: string | null;
    sort_order: number;
    species_echolocation_translations: Array<{
      lang: string;
      location: string | null;
      method: string | null;
      reference: string | null;
      reference_url: string | null;
    }>;
  }>;
  species_anatomy_hotspots?: Array<{
    hotspot_key: string;
    x_percent: number;
    y_percent: number;
    placement: string;
    species_anatomy_hotspot_translations: Array<{
      lang: string;
      content: string;
    }>;
  }>;
}

// 將 Supabase 的關聯資料 map 成前端能直接使用的 Species 格式
function mapSupabaseToSpecies(row: SupabaseSpeciesRow): Species {
  const zhTrans = row.species_translations.find((t) => t.lang === "zh");
  const enTrans = row.species_translations.find((t) => t.lang === "en");
  
  // 取得科與屬的翻譯
  const genusZh = row.genera.genus_translations?.find((t) => t.lang === "zh")?.common_name || row.genera.scientific_name;
  const genusEn = row.genera.genus_translations?.find((t) => t.lang === "en")?.common_name || row.genera.scientific_name;
  const familyZh = row.genera.families.family_translations?.find((t) => t.lang === "zh")?.common_name || row.genera.families.scientific_name;
  const familyEn = row.genera.families.family_translations?.find((t) => t.lang === "en")?.common_name || row.genera.families.scientific_name;

  // 整理飲食組成
  const dietList = row.diet_compositions || [];
  const mappedDiet = dietList.map((d) => ({
    title_zh: d.title_zh || "",
    title_en: d.title_en || "",
    source: d.source || "",
    sourceUrl: d.source_url || undefined,
    items: (d.items || []).map((item: any) => ({
      name_zh: item.name_zh || "",
      name_en: item.name_en || "",
      percentage: Number(item.percentage || 0)
    })),
  }));

  const zhDiet = mappedDiet;
  const enDiet = mappedDiet;

  // 整理棲息植物
  const roostingList = row.roosting_plants || [];
  const mappedRoosting = roostingList.map((r) => ({
    title_zh: r.title_zh || "",
    title_en: r.title_en || "",
    source: r.source || "",
    sourceUrl: r.source_url || undefined,
    items: (r.items || []).map((item: any) => ({
      plant_zh: item.plant_zh || "",
      plant_en: item.plant_en || "",
      location_zh: item.location_zh || "",
      location_en: item.location_en || ""
    })),
  }));

  const zhRoosting = mappedRoosting;
  const enRoosting = mappedRoosting;

  // 整理非百分比食性列表
  const dietFoodListRaw = row.diet_food_lists || [];
  const mappedDietFoodList = dietFoodListRaw.map((d) => ({
    title_zh: d.title_zh || "",
    title_en: d.title_en || "",
    source: d.source || "",
    sourceUrl: d.source_url || undefined,
    items: (d.items || []).map((item: any) => ({
      plant_zh: item.plant_zh || "",
      plant_en: item.plant_en || "",
      food_zh: item.food_zh || "",
      food_en: item.food_en || ""
    })),
  }));

  const zhDietFoodLists = mappedDietFoodList;
  const enDietFoodLists = mappedDietFoodList;

  const result: Species = {
    code: row.species_code,
    scientificName: row.scientific_name,
    scientificNameAuthor: row.scientific_name_author || "",
    family: {
      scientific: row.genera.families.scientific_name,
      zh: familyZh,
      en: familyEn,
    },
    genus: {
      scientific: row.genera.scientific_name,
      zh: genusZh,
      en: genusEn,
    },
    synonyms: (row.synonyms || []).map((syn, idx) => ({
      name: syn,
      author: row.synonym_authors?.[idx] || "",
    })),
    firstRecord: row.first_record || "",
    origin: {
      zh: zhTrans?.origin_type || "原生",
      en: enTrans?.origin_type || "Native",
    },
    localStatus: {
      zh: zhTrans?.local_status || "",
      en: enTrans?.local_status || "",
    },
    chinaStatus: {
      zh: zhTrans?.china_status || "",
      en: enTrans?.china_status || "",
    },
    globalStatus: {
      zh: zhTrans?.global_status || "",
      en: enTrans?.global_status || "",
    },
    measurements: {
      headBody: row.head_body_range || "",
      tail: row.tail_range || "",
      ear: row.ear_range || "",
      hindFoot: row.hind_foot_range || "",
      forearm: row.forearm_range || "",
      weight: row.weight_range || "",
    },
    wingParams: {
      length: row.wing_length || "",
      area: row.wing_area || "",
      loading: row.wing_loading || "",
      aspectRatio: row.aspect_ratio || "",
      tipIndex: row.wing_tip_index || "",
      reference: row.wing_reference || "",
    },
    imageUrl: row.image_url || "",
    anatomyUrl: row.anatomy_diagram_url || undefined,
    measurementUrl: row.measurement_diagram_url || undefined,
    audioUrl: row.audio_url || undefined,
    chirovoxUrl: row.chirovox_url || undefined,
    zh: {
      commonName: zhTrans?.common_name || "",
      otherCommonNames: zhTrans?.other_common_names || [],
      taxonomicNotes: zhTrans?.taxonomic_notes || "",
      bodySizeType: zhTrans?.body_size_type || "",
      features: {
        fur: zhTrans?.feature_fur || "",
        ears: zhTrans?.feature_ears || "",
        head: zhTrans?.feature_head || "",
        limbs: zhTrans?.feature_limbs || "",
        tail: zhTrans?.feature_tail || "",
        other: zhTrans?.feature_other || "",
      },
      ecology: {
        habitat: zhTrans?.ecology_habitat || "",
        habits: zhTrans?.ecology_habits || "",
        reproduction: zhTrans?.ecology_reproduction || "",
        hibernation: zhTrans?.ecology_hibernation || "",
        flight: zhTrans?.ecology_flight || "",
        foraging: zhTrans?.ecology_foraging || "",
        diet: zhTrans?.ecology_diet || "",
        lifespan: zhTrans?.ecology_lifespan || "",
        migration: zhTrans?.ecology_migration || "",
        homeRange: zhTrans?.ecology_home_range || "",
        vocalizations: zhTrans?.ecology_vocalizations || "",
        dietComposition: zhDiet,
        roostingPlants: zhRoosting,
        dietFoodLists: zhDietFoodLists,
      },
      distribution: {
        local: zhTrans?.local_distribution || "",
        global: zhTrans?.global_distribution || [],
      },
      threats: zhTrans?.potential_threats || "",
      references: zhTrans?.references || [],
    },
    en: {
      commonName: enTrans?.common_name || "",
      otherCommonNames: enTrans?.other_common_names || [],
      taxonomicNotes: enTrans?.taxonomic_notes || "",
      bodySizeType: enTrans?.body_size_type || "",
      features: {
        fur: enTrans?.feature_fur || "",
        ears: enTrans?.feature_ears || "",
        head: enTrans?.feature_head || "",
        limbs: enTrans?.feature_limbs || "",
        tail: enTrans?.feature_tail || "",
        other: enTrans?.feature_other || "",
      },
      ecology: {
        habitat: enTrans?.ecology_habitat || "",
        habits: enTrans?.ecology_habits || "",
        reproduction: enTrans?.ecology_reproduction || "",
        hibernation: enTrans?.ecology_hibernation || "",
        flight: enTrans?.ecology_flight || "",
        foraging: enTrans?.ecology_foraging || "",
        diet: enTrans?.ecology_diet || "",
        lifespan: enTrans?.ecology_lifespan || "",
        migration: enTrans?.ecology_migration || "",
        homeRange: enTrans?.ecology_home_range || "",
        vocalizations: enTrans?.ecology_vocalizations || "",
        dietComposition: enDiet,
        roostingPlants: enRoosting,
        dietFoodLists: enDietFoodLists,
      },
      distribution: {
        local: enTrans?.local_distribution || "",
        global: enTrans?.global_distribution || [],
      },
      threats: enTrans?.potential_threats || "",
      references: enTrans?.references || [],
    },
    similarSpecies: [] // 這裡會由下方 mappedSimilar 覆寫
  };

  // 整理相似物種
  const rawSimilar = row.species_similar || [];
  const sortedSimilar = [...rawSimilar].sort((a, b) => a.sort_order - b.sort_order);
  const mappedSimilar = sortedSimilar.map((item) => {
    const simSp = item.similar_species;
    const zhTransSim = simSp.species_translations.find((t) => t.lang === "zh");
    const enTransSim = simSp.species_translations.find((t) => t.lang === "en");
    const zhFeatures = item.species_similar_translations.find((t) => t.lang === "zh")?.comparison_features || [];
    const enFeatures = item.species_similar_translations.find((t) => t.lang === "en")?.comparison_features || [];
    
    return {
      code: simSp.species_code,
      scientificName: simSp.scientific_name,
      imageUrl: item.image_url || simSp.image_url || "", // 優先使用關係表中的對照專屬圖，若無則 fallback 主圖
      zh: {
        commonName: zhTransSim?.common_name || "",
        features: zhFeatures as { title: string; value: string }[],
      },
      en: {
        commonName: enTransSim?.common_name || "",
        features: enFeatures as { title: string; value: string }[],
      }
    };
  });

  result.similarSpecies = mappedSimilar.length > 0 ? mappedSimilar : undefined;

  // 整理回聲定位數據
  const rawEchos = row.species_echolocation || [];
  const sortedEchos = [...rawEchos].sort((a, b) => a.sort_order - b.sort_order);
  const mappedEchos = sortedEchos.map((item) => {
    const zhTrans = item.species_echolocation_translations?.find((t) => t.lang === "zh");
    const enTrans = item.species_echolocation_translations?.find((t) => t.lang === "en");
    return {
      id: item.id,
      callStructure: item.call_structure || undefined,
      duration: item.duration || undefined,
      interPulseInterval: item.inter_pulse_interval || undefined,
      peakFrequency: item.peak_frequency || undefined,
      highestFrequency: item.highest_frequency || undefined,
      lowestFrequency: item.lowest_frequency || undefined,
      startFrequency: item.start_frequency || undefined,
      endFrequency: item.end_frequency || undefined,
      zh: {
        location: zhTrans?.location || undefined,
        method: zhTrans?.method || undefined,
        reference: zhTrans?.reference || undefined,
        referenceUrl: zhTrans?.reference_url || undefined,
      },
      en: {
        location: enTrans?.location || undefined,
        method: enTrans?.method || undefined,
        reference: enTrans?.reference || undefined,
        referenceUrl: enTrans?.reference_url || undefined,
      }
    };
  });
  result.echolocations = mappedEchos.length > 0 ? mappedEchos : undefined;

  // 整理互動熱點 (Anatomy Hotspots)
  const rawHotspots = row.species_anatomy_hotspots || [];
  const mappedHotspots = rawHotspots.map((item) => {
    const zhContent = item.species_anatomy_hotspot_translations?.find((t) => t.lang === "zh")?.content || "";
    const enContent = item.species_anatomy_hotspot_translations?.find((t) => t.lang === "en")?.content || "";
    return {
      key: item.hotspot_key,
      x: Number(item.x_percent),
      y: Number(item.y_percent),
      placement: item.placement,
      zh: zhContent,
      en: enContent,
    };
  });
  result.hotspots = mappedHotspots.length > 0 ? mappedHotspots : undefined;

  // 整理藝廊照片，若資料庫無資料則使用 JSON fallback
  const rawPhotos = row.species_photos || [];
  if (rawPhotos.length > 0) {
    const sortedPhotos = [...rawPhotos].sort((a, b) => a.sort_order - b.sort_order);
    result.photos = sortedPhotos.map((p) => ({
      url: p.url,
      credit: p.credit || undefined,
      originalUrl: p.original_url || undefined,
    }));
  } else {
    // Fallback 讀取 JSON
    const galleryData = (speciesGalleries as any)[row.species_code];
    if (galleryData && galleryData.photos) {
      result.photos = galleryData.photos.map((p: any) => ({
        url: p.url,
        credit: p.credit || undefined,
        originalUrl: p.originalUrl || undefined,
      }));
    } else {
      result.photos = [];
    }
  }

  return result;
}

// 取得所有物種列表 (完全自 Supabase 讀取)
export async function getSpeciesList(): Promise<Species[]> {
  if (!isClientConfigured) {
    console.error("🔴 [Data Source] Supabase 憑證缺失，無法讀取物種名錄。");
    return [];
  }
  try {
    const { data, error } = await supabase
      .from("species")
      .select(`
        *,
        species_translations (*),
        species_photos (*),
        genera (
          scientific_name,
          genus_translations (*),
          families (
            scientific_name,
            family_translations (*)
          )
        ),
        diet_compositions (*),
        roosting_plants (*),
        diet_food_lists (*),
        species_echolocation (
          id,
          call_structure,
          duration,
          inter_pulse_interval,
          peak_frequency,
          highest_frequency,
          lowest_frequency,
          start_frequency,
          end_frequency,
          sort_order,
          species_echolocation_translations (*)
        ),
        species_anatomy_hotspots (
          hotspot_key,
          x_percent,
          y_percent,
          placement,
          species_anatomy_hotspot_translations (
            lang,
            content
          )
        )
      `);

    if (error) {
      console.error("🔴 [Data Source] 查詢 Supabase 失敗。錯誤詳情:", error);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn("🟡 [Data Source] Supabase 資料庫中的物種列表為空。");
      return [];
    }

    console.log(`🟢 [Data Source] 成功從 Supabase 讀取物種名錄，共計 ${data.length} 筆資料。`);
    return (data as unknown as SupabaseSpeciesRow[]).map(mapSupabaseToSpecies);
  } catch (err) {
    console.error("🔴 [Data Source] 連線 Supabase 失敗。錯誤:", err);
    return [];
  }
}

// 根據 species_code 取得特定物種 (完全自 Supabase 讀取)
export async function getSpeciesByCode(code: string): Promise<Species | null> {
  if (!isClientConfigured) {
    console.error(`🔴 [Data Source] Supabase 憑證缺失，無法查找物種。代碼: ${code}`);
    return null;
  }
  try {
    const { data, error } = await supabase
      .from("species")
      .select(`
        *,
        species_translations (*),
        species_photos (*),
        genera (
          scientific_name,
          genus_translations (*),
          families (
            scientific_name,
            family_translations (*)
          )
        ),
        diet_compositions (*),
        roosting_plants (*),
        diet_food_lists (*),
        species_similar:species_similar!species_similar_species_id_fkey (
          sort_order,
          image_url,
          similar_species:species!species_similar_similar_species_id_fkey (
            species_code,
            scientific_name,
            image_url,
            species_translations (lang, common_name)
          ),
          species_similar_translations (*)
        ),
        species_echolocation (
          id,
          call_structure,
          duration,
          inter_pulse_interval,
          peak_frequency,
          highest_frequency,
          lowest_frequency,
          start_frequency,
          end_frequency,
          sort_order,
          species_echolocation_translations (*)
        ),
        species_anatomy_hotspots (
          hotspot_key,
          x_percent,
          y_percent,
          placement,
          species_anatomy_hotspot_translations (
            lang,
            content
          )
        )
      `)
      .eq("species_code", code)
      .maybeSingle();

    if (error) {
      console.error(`🔴 [Data Source] 查詢 Supabase 失敗。物種代碼: ${code}。錯誤詳情:`, error);
      return null;
    }

    if (!data) {
      console.warn(`🟡 [Data Source] Supabase 資料庫中查無此物種。物種代碼: ${code}`);
      return null;
    }

    console.log(`🟢 [Data Source] 成功從 Supabase 讀取物種詳情，物種代碼: ${code}。`);
    return mapSupabaseToSpecies(data as unknown as SupabaseSpeciesRow);
  } catch (err) {
    console.error(`🔴 [Data Source] 連線 Supabase 失敗。物種代碼: ${code}。錯誤:`, err);
    return null;
  }
}

// ==========================================
// Checklist (名錄) 相關資料庫 API
// ==========================================

import type { Checklist, ChecklistSpecies } from "@/types/checklist";

/**
 * 取得所有地區名錄列表
 */
export async function getChecklists(): Promise<Checklist[]> {
  if (!isClientConfigured) return [];
  try {
    const { data, error } = await supabase
      .from("checklists")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("🔴 [Checklist DB] 取得名錄失敗:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("🔴 [Checklist DB] 連線失敗:", err);
    return [];
  }
}

/**
 * 根據代碼取得名錄
 */
export async function getChecklistByCode(code: string): Promise<Checklist | null> {
  if (!isClientConfigured) return null;
  try {
    const { data, error } = await supabase
      .from("checklists")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      console.error(`🔴 [Checklist DB] 取得名錄失敗 (code: ${code}):`, error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("🔴 [Checklist DB] 連線失敗:", err);
    return null;
  }
}

/**
 * 取得名錄所屬的物種關聯列表
 */
export async function getChecklistSpecies(checklistId: string): Promise<ChecklistSpecies[]> {
  if (!isClientConfigured) return [];
  try {
    const { data, error } = await supabase
      .from("checklist_species")
      .select("*")
      .eq("checklist_id", checklistId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("🔴 [Checklist DB] 取得名錄物種失敗:", error);
      return [];
    }

    if (!data) return [];

    return data.map((item: any) => {
      return {
        id: item.id,
        checklist_id: item.checklist_id,
        species_id: item.species_id,
        species_code: item.species_code,
        scientific_name: item.scientific_name,
        common_name_zh: item.common_name_zh,
        common_name_en: item.common_name_en,
        family_zh: item.family_zh,
        family_en: item.family_en,
        genus_zh: item.genus_zh,
        genus_en: item.genus_en,
        additional_fields: item.additional_fields || {},
        sort_order: item.sort_order || 0,
        created_at: item.created_at,
        species: {
          code: item.species_code,
          scientificName: item.scientific_name,
          family: {
            scientific: item.family_en || "",
            zh: item.family_zh || "",
            en: item.family_en || ""
          },
          genus: {
            scientific: item.genus_en || "",
            zh: item.genus_zh || "",
            en: item.genus_en || ""
          },
          synonyms: [],
          firstRecord: "",
          zh: {
            commonName: item.common_name_zh || "",
            otherCommonNames: []
          },
          en: {
            commonName: item.common_name_en || "",
            otherCommonNames: []
          }
        }
      };
    });
  } catch (err) {
    console.error("🔴 [Checklist DB] 連線失敗:", err);
    return [];
  }
}

/**
 * 批次匯入/更新名錄物種 (CSV 匯入使用)
 */
export async function upsertChecklistSpeciesBatch(
  checklistId: string,
  items: Array<{
    species_code: string;
    scientific_name?: string;
    common_name_zh?: string;
    common_name_en?: string;
    family_zh?: string;
    family_en?: string;
    genus_zh?: string;
    genus_en?: string;
    additional_fields: Record<string, string>;
  }>
): Promise<{ success: boolean; message: string }> {
  if (!isClientConfigured) return { success: false, message: "Supabase 未設定" };
  try {
    // 1. 先取得所有核心物種，做為 fallback 同步
    const { data: allSpecies, error: spError } = await supabase
      .from("species")
      .select(`
        id, 
        species_code, 
        scientific_name,
        genus_id,
        genera (
          scientific_name,
          genus_translations (lang, common_name),
          families (
            scientific_name,
            family_translations (lang, common_name)
          )
        ),
        species_translations (lang, common_name)
      `);

    if (spError || !allSpecies) {
      return { success: false, message: `無法取得物種清單: ${spError?.message}` };
    }

    // 2. 建立核心物種 Map 對照表
    const speciesMap = new Map<string, any>();
    allSpecies.forEach((s: any) => {
      const zhTrans = s.species_translations?.find((t: any) => t.lang === "zh");
      const enTrans = s.species_translations?.find((t: any) => t.lang === "en");
      
      const genZh = s.genera?.genus_translations?.find((t: any) => t.lang === "zh")?.common_name || "";
      const famZh = s.genera?.families?.family_translations?.find((t: any) => t.lang === "zh")?.common_name || "";

      speciesMap.set(s.species_code.toLowerCase().trim(), {
        id: s.id,
        scientific_name: s.scientific_name,
        common_name_zh: zhTrans?.common_name || "",
        common_name_en: enTrans?.common_name || "",
        family_zh: famZh || "",
        family_en: s.genera?.families?.scientific_name || "",
        genus_zh: genZh || "",
        genus_en: s.genera?.scientific_name || ""
      });
    });

    // 3. 取得當前已存在於名錄的物種，做為另一層 fallback (如果 CSV 沒有填物種基本資料，但已存在，保留舊值)
    const { data: existingChecklistSpecies, error: clSpError } = await supabase
      .from("checklist_species")
      .select("*")
      .eq("checklist_id", checklistId);

    const existingMap = new Map<string, any>();
    if (!clSpError && existingChecklistSpecies) {
      existingChecklistSpecies.forEach((item) => {
        existingMap.set(item.species_code.toLowerCase().trim(), item);
      });
    }

    // 4. 轉換資料
    const toUpsert: any[] = [];
    const errors: string[] = [];

    items.forEach((item, index) => {
      const codeClean = item.species_code.toLowerCase().trim();
      if (!codeClean) return;

      const existing = existingMap.get(codeClean);
      const core = speciesMap.get(codeClean);

      const scientific_name = item.scientific_name || existing?.scientific_name || core?.scientific_name || "";
      const common_name_zh = item.common_name_zh || existing?.common_name_zh || core?.common_name_zh || "";
      const common_name_en = item.common_name_en || existing?.common_name_en || core?.common_name_en || "";
      const family_zh = item.family_zh || existing?.family_zh || core?.family_zh || "";
      const family_en = item.family_en || existing?.family_en || core?.family_en || "";
      const genus_zh = item.genus_zh || existing?.genus_zh || core?.genus_zh || "";
      const genus_en = item.genus_en || existing?.genus_en || core?.genus_en || "";

      // 驗證必填項
      if (!scientific_name || !common_name_zh || !family_zh || !genus_zh) {
        errors.push(`物種代碼 ${item.species_code}: 缺少學名、中文俗名、科中文名或屬中文名，且無法從系統中自動對齊補齊。`);
        return;
      }

      toUpsert.push({
        checklist_id: checklistId,
        species_id: core?.id || null, // 核心庫有此物種代碼則進行關聯，否則為 null
        species_code: item.species_code,
        scientific_name,
        common_name_zh,
        common_name_en: common_name_en || null,
        family_zh,
        family_en: family_en || null,
        genus_zh,
        genus_en: genus_en || null,
        additional_fields: item.additional_fields,
        sort_order: existing?.sort_order || (index + 1)
      });
    });

    if (toUpsert.length === 0) {
      return { success: false, message: `無可匯入的有效物種。失敗原因:\n${errors.join("\n")}` };
    }

    // 5. 批次寫入/更新，衝突鍵為 checklist_id 和 species_code
    const { error: upsertError } = await supabase
      .from("checklist_species")
      .upsert(toUpsert, { onConflict: "checklist_id,species_code" });

    if (upsertError) {
      return { success: false, message: `寫入資料庫失敗: ${upsertError.message}` };
    }

    let msg = `成功匯入/更新 ${toUpsert.length} 筆物種資料。`;
    if (errors.length > 0) {
      msg += ` 有 ${errors.length} 筆發生錯誤忽略: ${errors.join("; ")}`;
    }

    return { success: true, message: msg };
  } catch (err: any) {
    return { success: false, message: `發生錯誤: ${err?.message || err}` };
  }
}

