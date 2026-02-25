import { supabase } from "@/integrations/supabase/client";

const SONGS_FUNCTION = "mongodb-songs";
const DATA_FUNCTION = "mongodb-data";

// Helper to call MongoDB edge functions
async function callMongoFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    console.error(`MongoDB function error (${functionName}):`, error);
    throw error;
  }

  return data as T;
}

// ============ SONGS API ============

export interface MongoSong {
  _id: string;
  title: string;
  artistId: string;
  artistName: string;
  audioUrl: string;
  coverUrl?: string;
  duration?: number;
  mood?: string;
  lyrics?: string;
  plays?: number;
  createdAt?: string;
}

export interface MongoArtist {
  _id: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  createdAt?: string;
}

export const songsApi = {
  getAll: (limit = 50, skip = 0) =>
    callMongoFunction<{ songs: MongoSong[] }>(SONGS_FUNCTION, {
      action: "get_all_songs",
      limit,
      skip,
    }),

  getById: (songId: string) =>
    callMongoFunction<{ song: MongoSong | null }>(SONGS_FUNCTION, {
      action: "get_song",
      songId,
    }),

  search: (search: string, limit = 20) =>
    callMongoFunction<{ songs: MongoSong[] }>(SONGS_FUNCTION, {
      action: "search_songs",
      search,
      limit,
    }),

  getByMood: (mood: string, limit = 20) =>
    callMongoFunction<{ songs: MongoSong[] }>(SONGS_FUNCTION, {
      action: "get_songs_by_mood",
      mood,
      limit,
    }),

  getByArtist: (artistId: string) =>
    callMongoFunction<{ songs: MongoSong[] }>(SONGS_FUNCTION, {
      action: "get_songs_by_artist",
      artistId,
    }),

  getTrending: (limit = 10) =>
    callMongoFunction<{ songs: MongoSong[] }>(SONGS_FUNCTION, {
      action: "get_trending_songs",
      limit,
    }),

  getRecent: (limit = 10) =>
    callMongoFunction<{ songs: MongoSong[] }>(SONGS_FUNCTION, {
      action: "get_recent_songs",
      limit,
    }),

  incrementPlays: (songId: string) =>
    callMongoFunction<{ success: boolean }>(SONGS_FUNCTION, {
      action: "increment_plays",
      songId,
    }),

  add: (data: Omit<MongoSong, "_id">) =>
    callMongoFunction<{ success: boolean; songId: string }>(SONGS_FUNCTION, {
      action: "add_song",
      data,
    }),

  update: (songId: string, data: Partial<MongoSong>) =>
    callMongoFunction<{ success: boolean }>(SONGS_FUNCTION, {
      action: "update_song",
      songId,
      data,
    }),

  delete: (songId: string) =>
    callMongoFunction<{ success: boolean }>(SONGS_FUNCTION, {
      action: "delete_song",
      songId,
    }),
};

// ============ ARTISTS API ============

export const artistsApi = {
  getAll: () =>
    callMongoFunction<{ artists: MongoArtist[] }>(SONGS_FUNCTION, {
      action: "get_all_artists",
    }),

  getById: (artistId: string) =>
    callMongoFunction<{ artist: MongoArtist | null }>(SONGS_FUNCTION, {
      action: "get_artist",
      artistId,
    }),

  search: (search: string, limit = 10) =>
    callMongoFunction<{ artists: MongoArtist[] }>(SONGS_FUNCTION, {
      action: "search_artists",
      search,
      limit,
    }),

  add: (data: Omit<MongoArtist, "_id">) =>
    callMongoFunction<{ success: boolean; artistId: string }>(SONGS_FUNCTION, {
      action: "add_artist",
      data,
    }),

  update: (artistId: string, data: Partial<MongoArtist>) =>
    callMongoFunction<{ success: boolean }>(SONGS_FUNCTION, {
      action: "update_artist",
      artistId,
      data,
    }),

  delete: (artistId: string) =>
    callMongoFunction<{ success: boolean }>(SONGS_FUNCTION, {
      action: "delete_artist",
      artistId,
    }),
};

// ============ FAVORITES API ============

export const favoritesApi = {
  getAll: (userId: string, limit = 100) =>
    callMongoFunction<{ favorites: { songId: string; createdAt: string }[] }>(
      DATA_FUNCTION,
      { action: "get_favorites", collection: "favorites", userId, limit }
    ),

  getSongIds: (userId: string) =>
    callMongoFunction<{ songIds: string[] }>(DATA_FUNCTION, {
      action: "get_user_favorites_ids",
      collection: "favorites",
      userId,
    }),

  add: (userId: string, songId: string) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "add_favorite",
      collection: "favorites",
      userId,
      songId,
    }),

  remove: (userId: string, songId: string) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "remove_favorite",
      collection: "favorites",
      userId,
      songId,
    }),

  check: (userId: string, songId: string) =>
    callMongoFunction<{ isFavorite: boolean }>(DATA_FUNCTION, {
      action: "check_favorite",
      collection: "favorites",
      userId,
      songId,
    }),

  addExternal: (userId: string, songId: string, metadata: {
    title: string;
    artist: string;
    artistId: string;
    coverUrl: string;
    audioUrl: string;
    duration: number;
  }) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "add_external_favorite",
      collection: "favorites",
      userId,
      songId,
      data: { isExternal: true, metadata },
    }),
};

// ============ RECENTLY PLAYED API ============

export interface RecentlyPlayedMetadata {
  title: string;
  artist: string;
  artistId: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
}

export const recentlyPlayedApi = {
  getAll: (userId: string, limit = 50) =>
    callMongoFunction<{ history: { songId: string; playedAt: string; isExternal?: boolean; metadata?: RecentlyPlayedMetadata }[] }>(
      DATA_FUNCTION,
      { action: "get_recently_played", collection: "recently_played", userId, limit }
    ),

  add: (userId: string, songId: string) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "add_recently_played",
      collection: "recently_played",
      userId,
      songId,
    }),

  addWithMetadata: (userId: string, songId: string, metadata: RecentlyPlayedMetadata) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "add_recently_played_with_metadata",
      collection: "recently_played",
      userId,
      songId,
      data: { metadata },
    }),

  clear: (userId: string) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "clear_recently_played",
      collection: "recently_played",
      userId,
    }),
};

// ============ PLAYLISTS API ============

export interface SongMetadata {
  title: string;
  artist: string;
  artistId: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
}

export interface MongoPlaylist {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
  songs: string[];
  songMetadata?: Record<string, SongMetadata>;
  createdAt?: string;
  updatedAt?: string;
}

export const playlistsApi = {
  getAll: (userId: string) =>
    callMongoFunction<{ playlists: MongoPlaylist[] }>(DATA_FUNCTION, {
      action: "get_playlists",
      collection: "playlists",
      userId,
    }),

  getById: (playlistId: string) =>
    callMongoFunction<{ playlist: MongoPlaylist | null }>(DATA_FUNCTION, {
      action: "get_playlist",
      collection: "playlists",
      playlistId,
    }),

  create: (userId: string, data: { name: string; description?: string; isPublic?: boolean }) =>
    callMongoFunction<{ success: boolean; playlistId: string }>(DATA_FUNCTION, {
      action: "create_playlist",
      collection: "playlists",
      userId,
      data,
    }),

  update: (playlistId: string, data: Partial<MongoPlaylist>) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "update_playlist",
      collection: "playlists",
      playlistId,
      data,
    }),

  delete: (playlistId: string) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "delete_playlist",
      collection: "playlists",
      playlistId,
    }),

  addSong: (playlistId: string, songId: string) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "add_song_to_playlist",
      collection: "playlists",
      playlistId,
      songId,
    }),

  addSongWithMetadata: (playlistId: string, songId: string, metadata: SongMetadata) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "add_song_to_playlist_with_metadata",
      collection: "playlists",
      playlistId,
      songId,
      data: { metadata },
    }),

  removeSong: (playlistId: string, songId: string) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "remove_song_from_playlist",
      collection: "playlists",
      playlistId,
      songId,
    }),
};

// ============ USER PROFILES API ============

export interface MongoProfile {
  _id?: string;
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const profilesApi = {
  get: (userId: string) =>
    callMongoFunction<{ profile: MongoProfile | null }>(DATA_FUNCTION, {
      action: "get_profile",
      collection: "user_profiles",
      userId,
    }),

  upsert: (userId: string, data: Partial<MongoProfile>) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "upsert_profile",
      collection: "user_profiles",
      userId,
      data,
    }),

  getStats: (userId: string) =>
    callMongoFunction<{ stats: { totalFavorites: number; totalPlays: number; playlistCount: number } }>(
      DATA_FUNCTION,
      { action: "get_user_stats", collection: "user_profiles", userId }
    ),
};

// ============ FOLLOWS API ============

export const followsApi = {
  getAll: (userId: string) =>
    callMongoFunction<{ follows: { artistId: string; createdAt: string }[] }>(
      DATA_FUNCTION,
      { action: "get_follows", collection: "follows", userId }
    ),

  follow: (userId: string, artistId: string) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "follow_artist",
      collection: "follows",
      userId,
      artistId,
    }),

  unfollow: (userId: string, artistId: string) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "unfollow_artist",
      collection: "follows",
      userId,
      artistId,
    }),

  check: (userId: string, artistId: string) =>
    callMongoFunction<{ isFollowing: boolean }>(DATA_FUNCTION, {
      action: "check_following",
      collection: "follows",
      userId,
      artistId,
    }),
};

// ============ SITE SETTINGS API ============

export interface AboutUsSettings {
  description: string;
  primaryEmail: string;
  businessEmail: string;
  phone: string;
  instagram: string;
  instagram2: string;
}

export const siteSettingsApi = {
  getAboutUs: () =>
    callMongoFunction<{ settings: AboutUsSettings | null }>(DATA_FUNCTION, {
      action: "get_site_settings",
      collection: "site_settings",
    }),

  updateAboutUs: (data: AboutUsSettings) =>
    callMongoFunction<{ success: boolean }>(DATA_FUNCTION, {
      action: "update_site_settings",
      collection: "site_settings",
      data,
    }),
};
