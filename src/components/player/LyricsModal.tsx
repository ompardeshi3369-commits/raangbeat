import { useEffect, useState, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music2, RefreshCw } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";

const MOOD_VIDEOS: Record<string, string> = {
  romantic: "/videos/romantic.mp4",
  sad: "/videos/chill.mp4",
  party: "/videos/party.mp4",
  chill: "/videos/chill.mp4",
  devotional: "/videos/devotional.mp4",
  workout: "/videos/workout.mp4",
};

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

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  artist: string;
  lyrics: string | null;
  mood?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function LyricsModal({ isOpen, onClose, title, artist, lyrics, mood, onRefresh, isRefreshing }: LyricsModalProps) {
  const { progress, duration, seekTo } = usePlayer();
  const videoSrc = mood ? MOOD_VIDEOS[mood] || MOOD_VIDEOS.chill : MOOD_VIDEOS.chill;
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLineRef = useRef(-1);

  const parsedLyrics = useMemo(() => lyrics ? parseLrc(lyrics) : [], [lyrics]);
  const [activeLine, setActiveLine] = useState(-1);

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

    if (idx !== lastLineRef.current) {
      lastLineRef.current = idx;
      setActiveLine(idx);
    }
  }, [progress, duration, parsedLyrics]);

  // Handle line click
  const handleLineClick = (time: number) => {
    if (time !== -1) {
      seekTo(time);
    }
  };

  // Center active lyric smoothly
  useEffect(() => {
    if (!scrollRef.current || activeLine === -1) return;
    const container = scrollRef.current;
    const viewport = container.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (!viewport) return;
    const activeEl = viewport.querySelector(`[data-line-index="${activeLine}"]`) as HTMLElement;
    if (!activeEl) return;

    const viewportRect = viewport.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    const targetScroll = viewport.scrollTop + (activeRect.top - viewportRect.top) - viewportRect.height / 2 + activeRect.height / 2;

    viewport.scrollTo({ top: targetScroll, behavior: "smooth" });
  }, [activeLine]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg border-border/50 overflow-hidden p-0">
        {/* Video Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <video
            key={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>

        <div className="relative z-10 p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Music2 className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{title}</span>
              </div>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50 mr-8"
                  title="Refresh lyrics"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </DialogTitle>
            <p className="text-sm text-white/70 ml-7">{artist}</p>
          </DialogHeader>
          <ScrollArea className="h-[400px] mt-4" ref={scrollRef}>
            {parsedLyrics.length > 0 ? (
              <div className="space-y-4 pr-4 py-32">
                {parsedLyrics.map((line, index) => {
                  const isActive = index === activeLine;
                  const isClickable = line.time !== -1;

                  return (
                    <p
                      key={index}
                      data-line-index={index}
                      onClick={() => isClickable && handleLineClick(line.time)}
                      className={cn(
                        "text-lg leading-relaxed whitespace-pre-line text-shadow origin-left",
                        isClickable ? "cursor-pointer hover:text-white" : "cursor-default",
                        isActive
                          ? "text-white font-bold scale-105"
                          : "text-white/60 hover:text-white/80 scale-100"
                      )}
                      style={{
                        transition: "color 0.3s ease, opacity 0.3s ease, transform 0.3s ease",
                      }}
                    >
                      {line.text || "♪"}
                    </p>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white/60">
                <Music2 className="w-12 h-12 mb-4 opacity-50" />
                <p>Lyrics not available for this song</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
