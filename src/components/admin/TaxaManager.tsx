'use client';

import { useLanguage } from '@/context/LanguageContext';
import { Package } from 'lucide-react';

export default function TaxaManager() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
        <Package className="w-10 h-10 text-emerald-600" />
      </div>
      <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('admin.taxa_manager')}</h3>
      <p className="text-slate-500 max-w-md">
        物種庫管理功能開發中，未來將支援批次導入、資料校對與分類系統調整。
      </p>
    </div>
  );
}
