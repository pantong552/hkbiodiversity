'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { useTaxonomy } from '@/context/TaxonomyContext';
import { 
  Save, 
  RotateCcw, 
  X, 
  Loader2, 
  FileText, 
  Lock, 
  Layers, 
  ShieldAlert, 
  MapPin, 
  Plus,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FieldConfig {
  key: string;
  labelChi: string;
  labelEng: string;
  type: 'text' | 'number' | 'textarea';
  readOnly?: boolean;
}

interface FieldGroup {
  id: string;
  nameChi: string;
  nameEng: string;
  icon: React.ReactNode;
  fields: FieldConfig[];
}

interface SpeciesDetailEditorProps {
  table: string;
  data: any;
  onSave: (updatedItem: any) => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

// 1. 動物 (species) 欄位組配置
const faunaFieldGroups = (t: any): FieldGroup[] => [
  {
    id: 'basic',
    nameChi: '基本資訊',
    nameEng: 'Basic Info',
    icon: <FileText className="w-4 h-4" />,
    fields: [
      { key: 'taxa_id', labelChi: '物種 ID', labelEng: 'Taxa ID', type: 'text', readOnly: true },
      { key: 'inat_id', labelChi: 'iNaturalist ID', labelEng: 'iNaturalist ID', type: 'number' },
      { key: 'col_usage_id', labelChi: 'Catalogue of Life ID', labelEng: 'Catalogue of Life ID', type: 'text' },
      { key: 'taxa_group', labelChi: '物種分類群', labelEng: 'Taxa Group', type: 'text' },
      { key: 'informal_group_eng', labelChi: '非正式群組 (英)', labelEng: 'Informal Group (Eng)', type: 'text' },
      { key: 'informal_group_chi', labelChi: '非正式群組 (中)', labelEng: 'Informal Group (Chi)', type: 'text', readOnly: true },
      { key: 'common_name_chi', labelChi: '中文俗名', labelEng: 'Common Name (Chi)', type: 'text' },
      { key: 'common_name_eng', labelChi: '英文俗名', labelEng: 'Common Name (Eng)', type: 'text' },
      { key: 'scientific_name', labelChi: '學名', labelEng: 'Scientific Name', type: 'text' },
      { key: 'author', labelChi: '命名者', labelEng: 'Author', type: 'text' },
      { key: 'alias_scientific_name', labelChi: '學名別名', labelEng: 'Alias Scientific Name', type: 'text' },
      {key: 'alias_common_name_chi', labelChi: '中文俗名別名', labelEng: 'Alias Common Name (Chi)', type: 'text'},
      {key: 'alias_common_name_eng', labelChi: '英文俗名別名', labelEng: 'Alias Common Name (Eng)', type: 'text'},
    ]
  },
  {
    id: 'taxonomy',
    nameChi: '分類學資訊',
    nameEng: 'Taxonomy',
    icon: <Layers className="w-4 h-4" />,
    fields: [
      {key: 'phylum_eng', labelChi: '門 (英)', labelEng: 'Phylum (Eng)', type: 'text'},
      {key: 'phylum_chi', labelChi: '門 (中)', labelEng: 'Phylum (Chi)', type: 'text', readOnly: true},
      {key: 'class_eng', labelChi: '綱 (英)', labelEng: 'Class (Eng)', type: 'text'},
      {key: 'class_chi', labelChi: '綱 (中)', labelEng: 'Class (Chi)', type: 'text', readOnly: true},
      {key: 'order_eng', labelChi: '目 (英)', labelEng: 'Order (Eng)', type: 'text'},
      {key: 'order_chi', labelChi: '目 (中)', labelEng: 'Order (Chi)', type: 'text', readOnly: true},
      {key: 'family_eng', labelChi: '科 (英)', labelEng: 'Family (Eng)', type: 'text'},
      {key: 'family_chi', labelChi: '科 (中)', labelEng: 'Family (Chi)', type: 'text', readOnly: true},
      {key: 'genus_eng', labelChi: '屬 (英)', labelEng: 'Genus (Eng)', type: 'text'},
      {key: 'genus_chi', labelChi: '屬 (中)', labelEng: 'Genus (Chi)', type: 'text', readOnly: true},
      {key: 'species_eng', labelChi: '種 (英)', labelEng: 'Species (Eng)', type: 'text'},
      {key: 'sub_species_eng', labelChi: '亞種 (英)', labelEng: 'Sub-species (Eng)', type: 'text'},
    ]
  },
  {
    id: 'conservation',
    nameChi: '保護與生存狀態',
    nameEng: 'Conservation',
    icon: <ShieldAlert className="w-4 h-4" />,
    fields: [
      {key: 'iucn', labelChi: 'IUCN 評級', labelEng: 'IUCN Status', type: 'text'},
      {key: 'cites', labelChi: 'CITES 評級', labelEng: 'CITES Status', type: 'text'},
      {key: 'afcd', labelChi: 'AFCD 評級', labelEng: 'AFCD Rating', type: 'text'},
      {key: 'hkbws_cat', labelChi: '鳥種類別 (HKBWS)', labelEng: 'HKBWS Category', type: 'text'},
      {key: 'china_red_list', labelChi: '中國紅皮書', labelEng: 'China Red List', type: 'text'},
      {key: 'china_vertebrates_red_list', labelChi: '中國脊椎動物紅皮書', labelEng: 'China Vertebrates Red List', type: 'text'},
      {key: 'hk_protection', labelChi: '香港保護法例', labelEng: 'HK Protection', type: 'text'},
      {key: 'endemic', labelChi: '特有種', labelEng: 'Endemicity', type: 'text'},
      {key: 'native_status', labelChi: '原生概況', labelEng: 'Native Status', type: 'text'},
      {key: 'restrictedness', labelChi: '受限度/稀有度', labelEng: 'Restrictedness', type: 'text'},
    ]
  },
  {
    id: 'descriptions',
    nameChi: '描述與分佈',
    nameEng: 'Descriptions',
    icon: <MapPin className="w-4 h-4" />,
    fields: [
      {key: 'introduction_chi', labelChi: '物種簡介 (中)', labelEng: 'Introduction (Chi)', type: 'textarea'},
      {key: 'introduction_eng', labelChi: '物種簡介 (英)', labelEng: 'Introduction (Eng)', type: 'textarea'},
      {key: 'description_chi', labelChi: '形態特徵 (中)', labelEng: 'Description (Chi)', type: 'textarea'},
      {key: 'description_eng', labelChi: '形態特徵 (英)', labelEng: 'Description (Eng)', type: 'textarea'},
      {key: 'habitat_chi', labelChi: '棲息地 (中)', labelEng: 'Habitat (Chi)', type: 'textarea'},
      {key: 'habitat_eng', labelChi: '棲息地 (英)', labelEng: 'Habitat (Eng)', type: 'textarea'},
      {key: 'microhabitat_chi', labelChi: '微棲地 (中)', labelEng: 'Microhabitat (Chi)', type: 'textarea'},
      {key: 'microhabitat_eng', labelChi: '微棲地 (英)', labelEng: 'Microhabitat (Eng)', type: 'textarea'},
      {key: 'host_plants_chi', labelChi: '寄主植物 (中)', labelEng: 'Host Plants (Chi)', type: 'textarea'},
      {key: 'host_plants_eng', labelChi: '寄主植物 (英)', labelEng: 'Host Plants (Eng)', type: 'textarea'},
      {key: 'hk_distribution_chi', labelChi: '香港分布 (中)', labelEng: 'HK Distribution (Chi)', type: 'textarea'},
      {key: 'hk_distribution_eng', labelChi: '香港分布 (英)', labelEng: 'HK Distribution (Eng)', type: 'textarea'},
      {key: 'global_distribution_chi', labelChi: '全球分布 (中)', labelEng: 'Global Distribution (Chi)', type: 'textarea'},
      {key: 'global_distribution_eng', labelChi: '全球分布 (英)', labelEng: 'Global Distribution (Eng)', type: 'textarea'},
      {key: 'remarks_chi', labelChi: '備註 (中)', labelEng: 'Remarks (Chi)', type: 'textarea'},
      {key: 'remarks_eng', labelChi: '備註 (英)', labelEng: 'Remarks (Eng)', type: 'textarea'},
      {key: 'references_chi', labelChi: '參考文獻 (中)', labelEng: 'References (Chi)', type: 'textarea'},
      {key: 'references_eng', labelChi: '參考文獻 (英)', labelEng: 'References (Eng)', type: 'textarea'},
    ]
  }
];

// 2. 植物 (plant_species) 欄位組配置
const floraFieldGroups = (t: any): FieldGroup[] => [
  {
    id: 'basic',
    nameChi: '基本資訊',
    nameEng: 'Basic Info',
    icon: <FileText className="w-4 h-4" />,
    fields: [
      { key: 'taxa_id', labelChi: '物種 ID', labelEng: 'Taxa ID', type: 'text', readOnly: true },
      { key: 'oid', labelChi: 'OID', labelEng: 'OID', type: 'number', readOnly: true },
      { key: 'inat_id', labelChi: 'iNaturalist ID', labelEng: 'iNaturalist ID', type: 'number' },
      { key: 'col_usage_id', labelChi: 'Catalogue of Life ID', labelEng: 'Catalogue of Life ID', type: 'text' },
      { key: 'category_chi', labelChi: '植物類別 (中)', labelEng: 'Category (Chi)', type: 'text', readOnly: true },
      { key: 'category_eng', labelChi: '植物類別 (英)', labelEng: 'Category (Eng)', type: 'text' },
      { key: 'common_name_chi', labelChi: '中文俗名', labelEng: 'Common Name (Chi)', type: 'text' },
      { key: 'common_name_eng', labelChi: '英文俗名', labelEng: 'Common Name (Eng)', type: 'text' },
      { key: 'scientific_name', labelChi: '學名', labelEng: 'Scientific Name', type: 'text' },
      { key: 'author', labelChi: '命名者', labelEng: 'Author', type: 'text' },
      { key: 'origin', labelChi: '來源狀態', labelEng: 'Origin Status', type: 'text' },
    ]
  },
  {
    id: 'taxonomy',
    nameChi: '分類學資訊',
    nameEng: 'Taxonomy',
    icon: <Layers className="w-4 h-4" />,
    fields: [
      { key: 'family_chi', labelChi: '科 (中)', labelEng: 'Family (Chi)', type: 'text', readOnly: true },
      { key: 'family_eng', labelChi: '科 (英)', labelEng: 'Family (Eng)', type: 'text' },
      { key: 'genus_chi', labelChi: '屬 (中)', labelEng: 'Genus (Chi)', type: 'text', readOnly: true },
      { key: 'genus_eng', labelChi: '屬 (英)', labelEng: 'Genus (Eng)', type: 'text' },
      { key: 'species_eng', labelChi: '種 (英)', labelEng: 'Species (Eng)', type: 'text' },
    ]
  },
  {
    id: 'conservation',
    nameChi: '保護與生存狀態',
    nameEng: 'Conservation',
    icon: <ShieldAlert className="w-4 h-4" />,
    fields: [
      { key: 'is_cap96', labelChi: '林務條例 (第96章)', labelEng: 'Cap. 96 Status', type: 'text' },
      { key: 'is_cap586', labelChi: '保護瀕危動植物物種條例 (第586章)', labelEng: 'Cap. 586 Status', type: 'text' },
      { key: 'hk_rare_precious_note', labelChi: '香港稀有及珍貴植物', labelEng: 'HK Rare & Precious', type: 'text' },
      { key: 'china_red_data_book_note', labelChi: '中國植物紅皮書', labelEng: 'China Plant Red Data Book', type: 'text' },
    ]
  },
  {
    id: 'descriptions',
    nameChi: '描述與分佈',
    nameEng: 'Descriptions',
    icon: <MapPin className="w-4 h-4" />,
    fields: [
      { key: 'description_chi', labelChi: '記述 (中)', labelEng: 'Description (Chi)', type: 'textarea' },
      { key: 'description_eng', labelChi: '記述 (英)', labelEng: 'Description (Eng)', type: 'textarea' },
      { key: 'locality_chi', labelChi: '產地 (中)', labelEng: 'Locality (Chi)', type: 'textarea' },
      { key: 'locality_eng', labelChi: '產地 (英)', labelEng: 'Locality (Eng)', type: 'textarea' },
      { key: 'distribution_chi', labelChi: '分佈 (中)', labelEng: 'Distribution (Chi)', type: 'textarea' },
      { key: 'distribution_eng', labelChi: '分佈 (英)', labelEng: 'Distribution (Eng)', type: 'textarea' },
      { key: 'habitat_chi', labelChi: '生境 (中)', labelEng: 'Habitat (Chi)', type: 'textarea' },
      { key: 'habitat_eng', labelChi: '生境 (英)', labelEng: 'Habitat (Eng)', type: 'textarea' },
      { key: 'usage_chi', labelChi: '用途 (中)', labelEng: 'Usage (Chi)', type: 'textarea' },
      { key: 'usage_eng', labelChi: '用途 (英)', labelEng: 'Usage (Eng)', type: 'textarea' },
      { key: 'remark_chi', labelChi: '備註 (中)', labelEng: 'Remarks (Chi)', type: 'textarea' },
      { key: 'remark_eng', labelChi: '備註 (英)', labelEng: 'Remarks (Eng)', type: 'textarea' },
      { key: 'flowering_period', labelChi: '花期 (文字描述)', labelEng: 'Flowering Period', type: 'text' },
      { key: 'fruiting_period', labelChi: '果期 (文字描述)', labelEng: 'Fruiting Period', type: 'text' },
    ]
  }
];

export default function SpeciesDetailEditor({ table, data, onSave, onCancel, onDirtyChange }: SpeciesDetailEditorProps) {
  const { language, t } = useLanguage();
  const { getTaxonomyChi } = useTaxonomy();
  const supabase = useMemo(() => createClient(), []);
  
  const [formValues, setFormValues] = useState<any>({});
  const [originalValues, setOriginalValues] = useState<any>({});
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [saving, setSaving] = useState(false);

  // 1. 初始化資料
  useEffect(() => {
    if (data) {
      setFormValues({ ...data });
      setOriginalValues({ ...data });
    }
  }, [data]);

  // 2. 獲取當前資料表預定義的分組
  const baseGroups = useMemo(() => {
    return table === 'plant_species' ? floraFieldGroups(t) : faunaFieldGroups(t);
  }, [table, t]);

  // 3. 收集所有未在預定義分組中列出的欄位 (Others Tab) -> 保證擴展性
  const finalGroups = useMemo(() => {
    if (!data) return baseGroups;

    const definedKeys = new Set(baseGroups.flatMap(g => g.fields.map(f => f.key)));
    
    // 排除系統內建主鍵與索引、時間欄位
    const ignoredKeys = ['id', 'taxa_id', 'fts', 'created_at', 'updated_at', 'flowering_months', 'fruiting_months'];

    const otherLabelMap: Record<string, { labelChi: string; labelEng: string }> = {
      profile_picture: { labelChi: '頭像圖片路徑', labelEng: 'Profile Picture' },
      similar_species: { labelChi: '相似物種 (taxa_id清單)', labelEng: 'Similar Species (taxa_ids)' }
    };

    const otherFields = Object.keys(data)
      .filter(key => !definedKeys.has(key) && !ignoredKeys.includes(key))
      .map(key => {
        const val = data[key];
        const isNum = typeof val === 'number';
        const customLabel = otherLabelMap[key];
        return {
          key,
          labelChi: customLabel ? customLabel.labelChi : key,
          labelEng: customLabel ? customLabel.labelEng : key,
          type: isNum ? 'number' : 'text'
        } as FieldConfig;
      });

    if (otherFields.length > 0) {
      return [
        ...baseGroups,
        {
          id: 'others',
          nameChi: '其他屬性',
          nameEng: 'Others',
          icon: <Plus className="w-4 h-4" />,
          fields: otherFields
        }
      ];
    }

    return baseGroups;
  }, [baseGroups, data]);

  // 4. 偵測是否有欄位被修改
  const isDirty = useMemo(() => {
    return JSON.stringify(formValues) !== JSON.stringify(originalValues);
  }, [formValues, originalValues]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // 5. 處理欄位異動
  const handleFieldChange = (key: string, val: any, type: 'text' | 'number' | 'textarea') => {
    let finalVal = val;
    if (type === 'number') {
      finalVal = val === '' ? null : Number(val);
    }
    setFormValues((prev: any) => ({ ...prev, [key]: finalVal }));
  };

  // 6. 恢復原狀
  const handleReset = () => {
    setFormValues({ ...originalValues });
  };

  // 7. 儲存變更
  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);

    try {
      // 過濾出僅有修改的欄位以提升性能
      const updatedFields: any = {};
      Object.keys(formValues).forEach(key => {
        if (formValues[key] !== originalValues[key]) {
          updatedFields[key] = formValues[key];
        }
      });

      const { error } = await supabase
        .from(table)
        .update(updatedFields)
        .eq('taxa_id', data.taxa_id);

      if (error) throw error;

      const finalItem = { ...data, ...formValues };
      setOriginalValues({ ...formValues });
      onSave(finalItem);
    } catch (err) {
      console.error('Error saving species detail:', err);
      alert(language === 'zh' ? '儲存失敗，請重試。' : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold">
        {language === 'zh' ? '請從左側選擇一個物種進行編輯' : 'Select a species from the list to edit'}
      </div>
    );
  }

  const currentGroup = finalGroups.find(g => g.id === activeTab) || finalGroups[0];
  const commonName = language === 'zh' ? data.common_name_chi : data.common_name_eng;

  return (
    <div className="h-full flex flex-col min-h-0 bg-white rounded-3xl overflow-hidden relative border border-slate-100">
      
      {/* 1. Header Area */}
      <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between flex-shrink-0 bg-slate-50/50">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md">
              {data.taxa_id}
            </span>
            <h3 className="text-md font-black text-slate-800 truncate">
              {commonName || data.scientific_name}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-serif italic truncate mt-1">
            {data.scientific_name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Reset Button */}
          {isDirty && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-100 hover:border-slate-300 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Reset changes"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{language === 'zh' ? '重設' : 'Reset'}</span>
            </button>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              isDirty 
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-100 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-200 hover:scale-[1.02] active:scale-95' 
                : 'bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{language === 'zh' ? '儲存變更' : 'Save Changes'}</span>
          </button>

          {/* Close Button */}
          <button 
            onClick={onCancel}
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all hover:scale-105 active:scale-95 border border-transparent hover:border-slate-100 cursor-pointer"
            title="Close Editor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Body Area (Split into Left Tabs and Right Fields Scroll) */}
      <div className="flex-1 flex min-h-0">
        
        {/* Left Tabs Column */}
        <div className="w-1/4 min-w-[150px] border-r border-slate-50 py-4 flex flex-col gap-1.5 bg-slate-50/20">
          {finalGroups.map(group => (
            <button
              key={group.id}
              onClick={() => setActiveTab(group.id)}
              className={`w-[calc(100%-16px)] mx-2 px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left outline-none relative cursor-pointer ${
                activeTab === group.id
                  ? 'bg-white text-emerald-700 shadow-sm border border-slate-100'
                  : 'text-slate-500 hover:bg-slate-100/60 hover:text-slate-700 border border-transparent active:scale-[0.98]'
              }`}
            >
              {activeTab === group.id && (
                <motion.div 
                  layoutId="active-editor-tab-indicator"
                  className="absolute left-[-2px] top-2.5 bottom-2.5 w-0.5 bg-emerald-500 rounded-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className={activeTab === group.id ? 'text-emerald-600' : 'text-slate-400 transition-colors group-hover:text-slate-600'}>
                {group.icon}
              </span>
              <span className="truncate">
                {language === 'zh' ? group.nameChi : group.nameEng}
              </span>
            </button>
          ))}
        </div>

        {/* Right Fields Scroll Column */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            
            {currentGroup.fields.map(field => {
              let val = formValues[field.key] ?? '';
              
              // 動態計算分類學中文翻譯 (僅限門、綱、目、科、屬、非正式群組)
              const taxonomyChiKeys = ['phylum_chi', 'class_chi', 'order_chi', 'family_chi', 'genus_chi', 'informal_group_chi'];
              if (taxonomyChiKeys.includes(field.key)) {
                const rank = field.key.replace('_chi', '');
                const engKey = rank === 'informal_group' ? 'informal_group_eng' : `${rank}_eng`;
                const engVal = formValues[engKey];
                if (engVal) {
                  val = getTaxonomyChi(rank, table === 'plant_species' ? 'flora' : 'fauna', engVal) || '';
                }
              }

              const isReadOnly = field.readOnly;
              const isTextarea = field.type === 'textarea';
              const label = language === 'zh' ? field.labelChi : field.labelEng;
              const isFieldDirty = formValues[field.key] !== originalValues[field.key];
              const isBilingualField = field.key.endsWith('_chi') || field.key.endsWith('_eng');
              const useFullWidth = isTextarea && !isBilingualField;

              return (
                <div 
                  key={field.key} 
                  className={`flex flex-col gap-1.5 ${useFullWidth ? 'md:col-span-2' : ''}`}
                >
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    {isReadOnly && <Lock className="w-3 h-3 text-slate-300" />}
                    <span className={isFieldDirty ? 'text-emerald-600 font-bold' : ''}>{label}</span>
                    <span className="text-[8px] font-mono opacity-50 lowercase">({field.key})</span>
                    {isFieldDirty && (
                      <span 
                        className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0" 
                        title={language === 'zh' ? '已修改' : 'Modified'} 
                      />
                    )}
                  </label>

                  {isReadOnly ? (
                    <div 
                      className="bg-slate-50/80 border border-slate-100 text-slate-400 rounded-xl px-4 py-2.5 text-xs font-semibold select-none flex items-center justify-between cursor-not-allowed group/readonly"
                      title={language === 'zh' ? '此為系統唯讀欄位' : 'This field is read-only'}
                    >
                      <span className="font-mono opacity-70">{String(val)}</span>
                      <Lock className="w-3.5 h-3.5 text-slate-300 group-hover/readonly:text-slate-400 transition-colors" />
                    </div>
                  ) : isTextarea ? (
                    <textarea
                      value={String(val)}
                      onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                      rows={5}
                      className={`w-full focus:bg-white border rounded-xl px-4 py-3 text-xs font-semibold transition-colors duration-200 focus:outline-none focus:ring-1 custom-scrollbar leading-relaxed ${
                        isFieldDirty 
                          ? 'border-emerald-300/80 focus:border-emerald-500 focus:ring-emerald-500/20 bg-emerald-50/5' 
                          : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100 hover:border-slate-200 focus:border-emerald-400 focus:ring-emerald-400'
                      }`}
                      placeholder={language === 'zh' ? `請輸入 ${label}...` : `Enter ${label}...`}
                    />
                  ) : (
                    <div className="flex gap-2 w-full items-center">
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={String(val)}
                        onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                        className={`flex-1 min-w-0 focus:bg-white border rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors duration-200 focus:outline-none focus:ring-1 ${
                          isFieldDirty 
                            ? 'border-emerald-300/80 focus:border-emerald-500 focus:ring-emerald-500/20 bg-emerald-50/5' 
                            : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100 hover:border-slate-200 focus:border-emerald-400 focus:ring-emerald-400'
                        }`}
                        placeholder={language === 'zh' ? `請輸入 ${label}...` : `Enter ${label}...`}
                      />
                      {(field.key === 'col_usage_id' || field.key === 'inat_id') && (
                        <a
                          href={
                            val 
                              ? (field.key === 'col_usage_id'
                                  ? `https://www.catalogueoflife.org/data/taxon/${val}`
                                  : `https://www.inaturalist.org/taxa/${val}`)
                              : undefined
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-center p-2.5 rounded-xl border transition-all shrink-0 select-none ${
                            val 
                              ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 hover:scale-[1.02] active:scale-95 cursor-pointer' 
                              : 'bg-slate-50/50 border-slate-100 text-slate-300 cursor-not-allowed'
                          }`}
                          onClick={(e) => {
                            if (!val) e.preventDefault();
                          }}
                          title={val ? (language === 'zh' ? '開啟外部連結' : 'Open external link') : (language === 'zh' ? '請先輸入 ID' : 'Please enter ID first')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          </div>
        </div>

      </div>
    </div>
  );
}
