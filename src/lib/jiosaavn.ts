// Direct JioSaavn API client - no Supabase edge function proxy
import { deduplicateSongs } from "./musicUtils";

export interface JioSaavnTrack {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  album?: string;
  year?: string;
  language?: string;
  playCount?: string;
  hasLyrics?: boolean;
  tags?: string[];
  isExternal: true;
  source: "jiosaavn";
}

export interface JioSaavnArtist {
  id: string;
  name: string;
  avatarUrl: string;
  followerCount?: string;
  isVerified?: boolean;
  bio?: string;
  isExternal: true;
  source: "jiosaavn";
  topSongs?: JioSaavnTrack[];
}

const API_BASE = "https://jiosaavn-api-two-rust.vercel.app";

interface SongImage {
  quality: string;
  url: string;
}

interface SongDownload {
  quality: string;
  url: string;
}

async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

function formatSong(song: any): JioSaavnTrack {
  const highQualityImage = (song.image?.find((img: SongImage) => img.quality === "500x500")?.url
    || song.image?.[song.image.length - 1]?.url
    || "").replace("150x150", "500x500").replace("50x50", "500x500");

  const highQualityAudio = song.downloadUrl?.find((dl: SongDownload) => dl.quality === "320kbps")?.url
    || song.downloadUrl?.find((dl: SongDownload) => dl.quality === "160kbps")?.url
    || song.downloadUrl?.[song.downloadUrl.length - 1]?.url
    || "";

  // 1. Clean up Artist (Lead Singer only)
  let artistName = "Unknown Artist";
  if (song.primaryArtists) {
    artistName = song.primaryArtists.split(",")[0].trim();
  } else if (song.artists?.primary?.length) {
    artistName = song.artists.primary[0].name;
  } else if (song.artist) {
    artistName = song.artist.split(",")[0].trim();
  } else if (song.singers) {
    artistName = song.singers.split(",")[0].trim();
  }

  // 2. Clean up Title
  let cleanTitle = song.name || song.title || "";

  // Decode HTML entities (basic)
  cleanTitle = cleanTitle
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'");

  // Remove content in parentheses, e.g., "(From Movie)" or "(feat. X)" if user wants STRICTLY song name
  // The user said "only the name of the song". 
  // Strategies: 
  // 1. Remove " (From ...)" patterns specifically.
  // 2. Remove anything after " - " if it looks like metadata.

  // Cleaning " - Title Track (From ...)" pattern seen in screenshot
  // We want to keep the "Actual Name" but remove the "(From Movie)" part for a cleaner look
  cleanTitle = cleanTitle.split(" (From")[0].split(" - From")[0].split(" [From")[0];
  cleanTitle = cleanTitle.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").trim();

  // Extra safety: if title becomes empty after cleaning (unlikely), fallback to original
  if (!cleanTitle) cleanTitle = song.name || song.title || "Unknown Track";

  // Optional: Remove " - Title Track" if redundant, but user might want to know it's a title track.
  // Let's stick to removing the movie/album context "From X".

  // 3. Infer Tags (Mood/Genre/Era)
  const tags: string[] = [];
  const lowerTitle = cleanTitle.toLowerCase();

  // Moods
  if (lowerTitle.match(/love|ishq|pyar|dil|mohabbat|romantic|tum|ban ja|humnava|aashiqui|anam/)) tags.push("Romantic");
  if (lowerTitle.match(/party|dance|club|remix|dj|nach|sharaab|vodka|daaru|groove|beat/)) tags.push("Party");
  if (lowerTitle.match(/sad|dard|bewafa|lonely|broken|tadap|judai|roi|cry|tears|aina/)) tags.push("Sad");
  if (lowerTitle.match(/lofi|slowed|reverb|chill|sukoon|mashup/)) tags.push("Chill");
  if (lowerTitle.match(/bhakti|ram|krishna|shiv|hanuman|ganesh|mantra|aarti|devotional/)) tags.push("Devotional");

  // Eras
  const yearNum = parseInt(song.year || "0");
  if (yearNum >= 1990 && yearNum < 2000) tags.push("90s");
  if (yearNum >= 2000 && yearNum < 2010) tags.push("00s");
  if (yearNum >= 2025) tags.push("New");

  const artistId = song.primaryArtistsId?.split(",")[0]
    || song.artists?.primary?.[0]?.id
    || "";

  return {
    id: `jiosaavn_${song.id}`,
    title: cleanTitle.trim(),
    artist: artistName,
    artistId: artistId ? `jiosaavn_artist_${artistId}` : "",
    coverUrl: highQualityImage,
    audioUrl: highQualityAudio,
    duration: song.duration || 0,
    album: song.album?.name || song.album || "",
    year: song.year || "",
    language: song.language || "",
    playCount: String(song.playCount || 0),
    hasLyrics: song.hasLyrics || false,
    tags: tags, // Add tags to object
    isExternal: true,
    source: "jiosaavn",
  };
}

function formatArtist(artist: any): JioSaavnArtist {
  const highQualityImage = (artist.image?.find((img: SongImage) => img.quality === "500x500")?.url
    || artist.image?.[artist.image.length - 1]?.url
    || "").replace("150x150", "500x500").replace("50x50", "500x500");

  // Helper to extract bio text safely
  let bioText = "";
  if (Array.isArray(artist.bio)) {
    bioText = artist.bio.map(b => (typeof b === 'string' ? b : (b.text || b.title || ""))).join(" ");
  } else if (typeof artist.bio === 'object' && artist.bio !== null) {
    bioText = artist.bio.text || artist.bio.bio || artist.bio.summary || "";
  } else {
    bioText = artist.bio || "";
  }

  // Clean HTML tags if any
  bioText = bioText.replace(/<[^>]*>?/gm, '');

  // Truncate to short info (e.g., 2 sentences or 150 chars)
  if (bioText.length > 200) {
    bioText = bioText.substring(0, 200) + "...";
  }

  // Fallback if empty or just whitespace
  if (!bioText.trim()) {
    bioText = "One of the most celebrated artists in Indian music.";
  }

  return {
    id: `jiosaavn_artist_${artist.id}`,
    name: artist.name,
    avatarUrl: highQualityImage,
    followerCount: String(artist.followerCount || artist.fanCount || 0),
    isVerified: artist.isVerified || false,
    bio: bioText,
    isExternal: true,
    source: "jiosaavn",
    topSongs: artist.topSongs?.map(formatSong) || [],
  };
}

export const jiosaavnApi = {
  searchSongs: async (query: string, page = 1, limit = 20) => {
    const data = await fetchApi<any>(
      `/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
    );
    if (!data.success) throw new Error(data.message || "Search failed");
    return {
      songs: data.data?.results?.map(formatSong) || [],
      total: data.data?.total || 0,
    };
  },

  searchArtists: async (query: string) => {
    const data = await fetchApi<any>(
      `/api/search/artists?query=${encodeURIComponent(query)}`
    );
    if (!data.success) throw new Error(data.message || "Search failed");
    return {
      artists: data.data?.results?.map((a: any) => ({
        id: `jiosaavn_artist_${a.id}`,
        name: a.name,
        avatarUrl: a.image?.[a.image?.length - 1]?.url || "",
        isExternal: true,
        source: "jiosaavn" as const,
      })) || [],
      total: data.data?.total || 0,
    };
  },

  searchAll: async (query: string) => {
    const data = await fetchApi<any>(
      `/api/search?query=${encodeURIComponent(query)}`
    );
    if (!data.success) throw new Error(data.message || "Search failed");
    return {
      songs: data.data?.songs?.results?.map(formatSong) || [],
      artists: data.data?.artists?.results?.map((a: any) => ({
        id: `jiosaavn_artist_${a.id}`,
        name: a.title || a.name,
        avatarUrl: a.image?.[a.image?.length - 1]?.url || "",
        isExternal: true,
        source: "jiosaavn" as const,
      })) || [],
      albums: data.data?.albums?.results || [],
      playlists: data.data?.playlists?.results || [],
    };
  },

  getSong: async (songId: string) => {
    const cleanId = songId.replace("jiosaavn_", "");
    const data = await fetchApi<any>(`/api/songs/${cleanId}`);
    if (!data.success) throw new Error(data.message || "Song not found");
    const song = data.data?.[0];
    if (!song) throw new Error("Song not found");
    return formatSong(song);
  },

  getArtist: async (artistId: string) => {
    const cleanId = artistId.replace("jiosaavn_artist_", "");
    const data = await fetchApi<any>(`/api/artists/${cleanId}`);
    if (!data.success) throw new Error(data.message || "Artist not found");
    return formatArtist(data.data);
  },

  getArtistSongs: async (artistId: string, page = 1) => {
    const cleanId = artistId.replace("jiosaavn_artist_", "");
    const data = await fetchApi<any>(`/api/artists/${cleanId}/songs?page=${page}`);
    if (!data.success) throw new Error(data.message || "Failed to get artist songs");
    return {
      songs: data.data?.songs?.map(formatSong) || [],
      total: data.data?.total || 0,
    };
  },

  getAlbum: async (albumId: string) => {
    // Since the public API might not have a direct endpoint for album details 
    // without a specific ID format or hidden endpoint, we might need to rely on search 
    // or the song list if we have it. 
    // However, for Dhurandhar, we know the songs.
    // Let's add a generic fetch if possible, or we will handle it in the component.
    // Actually, let's try to add a method that uses the searchAll to get the album metadata if needed,
    // or just returns the provided structure.
    // For now, let's implement a specific method to getting album songs if the ID is known
    // But wait, the previous `check_album.ts` showed `fetchApi('/api/albums?id=...')` works!
    const cleanId = albumId.replace("jiosaavn_album_", "");
    const data = await fetchApi<any>(`/api/albums?id=${cleanId}`);
    if (!data.success) throw new Error(data.message || "Album not found");

    return {
      id: `jiosaavn_album_${data.data.id}`,
      title: data.data.name,
      artist: data.data.primaryArtists || data.data.artist || "Unknown Artist",
      coverUrl: data.data.image?.[2]?.url || data.data.image?.[1]?.url || "",
      songs: data.data.songs?.map(formatSong) || [],
      songCount: data.data.songCount || 0
    };
  },

  getTrending: async (pageOrLanguage: number | string = 1, limit = 40) => {
    const page = typeof pageOrLanguage === "number" ? pageOrLanguage : 1;
    let songs: JioSaavnTrack[] = [];

    // 1. Try fetching from the specific trending playlist
    try {
      if (page === 1) {
        const data = await fetchApi<any>(`/api/playlists?id=110858205`);
        if (data.success && data.data?.songs) {
          songs = data.data.songs.map(formatSong);
        }
      }
    } catch (e) {
      console.error("Trending playlist fetch failed", e);
    }

    // 2. Always fetch "Top Hindi" or similar to ensure we have volume
    // If playlist gave us < limit, fetch more
    if (songs.length < limit) {
      try {
        const searchRes = await jiosaavnApi.searchSongs("top hindi songs", page, limit);
        if (searchRes.songs) {
          songs = [...songs, ...searchRes.songs];
        }

        // Fetch a bit more variety if still low
        const searchRes2 = await jiosaavnApi.searchSongs("trending bollywood", page, limit);
        if (searchRes2.songs) {
          songs = [...songs, ...searchRes2.songs];
        }
      } catch (e) {
        console.error("Trending fallback search failed", e);
      }
    }

    return {
      songs: deduplicateSongs(songs),
      name: "Trending",
      total: songs.length
    };
  },

  getNewReleases: async (page = 1, limit = 20) => {
    return jiosaavnApi.searchSongs("new hindi songs", page, limit);
  },


  getFeaturedAlbums: async () => {
    // Extended list of queries for variety
    const featuredQueries = [
      // --- Devotional ---
      { name: "Devotional Hits", query: "best bhakti songs hindi" },
      { name: "Krishna Bhajans", query: "krishna bhajans hits" },
      { name: "Ganpati Bappa Morya", query: "ganpati top hits" },
      { name: "Mata Ke Bhajans", query: "durga maa songs" },

      // --- Regional Blockbusters ---
      { name: "Tamil Top Hits", query: "tamil top 50 hits" },
      { name: "Marathi Blockbusters", query: "marathi hit songs sanju rathod" },
      { name: "Punjabi Pop Hits", query: "punjabi top 50 hits" },
      { name: "Telugu Chartbusters", query: "telugu top hits" },

      // --- Trending & Bollywood ---
      { name: "Hot Hits Hindi", query: "hot hits hindi" },
      { name: "Trending Now Hindi", query: "trending now hindi" },
      { name: "Bollywood Mush", query: "best bollywood mush songs" },
      { name: "Trending Valentine's", query: "romantic hindi songs" },
      { name: "Bollywood Dance Music", query: "bollywood dance music" },
      { name: "Party Anthems", query: "bollywood party hits" },

      // --- Decades & Eras ---
      { name: "Old is Gold", query: "mohammad rafi kishore kumar hits" }, // Better cover likelihood
      { name: "90s Evergreen Hits", query: "kumar sanu alka yagnik hits" }, // Iconic 90s
      { name: "All Out Hindi 00s", query: "best of 2000s hindi" },
      { name: "All Out Hindi 10s", query: "all out hindi 2010s" },
      { name: "Retro Romance", query: "old romantic hindi songs" },

      // --- Moods & Genres ---
      { name: "Sad Hindi Melodies", query: "sad hindi melodies" },
      { name: "Bollywood & Chill", query: "bollywood chill" },
      { name: "Lofi Hindi", query: "lofi flip hindi" },
      { name: "PHONK Hindi", query: "phonk hindi" },

      // --- Artist Spotlights (Replacements) ---
      { name: "Arijit Singh Favorites", query: "arijit singh best songs" },
      { name: "Atif Aslam Hits", query: "atif aslam hits" },
      { name: "Yo Yo Honey Singh", query: "yo yo honey singh hits" },

      // --- Activities ---
      { name: "Long Drive", query: "long drive hindi songs" },
      { name: "Morning Vibes", query: "morning peaceful hindi songs" },
      { name: "Gym Workout", query: "hindi workout motivational" },
      { name: "Sleep & Relax", query: "sleep hindi songs instrumental" },

      // --- Others ---
      { name: "Happy Vibes", query: "feel good hindi songs" }, // "Feel good" usually has better covers
      { name: "#GRWM Hindi", query: "grwm hindi hits" },
      { name: "Filmy Hangover", query: "filmy hangover hindi" },
      { name: "Mega Hits Collection", query: "mega hits bollywood" }
    ];

    // Use fixed order for consistency - exactly as user requested
    // No shuffling, no random pages, no limits.
    const fixedQueries = featuredQueries;

    const albums: any[] = [];

    // Process all queries in batches
    // Reduced batch size to prevent hitting API rate limits or timeouts
    for (let i = 0; i < fixedQueries.length; i += 4) {
      const batch = fixedQueries.slice(i, i + 4);
      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            // ALWAYS use page 1 to ensure the content is consistent (no "some new coming")
            const consistentPage = 1;

            // Fetch 50 songs to ensure we have enough after deduplication
            const result = await jiosaavnApi.searchSongs(item.query, consistentPage, 50);
            if (!result.songs?.length) return null;

            const uniqueSongs = deduplicateSongs<JioSaavnTrack>(result.songs).slice(0, 40);
            if (uniqueSongs.length < 5) return null;

            // Encode query in ID to ensure AlbumDetails fetches the same data
            // Format: featured_Name:::Query
            // This fixes the issue where "Marathi Blockbusters" ID searched for "Marathi Blockbusters" instead of "sanju rathod..."
            const safeName = item.name.replace(/\s/g, "_");
            const safeQuery = encodeURIComponent(item.query);

            return {
              id: `featured_${safeName}:::${safeQuery}`,
              title: item.name,
              artist: "Various Artists",
              coverUrl: uniqueSongs[0]?.coverUrl || "",
              songCount: uniqueSongs.length,
              songs: uniqueSongs,
              isFeatured: true
            };
          } catch (err) {
            console.error(`Failed to load featured album ${item.name}:`, err);
            return null;
          }
        })
      );
      albums.push(...batchResults.filter(Boolean));
      // No break limit - fetch ALL configured albums
    }
    return albums;
  },

  getSongsByMood: async (mood: string, page = 1, limit = 20) => {
    // Multiple queries per mood for better coverage
    const moodQueries: Record<string, string[]> = {
      romantic: [
        "romantic hindi songs",
        "love bollywood songs",
        "romantic bollywood hits",
      ],
      sad: [
        "sad hindi songs",
        "heartbreak bollywood songs",
        "dard bhare gaane hindi",
      ],
      party: [
        "party bollywood dance songs",
        "bollywood dance hits",
        "hindi party songs dj",
      ],
      chill: [
        "lofi hindi chill songs",
        "bollywood unplugged acoustic",
        "soft romantic hindi songs",
      ],
      devotional: [
        "bhakti devotional hindi songs",
        "aarti bhajan hindi",
        "devotional songs hindi",
      ],
      workout: [
        "hindi gym workout songs",
        "bollywood motivation songs",
        "high energy hindi songs",
      ],
    };

    const queries = moodQueries[mood.toLowerCase()] || [`${mood} hindi songs`];

    // For page 1, try multiple queries to gather enough songs
    if (page === 1) {
      let allSongs: any[] = [];
      const seenIds = new Set<string>();

      for (const query of queries) {
        if (allSongs.length >= limit) break;
        try {
          const result = await jiosaavnApi.searchSongs(query, 1, limit);
          for (const song of (result.songs || [])) {
            if (!seenIds.has(song.id)) {
              seenIds.add(song.id);
              allSongs.push(song);
            }
          }
        } catch (e) {
          console.error(`Mood query failed: ${query}`, e);
        }
      }

      return { songs: allSongs.slice(0, limit) };
    }

    // For subsequent pages, use the primary query
    return jiosaavnApi.searchSongs(queries[0], page, limit);
  },

  getLyrics: async (songId: string, title?: string, artist?: string) => {
    // Help decode HTML entities (like &quot;) in titles/artists
    const decodeEntities = (str: string) => {
      const entities: Record<string, string> = {
        '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&apos;': "'", '&#039;': "'"
      };
      return str.replace(/&[#\w\d]+;/g, (m) => entities[m] || m);
    };

    let searchTitle = decodeEntities(title || "");
    let searchArtist = decodeEntities(artist || "");

    // If we don't have title or artist, we must fetch song details first
    if (!searchTitle || !searchArtist) {
      try {
        const songData = await jiosaavnApi.getSong(songId);
        searchTitle = decodeEntities(songData.title);
        searchArtist = decodeEntities(songData.artist);
      } catch (err) {
        console.error("Failed to fetch song details for lyrics:", err);
        return { lyrics: "", copyright: "" };
      }
    }

    // Prepare artist list for multiple attempts
    const artistList = searchArtist.split(",").map(a => a.trim()).filter(Boolean);
    const cleanTitle = searchTitle.replace(/\(.*?\)/g, "").trim();

    // 1. Try LRCLIB (Primary - for synced lyrics)
    try {
      // Use search API which is often more robust for specific metadata
      const searchRes = await fetch(
        `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artistList[0])}&track_name=${encodeURIComponent(cleanTitle)}`
      );

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData && searchData.length > 0) {
          // Find the best match (e.g., preference for synced lyrics)
          const bestMatch = searchData.find((s: any) => s.syncedLyrics) || searchData[0];
          const content = bestMatch.syncedLyrics || bestMatch.plainLyrics;
          if (content) {
            return {
              lyrics: content,
              copyright: "Lyrics provided by LRCLIB",
              isSynced: !!bestMatch.syncedLyrics
            };
          }
        }
      }
    } catch (err) {
      console.error("LRCLIB search failed:", err);
    }

    // 2. Try specific LRCLIB direct get for individual artists in parallel
    const lrclibResults = await Promise.all(
      artistList.map(async (singer) => {
        try {
          const res = await fetch(
            `https://lrclib.net/api/get?artist_name=${encodeURIComponent(singer)}&track_name=${encodeURIComponent(cleanTitle)}`
          );
          if (res.ok) {
            const data = await res.json();
            return data.syncedLyrics || data.plainLyrics ? data : null;
          }
        } catch {
          return null;
        }
        return null;
      })
    );

    const firstValidLrc = lrclibResults.find(r => r !== null);
    if (firstValidLrc) {
      return {
        lyrics: firstValidLrc.syncedLyrics || firstValidLrc.plainLyrics,
        copyright: "Lyrics provided by LRCLIB",
        isSynced: !!firstValidLrc.syncedLyrics
      };
    }

    // 3. Try JioSaavn native lyrics (Secondary)
    try {
      const cleanId = songId.replace("jiosaavn_", "");
      const data = await fetchApi<any>(`/api/songs/${cleanId}/lyrics`);
      if (data.success && data.data?.lyrics) {
        return { lyrics: data.data.lyrics, copyright: data.data.copyright || "" };
      }
    } catch {
      // fallback
    }

    // 3. Final Fallback: lyrics.ovh with multi-artist fallback
    for (const singer of artistList) {
      try {
        const res = await fetch(
          `https://api.lyrics.ovh/v1/${encodeURIComponent(singer)}/${encodeURIComponent(cleanTitle)}`
        );
        if (res.ok) {
          const lyricsData = await res.json();
          if (lyricsData.lyrics) {
            return { lyrics: lyricsData.lyrics, copyright: "Lyrics provided by lyrics.ovh" };
          }
        }
      } catch {
        // failed
      }
    }

    return { lyrics: "", copyright: "" };
  },
};
