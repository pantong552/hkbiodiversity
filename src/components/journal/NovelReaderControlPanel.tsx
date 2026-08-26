'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Minus, 
  Plus, 
  Play, 
  Pause, 
  Check, 
  AlignJustify, 
  Sliders, 
  ChevronUp, 
  ChevronDown,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface NovelReaderSettings {
  brightness: number; // 30 - 100
  fontSize: number; // 14 - 32
  lineHeight: 'compact' | 'normal' | 'spacious'; // 1.5, 2.0, 2.7
  theme: 'sepia' | 'green' | 'blue' | 'pink' | 'white' | 'dark';
  autoScroll: boolean;
  autoScrollSpeed: number; // 1 - 5
}

export const NOVEL_THEMES = {
  sepia: {
    id: 'sepia',
    name: '羊皮紙',
    bg: '#F5ECD7',
    color: '#3E2723',
    cardBg: '#EFE3CA',
    border: '#E2D3B3',
    previewBg: '#E8D4B0',
  },
  green: {
    id: 'green',
    name: '豆沙綠',
    bg: '#DDEEDD',
    color: '#183827',
    cardBg: '#D1E6D1',
    border: '#C3DEC3',
    previewBg: '#C3E6C3',
  },
  blue: {
    id: 'blue',
    name: '靜謐藍',
    bg: '#DCE8F5',
    color: '#1E293B',
    cardBg: '#D0E0F0',
    border: '#BFD4EB',
    previewBg: '#BFD9F2',
  },
  pink: {
    id: 'pink',
    name: '淡櫻粉',
    bg: '#F4DFDF',
    color: '#4A2E35',
    cardBg: '#EBD0D0',
    border: '#DEC2C2',
    previewBg: '#E6C4C4',
  },
  white: {
    id: 'white',
    name: '純淨白',
    bg: '#FFFFFF',
    color: '#1E293B',
    cardBg: '#F8FAFC',
    border: '#E2E8F0',
    previewBg: '#FFFFFF',
  },
  dark: {
    id: 'dark',
    name: '深邃灰',
    bg: '#181C22',
    color: '#F1F5F9', // 極高可讀性灰白色
    cardBg: '#222831',
    border: '#333D4B',
    previewBg: '#222831',
  },
};

export const DEFAULT_NOVEL_SETTINGS: NovelReaderSettings = {
  brightness: 100,
  fontSize: 18,
  lineHeight: 'normal',
  theme: 'sepia',
  autoScroll: false,
  autoScrollSpeed: 2,
};

interface NovelReaderControlPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  settings: NovelReaderSettings;
  onUpdateSettings: (newSettings: Partial<NovelReaderSettings>) => void;
}

export default function NovelReaderControlPanel({
  isOpen,
  onToggle,
  settings,
  onUpdateSettings,
}: NovelReaderControlPanelProps) {
  return (
    <>
      {/* 亮度遮罩層 (當亮度小於 100% 時覆蓋螢幕以降低刺眼度) */}
      {settings.brightness < 100 && (
        <div
          className="fixed inset-0 pointer-events-none z-[90] transition-opacity duration-200"
          style={{
            backgroundColor: '#000000',
            opacity: `${((100 - settings.brightness) / 100) * 0.75}`,
          }}
        />
      )}

      {/* 浮動觸發按鈕 (簡潔現代化圓形 Button) */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          onClick={onToggle}
          aria-label="打開閱讀設定面板"
          className="fixed bottom-6 right-6 z-[95] w-12 h-12 rounded-full shadow-2xl bg-white/95 text-slate-800 hover:text-emerald-600 hover:scale-110 active:scale-90 backdrop-blur-md border border-slate-200 shadow-slate-900/10 transition-all flex items-center justify-center cursor-pointer group"
          title="小說排版設定"
        >
          <Sliders className="w-5 h-5 text-slate-700 group-hover:text-emerald-600 transition-colors" />
        </motion.button>
      )}

      {/* 控制面板主體 (現代化 Light Style 底部抽屜 - 在 Mobile 與 Tablet 維持精準緊湊排版) */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 背景點擊遮罩 (點擊空白處關閉控制面板) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggle}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-[98] touch-none"
            />

            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 70 || info.velocity.y > 200) {
                  onToggle();
                }
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 z-[99] max-w-md sm:max-w-lg mx-auto bg-white/98 backdrop-blur-2xl rounded-t-[2rem] shadow-2xl border-t border-slate-200/90 px-5 py-4 pb-7 text-slate-800 select-none space-y-4 touch-manipulation cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 頂部收合拖拉條指示器 */}
              <div 
                className="w-full flex justify-center -mt-2 pb-1.5 cursor-grab active:cursor-grabbing touch-none"
                onClick={onToggle}
              >
                <div className="w-10 h-1 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors" />
              </div>

              {/* 第一行：亮度與自動閱讀 (Brightness & Auto Read) */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1">
                  <span className="text-xs font-bold text-slate-500 shrink-0">亮度</span>
                  <Sun className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="relative flex-1 flex items-center">
                    <input
                      type="range"
                      min="30"
                      max="100"
                      value={settings.brightness}
                      onChange={(e) => onUpdateSettings({ brightness: Number(e.target.value) })}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>
                  <Sun className="w-5 h-5 text-slate-600 shrink-0" />
                </div>

                <div className="h-5 w-px bg-slate-200 mx-0.5" />

                {/* 自動閱讀開關按鈕 (Light Style) */}
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ autoScroll: !settings.autoScroll })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    settings.autoScroll
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {settings.autoScroll ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>暫停閱讀</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current text-emerald-600" />
                      <span>自動閱讀</span>
                    </>
                  )}
                </button>
              </div>

              {/* 第二行：字號調節 (Font Size Adjuster - Light Style) */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500 shrink-0">字號</span>
                
                <div className="flex items-center gap-2.5 flex-1 max-w-[280px]">
                  <div className="flex items-center bg-slate-50 rounded-2xl p-0.5 border border-slate-200 flex-1 justify-between shadow-inner">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ fontSize: Math.max(14, settings.fontSize - 2) })}
                      disabled={settings.fontSize <= 14}
                      className="w-9 h-7 rounded-xl flex items-center justify-center text-slate-700 hover:bg-white hover:text-emerald-700 shadow-sm transition-all disabled:opacity-30 cursor-pointer"
                      title="縮小字體"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-sm font-black font-mono px-2 text-slate-800">
                      {settings.fontSize}
                    </span>

                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ fontSize: Math.min(32, settings.fontSize + 2) })}
                      disabled={settings.fontSize >= 32}
                      className="w-9 h-7 rounded-xl flex items-center justify-center text-slate-700 hover:bg-white hover:text-emerald-700 shadow-sm transition-all disabled:opacity-30 cursor-pointer"
                      title="放大字體"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ fontSize: DEFAULT_NOVEL_SETTINGS.fontSize })}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition-colors cursor-pointer shrink-0"
                  >
                    預設
                  </button>
                </div>
              </div>

              {/* 第三行：行距排版 (Line-Height Spacing - Light Style) */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500 shrink-0">間距</span>
                
                <div className="flex items-center gap-2 flex-1 max-w-[280px]">
                  {/* 緊湊 */}
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ lineHeight: 'compact' })}
                    className={`flex-1 py-1.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                      settings.lineHeight === 'compact'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                    title="緊湊行高 (1.5x)"
                  >
                    <div className="flex flex-col gap-0.5 items-center w-4">
                      <div className="w-full h-0.5 bg-current rounded-full" />
                      <div className="w-3/4 h-0.5 bg-current rounded-full" />
                      <div className="w-full h-0.5 bg-current rounded-full" />
                      <div className="w-2/3 h-0.5 bg-current rounded-full" />
                    </div>
                  </button>

                  {/* 適中 (預設) */}
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ lineHeight: 'normal' })}
                    className={`flex-1 py-1.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                      settings.lineHeight === 'normal'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                    title="標準行高 (2.0x)"
                  >
                    <div className="flex flex-col gap-1 items-center w-4">
                      <div className="w-full h-0.5 bg-current rounded-full" />
                      <div className="w-3/4 h-0.5 bg-current rounded-full" />
                      <div className="w-full h-0.5 bg-current rounded-full" />
                    </div>
                  </button>

                  {/* 寬鬆 */}
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ lineHeight: 'spacious' })}
                    className={`flex-1 py-1.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                      settings.lineHeight === 'spacious'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                    title="寬鬆行高 (2.7x)"
                  >
                    <div className="flex flex-col gap-1.5 items-center w-4">
                      <div className="w-full h-0.5 bg-current rounded-full" />
                      <div className="w-4/5 h-0.5 bg-current rounded-full" />
                    </div>
                  </button>
                </div>
              </div>

              {/* 第四行：六款護眼主題背景配色 (Theme Backgrounds) */}
              <div className="flex items-center justify-between gap-3 pt-0.5">
                <span className="text-xs font-bold text-slate-500 shrink-0">背景</span>
                
                <div className="flex items-center gap-2.5 flex-1 justify-between max-w-[280px]">
                  {Object.values(NOVEL_THEMES).map((theme) => {
                    const isSelected = settings.theme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => onUpdateSettings({ theme: theme.id as any })}
                        className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl transition-all shadow-sm border flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-emerald-600 ring-offset-2 scale-105 shadow-md border-emerald-600'
                            : 'border-slate-200 hover:scale-105'
                        }`}
                        style={{ backgroundColor: theme.previewBg }}
                        title={theme.name}
                      >
                        {isSelected && (
                          <Check className={`w-3.5 h-3.5 stroke-[3] ${theme.id === 'dark' ? 'text-white' : 'text-emerald-800'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
