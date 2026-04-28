import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Navbar } from '@/components/layout/Navbar';
import { Search, Star, PlayCircle, Film, X, Clock, Calendar } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Movies() {
  const [movies, setMovies] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<any | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [activeCategory, setActiveCategory] = useState('trending');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { toast } = useToast();

  const categories = [
    { id: 'trending', label: 'Trending' },
    { id: 'indian', label: 'Indian Movies & Shows' },
    { id: 'kdrama', label: 'K-Dramas' },
    { id: 'anime', label: 'Anime' },
  ];

  useEffect(() => {
    fetchMovies(activeCategory);
  }, [activeCategory]);

  const fetchMovies = async (category: string, pageNum = 0, isLoadMore = false) => {
    if (!isLoadMore) {
      setLoading(true);
      setSearchQuery('');
      setPage(0);
    } else {
      setLoadingMore(true);
    }

    try {
      if (category === 'trending') {
        const response = await fetch(`https://api.tvmaze.com/shows?page=${pageNum}`);
        const data = await response.json();
        
        // TVMaze returns 250 shows per page. Sort by rating/weight to show best ones first
        const sorted = data.sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0));
        const newShows = sorted.slice(0, 60); // take top 60 of the page
        
        if (isLoadMore) {
          setMovies(prev => [...prev, ...newShows]);
        } else {
          setMovies(newShows);
        }
        setHasMore(data.length > 0);
      } else {
        // Advanced pagination for Search endpoints: use batches of targeted keywords!
        // This allows us to have a "Load More" button for categories without real pagination.
        const queryMap: Record<string, string[][]> = {
          'indian': [
            ['hindi', 'bollywood', 'india', 'mumbai', 'delhi'],
            ['telugu', 'tollywood', 'hyderabad', 'chennai', 'tamil'],
            ['malayalam', 'kerala', 'kannada', 'bengali', 'marathi'],
            ['punjabi', 'bhojpuri', 'gujarati', 'assamese']
          ],
          'kdrama': [
            ['korean', 'seoul', 'kdrama', 'korea', 'busan'],
            ['joseon', 'itaewon', 'gangnam', 'jeju', 'chaebol'],
            ['kpop', 'hallyu', 'kbs', 'sbs', 'tvn']
          ],
          'anime': [
            ['anime', 'japan', 'manga', 'tokyo', 'naruto'],
            ['goku', 'luffy', 'shounen', 'shoujo', 'mecha'],
            ['isekai', 'kyoto', 'osaka', 'ninja', 'samurai'],
            ['school', 'magic', 'demon', 'dragon', 'sword']
          ]
        };
        
        const queriesList = queryMap[category] || [];
        if (pageNum >= queriesList.length) {
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        const queries = queriesList[pageNum];
        const promises = queries.map(q => 
          fetch(`https://api.tvmaze.com/search/shows?q=${q}`).then(res => res.json())
        );
        
        const results = await Promise.all(promises);
        
        // Flatten and extract shows
        const allShows = results.flat().map((item: any) => item.show);
        
        if (isLoadMore) {
          setMovies(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueShows = Array.from(new Map(allShows.map(s => [s.id, s])).values())
                                     .filter((s: any) => !existingIds.has(s.id));
            return [...prev, ...uniqueShows];
          });
        } else {
          const uniqueShows = Array.from(new Map(allShows.map(s => [s.id, s])).values());
          setMovies(uniqueShows);
        }
        
        setHasMore(pageNum < queriesList.length - 1);
      }
    } catch (error) {
      console.error("Failed to fetch movies:", error);
    }
    
    setLoading(false);
    setLoadingMore(false);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMovies(activeCategory, nextPage, true);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchMovies(activeCategory);
      return;
    }
    
    setLoading(true);
    setActiveCategory(''); // clear category when searching
    setHasMore(false); // search endpoint isn't paginated
    try {
      const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      // search returns { score, show } objects
      setMovies(data.map((item: any) => item.show));
    } catch (error) {
      console.error("Search failed:", error);
    }
    setLoading(false);
  };

  return (
    <MainLayout>
      <div className="flex-1 flex flex-col min-w-0 relative h-screen bg-[#0a0a0a]">
        {/* Background Gradients for aesthetic */}
        <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-primary/10 via-background to-background pointer-events-none" />
        
        <Navbar />

        <ScrollArea className="flex-1 px-4 sm:px-6 md:px-8 pb-32 pt-6 relative z-10">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-4xl md:text-5xl font-orbitron font-bold gradient-text pb-2 flex items-center gap-3">
                  <Film className="w-10 h-10 text-primary" />
                  Movies & Shows
                </h1>
                <p className="text-muted-foreground mt-1 text-lg">Powered by TVMaze API</p>
              </div>

              <form onSubmit={handleSearch} className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Search movies, shows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-full pl-12 pr-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-all focus:bg-white/10"
                />
              </form>
            </div>

            {/* Categories */}
            <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-5 py-2 rounded-full whitespace-nowrap font-medium transition-all ${
                    activeCategory === cat.id && !searchQuery
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-pulse">
                {[...Array(15)].map((_, i) => (
                  <div key={i} className="aspect-[2/3] bg-white/5 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {movies.map((movie) => (
                  <div 
                    key={movie.id} 
                    onClick={() => setSelectedMovie(movie)}
                    className="group relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/50 cursor-pointer"
                  >
                    <div className="aspect-[2/3] relative">
                      <img 
                        src={movie.image?.medium || movie.image?.original || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=60"} 
                        alt={movie.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                      
                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur-md shadow-[0_0_30px_rgba(var(--primary),0.5)]">
                          <PlayCircle className="w-8 h-8 text-white ml-1" />
                        </div>
                      </div>
                    </div>

                    <div className="absolute bottom-0 inset-x-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      <h3 className="font-bold text-white text-lg truncate drop-shadow-md">{movie.name}</h3>
                      
                      <div className="flex items-center gap-3 mt-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        {movie.rating?.average && (
                          <div className="flex items-center gap-1 text-yellow-400">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            <span className="text-xs font-bold">{movie.rating.average}</span>
                          </div>
                        )}
                        <span className="text-xs text-white/70">
                          {movie.premiered ? movie.premiered.substring(0, 4) : 'N/A'}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        {movie.genres?.slice(0, 2).map((genre: string) => (
                          <span key={genre} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/5 backdrop-blur-sm">
                            {genre}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {!loading && movies.length > 0 && hasMore && (
              <div className="flex justify-center mt-12 mb-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-8 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all hover:scale-105 flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : 'Load More Shows'}
                </button>
              </div>
            )}
            
            {!loading && movies.length === 0 && (
              <div className="text-center py-20">
                <p className="text-xl text-muted-foreground">No movies or shows found for "{searchQuery}"</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Movie Details Modal */}
        <Dialog 
          open={!!selectedMovie} 
          onOpenChange={(open) => {
            if (!open) {
              setSelectedMovie(null);
              setShowVideo(false);
            }
          }}
        >
          <DialogContent className={cn(
            "p-0 overflow-hidden bg-[#0a0a0a] border-white/10 text-white shadow-2xl shadow-primary/20 transition-all duration-500",
            showVideo ? "max-w-[95vw] h-[90vh]" : "max-w-4xl"
          )}>
            {selectedMovie && (
              <div className={cn("flex flex-col h-full", !showVideo && "md:flex-row md:max-h-[80vh]")}>
                
                {/* Video Player (Full Width) */}
                {showVideo && selectedMovie.externals?.imdb ? (
                  <div className="w-full h-full relative flex flex-col bg-black">
                    <div className="p-4 flex items-center justify-between border-b border-white/10 bg-black/80 absolute top-0 inset-x-0 z-10">
                      <h3 className="font-bold text-white truncate pr-4 text-xl">{selectedMovie.name}</h3>
                      <button 
                        onClick={() => setShowVideo(false)}
                        className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors backdrop-blur-md"
                      >
                        Back to Info
                      </button>
                    </div>
                    <div className="flex-1 w-full h-full relative pt-16">
                      <iframe 
                        src={`https://vidsrc.xyz/embed/tv?imdb=${selectedMovie.externals.imdb}`}
                        className="absolute inset-0 w-full h-full border-0"
                        allowFullScreen
                        allow="autoplay; fullscreen; encrypted-media"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Poster Side */}
                    <div className="w-full md:w-2/5 relative">
                      <img 
                        src={selectedMovie.image?.original || selectedMovie.image?.medium || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500"} 
                        alt={selectedMovie.name}
                        className="w-full h-[300px] md:h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#0a0a0a]" />
                    </div>

                    {/* Info Side */}
                    <div className="w-full md:w-3/5 p-6 md:p-8 flex flex-col relative overflow-y-auto">
                    <button 
                      onClick={() => {
                        setSelectedMovie(null);
                        setShowVideo(false);
                      }}
                      className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>

                  <h2 className="text-3xl md:text-4xl font-bold font-orbitron text-white mb-2">{selectedMovie.name}</h2>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-white/70 mb-6">
                    {selectedMovie.rating?.average && (
                      <div className="flex items-center gap-1.5 text-yellow-400 font-semibold bg-yellow-400/10 px-2.5 py-1 rounded-full">
                        <Star className="w-4 h-4 fill-current" />
                        {selectedMovie.rating.average}
                      </div>
                    )}
                    {selectedMovie.premiered && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {selectedMovie.premiered.substring(0, 4)}
                      </div>
                    )}
                    {selectedMovie.runtime && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {selectedMovie.runtime} min
                      </div>
                    )}
                    {selectedMovie.status && (
                      <span className="px-2.5 py-1 rounded-full border border-white/20 bg-white/5 text-xs font-medium">
                        {selectedMovie.status}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {selectedMovie.genres?.map((genre: string) => (
                      <span key={genre} className="px-3 py-1 text-xs font-medium rounded-full bg-primary/20 text-primary border border-primary/30">
                        {genre}
                      </span>
                    ))}
                  </div>

                  <h3 className="text-lg font-semibold mb-2">Synopsis</h3>
                  <div 
                    className="prose prose-invert prose-sm max-w-none text-white/70 mb-8"
                    dangerouslySetInnerHTML={{ __html: selectedMovie.summary || '<p>No summary available.</p>' }}
                  />

                  <div className="mt-auto pt-6 flex gap-4">
                    <button 
                      onClick={() => {
                        if (selectedMovie.externals?.imdb) {
                          setShowVideo(true);
                        } else {
                          toast({ title: "Streaming Unavailable", description: "No video source found for this specific title.", variant: "destructive" });
                        }
                      }}
                      className="flex-1 bg-gradient-to-r from-primary to-accent text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-primary/25"
                    >
                      <PlayCircle className="w-5 h-5" />
                      Watch Now
                    </button>
                    <a 
                      href={selectedMovie.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold py-3.5 px-6 rounded-xl flex items-center justify-center transition-colors text-center"
                    >
                      More Info
                    </a>
                  </div>
                  </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
