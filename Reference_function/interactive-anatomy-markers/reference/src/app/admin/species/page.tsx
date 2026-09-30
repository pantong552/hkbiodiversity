"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  Database, 
  Save, 
  Loader2, 
  Plus, 
  X, 
  Info, 
  Languages, 
  Settings2, 
  Eye, 
  HelpCircle,
  ArrowUp,
  ArrowDown,
  Trash2,
  Upload,
  Activity,
  UtensilsCrossed,
  CheckCircle,
  XCircle,
  MapPin,
  Shield,
  Home
} from "lucide-react";
import RichTextArea from "@/components/RichTextArea";
import speciesGalleries from "@/data/speciesGalleries.json";
import illustrationUrls from "@/data/illustrationUrls.json";
import silhouetteUrls from "@/data/silhouetteUrls.json";
import CustomDropdown from "@/components/CustomDropdown";
import { SynonymItem, AnatomyHotspotItem } from "@/types/species";
import { getOptimizedImageUrl } from "@/lib/cloudinary";


type SpeciesListOption = {
  id: string;
  species_code: string;
  scientific_name: string;
  common_name_zh: string;
};

type DietStudyForm = {
  _key: string;
  title_zh: string;
  title_en: string;
  source: string;
  source_url: string;
  items: { name_zh: string; name_en: string; percentage: number }[];
};

type RoostingStudyForm = {
  _key: string;
  title_zh: string;
  title_en: string;
  source: string;
  source_url: string;
  items: { plant_zh: string; plant_en: string; location_zh: string; location_en: string }[];
};

type DietFoodListStudyForm = {
  _key: string;
  title_zh: string;
  title_en: string;
  source: string;
  source_url: string;
  items: { plant_zh: string; plant_en: string; food_zh: string; food_en: string }[];
};

export default function SpeciesDataManagement() {
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesListOption[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"basic" | "morphology" | "ecology" | "diet" | "roosting" | "status" | "gallery" | "reference">("basic");
  const [photosForm, setPhotosForm] = useState<Array<{ id?: string; url: string; credit: string; license: string; original_url?: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [silhouetteUrl, setSilhouetteUrl] = useState<string>("");
  const [uploadingSilhouette, setUploadingSilhouette] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoCredit, setNewPhotoCredit] = useState("");
  const [newPhotoLicense, setNewPhotoLicense] = useState("All Rights Reserved");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [allLicenses, setAllLicenses] = useState<string[]>([
    "All Rights Reserved",
    "CC BY",
    "CC BY-NC",
    "CC BY-NC-ND",
    "CC BY-NC-SA",
    "CC BY-ND",
    "CC BY-SA"
  ]);

  // --- Credit & License 處理輔助函數 ---
  const licenseRegex = /(CC[- ]?BY[- ]?NC[- ]?ND|CC[- ]?BY[- ]?NC[- ]?SA|CC[- ]?BY[- ]?NC|CC[- ]?BY[- ]?ND|CC[- ]?BY[- ]?SA|CC[- ]?BY|All Rights? Reserved)/i;
  
  function parseCreditAndLicense(rawCredit: string) {
    if (!rawCredit) return { credit: "©", license: "All Rights Reserved" };
    const match = rawCredit.match(licenseRegex);
    if (match) {
      let lic = match[0];
      if (lic.toUpperCase().startsWith("CC")) {
        // 標準化 CC 格式，例如將 CC-BY NC 或 CC_BY_NC 統一轉換為標準的 CC BY-NC 等
        const upper = lic.toUpperCase().replace(/[- ]+/g, " ");
        if (upper.includes("BY NC ND")) lic = "CC BY-NC-ND";
        else if (upper.includes("BY NC SA")) lic = "CC BY-NC-SA";
        else if (upper.includes("BY NC")) lic = "CC BY-NC";
        else if (upper.includes("BY ND")) lic = "CC BY-ND";
        else if (upper.includes("BY SA")) lic = "CC BY-SA";
        else if (upper.includes("BY")) lic = "CC BY";
        else lic = upper;
      } else if (lic.toLowerCase().includes("right") && lic.toLowerCase().includes("reserved")) {
        lic = "All Rights Reserved";
      }
      let clean = rawCredit.replace(licenseRegex, "").replace(/\(\s*\)/g, "").trim();
      clean = clean.replace(/\s*,\s*$/, "").trim();
      if (!clean) clean = "©";
      return { credit: clean, license: lic };
    }
    return { credit: rawCredit, license: "All Rights Reserved" };
  }

  function combineCreditAndLicense(credit: string, license: string): string {
    if (!license) return credit;
    if (license === "All Rights Reserved") {
      // 如果已經有帶括號的 (All Rights Reserved)，直接回傳
      if (credit.includes("(All Rights Reserved)")) return credit;
      // 如果有不帶括號的 All Rights Reserved，將其替換為帶括號的
      if (credit.includes("All Rights Reserved")) {
        return credit.replace(/\s*All Rights? Reserved/gi, "").trim() + " (All Rights Reserved)";
      }
      // 如果完全沒有，則在末尾拼上
      return `${credit} (All Rights Reserved)`;
    }
    
    // 對於 CC 等授權，如果已經包含則直接回傳，否則拼接
    if (credit.includes(license)) return credit;
    return `${credit} ${license}`;
  }




  // --- 表單狀態 ---
  // 1. 物種主表數據 (species)
  const [mainForm, setMainForm] = useState({
    scientific_name: "",
    scientific_name_author: "",
    synonyms: [] as SynonymItem[],
    first_record: "",
    image_url: "",
    audio_url: "",
    anatomy_diagram_url: "",
    measurement_diagram_url: "",
    // 物理量測
    head_body_range: "",
    tail_range: "",
    ear_range: "",
    hind_foot_range: "",
    forearm_range: "",
    weight_range: "",
    // 翼形參數
    wing_length: "",
    wing_area: "",
    wing_loading: "",
    aspect_ratio: "",
    wing_tip_index: "",
    wing_reference: ""
  });

  // 2. 物種翻譯數據 (species_translations - zh)
  const [zhForm, setZhForm] = useState({
    common_name: "",
    taxonomic_notes: "",
    body_size_type: "",
    feature_fur: "",
    feature_ears: "",
    feature_head: "",
    feature_limbs: "",
    feature_tail: "",
    feature_other: "",
    ecology_habitat: "",
    ecology_habits: "",
    ecology_reproduction: "",
    ecology_hibernation: "",
    ecology_flight: "",
    ecology_foraging: "",
    ecology_diet: "",
    ecology_lifespan: "",
    ecology_migration: "",
    ecology_home_range: "",
    ecology_vocalizations: "",
    local_distribution: "",
    origin_type: "",
    local_status: "",
    china_status: "",
    global_status: "",
    potential_threats: "",
    references: [] as string[],
    other_common_names: [] as string[]
  });

  // 3. 物種翻譯數據 (species_translations - en)
  const [enForm, setEnForm] = useState({
    common_name: "",
    taxonomic_notes: "",
    body_size_type: "",
    feature_fur: "",
    feature_ears: "",
    feature_head: "",
    feature_limbs: "",
    feature_tail: "",
    feature_other: "",
    ecology_habitat: "",
    ecology_habits: "",
    ecology_reproduction: "",
    ecology_hibernation: "",
    ecology_flight: "",
    ecology_foraging: "",
    ecology_diet: "",
    ecology_lifespan: "",
    ecology_migration: "",
    ecology_home_range: "",
    ecology_vocalizations: "",
    local_distribution: "",
    origin_type: "",
    local_status: "",
    china_status: "",
    global_status: "",
    potential_threats: "",
    references: [] as string[],
    other_common_names: [] as string[]
  });

  // 輔劇編輯暫存
  const [newSynonym, setNewSynonym] = useState("");
  const [newSynonymAuthor, setNewSynonymAuthor] = useState("");
  const [newReference, setNewReference] = useState("");
  const [zhOtherNamesInput, setZhOtherNamesInput] = useState("");
  const [enOtherNamesInput, setEnOtherNamesInput] = useState("");

  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({
    show: false,
    message: "",
    type: "success"
  });

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ show: true, message, type });
  };

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const [hotspotsForm, setHotspotsForm] = useState<AnatomyHotspotItem[]>([]);
  const [activeMarkerKey, setActiveMarkerKey] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // --- 食性 (Diet) 狀態管理 ---
  const [dietForm, setDietForm] = useState<DietStudyForm[]>([]);
  const [dietNewItems, setDietNewItems] = useState<Record<string, { name_zh: string; name_en: string; pct: string }>>({}); 
  const [editingDietIndex, setEditingDietIndex] = useState<Record<string, number | null>>({});

  function addDietItem(studyKey: string) {
    const ni = dietNewItems[studyKey];
    if (!ni || (!ni.name_zh.trim() && !ni.name_en.trim()) || !ni.pct) return;
    const pct = parseFloat(ni.pct);
    if (isNaN(pct) || pct <= 0) return;

    const editIdx = editingDietIndex[studyKey];
    if (editIdx !== undefined && editIdx !== null) {
      setDietForm(prev => prev.map(d =>
        d._key === studyKey
          ? {
              ...d,
              items: d.items.map((it, i) => i === editIdx ? { name_zh: ni.name_zh.trim(), name_en: ni.name_en.trim(), percentage: pct } : it)
            }
          : d
      ));
      setEditingDietIndex(prev => ({ ...prev, [studyKey]: null }));
    } else {
      setDietForm(prev => prev.map(d =>
        d._key === studyKey
          ? { ...d, items: [...d.items, { name_zh: ni.name_zh.trim(), name_en: ni.name_en.trim(), percentage: pct }] }
          : d
      ));
    }
    setDietNewItems(prev => ({ ...prev, [studyKey]: { name_zh: "", name_en: "", pct: "" } }));
  }

  function editDietItem(studyKey: string, itemIdx: number, item: { name_zh: string; name_en: string; percentage: number }) {
    setDietNewItems(prev => ({
      ...prev,
      [studyKey]: { name_zh: item.name_zh, name_en: item.name_en, pct: item.percentage.toString() }
    }));
    setEditingDietIndex(prev => ({
      ...prev,
      [studyKey]: itemIdx
    }));
  }

  function removeDietItem(studyKey: string, itemIdx: number) {
    // 如果正在編輯該項目，刪除時要重設編輯狀態
    if (editingDietIndex[studyKey] === itemIdx) {
      setEditingDietIndex(prev => ({ ...prev, [studyKey]: null }));
      setDietNewItems(prev => ({ ...prev, [studyKey]: { name_zh: "", name_en: "", pct: "" } }));
    } else if (editingDietIndex[studyKey] !== null && (editingDietIndex[studyKey] ?? -1) > itemIdx) {
      // 調整編輯索引
      setEditingDietIndex(prev => ({ ...prev, [studyKey]: (prev[studyKey] ?? 0) - 1 }));
    }
    setDietForm(prev => prev.map(d =>
      d._key === studyKey
        ? { ...d, items: d.items.filter((_, i) => i !== itemIdx) }
        : d
    ));
  }

  // --- 棲息植物 (Roosting Plants) 狀態管理 ---
  const [roostingForm, setRoostingForm] = useState<RoostingStudyForm[]>([]);
  const [roostingNewItems, setRoostingNewItems] = useState<Record<string, { plant_zh: string; plant_en: string; location_zh: string; location_en: string }>>({});
  const [editingRoostingIndex, setEditingRoostingIndex] = useState<Record<string, number | null>>({});

  function addRoostingItem(studyKey: string) {
    const ni = roostingNewItems[studyKey];
    if (!ni || (!ni.plant_zh.trim() && !ni.plant_en.trim())) return;

    const editIdx = editingRoostingIndex[studyKey];
    if (editIdx !== undefined && editIdx !== null) {
      setRoostingForm(prev => prev.map(r =>
        r._key === studyKey
          ? {
              ...r,
              items: r.items.map((it, i) => i === editIdx ? { 
                plant_zh: ni.plant_zh.trim(), 
                plant_en: ni.plant_en.trim(), 
                location_zh: ni.location_zh.trim(), 
                location_en: ni.location_en.trim() 
              } : it)
            }
          : r
      ));
      setEditingRoostingIndex(prev => ({ ...prev, [studyKey]: null }));
    } else {
      setRoostingForm(prev => prev.map(r =>
        r._key === studyKey
          ? { ...r, items: [...r.items, { 
              plant_zh: ni.plant_zh.trim(), 
              plant_en: ni.plant_en.trim(), 
              location_zh: ni.location_zh.trim(), 
              location_en: ni.location_en.trim() 
            }] }
          : r
      ));
    }
    setRoostingNewItems(prev => ({ ...prev, [studyKey]: { plant_zh: "", plant_en: "", location_zh: "", location_en: "" } }));
  }

  function editRoostingItem(studyKey: string, itemIdx: number, item: { plant_zh: string; plant_en: string; location_zh: string; location_en: string }) {
    setRoostingNewItems(prev => ({
      ...prev,
      [studyKey]: { plant_zh: item.plant_zh, plant_en: item.plant_en, location_zh: item.location_zh, location_en: item.location_en }
    }));
    setEditingRoostingIndex(prev => ({
      ...prev,
      [studyKey]: itemIdx
    }));
  }

  function removeRoostingItem(studyKey: string, itemIdx: number) {
    if (editingRoostingIndex[studyKey] === itemIdx) {
      setEditingRoostingIndex(prev => ({ ...prev, [studyKey]: null }));
      setRoostingNewItems(prev => ({ ...prev, [studyKey]: { plant_zh: "", plant_en: "", location_zh: "", location_en: "" } }));
    } else if (editingRoostingIndex[studyKey] !== null && (editingRoostingIndex[studyKey] ?? -1) > itemIdx) {
      setEditingRoostingIndex(prev => ({ ...prev, [studyKey]: (prev[studyKey] ?? 0) - 1 }));
    }
    setRoostingForm(prev => prev.map(r =>
      r._key === studyKey
        ? { ...r, items: r.items.filter((_, i) => i !== itemIdx) }
        : r
    ));
  }

  // --- 非百分比食性 (Diet Food List) 狀態管理 ---
  const [dietFoodListForm, setDietFoodListForm] = useState<DietFoodListStudyForm[]>([]);
  const [dietFoodListNewItems, setDietFoodListNewItems] = useState<Record<string, { plant_zh: string; plant_en: string; food_zh: string; food_en: string }>>({});
  const [editingDietFoodListIndex, setEditingDietFoodListIndex] = useState<Record<string, number | null>>({});

  function addDietFoodListItem(studyKey: string) {
    const ni = dietFoodListNewItems[studyKey];
    if (!ni || (!ni.plant_zh.trim() && !ni.plant_en.trim())) return;

    const editIdx = editingDietFoodListIndex[studyKey];
    if (editIdx !== undefined && editIdx !== null) {
      setDietFoodListForm(prev => prev.map(d =>
        d._key === studyKey
          ? {
              ...d,
              items: d.items.map((it, i) => i === editIdx ? {
                plant_zh: ni.plant_zh.trim(),
                plant_en: ni.plant_en.trim(),
                food_zh: ni.food_zh.trim(),
                food_en: ni.food_en.trim()
              } : it)
            }
          : d
      ));
      setEditingDietFoodListIndex(prev => ({ ...prev, [studyKey]: null }));
    } else {
      setDietFoodListForm(prev => prev.map(d =>
        d._key === studyKey
          ? { ...d, items: [...d.items, { 
              plant_zh: ni.plant_zh.trim(), 
              plant_en: ni.plant_en.trim(), 
              food_zh: ni.food_zh.trim(), 
              food_en: ni.food_en.trim() 
            }] }
          : d
      ));
    }
    setDietFoodListNewItems(prev => ({ ...prev, [studyKey]: { plant_zh: "", plant_en: "", food_zh: "", food_en: "" } }));
  }

  type DietFoodItemType = { plant_zh: string; plant_en: string; food_zh: string; food_en: string };

  function editDietFoodListItem(studyKey: string, itemIdx: number, item: DietFoodItemType) {
    setDietFoodListNewItems(prev => ({
      ...prev,
      [studyKey]: { plant_zh: item.plant_zh, plant_en: item.plant_en, food_zh: item.food_zh, food_en: item.food_en }
    }));
    setEditingDietFoodListIndex(prev => ({
      ...prev,
      [studyKey]: itemIdx
    }));
  }

  function removeDietFoodListItem(studyKey: string, itemIdx: number) {
    if (editingDietFoodListIndex[studyKey] === itemIdx) {
      setEditingDietFoodListIndex(prev => ({ ...prev, [studyKey]: null }));
      setDietFoodListNewItems(prev => ({ ...prev, [studyKey]: { plant_zh: "", plant_en: "", food_zh: "", food_en: "" } }));
    } else if (editingDietFoodListIndex[studyKey] !== null && (editingDietFoodListIndex[studyKey] ?? -1) > itemIdx) {
      setEditingDietFoodListIndex(prev => ({ ...prev, [studyKey]: (prev[studyKey] ?? 0) - 1 }));
    }
    setDietFoodListForm(prev => prev.map(d =>
      d._key === studyKey
        ? { ...d, items: d.items.filter((_, i) => i !== itemIdx) }
        : d
    ));
  }

  // --- 互動式插圖標記 (Interactive Illustration) 拖曳與新增邏輯 ---
  const selectedSpeciesCode = speciesOptions.find(o => o.id === selectedSpeciesId)?.species_code || "";
  const illustrations = (illustrationUrls as Record<string, string | null>)[selectedSpeciesCode];
  const bgImage = illustrations || (
    selectedSpeciesCode === "cynopterus_sphinx" 
      ? "/images/cynopterus_sphinx_anatomy.png" 
      : "/images/hipposideros_armiger_anatomy.png"
  );

  const activeMarker = hotspotsForm.find(hs => hs.key === activeMarkerKey);

  const handleMarkerMouseDown = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMarkerKey(key);
    setIsDragging(true);
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !activeMarkerKey) return;
    const rect = e.currentTarget.getBoundingClientRect();
    
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    setHotspotsForm(prev =>
      prev.map(hs => (hs.key === activeMarkerKey ? { ...hs, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) } : hs))
    );
  };

  const handleContainerMouseUp = () => {
    setIsDragging(false);
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newKey = `part_${Date.now()}`;
    const newMarker = {
      key: newKey,
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      placement: "top",
      zh: "請輸入中文特徵描述",
      en: "Enter English morphological description here"
    };

    setHotspotsForm(prev => [...prev, newMarker]);
    setActiveMarkerKey(newKey);
  };

  // 載入物種下拉選單
  useEffect(() => {
    async function fetchOptions() {
      try {
        const { data, error } = await supabase
          .from("species")
          .select(`
            id, 
            species_code, 
            scientific_name,
            species_translations(lang, common_name)
          `);
        if (error) throw error;

        const options = (data || []).map((s: any) => {
          const zh = s.species_translations?.find((t: any) => t.lang === "zh");
          return {
            id: s.id,
            species_code: s.species_code,
            scientific_name: s.scientific_name,
            common_name_zh: zh?.common_name || ""
          };
        });
        // 排序
        options.sort((a, b) => a.scientific_name.localeCompare(b.scientific_name));
        setSpeciesOptions(options);
        
        if (options.length > 0) {
          setSelectedSpeciesId(options[0].id);
        }

        // 載入全站已使用的 License 供 Dropdown 選擇
        try {
          const { data: pData, error: pErr } = await supabase
            .from("species_photos")
            .select("credit");
          if (!pErr && pData) {
            const licensesSet = new Set<string>([
              "All Rights Reserved",
              "CC BY",
              "CC BY-NC",
              "CC BY-NC-ND",
              "CC BY-NC-SA",
              "CC BY-ND",
              "CC BY-SA"
            ]);
            pData.forEach((p: any) => {
              if (p.credit) {
                const match = p.credit.match(licenseRegex);
                if (match) {
                  let lic = match[0];
                  if (lic.toUpperCase().startsWith("CC")) {
                    lic = lic.toUpperCase();
                  } else if (lic.toLowerCase().includes("rights reserved")) {
                    lic = "All Rights Reserved";
                  }
                  licensesSet.add(lic);
                }
              }
            });
            setAllLicenses(Array.from(licensesSet));
          }
        } catch (licErr) {
          console.error("Failed to load global licenses:", licErr);
        }

      } catch (err) {
        console.error("Failed to load species options:", err);
      }
    }
    fetchOptions();
  }, []);

  // 載入選定物種數據
  useEffect(() => {
    if (!selectedSpeciesId) return;

    async function loadSpeciesData() {
      setLoading(true);
      try {
        // 讀取 species
        const { data: sp, error: spErr } = await supabase
          .from("species")
          .select("*")
          .eq("id", selectedSpeciesId)
          .single();
        if (spErr) throw spErr;

        const rawSynonyms = sp.synonyms || [];
        const rawAuthors = sp.synonym_authors || [];
        const synonymsList = rawSynonyms.map((syn: string, idx: number) => ({
          name: syn,
          author: rawAuthors[idx] || ""
        }));

        setMainForm({
          scientific_name: sp.scientific_name || "",
          scientific_name_author: sp.scientific_name_author || "",
          synonyms: synonymsList,
          first_record: sp.first_record || "",
          image_url: sp.image_url || "",
          audio_url: sp.audio_url || "",
          anatomy_diagram_url: sp.anatomy_diagram_url || "",
          measurement_diagram_url: sp.measurement_diagram_url || "",
          head_body_range: sp.head_body_range || "",
          tail_range: sp.tail_range || "",
          ear_range: sp.ear_range || "",
          hind_foot_range: sp.hind_foot_range || "",
          forearm_range: sp.forearm_range || "",
          weight_range: sp.weight_range || "",
          wing_length: sp.wing_length || "",
          wing_area: sp.wing_area || "",
          wing_loading: sp.wing_loading || "",
          aspect_ratio: sp.aspect_ratio || "",
          wing_tip_index: sp.wing_tip_index || "",
          wing_reference: sp.wing_reference || ""
        });

        const silUrl = (silhouetteUrls as Record<string, string>)[sp.species_code] || "";
        setSilhouetteUrl(silUrl);

        // 讀取 translations
        const { data: trans, error: transErr } = await supabase
          .from("species_translations")
          .select("*")
          .eq("species_id", selectedSpeciesId);
        if (transErr) throw transErr;

        const zh = trans?.find((t) => t.lang === "zh");
        const en = trans?.find((t) => t.lang === "en");

        const defaultTranslation = {
          common_name: "",
          taxonomic_notes: "",
          body_size_type: "",
          feature_fur: "",
          feature_ears: "",
          feature_head: "",
          feature_limbs: "",
          feature_tail: "",
          feature_other: "",
          ecology_habitat: "",
          ecology_habits: "",
          ecology_reproduction: "",
          ecology_hibernation: "",
          ecology_flight: "",
          ecology_foraging: "",
          ecology_diet: "",
          ecology_lifespan: "",
          ecology_migration: "",
          ecology_home_range: "",
          ecology_vocalizations: "",
          local_distribution: "",
          origin_type: "",
          local_status: "",
          china_status: "",
          global_status: "",
          potential_threats: "",
          references: [],
          other_common_names: []
        };

        setZhForm(zh ? { ...defaultTranslation, ...zh, references: zh.references || [], other_common_names: zh.other_common_names || [] } : defaultTranslation);
        setEnForm(en ? { ...defaultTranslation, ...en, references: en.references || [], other_common_names: en.other_common_names || [] } : defaultTranslation);
        
        setZhOtherNamesInput(zh?.other_common_names ? zh.other_common_names.join("、") : "");
        setEnOtherNamesInput(en?.other_common_names ? en.other_common_names.join(", ") : "");

        // 4. 載入相片藝廊
        const { data: pData, error: pErr } = await supabase
          .from("species_photos")
          .select("*")
          .eq("species_id", selectedSpeciesId)
          .order("sort_order", { ascending: true });
        if (pErr) throw pErr;

        if (pData && pData.length > 0) {
          setPhotosForm(pData.map(p => {
            const parsed = parseCreditAndLicense(p.credit || "");
            return {
              id: p.id,
              url: p.url,
              credit: parsed.credit,
              license: parsed.license,
              original_url: p.original_url || ""
            };
          }));
        } else {
          // fallback 讀取 json 預設照片
          const code = sp.species_code;
          const galleryData = (speciesGalleries as any)[code];
          if (galleryData && galleryData.photos) {
            setPhotosForm(galleryData.photos.map((p: any) => {
              const parsed = parseCreditAndLicense(p.credit || "");
              return {
                url: p.url,
                credit: parsed.credit,
                license: parsed.license,
                original_url: p.originalUrl || ""
              };
            }));
          } else {
            setPhotosForm([]);
          }
        }

        // 5. 載入互動熱點
        const { data: hsData, error: hsErr } = await supabase
          .from("species_anatomy_hotspots")
          .select(`
            id,
            hotspot_key,
            x_percent,
            y_percent,
            placement,
            species_anatomy_hotspot_translations (
              lang,
              content
            )
          `)
          .eq("species_id", selectedSpeciesId);
        
        if (hsErr) throw hsErr;

        if (hsData) {
          const mapped = hsData.map((item: any) => {
            const zhContent = item.species_anatomy_hotspot_translations?.find((t: any) => t.lang === "zh")?.content || "";
            const enContent = item.species_anatomy_hotspot_translations?.find((t: any) => t.lang === "en")?.content || "";
            return {
              key: item.hotspot_key,
              x: Number(item.x_percent),
              y: Number(item.y_percent),
              placement: item.placement || "top",
              zh: zhContent,
              en: enContent
            };
          });
          setHotspotsForm(mapped);
        } else {
          setHotspotsForm([]);
        }
        setActiveMarkerKey(null);

        // 6. 載入食性資料 (diet_compositions)
        const { data: dietData, error: dietErr } = await supabase
          .from("diet_compositions")
          .select("*")
          .eq("species_id", selectedSpeciesId);
        if (dietErr) throw dietErr;

        if (dietData && dietData.length > 0) {
          const mapped: DietStudyForm[] = dietData.map((d: any) => ({
            _key: d.id || Math.random().toString(36).slice(2, 11),
            title_zh: d.title_zh || "",
            title_en: d.title_en || "",
            source: d.source || "",
            source_url: d.source_url || "",
            items: (d.items || []) as { name_zh: string; name_en: string; percentage: number }[],
          }));
          setDietForm(mapped);
          const newItems: Record<string, { name_zh: string; name_en: string; pct: string }> = {};
          mapped.forEach((m) => { newItems[m._key] = { name_zh: "", name_en: "", pct: "" }; });
          setDietNewItems(newItems);
        } else {
          setDietForm([]);
          setDietNewItems({});
        }

        // 7. 載入棲息植物資料 (roosting_plants)
        const { data: roostingData, error: roostingErr } = await supabase
          .from("roosting_plants")
          .select("*")
          .eq("species_id", selectedSpeciesId);
        if (roostingErr) throw roostingErr;

        if (roostingData && roostingData.length > 0) {
          const mapped: RoostingStudyForm[] = roostingData.map((r: any) => ({
            _key: r.id || Math.random().toString(36).slice(2, 11),
            title_zh: r.title_zh || "",
            title_en: r.title_en || "",
            source: r.source || "",
            source_url: r.source_url || "",
            items: (r.items || []) as { plant_zh: string; plant_en: string; location_zh: string; location_en: string }[],
          }));
          setRoostingForm(mapped);
          const newItems: Record<string, { plant_zh: string; plant_en: string; location_zh: string; location_en: string }> = {};
          mapped.forEach((m) => { newItems[m._key] = { plant_zh: "", plant_en: "", location_zh: "", location_en: "" }; });
          setRoostingNewItems(newItems);
        } else {
          setRoostingForm([]);
          setRoostingNewItems({});
        }

        // 8. 載入非百分比食性資料 (diet_food_lists)
        const { data: dietFoodListData, error: dietFoodListErr } = await supabase
          .from("diet_food_lists")
          .select("*")
          .eq("species_id", selectedSpeciesId);
        if (dietFoodListErr) throw dietFoodListErr;

        if (dietFoodListData && dietFoodListData.length > 0) {
          const mapped: DietFoodListStudyForm[] = dietFoodListData.map((d: any) => ({
            _key: d.id || Math.random().toString(36).slice(2, 11),
            title_zh: d.title_zh || "",
            title_en: d.title_en || "",
            source: d.source || "",
            source_url: d.source_url || "",
            items: (d.items || []) as { plant_zh: string; plant_en: string; food_zh: string; food_en: string }[],
          }));
          setDietFoodListForm(mapped);
          const newItems: Record<string, { plant_zh: string; plant_en: string; food_zh: string; food_en: string }> = {};
          mapped.forEach((m) => { newItems[m._key] = { plant_zh: "", plant_en: "", food_zh: "", food_en: "" }; });
          setDietFoodListNewItems(newItems);
        } else {
          setDietFoodListForm([]);
          setDietFoodListNewItems({});
        }

      } catch (err: any) {
        console.error("Failed to load species detailed data:", err);
        showToast("載入物種詳細資料失敗: " + (err.message || String(err)), "error");
      } finally {
        setLoading(false);
      }
    }

    loadSpeciesData();
  }, [selectedSpeciesId]);

  // 同物異名 Tag 增刪
  function addSynonym() {
    const name = newSynonym.trim();
    const author = newSynonymAuthor.trim();
    if (name) {
      if (!mainForm.synonyms.some((s) => s.name === name)) {
        setMainForm({
          ...mainForm,
          synonyms: [...mainForm.synonyms, { name, author }]
        });
        setNewSynonym("");
        setNewSynonymAuthor("");
      } else {
        alert("此學名已存在於同物異名列表中。");
      }
    }
  }

  function removeSynonym(name: string) {
    setMainForm({
      ...mainForm,
      synonyms: mainForm.synonyms.filter((s) => s.name !== name)
    });
  }

  // 參考文獻項目增刪 (中英文同步或獨立，這裡為雙語各自分立)
  function addReference(lang: "zh" | "en") {
    if (!newReference.trim()) return;
    if (lang === "zh") {
      setZhForm({
        ...zhForm,
        references: [...zhForm.references, newReference.trim()]
      });
    } else {
      setEnForm({
        ...enForm,
        references: [...enForm.references, newReference.trim()]
      });
    }
    setNewReference("");
  }

  function removeReference(lang: "zh" | "en", index: number) {
    if (lang === "zh") {
      setZhForm({
        ...zhForm,
        references: zhForm.references.filter((_, i) => i !== index)
      });
    } else {
      setEnForm({
        ...enForm,
        references: enForm.references.filter((_, i) => i !== index)
      });
    }
  }

  // 保存所有修改
  async function handleSave() {
    if (!selectedSpeciesId) return;
    setSaving(true);
    try {
      // 1. 更新 species 主表
      const { error: spErr } = await supabase
        .from("species")
        .update({
          scientific_name: mainForm.scientific_name,
          scientific_name_author: mainForm.scientific_name_author || null,
          synonyms: mainForm.synonyms.map(s => s.name),
          synonym_authors: mainForm.synonyms.map(s => s.author),
          first_record: mainForm.first_record,
          image_url: mainForm.image_url,
          audio_url: mainForm.audio_url,
          anatomy_diagram_url: mainForm.anatomy_diagram_url,
          measurement_diagram_url: mainForm.measurement_diagram_url,
          head_body_range: mainForm.head_body_range,
          tail_range: mainForm.tail_range,
          ear_range: mainForm.ear_range,
          hind_foot_range: mainForm.hind_foot_range,
          forearm_range: mainForm.forearm_range,
          weight_range: mainForm.weight_range,
          wing_length: mainForm.wing_length,
          wing_area: mainForm.wing_area,
          wing_loading: mainForm.wing_loading,
          aspect_ratio: mainForm.aspect_ratio,
          wing_tip_index: mainForm.wing_tip_index,
          wing_reference: mainForm.wing_reference
        })
        .eq("id", selectedSpeciesId);

      if (spErr) throw spErr;

      // 2. 更新/插入中文翻譯 (zh)
      const { error: zhErr } = await supabase
        .from("species_translations")
        .upsert(
          { 
            species_id: selectedSpeciesId, 
            lang: "zh", 
            ...zhForm,
            other_common_names: zhOtherNamesInput.split(/[，、,]/).map(s => s.trim()).filter(Boolean)
          },
          { onConflict: "species_id,lang" }
        );

      if (zhErr) throw zhErr;

      // 3. 更新/插入英文翻譯 (en)
      const { error: enErr } = await supabase
        .from("species_translations")
        .upsert(
          { 
            species_id: selectedSpeciesId, 
            lang: "en", 
            ...enForm,
            other_common_names: enOtherNamesInput.split(/[,，]/).map(s => s.trim()).filter(Boolean)
          },
          { onConflict: "species_id,lang" }
        );

      if (enErr) throw enErr;

      // 4. 更新/儲存相片藝廊
      const { error: delPhotoErr } = await supabase
        .from("species_photos")
        .delete()
        .eq("species_id", selectedSpeciesId);

      if (delPhotoErr) throw delPhotoErr;

      if (photosForm.length > 0) {
        const insertData = photosForm.map((p, idx) => ({
          species_id: selectedSpeciesId,
          url: p.url,
          credit: combineCreditAndLicense(p.credit, p.license) || null,
          original_url: p.original_url || null,
          sort_order: idx
        }));

        const { error: insPhotoErr } = await supabase
          .from("species_photos")
          .insert(insertData);

        if (insPhotoErr) throw insPhotoErr;
      }

      // 5. 更新/儲存互動熱點 (Anatomy Hotspots)
      const { error: delHSErr } = await supabase
        .from("species_anatomy_hotspots")
        .delete()
        .eq("species_id", selectedSpeciesId);

      if (delHSErr) throw delHSErr;

      if (hotspotsForm.length > 0) {
        const insertHotspots = hotspotsForm.map((hs) => ({
          species_id: selectedSpeciesId,
          hotspot_key: hs.key,
          x_percent: hs.x,
          y_percent: hs.y,
          placement: hs.placement || "top"
        }));

        const { data: insertedRows, error: insHSErr } = await supabase
          .from("species_anatomy_hotspots")
          .insert(insertHotspots)
          .select("id, hotspot_key");

        if (insHSErr) throw insHSErr;

        if (insertedRows && insertedRows.length > 0) {
          const insertTranslations: any[] = [];
          insertedRows.forEach((row: any) => {
            const matchedForm = hotspotsForm.find(hs => hs.key === row.hotspot_key);
            if (matchedForm) {
              insertTranslations.push({
                hotspot_id: row.id,
                lang: "zh",
                content: matchedForm.zh
              });
              insertTranslations.push({
                hotspot_id: row.id,
                lang: "en",
                content: matchedForm.en
              });
            }
          });

          if (insertTranslations.length > 0) {
            const { error: insTransErr } = await supabase
              .from("species_anatomy_hotspot_translations")
              .insert(insertTranslations);
            if (insTransErr) throw insTransErr;
          }
        }
      }

      // 6. 更新/儲存食性資料 (diet_compositions)
      const { error: delDietErr } = await supabase
        .from("diet_compositions")
        .delete()
        .eq("species_id", selectedSpeciesId);

      if (delDietErr) throw delDietErr;

      if (dietForm.length > 0) {
        const insertDiet = dietForm.map((d) => ({
          species_id: selectedSpeciesId,
          title_zh: d.title_zh,
          title_en: d.title_en,
          source: d.source || null,
          source_url: d.source_url || null,
          items: d.items,
        }));

        const { error: insDietErr } = await supabase
          .from("diet_compositions")
          .insert(insertDiet);

        if (insDietErr) throw insDietErr;
      }

      // 7. 更新/儲存棲息植物資料 (roosting_plants)
      const { error: delRoostingErr } = await supabase
        .from("roosting_plants")
        .delete()
        .eq("species_id", selectedSpeciesId);

      if (delRoostingErr) throw delRoostingErr;

      if (roostingForm.length > 0) {
        const insertRoosting = roostingForm.map((r) => ({
          species_id: selectedSpeciesId,
          title_zh: r.title_zh,
          title_en: r.title_en,
          source: r.source || null,
          source_url: r.source_url || null,
          items: r.items,
        }));

        const { error: insRoostingErr } = await supabase
          .from("roosting_plants")
          .insert(insertRoosting);

        if (insRoostingErr) throw insRoostingErr;
      }

      // 8. 更新/儲存非百分比食性資料 (diet_food_lists)
      const { error: delDietFoodListErr } = await supabase
        .from("diet_food_lists")
        .delete()
        .eq("species_id", selectedSpeciesId);

      if (delDietFoodListErr) throw delDietFoodListErr;

      if (dietFoodListForm.length > 0) {
        const insertDietFoodList = dietFoodListForm.map((d) => ({
          species_id: selectedSpeciesId,
          title_zh: d.title_zh,
          title_en: d.title_en,
          source: d.source || null,
          source_url: d.source_url || null,
          items: d.items,
        }));

        const { error: insDietFoodListErr } = await supabase
          .from("diet_food_lists")
          .insert(insertDietFoodList);

        if (insDietFoodListErr) throw insDietFoodListErr;
      }

      showToast("儲存成功！", "success");
    } catch (err: any) {
      showToast("儲存失敗: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  // --- 相片藝廊管理輔助函數 ---
  async function handleUploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const file = files[0];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "hkbr_preset"); // 預設使用專案 Cloudinary unsigned preset
      
      const res = await fetch("https://api.cloudinary.com/v1_1/dusun9dtd/image/upload", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) throw new Error("Cloudinary 上傳失敗。");
      const data = await res.json();
      
      setPhotosForm([
        ...photosForm,
        {
          url: data.secure_url,
          credit: "©",
          license: "All Rights Reserved",
          original_url: ""
        }
      ]);
    } catch (err: any) {
      console.error(err);
      alert("上傳失敗 (可能未配置 Cloudinary 無簽名上傳 Preset 'hkbr_preset')。您可以直接在下方輸入圖片網址加入相片！");
    } finally {
      setUploading(false);
      e.target.value = ""; // 重設 input
    }
  }

  async function handleUploadSilhouette(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingSilhouette(true);
    try {
      const file = files[0];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("speciesCode", selectedSpeciesCode);

      const res = await fetch("/api/admin/upload-silhouette", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "上傳與儲存失敗。");
      }
      
      const data = await res.json();
      const newUrl = data.secure_url;
      
      setSilhouetteUrl(newUrl);
      (silhouetteUrls as Record<string, string>)[selectedSpeciesCode] = newUrl;

      showToast("飛行剪影上傳成功！", "success");
    } catch (err: any) {
      console.error(err);
      alert("上傳失敗: " + (err.message || err));
    } finally {
      setUploadingSilhouette(false);
      e.target.value = ""; // 重設 input
    }
  }

  async function handleDeleteSilhouette() {
    if (!window.confirm("確定要刪除此物種的飛行剪影嗎？")) return;
    setUploadingSilhouette(true);
    try {
      const res = await fetch("/api/admin/upload-silhouette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speciesCode: selectedSpeciesCode, url: "" })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "刪除失敗。");
      }
      
      setSilhouetteUrl("");
      delete (silhouetteUrls as Record<string, string>)[selectedSpeciesCode];
      showToast("飛行剪影已刪除！", "success");
    } catch (err: any) {
      console.error(err);
      alert("刪除失敗: " + (err.message || err));
    } finally {
      setUploadingSilhouette(false);
    }
  }

  function handleAddPhotoManual() {
    if (!newPhotoUrl.trim()) {
      alert("請輸入圖片網址。");
      return;
    }
    setPhotosForm([
      ...photosForm,
      {
        url: newPhotoUrl.trim(),
        credit: newPhotoCredit.trim() || "©",
        license: newPhotoLicense,
        original_url: ""
      }
    ]);
    setNewPhotoUrl("");
    setNewPhotoCredit("");
    setNewPhotoLicense("All Rights Reserved");
  }

  function handleDeletePhoto(index: number) {
    setPhotosForm(photosForm.filter((_, i) => i !== index));
  }

  function handleMovePhoto(index: number, direction: "up" | "down") {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === photosForm.length - 1) return;
    
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...photosForm];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setPhotosForm(updated);
  }

  // Helper 渲染雙語對照輸入框
  const renderBilingualField = (
    label: string,
    zhValue: string,
    enValue: string,
    zhKey: keyof typeof zhForm,
    enKey: keyof typeof enForm,
    isTextArea = false
  ) => {
    return (
      <div className="flex flex-col gap-2 pb-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">{label}</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 中文 */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-admin-text-secondary font-semibold uppercase flex items-center gap-1">
              <Languages className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> 中文描述
            </span>
            {isTextArea ? (
              <RichTextArea
                value={zhValue}
                onChange={(val) => setZhForm({ ...zhForm, [zhKey]: val })}
              />
            ) : (
              <input
                type="text"
                value={zhValue}
                onChange={(e) => setZhForm({ ...zhForm, [zhKey]: e.target.value })}
                className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            )}
          </div>
          {/* 英文 */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-admin-text-secondary font-semibold uppercase flex items-center gap-1">
              <Languages className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> 英文描述
            </span>
            {isTextArea ? (
              <RichTextArea
                value={enValue}
                onChange={(val) => setEnForm({ ...enForm, [enKey]: val })}
              />
            ) : (
              <input
                type="text"
                value={enValue}
                onChange={(e) => setEnForm({ ...enForm, [enKey]: e.target.value })}
                className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 頂部操作 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-admin-card-border pb-4">
        <div>
          <h1 className="text-lg font-bold text-admin-text-primary">物種基礎數據編輯</h1>
          <p className="text-xs text-admin-text-secondary mt-1">
            編輯物種學名、物理參數、圖表 URL 及其詳盡的中英文翻譯資料。
          </p>
        </div>
        <div className="flex gap-3 items-center w-full sm:w-auto">
          <CustomDropdown
            value={selectedSpeciesId}
            onChange={(val) => setSelectedSpeciesId(val)}
            options={speciesOptions.map((opt) => ({
              id: opt.id,
              name: opt.scientific_name,
              subName: opt.common_name_zh,
            }))}
            className="w-full sm:w-auto flex-1 sm:flex-initial"
          />
          <button
            onClick={handleSave}
            disabled={saving || loading || !selectedSpeciesId}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 border border-admin-card-border"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>儲存修改</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[400px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
        </div>
      ) : !selectedSpeciesId ? (
        <div className="min-h-[200px] flex items-center justify-center text-admin-text-secondary text-xs">
          請先前往「分類學管理」新增物種
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* 子 Tab 選擇器 */}
          <div className="flex bg-admin-bg-panel p-1 rounded-xl border border-admin-card-border self-start gap-1">
            <button
              onClick={() => setActiveSubTab("basic")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "basic" ? "bg-admin-card-bg text-admin-text-primary border border-admin-card-border shadow-sm" : "text-admin-text-secondary hover:bg-admin-hover-bg hover:text-admin-text-primary"
              }`}
            >
              基本資料 (Basic Info)
            </button>
            <button
              onClick={() => setActiveSubTab("morphology")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "morphology" ? "bg-admin-card-bg text-admin-text-primary border border-admin-card-border shadow-sm" : "text-admin-text-secondary hover:bg-admin-hover-bg hover:text-admin-text-primary"
              }`}
            >
              外形特徵 (Morphology)
            </button>
            <button
              onClick={() => setActiveSubTab("ecology")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "ecology" ? "bg-admin-card-bg text-admin-text-primary border border-admin-card-border shadow-sm" : "text-admin-text-secondary hover:bg-admin-hover-bg hover:text-admin-text-primary"
              }`}
            >
              生態資料 (Ecology)
            </button>
            <button
              onClick={() => setActiveSubTab("diet")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "diet" ? "bg-admin-card-bg text-admin-text-primary border border-admin-card-border shadow-sm" : "text-admin-text-secondary hover:bg-admin-hover-bg hover:text-admin-text-primary"
              }`}
            >
              食性資料 (Diet)
            </button>
            <button
              onClick={() => setActiveSubTab("roosting")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "roosting" ? "bg-admin-card-bg text-admin-text-primary border border-admin-card-border shadow-sm" : "text-admin-text-secondary hover:bg-admin-hover-bg hover:text-admin-text-primary"
              }`}
            >
              棲息植物 (Roosting)
            </button>
            <button
              onClick={() => setActiveSubTab("status")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "status" ? "bg-admin-card-bg text-admin-text-primary border border-admin-card-border shadow-sm" : "text-admin-text-secondary hover:bg-admin-hover-bg hover:text-admin-text-primary"
              }`}
            >
              分佈與保護現況
            </button>
            <button
              onClick={() => setActiveSubTab("gallery")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "gallery" ? "bg-admin-card-bg text-admin-text-primary border border-admin-card-border shadow-sm" : "text-admin-text-secondary hover:bg-admin-hover-bg hover:text-admin-text-primary"
              }`}
            >
              圖庫 (Gallery)
            </button>
            <button
              onClick={() => setActiveSubTab("reference")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "reference" ? "bg-admin-card-bg text-admin-text-primary border border-admin-card-border shadow-sm" : "text-admin-text-secondary hover:bg-admin-hover-bg hover:text-admin-text-primary"
              }`}
            >
              參考文獻 (Reference)
            </button>
          </div>

          {/* Tab 內容區：基本資料與物理量測 */}
          {activeSubTab === "basic" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-150">
              
              {/* 卡片 1：學名與記錄 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Settings2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> 物種學術命名與紀錄 (Taxonomy & First Record)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">科學學名 (Scientific Name)</label>
                      <input
                        type="text"
                        required
                        value={mainForm.scientific_name}
                        onChange={(e) => setMainForm({ ...mainForm, scientific_name: e.target.value })}
                        className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">學名發表者 (Author)</label>
                      <input
                        type="text"
                        placeholder="e.g. (Vahl, 1797)"
                        value={mainForm.scientific_name_author}
                        onChange={(e) => setMainForm({ ...mainForm, scientific_name_author: e.target.value })}
                        className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">首次記錄文獻 (First Record)</label>
                    <input
                      type="text"
                      value={mainForm.first_record}
                      onChange={(e) => setMainForm({ ...mainForm, first_record: e.target.value })}
                      className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* 卡片 2：同物異名與發表者 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-4 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Languages className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> 同物異名管理 (Synonyms & Authors)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <span className="text-[9px] text-admin-text-secondary font-bold uppercase">異名學名 (Synonym Scientific Name)</span>
                    <input
                      type="text"
                      placeholder="e.g. Cynopterus angulatus"
                      value={newSynonym}
                      onChange={(e) => setNewSynonym(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSynonym())}
                      className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <span className="text-[9px] text-admin-text-secondary font-bold uppercase">發表者 (Author)</span>
                    <input
                      type="text"
                      placeholder="e.g. Miller, 1898"
                      value={newSynonymAuthor}
                      onChange={(e) => setNewSynonymAuthor(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSynonym())}
                      className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={addSynonym} 
                    className="py-2.5 rounded-xl bg-admin-bg-panel hover:bg-admin-hover-bg border border-admin-card-border cursor-pointer flex justify-center items-center text-xs font-bold text-admin-text-secondary hover:text-admin-text-primary gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>加入列表</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {mainForm.synonyms.length === 0 ? (
                    <span className="text-xs text-admin-text-secondary italic">目前無任何同物異名紀錄</span>
                  ) : (
                    mainForm.synonyms.map((s, idx) => (
                      <span key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-admin-bg-panel border border-admin-card-border text-xs text-admin-text-secondary">
                        <span className="italic font-serif text-admin-text-primary font-medium">{s.name}</span>
                        {s.author && <span className="text-admin-text-secondary text-[10px]">{s.author}</span>}
                        <button 
                          type="button" 
                          onClick={() => removeSynonym(s.name)} 
                          className="text-admin-text-secondary hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer ml-1 p-0.5"
                          title="刪除"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* 卡片 3：俗名管理 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Languages className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> 中英文俗名與其他俗名 (Common Names)
                </h4>
                {renderBilingualField("物種俗名 (Common Name)", zhForm.common_name, enForm.common_name, "common_name", "common_name")}
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">其他俗名 (Other Common Names)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 中文 */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-admin-text-secondary font-semibold uppercase flex items-center gap-1">
                        <Languages className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> 其他中文俗名（用頓號或逗號分隔）
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. 俗名一、俗名二"
                        value={zhOtherNamesInput}
                        onChange={(e) => setZhOtherNamesInput(e.target.value)}
                        className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    {/* 英文 */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-admin-text-secondary font-semibold uppercase flex items-center gap-1">
                        <Languages className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Other English Common Names (separated by comma)
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. Name A, Name B"
                        value={enOtherNamesInput}
                        onChange={(e) => setEnOtherNamesInput(e.target.value)}
                        className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 卡片：分類學註記 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Languages className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> 分類學註記 (Taxonomic Notes)
                </h4>
                {renderBilingualField("分類學註記 (Taxonomic Notes)", zhForm.taxonomic_notes, enForm.taxonomic_notes, "taxonomic_notes", "taxonomic_notes", true)}
              </div>

              {/* 卡片 4：媒體資源與圖表 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Info className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> 物種資源與圖表網址 (Resource URLs)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">物種主圖網址 (Image URL)</label>
                    <input
                      type="text"
                      value={mainForm.image_url}
                      onChange={(e) => setMainForm({ ...mainForm, image_url: e.target.value })}
                      className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">叫聲錄音網址 (Audio URL)</label>
                    <input
                      type="text"
                      value={mainForm.audio_url}
                      onChange={(e) => setMainForm({ ...mainForm, audio_url: e.target.value })}
                      className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">解剖示意圖網址 (Anatomy Diagram URL)</label>
                    <input
                      type="text"
                      value={mainForm.anatomy_diagram_url}
                      onChange={(e) => setMainForm({ ...mainForm, anatomy_diagram_url: e.target.value })}
                      className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">測量示意圖網址 (Measurement Diagram URL)</label>
                    <input
                      type="text"
                      value={mainForm.measurement_diagram_url}
                      onChange={(e) => setMainForm({ ...mainForm, measurement_diagram_url: e.target.value })}
                      className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Tab 內容區：外形特徵雙語對照 */}
          {activeSubTab === "morphology" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-150">
              {/* 1. 基本屬性卡片面板 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-4 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Info className="w-3.5 h-3.5 text-emerald-400" /> 基本外形屬性 (Basic Morphology Info)
                </h4>
                {/* 體型類型雙語輸入 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] text-admin-text-secondary font-semibold uppercase flex items-center gap-1">
                      <Languages className="w-3 h-3 text-emerald-400" /> 體型類型 中文
                    </span>
                    <input
                      type="text"
                      value={zhForm.body_size_type}
                      onChange={(e) => setZhForm({ ...zhForm, body_size_type: e.target.value })}
                      placeholder="e.g. 中型"
                      className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] text-admin-text-secondary font-semibold uppercase flex items-center gap-1">
                      <Languages className="w-3 h-3 text-emerald-400" /> Body Size Type (EN)
                    </span>
                    <input
                      type="text"
                      value={enForm.body_size_type}
                      onChange={(e) => setEnForm({ ...enForm, body_size_type: e.target.value })}
                      placeholder="e.g. Medium-sized"
                      className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* 2. 互動式特徵插圖卡片面板 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col items-center gap-5 shadow-sm">
                <div className="w-full flex flex-col md:flex-row md:justify-between md:items-center gap-3 border-b border-admin-card-border pb-2.5">
                  <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-emerald-400" /> 互動式特徵插圖標記 (Interactive Anatomy Markers) {hotspotsForm.length > 0 ? `(${hotspotsForm.length})` : "(0)"}
                  </h4>
                  <span className="text-[10px] text-admin-text-secondary italic">
                    提示：點擊插圖任意空白處可新增 Marker；拖曳標記點可調整位置；點選以編輯中英文描述
                  </span>
                </div>

                {/* 大圖定位容器 (與前台一致) */}
                <div
                  onMouseMove={handleContainerMouseMove}
                  onMouseUp={handleContainerMouseUp}
                  onMouseLeave={handleContainerMouseUp}
                  onClick={handleContainerClick}
                  className="relative bg-white border border-slate-200 rounded-3xl overflow-hidden flex items-center justify-center p-0 cursor-crosshair group shadow-lg w-full md:max-w-[700px] select-none"
                >
                  <div className="relative w-fit h-fit flex items-center justify-center">
                    {/* 蝙蝠手繪插畫底圖 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getOptimizedImageUrl(bgImage)}
                      alt="Bat Anatomy Illustration"
                      className="max-w-full max-h-[350px] md:max-h-[550px] w-auto h-auto object-contain select-none pointer-events-none"
                    />

                    {/* CSS 動態脈衝呼吸燈樣式 */}
                    <style jsx global>{`
                      @keyframes pulse-ring-idle {
                        0% {
                          transform: scale(0.8);
                          opacity: 0.5;
                        }
                        100% {
                          transform: scale(1.6);
                          opacity: 0;
                        }
                      }
                      @keyframes pulse-ring-active {
                        0% {
                          transform: scale(0.8);
                          opacity: 0.8;
                        }
                        100% {
                          transform: scale(2.0);
                          opacity: 0;
                        }
                      }
                      .marker-pulse-idle {
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        border-radius: 50%;
                        border: 1px solid var(--color-primary-accent, #ea580c);
                        animation: pulse-ring-idle 2.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
                        pointer-events: none;
                      }
                      .marker-pulse-active {
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        border-radius: 50%;
                        border: 1.5px solid var(--color-primary-accent, #ea580c);
                        animation: pulse-ring-active 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
                        pointer-events: none;
                      }
                    `}</style>

                    {/* 繪製可拖曳 Hotspots */}
                    {hotspotsForm.map((hs) => {
                      const isActive = activeMarkerKey === hs.key;
                      return (
                        <div
                          key={hs.key}
                          style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group/marker"
                          onMouseDown={(e) => handleMarkerMouseDown(e, hs.key)}
                          onClick={(e) => {
                            e.stopPropagation(); // 阻斷冒泡以防止在圖片點擊引發新增
                            setActiveMarkerKey(hs.key);
                          }}
                        >
                          <button
                            type="button"
                            className={`relative w-3.5 h-3.5 md:w-4.5 md:h-4.5 rounded-full flex items-center justify-center font-bold shadow-md transition-all duration-300 cursor-grab active:cursor-grabbing ${
                              isActive
                                ? "bg-[#ea580c] text-white scale-110 ring-2 ring-[#ea580c]/20"
                                : "bg-white text-slate-800 hover:bg-[#ea580c] hover:text-white border border-slate-200"
                            }`}
                          >
                            {/* 呼吸燈特效：選中時使用 active 脈衝，平常使用輕微 idle 脈衝 */}
                            {isActive ? (
                              <span className="marker-pulse-active" />
                            ) : (
                              <span className="marker-pulse-idle" />
                            )}
                            <span className="relative z-10 text-[7px] md:text-[9px] font-black leading-none">+</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 選定標記編輯框 (中英文同時編輯) */}
                {activeMarker && (
                  <div className="w-full md:max-w-[700px] p-5 rounded-2xl bg-admin-bg-panel border border-admin-card-border flex flex-col gap-4 animate-in fade-in duration-150">
                    <div className="flex justify-between items-center border-b border-admin-card-border pb-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Settings2 className="w-3.5 h-3.5" /> 標記特徵與描述編輯 (Marker Detail)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setHotspotsForm(prev => prev.filter(hs => hs.key !== activeMarkerKey));
                          setActiveMarkerKey(null);
                        }}
                        className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 刪除此標記
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-admin-text-secondary font-bold uppercase">識別鍵值 (Key)</label>
                        <input
                          type="text"
                          value={activeMarker.key}
                          onChange={(e) => {
                            const val = e.target.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
                            if (val) {
                              setHotspotsForm(prev =>
                                prev.map(hs => (hs.key === activeMarkerKey ? { ...hs, key: val } : hs))
                              );
                              setActiveMarkerKey(val);
                            }
                          }}
                          placeholder="e.g. ear"
                          className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-admin-text-secondary font-bold uppercase">位置 X (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={activeMarker.x}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setHotspotsForm(prev =>
                              prev.map(hs => (hs.key === activeMarkerKey ? { ...hs, x: val } : hs))
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-admin-text-secondary font-bold uppercase">位置 Y (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={activeMarker.y}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setHotspotsForm(prev =>
                              prev.map(hs => (hs.key === activeMarkerKey ? { ...hs, y: val } : hs))
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 中文描述 */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] text-admin-text-secondary font-semibold uppercase flex items-center gap-1">
                          <Languages className="w-3 h-3 text-emerald-400" /> 中文特徵描述 (支援快速鍵 Ctrl+B/I/U)
                        </span>
                        <RichTextArea
                          rows={3}
                          value={activeMarker.zh}
                          onChange={(val) => {
                            setHotspotsForm(prev =>
                              prev.map(hs => (hs.key === activeMarkerKey ? { ...hs, zh: val } : hs))
                            );
                          }}
                          placeholder="請輸入中文特徵描述..."
                        />
                      </div>
                      {/* 英文描述 */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] text-admin-text-secondary font-semibold uppercase flex items-center gap-1">
                          <Languages className="w-3 h-3 text-emerald-400" /> English Description (Ctrl+B/I/U supported)
                        </span>
                        <RichTextArea
                          rows={3}
                          value={activeMarker.en}
                          onChange={(val) => {
                            setHotspotsForm(prev =>
                              prev.map(hs => (hs.key === activeMarkerKey ? { ...hs, en: val } : hs))
                            );
                          }}
                          placeholder="Enter English morphological description..."
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. 身體及翼的測量數據卡片面板 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-6 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" /> 身體及翼的測量數據 (Morphometrics)
                </h4>
                
                <div className="flex flex-col gap-6">
                  {/* 物理量測子分區 */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-bold text-admin-text-secondary uppercase tracking-wider">
                      物理量測數據 (Physical Measurements)
                    </span>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">頭體長範圍</label>
                        <input
                          type="text"
                          placeholder="e.g. 50.0 - 75.0 mm"
                          value={mainForm.head_body_range}
                          onChange={(e) => setMainForm({ ...mainForm, head_body_range: e.target.value })}
                          className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">尾長範圍</label>
                        <input
                          type="text"
                          placeholder="e.g. 30.0 - 45.0 mm"
                          value={mainForm.tail_range}
                          onChange={(e) => setMainForm({ ...mainForm, tail_range: e.target.value })}
                          className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">耳長範圍</label>
                        <input
                          type="text"
                          placeholder="e.g. 12.0 - 18.0 mm"
                          value={mainForm.ear_range}
                          onChange={(e) => setMainForm({ ...mainForm, ear_range: e.target.value })}
                          className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">後足長範圍</label>
                        <input
                          type="text"
                          placeholder="e.g. 7.0 - 11.0 mm"
                          value={mainForm.hind_foot_range}
                          onChange={(e) => setMainForm({ ...mainForm, hind_foot_range: e.target.value })}
                          className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">前臂長範圍</label>
                        <input
                          type="text"
                          placeholder="e.g. 40.0 - 48.0 mm"
                          value={mainForm.forearm_range}
                          onChange={(e) => setMainForm({ ...mainForm, forearm_range: e.target.value })}
                          className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">體重範圍</label>
                        <input
                          type="text"
                          placeholder="e.g. 10.0 - 15.0 g"
                          value={mainForm.weight_range}
                          onChange={(e) => setMainForm({ ...mainForm, weight_range: e.target.value })}
                          className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 翼形參數子分區 */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-bold text-admin-text-secondary uppercase tracking-wider">
                      翼形飛行參數 (Wing Parameters)
                    </span>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">翼長 (Wing Length)</label>
                        <input
                          type="text"
                          value={mainForm.wing_length}
                          onChange={(e) => setMainForm({ ...mainForm, wing_length: e.target.value })}
                          className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">翼面積 (Wing Area)</label>
                        <input
                          type="text"
                          value={mainForm.wing_area}
                          onChange={(e) => setMainForm({ ...mainForm, wing_area: e.target.value })}
                          className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">翼載荷 (Wing Loading)</label>
                        <input
                          type="text"
                          value={mainForm.wing_loading}
                          onChange={(e) => setMainForm({ ...mainForm, wing_loading: e.target.value })}
                          className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">長寬比 (Aspect Ratio)</label>
                        <input
                          type="text"
                          value={mainForm.aspect_ratio}
                          onChange={(e) => setMainForm({ ...mainForm, aspect_ratio: e.target.value })}
                          className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">翼尖指數 (Tip Index)</label>
                        <input
                          type="text"
                          value={mainForm.wing_tip_index}
                          onChange={(e) => setMainForm({ ...mainForm, wing_tip_index: e.target.value })}
                          className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">翼參數文獻 (Wing Ref)</label>
                        <input
                          type="text"
                          value={mainForm.wing_reference}
                          onChange={(e) => setMainForm({ ...mainForm, wing_reference: e.target.value })}
                          className="px-4 py-2.5 rounded-xl bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. 外形特徵詳細描述卡片面板 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-6 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Info className="w-3.5 h-3.5 text-emerald-400" /> 外形特徵詳細描述 (Bilingual Morphological Features)
                </h4>
                
                <div className="flex flex-col gap-5">
                  {renderBilingualField("毛皮特徵 (Fur Features)", zhForm.feature_fur, enForm.feature_fur, "feature_fur", "feature_fur", true)}
                  {renderBilingualField("耳朵特徵 (Ear Features)", zhForm.feature_ears, enForm.feature_ears, "feature_ears", "feature_ears", true)}
                  {renderBilingualField("頭部特徵 (Head Features)", zhForm.feature_head, enForm.feature_head, "feature_head", "feature_head", true)}
                  {renderBilingualField("四肢與翼膜特徵 (Limb/Wing Features)", zhForm.feature_limbs, enForm.feature_limbs, "feature_limbs", "feature_limbs", true)}
                  {renderBilingualField("尾部與股間膜特徵 (Tail Features)", zhForm.feature_tail, enForm.feature_tail, "feature_tail", "feature_tail", true)}
                  {renderBilingualField("其他物理特徵 (Other Features)", zhForm.feature_other, enForm.feature_other, "feature_other", "feature_other", true)}
                </div>
              </div>
            </div>
          )}

          {/* Tab 內容區：生態資料雙語對照 */}
          {activeSubTab === "ecology" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-150">
              
              {/* 卡片 1：生態棲息與生命特徵 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-6 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Languages className="w-3.5 h-3.5 text-emerald-400" /> 生態棲所與生命史 (Ecology & Life History)
                </h4>
                <div className="flex flex-col gap-5">
                  {renderBilingualField("棲所與棲息習性 (Habitat)", zhForm.ecology_habitat, enForm.ecology_habitat, "ecology_habitat", "ecology_habitat", true)}
                  {renderBilingualField("活動與行為習性 (Habits)", zhForm.ecology_habits, enForm.ecology_habits, "ecology_habits", "ecology_habits", true)}
                  {renderBilingualField("活動範圍與家域 (Home Range)", zhForm.ecology_home_range, enForm.ecology_home_range, "ecology_home_range", "ecology_home_range", true)}
                  {renderBilingualField("遷徙習性 (Migration)", zhForm.ecology_migration, enForm.ecology_migration, "ecology_migration", "ecology_migration", true)}
                  {renderBilingualField("壽命 (Lifespan)", zhForm.ecology_lifespan, enForm.ecology_lifespan, "ecology_lifespan", "ecology_lifespan", true)}
                </div>
              </div>

              {/* 卡片 2：食性與活動特徵 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-6 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" /> 食性、飛行與回聲定位 (Diet, Flight & Echolocation)
                </h4>
                <div className="flex flex-col gap-5">
                  {renderBilingualField("食性 (Diet Composition)", zhForm.ecology_diet, enForm.ecology_diet, "ecology_diet", "ecology_diet", true)}
                  {renderBilingualField("捕食與覓食行為 (Foraging)", zhForm.ecology_foraging, enForm.ecology_foraging, "ecology_foraging", "ecology_foraging", true)}
                  {renderBilingualField("繁殖習性 (Reproduction)", zhForm.ecology_reproduction, enForm.ecology_reproduction, "ecology_reproduction", "ecology_reproduction", true)}
                  {renderBilingualField("冬眠習性 (Hibernation)", zhForm.ecology_hibernation, enForm.ecology_hibernation, "ecology_hibernation", "ecology_hibernation", true)}
                  {renderBilingualField("飛行特徵 (Flight Features)", zhForm.ecology_flight, enForm.ecology_flight, "ecology_flight", "ecology_flight", true)}
                  {renderBilingualField("回聲定位描述 (Vocalizations)", zhForm.ecology_vocalizations, enForm.ecology_vocalizations, "ecology_vocalizations", "ecology_vocalizations", true)}
                </div>
              </div>

            </div>
          )}

          {/* Tab 內容區：分布與保護狀態 */}
          {activeSubTab === "status" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-150">
              
              {/* 卡片 1：起源與分佈範圍 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" /> 起源與本地分佈 (Origin & Local Distribution)
                </h4>
                <div className="flex flex-col gap-5">
                  {renderBilingualField("起源類型 (Origin Type)", zhForm.origin_type, enForm.origin_type, "origin_type", "origin_type")}
                  {renderBilingualField("本地分佈地區 (Local Distribution)", zhForm.local_distribution, enForm.local_distribution, "local_distribution", "local_distribution", true)}
                </div>
              </div>

              {/* 卡片 2：保護級別與威脅因子 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" /> 保護狀態與威脅因子 (Conservation Status & Threats)
                </h4>
                <div className="flex flex-col gap-5">
                  {renderBilingualField("本地保護等級 (Local Status)", zhForm.local_status, enForm.local_status, "local_status", "local_status")}
                  {renderBilingualField("中國保護等級 (China Status)", zhForm.china_status, enForm.china_status, "china_status", "china_status")}
                  {renderBilingualField("全球保護等級 (Global Status)", zhForm.global_status, enForm.global_status, "global_status", "global_status")}
                  {renderBilingualField("潛在受威脅威脅因子 (Threats)", zhForm.potential_threats, enForm.potential_threats, "potential_threats", "potential_threats", true)}
                </div>
              </div>

            </div>
          )}

          {/* Tab 內容區：食性資料研究管理 */}
          {/* Tab 內容區：食性資料研究管理 */}
          {activeSubTab === "diet" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-150">
              {/* 控制列：新增研究 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex justify-between items-center shadow-sm">
                <div>
                  <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> 食性研究資料管理 (Diet Studies)
                  </h4>
                  <p className="text-[10px] text-admin-text-secondary mt-1">
                    在此管理該物種的食性百分比研究資料。可新增多個研究文獻，並同時編輯中英文標題與雙語食物項目。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newKey = `study_${Date.now()}`;
                    setDietForm(prev => [
                      ...prev,
                      {
                        _key: newKey,
                        title_zh: "新食性研究",
                        title_en: "New Diet Study",
                        source: "",
                        source_url: "",
                        items: []
                      }
                    ]);
                    setDietNewItems(prev => ({
                      ...prev,
                      [newKey]: { name_zh: "", name_en: "", pct: "" }
                    }));
                  }}
                  className="px-4 py-2.5 rounded-xl bg-admin-bg-panel hover:bg-admin-hover-bg border border-admin-card-border text-xs font-bold text-admin-text-primary flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>新增研究卡片</span>
                </button>
              </div>

              {dietForm.length === 0 ? (
                <div className="py-12 border border-dashed border-admin-card-border rounded-3xl text-center text-admin-text-secondary text-xs bg-admin-card-bg">
                  目前暫無任何食性研究資料，請點選上方按鈕新增。
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {dietForm.map((study) => {
                    const studyKey = study._key;
                    const newItem = dietNewItems[studyKey] || { name_zh: "", name_en: "", pct: "" };
                    const totalPct = study.items.reduce((sum, item) => sum + item.percentage, 0);

                    return (
                      <div key={studyKey} className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm relative">
                        {/* 頂部研究資訊編輯與刪除 */}
                        <div className="flex flex-col gap-4 border-b border-admin-card-border pb-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">研究基本資料</span>
                            <button
                              type="button"
                              onClick={() => {
                                setDietForm(prev => prev.filter(d => d._key !== studyKey));
                                setDietNewItems(prev => {
                                  const next = { ...prev };
                                  delete next[studyKey];
                                  return next;
                                });
                              }}
                              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-500 transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> 刪除研究
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-admin-text-secondary font-bold uppercase">研究標題 (中文)</label>
                              <input
                                type="text"
                                placeholder="中文標題 (e.g. 大蹄蝠食性糞便分析)"
                                value={study.title_zh || ""}
                                onChange={(e) => {
                                  setDietForm(prev => prev.map(d => d._key === studyKey ? { ...d, title_zh: e.target.value } : d));
                                }}
                                className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-admin-text-secondary font-bold uppercase">研究標題 (英文)</label>
                              <input
                                type="text"
                                placeholder="英文標題 (e.g. Diet Composition Analysis of Hipposideros armiger)"
                                value={study.title_en || ""}
                                onChange={(e) => {
                                  setDietForm(prev => prev.map(d => d._key === studyKey ? { ...d, title_en: e.target.value } : d));
                                }}
                                className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* 左側：來源資訊與 Items 增刪 */}
                          <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-admin-text-secondary font-bold uppercase">來源文獻標記 (e.g. 潘等, 2021)</label>
                                <input
                                  type="text"
                                  placeholder="文獻簡稱"
                                  value={study.source}
                                  onChange={(e) => {
                                    setDietForm(prev => prev.map(d => d._key === studyKey ? { ...d, source: e.target.value } : d));
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-admin-text-secondary font-bold uppercase">來源 URL (Source URL)</label>
                                <input
                                  type="text"
                                  placeholder="https://..."
                                  value={study.source_url}
                                  onChange={(e) => {
                                    setDietForm(prev => prev.map(d => d._key === studyKey ? { ...d, source_url: e.target.value } : d));
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* 新增食物 item 表單 */}
                            <div className="p-4 rounded-2xl bg-admin-bg-panel border border-admin-card-border flex flex-col gap-3">
                              <span className="text-[9px] text-admin-text-secondary font-bold uppercase">新增食物組成項目</span>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-admin-text-secondary font-bold">中文名稱</span>
                                  <input
                                    type="text"
                                    placeholder="e.g. 鞘翅目"
                                    value={newItem.name_zh || ""}
                                    onChange={(e) => setDietNewItems(prev => ({
                                      ...prev,
                                      [studyKey]: { ...newItem, name_zh: e.target.value }
                                    }))}
                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDietItem(studyKey))}
                                    className="w-full px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-admin-text-secondary font-bold">英文名稱</span>
                                  <input
                                    type="text"
                                    placeholder="e.g. Coleoptera"
                                    value={newItem.name_en || ""}
                                    onChange={(e) => setDietNewItems(prev => ({
                                      ...prev,
                                      [studyKey]: { ...newItem, name_en: e.target.value }
                                    }))}
                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDietItem(studyKey))}
                                    className="w-full px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-admin-text-secondary font-bold">百分比 (%)</span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    placeholder="e.g. 45.2"
                                    value={newItem.pct || ""}
                                    onChange={(e) => setDietNewItems(prev => ({
                                      ...prev,
                                      [studyKey]: { ...newItem, pct: e.target.value }
                                    }))}
                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDietItem(studyKey))}
                                    className="w-full px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-admin-text-secondary font-bold opacity-0 select-none">新增</span>
                                  <button
                                    type="button"
                                    onClick={() => addDietItem(studyKey)}
                                    className="w-full px-3 py-1.5 rounded-lg bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs font-bold transition-all cursor-pointer flex justify-center items-center gap-0.5"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>{editingDietIndex[studyKey] !== null && editingDietIndex[studyKey] !== undefined ? "更新" : "新增"}</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* 已新增項目列表 */}
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[9px] text-admin-text-secondary font-bold uppercase">已配置項目 (Items)</span>
                              <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto pr-1">
                                {study.items.length === 0 ? (
                                  <span className="text-xs text-admin-text-secondary italic py-1">無任何食物組成項目，請由上方新增</span>
                                ) : (
                                  study.items.map((item, idx) => {
                                    const displayName = item.name_zh && item.name_en 
                                      ? `${item.name_zh} (${item.name_en})`
                                      : (item.name_zh || item.name_en || "未命名");
                                    const isEditing = editingDietIndex[studyKey] === idx;
                                    return (
                                      <div 
                                        key={idx} 
                                        onClick={() => editDietItem(studyKey, idx, item)}
                                        className={`flex justify-between items-center px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors duration-200 ${
                                          isEditing 
                                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-medium" 
                                            : "bg-admin-bg-panel border-admin-card-border text-admin-text-primary hover:bg-admin-hover-bg"
                                        }`}
                                        title="點擊編輯此項目"
                                      >
                                        <span className="font-semibold">{displayName}</span>
                                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{item.percentage}%</span>
                                          <button
                                            type="button"
                                            onClick={() => removeDietItem(studyKey, idx)}
                                            className="text-admin-text-secondary hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer p-0.5"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 右側：即時預覽條狀圖 */}
                          <div className="flex flex-col gap-4 p-5 rounded-2xl bg-admin-bg-panel/40 border border-admin-card-border/60">
                            <div className="flex justify-between items-center border-b border-admin-card-border pb-2">
                              <span className="text-[10px] text-admin-text-primary font-bold uppercase">即時食性佔比預覽</span>
                              <span className={`text-[10px] font-bold font-mono ${Math.abs(totalPct - 100) < 0.1 ? "text-emerald-500 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"}`}>
                                總佔比: {totalPct.toFixed(1)}% (建議為 100%)
                              </span>
                            </div>

                            {study.items.length === 0 ? (
                              <div className="flex-1 flex items-center justify-center text-xs text-admin-text-secondary italic min-h-[150px]">
                                新增食物項目以預覽圖表
                              </div>
                            ) : (
                              <div className="flex flex-col gap-3 py-2">
                                {study.items.map((item, idx) => {
                                  const displayName = item.name_zh && item.name_en 
                                    ? `${item.name_zh} (${item.name_en})`
                                    : (item.name_zh || item.name_en || "未命名");
                                  return (
                                    <div key={idx} className="flex flex-col gap-1">
                                      <div className="flex justify-between text-[10px] text-admin-text-secondary">
                                        <span>{displayName}</span>
                                        <span className="font-mono font-semibold">{item.percentage}%</span>
                                      </div>
                                      <div className="w-full h-2 rounded-full bg-admin-input-bg overflow-hidden border border-admin-card-border/40">
                                        <div
                                          style={{ width: `${Math.min(100, item.percentage)}%` }}
                                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 非百分比食性列表 (Diet Food Lists) 分隔線與大標題 */}
              <div className="mt-8 pt-8 border-t border-admin-card-border/80 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> 非百分比食性研究資料管理 (Diet Food Lists)
                  </h4>
                  <p className="text-[10px] text-admin-text-secondary mt-1">
                    在此管理物種的非百分比食性研究資料（如植物清單、食物類別等，適用於短吻果蝠等）。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newKey = `food_list_${Date.now()}`;
                    setDietFoodListForm(prev => [
                      ...prev,
                      {
                        _key: newKey,
                        title_zh: "新非百分比食性研究",
                        title_en: "New Non-percentage Diet Study",
                        source: "",
                        source_url: "",
                        items: []
                      }
                    ]);
                    setDietFoodListNewItems(prev => ({
                      ...prev,
                      [newKey]: { plant_zh: "", plant_en: "", food_zh: "", food_en: "" }
                    }));
                  }}
                  className="px-4 py-2.5 rounded-xl bg-admin-bg-panel hover:bg-admin-hover-bg border border-admin-card-border text-xs font-bold text-admin-text-primary flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>新增非百分比研究卡片</span>
                </button>
              </div>

              {dietFoodListForm.length === 0 ? (
                <div className="py-12 border border-dashed border-admin-card-border rounded-3xl text-center text-admin-text-secondary text-xs bg-admin-card-bg">
                  目前暫無任何非百分比食性研究資料，請點選上方按鈕新增。
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {dietFoodListForm.map((study) => {
                    const studyKey = study._key;
                    const newItem = dietFoodListNewItems[studyKey] || { plant_zh: "", plant_en: "", food_zh: "", food_en: "" };

                    return (
                      <div key={studyKey} className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm relative">
                        {/* 頂部研究資訊編輯與刪除 */}
                        <div className="flex flex-col gap-4 border-b border-admin-card-border pb-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">非百分比研究基本資料</span>
                            <button
                              type="button"
                              onClick={() => {
                                setDietFoodListForm(prev => prev.filter(d => d._key !== studyKey));
                                setDietFoodListNewItems(prev => {
                                  const next = { ...prev };
                                  delete next[studyKey];
                                  return next;
                                });
                              }}
                              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-500 transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> 刪除研究
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-admin-text-secondary font-bold uppercase">研究標題 (中文)</label>
                              <input
                                type="text"
                                placeholder="中文標題 (e.g. 短吻果蝠香港食性研究)"
                                value={study.title_zh || ""}
                                onChange={(e) => {
                                  setDietFoodListForm(prev => prev.map(d => d._key === studyKey ? { ...d, title_zh: e.target.value } : d));
                                }}
                                className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-admin-text-secondary font-bold uppercase">研究標題 (英文)</label>
                              <input
                                type="text"
                                placeholder="英文標題 (e.g. Diet Study of Cynopterus sphinx in Hong Kong)"
                                value={study.title_en || ""}
                                onChange={(e) => {
                                  setDietFoodListForm(prev => prev.map(d => d._key === studyKey ? { ...d, title_en: e.target.value } : d));
                                }}
                                className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* 左側：來源資訊與 Items 增刪 */}
                          <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-admin-text-secondary font-bold uppercase">來源文獻標記</label>
                                <input
                                  type="text"
                                  placeholder="文獻簡稱 (e.g. Tang et al., 2005)"
                                  value={study.source || ""}
                                  onChange={(e) => {
                                    setDietFoodListForm(prev => prev.map(d => d._key === studyKey ? { ...d, source: e.target.value } : d));
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-admin-text-secondary font-bold uppercase">來源 URL (Source URL)</label>
                                <input
                                  type="text"
                                  placeholder="https://..."
                                  value={study.source_url || ""}
                                  onChange={(e) => {
                                    setDietFoodListForm(prev => prev.map(d => d._key === studyKey ? { ...d, source_url: e.target.value } : d));
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* 新增食物/植物 item 表單 */}
                            <div className="p-4 rounded-2xl bg-admin-bg-panel border border-admin-card-border flex flex-col gap-3">
                              <span className="text-[9px] text-admin-text-secondary font-bold uppercase">新增非百分比食物項目</span>
                              <div className="grid grid-cols-2 gap-2.5">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-admin-text-secondary font-bold">植物中文名稱</span>
                                  <input
                                    type="text"
                                    placeholder="e.g. 蒲桃"
                                    value={newItem.plant_zh || ""}
                                    onChange={(e) => setDietFoodListNewItems(prev => ({
                                      ...prev,
                                      [studyKey]: { ...newItem, plant_zh: e.target.value }
                                    }))}
                                    className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-admin-text-secondary font-bold">植物學名</span>
                                  <input
                                    type="text"
                                    placeholder="e.g. Syzygium jambos"
                                    value={newItem.plant_en || ""}
                                    onChange={(e) => setDietFoodListNewItems(prev => ({
                                      ...prev,
                                      [studyKey]: { ...newItem, plant_en: e.target.value }
                                    }))}
                                    className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-admin-text-secondary font-bold">食物類別 (中文)</span>
                                  <input
                                    type="text"
                                    placeholder="e.g. 果實"
                                    value={newItem.food_zh || ""}
                                    onChange={(e) => setDietFoodListNewItems(prev => ({
                                      ...prev,
                                      [studyKey]: { ...newItem, food_zh: e.target.value }
                                    }))}
                                    className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-admin-text-secondary font-bold">食物類別 (英文)</span>
                                  <input
                                    type="text"
                                    placeholder="e.g. Fruit"
                                    value={newItem.food_en || ""}
                                    onChange={(e) => setDietFoodListNewItems(prev => ({
                                      ...prev,
                                      [studyKey]: { ...newItem, food_en: e.target.value }
                                    }))}
                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDietFoodListItem(studyKey))}
                                    className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => addDietFoodListItem(studyKey)}
                                className="w-full py-2 rounded-xl bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs font-bold transition-all cursor-pointer flex justify-center items-center gap-1 mt-1"
                              >
                                <Plus className="w-4 h-4" />
                                <span>{editingDietFoodListIndex[studyKey] !== null && editingDietFoodListIndex[studyKey] !== undefined ? "儲存更新食物項目" : "新增食物項目"}</span>
                              </button>
                            </div>

                            {/* 已新增項目列表 */}
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[9px] text-admin-text-secondary font-bold uppercase">已配置項目 (Items)</span>
                              <div className="flex flex-col gap-1 h-[480px] overflow-y-auto pr-1">
                                {study.items.length === 0 ? (
                                  <span className="text-xs text-admin-text-secondary italic py-1">無任何食物組成項目，請由上方新增</span>
                                ) : (
                                  study.items.map((item, idx) => {
                                    const isEditing = editingDietFoodListIndex[studyKey] === idx;
                                    return (
                                      <div 
                                        key={idx} 
                                        onClick={() => editDietFoodListItem(studyKey, idx, item)}
                                        className={`flex justify-between items-center px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors duration-200 ${
                                          isEditing 
                                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-medium" 
                                            : "bg-admin-bg-panel border-admin-card-border text-admin-text-primary hover:bg-admin-hover-bg"
                                        }`}
                                        title="點擊編輯此項目"
                                      >
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-semibold">
                                            {item.plant_zh || "未命名"} {item.plant_en && <span className="italic text-admin-text-secondary text-[11px]">({item.plant_en})</span>}
                                          </span>
                                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                            類別: {item.food_zh || "未命名"} / {item.food_en || "未命名"}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); removeDietFoodListItem(studyKey, idx); }}
                                          className="text-admin-text-secondary hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer p-0.5"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 右側：前台卡片樣式即時模擬預覽 */}
                          <div className="flex flex-col gap-4 p-5 rounded-2xl bg-admin-bg-panel/40 border border-admin-card-border/60">
                            <div className="flex justify-between items-center border-b border-admin-card-border pb-2">
                              <span className="text-[10px] text-admin-text-primary font-bold uppercase">前台卡片樣式即時模擬預覽</span>
                            </div>

                            <div className="rounded-2xl border border-admin-card-border bg-[#0B0F19]/40 p-4">
                              <h5 className="text-xs font-bold text-slate-200">{study.title_zh || "無標題"} / <span className="text-[11px] text-slate-400 font-normal">{study.title_en || "No Title"}</span></h5>
                              {study.source && (
                                <p className="text-[10px] text-emerald-400/80 mt-1 flex items-center gap-1">
                                  <span>來源: {study.source}</span>
                                </p>
                              )}
                              
                              <div className="mt-3 overflow-x-auto border border-admin-card-border rounded-xl bg-slate-950/60">
                                <table className="w-full text-[11px] text-slate-300 border-collapse text-left">
                                  <thead>
                                    <tr className="border-b border-admin-card-border bg-slate-900/40 text-slate-400">
                                      <th className="px-3 py-1.5 font-bold">食物名稱 Food Item</th>
                                      <th className="px-3 py-1.5 font-bold">食物類別 Category</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {study.items.length === 0 ? (
                                      <tr>
                                        <td colSpan={2} className="px-3 py-4 text-center text-slate-500 italic">
                                          無食物項目資料
                                        </td>
                                      </tr>
                                    ) : (
                                      study.items.map((item, idx) => (
                                        <tr key={idx} className="border-b border-admin-card-border/30 last:border-b-0 hover:bg-slate-900/20">
                                          <td className="px-3 py-1.5">
                                            {item.plant_zh} {item.plant_en && <span className="text-slate-400 ml-1">({item.plant_en})</span>}
                                          </td>
                                          <td className="px-3 py-1.5 text-slate-400">
                                            {item.food_zh} {item.food_en && <span className="text-slate-500 text-[10px]">({item.food_en})</span>}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 內容區：棲息植物管理 */}
          {activeSubTab === "roosting" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-150">
              {/* 控制列：新增研究 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex justify-between items-center shadow-sm">
                <div>
                  <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> 棲息植物管理 (Roosting Plants)
                  </h4>
                  <p className="text-[10px] text-admin-text-secondary mt-1">
                    在此管理該物種的可棲息植物與棲息位置。可新增多個研究文獻，並自訂植物學名與棲息位置。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newKey = `roost_${Date.now()}`;
                    setRoostingForm(prev => [
                      ...prev,
                      {
                        _key: newKey,
                        title_zh: "新棲息植物研究",
                        title_en: "New Roosting Study",
                        source: "",
                        source_url: "",
                        items: []
                      }
                    ]);
                    setRoostingNewItems(prev => ({
                      ...prev,
                      [newKey]: { plant_zh: "", plant_en: "", location_zh: "", location_en: "" }
                    }));
                  }}
                  className="px-4 py-2.5 rounded-xl bg-admin-bg-panel hover:bg-admin-hover-bg border border-admin-card-border text-xs font-bold text-admin-text-primary flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>新增研究卡片</span>
                </button>
              </div>

              {roostingForm.length === 0 ? (
                <div className="py-12 border border-dashed border-admin-card-border rounded-3xl text-center text-admin-text-secondary text-xs bg-admin-card-bg">
                  目前暫無任何棲息植物資料，請點選上方按鈕新增。
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {roostingForm.map((study) => {
                    const studyKey = study._key;
                    const newItem = roostingNewItems[studyKey] || { plant_zh: "", plant_en: "", location_zh: "", location_en: "" };

                    return (
                      <div key={studyKey} className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm relative">
                        {/* 頂部研究資訊編輯與刪除 */}
                        <div className="flex flex-col gap-4 border-b border-admin-card-border pb-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">研究基本資料</span>
                            <button
                              type="button"
                              onClick={() => {
                                setRoostingForm(prev => prev.filter(r => r._key !== studyKey));
                                setRoostingNewItems(prev => {
                                  const next = { ...prev };
                                  delete next[studyKey];
                                  return next;
                                });
                              }}
                              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-500 transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> 刪除研究
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-admin-text-secondary font-bold uppercase">研究標題 (中文)</label>
                              <input
                                type="text"
                                placeholder="中文標題 (e.g. 短吻果蝠棲息植物調查)"
                                value={study.title_zh || ""}
                                onChange={(e) => {
                                  setRoostingForm(prev => prev.map(r => r._key === studyKey ? { ...r, title_zh: e.target.value } : r));
                                }}
                                className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-admin-text-secondary font-bold uppercase">研究標題 (英文)</label>
                              <input
                                type="text"
                                placeholder="英文標題 (e.g. Roosting Plants of Cynopterus sphinx)"
                                value={study.title_en || ""}
                                onChange={(e) => {
                                  setRoostingForm(prev => prev.map(r => r._key === studyKey ? { ...r, title_en: e.target.value } : r));
                                }}
                                className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* 左側：來源與植物項目表單 */}
                          <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-admin-text-secondary font-bold uppercase">來源文獻標記</label>
                                <input
                                  type="text"
                                  placeholder="文獻簡稱"
                                  value={study.source || ""}
                                  onChange={(e) => {
                                    setRoostingForm(prev => prev.map(r => r._key === studyKey ? { ...r, source: e.target.value } : r));
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-admin-text-secondary font-bold uppercase">來源 URL (Source URL)</label>
                                <input
                                  type="text"
                                  placeholder="https://..."
                                  value={study.source_url || ""}
                                  onChange={(e) => {
                                    setRoostingForm(prev => prev.map(r => r._key === studyKey ? { ...r, source_url: e.target.value } : r));
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* 新增植物項目表單 */}
                            <div className="p-4 rounded-2xl bg-admin-bg-panel border border-admin-card-border flex flex-col gap-3">
                              <span className="text-[9px] text-admin-text-secondary font-bold uppercase">新增可棲息植物</span>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-admin-text-secondary font-bold">植物中文名稱</span>
                                  <input
                                    type="text"
                                    placeholder="e.g. 糖棕"
                                    value={newItem.plant_zh || ""}
                                    onChange={(e) => setRoostingNewItems(prev => ({
                                      ...prev,
                                      [studyKey]: { ...newItem, plant_zh: e.target.value }
                                    }))}
                                    className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-admin-text-secondary font-bold">植物學名 / 英文</span>
                                  <input
                                    type="text"
                                    placeholder="e.g. Borassus flabellifer"
                                    value={newItem.plant_en || ""}
                                    onChange={(e) => setRoostingNewItems(prev => ({
                                      ...prev,
                                      [studyKey]: { ...newItem, plant_en: e.target.value }
                                    }))}
                                    className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-admin-text-secondary font-bold">棲息位置 (中文)</span>
                                  <input
                                    type="text"
                                    placeholder="e.g. 葉下"
                                    value={newItem.location_zh || ""}
                                    onChange={(e) => setRoostingNewItems(prev => ({
                                      ...prev,
                                      [studyKey]: { ...newItem, location_zh: e.target.value }
                                    }))}
                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRoostingItem(studyKey))}
                                    className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-admin-text-secondary font-bold">棲息位置 (英文)</span>
                                  <input
                                    type="text"
                                    placeholder="e.g. Under frond"
                                    value={newItem.location_en || ""}
                                    onChange={(e) => setRoostingNewItems(prev => ({
                                      ...prev,
                                      [studyKey]: { ...newItem, location_en: e.target.value }
                                    }))}
                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRoostingItem(studyKey))}
                                    className="px-3 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none"
                                  />
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => addRoostingItem(studyKey)}
                                className="w-full py-1.5 rounded-lg bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs font-bold transition-all cursor-pointer flex justify-center items-center gap-0.5"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{editingRoostingIndex[studyKey] !== null && editingRoostingIndex[studyKey] !== undefined ? "儲存更新項目" : "新增項目"}</span>
                              </button>
                            </div>

                            {/* 已配置項目列表 */}
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[9px] text-admin-text-secondary font-bold uppercase">已配置項目 (Items)</span>
                              <div className="flex flex-col gap-1 max-h-[250px] overflow-y-auto pr-1">
                                {study.items.length === 0 ? (
                                  <span className="text-xs text-admin-text-secondary italic py-1">無任何植物項目，請由上方新增</span>
                                ) : (
                                  study.items.map((item, idx) => {
                                    const displayPlant = item.plant_zh && item.plant_en 
                                      ? `${item.plant_zh} (${item.plant_en})`
                                      : (item.plant_zh || item.plant_en || "未命名植物");
                                    const displayLoc = item.location_zh && item.location_en
                                      ? `${item.location_zh} (${item.location_en})`
                                      : (item.location_zh || item.location_en || "位置未知");
                                    const isEditing = editingRoostingIndex[studyKey] === idx;
                                    return (
                                      <div 
                                        key={idx} 
                                        onClick={() => editRoostingItem(studyKey, idx, item)}
                                        className={`flex justify-between items-center px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors duration-200 ${
                                          isEditing 
                                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-medium" 
                                            : "bg-admin-bg-panel border-admin-card-border text-admin-text-primary hover:bg-admin-hover-bg"
                                        }`}
                                        title="點擊編輯此項目"
                                      >
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-semibold">{displayPlant}</span>
                                          <span className={`text-[9px] ${isEditing ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-admin-text-secondary"}`}>位置: {displayLoc}</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); removeRoostingItem(studyKey, idx); }}
                                          className="text-admin-text-secondary hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer p-0.5"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 右側：前台即時模擬預覽 */}
                          <div className="flex flex-col gap-4 p-5 rounded-2xl bg-admin-bg-panel/40 border border-admin-card-border/60">
                            <span className="text-[10px] text-admin-text-primary font-bold uppercase border-b border-admin-card-border pb-2">
                              前台即時卡片樣式模擬
                            </span>
                            
                            <div className="border border-admin-card-border rounded-xl bg-admin-bg-panel p-4 flex flex-col gap-3">
                              <h5 className="text-xs font-bold text-admin-text-primary border-b border-admin-card-border/50 pb-1.5">
                                {study.title_zh || "未命名研究"}
                              </h5>
                              
                              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                                {study.items.length === 0 ? (
                                  <span className="text-[10px] text-admin-text-secondary italic">請在左側新增項目以預覽</span>
                                ) : (
                                  study.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[10px] py-1 border-b border-admin-card-border/20 last:border-0">
                                      <span className="text-admin-text-primary font-medium">
                                        {item.plant_zh && <span className="mr-1">{item.plant_zh}</span>}
                                        {item.plant_en && <em className="italic">{item.plant_en}</em>}
                                      </span>
                                      <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px] font-semibold">
                                        {item.location_zh || "未知"}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 內容區：參考文獻獨立編輯 */}
          {activeSubTab === "reference" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-150">
              
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Info className="w-3.5 h-3.5 text-emerald-400" /> 參考文獻管理 (References & Citations)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 中文文獻 */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-bold text-admin-text-secondary uppercase tracking-wider flex items-center gap-1">
                      中文版文獻
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="輸入中文文獻引用..."
                        value={newReference}
                        onChange={(e) => setNewReference(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addReference("zh"))}
                        className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-admin-input-bg border border-admin-card-border text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                      />
                      <button type="button" onClick={() => addReference("zh")} className="px-4 rounded-xl bg-admin-bg-panel border border-admin-card-border hover:bg-admin-hover-bg cursor-pointer text-admin-text-primary">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <ul className="flex flex-col gap-2 pr-1">
                      {zhForm.references.length === 0 ? (
                        <span className="text-xs text-admin-text-secondary/60 italic py-2">目前無任何中文參考文獻</span>
                      ) : (
                        zhForm.references.map((ref, idx) => (
                          <li key={idx} className="flex gap-2 justify-between items-start p-3 rounded-xl bg-admin-bg-panel border border-admin-card-border text-xs text-admin-text-primary shadow-xs">
                            <span className="leading-relaxed flex-1">{ref}</span>
                            <button type="button" onClick={() => removeReference("zh", idx)} className="text-admin-text-secondary hover:text-rose-400 cursor-pointer p-0.5">
                              <X className="w-4 h-4 shrink-0" />
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  {/* 英文文獻 */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-bold text-admin-text-secondary uppercase tracking-wider flex items-center gap-1">
                      English References
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add English citation..."
                        value={newReference}
                        onChange={(e) => setNewReference(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addReference("en"))}
                        className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-admin-input-bg border border-admin-card-border text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                      />
                      <button type="button" onClick={() => addReference("en")} className="px-4 rounded-xl bg-admin-bg-panel border border-admin-card-border hover:bg-admin-hover-bg cursor-pointer text-admin-text-primary">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <ul className="flex flex-col gap-2 pr-1">
                      {enForm.references.length === 0 ? (
                        <span className="text-xs text-admin-text-secondary/60 italic py-2">No English references added</span>
                      ) : (
                        enForm.references.map((ref, idx) => (
                          <li key={idx} className="flex gap-2 justify-between items-start p-3 rounded-xl bg-admin-bg-panel border border-admin-card-border text-xs text-admin-text-primary shadow-xs">
                            <span className="leading-relaxed flex-1">{ref}</span>
                            <button type="button" onClick={() => removeReference("en", idx)} className="text-admin-text-secondary hover:text-rose-400 cursor-pointer p-0.5">
                              <X className="w-4 h-4 shrink-0" />
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Tab 內容區：藝廊相片管理 */}
          {activeSubTab === "gallery" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-150">
              
              {/* 卡片 1：新增與上傳相片區 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Upload className="w-3.5 h-3.5 text-emerald-400" /> 新增照片與檔案上傳 (Upload & Add Photos)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mt-1">
                  {/* 1. 本地檔案上傳 */}
                  <div className="flex flex-col gap-3 justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">本機照片檔案上傳</span>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-admin-card-border hover:border-emerald-500/50 rounded-xl p-6 cursor-pointer bg-admin-input-bg/50 hover:bg-admin-input-bg transition-colors group">
                      {uploading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                      ) : (
                        <Upload className="w-6 h-6 text-admin-text-secondary group-hover:text-emerald-400 transition-colors" />
                      )}
                      <span className="text-xs text-admin-text-secondary mt-2 font-semibold group-hover:text-admin-text-primary transition-colors">
                        {uploading ? "上傳中，請稍候..." : "選擇檔案並上傳至 Cloudinary"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadPhoto}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-admin-text-secondary italic">
                      提示：上傳將儲存至專案對應的 Cloudinary 目錄下。
                    </p>
                  </div>

                  {/* 2. 手動輸入 URL 新增 */}
                  <div className="flex flex-col gap-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">手動新增照片網址</span>
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="照片 URL (必須填寫)"
                        value={newPhotoUrl}
                        onChange={(e) => setNewPhotoUrl(e.target.value)}
                        className="px-3 py-2.5 text-xs rounded-xl bg-admin-input-bg border border-admin-card-border text-admin-text-primary placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="攝影 Credit (例如 ©Jerome)"
                          value={newPhotoCredit}
                          onChange={(e) => setNewPhotoCredit(e.target.value)}
                          className="px-3 py-2.5 text-xs rounded-xl bg-admin-input-bg border border-admin-card-border text-admin-text-primary placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                        />
                        <select
                          value={newPhotoLicense}
                          onChange={(e) => setNewPhotoLicense(e.target.value)}
                          className="px-3 py-2.5 text-xs rounded-xl bg-admin-input-bg border border-admin-card-border text-admin-text-primary focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                        >
                          {allLicenses.map((lic) => (
                            <option key={lic} value={lic}>
                              {lic}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddPhotoManual}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-admin-bg-panel hover:bg-admin-hover-bg border border-admin-card-border text-admin-text-primary transition-colors cursor-pointer flex justify-center items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>加入照片清單</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 卡片 2：物種飛行剪影 (Flight Silhouettes) */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Upload className="w-3.5 h-3.5 text-emerald-400" /> 物種飛行剪影 (Upload Flight Silhouettes)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mt-1">
                  {/* 1. 本地剪影檔案上傳 */}
                  <div className="flex flex-col gap-3 justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">本機剪影檔案上傳</span>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-admin-card-border hover:border-emerald-500/50 rounded-xl p-6 cursor-pointer bg-admin-input-bg/50 hover:bg-admin-input-bg transition-colors group">
                      {uploadingSilhouette ? (
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                      ) : (
                        <Upload className="w-6 h-6 text-admin-text-secondary group-hover:text-emerald-400 transition-colors" />
                      )}
                      <span className="text-xs text-admin-text-secondary mt-2 font-semibold group-hover:text-admin-text-primary transition-colors">
                        {uploadingSilhouette ? "上傳中，請稍候..." : "選擇檔案並上傳至 Cloudinary"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadSilhouette}
                        disabled={uploadingSilhouette}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-admin-text-secondary italic">
                      提示：飛行剪影會儲存至 Cloudinary 對應物種資料夾的 "silhouettes" Folder 內。
                    </p>
                  </div>

                  {/* 2. 剪影預覽 */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">目前剪影預覽</span>
                    {silhouetteUrl ? (
                      <div className="flex flex-col gap-2">
                        <div className="relative rounded-xl border border-admin-card-border overflow-hidden bg-admin-bg-panel flex items-center justify-center p-4 h-32 group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={silhouetteUrl} 
                            alt="Flight Silhouette Preview" 
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleDeleteSilhouette}
                          disabled={uploadingSilhouette}
                          className="py-1.5 px-3 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-400 transition-colors cursor-pointer flex justify-center items-center gap-1 self-start"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>刪除剪影</span>
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-admin-card-border bg-admin-bg-panel/30 flex flex-col items-center justify-center text-admin-text-secondary/60 h-32">
                        <span className="text-xs italic">尚未上傳剪影圖片</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 卡片 2：照片藝廊管理列表 */}
              <div className="p-6 rounded-3xl bg-admin-card-bg border border-admin-card-border flex flex-col gap-5 shadow-sm">
                <h4 className="text-xs font-bold text-admin-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-admin-card-border pb-2.5">
                  <Info className="w-3.5 h-3.5 text-emerald-400" /> 照片藝廊管理列表 (Gallery List)
                </h4>
                
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-admin-text-secondary">
                    照片藝廊列表 (共 {photosForm.length} 張，可拖曳縮圖或使用按鈕排序與修改)
                  </span>
                  
                  {photosForm.length === 0 ? (
                    <div className="py-12 border border-dashed border-admin-card-border rounded-xl text-center text-admin-text-secondary text-xs">
                      目前暫無任何相片，請由上方上傳或手動新增。
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                      {photosForm.map((photo, index) => (
                        <div
                          key={index}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (draggedIndex === null || draggedIndex === index) return;
                            const updated = [...photosForm];
                            const temp = updated[draggedIndex];
                            updated[draggedIndex] = updated[index];
                            updated[index] = temp;
                            setDraggedIndex(index);
                            setPhotosForm(updated);
                          }}
                          className={`flex flex-col rounded-2xl bg-admin-input-bg border overflow-hidden relative transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md ${
                            draggedIndex === index
                              ? "opacity-30 border-dashed border-emerald-500 scale-95 shadow-inner"
                              : "border-admin-card-border hover:border-admin-hover-border"
                          }`}
                        >
                          {/* 縮圖顯示 - 作為唯一的拖曳 Drag Handle */}
                          <div 
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              setDraggedIndex(index);
                            }}
                            onDragEnd={() => setDraggedIndex(null)}
                            className="w-full h-32 relative bg-admin-bg-panel border-b border-admin-card-border overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.url}
                              alt={`Gallery image ${index + 1}`}
                              className="w-full h-full object-cover pointer-events-none"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/images/fallback-bat.png";
                              }}
                            />
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-[9px] font-bold text-slate-300">
                              順序 #{index + 1}
                            </div>
                          </div>

                          {/* 編輯輸入欄位 */}
                          <div className="p-3.5 flex flex-col gap-2">
                             <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-admin-text-secondary uppercase">照片來源 Credit</label>
                                <input
                                  type="text"
                                  value={photo.credit}
                                  onChange={(e) => {
                                    const updated = [...photosForm];
                                    updated[index].credit = e.target.value;
                                    setPhotosForm(updated);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-admin-text-secondary uppercase">授權條款 License</label>
                                <select
                                  value={photo.license}
                                  onChange={(e) => {
                                    const updated = [...photosForm];
                                    updated[index].license = e.target.value;
                                    setPhotosForm(updated);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                                >
                                  {allLicenses.map((lic) => (
                                    <option key={lic} value={lic}>
                                      {lic}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-admin-text-secondary uppercase">Cloudinary URL</label>
                              <input
                                type="text"
                                value={photo.url}
                                onChange={(e) => {
                                  const updated = [...photosForm];
                                  updated[index].url = e.target.value;
                                  setPhotosForm(updated);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-admin-input-bg border border-admin-card-border text-xs text-admin-text-primary focus:outline-none focus:border-emerald-500/50"
                              />
                            </div>
                          </div>

                          {/* 操作按鈕工具列 */}
                          <div className="flex border-t border-admin-card-border bg-admin-bg-panel divide-x divide-admin-card-border">
                            <button
                              type="button"
                              onClick={() => handleMovePhoto(index, "up")}
                              disabled={index === 0}
                              className="flex-1 py-2 text-[10px] font-bold text-admin-text-secondary hover:text-admin-text-primary hover:bg-admin-hover-bg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer flex justify-center items-center gap-1"
                              title="向前移"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePhoto(index, "down")}
                              disabled={index === photosForm.length - 1}
                              className="flex-1 py-2 text-[10px] font-bold text-admin-text-secondary hover:text-admin-text-primary hover:bg-admin-hover-bg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer flex justify-center items-center gap-1"
                              title="向後移"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(index)}
                              className="flex-1 py-2 text-[10px] font-bold text-admin-text-secondary hover:text-rose-400 hover:bg-admin-hover-bg transition-colors cursor-pointer flex justify-center items-center gap-1"
                              title="刪除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
            </div>
          )}

        </div>
      )}

      {/* Toast Notification Bubble */}
      <div
        className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-xl transition-all duration-300 ease-out ${
          toast.show
            ? "translate-y-0 opacity-100 scale-100"
            : "-translate-y-8 opacity-0 scale-95 pointer-events-none"
        } ${
          toast.type === "success"
            ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-200 shadow-emerald-500/10"
            : "bg-rose-950/90 border-rose-500/30 text-rose-200 shadow-rose-500/10"
        }`}
      >
        {toast.type === "success" ? (
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
        )}
        <span className="text-xs font-bold tracking-wide">{toast.message}</span>
      </div>
    </div>
  );
}
