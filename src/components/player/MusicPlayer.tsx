import { useState, useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { AudioVisualizer } from "@/components/effects/AudioVisualizer";
import { LyricsModal } from "./LyricsModal";
import { QueueModal } from "./QueueModal";
import { SleepTimerModal } from "./SleepTimerModal";
import { EqualizerModal, EqualizerPreset } from "./EqualizerModal";
import { FullscreenPlayer } from "./FullscreenPlayer";
import { YouTubeVideoModal } from "./YouTubeVideoModal";
import { SeekBar } from "./SeekBar";
import { VolumeBar } from "./VolumeBar";
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
  Music2,
  ListMusic,
  Moon,
  Heart,
  SlidersHorizontal,
  Flame,
  ChevronUp,
  Maximize2,
  Youtube,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMongoFavorites } from "@/hooks/useMongoFavorites";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MusicPlayer() {
  const {
    currentTrack, isPlaying, progress, duration, volume,
    isShuffled, repeatMode, sleepTimer, togglePlay, nextTrack, previousTrack,
    seekTo, setVolume, toggleShuffle, toggleRepeat, setSleepTimer,
  } = usePlayer();

  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useMongoFavorites();
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);
  const [currentLyrics, setCurrentLyrics] = useState<string | null>(null);
  const [isRefreshingLyrics, setIsRefreshingLyrics] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  // Equalizer state
  const [eqBands, setEqBands] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [bassBoost, setBassBoost] = useState(0);

  // Reactions state
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  useEffect(() => {
    if (currentTrack) {
      fetchLyrics(currentTrack.id);
    }
  }, [currentTrack?.id]);

  const fetchLyrics = async (songId: string, forceRefresh = false) => {
    if (forceRefresh) setIsRefreshingLyrics(true);
    // Check if it's a JioSaavn song
    if (songId.startsWith("jiosaavn_")) {
      try {
        const actualId = songId.replace("jiosaavn_", "");
        const result = await jiosaavnApi.getLyrics(actualId, currentTrack?.title, currentTrack?.artist);
        setCurrentLyrics(result?.lyrics || null);
      } catch (error) {
        console.error("Error fetching lyrics:", error);
        setCurrentLyrics(null);
      }
      setIsRefreshingLyrics(false);
      return;
    }

    // Fallback to local Supabase songs
    const { data } = await supabase
      .from("songs")
      .select("lyrics")
      .eq("id", songId)
      .maybeSingle();
    setCurrentLyrics(data?.lyrics || null);
    setIsRefreshingLyrics(false);
  };

  const refreshLyrics = () => {
    if (currentTrack) fetchLyrics(currentTrack.id, true);
  };

  const handleApplyPreset = (preset: EqualizerPreset) => {
    setEqBands(preset.bands);
    setBassBoost(preset.bassBoost);
  };

  const handleReaction = (emoji: string) => {
    setActiveReaction(activeReaction === emoji ? null : emoji);
    setShowReactionPicker(false);
  };

  if (!currentTrack || !user) return null;

  const trackIsFavorite = isFavorite(currentTrack.id);
  const hasEqActive = eqBands.some((b) => b !== 0) || bassBoost !== 0;

  return (
    <>
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/90 border-t border-border/50 transition-all duration-500 ease-out",
        "animate-fade-in",
        isExpanded ? "h-auto" : ""
      )}>
        {/* Animated glow effect */}
        {isPlaying && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className={cn(
              "absolute -inset-1 opacity-30 blur-xl transition-all duration-1000",
              currentTrack.mood === "romantic" && "bg-gradient-to-r from-pink-500/20 via-transparent to-pink-500/20",
              currentTrack.mood === "sad" && "bg-gradient-to-r from-blue-500/20 via-transparent to-blue-500/20",
              currentTrack.mood === "chill" && "bg-gradient-to-r from-green-500/20 via-transparent to-green-500/20",
              currentTrack.mood === "party" && "bg-gradient-to-r from-purple-500/20 via-transparent to-purple-500/20",
              !currentTrack.mood && "bg-gradient-to-r from-primary/20 via-transparent to-primary/20"
            )} style={{ animation: 'pulse 3s ease-in-out infinite' }} />
          </div>
        )}

        {/* Mood indicator strip with animation */}
        {currentTrack.mood && (
          <div className={cn(
            "h-1 w-full relative overflow-hidden",
            currentTrack.mood === "romantic" && "bg-gradient-to-r from-pink-500 via-red-500 to-pink-500",
            currentTrack.mood === "sad" && "bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500",
            currentTrack.mood === "chill" && "bg-gradient-to-r from-green-500 via-teal-500 to-green-500",
            currentTrack.mood === "party" && "bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500",
          )}>
            {isPlaying && (
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                style={{ animation: 'shimmer 2s ease-in-out infinite' }}
              />
            )}
          </div>
        )}

        {/* Main Player Content */}
        <div className="max-w-7xl mx-auto px-4 py-3 relative">
          <div className="flex items-center gap-4">
            {/* Track Info */}
            <div className="flex items-center gap-3 min-w-0 w-48 sm:w-56 flex-shrink-0">
              <div className="relative group flex-shrink-0">
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className={cn(
                    "w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover transition-all duration-300",
                    isPlaying && "ring-2 ring-primary/50 shadow-lg shadow-primary/20"
                  )}
                />
                {isPlaying && (
                  <div className="absolute -inset-1 rounded-xl bg-primary/20 blur-md -z-10 animate-pulse" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate text-foreground">{currentTrack.title}</p>
                <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
              </div>
            </div>

            {/* Seek Bar - Animated + Draggable */}
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <span className="text-xs text-muted-foreground w-10 text-right hidden sm:block font-mono">
                {formatTime(progress)}
              </span>

              <div className="flex-1 min-w-0">
                <SeekBar
                  value={progress}
                  duration={duration || currentTrack.duration || 0}
                  isPlaying={isPlaying}
                  onSeek={seekTo}
                  size="mini"
                />
              </div>

              <span className="text-xs text-muted-foreground w-10 hidden sm:block font-mono">
                {formatTime(duration || currentTrack.duration || 0)}
              </span>
            </div>

            {/* Controls - Enhanced */}
            <div className="flex items-center gap-2">
              <button
                onClick={previousTrack}
                className="p-2.5 rounded-full bg-muted/30 hover:bg-muted/50 transition-all hover:scale-110 active:scale-95 border border-border/30"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={togglePlay}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 relative overflow-hidden",
                  "bg-gradient-to-br from-primary via-accent to-neon-purple",
                  "shadow-xl hover:shadow-2xl hover:shadow-primary/40 hover:scale-105 active:scale-95",
                  "border-2 border-white/20"
                )}
              >
                {/* Animated ring when playing */}
                {isPlaying && (
                  <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping" style={{ animationDuration: '1.5s' }} />
                )}
                {/* Inner glow */}
                <div className="absolute inset-1 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
                {isPlaying ? (
                  <Pause className="w-6 h-6 text-white relative z-10" />
                ) : (
                  <Play className="w-6 h-6 text-white ml-0.5 relative z-10" />
                )}
              </button>

              <button
                onClick={nextTrack}
                className="p-2.5 rounded-full bg-muted/30 hover:bg-muted/50 transition-all hover:scale-110 active:scale-95 border border-border/30"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              {user && currentTrack && (
                <button
                  onClick={() => toggleFavorite(currentTrack.id, currentTrack)}
                  className={cn(
                    "p-2 rounded-full hover:bg-muted/50 transition-all hover:scale-110",
                    trackIsFavorite && "text-destructive"
                  )}
                >
                  <Heart className={cn(
                    "w-5 h-5 transition-transform",
                    trackIsFavorite && "fill-current animate-pulse"
                  )} />
                </button>
              )}

              <button
                onClick={toggleShuffle}
                className={cn(
                  "p-2 rounded-full hover:bg-muted/50 transition-all hover:scale-110 hidden md:flex",
                  isShuffled && "text-primary bg-primary/10"
                )}
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <button
                onClick={toggleRepeat}
                className={cn(
                  "p-2 rounded-full hover:bg-muted/50 transition-all hover:scale-110 hidden md:flex",
                  repeatMode !== "none" && "text-primary bg-primary/10"
                )}
              >
                {repeatMode === "one" ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </button>

              {/* Visualizer */}
              <div className="hidden lg:block w-16 h-10 mx-1">
                <AudioVisualizer isPlaying={isPlaying} barCount={8} variant="spectrum" />
              </div>

              {/* Volume */}
              <div className="hidden md:flex items-center gap-2 bg-muted/30 rounded-full px-3 py-2">
                <button
                  onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
                  className="p-1 hover:bg-muted/50 rounded-full transition-colors"
                >
                  {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <VolumeBar
                  value={volume}
                  onChange={setVolume}
                  className="w-20"
                />
              </div>

              {/* YouTube Video Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowYouTube(true)}
                    className="p-2 rounded-full hover:bg-red-600/20 hover:text-red-400 transition-all hover:scale-110 text-muted-foreground"
                  >
                    <Youtube className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Watch Video on YouTube</TooltipContent>
              </Tooltip>

              {/* Fullscreen Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowFullscreen(true)}
                    className="p-2 rounded-full hover:bg-muted/50 transition-all hover:scale-110"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Fullscreen Mode</TooltipContent>
              </Tooltip>

              {/* Expand Button */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                  "p-2 rounded-full hover:bg-muted/50 transition-all hover:scale-110",
                  isExpanded && "bg-primary/10 text-primary rotate-180"
                )}
              >
                <ChevronUp className="w-5 h-5 transition-transform duration-300" />
              </button>
            </div>
          </div>

          {/* Expanded Controls */}
          {isExpanded && (
            <div className="pt-3 pb-1 border-t border-border/30 mt-2 animate-fade-in">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {/* Reactions */}
                <div className="relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowReactionPicker(!showReactionPicker)}
                        className={cn(
                          "p-2 rounded-xl hover:bg-muted/50 transition-all border border-border/50",
                          activeReaction && "text-primary border-primary/50"
                        )}
                      >
                        {activeReaction ? (
                          <span className="text-base">{activeReaction}</span>
                        ) : (
                          <Flame className="w-4 h-4" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>React</TooltipContent>
                  </Tooltip>

                  {showReactionPicker && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-xl bg-card/95 backdrop-blur-xl border border-border/50 flex gap-1 animate-scale-in">
                      {["🔥", "❤️", "🎵", "💯", "✨", "🎶"].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(emoji)}
                          className={cn(
                            "w-8 h-8 rounded-lg hover:bg-muted/50 flex items-center justify-center text-lg transition-all hover:scale-110",
                            activeReaction === emoji && "bg-primary/20"
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowEqualizer(true)}
                      className={cn("p-2 rounded-xl hover:bg-muted/50 transition-colors border border-border/50", hasEqActive && "text-primary border-primary/50")}
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Equalizer</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowLyrics(true)}
                      className={cn("p-2 rounded-xl hover:bg-muted/50 transition-colors border border-border/50", currentLyrics && "text-primary border-primary/50")}
                    >
                      <Music2 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Lyrics</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowQueue(true)}
                      className="p-2 rounded-xl hover:bg-muted/50 transition-colors border border-border/50"
                    >
                      <ListMusic className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Queue</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowSleepTimer(true)}
                      className={cn("p-2 rounded-xl hover:bg-muted/50 transition-colors border border-border/50", sleepTimer && "text-primary border-primary/50")}
                    >
                      <Moon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{sleepTimer ? `${sleepTimer}min` : "Sleep Timer"}</TooltipContent>
                </Tooltip>

                {/* Mobile Volume */}
                <div className="md:hidden flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50">
                  <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="p-1">
                    {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <VolumeBar
                    value={volume}
                    onChange={setVolume}
                    className="w-20"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <LyricsModal
        isOpen={showLyrics}
        onClose={() => setShowLyrics(false)}
        title={currentTrack.title}
        artist={currentTrack.artist}
        lyrics={currentLyrics}
        mood={currentTrack.mood}
        onRefresh={refreshLyrics}
        isRefreshing={isRefreshingLyrics}
      />
      <QueueModal isOpen={showQueue} onClose={() => setShowQueue(false)} />
      <SleepTimerModal
        isOpen={showSleepTimer}
        onClose={() => setShowSleepTimer(false)}
        onSetTimer={setSleepTimer}
        activeTimer={sleepTimer}
      />
      <EqualizerModal
        isOpen={showEqualizer}
        onClose={() => setShowEqualizer(false)}
        onApplyPreset={handleApplyPreset}
        onBandChange={setEqBands}
        currentBands={eqBands}
        bassBoost={bassBoost}
        onBassBoostChange={setBassBoost}
      />
      <FullscreenPlayer
        isOpen={showFullscreen}
        onClose={() => setShowFullscreen(false)}
      />
      {currentTrack && (
        <YouTubeVideoModal
          isOpen={showYouTube}
          onClose={() => setShowYouTube(false)}
          title={currentTrack.title}
          artist={currentTrack.artist}
          coverUrl={currentTrack.coverUrl}
        />
      )}
    </>
  );
}
