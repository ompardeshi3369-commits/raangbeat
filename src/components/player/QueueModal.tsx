import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListMusic, Play, X, GripVertical, ArrowUp, ArrowDown, Music2, Radio } from "lucide-react";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface QueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QueueModal({ isOpen, onClose }: QueueModalProps) {
  const { queue, currentTrack, playTrack, removeFromQueue, setQueue, autoplay, toggleAutoplay } = usePlayer();

  const currentIndex = currentTrack ? queue.findIndex(t => t.id === currentTrack.id) : -1;
  const nextUpQueue = queue.slice(currentIndex + 1);

  const moveTrackInNextUp = (index: number, direction: 'up' | 'down') => {
    // We are moving tracks within the *nextUpQueue* relative to the *full queue*
    // The visual index is `index` within `nextUpQueue`
    // The actual index in `queue` is `currentIndex + 1 + index`

    if (currentIndex === -1) return;

    const actualIndex = currentIndex + 1 + index;
    const targetIndex = direction === 'up' ? actualIndex - 1 : actualIndex + 1;

    // Ensure we don't move into the "Now Playing" slot (target > currentIndex)
    if (targetIndex <= currentIndex || targetIndex >= queue.length) return;

    const newQueue = [...queue];
    [newQueue[actualIndex], newQueue[targetIndex]] = [newQueue[targetIndex], newQueue[actualIndex]];
    setQueue(newQueue);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border/50 h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
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
            {/* Now Playing Section */}
            {currentTrack && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Now playing</h3>
                <div className="flex items-center gap-4 p-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors group">
                  <div className="relative">
                    <img
                      src={currentTrack.coverUrl}
                      alt={currentTrack.title}
                      className="w-16 h-16 rounded-lg object-cover shadow-lg"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s] mx-1" />
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg truncate text-foreground leading-tight mb-1">{currentTrack.title}</p>
                    <p className="text-sm text-muted-foreground truncate font-medium">{currentTrack.artist}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Next Up Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Next from: {autoplay ? "Autoplay / Queue" : "Queue"}
                </h3>
              </div>

              {nextUpQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50 border-2 border-dashed border-border/50 rounded-xl bg-muted/20">
                  <Music2 className="w-12 h-12 mb-3 opacity-50" />
                  <p className="font-medium">No songs in queue</p>
                  {autoplay && <p className="text-xs mt-1 text-primary/70">We'll play related songs next</p>}
                </div>
              ) : (
                <div className="space-y-1">
                  {nextUpQueue.map((track, index) => (
                    <div
                      key={`${track.id}-${index}`} // Use index in key to handle duplicates if any
                      className="group flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-all border border-transparent hover:border-border/50"
                    >
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className="w-12 h-12 rounded object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm text-foreground/90 group-hover:text-foreground">{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                      </div>

                      {/* Controls appear on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex flex-col mr-1">
                          <button
                            onClick={() => moveTrackInNextUp(index, 'up')}
                            disabled={index === 0}
                            className="p-1 rounded hover:bg-background/80 hover:text-primary transition-colors disabled:opacity-30"
                            title="Move up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveTrackInNextUp(index, 'down')}
                            disabled={index === nextUpQueue.length - 1}
                            className="p-1 rounded hover:bg-background/80 hover:text-primary transition-colors disabled:opacity-30"
                            title="Move down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            // To play immediately, we might want to just skip to it?
                            // Or play it as "playTrack" which usually replaces context?
                            // Let's stick to standard playTrack which is "play this specific song now"
                            playTrack(track);
                          }}
                          className="p-2 rounded-full hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                          title="Play now"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                        <button
                          onClick={() => removeFromQueue(track.id)}
                          className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove from queue"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Disclaimer / Footer */}
            {autoplay && nextUpQueue.length < 5 && (
              <div className="text-center pb-4 text-xs text-muted-foreground/60 flex items-center justify-center gap-1.5">
                <Radio className="w-3 h-3" />
                <span>Autoplay is on - we'll keep the music going</span>
              </div>
            )}

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
