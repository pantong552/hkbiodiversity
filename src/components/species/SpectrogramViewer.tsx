'use client';

import React, { useRef, useState, useEffect } from 'react';

interface SpectrogramViewerProps {
  sonoImgUrl: string;
  recId: string;
  /** 外部 audio element ref，SpectrogramViewer 用自己的 rAF 直接讀取 */
  audioElementRef: React.MutableRefObject<HTMLAudioElement | null>;
  language: string;
}

export function SpectrogramViewer({
  sonoImgUrl,
  recId,
  audioElementRef,
  language
}: SpectrogramViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const whiteLineRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const isMouseDownRef = useRef(false);
  useEffect(() => {
    isMouseDownRef.current = isMouseDown;
  }, [isMouseDown]);

  // 自己的 rAF 迴圈，直接從 audio element 讀取 currentTime，零 React state 更新
  useEffect(() => {
    let animFrameId: number;

    const tick = () => {
      const audio = audioElementRef.current;
      const line = whiteLineRef.current;
      const container = containerRef.current;

      if (audio && line && isFinite(audio.duration) && audio.duration > 0) {
        if (audio.ended || audio.currentTime >= audio.duration) {
          line.style.left = '0%';
          if (container && !isMouseDownRef.current) {
            container.scrollLeft = 0;
          }
        } else {
          const pct = Math.min(100, Math.max(0, (audio.currentTime / audio.duration) * 100));
          line.style.left = `${pct}%`;

          // 在播放時自動滾動容器，使 whiteLineRef 始終居中
          if (container && !isMouseDownRef.current) {
            const linePixelPos = (pct / 100) * container.scrollWidth;
            const containerWidth = container.clientWidth;
            const targetScrollLeft = linePixelPos - containerWidth / 2;
            container.scrollLeft = Math.max(0, targetScrollLeft);
          }
        }
        line.style.opacity = '1';
      }
      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameId);
  }, [audioElementRef]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsMouseDown(true);
    startXRef.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeftRef.current = containerRef.current.scrollLeft;
  };

  const handleMouseLeave = () => setIsMouseDown(false);
  const handleMouseUp = () => setIsMouseDown(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    containerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{language === 'zh' ? '聲譜圖' : 'Spectrogram'}</span>
        </span>
      </div>

      {/* Scrollable & Draggable Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className={`bg-slate-950 p-2 rounded-xl border border-slate-800 overflow-x-auto custom-scrollbar relative select-none ${
          isMouseDown ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div className="relative inline-block min-w-full">
          <img
            src={sonoImgUrl}
            alt={`Full Spectrogram for XC${recId}`}
            className="w-auto max-w-none block rounded-md pointer-events-none"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          {/* White Vertical Progress Line — updated purely via rAF, no React re-render */}
          <div
            ref={whiteLineRef}
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] z-20 pointer-events-none opacity-0"
            style={{ left: '0%' }}
          >
            <div className="w-2 h-2 rounded-full bg-white -ml-0.75 -mt-1 shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
