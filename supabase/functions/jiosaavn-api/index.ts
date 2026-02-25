import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Working JioSaavn API endpoints
const API_BASE = "https://saavn.sumit.co";

async function fetchApi(path: string): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  
  return await response.json();
}

interface SongImage {
  quality: string;
  url: string;
}

interface SongDownload {
  quality: string;
  url: string;
}

interface RawSong {
  id: string;
  name: string;
  type: string;
  year?: string;
  releaseDate?: string;
  duration?: number;
  label?: string;
  primaryArtists?: string;
  primaryArtistsId?: string;
  featuredArtists?: string;
  explicitContent?: boolean;
  playCount?: number;
  language?: string;
  hasLyrics?: boolean;
  url?: string;
  album?: {
    id: string;
    name: string;
    url: string;
  };
  image?: SongImage[];
  downloadUrl?: SongDownload[];
}

interface RawArtist {
  id: string;
  name: string;
  url?: string;
  type?: string;
  followerCount?: number;
  fanCount?: number;
  isVerified?: boolean;
  dominantLanguage?: string;
  bio?: string[];
  image?: SongImage[];
  topSongs?: RawSong[];
}

function formatSong(song: any) {
  const highQualityImage = song.image?.find((img: SongImage) => img.quality === "500x500")?.url 
    || song.image?.[song.image.length - 1]?.url 
    || "";
  
  const highQualityAudio = song.downloadUrl?.find((dl: SongDownload) => dl.quality === "320kbps")?.url
    || song.downloadUrl?.find((dl: SongDownload) => dl.quality === "160kbps")?.url
    || song.downloadUrl?.[song.downloadUrl.length - 1]?.url
    || "";

  // Handle different API response formats for artist name
  const artistName = song.primaryArtists 
    || song.artists?.primary?.map((a: any) => a.name).join(", ")
    || song.artist
    || song.singers
    || "Unknown Artist";

  const artistId = song.primaryArtistsId?.split(",")[0]
    || song.artists?.primary?.[0]?.id
    || "";

  return {
    id: `jiosaavn_${song.id}`,
    title: song.name || song.title,
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
    isExternal: true,
    source: "jiosaavn"
  };
}

function formatArtist(artist: RawArtist) {
  const highQualityImage = artist.image?.find(img => img.quality === "500x500")?.url 
    || artist.image?.[artist.image.length - 1]?.url 
    || "";

  return {
    id: `jiosaavn_artist_${artist.id}`,
    name: artist.name,
    avatarUrl: highQualityImage,
    followerCount: String(artist.followerCount || 0),
    isVerified: artist.isVerified || false,
    bio: artist.bio?.join(" ") || "",
    isExternal: true,
    source: "jiosaavn",
    topSongs: artist.topSongs?.map(formatSong) || []
  };
}

async function searchSongs(query: string, page: number = 1, limit: number = 20) {
  const data = await fetchApi(
    `/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
  );
  
  if (!data.success) {
    throw new Error(data.message || "Failed to search songs");
  }
  
  return {
    songs: data.data?.results?.map(formatSong) || [],
    total: data.data?.total || 0,
    start: data.data?.start || 0
  };
}

async function searchArtists(query: string, page: number = 1, limit: number = 10) {
  const data = await fetchApi(
    `/api/search/artists?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
  );
  
  if (!data.success) {
    throw new Error(data.message || "Failed to search artists");
  }
  
  return {
    artists: data.data?.results?.map((artist: RawArtist) => ({
      id: `jiosaavn_artist_${artist.id}`,
      name: artist.name,
      avatarUrl: artist.image?.[artist.image.length - 1]?.url || "",
      isExternal: true,
      source: "jiosaavn"
    })) || [],
    total: data.data?.total || 0
  };
}

async function searchAll(query: string) {
  const data = await fetchApi(
    `/api/search?query=${encodeURIComponent(query)}`
  );
  
  if (!data.success) {
    throw new Error(data.message || "Failed to search");
  }
  
  return {
    topQuery: data.data?.topQuery?.results || [],
    songs: data.data?.songs?.results?.map(formatSong) || [],
    albums: data.data?.albums?.results || [],
    artists: data.data?.artists?.results?.map((a: any) => ({
      id: `jiosaavn_artist_${a.id}`,
      name: a.title || a.name,
      avatarUrl: a.image?.[a.image?.length - 1]?.url || "",
      isExternal: true,
      source: "jiosaavn"
    })) || [],
    playlists: data.data?.playlists?.results || []
  };
}

async function getSongDetails(songId: string) {
  const cleanId = songId.replace("jiosaavn_", "");
  
  const data = await fetchApi(`/api/songs/${cleanId}`);
  
  if (!data.success) {
    throw new Error(data.message || "Failed to get song details");
  }
  
  const song = data.data?.[0];
  if (!song) {
    throw new Error("Song not found");
  }
  
  return formatSong(song);
}

async function getArtistDetails(artistId: string) {
  const cleanId = artistId.replace("jiosaavn_artist_", "");
  
  const data = await fetchApi(`/api/artists/${cleanId}`);
  
  if (!data.success) {
    throw new Error(data.message || "Failed to get artist details");
  }
  
  return formatArtist(data.data);
}

async function getArtistSongs(artistId: string, page: number = 1) {
  const cleanId = artistId.replace("jiosaavn_artist_", "");
  
  const data = await fetchApi(`/api/artists/${cleanId}/songs?page=${page}`);
  
  if (!data.success) {
    throw new Error(data.message || "Failed to get artist songs");
  }
  
  return {
    songs: data.data?.songs?.map(formatSong) || [],
    total: data.data?.total || 0
  };
}

async function getTrending(_language: string = "hindi") {
  try {
    // Try to get a popular Hindi playlist
    const data = await fetchApi(`/api/playlists?id=110858205`);
    
    if (data.success) {
      return {
        songs: data.data?.songs?.map(formatSong) || [],
        name: data.data?.name || "Trending",
        total: data.data?.songCount || 0
      };
    }
  } catch {
    // Fallback
  }
  
  // Fallback to search
  return searchSongs("bollywood top hits", 1, 20);
}

async function getNewReleases() {
  return searchSongs("new hindi songs", 1, 20);
}

async function getCharts() {
  const chartSearches = [
    { name: "Top Hindi", query: "bollywood hits" },
    { name: "Romantic", query: "romantic hindi songs" },
    { name: "Party Hits", query: "party bollywood" },
  ];
  
  const charts = await Promise.all(
    chartSearches.map(async (chart) => {
      try {
        const result = await searchSongs(chart.query, 1, 10);
        return {
          id: chart.query.replace(/\s/g, "_"),
          name: chart.name,
          songs: result.songs || [],
          image: result.songs?.[0]?.coverUrl || ""
        };
      } catch {
        return null;
      }
    })
  );
  
  return charts.filter(Boolean);
}

async function getSongsByMood(mood: string) {
  const moodQueries: Record<string, string> = {
    romantic: "romantic hindi songs",
    sad: "sad hindi songs heartbreak",
    party: "party bollywood dance",
    chill: "soft hindi melodious",
    devotional: "bhakti devotional hindi",
    workout: "hindi gym workout"
  };
  
  const query = moodQueries[mood.toLowerCase()] || `${mood} hindi songs`;
  return searchSongs(query, 1, 20);
}

async function getLyrics(songId: string, songTitle?: string, artistName?: string) {
  const cleanId = songId.replace("jiosaavn_", "");
  
  // Try JioSaavn lyrics first
  try {
    const data = await fetchApi(`/api/songs/${cleanId}/lyrics`);
    if (data.success && data.data?.lyrics) {
      return {
        lyrics: data.data.lyrics,
        copyright: data.data.copyright || ""
      };
    }
  } catch {
    // JioSaavn lyrics failed, try fallback
  }
  
  // Fallback: lyrics.ovh API
  if (songTitle && artistName) {
    try {
      const cleanArtist = artistName.split(",")[0].trim(); // Use first artist
      const cleanTitle = songTitle.replace(/\(.*?\)/g, "").trim(); // Remove parenthetical info
      const lyricsRes = await fetch(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`
      );
      if (lyricsRes.ok) {
        const lyricsData = await lyricsRes.json();
        if (lyricsData.lyrics) {
          return {
            lyrics: lyricsData.lyrics,
            copyright: "Lyrics provided by lyrics.ovh"
          };
        }
      }
    } catch {
      // lyrics.ovh also failed
    }
  }

  // Final fallback: try fetching song details to get title/artist for lyrics.ovh
  if (!songTitle || !artistName) {
    try {
      const songData = await fetchApi(`/api/songs/${cleanId}`);
      if (songData.success && songData.data?.[0]) {
        const song = songData.data[0];
        const title = song.name || "";
        const artist = song.primaryArtists?.split(",")[0]?.trim() || song.artists?.primary?.[0]?.name || "";
        if (title && artist) {
          const lyricsRes = await fetch(
            `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title.replace(/\(.*?\)/g, "").trim())}`
          );
          if (lyricsRes.ok) {
            const lyricsData = await lyricsRes.json();
            if (lyricsData.lyrics) {
              return {
                lyrics: lyricsData.lyrics,
                copyright: "Lyrics provided by lyrics.ovh"
              };
            }
          }
        }
      }
    } catch {
      // All lyrics sources failed
    }
  }

  return {
    lyrics: "",
    copyright: ""
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    
    let result;
    
    switch (action) {
      case "search":
        const query = url.searchParams.get("query") || "";
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");
        result = await searchSongs(query, page, limit);
        break;
        
      case "search_artists":
        const artistQuery = url.searchParams.get("query") || "";
        result = await searchArtists(artistQuery);
        break;
        
      case "search_all":
        const allQuery = url.searchParams.get("query") || "";
        result = await searchAll(allQuery);
        break;
        
      case "song":
        const songId = url.searchParams.get("id") || "";
        result = await getSongDetails(songId);
        break;
        
      case "artist":
        const artistId = url.searchParams.get("id") || "";
        result = await getArtistDetails(artistId);
        break;
        
      case "artist_songs":
        const artistSongsId = url.searchParams.get("id") || "";
        const artistPage = parseInt(url.searchParams.get("page") || "1");
        result = await getArtistSongs(artistSongsId, artistPage);
        break;
        
      case "trending":
        const language = url.searchParams.get("language") || "hindi";
        result = await getTrending(language);
        break;
        
      case "new_releases":
        result = await getNewReleases();
        break;
        
      case "charts":
        result = await getCharts();
        break;
        
      case "mood":
        const mood = url.searchParams.get("mood") || "romantic";
        result = await getSongsByMood(mood);
        break;
        
      case "lyrics":
        const lyricsId = url.searchParams.get("id") || "";
        const lyricsTitle = url.searchParams.get("title") || undefined;
        const lyricsArtist = url.searchParams.get("artist") || undefined;
        result = await getLyrics(lyricsId, lyricsTitle, lyricsArtist);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("JioSaavn API Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
