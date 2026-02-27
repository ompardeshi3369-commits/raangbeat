import { useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { ParticleBackground } from "@/components/effects/ParticleBackground";
import { jiosaavnApi, JioSaavnArtist } from "@/lib/jiosaavn";
import { followsApi } from "@/lib/mongodb";
import { Loader2, Users, Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Popular artists across all genres — loaded in pages of 15
const ALL_POPULAR_ARTISTS = [
  // ── Bollywood Male Singers ──────────────────────────────
  "Arijit Singh",
  "Atif Aslam",
  "Jubin Nautiyal",
  "Darshan Raval",
  "Armaan Malik",
  "Sonu Nigam",
  "KK",
  "Mohit Chauhan",
  "Shaan",
  "Javed Ali",
  "Vishal Mishra",
  "Stebin Ben",
  "Yasser Desai",
  "Ash King",
  "Benny Dayal",

  // ── Bollywood Female Singers ─────────────────────────────
  "Shreya Ghoshal",
  "Neha Kakkar",
  "Tulsi Kumar",
  "Sunidhi Chauhan",
  "Alka Yagnik",
  "Lata Mangeshkar",
  "Asha Bhosle",
  "Kavita Krishnamurthy",
  "Asees Kaur",
  "Dhvani Bhanushali",
  "Palak Muchhal",
  "Jonita Gandhi",
  "Shilpa Rao",
  "Rekha Bhardwaj",
  "Monali Thakur",

  // ── Retro Legends ────────────────────────────────────────
  "Kishore Kumar",
  "Mohammed Rafi",
  "Kumar Sanu",
  "Udit Narayan",
  "Manna Dey",
  "Mukesh",
  "Hemant Kumar",
  "S.P. Balasubrahmanyam",
  "Laxmikant Pyarelal",

  // ── Music Composers / Duo ─────────────────────────────────
  "A.R. Rahman",
  "Pritam",
  "Amit Trivedi",
  "Vishal-Shekhar",
  "Shankar Mahadevan",
  "Shankar Ehsaan Loy",
  "Sachet-Parampara",
  "Sachet Tandon",
  "Tanishk Bagchi",
  "Meet Bros",

  // ── Punjabi / Hip-Hop ────────────────────────────────────
  "Diljit Dosanjh",
  "Guru Randhawa",
  "AP Dhillon",
  "Harrdy Sandhu",
  "Karan Aujla",
  "Badshah",
  "Honey Singh",
  "Raftaar",
  "Divine",
  "King",
  "MC Stan",
  "Jazzy B",
  "Ammy Virk",
  "Jordan Sandhu",
  "Satinder Sartaaj",
  "Sidhu Moosewala",
  "Prabh Deep",
  "Bohemia",

  // ── Indie / New Age ──────────────────────────────────────
  "Prateek Kuhad",
  "Anuv Jain",
  "Ritviz",
  "Papon",
  "Nucleya",
  "Dhruv Visvanath",
  "Aastha Gill",
  "Sukriti Kakar",
  "Prakriti Kakar",
  "Mame Khan",
  "Shaan",
  "Clinton Cerejo",

  // ── Tamil / South Indian ─────────────────────────────────
  "Anirudh Ravichander",
  "Sid Sriram",
  "Yuvan Shankar Raja",
  "Deva",
  "Vijay Antony",
  "Haricharan",
  "Shreya Ghoshal",

  // ── Telugu ───────────────────────────────────────────────
  "SS Thaman",
  "Sunitha Upadrashta",
  "Karthik",

  // ── Marathi / Regional ───────────────────────────────────
  "Ajay-Atul",
  "Sonu Kakkar",
  "Vaishali Made",
  "Swapnil Bandodkar",

  // ── Classical / Ghazal / Devotional ─────────────────────
  "Jagjit Singh",
  "Mehdi Hassan",
  "Ghulam Ali",
  "Rahat Fateh Ali Khan",
  "Hari Om Sharan",
  "Anup Jalota",
  "Pandit Jasraj",
  "Kumar Gandharva",
  "Abida Parveen",

  // ── International (available on JioSaavn) ────────────────
  "Ed Sheeran",
  "Justin Bieber",
  "Taylor Swift",
  "Coldplay",
  "The Weeknd",
  "Billie Eilish",
  "Post Malone",
  "Camila Cabello",
  "Eminem",
  "BTS",
  "Ariana Grande",
  "Bruno Mars",
  "Drake",
  "Dua Lipa",
  "Harry Styles",
];

const PAGE_SIZE = 15;


// Format follower count to human-readable (e.g. 42960629 → "42.9M")
const formatFollowers = (count: string | number | undefined): string => {
  if (!count) return "";
  const num = typeof count === "string" ? parseInt(count, 10) : count;
  if (isNaN(num)) return "";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${num}`;
};

// Followed Artist Card — premium animated variant
function FollowedArtistCard({ artist }: { artist: JioSaavnArtist }) {
  return (
    <Link to={`/artist/${artist.id}`}>
      <div className="group relative flex flex-col items-center text-center p-5 rounded-2xl transition-all duration-500 hover:scale-[1.04] cursor-pointer overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 opacity-80 group-hover:opacity-100 transition-opacity" />
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.2), hsl(var(--primary) / 0.3))",
            backgroundSize: "200% 200%",
            animation: "gradient-shift 3s ease infinite",
          }}
        />
        {/* Glowing border */}
        <div className="absolute inset-0 rounded-2xl border-2 border-primary/40 group-hover:border-primary/70 transition-colors duration-500" />
        {/* Glow effect */}
        <div className="absolute -inset-1 rounded-2xl bg-primary/10 blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500" />

        {/* Avatar with animated ring */}
        <div className="relative z-10 mb-3">
          <div
            className="w-24 h-24 md:w-28 md:h-28 rounded-full p-[3px]"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))",
              backgroundSize: "200% 200%",
              animation: "gradient-shift 3s ease infinite",
            }}
          >
            <img
              src={artist.avatarUrl || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop"}
              alt={artist.name}
              className="w-full h-full rounded-full object-cover border-2 border-background"
            />
          </div>
          {/* Following badge */}
          <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg shadow-primary/30">
            <Heart className="w-3 h-3 fill-current" />
          </div>
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: "2.5s" }} />
        </div>

        {/* Artist info */}
        <div className="relative z-10">
          <h3 className="font-bold text-sm md:text-base truncate max-w-[120px] text-foreground group-hover:text-primary transition-colors">
            {artist.name}
          </h3>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Star className="w-3 h-3 text-primary fill-primary/50" />
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Following</span>
          </div>
          {artist.followerCount && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {formatFollowers(artist.followerCount)} followers
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Artists() {
  const { user, isLoading: authLoading } = useAuth();
  const [artists, setArtists] = useState<JioSaavnArtist[]>([]);
  const [followedArtists, setFollowedArtists] = useState<JioSaavnArtist[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFollowed, setIsLoadingFollowed] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);

  const loadArtistBatch = async (startIndex: number, count: number) => {
    const batch = ALL_POPULAR_ARTISTS.slice(startIndex, startIndex + count);
    const artistPromises = batch.map(async (name) => {
      try {
        const result = await jiosaavnApi.searchArtists(name);
        return result?.artists?.[0] || null;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(artistPromises);
    return results.filter((a): a is JioSaavnArtist => a !== null);
  };

  // Load followed artists
  useEffect(() => {
    if (!user) return;

    const loadFollowed = async () => {
      setIsLoadingFollowed(true);
      try {
        const { follows } = await followsApi.getAll(user.id);
        const ids = follows.map(f => f.artistId);
        setFollowedIds(new Set(ids));

        if (ids.length === 0) {
          setFollowedArtists([]);
          setIsLoadingFollowed(false);
          return;
        }

        // Fetch artist details for each followed artist
        const artistPromises = ids.map(async (artistId) => {
          try {
            const result = await jiosaavnApi.getArtist(artistId);
            return result || null;
          } catch {
            return null;
          }
        });

        const results = await Promise.all(artistPromises);
        const validArtists = results.filter((a): a is JioSaavnArtist => a !== null);
        setFollowedArtists(validArtists);
      } catch (error) {
        console.error("Error loading followed artists:", error);
      } finally {
        setIsLoadingFollowed(false);
      }
    };

    loadFollowed();
  }, [user]);

  // Load popular artists
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const validArtists = await loadArtistBatch(0, PAGE_SIZE);
        setArtists(validArtists);
        setLoadedCount(PAGE_SIZE);
      } catch (error) {
        console.error("Error loading artists:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitial();
  }, []);

  const loadMore = async () => {
    if (loadedCount >= ALL_POPULAR_ARTISTS.length) return;
    setIsLoadingMore(true);
    try {
      const newArtists = await loadArtistBatch(loadedCount, PAGE_SIZE);
      setArtists(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const unique = newArtists.filter(a => !existingIds.has(a.id));
        return [...prev, ...unique];
      });
      setLoadedCount(prev => prev + PAGE_SIZE);
    } catch (error) {
      console.error("Error loading more artists:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const hasMore = loadedCount < ALL_POPULAR_ARTISTS.length;

  // Filter out followed artists from the popular list to avoid duplicates
  const popularArtists = artists.filter(a => !followedIds.has(a.id));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <MainLayout>
      <div className="min-h-screen pb-32 relative">
        <ParticleBackground particleCount={20} />

        {/* CSS animation for gradient shift */}
        <style>{`
          @keyframes gradient-shift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-8">
            <Users className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-orbitron font-bold gradient-text">Artists</h1>
          </div>

          {/* ========== FOLLOWED ARTISTS SECTION ========== */}
          {!isLoadingFollowed && followedArtists.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="p-2 rounded-lg bg-primary/15">
                  <Heart className="w-5 h-5 text-primary fill-primary/50" />
                </div>
                <h2 className="text-xl font-orbitron font-bold text-foreground">Your Artists</h2>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/15 text-primary ml-1">
                  {followedArtists.length}
                </span>
              </div>

              <div className={cn(
                "grid gap-4",
                followedArtists.length === 1 && "grid-cols-1 max-w-[200px]",
                followedArtists.length === 2 && "grid-cols-2 max-w-[420px]",
                followedArtists.length >= 3 && "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              )}>
                {followedArtists.map((artist, index) => (
                  <div
                    key={artist.id}
                    className="animate-in fade-in slide-in-from-bottom-4"
                    style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
                  >
                    <FollowedArtistCard artist={artist} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {isLoadingFollowed && (
            <div className="flex items-center gap-3 mb-10 py-6">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="text-muted-foreground text-sm">Loading your followed artists...</span>
            </div>
          )}

          {/* ========== ALL POPULAR ARTISTS SECTION ========== */}
          <section>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-lg bg-accent/15">
                <Users className="w-5 h-5 text-accent" />
              </div>
              <h2 className="text-xl font-orbitron font-bold text-foreground">Popular Artists</h2>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : popularArtists.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">
                No artists found.
              </p>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {popularArtists.map((artist) => (
                    <Link key={artist.id} to={`/artist/${artist.id}`}>
                      <GlassCard className="p-4 text-center group" hover>
                        <div className="relative mb-4">
                          <img
                            src={artist.avatarUrl || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop"}
                            alt={artist.name}
                            className="w-full aspect-square rounded-full object-cover mx-auto transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                          {artist.name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {artist.followerCount ? `${formatFollowers(artist.followerCount)} followers` : "Artist"}
                        </p>
                      </GlassCard>
                    </Link>
                  ))}
                </div>

                {/* Load More Button */}
                {hasMore && (
                  <div className="flex justify-center">
                    <button
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="flex items-center gap-2 px-8 py-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all font-medium"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Loading more artists...
                        </>
                      ) : (
                        "Load More Artists"
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </MainLayout>
  );
}
