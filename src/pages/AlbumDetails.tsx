
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useMongoFavorites } from "@/hooks/useMongoFavorites";
import { Navbar } from "@/components/layout/Navbar";
import { MainLayout } from "@/components/layout/MainLayout";
import { AddToPlaylistModal } from "@/components/playlist/AddToPlaylistModal";
import { AnimatedActionButton } from "@/components/ui/AnimatedActionButton";
import { jiosaavnApi, JioSaavnTrack } from "@/lib/jiosaavn";
import { deduplicateSongs } from "@/lib/musicUtils";
import { motion } from "framer-motion";
import {
    Play,
    Pause,
    Heart,
    Loader2,
    Share2,
    ListPlus,
    ArrowLeft,
    Clock,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioVisualizer } from "@/components/effects/AudioVisualizer";
import { cn } from "@/lib/utils";

// Helper to convert JioSaavn track to Track
const jiosaavnToTrack = (song: JioSaavnTrack): Track => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    artistId: song.artistId,
    coverUrl: song.coverUrl,
    audioUrl: song.audioUrl,
    duration: song.duration,
    mood: undefined,
});

// Format duration from seconds to mm:ss
const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function AlbumDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { currentTrack, isPlaying, playTrack, togglePlay, setQueue } = usePlayer();
    const { isFavorite, toggleFavorite } = useMongoFavorites();

    const [album, setAlbum] = useState<any | null>(null);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [showPlaylistModal, setShowPlaylistModal] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
    const [selectedTrackTitle, setSelectedTrackTitle] = useState<string>("");

    useEffect(() => {
        if (!id) return;

        const loadAlbum = async () => {
            setIsLoading(true);
            try {
                let albumData = null;

                // Check for special "Dhurandhar" ID or Featured Playlists
                if (id === "dhurandhar_special_album") {
                    // Re-fetch Dhurandhar logic
                    const dhurandharRes = await jiosaavnApi.searchSongs("Dhurandhar");
                    if (dhurandharRes.songs?.length) {
                        const dhurandharSongs = dhurandharRes.songs.filter(s => s.title.includes("Dhurandhar") || s.album?.includes("Dhurandhar"));
                        albumData = {
                            id: "dhurandhar_special_album",
                            title: "Dhurandhar",
                            artist: "Shashwat Sachdev & More",
                            coverUrl: dhurandharSongs[0].coverUrl,
                            songCount: dhurandharSongs.length,
                            songs: dhurandharSongs,
                            description: "The complete collection of songs from the movie Dhurandhar."
                        };
                    }
                } else if (id.startsWith("featured_")) {
                    // ID format: featured_Name:::Query OR featured_Name
                    let queryName = id.replace("featured_", "");
                    let displayName = queryName.replace(/_/g, " ");

                    if (id.includes(":::")) {
                        const parts = id.replace("featured_", "").split(":::");
                        displayName = parts[0].replace(/_/g, " ");
                        queryName = decodeURIComponent(parts[1]);
                    } else {
                        // Fallback for old IDs or if separator missing
                        queryName = queryName.replace(/_/g, " ");
                    }

                    // Map back to query if possible, or just search the name
                    // We can reuse the same queries map or just search the name
                    const result = await jiosaavnApi.searchSongs(queryName, 1, 60); // Fetch more to ensure 35 unique
                    if (result.songs?.length) {
                        albumData = {
                            id: id,
                            title: displayName,
                            artist: "Various Artists",
                            coverUrl: result.songs[0].coverUrl,
                            songCount: deduplicateSongs(result.songs).slice(0, 35).length,
                            songs: deduplicateSongs(result.songs).slice(0, 35),
                            description: `Top hit tracks for ${displayName}`
                        };
                    }
                } else {
                    // Regular JioSaavn Album
                    albumData = await jiosaavnApi.getAlbum(id);
                }

                if (albumData) {
                    setAlbum(albumData);
                    const albumSongs = albumData.songs || [];
                    const uniqueSongs = deduplicateSongs(albumSongs).slice(0, 40); // Strictly 40 songs per user request
                    setTracks(uniqueSongs.map(jiosaavnToTrack));
                }

            } catch (error) {
                console.error("Error loading album:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadAlbum();
    }, [id]);

    const playAll = () => {
        if (tracks.length > 0) {
            setQueue(tracks);
            playTrack(tracks[0]);
        }
    };

    const openPlaylistModal = (track: Track, trackTitle: string) => {
        setSelectedTrack(track);
        setSelectedTrackTitle(trackTitle);
        setShowPlaylistModal(true);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
        );
    }

    if (!album) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center p-4">
                <h2 className="text-2xl font-bold mb-4">Album not found</h2>
                <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
            </div>
        );
    }

    return (
        <MainLayout>
            <div className="min-h-screen pb-32 bg-background relative overflow-hidden">
                {/* Animated background particles */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px]" />
                </div>

                <Navbar />

                {/* Back / Exit Buttons */}
                <div className="fixed top-24 left-4 md:left-10 z-40 flex gap-4">
                    <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => {
                            console.log("Navigating to Hot Albums");
                            navigate("/home", { state: { tab: "albums" } });
                        }}
                        className="rounded-full w-12 h-12 bg-background/20 backdrop-blur-xl border-white/10 hover:bg-primary/20 hover:border-primary/40 transition-all hover:scale-110"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                </div>

                <div className="fixed top-24 right-4 md:right-10 z-40">
                    <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => navigate("/home", { state: { tab: "albums" } })}
                        className="rounded-full w-12 h-12 bg-background/20 backdrop-blur-xl border-white/10 hover:bg-red-500/20 hover:border-red-500/40 transition-all hover:scale-110 group"
                    >
                        <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                    </Button>
                </div>

                {/* Header / Hero */}
                <div className="relative pt-24 pb-10 md:pt-32 md:pb-16 px-4 md:px-10">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-end gap-8 z-10 relative">
                        {/* Cover Art */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative w-52 h-52 md:w-64 md:h-64 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0"
                        >
                            <img
                                src={album.coverUrl}
                                alt={album.title}
                                className="w-full h-full object-cover"
                            />
                        </motion.div>

                        {/* Info */}
                        <div className="flex-1 text-center md:text-left space-y-4">
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                            >
                                <h5 className="text-primary font-medium tracking-wider text-sm uppercase mb-2">Album</h5>
                                <h1 className="text-3xl md:text-5xl lg:text-7xl font-bold font-orbitron mb-4 leading-tight">
                                    {album.title}
                                </h1>
                                <p className="text-muted-foreground text-lg mb-6 flex items-center justify-center md:justify-start gap-2">
                                    <span className="text-foreground font-medium">{album.artist}</span>
                                    <span>•</span>
                                    <span>{album.year || "2025"}</span>
                                    <span>•</span>
                                    <span>{tracks.length} songs</span>
                                </p>
                            </motion.div>

                            {/* Actions */}
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex items-center justify-center md:justify-start gap-4"
                            >
                                <Button
                                    onClick={playAll}
                                    className="rounded-full h-14 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:scale-105 transition-all"
                                >
                                    <Play className="w-6 h-6 mr-2 fill-current" />
                                    Play All
                                </Button>

                                <Button variant="outline" size="icon" className="rounded-full h-12 w-12 border-muted-foreground/30 hover:border-primary hover:text-primary">
                                    <Heart className="w-5 h-5" />
                                </Button>

                                <Button variant="outline" size="icon" className="rounded-full h-12 w-12 border-muted-foreground/30 hover:border-primary hover:text-primary">
                                    <Share2 className="w-5 h-5" />
                                </Button>
                            </motion.div>
                        </div>
                    </div>
                </div>

                {/* Songs List */}
                <div className="max-w-7xl mx-auto px-4 md:px-10 pb-10">

                    {/* Header Row */}
                    <div className="hidden md:flex items-center text-sm text-muted-foreground border-b border-border/50 pb-2 mb-4 px-4">
                        <div className="w-12 text-center">#</div>
                        <div className="flex-1">Title</div>
                        <div className="w-12 text-center"><Clock className="w-4 h-4" /></div>
                        <div className="w-12"></div>
                    </div>

                    <div className="space-y-1">
                        {tracks.map((track, index) => {
                            const isActive = currentTrack?.id === track.id;
                            // Use track ID hash to generate consistent year for demo if not available
                            const trackHash = track.id.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
                            const year = 2020 + (Math.abs(trackHash) % 6);
                            const isNew = year === 2025 || year === 2026;

                            return (
                                <motion.div
                                    key={track.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`group flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer ${isActive
                                        ? 'bg-primary/10 border border-primary/20'
                                        : 'hover:bg-muted/40 border border-transparent'
                                        }`}
                                    onClick={() => {
                                        if (isActive) {
                                            togglePlay();
                                        } else {
                                            setQueue(tracks);
                                            playTrack(track);
                                        }
                                    }}
                                >
                                    {/* Index / Play Icon */}
                                    <div className="w-8 md:w-12 flex justify-center text-muted-foreground font-medium group-hover:text-primary">
                                        {isActive && isPlaying ? (
                                            <AudioVisualizer isPlaying={true} barCount={4} className="h-4 w-4" />
                                        ) : (
                                            <span className="group-hover:hidden">{index + 1}</span>
                                        )}
                                        <Play className={`w-4 h-4 hidden ${!isActive && isPlaying ? 'group-hover:block' : ''} ${!isPlaying ? 'group-hover:block' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isActive) {
                                                    togglePlay();
                                                } else {
                                                    setQueue(tracks);
                                                    playTrack(track);
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Title & Artist */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`font-medium truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                                                {track.title}
                                            </p>
                                            {isNew && (
                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-accent text-accent-foreground rounded-full">
                                                    NEW
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate">
                                            {track.artist}
                                        </p>
                                    </div>

                                    {/* Duration */}
                                    <div className="hidden md:block w-12 text-right text-sm text-muted-foreground">
                                        {formatDuration(track.duration || 0)}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <AnimatedActionButton
                                            type="like"
                                            onClick={() => toggleFavorite(track.id, track)}
                                            isActive={isFavorite(track.id)}
                                            title={isFavorite(track.id) ? "Remove from favorites" : "Add to favorites"}
                                            className="hover:bg-background/80"
                                        >
                                            <Heart className={`w-4 h-4 ${isFavorite(track.id) ? 'fill-current' : ''}`} />
                                        </AnimatedActionButton>

                                        <AnimatedActionButton
                                            type="playlist"
                                            onClick={() => openPlaylistModal(track, track.title)}
                                            title="Add to playlist"
                                            className="hover:bg-background/80"
                                        >
                                            <ListPlus className="w-4 h-4" />
                                        </AnimatedActionButton>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {selectedTrack && (
                    <AddToPlaylistModal
                        isOpen={showPlaylistModal}
                        onClose={() => setShowPlaylistModal(false)}
                        songId={selectedTrack.id}
                        songTitle={selectedTrackTitle}
                        trackData={{
                            title: selectedTrack.title,
                            artist: selectedTrack.artist,
                            artistId: selectedTrack.artistId,
                            coverUrl: selectedTrack.coverUrl,
                            audioUrl: selectedTrack.audioUrl,
                            duration: selectedTrack.duration,
                        }}
                    />
                )}
            </div>
        </MainLayout >
    );
}
