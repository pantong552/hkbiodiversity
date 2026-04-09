import React from 'react';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Shield, ChevronRight } from 'lucide-react';

interface TaxonomyDisplayProps {
  species: Species;
}

export default function TaxonomyDisplay({ species }: TaxonomyDisplayProps) {
  const { language } = useLanguage();

  const levels = [
    { label: language === 'zh' ? '門' : 'Phylum', name: language === 'zh' ? species.phylum_chi : species.phylum_eng },
    { label: language === 'zh' ? '綱' : 'Class', name: language === 'zh' ? species.class_chi : species.class_eng },
    { label: language === 'zh' ? '目' : 'Order', name: language === 'zh' ? species.order_chi : species.order_eng },
    { label: language === 'zh' ? '科' : 'Family', name: language === 'zh' ? species.family_chi : species.family_eng },
    { label: language === 'zh' ? '屬' : 'Genus', name: language === 'zh' ? species.genus_chi : species.genus_eng },
  ];

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
        <Shield className="w-4 h-4 text-emerald-500" />
        {language === 'zh' ? '分類學資料' : 'Taxonomy Information'}
      </h3>
      
      <div className="flex flex-wrap items-center gap-y-4">
        {levels.map((level, idx) => (
          <React.Fragment key={idx}>
            <div className="flex flex-col px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 min-w-[100px] transition-all hover:bg-emerald-50 hover:border-emerald-100 group">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5 group-hover:text-emerald-500">
                {level.label}
              </span>
              <span className="text-sm font-black text-slate-700 truncate group-hover:text-emerald-900">
                {level.name || '-'}
              </span>
            </div>
            {idx < levels.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-300 mx-1 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
