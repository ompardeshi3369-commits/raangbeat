import { useState, forwardRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/ui/GlassCard";
import { useMongoPlaylists } from "@/hooks/useMongoPlaylists";
import { useToast } from "@/hooks/use-toast";
import { SongMetadata } from "@/lib/mongodb";
import { ListMusic, Plus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  songId: string;
  songTitle?: string;
  trackData?: {
    title: string;
    artist: string;
    artistId: string;
    coverUrl: string;
    audioUrl: string;
    duration: number;
  };
}

export const AddToPlaylistModal = forwardRef<HTMLDivElement, AddToPlaylistModalProps>(
  function AddToPlaylistModal({ isOpen, onClose, songId, songTitle, trackData }, ref) {
    const { playlists, isLoading, createPlaylist, addSongToPlaylist } = useMongoPlaylists();
    const { toast } = useToast();
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [addingTo, setAddingTo] = useState<string | null>(null);

    const handleAddToPlaylist = async (playlistId: string, playlistName: string) => {
      setAddingTo(playlistId);
      try {
        // For external songs, pass metadata
        const metadata: SongMetadata | undefined = songId.startsWith("jiosaavn_") && trackData
          ? {
              title: trackData.title,
              artist: trackData.artist,
              artistId: trackData.artistId,
              coverUrl: trackData.coverUrl,
              audioUrl: trackData.audioUrl,
              duration: trackData.duration,
            }
          : undefined;
        
        await addSongToPlaylist(playlistId, songId, metadata);
        toast({
          title: "Added to playlist",
          description: `"${songTitle || "Song"}" added to "${playlistName}"`,
        });
        onClose();
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to add song to playlist",
          variant: "destructive",
        });
      } finally {
        setAddingTo(null);
      }
    };

    const handleCreateAndAdd = async () => {
      const name = newPlaylistName.trim();
      if (!name) {
        toast({
          title: "Error",
          description: "Please enter a playlist name",
          variant: "destructive",
        });
        return;
      }

      setIsCreating(true);
      try {
        const playlistId = await createPlaylist(name);
        if (playlistId) {
          // For external songs, pass metadata
          const metadata: SongMetadata | undefined = songId.startsWith("jiosaavn_") && trackData
            ? {
                title: trackData.title,
                artist: trackData.artist,
                artistId: trackData.artistId,
                coverUrl: trackData.coverUrl,
                audioUrl: trackData.audioUrl,
                duration: trackData.duration,
              }
            : undefined;
          
          await addSongToPlaylist(playlistId, songId, metadata);
          toast({
            title: "Playlist created",
            description: `"${songTitle || "Song"}" added to new playlist "${name}"`,
          });
          setNewPlaylistName("");
          onClose();
        }
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to create playlist",
          variant: "destructive",
        });
      } finally {
        setIsCreating(false);
      }
    };

    const isSongInPlaylist = (playlistSongs: string[]) => {
      return playlistSongs?.includes(songId);
    };

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent ref={ref} className="bg-background/95 backdrop-blur-xl border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-orbitron flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-primary" />
              Add to Playlist
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Create new playlist */}
            <div className="flex gap-2">
              <Input
                placeholder="Create new playlist..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateAndAdd()}
                className="bg-muted/50 border-border/50"
              />
              <Button
                onClick={handleCreateAndAdd}
                disabled={isCreating || !newPlaylistName.trim()}
                className="bg-primary hover:bg-primary/80"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Existing playlists */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : playlists.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No playlists yet. Create one above!
                </p>
              ) : (
                playlists.map((playlist) => {
                  const alreadyAdded = isSongInPlaylist(playlist.songs || []);
                  const isAdding = addingTo === playlist._id;

                  return (
                    <GlassCard
                      key={playlist._id}
                      className={cn(
                        "p-3 flex items-center gap-3 cursor-pointer transition-all",
                        alreadyAdded && "opacity-50 cursor-not-allowed",
                        !alreadyAdded && "hover:border-primary/50"
                      )}
                      onClick={() => !alreadyAdded && !isAdding && handleAddToPlaylist(playlist._id, playlist.name)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                        <ListMusic className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{playlist.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {playlist.songs?.length || 0} songs
                        </p>
                      </div>
                      {isAdding ? (
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    ) : alreadyAdded ? (
                      <Check className="w-5 h-5 text-accent" />
                      ) : null}
                    </GlassCard>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);
