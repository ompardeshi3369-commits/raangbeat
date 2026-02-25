import { useState, useEffect, useCallback } from "react";
import { songsApi, artistsApi, MongoSong, MongoArtist } from "@/lib/mongodb";

export function useMongoSongs() {
  const [songs, setSongs] = useState<MongoSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSongs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { songs: data } = await songsApi.getAll(100);
      setSongs(data || []);
    } catch (err) {
      console.error("Error loading songs from MongoDB:", err);
      setError("Failed to load songs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  const searchSongs = useCallback(async (query: string) => {
    if (!query.trim()) return songs;
    try {
      const { songs: results } = await songsApi.search(query);
      return results || [];
    } catch (err) {
      console.error("Error searching songs:", err);
      return [];
    }
  }, [songs]);

  const getSongsByMood = useCallback(async (mood: string) => {
    try {
      const { songs: results } = await songsApi.getByMood(mood);
      return results || [];
    } catch (err) {
      console.error("Error getting songs by mood:", err);
      return [];
    }
  }, []);

  const getTrendingSongs = useCallback(async (limit = 10) => {
    try {
      const { songs: results } = await songsApi.getTrending(limit);
      return results || [];
    } catch (err) {
      console.error("Error getting trending songs:", err);
      return [];
    }
  }, []);

  const incrementPlays = useCallback(async (songId: string) => {
    try {
      await songsApi.incrementPlays(songId);
    } catch (err) {
      console.error("Error incrementing plays:", err);
    }
  }, []);

  return {
    songs,
    isLoading,
    error,
    refresh: loadSongs,
    searchSongs,
    getSongsByMood,
    getTrendingSongs,
    incrementPlays,
  };
}

export function useMongoArtists() {
  const [artists, setArtists] = useState<MongoArtist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadArtists = useCallback(async () => {
    setIsLoading(true);
    try {
      const { artists: data } = await artistsApi.getAll();
      setArtists(data || []);
    } catch (err) {
      console.error("Error loading artists from MongoDB:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArtists();
  }, [loadArtists]);

  return { artists, isLoading, refresh: loadArtists };
}
