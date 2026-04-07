import Image from 'next/image';
import { Leaf, AlertCircle, Bookmark, Compass } from 'lucide-react';
import { Species } from '../types/species';

export default function SpeciesCard({ species }: { species: Species }) {
  // Determine badge color based on rarity
  const rarityColors: Record<string, string> = {
    '極危': 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20',
    '瀕危': 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-500/20',
    '易危': 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20',
    '常見': 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20',
    '近危': 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-indigo-500/20',
  };
  const rarityClass = rarityColors[species.rarity] || 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-500/20';

  return (
    <div className="group cursor-pointer bg-white rounded-[2.5rem] overflow-hidden border border-cyan-100/50 shadow-sm hover:shadow-2xl hover:shadow-cyan-200/40 hover:-translate-y-2 transition-all duration-500 flex flex-col relative ring-1 ring-black/5 hover:ring-cyan-500/30">
      {/* Decorative Gradient Background (Hidden until hover) */}
      <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-cyan-50/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      {/* Image Container */}
      <div className="relative w-full aspect-[1/1] overflow-hidden bg-cyan-100/30">
        <Image
          src={species.image_url}
          alt={species.common_name}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        
        {/* Badges Overlay */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10 pointer-events-none">
          <div className={`px-4 py-1.5 text-xs font-black rounded-full border shadow-sm backdrop-blur-xl ring-1 ${rarityClass}`}>
            {species.rarity}
          </div>
          <button className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-white/50 flex items-center justify-center text-cyan-400 hover:text-cyan-600 hover:bg-white transition-all pointer-events-auto">
            <Bookmark className="w-5 h-5" fill="currentColor" fillOpacity="0.1" />
          </button>
        </div>

        {/* Taxonomy Quick Info */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-black/20 backdrop-blur-lg border border-white/20 px-3 py-2 rounded-2xl flex items-center gap-2 text-white/90 text-xs font-bold w-fit group-hover:bg-cyan-900/40 transition-colors">
            <Compass className="w-3.5 h-3.5" />
            {species.genus}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 pb-10 flex-1 flex flex-col relative">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
              {species.class}
            </span>
            <div className="w-1 h-1 rounded-full bg-cyan-200" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
              {species.order}
            </span>
          </div>
          <h3 className="text-2xl font-black text-cyan-950 leading-tight mb-2 group-hover:text-cyan-600 transition-colors">
            {species.common_name}
          </h3>
          <p className="text-sm italic font-medium text-cyan-600/70 serif">
            {species.scientific_name}
          </p>
        </div>

        <div className="mt-auto pt-6 flex items-center justify-between border-t border-cyan-50/50">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-cyan-400/60 uppercase">科 (Family)</span>
            <span className="text-sm font-bold text-cyan-800">{species.family.split(' (')[0]}</span>
          </div>
          <div className="h-8 w-px bg-cyan-50" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-cyan-400/60 uppercase">狀態</span>
            <div className="flex items-center gap-1.5 text-cyan-700 text-sm font-bold">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              {species.conservation_status.split(' (')[0]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
