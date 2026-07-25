'use client';

import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, FolderPlus, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EcoCategory } from '@/types/journal';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';

interface CategoryAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: EcoCategory[];
  onRefresh: () => void;
}

export default function CategoryAdminModal({
  isOpen,
  onClose,
  categories,
  onRefresh,
}: CategoryAdminModalProps) {
  const { language, t } = useLanguage();
  const [editingCategory, setEditingCategory] = useState<EcoCategory | null>(null);
  const [nameChi, setNameChi] = useState('');
  const [nameEng, setNameEng] = useState('');
  const [slug, setSlug] = useState('');
  const [sortOrder, setSortOrder] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEditClick = (cat: EcoCategory) => {
    setEditingCategory(cat);
    setNameChi(cat.name_chi);
    setNameEng(cat.name_eng);
    setSlug(cat.slug);
    setSortOrder(cat.sort_order || 0);
    setErrorMsg(null);
  };

  const handleResetForm = () => {
    setEditingCategory(null);
    setNameChi('');
    setNameEng('');
    setSlug('');
    setSortOrder(categories.length + 1);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameChi.trim() || !nameEng.trim() || !slug.trim()) {
      setErrorMsg(language === 'zh' ? '請填寫中文名、英文名與 Slug' : 'Please fill in Chinese name, English name, and Slug.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('eco_categories')
          .update({
            name_chi: nameChi.trim(),
            name_eng: nameEng.trim(),
            slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
            sort_order: sortOrder,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('eco_categories')
          .insert([
            {
              name_chi: nameChi.trim(),
              name_eng: nameEng.trim(),
              slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
              sort_order: sortOrder,
            },
          ]);

        if (error) throw error;
      }

      handleResetForm();
      onRefresh();
    } catch (err: any) {
      console.error('Error saving category:', err);
      setErrorMsg(err.message || 'Failed to save category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === 'zh' ? '確定要刪除此分類嗎？關聯文章可能受到影響。' : 'Are you sure to delete this category?')) return;
    try {
      const { error } = await supabase.from('eco_categories').delete().eq('id', id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-emerald-900 to-teal-950 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15">
                <FolderPlus className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  {language === 'zh' ? '生態誌分類管理' : 'Manage Eco-Journal Categories'}
                </h3>
                <p className="text-xs text-emerald-200/80">
                  {language === 'zh' ? '新增、修改或排序生態誌文章的展示分類' : 'Add, edit, or reorder categories'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Category Form */}
            <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span>{editingCategory ? (language === 'zh' ? '編輯分類' : 'Edit Category') : (language === 'zh' ? '新增分類' : 'Add New Category')}</span>
                {editingCategory && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="text-xs text-emerald-600 font-normal hover:underline"
                  >
                    {language === 'zh' ? '切換回新增模式' : 'Switch to Add Mode'}
                  </button>
                )}
              </h4>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {t('journal.category_name_chi')} *
                  </label>
                  <input
                    type="text"
                    value={nameChi}
                    onChange={(e) => setNameChi(e.target.value)}
                    placeholder="例: 生物多樣性研究"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-slate-800 text-sm focus:border-emerald-500 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {t('journal.category_name_eng')} *
                  </label>
                  <input
                    type="text"
                    value={nameEng}
                    onChange={(e) => setNameEng(e.target.value)}
                    placeholder="e.g. Biodiversity Research"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-slate-800 text-sm focus:border-emerald-500 bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {t('journal.category_slug')} *
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. biodiversity-research"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-slate-800 text-sm focus:border-emerald-500 bg-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {language === 'zh' ? '排序 Order' : 'Sort Order'}
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-slate-800 text-sm focus:border-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Saving...' : (editingCategory ? (language === 'zh' ? '儲存修改' : 'Save Changes') : t('journal.add_category'))}
                </button>
              </div>
            </form>

            {/* Existing Categories List */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                {language === 'zh' ? '現有分類列表' : 'Existing Categories'} ({categories.length})
              </h4>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-200 bg-white shadow-sm transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800">{cat.name_chi}</span>
                        <span className="text-xs text-slate-400 font-normal">({cat.name_eng})</span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">
                        slug: {cat.slug}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditClick(cat)}
                        className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
