import { useState, useEffect, useRef } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { AnimatedInput } from "@/components/ui/AnimatedInput";
import { profilesApi, playlistsApi, favoritesApi, songsApi, siteSettingsApi, followsApi, artistsApi, AboutUsSettings, MongoPlaylist } from "@/lib/mongodb";
import { jiosaavnApi } from "@/lib/jiosaavn";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Save, Heart, Music, Edit2, Share2, Library, ListMusic, History, Camera, X, Play, Sparkles, Music2, Disc3, Mail, Phone, Instagram, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";

interface Profile {
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

interface Stats {
  totalFavorites: number;
  playlistCount: number;
}

interface FollowedArtist {
  id: string;
  name: string;
  avatarUrl: string;
}

const quickLinks = [
  { to: "/library", label: "Library", icon: Library, color: "from-cyan-500 to-blue-500" },
  { to: "/library?tab=playlists", label: "Playlists", icon: ListMusic, color: "from-purple-500 to-pink-500" },
  { to: "/library?tab=favorites", label: "Liked Songs", icon: Heart, color: "from-rose-500 to-orange-500" },
  { to: "/library?tab=recent", label: "History", icon: History, color: "from-emerald-500 to-teal-500" },
];

export default function Profile() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const { playTrack } = usePlayer();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile>({ displayName: "", avatarUrl: "", bio: "" });
  const [stats, setStats] = useState<Stats>({ totalFavorites: 0, playlistCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // User data
  const [favoriteSongs, setFavoriteSongs] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<MongoPlaylist[]>([]);
  const [followedArtists, setFollowedArtists] = useState<FollowedArtist[]>([]);
  const [showFollowing, setShowFollowing] = useState(false);

  // About Us settings
  const [aboutSettings, setAboutSettings] = useState<AboutUsSettings | null>(null);

  useEffect(() => {
    // Load about settings for all users (no auth required)
    const loadAboutSettings = async () => {
      try {
        const { settings } = await siteSettingsApi.getAboutUs();
        setAboutSettings(settings);
      } catch (error) {
        console.error("Error loading about settings:", error);
      }
    };
    loadAboutSettings();
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadProfileData = async () => {
      try {
        // Load profile from MongoDB
        const { profile: profileData } = await profilesApi.get(user.id);
        if (profileData) {
          setProfile({
            displayName: profileData.displayName || user.email?.split("@")[0] || "",
            avatarUrl: profileData.avatarUrl || "",
            bio: profileData.bio || "Music lover • Playlists curator • Always searching for new tunes.",
          });
        } else {
          setProfile({
            displayName: user.email?.split("@")[0] || "",
            avatarUrl: "",
            bio: "Music lover • Playlists curator • Always searching for new tunes.",
          });
        }

        // Load stats from MongoDB
        const { stats: statsData } = await profilesApi.getStats(user.id);
        setStats({
          totalFavorites: statsData.totalFavorites || 0,
          playlistCount: statsData.playlistCount || 0,
        });

        // Load followed artists
        try {
          const { follows } = await followsApi.getAll(user.id);
          const artists: FollowedArtist[] = [];
          for (const follow of follows || []) {
            try {
              if (follow.artistId.startsWith("jiosaavn_artist_")) {
                const artistData = await jiosaavnApi.getArtist(follow.artistId);
                artists.push({ id: artistData.id, name: artistData.name, avatarUrl: artistData.avatarUrl });
              } else {
                const { artist } = await artistsApi.getById(follow.artistId);
                if (artist) {
                  artists.push({ id: artist._id, name: artist.name, avatarUrl: artist.avatarUrl || "" });
                }
              }
            } catch {
              // skip failed artist fetches
            }
          }
          setFollowedArtists(artists);
        } catch (err) {
          console.error("Error loading followed artists:", err);
        }

        // Load favorite songs - handle both local and external
        const { favorites } = await favoritesApi.getAll(user.id, 4);
        if (favorites.length > 0) {
          const tracks: Track[] = [];
          for (const fav of favorites.slice(0, 4)) {
            const favDoc = fav as unknown as { songId: string; isExternal?: boolean; metadata?: { title: string; artist: string; artistId: string; coverUrl: string; audioUrl: string; duration: number } };

            // Check if it's an external song
            if (favDoc.songId.startsWith("jiosaavn_")) {
              if (favDoc.metadata) {
                // Has stored metadata
                tracks.push({
                  id: favDoc.songId,
                  title: favDoc.metadata.title,
                  artist: favDoc.metadata.artist,
                  artistId: favDoc.metadata.artistId,
                  coverUrl: favDoc.metadata.coverUrl,
                  audioUrl: favDoc.metadata.audioUrl,
                  duration: favDoc.metadata.duration,
                });
              } else {
                // Fetch from JioSaavn API
                try {
                  const songData = await jiosaavnApi.getSong(favDoc.songId);
                  if (songData) {
                    tracks.push({
                      id: songData.id,
                      title: songData.title,
                      artist: songData.artist,
                      artistId: songData.artistId,
                      coverUrl: songData.coverUrl,
                      audioUrl: songData.audioUrl,
                      duration: songData.duration,
                    });
                  }
                } catch (err) {
                  console.error(`Error fetching JioSaavn song ${favDoc.songId}:`, err);
                }
              }
            } else {
              // Local song - fetch from MongoDB
              try {
                const { song } = await songsApi.getById(fav.songId);
                if (song) {
                  tracks.push({
                    id: song._id,
                    title: song.title,
                    artist: song.artistName,
                    artistId: song.artistId,
                    coverUrl: song.coverUrl || "/placeholder.svg",
                    audioUrl: song.audioUrl,
                    duration: song.duration || 0,
                    mood: song.mood,
                  });
                }
              } catch (err) {
                console.error(`Error fetching song ${fav.songId}:`, err);
              }
            }
          }
          setFavoriteSongs(tracks);
        }

        // Load playlists
        const { playlists: userPlaylists } = await playlistsApi.getAll(user.id);
        setPlaylists(userPlaylists.slice(0, 4));

      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      await profilesApi.upsert(user.id, {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        bio: profile.bio,
      });

      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
      setIsEditMode(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      // Upload to Supabase Storage - path must be {user_id}/filename for RLS policy
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      setProfile(p => ({ ...p, avatarUrl: publicUrl }));

      // Save to MongoDB
      await profilesApi.upsert(user.id, {
        displayName: profile.displayName,
        avatarUrl: publicUrl,
        bio: profile.bio,
      });

      toast({
        title: "Photo updated",
        description: "Your profile photo has been updated.",
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePlaySong = (track: Track) => {
    playTrack(track);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative">
          <Disc3 className="w-16 h-16 text-primary animate-spin" />
          <div className="absolute inset-0 blur-xl bg-primary/30 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <MainLayout>
      <div className="min-h-screen pb-32 relative overflow-hidden">
        {/* Animated Gradient Background */}
        <div className="fixed inset-0 -z-10">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />

          {/* Animated orbs */}
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] animate-pulse"
            style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[100px] animate-pulse"
            style={{ animationDuration: '6s', animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-neon-purple/15 rounded-full blur-[150px] animate-pulse"
            style={{ animationDuration: '8s', animationDelay: '2s' }} />

          {/* Moving particles */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-primary/40 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDuration: `${8 + Math.random() * 12}s`,
                  animationDelay: `${Math.random() * 5}s`,
                }}
              />
            ))}
          </div>

          {/* Mesh gradient overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,hsl(var(--background))_70%)]" />
        </div>

        <main className="max-w-6xl mx-auto px-4 py-8 relative z-10">
          {/* Hero Profile Section */}
          <div className="relative mb-8 animate-fade-in">
            {/* Decorative elements */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-primary/30 to-transparent rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-accent/30 to-transparent rounded-full blur-2xl" />

            <GlassCard
              className="relative p-8 md:p-10 overflow-hidden border-primary/20"
              glow
            >
              {/* Animated background lines */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent animate-pulse" style={{ animationDelay: '1s' }} />
              </div>

              <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
                {/* Avatar Section */}
                <div className="relative group animate-scale-in">
                  {/* Glow ring */}
                  <div className="absolute -inset-2 bg-gradient-to-r from-primary via-accent to-neon-purple rounded-full opacity-50 blur-lg group-hover:opacity-75 transition-opacity duration-500 animate-pulse" />

                  {/* Avatar container */}
                  <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden border-4 border-background shadow-2xl">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt="Profile"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary via-accent to-neon-purple flex items-center justify-center">
                        <User className="w-20 h-20 text-white/80" />
                      </div>
                    )}

                    {/* Upload overlay */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className={cn(
                        "absolute inset-0 flex items-center justify-center",
                        "bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300",
                        "backdrop-blur-sm"
                      )}
                    >
                      {isUploadingPhoto ? (
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Camera className="w-8 h-8 text-white" />
                          <span className="text-xs text-white/80">Change Photo</span>
                        </div>
                      )}
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>

                {/* Profile Info */}
                <div className="flex-1 text-center lg:text-left animate-fade-in" style={{ animationDelay: '150ms' }}>
                  {isEditMode ? (
                    <div className="space-y-4 max-w-md mx-auto lg:mx-0">
                      <AnimatedInput
                        label="Display Name"
                        value={profile.displayName || ""}
                        onChange={(e) => setProfile(p => ({ ...p, displayName: e.target.value }))}
                      />
                      <AnimatedInput
                        label="Bio"
                        value={profile.bio || ""}
                        onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
                        placeholder="Tell us about yourself..."
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 justify-center lg:justify-start mb-2">
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-orbitron font-bold bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent">
                          {profile.displayName || user.email?.split("@")[0]}
                        </h1>
                        <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                      </div>
                      <p className="text-muted-foreground mb-4">@{user.email?.split("@")[0]}</p>

                      {/* Stats Row */}
                      <div className="flex flex-wrap gap-6 justify-center lg:justify-start mb-5">
                        <StatBadge icon={Heart} value={stats.totalFavorites} label="Favorites" color="text-rose-400" />
                        <StatBadge icon={ListMusic} value={stats.playlistCount} label="Playlists" color="text-purple-400" />
                        <button
                          onClick={() => setShowFollowing(!showFollowing)}
                          className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/30 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
                        >
                          <Users className="w-4 h-4 text-primary" />
                          <span className="font-bold">{followedArtists.length}</span>
                          <span className="text-muted-foreground text-sm">Following</span>
                        </button>
                      </div>

                      <p className="text-muted-foreground text-sm max-w-md">{profile.bio}</p>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 animate-fade-in" style={{ animationDelay: '300ms' }}>
                  {isEditMode ? (
                    <>
                      <NeonButton onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                      </NeonButton>
                      <NeonButton variant="ghost" size="sm" onClick={() => setIsEditMode(false)} className="gap-2">
                        <X className="w-4 h-4" />
                        Cancel
                      </NeonButton>
                    </>
                  ) : (
                    <>
                      <NeonButton variant="secondary" size="sm" onClick={() => setIsEditMode(true)} className="gap-2 hover:scale-105 transition-transform">
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </NeonButton>
                      <NeonButton variant="ghost" size="sm" className="gap-2 hover:scale-105 transition-transform">
                        <Share2 className="w-4 h-4" />
                        Share
                      </NeonButton>
                    </>
                  )}
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Quick Links Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {quickLinks.map((link, index) => (
              <Link
                key={link.to}
                to={link.to}
                className="animate-fade-in group"
                style={{ animationDelay: `${400 + index * 100}ms` }}
              >
                <div className={cn(
                  "relative p-5 rounded-2xl overflow-hidden transition-all duration-300",
                  "bg-gradient-to-br", link.color,
                  "hover:scale-105 hover:shadow-xl hover:shadow-primary/20",
                  "group-hover:-translate-y-1"
                )}>
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                  <link.icon className="w-8 h-8 text-white mb-3 transition-transform group-hover:scale-110" />
                  <span className="text-sm font-semibold text-white">{link.label}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Following Artists Section */}
          {showFollowing && (
            <GlassCard className="mb-8 p-6 animate-fade-in border-primary/10" glow>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
                  <Users className="w-5 h-5 text-primary-foreground" />
                </div>
                <h2 className="text-lg font-semibold">Following Artists</h2>
              </div>
              {followedArtists.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {followedArtists.map((artist) => (
                    <Link
                      key={artist.id}
                      to={`/artist/${artist.id}`}
                      className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-300 hover:scale-105 group"
                    >
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/30 group-hover:border-primary/60 transition-colors">
                        {artist.avatarUrl ? (
                          <img src={artist.avatarUrl} alt={artist.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                            <Music className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-medium text-center truncate w-full group-hover:text-primary transition-colors">
                        {artist.name}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Not following any artists yet</p>
                  <p className="text-xs opacity-60 mt-1">Follow artists to see them here!</p>
                </div>
              )}
            </GlassCard>
          )}

          {/* Content Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Favorites Section */}
            <GlassCard
              className="p-6 animate-fade-in border-primary/10"
              style={{ animationDelay: '600ms' }}
              glow
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold">Favorites</h2>
                </div>
                <Link to="/library?tab=favorites" className="text-sm text-primary hover:text-primary/80 transition-colors">
                  See All →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {favoriteSongs.length > 0 ? (
                  favoriteSongs.map((song, index) => (
                    <div
                      key={song.id}
                      onClick={() => handlePlaySong(song)}
                      className={cn(
                        "relative group cursor-pointer rounded-xl overflow-hidden aspect-square",
                        "transition-all duration-300 hover:scale-105"
                      )}
                      style={{ animationDelay: `${700 + index * 100}ms` }}
                    >
                      <img
                        src={song.coverUrl || "/placeholder.svg"}
                        alt={song.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform">
                            <Play className="w-5 h-5 text-white ml-1" fill="white" />
                          </div>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-sm font-medium text-white truncate">{song.title}</p>
                        <p className="text-xs text-white/70 truncate">{song.artist}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-12 text-muted-foreground">
                    <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No favorites yet</p>
                    <p className="text-xs opacity-60 mt-1">Start adding songs you love!</p>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Playlists Section */}
            <GlassCard
              className="p-6 animate-fade-in border-accent/10"
              style={{ animationDelay: '700ms' }}
              glow
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
                    <Music2 className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold">Playlists</h2>
                </div>
                <Link to="/library?tab=playlists" className="text-sm text-primary hover:text-primary/80 transition-colors">
                  See All →
                </Link>
              </div>
              <div className="space-y-3">
                {playlists.length > 0 ? (
                  playlists.map((playlist, index) => (
                    <Link
                      key={playlist._id}
                      to={`/library?tab=playlists&id=${playlist._id}`}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-xl",
                        "bg-muted/30 hover:bg-muted/50 transition-all duration-300",
                        "hover:translate-x-1 group"
                      )}
                      style={{ animationDelay: `${800 + index * 100}ms` }}
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                        {playlist.coverUrl ? (
                          <img
                            src={playlist.coverUrl}
                            alt={playlist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate group-hover:text-primary transition-colors">{playlist.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {playlist.songs?.length || 0} songs
                        </p>
                      </div>
                      <Play className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No playlists yet</p>
                    <p className="text-xs opacity-60 mt-1">Create your first playlist!</p>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* About Us Section */}
          <GlassCard
            className="mt-8 p-6 md:p-8 animate-fade-in border-primary/10"
            style={{ animationDelay: '900ms' }}
            glow
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/60 to-accent/60">
                <User className="w-5 h-5 text-primary-foreground" />
              </div>
              <h2 className="text-xl font-semibold font-orbitron">About Us</h2>
            </div>

            <p className="text-muted-foreground mb-6 max-w-2xl">
              {aboutSettings?.description || "Welcome to RangeBeat – your ultimate destination for music discovery. We're passionate about connecting people through the power of music, offering a curated experience that celebrates diverse sounds from around the world."}
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Contact Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Contact Us</h3>

                {/* Emails */}
                <div className="flex items-center gap-3 group">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Primary Email</p>
                    <a
                      href={`mailto:${aboutSettings?.primaryEmail || "support@rangebeat.com"}`}
                      className="text-foreground hover:text-primary transition-colors"
                    >
                      {aboutSettings?.primaryEmail || "support@rangebeat.com"}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 group">
                  <div className="p-2 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                    <Mail className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Business Inquiries</p>
                    <a
                      href={`mailto:${aboutSettings?.businessEmail || "business@rangebeat.com"}`}
                      className="text-foreground hover:text-primary transition-colors"
                    >
                      {aboutSettings?.businessEmail || "business@rangebeat.com"}
                    </a>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-3 group">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <a
                      href={`tel:${(aboutSettings?.phone || "+1234567890").replace(/\D/g, '')}`}
                      className="text-foreground hover:text-primary transition-colors"
                    >
                      {aboutSettings?.phone || "+1 (234) 567-890"}
                    </a>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div>
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Follow Us</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Creator 1 — Warm Instagram gradient style */}
                  <a
                    href={aboutSettings?.instagram || "https://instagram.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden rounded-2xl p-[2px] transition-all duration-500 hover:scale-[1.04]"
                    style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" }}
                  >
                    {/* Shimmer sweep */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)", backgroundSize: "200% 100%", animation: "shimmer 1.2s ease-in-out" }} />

                    <div className="relative rounded-[14px] bg-[#0f0a1e] p-4 h-full">
                      <div className="flex items-center gap-4">
                        {/* Pulsing icon */}
                        <div className="relative flex-shrink-0">
                          <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "linear-gradient(135deg, #833ab4, #fcb045)" }} />
                          <div className="w-12 h-12 rounded-full flex items-center justify-center relative" style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" }}>
                            <Instagram className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-0.5" style={{ background: "linear-gradient(90deg, #fd1d1d, #fcb045)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Instagram</p>
                          <p className="font-semibold text-white text-sm truncate">
                            @{(aboutSettings?.instagram || "").replace(/.*instagram\.com\//, "").replace(/\/$/, "") || "follow_us"}
                          </p>
                        </div>
                        <svg className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all duration-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  </a>

                  {/* Creator 2 — Cool neon purple style */}
                  <a
                    href={aboutSettings?.instagram2 || "https://instagram.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden rounded-2xl transition-all duration-500 hover:scale-[1.04] border border-violet-500/30 bg-[#0f0a1e]"
                    style={{ boxShadow: "0 0 0 0 rgba(139, 92, 246, 0)" }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 20px 4px rgba(139,92,246,0.25)")}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 0 0 0 rgba(139, 92, 246, 0)")}
                  >
                    {/* Neon scan line */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-30 group-hover:opacity-60 transition-opacity duration-300" />
                    {/* Corner glow */}
                    <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-violet-500/10 blur-xl -translate-y-1/2 translate-x-1/2 group-hover:bg-violet-500/25 transition-all duration-500" />

                    <div className="relative p-4">
                      <div className="flex items-center gap-4">
                        {/* Hexagon-style icon */}
                        <div className="relative flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border border-violet-500/40 bg-violet-500/10 group-hover:border-violet-400/70 group-hover:bg-violet-500/20 transition-all duration-300">
                          <Instagram className="w-6 h-6 text-violet-400 group-hover:text-violet-300 transition-colors" />
                          {/* Corner dots */}
                          <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-violet-400 animate-pulse" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-[0.15em] mb-0.5">Instagram</p>
                          <p className="font-semibold text-white text-sm truncate">
                            @{(aboutSettings?.instagram2 || "").replace(/.*instagram\.com\//, "").replace(/\/$/, "") || "follow_us"}
                          </p>
                        </div>
                        <svg className="w-4 h-4 text-violet-500/50 group-hover:text-violet-300 group-hover:translate-x-1 transition-all duration-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  </a>

                </div>
              </div>
            </div>
          </GlassCard>
        </main>
      </div>
    </MainLayout>
  );
}

// Stat Badge Component
function StatBadge({ icon: Icon, value, label, color }: { icon: any; value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/30 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-colors">
      <Icon className={cn("w-4 h-4", color)} />
      <span className="font-bold">{value}</span>
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}
