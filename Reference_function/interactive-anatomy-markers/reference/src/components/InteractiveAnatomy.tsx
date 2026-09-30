"use client";
 
import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import illustrationUrls from "@/data/illustrationUrls.json";
import { AnatomyHotspotItem } from "@/types/species";
import { getOptimizedImageUrl } from "@/lib/cloudinary";
 
interface InteractiveAnatomyProps {
  speciesCode: string;
  lang: "zh" | "en";
  hotspots?: AnatomyHotspotItem[];
}
 
export default function InteractiveAnatomy({ speciesCode, lang, hotspots = [] }: InteractiveAnatomyProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalHeight > img.naturalWidth) {
      setIsPortrait(true);
    }
  };
 
  // 1. 取得該物種的底圖路徑，優先使用 illustrationUrls 中的 Cloudinary 插圖，否則 fallback 至本地圖片
  const illustrations = (illustrationUrls as Record<string, string | null>)[speciesCode];
  const bgImage = illustrations || (
    speciesCode === "cynopterus_sphinx" 
      ? "/images/cynopterus_sphinx_anatomy.png" 
      : "/images/hipposideros_armiger_anatomy.png"
  );
 
  // 2. 處理點擊圖片與空白處 deselect marker 邏輯，同時保留開發模式坐標打印 (Dev Only)
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    setActiveKey(null);
    setHoveredKey(null);
    if (process.env.NODE_ENV !== "production") {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      console.log(`💡 [InteractiveAnatomy Dev] Clicked position - x: ${x.toFixed(1)}%, y: ${y.toFixed(1)}%`);
    }
  };
 
  const currentKey = hoveredKey || activeKey;
  const currentHotspot = hotspots.find(hs => hs.key === currentKey);
 
  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* CSS 動態脈衝呼吸燈樣式 */}
      <style jsx global>{`
        @keyframes pulse-ring-idle {
          0% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
        @keyframes pulse-ring-active {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: scale(2.0);
            opacity: 0;
          }
        }
        .marker-pulse-idle {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 1px solid var(--color-primary-accent, #ea580c);
          animation: pulse-ring-idle 2.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          pointer-events: none;
        }
        .marker-pulse-active {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 1.5px solid var(--color-primary-accent, #ea580c);
          animation: pulse-ring-active 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          pointer-events: none;
        }
      `}</style>
  
      {/* 全寬大圖容器，在 desktop 限制 max-w-[700px]，若是直圖則加寬並置中圖片 */}
      <div
        onClick={handleImageClick}
        className={`relative bg-white border border-border-custom/30 rounded-3xl overflow-hidden flex items-center justify-center p-0 cursor-crosshair group shadow-lg w-full md:max-w-[700px] ${
          isPortrait ? "md:w-[700px] md:h-[550px]" : "w-fit"
        }`}
      >
        {/* 內層 w-fit h-fit 容器，物理尺寸與 img 實際顯示大小完全一致，確保百分比 marker 坐標絕不偏位 */}
        <div className="relative w-fit h-fit flex items-center justify-center">
          {/* 蝙蝠手繪插畫底圖 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getOptimizedImageUrl(bgImage)}
            onLoad={handleImageLoad}
            alt="Bat Illustration"
            className="max-w-full max-h-[350px] md:max-h-[550px] w-auto h-auto object-contain select-none pointer-events-none transition-transform duration-500 group-hover:scale-[1.01]"
          />
  
          {/* 繪製每一個互動 Hotspot */}
          {hotspots.map((hs) => {
            const isHovered = hoveredKey === hs.key;
            const isActive = activeKey === hs.key;
            const isSelected = isHovered || isActive;
  
            return (
              <div
                key={hs.key}
                style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group/marker"
                onMouseEnter={() => setHoveredKey(hs.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={(e) => {
                  e.stopPropagation(); // 阻斷冒泡至圖片容器引發 deselect
                  setActiveKey(activeKey === hs.key ? null : hs.key);
                }}
              >
                <button
                  type="button"
                  className={`relative w-3.5 h-3.5 md:w-4.5 md:h-4.5 rounded-full flex items-center justify-center font-bold shadow-md transition-all duration-300 ${
                    isSelected
                      ? "bg-primary-accent text-white scale-110 ring-2 ring-primary-accent/20"
                      : "bg-white text-slate-800 hover:bg-primary-accent hover:text-white border border-slate-200"
                  }`}
                >
                  {/* 呼吸燈特效：選中或 hover 時使用 active 脈衝，平常使用輕微 idle 脈衝 */}
                  {isSelected ? (
                    <span className="marker-pulse-active" />
                  ) : (
                    <span className="marker-pulse-idle" />
                  )}
                  <span className="relative z-10 text-[7px] md:text-[9px] font-black leading-none">+</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
 
      {/* 容器外底部 Tooltip (在任何螢幕大小下均置於下方，不遮擋圖片) */}
      {currentHotspot && (
        <div className="w-full max-w-[700px] mt-4 p-4 bg-slate-900/90 dark:bg-black/85 backdrop-blur-md border border-white/10 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-1.5 mb-1.5 border-b border-white/10 pb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-accent animate-ping" />
            <span className="text-xs font-bold text-primary-accent uppercase tracking-wider">
              {lang === "zh" ? "特徵部位說明" : "Morphological Description"}
            </span>
          </div>
          <p 
            dangerouslySetInnerHTML={{ __html: lang === "zh" ? currentHotspot.zh : currentHotspot.en }} 
            className="text-xs text-white/90 leading-relaxed prose-strong:text-primary-accent prose-strong:font-bold"
          />
        </div>
      )}
 
      <p className="text-[10px] text-muted-accent mt-3 flex items-center gap-1 justify-center w-full">
        <HelpCircle className="w-3.5 h-3.5 text-muted-accent/60" />
        <span>
          {lang === "zh"
            ? "將滑鼠懸停 (Hover) 或點擊圖片上的圓圈標記，即可檢視該部位的外形特徵說明"
            : "Hover or click on the markers to view morphological details of the body part"}
        </span>
      </p>
    </div>
  );
}
