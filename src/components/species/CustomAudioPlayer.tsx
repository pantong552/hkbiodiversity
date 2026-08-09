'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Loader2, Activity } from 'lucide-react';

interface CustomAudioPlayerProps {
  src: string;
  autoPlay?: boolean;
  /** 傳入 ref 物件，CustomAudioPlayer 會直接寫入 audio element，讓外部組件用自己的 rAF 讀取 */
  audioElementRef?: React.MutableRefObject<HTMLAudioElement | null>;
  /** 聲譜圖顯示狀態 */
  showSpectrogram?: boolean;
  /** 切換聲譜圖面板顯示 */
  onToggleSpectrogram?: () => void;
}

export function CustomAudioPlayer({
  src,
  autoPlay = true,
  audioElementRef,
  showSpectrogram = false,
  onToggleSpectrogram
}: CustomAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const isDraggingRef = useRef(false);

  // DOM refs for 60fps direct updates (no re-render during playback)
  const fillLineRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const formattedTimeRef = useRef<HTMLSpanElement | null>(null);

  // 1. Fetch to Blob URL
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setDownloadError(null);

    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (isCancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setIsLoading(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        setDownloadError(err.message || 'Download failed');
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src]);

  // 2. Bind audio events — only React state updates for play/pause/end/metadata
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !blobUrl) return;

    // Sync external ref so SpectrogramViewer can read audio.currentTime directly
    if (audioElementRef) {
      audioElementRef.current = audio;
    }

    const onLoadedMetadata = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    // timeupdate → only update React state for the slider range value when NOT playing
    // (during playing, rAF below handles everything without touching React state)
    const onTimeUpdate = () => {
      if (!isDraggingRef.current && !isPlaying) {
        setCurrentTime(audio.currentTime);
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      // sync slider position on pause
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setIsPlaying(false);
      if (audio) audio.currentTime = 0;
      setCurrentTime(0);
      if (fillLineRef.current) fillLineRef.current.style.width = '0%';
      if (sliderRef.current) {
        sliderRef.current.value = '0';
        sliderRef.current.style.background = `linear-gradient(to right, transparent 0%, #334155 0%)`;
      }
      if (formattedTimeRef.current) formattedTimeRef.current.textContent = '0:00';
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    if (autoPlay) {
      audio.play().catch((err) => console.warn('AutoPlay blocked:', err));
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      if (audioElementRef) audioElementRef.current = null;
    };
  }, [blobUrl, autoPlay]);

  // 3. rAF loop — 60fps, ZERO React state writes during playback
  useEffect(() => {
    if (!isPlaying) return;
    let animFrameId: number;

    const tick = () => {
      const audio = audioRef.current;
      if (audio && !isDraggingRef.current && isFinite(audio.duration) && audio.duration > 0) {
        const pct = Math.min(100, (audio.currentTime / audio.duration) * 100);

        // Direct DOM writes — no setState, no re-render
        if (fillLineRef.current) {
          fillLineRef.current.style.width = `${pct}%`;
        }
        if (sliderRef.current) {
          sliderRef.current.value = String(audio.currentTime);
          sliderRef.current.style.background = `linear-gradient(to right, transparent ${pct}%, #334155 ${pct}%)`;
        }
        if (formattedTimeRef.current) {
          formattedTimeRef.current.textContent = formatTime(audio.currentTime);
        }
      }
      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameId);
  }, [isPlaying]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => console.error('Play error:', err));
    }
  };

  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeRef = useRef<HTMLDivElement>(null);

  // 點擊外部關閉音量條
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (volumeRef.current && !volumeRef.current.contains(event.target as Node)) {
        setShowVolumeSlider(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = newVol;
      if (newVol === 0) {
        audio.muted = true;
        setIsMuted(true);
      } else {
        audio.muted = false;
        setIsMuted(false);
      }
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.muted = false;
      setIsMuted(false);
      if (audio.volume === 0) {
        audio.volume = 1;
        setVolume(1);
      }
    } else {
      audio.muted = true;
      setIsMuted(true);
    }
  };

  const handleSliderMouseDown = () => {
    isDraggingRef.current = true;
  };

  // 即時拖拉：直接同步寫入 audio.currentTime，讓 SpectrogramViewer 的 rAF 白線即時跟隨
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = val;
    }
  };

  const handleSliderCommit = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = val;
    }
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  if (downloadError) {
    return (
      <div className="w-full bg-red-900/20 text-red-400 p-2 rounded-lg border border-red-800/60 text-xs">
        下載音訊檔失敗 ({downloadError})
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900 text-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-800 shadow-inner flex items-center gap-2.5">
      {blobUrl && <audio ref={audioRef} src={blobUrl} preload="auto" />}

      {/* Play / Pause */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={isLoading}
        className="w-6 h-6 rounded-md bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shrink-0 transition-all disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        )}
      </button>

      {/* Current Time — direct DOM ref update */}
      <span
        ref={formattedTimeRef}
        className="text-[10px] font-mono font-semibold text-emerald-400 min-w-[28px] text-right shrink-0"
      >
        {formatTime(currentTime)}
      </span>

      {/* Seek Slider */}
      <div className="relative flex-1 flex items-center h-4">
        {/* Green fill — direct DOM ref update */}
        <div
          ref={fillLineRef}
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 rounded-full pointer-events-none z-10"
          style={{ width: `${progressPercent}%` }}
        />
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          disabled={isLoading}
          value={currentTime}
          onMouseDown={handleSliderMouseDown}
          onTouchStart={handleSliderMouseDown}
          onChange={handleSliderChange}
          onMouseUp={handleSliderCommit}
          onTouchEnd={handleSliderCommit}
          className="w-full h-1 appearance-none bg-slate-800 rounded-full cursor-pointer accent-emerald-400 focus:outline-none z-20 relative"
          style={{
            background: `linear-gradient(to right, transparent ${progressPercent}%, #334155 ${progressPercent}%)`
          }}
        />
      </div>

      {/* Total Duration */}
      <span className="text-[10px] font-mono font-semibold text-slate-400 min-w-[28px] shrink-0">
        {formatTime(duration)}
      </span>

      {/* Volume Button & Slider Control */}
      <div className="relative flex items-center" ref={volumeRef}>
        <button
          type="button"
          onClick={() => setShowVolumeSlider(!showVolumeSlider)}
          className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 shrink-0"
          title={isMuted ? 'Unmute' : 'Volume Control'}
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-slate-300" />
          )}
        </button>

        {/* Volume Slider Popover */}
        {showVolumeSlider && (
          <div className="absolute bottom-full right-0 mb-2 p-2 bg-slate-800 rounded-lg border border-slate-700 shadow-xl flex items-center gap-2 z-50 animate-fadeIn">
            <button type="button" onClick={toggleMute} className="text-slate-400 hover:text-white">
              {isMuted || volume === 0 ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 appearance-none bg-slate-700 rounded-full cursor-pointer accent-emerald-400 focus:outline-none"
            />
            <span className="text-[9px] font-mono text-slate-300 w-6 text-right">
              {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
            </span>
          </div>
        )}
      </div>

      {/* Spectrogram Wave Button */}
      {onToggleSpectrogram && (
        <button
          type="button"
          onClick={onToggleSpectrogram}
          className={`p-1 rounded-md transition-colors shrink-0 ${
            showSpectrogram
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title={showSpectrogram ? '隱藏聲譜圖 (Hide Spectrogram)' : '顯示聲譜圖 (Show Spectrogram)'}
        >
          <Activity className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
