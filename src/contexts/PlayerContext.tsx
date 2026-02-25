import { createContext, useContext, useState, useRef, useEffect, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { songsApi, recentlyPlayedApi, MongoSong } from "@/lib/mongodb";
import { jiosaavnApi } from "@/lib/jiosaavn";

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  mood?: string;
  tags?: string[];
}

export interface PlayerContextType {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  isShuffled: boolean;
  repeatMode: "none" | "one" | "all";
  isLoading: boolean;
  sleepTimer: number | null;
  autoplay: boolean;
  audioElement: HTMLAudioElement | null;
  playTrack: (track: Track) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleAutoplay: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  setQueue: (tracks: Track[]) => void;
  loadSongs: () => Promise<void>;
  setSleepTimer: (minutes: number | null) => void;
  analyser: AnalyserNode | null;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// Helper to convert MongoDB song to Track
const mongoSongToTrack = (song: MongoSong): Track => ({
  id: song._id,
  title: song.title,
  artist: song.artistName,
  artistId: song.artistId,
  coverUrl: song.coverUrl || "",
  audioUrl: song.audioUrl,
  duration: song.duration || 0,
  mood: song.mood,
});

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.7);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"none" | "one" | "all">("none");
  const [isLoading, setIsLoading] = useState(true);
  const [sleepTimer, setSleepTimerState] = useState<number | null>(null);
  const [autoplay, setAutoplay] = useState(true);
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs to avoid stale closures in event handlers (handleEnded -> nextTrack)
  const queueRef = useRef(queue);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const currentTrackRef = useRef(currentTrack);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);

  // Audio API Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Load songs - now optional, pages can set their own queue
  const loadSongs = useCallback(async () => {
    // Don't auto-load from MongoDB anymore
    // Pages will populate the queue with API songs
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  // Stop playback when user logs out
  useEffect(() => {
    if (!user && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTrack(null);
      setProgress(0);
    }
  }, [user]);

  // Smart Resume - Save progress to localStorage
  useEffect(() => {
    if (currentTrack && progress > 5) {
      const resumeData = {
        trackId: currentTrack.id,
        progress: progress,
        timestamp: Date.now(),
      };
      localStorage.setItem("raangbeat_resume", JSON.stringify(resumeData));
    }
  }, [currentTrack?.id, Math.floor(progress / 10)]); // Save every 10 seconds

  // Restore last session on load
  useEffect(() => {
    const restoreSession = () => {
      if (queue.length === 0 || currentTrack) return;

      const savedData = localStorage.getItem("raangbeat_resume");
      if (!savedData) return;

      try {
        const { trackId, progress: savedProgress, timestamp } = JSON.parse(savedData);
        // Only restore if less than 24 hours old
        if (Date.now() - timestamp > 24 * 60 * 60 * 1000) return;

        const track = queue.find(t => t.id === trackId);
        if (track && audioRef.current) {
          audioRef.current.src = track.audioUrl;
          audioRef.current.currentTime = savedProgress;
          setCurrentTrack(track);
          setProgress(savedProgress);
          // Don't auto-play, just set up the track
        }
      } catch (e) {
        console.error("Error restoring session:", e);
      }
    };

    restoreSession();
  }, [queue.length]);

  // Store repeatMode in a ref so the ended handler always sees current value
  const repeatModeRef = useRef(repeatMode);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  // Store autoplay in a ref
  const autoplayRef = useRef(autoplay);
  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);

  // Create audio element ONCE on mount — never recreate it
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;
    audioRef.current.crossOrigin = "anonymous"; // Required for Web Audio API with external URLs

    const audio = audioRef.current;

    // Initialize Web Audio API
    const initWebAudio = () => {
      if (audioContextRef.current) return;

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const context = new AudioContextClass();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        const source = context.createMediaElementSource(audio);

        // IMPORTANT: Connect source -> analyser -> destination
        // This ensures audio is routed to the speakers
        source.connect(analyser);
        analyser.connect(context.destination);

        audioContextRef.current = context;
        analyserRef.current = analyser;
        sourceRef.current = source;
        console.log("Web Audio API initialized");
      } catch (err) {
        console.error("Failed to initialize Web Audio API:", err);
      }
    };

    // User interaction is required to start AudioContext in some browsers
    const handleFirstInteraction = () => {
      initWebAudio();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);

    const handleTimeUpdate = () => {
      setProgress(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      if (repeatModeRef.current === "one") {
        audio.currentTime = 0;
        audio.play();
      } else {
        nextTrack();
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
    };
  }, []); // Empty deps — audio element lives for app lifetime

  // Record play to MongoDB
  const recordPlay = async (track: Track) => {
    if (!user) return;
    try {
      const isExternal = track.id.startsWith("jiosaavn_");

      if (isExternal) {
        // Store metadata for external songs
        await recentlyPlayedApi.addWithMetadata(user.id, track.id, {
          title: track.title,
          artist: track.artist,
          artistId: track.artistId,
          coverUrl: track.coverUrl,
          audioUrl: track.audioUrl,
          duration: track.duration,
        });
      } else {
        // Local song - just store the ID, skip incrementPlays for invalid IDs
        try {
          await recentlyPlayedApi.add(user.id, track.id);
          await songsApi.incrementPlays(track.id);
        } catch {
          // Silently fail for non-MongoDB IDs
        }
      }
    } catch (error) {
      console.error("Error recording play:", error);
    }
  };

  const playTrack = async (track: Track) => {
    if (audioRef.current) {
      // Ensure the track exists in the queue
      setQueue(prev => {
        const exists = prev.some(t => t.id === track.id);
        if (!exists) {
          // If there's a current track, insert after it; otherwise append
          const ct = currentTrackRef.current;
          const currentIdx = ct ? prev.findIndex(t => t.id === ct.id) : -1;
          if (currentIdx >= 0) {
            const newQueue = [...prev];
            newQueue.splice(currentIdx + 1, 0, track);
            return newQueue;
          }
          return [...prev, track];
        }
        return prev;
      });

      let audioUrl = track.audioUrl;

      // For JioSaavn tracks, always verify we have a valid audio URL
      // Search results and artist pages sometimes don't include the stream URL
      if (track.id.startsWith("jiosaavn_") && (!audioUrl || audioUrl.length < 10)) {
        try {
          console.log("Fetching audio URL for:", track.title);
          const songData = await jiosaavnApi.getSong(track.id);
          if (songData?.audioUrl) {
            audioUrl = songData.audioUrl;
            // Update the track with the resolved URL
            track = { ...track, audioUrl };
          }
        } catch (err) {
          console.error("Failed to fetch song URL:", err);
        }
      }

      if (!audioUrl) {
        console.warn("No audio URL available for track:", track.title);
        // Still set track for display but audio won't play
      }

      audioRef.current.src = audioUrl || "";
      audioRef.current.play().catch((err) => {
        console.error("Playback error:", err);
      });
      setCurrentTrack(track);
      setIsPlaying(true);
      recordPlay(track);
    }
  };

  const pauseTrack = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const resumeTrack = () => {
    audioRef.current?.play();
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (isPlaying) {
      pauseTrack();
    } else if (currentTrack) {
      resumeTrack();
    } else if (queue.length > 0) {
      playTrack(queue[0]);
    }
  };

  const fetchRelatedSong = async (track: Track): Promise<Track | null> => {
    try {
      let songs: any[] = [];
      const currentQueue = queueRef.current;

      // Priority 1: Search by mood tag (e.g. "romantic hindi songs")
      const moodTag = track.tags?.find(t =>
        ["Romantic", "Sad", "Party", "Chill", "Devotional"].includes(t)
      );
      if (moodTag) {
        console.log("Autoplay: searching by mood -", moodTag);
        const res = await jiosaavnApi.getSongsByMood(moodTag, 1, 15);
        songs = res.songs;
      }

      // Priority 2: If no mood or too few results, try artist + mood
      if (songs.length < 3 && track.artist) {
        const artistQuery = moodTag
          ? `${track.artist} ${moodTag} songs`
          : track.artist;
        console.log("Autoplay: searching by artist -", artistQuery);
        const res = await jiosaavnApi.searchSongs(artistQuery, 1, 15);
        songs = [...songs, ...res.songs];
      }

      // Priority 3: Search by song title + "similar songs"
      if (songs.length < 3) {
        console.log("Autoplay: searching similar to -", track.title);
        const res = await jiosaavnApi.searchSongs(
          `${track.title} similar songs`, 1, 10
        );
        songs = [...songs, ...res.songs];
      }

      // Priority 4: Fallback to trending (never hard-code a genre)
      if (songs.length === 0) {
        console.log("Autoplay: falling back to trending");
        const res = await jiosaavnApi.getTrending();
        songs = res.songs;
      }

      // Deduplicate by id
      const seen = new Set<string>();
      songs = songs.filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      // Filter out songs already in queue or the current track
      const validSongs = songs.filter(s =>
        s.id !== track.id &&
        !currentQueue.some(q => q.id === s.id)
      );

      if (validSongs.length > 0) {
        // Pick a random one from the top results for variety
        const topResults = validSongs.slice(0, 5);
        const random = topResults[Math.floor(Math.random() * topResults.length)];
        console.log("Autoplay: next song -", random.title, random.artist);
        return random;
      }
    } catch (e) {
      console.error("Autoplay fetch failed", e);
    }
    return null;
  };

  const nextTrack = async () => {
    // Use refs to always get the latest state (avoids stale closure from handleEnded)
    const ct = currentTrackRef.current;
    const q = queueRef.current;
    if (!ct || q.length === 0) return;

    const currentIndex = q.findIndex((t) => t.id === ct.id);
    let nextIndex: number = -1;

    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * q.length);
      // Avoid repeating the same song if possible
      if (nextIndex === currentIndex && q.length > 1) {
        nextIndex = (currentIndex + 1) % q.length;
      }
    } else {
      nextIndex = currentIndex + 1;
    }

    // Check if we reached the end of the queue
    if (nextIndex >= q.length) {
      if (repeatModeRef.current === "all") {
        nextIndex = 0; // Loop back to start
      } else if (autoplayRef.current) {
        // Autoplay logic: Fetch a related song and add to queue
        console.log("Queue ended, fetching related song...");
        const related = await fetchRelatedSong(ct);
        if (related) {
          // Add to queue and play immediately
          setQueue(prev => [...prev, related]);
          playTrack(related);
          return;
        } else {
          // If fetch fails, stop playback
          pauseTrack();
          return;
        }
      } else {
        // Stop playback
        pauseTrack();
        return;
      }
    }

    playTrack(q[nextIndex]);
  };

  const previousTrack = () => {
    if (!currentTrack || queue.length === 0) return;

    if (progress > 3) {
      seekTo(0);
      return;
    }

    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    playTrack(queue[prevIndex]);
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const setVolume = (newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setVolumeState(newVolume);
  };

  const toggleShuffle = () => {
    setIsShuffled(!isShuffled);
  };

  const toggleRepeat = () => {
    const modes: Array<"none" | "one" | "all"> = ["none", "one", "all"];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  };

  const toggleAutoplay = () => {
    setAutoplay(!autoplay);
  };

  const addToQueue = (track: Track) => {
    setQueue((prev) => [...prev, track]);
  };

  const removeFromQueue = (trackId: string) => {
    setQueue((prev) => prev.filter((t) => t.id !== trackId));
  };

  const setSleepTimer = (minutes: number | null) => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    if (minutes) {
      setSleepTimerState(minutes);
      sleepTimerRef.current = setTimeout(() => {
        pauseTrack();
        setSleepTimerState(null);
      }, minutes * 60 * 1000);
    } else {
      setSleepTimerState(null);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying,
        progress,
        duration,
        volume,
        isShuffled,
        repeatMode,
        isLoading,
        sleepTimer,
        autoplay,
        audioElement: audioRef.current,
        playTrack,
        pauseTrack,
        resumeTrack,
        togglePlay,
        nextTrack,
        previousTrack,
        seekTo,
        setVolume,
        toggleShuffle,
        toggleRepeat,
        toggleAutoplay,
        addToQueue,
        removeFromQueue,
        setQueue,
        loadSongs,
        setSleepTimer,
        analyser: analyserRef.current,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
