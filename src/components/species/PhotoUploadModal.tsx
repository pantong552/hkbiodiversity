'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Upload, 
  User, 
  Clipboard, 
  CheckCircle2, 
  Loader2, 
  Image as ImageIcon,
  AlertCircle,
  FileImage,
  Camera,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  taxonId: string | number;
  onUploadSuccess?: () => void;
  language: 'zh' | 'en';
}

const LICENSES = [
  { id: 'CC BY', desc: 'Attribution' },
  { id: 'CC BY-SA', desc: 'ShareAlike' },
  { id: 'CC BY-ND', desc: 'NoDerivs' },
  { id: 'CC BY-NC', desc: 'NonComm' },
  { id: 'CC BY-NC-SA', desc: 'NonComm-SA' },
  { id: 'CC BY-NC-ND', desc: 'NonComm-ND' }
];

export default function PhotoUploadModal({ 
  isOpen, 
  onClose, 
  taxonId, 
  onUploadSuccess,
  language 
}: PhotoUploadModalProps) {
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [author, setAuthor] = useState('');
  const [license, setLicense] = useState('CC BY');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // 獲取當前用戶資訊
  useEffect(() => {
    const fetchUser = async () => {
      setIsCheckingAuth(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
          const name = user.user_metadata?.full_name || user.user_metadata?.display_name || '';
          setAuthor(name);
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };
    if (isOpen) fetchUser();
  }, [supabase, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(selectedFile.type)) {
      setError(language === 'zh' ? '僅支援 JPG, PNG, WEBP, AVIF 格式' : 'Only JPG, PNG, WEBP, AVIF formats are supported');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError(language === 'zh' ? '檔案大小不能超過 10MB' : 'File size should not exceed 10MB');
      return;
    }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setError(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, [language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;

    setIsUploading(true);
    setError(null);

    try {
      // 1. 產生自訂檔名：物種ID + 作者(取代空格為底線) + 時間戳記 (格式: YYYYMMDD_HHmmss)
      const now = new Date();
      const dateString = now.getFullYear() + 
        String(now.getMonth() + 1).padStart(2, '0') + 
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') + 
        String(now.getMinutes()).padStart(2, '0') + 
        String(now.getSeconds()).padStart(2, '0');

      const cleanAuthor = author.trim().replace(/\s+/g, '_');
      const customFilename = `${taxonId}_${cleanAuthor}_${dateString}`;

      // 2. 上傳至 Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
      formData.append('public_id', customFilename);
      
      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!cloudRes.ok) throw new Error('Cloudinary upload failed');
      const cloudData = await cloudRes.json();

      // 2. 儲存至 Supabase
      const { error: dbError } = await supabase
        .from('species_community_photos')
        .insert({
          taxa_id: taxonId.toString(),
          image_url: cloudData.secure_url,
          author_name: author,
          license: license,
          user_id: user.id,
          cloudinary_public_id: cloudData.public_id
        });

      if (dbError) throw dbError;

      setIsSuccess(true);
      
      // 1 秒後自動關閉並重新整理圖庫
      setTimeout(() => {
        handleClose();
        if (onUploadSuccess) onUploadSuccess();
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setIsSuccess(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={handleClose}
        >
          {/* 內容區域：根據狀態切換內容，但共用同一個彈窗容器 */}
          <motion.div 
            key="modal-content-container"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-3xl max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            {isCheckingAuth && !user ? (
              /* Loading 狀態 */
              <div key="state-loading" className="py-20 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
              </div>
            ) : !user && !isSuccess ? (
              /* 未登入警告 */
              <div key="state-auth-warning" className="p-8 sm:p-12 text-center">
                <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-amber-500 shadow-inner">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-3">
                  {language === 'zh' ? '請先登入' : 'Login Required'}
                </h3>
                <p className="text-slate-500 mb-8 font-medium leading-relaxed">
                  {language === 'zh' ? '只有登入成員可以分享觀察。請使用 Google 帳號登入系統。' : 'Only logged-in members can share observations. Please sign in with Google.'}
                </p>
                <button 
                  onClick={handleClose}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10 cursor-pointer"
                >
                  {language === 'zh' ? '返回' : 'Go Back'}
                </button>
              </div>
            ) : isSuccess ? (
              /* 成功提示 */
              <div key="state-success" className="py-20 flex flex-col items-center justify-center text-center px-8">
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-8 shadow-2xl shadow-emerald-500/40"
                >
                  <CheckCircle2 className="w-12 h-12" />
                </motion.div>
                <h4 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">
                  {language === 'zh' ? '感謝您的貢獻！' : 'Thank You!'}
                </h4>
                <p className="text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
                  {language === 'zh' ? '這張珍貴的照片已成功加入圖庫。' : 'Your observation has been added to our records.'}
                </p>
              </div>
            ) : (
              /* 主上傳表單 */
              <div key="state-form">
                {/* Header */}
                <div className="sticky top-0 bg-white/90 backdrop-blur-xl z-10 px-6 sm:px-10 py-5 sm:py-8 flex items-center justify-between border-b border-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 sm:w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                      <Camera className="w-5 h-5 sm:w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-2xl font-black text-slate-800 leading-none mb-1.5">
                        {language === 'zh' ? '提供相片' : 'Photo Gallery'}
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">
                          {language === 'zh' ? '貢獻社群觀察' : 'Community Contribution'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={handleClose}
                    className="p-2 sm:p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-600 active:scale-95 cursor-pointer"
                  >
                    <X className="w-5 h-5 sm:w-6 h-6" />
                  </button>
                </div>

                {/* Form Content */}
                <div className="p-6 sm:p-10">
                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="flex flex-col lg:grid lg:grid-cols-2 gap-10">
                      {/* 左側：上傳區 */}
                      <div className="space-y-5">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <FileImage className="w-4 h-4" />
                            {language === 'zh' ? '影像內容' : 'Media Content'}
                          </label>
                        </div>
                        
                        <div 
                          onDragOver={e => e.preventDefault()}
                          onDrop={onDrop}
                          onClick={() => !previewUrl && document.getElementById('file-upload')?.click()}
                          className={`relative aspect-[4/3] sm:aspect-square rounded-[2.5rem] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center overflow-hidden cursor-pointer group ${previewUrl ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 hover:border-emerald-400 bg-slate-50 shadow-inner'}`}
                        >
                          {previewUrl ? (
                            <>
                              <Image 
                                src={previewUrl} 
                                alt="Preview" 
                                fill 
                                className="object-cover"
                              />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setFile(null); setPreviewUrl(null); }}
                                  className="p-3 bg-white/90 rounded-2xl text-red-500 hover:bg-white transition-all shadow-xl active:scale-90 cursor-pointer"
                                >
                                  <X className="w-6 h-6" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="text-center p-8 space-y-4">
                              <div className="w-16 h-16 sm:w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center mx-auto text-emerald-500 group-hover:scale-110 transition-transform duration-300">
                                <Upload className="w-6 h-6 sm:w-8 h-8" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm sm:text-base font-black text-slate-800">
                                  {language === 'zh' ? '選擇或拖放照片' : 'Browse or Drop Image'}
                                </p>
                                <p className="text-[10px] sm:text-xs font-bold text-slate-400">
                                  JPG, WEBP, AVIF (Max 10MB)
                                </p>
                              </div>
                            </div>
                          )}
                          <input 
                            id="file-upload"
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleFileChange}
                          />
                        </div>
                      </div>

                      {/* 右側：欄位 */}
                      <div className="space-y-8">
                        {/* Author */}
                        <div className="space-y-4">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                            <User className="w-4 h-4 text-emerald-500" />
                            {language === 'zh' ? '拍攝者名稱' : 'Author Name'}
                          </label>
                          <div className="relative group">
                            <input 
                              type="text" 
                              required
                              value={author}
                              onChange={e => setAuthor(e.target.value)}
                              placeholder={language === 'zh' ? '輸入名字' : 'Your name'}
                              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all outline-none"
                            />
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                          </div>
                        </div>

                        {/* License */}
                        <div className="space-y-4">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            {language === 'zh' ? '使用授權' : 'License Terms'}
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {LICENSES.map(l => (
                              <button
                                key={`license-${l.id.replace(/\s+/g, '-')}`}
                                type="button"
                                onClick={() => setLicense(l.id)}
                                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group/btn cursor-pointer ${license === l.id ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20' : 'bg-white border-slate-100 text-slate-500 hover:border-emerald-200'}`}
                              >
                                <p className={`text-xs font-black mb-0.5 ${license === l.id ? 'text-white' : 'text-slate-800'}`}>{l.id}</p>
                                <p className={`text-[9px] font-bold uppercase tracking-widest ${license === l.id ? 'text-white/70' : 'text-slate-400'}`}>{l.desc}</p>
                                {license === l.id && (
                                  <motion.div layoutId="active-license-tick" className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </motion.div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <motion.div 
                        key="form-error"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-red-50 rounded-2xl flex items-center gap-3 text-red-500 text-sm font-black border border-red-100"
                      >
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                      </motion.div>
                    )}

                    {/* Footer Actions */}
                    <div className="pt-6 flex flex-col sm:flex-row gap-4">
                      <button 
                        type="button"
                        onClick={handleClose}
                        className="order-2 sm:order-1 flex-1 py-5 bg-slate-50 text-slate-500 rounded-2xl font-black hover:bg-slate-100 transition-all active:scale-95 cursor-pointer"
                      >
                        {language === 'zh' ? '取消' : 'Cancel'}
                      </button>
                      <button 
                        type="submit"
                        disabled={!file || !author || isUploading}
                        className="order-1 sm:order-2 flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-2xl shadow-emerald-600/30 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-3 group cursor-pointer"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            {language === 'zh' ? '正在傳送...' : 'Sending...'}
                          </>
                        ) : (
                          <>
                            <span>{language === 'zh' ? '立即發佈相片' : 'Publish Photo Now'}</span>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Mobile Home Indicator Spacing */}
            <div className="h-10 sm:hidden" />
          </motion.div>
        </motion.div>
      )}
      
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </AnimatePresence>
  );
}
