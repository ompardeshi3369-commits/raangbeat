import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListMusic, Play, X, ArrowUp, ArrowDown, Music2, Radio, Plus, Sparkles, Loader2, UserCircle2 } from "lucide-react";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { jiosaavnApi, JioSaavnTrack } from "@/lib/jiosaavn";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { deduplicateSongs } from "@/lib/musicUtils";

interface QueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Convert JioSaavn track to player Track
const toTrack = (s: JioSaavnTrack): Track => ({
  id: s.id,
  title: s.title,
  artist: s.artist,
  artistId: s.artistId,
  coverUrl: s.coverUrl,
  audioUrl: s.audioUrl,
  duration: s.duration,
  mood: s.language,
});

export function QueueModal({ isOpen, onClose }: QueueModalProps) {
  const { queue, currentTrack, playTrack, removeFromQueue, setQueue, autoplay, toggleAutoplay, addToQueue } = usePlayer();

  const currentIndex = currentTrack ? queue.findIndex(t => t.id === currentTrack.id) : -1;
  const nextUpQueue = queue.slice(currentIndex + 1);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const lastFetchedId = useRef<string | null>(null);

  // Fetch recommendations when modal opens or current track changes
  useEffect(() => {
    if (!isOpen || !currentTrack) return;
    if (lastFetchedId.current === currentTrack.id) return; // avoid re-fetch
    lastFetchedId.current = currentTrack.id;
    fetchRecommendations(currentTrack);
  }, [isOpen, currentTrack?.id]);

  const fetchRecommendations = async (track: Track) => {
    setIsLoadingRecs(true);
    setRecommendations([]);
    try {
      // Build a set of IDs already in queue to avoid duplicates
      const queueIds = new Set(queue.map(t => t.id));
      queueIds.add(track.id);

      // Fetch in parallel: songs by same artist + songs by mood
      const [artistRes, moodRes] = await Promise.allSettled([
        jiosaavnApi.searchSongs(track.artist, 1, 20),
        track.mood
          ? jiosaavnApi.getSongsByMood(track.mood, 1, 20)
          : jiosaavnApi.searchSongs(`${track.artist} hindi`, 1, 20),
      ]);

      const artistSongs: JioSaavnTrack[] =
        artistRes.status === "fulfilled" ? (artistRes.value.songs || []) : [];
      const moodSongs: JioSaavnTrack[] =
        moodRes.status === "fulfilled" ? (moodRes.value.songs || []) : [];

      // Merge, deduplicate, filter out queue songs, limit to 15
      const merged = deduplicateSongs([...artistSongs, ...moodSongs]) as JioSaavnTrack[];
      const filtered = merged
        .filter(s => !queueIds.has(s.id) && s.hasLyrics)
        .slice(0, 15)
        .map(toTrack);

      setRecommendations(filtered);
    } catch (err) {
      console.error("Failed to load recommendations:", err);
    } finally {
      setIsLoadingRecs(false);
    }
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
    setAddedIds(prev => new Set([...prev, track.id]));
  };

  const handleAddAll = () => {
    recommendations.forEach(t => {
      if (!addedIds.has(t.id)) addToQueue(t);
    });
    setAddedIds(new Set(recommendations.map(t => t.id)));
  };

  const moveTrackInNextUp = (index: number, direction: 'up' | 'down') => {
    if (currentIndex === -1) return;
    const actualIndex = currentIndex + 1 + index;
    const targetIndex = direction === 'up' ? actualIndex - 1 : actualIndex + 1;
    if (targetIndex <= currentIndex || targetIndex >= queue.length) return;
    const newQueue = [...queue];
    [newQueue[actualIndex], newQueue[targetIndex]] = [newQueue[targetIndex], newQueue[actualIndex]];
    setQueue(newQueue);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border/50 h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <ListMusic className="w-5 h-5 text-primary" />
              Queue
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="autoplay-mode" className="text-sm font-medium text-muted-foreground cursor-pointer">
                Autoplay
              </Label>
              <Switch
                id="autoplay-mode"
                checked={autoplay}
                onCheckedChange={toggleAutoplay}
              />
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-8">

            {/* ── Now Playing ── */}
            {currentTrack && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Now Playing</h3>
                <div className="flex items-center gap-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="relative flex-shrink-0">
                    <img
                      src={currentTrack.coverUrl}
                      alt={currentTrack.title}
                      className="w-14 h-14 rounded-lg object-cover shadow-lg"
                    />
                    {/* Bouncing dots overlay */}
                    <div className="absolute inset-0 bg-black/30 rounded-lg flex items-end justify-center pb-1.5 gap-0.5">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-1 bg-primary rounded-full animate-bounce"
                          style={{ height: `${8 + i * 3}px`, animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-foreground">{currentTrack.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
                    {currentTrack.mood && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary mt-1 inline-block capitalize">
                        {currentTrack.mood}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Up Next ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Up Next {nextUpQueue.length > 0 && `· ${nextUpQueue.length} songs`}
                </h3>
              </div>

              {nextUpQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/40 border-2 border-dashed border-border/30 rounded-xl bg-muted/10">
                  <Music2 className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-sm font-medium">Queue is empty</p>
                  {autoplay && <p className="text-xs mt-1 text-primary/60">Add from recommendations below ↓</p>}
                </div>
              ) : (
                <div className="space-y-1">
                  {nextUpQueue.map((track, index) => (
                    <div
                      key={`${track.id}-${index}`}
                      className="group flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-all border border-transparent hover:border-border/40"
                    >
                      <span className="text-xs text-muted-foreground/50 w-4 text-center shrink-0">{index + 1}</span>
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className="w-10 h-10 rounded object-cover opacity-80 group-hover:opacity-100 transition-opacity shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex flex-col">
                          <button
                            onClick={() => moveTrackInNextUp(index, 'up')}
                            disabled={index === 0}
                            className="p-0.5 rounded hover:bg-muted hover:text-primary transition-colors disabled:opacity-20"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveTrackInNextUp(index, 'down')}
                            disabled={index === nextUpQueue.length - 1}
                            className="p-0.5 rounded hover:bg-muted hover:text-primary transition-colors disabled:opacity-20"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => playTrack(track)}
                          className="p-1.5 rounded-full hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                          title="Play now"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <button
                          onClick={() => removeFromQueue(track.id)}
                          className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Recommended for You ── */}
            {currentTrack && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-primary" />
                    Recommended
                  </h3>
                  {recommendations.length > 0 && (
                    <button
                      onClick={handleAddAll}
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                    >
                      <Plus className="w-3 h-3" />
                      Add All
                    </button>
                  )}
                </div>

                {/* Based on label */}
                {currentTrack && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                    <UserCircle2 className="w-3 h-3" />
                    Based on <span className="text-primary/70 font-medium">{currentTrack.artist}</span>
                    {currentTrack.mood && (
                      <> · <span className="capitalize text-primary/70 font-medium">{currentTrack.mood}</span></>
                    )}
                  </div>
                )}

                {isLoadingRecs ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Finding similar songs…</p>
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
                    <Radio className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">No recommendations found</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recommendations.map((track) => {
                      const isAdded = addedIds.has(track.id);
                      return (
                        <div
                          key={track.id}
                          className={cn(
                            "group flex items-center gap-3 p-2 rounded-lg transition-all border",
                            isAdded
                              ? "bg-primary/5 border-primary/20"
                              : "border-transparent hover:bg-muted/50 hover:border-border/40"
                          )}
                        >
                          <div className="relative shrink-0">
                            <img
                              src={track.coverUrl}
                              alt={track.title}
                              loading="lazy"
                              className="w-10 h-10 rounded object-cover"
                            />
                            <button
                              onClick={() => playTrack(track)}
                              className="absolute inset-0 bg-black/50 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Play className="w-3.5 h-3.5 text-white fill-white" />
                            </button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm group-hover:text-primary transition-colors">{track.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                          </div>
                          <button
                            onClick={() => !isAdded && handleAddToQueue(track)}
                            disabled={isAdded}
                            className={cn(
                              "shrink-0 p-1.5 rounded-full border transition-all",
                              isAdded
                                ? "border-primary/30 text-primary/50 cursor-default"
                                : "border-border/50 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/10"
                            )}
                            title={isAdded ? "Added to queue" : "Add to queue"}
                          >
                            {isAdded
                              ? <span className="text-[10px] px-1 font-medium text-primary">✓</span>
                              : <Plus className="w-3.5 h-3.5" />
                            }
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            {autoplay && nextUpQueue.length < 3 && (
              <div className="text-center pb-2 text-xs text-muted-foreground/50 flex items-center justify-center gap-1.5">
                <Radio className="w-3 h-3" />
                <span>Autoplay will keep music going</span>
              </div>
            )}

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
