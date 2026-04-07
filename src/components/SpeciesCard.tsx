import Image from 'next/image';
import { Leaf, AlertCircle, Bookmark, Compass, Heart } from 'lucide-react';
import { Species } from '../types/species';

export default function SpeciesCard({ species }: { species: Species }) {
  // Determine badge color based on rarity
  const rarityColors: Record<string, string> = {
    '極危': 'bg-rose-500 text-white border-rose-600',
    '瀕危': 'bg-orange-500 text-white border-orange-600',
    '易危': 'bg-amber-500 text-white border-amber-600',
    '常見': 'bg-emerald-500 text-white border-emerald-600',
    '近危': 'bg-indigo-500 text-white border-indigo-600',
  };
  const rarityClass = rarityColors[species.rarity] || 'bg-slate-500 text-white border-slate-600';

  return (
    <div className="group relative bg-white rounded-[2.5rem] border border-slate-200/50 overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-2 transition-all duration-500 flex flex-col">
      {/* Image Container with Overlay */}
      <div className="relative h-72 overflow-hidden bg-slate-100">
        <Image
          src={species.image_url}
          alt={species.common_name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Rarity & Save Badges Overlay */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10">
          <span className={`
            px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg border
            ${rarityClass}
          `}>
            {species.rarity}
          </span>
          <button className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-white/50 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white transition-all cursor-pointer">
            <Heart className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-8 pb-10 flex-1 flex flex-col">
        <div className="mb-6">
          <h3 className="text-2xl font-black text-slate-900 mb-1 group-hover:text-emerald-600 transition-colors">
            {species.common_name}
          </h3>
          <p className="text-sm italic font-medium text-slate-400 font-serif tracking-wide">
            {species.scientific_name}
          </p>
        </div>

        {/* Taxonomy Tags - Minimalist & Nature-inspired */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[species.kingdom, species.phylum, species.class].map((tax, i) => (
            <span key={i} className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 rounded-xl border border-slate-100 group-hover:border-emerald-100 group-hover:bg-emerald-50/50 transition-all">
              {tax.split(' ')[0]}
            </span>
          ))}
        </div>

        {/* Action Footer */}
        <div className="mt-auto flex items-center justify-between pt-6 border-t border-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {species.conservation_status}
            </span>
          </div>
          <button className="text-emerald-600 font-black text-xs uppercase tracking-widest hover:translate-x-1 transition-transform cursor-pointer">
            View Details →
          </button>
        </div>
      </div>
    </div>
  );
}
