'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Info, Link as LinkIcon, Shield, X } from 'lucide-react';

interface BgisAttributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
}

const content = {
  zh: {
    title: 'BGIS / HKBIH 資料來源與條款聲明',
    dataSourceLabel: '資料來源：',
    dataSourceText: '香港特別行政區政府漁農自然護理署；香港生物多樣性資訊站 - 生物多樣性地理信息系統',
    ipOwnerLabel: '資料的知識產權擁有人：',
    ipOwnerText: '香港特別行政區政府漁農自然護理署',
    websiteLabel: '官方網站連結：',
    termsTitle: '根據 BGIS 條款及細則第 3 條使用：',
    termsSub: '你可免費瀏覽、下載、分發、複製和列印有關資料，以及為有關資料建立超連結，作非商業用途，惟須遵守以下條件：',
    term1: '你必須遵守本使用條款；',
    term2: '你必須在有關資料及其所有複製本(包括但不限於紙張複製本、數碼複製本及載於其他網站的複製本)上清楚註明政府及BGIS/HKBIH為資料來源並確認政府及有關機構為該等資料的知識產權擁有人；以及',
    term3: '你必須就因你直接或間接使用、複製及／或分發有關資料而引起任何有關侵犯他人權利的指稱或申索，以及政府及有關機構所涉及的費用、損失、損害及法律責任，向政府及有關機構作出彌償。',
    close: '關閉',
    visit: '開啟連結'
  },
  en: {
    title: 'BGIS / HKBIH Data Attribution & Terms',
    dataSourceLabel: 'Data Source:',
    dataSourceText: 'Agriculture, Fisheries and Conservation Department, The Government of the Hong Kong Special Administrative Region; Hong Kong Biodiversity Information Hub - Biodiversity Geographic Information System',
    ipOwnerLabel: 'Intellectual Property Rights Owner:',
    ipOwnerText: 'Agriculture, Fisheries and Conservation Department, The Government of the Hong Kong Special Administrative Region',
    websiteLabel: 'Official Website Link:',
    termsTitle: 'Used under Clause 3 of BGIS Terms of Use:',
    termsSub: 'You are allowed to browse, export reports, distribute, reproduce, hyperlink to and print the Data for non-commercial purposes on a free-of charge basis under the condition that:',
    term1: 'you shall comply with the Terms of Use;',
    term2: 'you shall identify clearly the Government and the BGIS/HKBIH as the source of the Data and acknowledge the Government and the relevant organisations\' ownership of the intellectual property rights in the Data and in all copies thereof including but not limited to paper copies, digital copies and copies placed on other websites; and',
    term3: 'you shall indemnify the Government and the relevant organisations against any allegations or claims of infringement of the rights of any person and all costs, losses, damages and liabilities incurred by the Government and the relevant organisations, which arise directly or indirectly in relation to your use, reproduction and/or distribution of the Data.',
    close: 'Close',
    visit: 'Visit Site'
  }
};

export default function BgisAttributionModal({ isOpen, onClose, language }: BgisAttributionModalProps) {
  const isChinese = language === 'zh';
  const t = content[isChinese ? 'zh' : 'en'];
  const websiteUrl = isChinese
    ? 'https://bih.gov.hk/tc/bgis/index.html'
    : 'https://bih.gov.hk/en/bgis/index.html';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col"
          >
            <div className="p-5 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
                  <Info className="w-5 h-5 text-emerald-100" />
                </div>
                <div>
                  <h3 className="font-black text-base md:text-lg tracking-tight">{t.title}</h3>
                  <p className="text-emerald-100/80 text-xs font-mono">BGIS / HKBIH Terms &amp; Data Attribution</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.close}
                className="p-2 hover:bg-white/20 rounded-full transition-colors text-white/90 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-700 text-sm custom-scrollbar">
              <div className="grid grid-cols-1 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <div>
                  <span className="font-bold block mb-1 text-xs uppercase tracking-wider text-emerald-700">{t.dataSourceLabel}</span>
                  <p className="text-slate-700 font-medium leading-relaxed">{t.dataSourceText}</p>
                </div>
                <div className="pt-3 border-t border-slate-200/60">
                  <span className="font-bold block mb-1 text-xs uppercase tracking-wider text-emerald-700">{t.ipOwnerLabel}</span>
                  <p className="text-slate-700 font-medium leading-relaxed">{t.ipOwnerText}</p>
                </div>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200/60 p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="font-bold text-emerald-950 text-xs block mb-0.5">{t.websiteLabel}</span>
                  <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-emerald-700 hover:text-emerald-800 underline truncate block">
                    {websiteUrl}
                  </a>
                </div>
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex-shrink-0 cursor-pointer"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>{t.visit}</span>
                </a>
              </div>

              <div className="space-y-3 pt-1">
                <h4 className="font-black text-slate-900 text-sm md:text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  {t.termsTitle}
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 italic">{t.termsSub}</p>
                <ul className="space-y-2.5 text-xs text-slate-600 pl-1">
                  {[t.term1, t.term2, t.term3].map(term => (
                    <li key={term} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span>{term}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-sm"
              >
                {t.close}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
