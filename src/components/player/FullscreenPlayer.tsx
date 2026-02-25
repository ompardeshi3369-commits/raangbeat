import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { SeekBar } from "./SeekBar";
import { VolumeBar } from "./VolumeBar";
import { useMongoFavorites } from "@/hooks/useMongoFavorites";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { jiosaavnApi } from "@/lib/jiosaavn";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  X,
  Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FullscreenPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Floating orbs component
function FloatingOrbs({ isPlaying }: { isPlaying: boolean }) {
  const orbs = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      size: 100 + Math.random() * 300,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: 15 + Math.random() * 20,
      delay: Math.random() * -20,
      hue: [315, 270, 185, 340, 250, 200, 330, 290][i],
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      {orbs.map((orb) => (
        <div
          key={orb.id}
          className="absolute rounded-full blur-3xl"
          style={{
            width: orb.size,
            height: orb.size,
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            background: `radial-gradient(circle, hsla(${orb.hue}, 80%, 55%, 0.25) 0%, transparent 70%)`,
            animation: `fsOrb${orb.id % 4} ${orb.duration}s ease-in-out infinite`,
            animationDelay: `${orb.delay}s`,
            animationPlayState: isPlaying ? "running" : "paused",
          }}
        />
      ))}
    </div>
  );
}


// Spinning particles ring around album art
function ParticleRing({ isPlaying }: { isPlaying: boolean }) {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      angle: (i / 20) * 360,
      size: 2 + Math.random() * 4,
      distance: 170 + Math.random() * 30,
      speed: 20 + Math.random() * 10,
      hue: 315 + Math.random() * 60,
    })), []
  );

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        animation: isPlaying ? "spin 30s linear infinite" : "none",
      }}
    >
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const x = Math.cos(rad) * p.distance;
        const y = Math.sin(rad) * p.distance;
        return (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              left: "50%",
              top: "50%",
              transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
              background: `hsl(${p.hue}, 100%, 70%)`,
              boxShadow: `0 0 ${p.size * 3}px hsl(${p.hue}, 100%, 60%)`,
              opacity: isPlaying ? 0.8 : 0.2,
              transition: "opacity 1s ease",
            }}
          />
        );
      })}
    </div>
  );
}

interface ParsedLyric {
  time: number;
  text: string;
}

const parseLrc = (lrc: string): ParsedLyric[] => {
  const lines = lrc.split("\n");
  const result: ParsedLyric[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/;

  lines.forEach(line => {
    const match = timeRegex.exec(line);
    if (match) {
      const mins = parseInt(match[1]);
      const secs = parseInt(match[2]);
      const ms = parseInt(match[3]);
      const time = mins * 60 + secs + ms / (match[3].length === 3 ? 1000 : 100);
      const text = line.replace(timeRegex, "").trim();
      // Even if text is empty, we keep it for spacing/timing
      result.push({ time, text });
    } else {
      const text = line.replace(/\[\w+:.*?\]/g, "").trim();
      if (text) {
        result.push({ time: -1, text });
      }
    }
  });
  return result;
};

export function FullscreenPlayer({ isOpen, onClose }: FullscreenPlayerProps) {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    isShuffled,
    repeatMode,
    togglePlay,
    nextTrack,
    previousTrack,
    seekTo,
    setVolume,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useMongoFavorites();
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [activeLyricLine, setActiveLyricLine] = useState(0);
  const lyricsRef = useRef<HTMLDivElement>(null);

  const parsedLyrics = useMemo(() => lyrics ? parseLrc(lyrics) : [], [lyrics]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!currentTrack?.id) return;
    const fetchLyrics = async () => {
      try {
        const result = await jiosaavnApi.getLyrics(
          currentTrack.id,
          currentTrack.title,
          currentTrack.artist
        );
        // Keep raw lyrics for parsing
        setLyrics(result?.lyrics || null);
      } catch {
        setLyrics(null);
      }
    };
    fetchLyrics();
  }, [currentTrack?.id]);

  // Auto-scroll lyrics based on progress (throttled)
  const lastLineRef = useRef(-1);
  useEffect(() => {
    if (parsedLyrics.length === 0 || !duration) return;

    const isSynced = parsedLyrics.some(p => p.time !== -1);
    let idx = 0;

    if (isSynced) {
      for (let i = 0; i < parsedLyrics.length; i++) {
        if (progress >= parsedLyrics[i].time) {
          idx = i;
        } else {
          break;
        }
      }
    } else {
      const pct = progress / duration;
      idx = Math.min(Math.floor(pct * parsedLyrics.length), parsedLyrics.length - 1);
    }

    // Only update state if line actually changed
    if (idx !== lastLineRef.current) {
      lastLineRef.current = idx;
      setActiveLyricLine(idx);
    }
  }, [progress, duration, parsedLyrics]);

  // Center active lyric with smooth scroll (no scrollIntoView — it's laggy)
  useEffect(() => {
    if (!lyricsRef.current || activeLyricLine === -1) return;
    const container = lyricsRef.current;
    const activeEl = container.querySelector(`[data-lyric="${activeLyricLine}"]`) as HTMLElement;
    if (!activeEl) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    const targetScroll = container.scrollTop + (activeRect.top - containerRect.top) - containerRect.height / 2 + activeRect.height / 2;

    container.scrollTo({ top: targetScroll, behavior: "smooth" });
  }, [activeLyricLine]);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      requestAnimationFrame(() => setVisible(true));
      const timer = window.setTimeout(() => setShowContent(true), 100);
      return () => window.clearTimeout(timer);
    }
    setShowContent(false);
    setVisible(false);
    const timer = window.setTimeout(() => setRendered(false), 500);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!mounted || !rendered || !currentTrack) return null;

  const trackIsFavorite = isFavorite(currentTrack.id);
  const lyricsLines = lyrics?.split("\n").filter((l) => l.trim()) || [];
  const progressPct = duration ? (progress / duration) * 100 : 0;

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-[9999] transition-all duration-700 ease-out overflow-hidden select-none",
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Inline keyframes */}
      <style>{`
        @keyframes fsOrb0 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(80px,-120px) scale(1.3)} 66%{transform:translate(-60px,80px) scale(0.8)} }
        @keyframes fsOrb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-100px,60px) scale(1.2)} }
        @keyframes fsOrb2 { 0%,100%{transform:translate(0,0) scale(0.9)} 40%{transform:translate(70px,90px) scale(1.4)} 80%{transform:translate(-40px,-70px) scale(1)} }
        @keyframes fsOrb3 { 0%,100%{transform:translate(0,0)} 30%{transform:translate(-80px,-50px)} 70%{transform:translate(50px,70px)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes vinylSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulseRing { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.08);opacity:0.7} }
        @keyframes lyricsGlow { 0%,100%{text-shadow:0 0 20px rgba(255,100,200,0.3)} 50%{text-shadow:0 0 40px rgba(255,100,200,0.6),0 0 80px rgba(200,100,255,0.3)} }
      `}</style>

      {/* Deep dark base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0015] via-[#150020] to-[#0d0018]" />

      {/* Floating orbs */}
      <FloatingOrbs isPlaying={isPlaying} />

      {/* Blurred album art overlay */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={currentTrack.coverUrl}
          alt=""
          className={cn(
            "w-full h-full object-cover blur-[80px] scale-[2] transition-opacity duration-1000",
            showContent ? "opacity-15" : "opacity-0"
          )}
        />
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.7)_100%)]" />


      {/* Progress line at very top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 z-30">
        <div
          className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className={cn(
          "absolute top-6 right-6 z-30 p-3 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/15 transition-all duration-300 hover:scale-110 hover:rotate-90",
          showContent ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        )}
        style={{ transitionDelay: "200ms", transitionDuration: "400ms" }}
      >
        <X className="w-6 h-6 text-white/80" />
      </button>

      {/* Main Content */}
      <div className="relative z-10 h-full flex flex-col lg:flex-row items-center justify-center px-6 lg:px-16 py-8 gap-8 lg:gap-12 overflow-auto">
        {/* Left Side */}
        <div
          className={cn(
            "flex flex-col items-center transition-all duration-700 ease-out",
            showContent ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-95"
          )}
          style={{ transitionDelay: "100ms" }}
        >
          {/* Album Art with effects */}
          <div className="relative mb-8 flex items-center justify-center">
            {/* Pulsing rings */}
            <div
              className="absolute rounded-full border border-pink-500/20"
              style={{
                width: 340, height: 340,
                animation: isPlaying ? "pulseRing 3s ease-in-out infinite" : "none",
              }}
            />
            <div
              className="absolute rounded-full border border-purple-500/15"
              style={{
                width: 380, height: 380,
                animation: isPlaying ? "pulseRing 3s ease-in-out infinite 0.5s" : "none",
              }}
            />
            <div
              className="absolute rounded-full border border-cyan-500/10"
              style={{
                width: 420, height: 420,
                animation: isPlaying ? "pulseRing 3s ease-in-out infinite 1s" : "none",
              }}
            />

            {/* Particle ring */}
            <ParticleRing isPlaying={isPlaying} />

            {/* Glow behind art */}
            <div
              className="absolute rounded-full blur-3xl transition-all duration-1000"
              style={{
                width: 280, height: 280,
                background: "radial-gradient(circle, rgba(255,80,150,0.35) 0%, rgba(150,50,255,0.2) 50%, transparent 70%)",
                opacity: isPlaying ? 1 : 0.4,
              }}
            />

            {/* Album art - vinyl style spinning when playing */}
            <div
              className="relative rounded-full overflow-hidden shadow-2xl shadow-pink-500/20 border-4 border-white/10"
              style={{
                width: 280, height: 280,
                animation: isPlaying ? "vinylSpin 12s linear infinite" : "none",
              }}
            >
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
              {/* Vinyl center hole */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-black/80 border-2 border-white/10 flex items-center justify-center backdrop-blur-sm">
                  <div className="w-4 h-4 rounded-full bg-white/20" />
                </div>
              </div>
              {/* Vinyl grooves overlay */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `repeating-radial-gradient(circle at center, transparent 0px, transparent 8px, rgba(255,255,255,0.03) 9px, transparent 10px)`,
                }}
              />
            </div>
          </div>

          {/* Track Info */}
          <div className="text-center mb-6">
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 tracking-tight"
              style={{
                animation: isPlaying ? "lyricsGlow 4s ease-in-out infinite" : "none",
              }}
            >
              {currentTrack.title}
            </h1>
            <p className="text-lg text-white/50 font-light tracking-wide">{currentTrack.artist}</p>
          </div>

          {/* Seek Bar */}
          <div className="w-full max-w-xs sm:max-w-sm mb-5">
            <SeekBar
              value={progress}
              duration={duration || currentTrack.duration || 0}
              isPlaying={isPlaying}
              onSeek={seekTo}
              size="fullscreen"
            />
            <div className="flex justify-between mt-2 text-xs text-white/40 font-mono tracking-widest">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration || currentTrack.duration || 0)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={toggleShuffle}
              className={cn(
                "p-2.5 rounded-full transition-all duration-300 hover:scale-110",
                isShuffled
                  ? "text-pink-400 bg-pink-500/20 shadow-lg shadow-pink-500/20"
                  : "text-white/40 hover:text-white/80 hover:bg-white/5"
              )}
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <button
              onClick={previousTrack}
              className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-all duration-300 hover:scale-110 text-white/80 hover:text-white border border-white/5"
            >
              <SkipBack className="w-6 h-6" />
            </button>

            <button
              onClick={togglePlay}
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105",
                "bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 text-white",
                "shadow-xl shadow-purple-500/30",
                isPlaying && "shadow-pink-500/40"
              )}
            >
              {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
            </button>

            <button
              onClick={nextTrack}
              className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-all duration-300 hover:scale-110 text-white/80 hover:text-white border border-white/5"
            >
              <SkipForward className="w-6 h-6" />
            </button>

            <button
              onClick={toggleRepeat}
              className={cn(
                "p-2.5 rounded-full transition-all duration-300 hover:scale-110",
                repeatMode !== "none"
                  ? "text-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/20"
                  : "text-white/40 hover:text-white/80 hover:bg-white/5"
              )}
            >
              {repeatMode === "one" ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </button>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center gap-4 mt-6">
            {user && currentTrack && (
              <button
                onClick={() => toggleFavorite(currentTrack.id, currentTrack)}
                className={cn(
                  "p-3 rounded-full transition-all duration-300 hover:scale-110 border border-white/5",
                  trackIsFavorite
                    ? "text-pink-400 bg-pink-500/20 shadow-lg shadow-pink-500/20"
                    : "text-white/40 hover:text-pink-400 bg-white/5"
                )}
              >
                <Heart className={cn("w-6 h-6", trackIsFavorite && "fill-current")} />
              </button>
            )}

            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-xl rounded-full px-4 py-2.5 border border-white/5">
              <button
                onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
                className="text-white/50 hover:text-white transition-colors"
              >
                {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <VolumeBar value={volume} onChange={setVolume} className="w-24 sm:w-32" />
            </div>
          </div>
        </div>

        {/* Right Side - Lyrics */}
        <div
          ref={lyricsRef}
          className={cn(
            "flex-1 max-w-xl lg:max-w-2xl h-[40vh] lg:h-[70vh] overflow-y-auto scrollbar-hide focus:outline-none pl-12",
            showContent ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"
          )}
          style={{
            transitionProperty: "opacity, transform",
            transitionDuration: "700ms",
            transitionTimingFunction: "ease-out",
            transitionDelay: "250ms",
            willChange: "scroll-position",
          }}
        >
          {parsedLyrics.length > 0 ? (
            <div className="space-y-5 py-40"> {/* Large padding for scrolling comfort */}
              {parsedLyrics.map((line, index) => {
                const isActive = index === activeLyricLine;
                const distance = Math.abs(index - activeLyricLine);
                const isClickable = line.time !== -1;

                return (
                  <p
                    key={index}
                    data-lyric={index}
                    onClick={() => isClickable && seekTo(line.time)}
                    className={cn(
                      "text-2xl sm:text-3xl lg:text-4xl font-semibold leading-relaxed origin-left",
                      isClickable ? "cursor-pointer hover:text-white/80" : "cursor-default",
                      isActive
                        ? "text-white scale-105"
                        : distance === 1
                          ? "text-white/50 scale-100"
                          : distance === 2
                            ? "text-white/25 scale-100"
                            : "text-white/15 scale-100"
                    )}
                    style={{
                      transition: "color 0.3s ease, opacity 0.3s ease, transform 0.3s ease",
                      textShadow: isActive
                        ? "0 0 30px rgba(255,100,200,0.5), 0 0 60px rgba(150,50,255,0.3)"
                        : "none",
                    }}
                  >
                    {line.text || "♪"}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <Music2 className="w-16 h-16 text-white/10" />
              <p className="text-xl text-white/20 italic font-light">No lyrics available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
