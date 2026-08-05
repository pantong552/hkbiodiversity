'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  UploadCloud,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  Leaf,
  Bug,
  Camera,
  Maximize2,
  ChevronRight,
  Info,
  SlidersHorizontal,
  FileImage,
  Loader2
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { supabase } from '@/lib/supabase';

// iNaturalist API 回傳數據介面定義
export interface TaxonPhoto {
  id: number;
  url: string;
}

export interface TaxonInfo {
  id: number;
  name: string; // 學名
  preferred_common_name?: string; // 常用名 (語系偏好/中文名)
  english_common_name?: string; // 英文常用名
  rank: string; // species, genus, etc.
  rank_level?: number;
  iconic_taxon_name?: string;
  iconic_taxon_id?: number;
  is_active?: boolean;
  default_photo?: TaxonPhoto;
  representative_photo?: TaxonPhoto;
  ancestor_ids?: number[];
  matched_term?: string;
}

export interface InatResultItem {
  combined_score: number;
  vision_score: number;
  frequency_score: number;
  taxon: TaxonInfo;
}

export interface InatApiResponse {
  total_results?: number;
  page?: number;
  per_page?: number;
  common_ancestor?: {
    score?: number;
    taxon?: TaxonInfo;
  };
  results: InatResultItem[];
}

// 1. 圖片轉換 API 封裝工具 (將網路圖片經過 /api/image/transform 處理)
function getTransformedImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/api/image/transform')) {
    return url;
  }
  return `/api/image/transform?url=${encodeURIComponent(url)}`;
}

// 1. 前端圖像壓縮與縮放函式 (長邊 1024px 以內，quality 0.85)
function compressImage(file: File, maxDimension = 1024, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // 等比例縮放
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        return reject(new Error('Canvas context unavailable'));
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (blob) resolve(blob);
        else reject(new Error('Canvas 轉 Blob 失敗'));
      }, 'image/jpeg', quality);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
  });
}

export default function SpeciesAutoIdModal() {
  const { language } = useLanguage();
  const { isAutoIdOpen, setAutoIdOpen, addSpecies } = useSpeciesPanel();

  // 狀態管理
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploadingPhase, setIsUploadingPhase] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultsData, setResultsData] = useState<InatApiResponse | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [navigatingTaxonId, setNavigatingTaxonId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isZh = language === 'zh';

  // 根據 inat_id 或學名尋找 Supabase 對應物種以開啟 Species Floating Panel
  const handleViewSpecies = async (taxon: TaxonInfo) => {
    const inatId = taxon.id;
    const sciName = taxon.name;

    if (!inatId && !sciName) return;

    if (inatId) setNavigatingTaxonId(inatId);

    try {
      if (inatId) {
        // 1. 搜尋動物表 species (inat_id -> taxa_id)
        const { data: faunaData } = await supabase
          .from('species')
          .select('taxa_id')
          .eq('inat_id', inatId)
          .maybeSingle();

        if (faunaData?.taxa_id) {
          addSpecies(faunaData.taxa_id);
          handleClose();
          return;
        }

        // 2. 搜尋植物表 plant_species (inat_id -> taxa_id)
        const { data: plantData } = await supabase
          .from('plant_species')
          .select('taxa_id')
          .eq('inat_id', inatId)
          .maybeSingle();

        if (plantData?.taxa_id) {
          addSpecies(plantData.taxa_id);
          handleClose();
          return;
        }
      }

      // 3. 備用搜尋：依據學名 (scientific_name)
      if (sciName) {
        const { data: faunaSci } = await supabase
          .from('species')
          .select('taxa_id')
          .ilike('scientific_name', sciName.trim())
          .maybeSingle();

        if (faunaSci?.taxa_id) {
          addSpecies(faunaSci.taxa_id);
          handleClose();
          return;
        }

        const { data: plantSci } = await supabase
          .from('plant_species')
          .select('taxa_id')
          .ilike('scientific_name', sciName.trim())
          .maybeSingle();

        if (plantSci?.taxa_id) {
          addSpecies(plantSci.taxa_id);
          handleClose();
          return;
        }
      }

      // 4. 若 Supabase 無相關紀錄，轉用 iNaturalist 外部連結
      const targetInatId = inatId || taxon.id;
      window.open(`https://www.inaturalist.org/taxa/${targetInatId}`, '_blank');
    } catch (err) {
      console.error('Error matching species taxa_id:', err);
      window.open(`https://www.inaturalist.org/taxa/${taxon.id}`, '_blank');
    } finally {
      setNavigatingTaxonId(null);
    }
  };

  // 清除/重設
  const handleReset = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCompressedSize(null);
    setResultsData(null);
    setErrorMsg(null);
    setIsLoading(false);
    setUploadProgress(0);
    setIsUploadingPhase(true);
  };

  const handleClose = () => {
    setAutoIdOpen(false);
  };

  // 選擇檔案與 API 識別處理
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg(isZh ? '請選擇正確的圖片檔案 (JPG, PNG, WEBP)' : 'Please select a valid image file');
      return;
    }

    // 換圖片或上傳圖片時，先重設狀態並開起 Uploading 階段
    setSelectedFile(file);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setResultsData(null); // 清空舊辨識結果
    setErrorMsg(null);

    setIsLoading(true);
    setIsUploadingPhase(true);
    setUploadProgress(15);
    setLoadingStep(isZh ? '正在讀取與處理相片檔案...' : 'Reading & processing photo...');

    // 關鍵優化：先給 React 60ms 完成畫面繪製，即刻無延遲彈出 Progress Bar 與動畫，避免 Canvas 解碼佔據主線程卡頓
    await new Promise((resolve) => setTimeout(resolve, 60));

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      // 動態模擬平滑上傳進度推進
      progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev < 45) return prev + 5;
          if (prev < 75) return prev + 2;
          if (prev < 90) return prev + 1;
          return prev;
        });
      }, 150);

      // 1. 自動壓縮圖片至 1024px 長邊以內
      const compressedBlob = await compressImage(file, 1024, 0.85);
      setCompressedSize(compressedBlob.size);

      setUploadProgress(50);
      setLoadingStep(isZh ? '正在上傳相片資料至辨識伺服器...' : 'Uploading photo data to server...');

      // 2. 獲取 API Token (統一使用 NEXT_PUBLIC_INAT_AUTOID_ENG_API)
      const token = process.env.NEXT_PUBLIC_INAT_AUTOID_ENG_API || process.env.NEXT_PUBLIC_INAT_AUTOID_CHI_API || '';

      const API_URL = 'https://api.inaturalist.org/v2/computervision/score_image?locale=zh-HK';

      const formData = new FormData();
      formData.append('image', compressedBlob, file.name);
      formData.append('include_representative_photos', 'true');
      formData.append('fields', JSON.stringify({
        frequency_score: true,
        vision_score: true,
        taxon: {
          ancestor_ids: true,
          default_photo: { url: true },
          representative_photo: { url: true },
          iconic_taxon_id: true,
          iconic_taxon_name: true,
          is_active: true,
          matched_term: true,
          name: true,                     // 拉丁學名
          preferred_common_name: true,    // 語系偏好常用名 (中文名)
          english_common_name: true,      // 英文常用名
          rank: true,
          rank_level: true
        }
      }));

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'X-Via': 'inaturalistjs'
      };

      if (token) {
        headers['Authorization'] = token;
      }
      if (isZh) {
        headers['Accept-Language'] = 'zh-HK,zh;q=0.9,zh-TW;q=0.8';
      }

      // 轉入 AI 物種比對識別階段
      setUploadProgress(78);
      setIsUploadingPhase(false);
      setLoadingStep(isZh ? 'AI 正在進行視覺特徵分析與物種比對...' : 'AI is analyzing features and matching species...');

      const response = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        throw new Error(`API Error ${response.status}: ${response.statusText}`);
      }

      const jsonResult: InatApiResponse = await response.json();

      if (progressInterval) clearInterval(progressInterval);
      setUploadProgress(100);

      // 短暫停留呈現 100% 滿格感
      await new Promise((res) => setTimeout(res, 250));

      setResultsData(jsonResult);
    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval);
      console.error('Species Identification failed:', err);
      setErrorMsg(err.message || (isZh ? '辨識服務暫時無法存取，請稍後再試。' : 'Identification failed. Please try again.'));
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  // Drag and Drop 處理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  if (!isAutoIdOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
        {/* 背景遮罩 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity"
        />

        {/* Floating Modal Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
          className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-emerald-100 z-10"
        >
          {/* Header 區塊 */}
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-amber-300 border border-white/30 shadow-inner">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  {isZh ? 'AI 相片物種辨識' : 'AI Species Photo ID'}
                </h3>
                <p className="text-xs text-emerald-100/90 font-light">
                  {isZh ? '上傳生態相片，即時獲取高精度物種建議結果' : 'Upload photo to identify flora & fauna in seconds'}
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
              title={isZh ? '關閉' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 內容區域 - 可滾動 */}
          <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1 bg-slate-50/50">
            {/* 上傳區域 (當尚未選擇圖片，或是可重新上傳時) */}
            {!previewUrl ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[220px] ${isDragOver
                  ? 'border-emerald-500 bg-emerald-50/80 scale-[0.99]'
                  : 'border-emerald-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-lg'
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8" />
                </div>

                <h4 className="text-base font-semibold text-slate-800 mb-1">
                  {isZh ? '拖曳圖片至此，或點擊選擇圖片' : 'Drag and drop photo here, or click to browse'}
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mb-4">
                  {isZh ? '支援 JPG、PNG、WEBP 格式相片（系統將自動最佳化壓縮避免大圖過載）' : 'Supports JPG, PNG, WEBP. Automatic canvas compression included.'}
                </p>

                <button
                  type="button"
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  {isZh ? '選擇相片' : 'Select Photo'}
                </button>
              </div>
            ) : (
              /* 上傳後的縮圖與狀態卡片 */
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-slate-100 group shadow-inner">
                  <img
                    src={previewUrl}
                    alt="Uploaded preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setEnlargedPhoto(previewUrl)}
                    className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                    title={isZh ? '放大查看' : 'Enlarge'}
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {selectedFile?.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-mono shrink-0">
                      {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB' : ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                      {isZh ? '換張相片' : 'Change Image'}
                    </button>
                    <button
                      onClick={handleReset}
                      disabled={isLoading}
                      className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-xs transition-colors cursor-pointer"
                    >
                      {isZh ? '重新開始' : 'Reset'}
                    </button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}

            {/* 載入/上傳與辨識中狀態 (包含 Uploading Animation 與 Progress Bar) */}
            {isLoading && (
              <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-emerald-100/40 border border-emerald-200/80 rounded-3xl p-5 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                      {isUploadingPhase ? (
                        <UploadCloud className="w-5 h-5 animate-bounce" />
                      ) : (
                        <Sparkles className="w-5 h-5 animate-spin" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2 truncate">
                        {isUploadingPhase
                          ? (isZh ? '正在上傳與處理相片...' : 'Uploading & processing photo...')
                          : (isZh ? 'AI 正在辨識物種...' : 'AI identifying species...')}
                      </h5>
                      <p className="text-xs text-emerald-700 font-medium truncate mt-0.5">{loadingStep}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-extrabold px-3 py-1 rounded-full bg-emerald-600 text-white shadow-sm shrink-0 ml-2">
                    {Math.round(uploadProgress)}%
                  </span>
                </div>

                {/* Progress Bar 進度條 */}
                <div className="w-full h-3 bg-emerald-200/60 rounded-full overflow-hidden p-0.5 border border-emerald-300/40 relative shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 rounded-full transition-all duration-300 shadow-sm relative overflow-hidden"
                    style={{ width: `${Math.min(100, Math.max(5, uploadProgress))}%` }}
                  >
                    <div className="absolute inset-0 bg-white/25 animate-pulse" />
                  </div>
                </div>
              </div>
            )}

            {/* 錯誤訊息 */}
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 flex items-start gap-3 text-xs">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold">{isZh ? '辨識失敗：' : 'Error: '}</span>
                  {errorMsg}
                </div>
              </div>
            )}

            {/* 辨識結果清單 (依據 inat_result.json) */}
            {resultsData && resultsData.results && (
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    {isZh ? '物種辨識建議結果' : 'Identification Suggestions'}
                    <span className="text-xs font-normal text-slate-400">
                      ({resultsData.results.length} {isZh ? '項結果' : 'items'})
                    </span>
                  </h4>
                </div>

                {/* 1. Common Ancestor Highlight 卡片 (如果有高信心階元提示) */}
                {resultsData.common_ancestor?.taxon && (
                  <div
                    onClick={() => handleViewSpecies(resultsData.common_ancestor!.taxon!)}
                    className="bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 hover:from-emerald-800 hover:to-slate-900 text-white rounded-2xl p-4 shadow-md border border-emerald-700/50 cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-1">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        {isZh ? '肯定屬於這個類別' : 'This must belong to this category:'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-emerald-300" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-base font-bold text-white block">
                          {isZh
                            ? (resultsData.common_ancestor.taxon.preferred_common_name || resultsData.common_ancestor.taxon.english_common_name || resultsData.common_ancestor.taxon.name)
                            : (resultsData.common_ancestor.taxon.english_common_name || resultsData.common_ancestor.taxon.preferred_common_name || resultsData.common_ancestor.taxon.name)
                          }
                        </span>
                        <span className="text-xs text-emerald-200/80">
                          <span className="italic">{resultsData.common_ancestor.taxon.name}</span>
                          <span className="not-italic opacity-90"> ({resultsData.common_ancestor.taxon.rank})</span>
                        </span>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        {resultsData.common_ancestor.taxon.iconic_taxon_name || 'Taxon'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. 建議物種清單 */}
                <div className="space-y-2.5">
                  {resultsData.results.map((item, idx) => {
                    const taxon = item.taxon;
                    const score = Math.round(item.vision_score || item.combined_score || 0);
                    const rawPhotoObj = (item as any).photo || taxon.representative_photo || taxon.default_photo;
                    const photoUrl = taxon.representative_photo?.url || taxon.default_photo?.url || (item as any).photo?.url;

                    // 優先採用 original_url / large_url，或將 /square. /small. 替換為 /original. 高畫質大圖
                    const originalPhotoUrl = rawPhotoObj?.original_url
                      || rawPhotoObj?.large_url
                      || (photoUrl ? photoUrl.replace(/\/(square|small|medium)\./i, '/original.') : null)
                      || photoUrl;

                    const commonName = isZh
                      ? (taxon.preferred_common_name || taxon.english_common_name || taxon.name)
                      : (taxon.english_common_name || taxon.preferred_common_name || taxon.name);
                    const scientificName = taxon.name;

                    // 色彩等級
                    const isTop1 = idx === 0;
                    const scoreColorClass = score >= 70
                      ? 'bg-emerald-500 text-white'
                      : score >= 30
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-400 text-white';

                    return (
                      <motion.div
                        key={taxon.id || idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`group relative bg-white border rounded-2xl p-3 sm:p-3.5 transition-all hover:shadow-md flex items-center gap-3.5 ${isTop1
                          ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                          : 'border-slate-200/90 hover:border-emerald-200'
                          }`}
                      >
                        {/* 縮圖 Thumbnail */}
                        <div
                          onClick={() => originalPhotoUrl && setEnlargedPhoto(originalPhotoUrl)}
                          className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border border-slate-100 bg-slate-100 cursor-pointer shadow-sm group-hover:scale-105 transition-transform"
                        >
                          {photoUrl ? (
                            <img
                              src={getTransformedImageUrl(photoUrl)}
                              alt={commonName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Leaf className="w-6 h-6" />
                            </div>
                          )}
                          {isTop1 && (
                            <div className="absolute top-0 left-0 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br-lg">
                              TOP 1
                            </div>
                          )}
                        </div>

                        {/* 名稱與細節 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <h5 className="text-sm font-bold text-slate-800 truncate">
                              {commonName}
                            </h5>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium capitalize">
                              {taxon.rank || 'species'}
                            </span>
                          </div>

                          <p className="text-xs italic text-slate-500 truncate mb-1">
                            {scientificName}
                          </p>

                          {/* 相似度分數條 */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${score >= 70 ? 'bg-emerald-500' : score >= 30 ? 'bg-amber-400' : 'bg-slate-400'
                                  }`}
                                style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md ${scoreColorClass}`}>
                              {score}%
                            </span>
                          </div>
                        </div>

                        {/* 動作按鈕 */}
                        <div className="shrink-0 flex items-center gap-1">
                          <button
                            onClick={() => handleViewSpecies(taxon)}
                            disabled={navigatingTaxonId === taxon.id}
                            className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
                            title={isZh ? '檢視物種詳情' : 'View Species'}
                          >
                            {navigatingTaxonId === taxon.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                            ) : (
                              <>
                                <span>{isZh ? '檢視' : 'View'}</span>
                                <ChevronRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer 區塊 */}
          <div className="px-6 py-3 bg-white border-t border-slate-100 flex items-center justify-center text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Powered by iNaturalist Computer Vision</span>
            </div>
          </div>
        </motion.div>

        {/* 大圖查看 Modal (Lightbox) */}
        {enlargedPhoto && (
          <div
            onClick={() => setEnlargedPhoto(null)}
            className="fixed inset-0 z-[120] bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <img
              src={getTransformedImageUrl(enlargedPhoto)}
              alt="Enlarged view"
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
