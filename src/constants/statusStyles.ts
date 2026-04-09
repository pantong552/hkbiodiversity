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
  'Extinct': {
    label: { zh: '絕滅 (EX)', en: 'Extinct' },
    styles: 'bg-black border-slate-800 text-white',
  },
  'Extinct in the Wild': {
    label: { zh: '野外絕滅 (EW)', en: 'Extinct in the Wild' },
    styles: 'bg-slate-900 border-slate-700 text-white',
  },
  'Critically Endangered': {
    label: { zh: '極危 (CR)', en: 'Critically Endangered' },
    styles: 'bg-red-600 border-red-700 text-white',
  },
  'Endangered': {
    label: { zh: '瀕危 (EN)', en: 'Endangered' },
    styles: 'bg-rose-500 border-rose-600 text-white',
  },
  'Vulnerable': {
    label: { zh: '易危 (VU)', en: 'Vulnerable' },
    styles: 'bg-orange-500 border-orange-600 text-white',
  },
  'Near Threatened': {
    label: { zh: '近危 (NT)', en: 'Near Threatened' },
    styles: 'bg-amber-400 border-amber-500 text-amber-950',
  },
  'Least Concern': {
    label: { zh: '無危 (LC)', en: 'Least Concern' },
    styles: 'bg-emerald-500 border-emerald-600 text-white',
  },
  'Data Deficient': {
    label: { zh: '數據缺乏 (DD)', en: 'Data Deficient' },
    styles: 'bg-slate-400 border-slate-500 text-white',
  },
  'Not Evaluated': {
    label: { zh: '未評估 (NE)', en: 'Not Evaluated' },
    styles: 'bg-slate-300 border-slate-400 text-slate-700',
  },
};

// Default style for unknown statuses
export const DEFAULT_IUCN_STYLE: IUCNStatusConfig = {
  label: { zh: '未知', en: 'Unknown' },
  styles: 'bg-slate-200 border-slate-300 text-slate-500',
};

export const getIUCNConfig = (status: string): IUCNStatusConfig => {
  return IUCN_CONFIG[status] || {
    ...DEFAULT_IUCN_STYLE,
    label: { zh: status, en: status }
  };
};
