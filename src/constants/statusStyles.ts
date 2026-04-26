/**
 * IUCN Status configuration for consistent labeling and styling across the app.
 */

export interface IUCNStatusConfig {
  label: {
    zh: string;
    en: string;
  };
  styles: string; // Tailwind classes for background and border
  textStyles?: string; // Optional specific text color overrides
}

export const IUCN_CONFIG: Record<string, IUCNStatusConfig> = {
  'EX': {
    label: { zh: '絕滅 (EX)', en: 'EX' },
    styles: 'bg-black border-slate-800 text-white',
  },
  'EW': {
    label: { zh: '野外絕滅 (EW)', en: 'EW' },
    styles: 'bg-slate-900 border-slate-700 text-white',
  },
  'CR': {
    label: { zh: '極危 (CR)', en: 'CR' },
    styles: 'bg-red-600 border-red-700 text-white',
  },
  'EN': {
    label: { zh: '瀕危 (EN)', en: 'EN' },
    styles: 'bg-rose-500 border-rose-600 text-white',
  },
  'VU': {
    label: { zh: '易危 (VU)', en: 'VU' },
    styles: 'bg-orange-500 border-orange-600 text-white',
  },
  'NT': {
    label: { zh: '近危 (NT)', en: 'NT' },
    styles: 'bg-amber-400 border-amber-500 text-amber-950',
  },
  'LC': {
    label: { zh: '無危 (LC)', en: 'LC' },
    styles: 'bg-emerald-500 border-emerald-600 text-white',
  },
  'DD': {
    label: { zh: '數據缺乏 (DD)', en: 'DD' },
    styles: 'bg-slate-400 border-slate-500 text-white',
  },
  'NE': {
    label: { zh: '未評估 (NE)', en: 'NE' },
    styles: 'bg-slate-300 border-slate-400 text-slate-700',
  },
};

// Default style for unknown statuses
export const DEFAULT_IUCN_STYLE: IUCNStatusConfig = {
  label: { zh: '未知', en: 'Unknown' },
  styles: 'bg-slate-200 border-slate-300 text-slate-500',
};

// Map long names to shorthand for backward compatibility or different data sources
const LONG_TO_SHORT: Record<string, string> = {
  'Extinct': 'EX',
  'Extinct in the Wild': 'EW',
  'Critically Endangered': 'CR',
  'Endangered': 'EN',
  'Vulnerable': 'VU',
  'Near Threatened': 'NT',
  'Least Concern': 'LC',
  'Data Deficient': 'DD',
  'Not Evaluated': 'NE'
};

export const getIUCNConfig = (status: string): IUCNStatusConfig => {
  if (!status) return DEFAULT_IUCN_STYLE;
  
  const normalized = LONG_TO_SHORT[status] || status;
  return IUCN_CONFIG[normalized] || {
    ...DEFAULT_IUCN_STYLE,
    label: { zh: normalized, en: normalized }
  };
};
