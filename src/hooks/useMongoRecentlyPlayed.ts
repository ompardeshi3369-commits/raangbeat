import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { recentlyPlayedApi, RecentlyPlayedMetadata } from "@/lib/mongodb";

export interface RecentlyPlayedItem {
  songId: string;
  playedAt: string;
  isExternal?: boolean;
  metadata?: RecentlyPlayedMetadata;
}

export function useMongoRecentlyPlayed() {
  const { user } = useAuth();
  const [history, setHistory] = useState<RecentlyPlayedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { history: data } = await recentlyPlayedApi.getAll(user.id);
      setHistory(data || []);
    } catch (err) {
      console.error("Error loading recently played from MongoDB:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const addToHistory = useCallback(async (songId: string) => {
    if (!user) return;
    try {
      await recentlyPlayedApi.add(user.id, songId);
      // Update local state
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.songId !== songId);
        return [{ songId, playedAt: new Date().toISOString() }, ...filtered];
      });
    } catch (err) {
      console.error("Error adding to recently played:", err);
    }
  }, [user]);

  const clearHistory = useCallback(async () => {
    if (!user) return;
    try {
      await recentlyPlayedApi.clear(user.id);
      setHistory([]);
    } catch (err) {
      console.error("Error clearing history:", err);
    }
  }, [user]);

  const getMetadata = useCallback((songId: string) => {
    const item = history.find(h => h.songId === songId);
    return item?.metadata;
  }, [history]);

  return {
    history,
    isLoading,
    refresh: loadHistory,
    addToHistory,
    clearHistory,
    getMetadata,
  };
}
