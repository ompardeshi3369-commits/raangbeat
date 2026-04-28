import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Youtube, ExternalLink, Loader2, Music2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  searchYouTubeVideo,
  getYouTubeEmbedUrl,
  getYouTubeSearchUrl,
  YouTubeVideo,
} from "@/lib/youtube";

interface YouTubeVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  artist: string;
  coverUrl?: string;
}

export function YouTubeVideoModal({
  isOpen,
  onClose,
  title,
  artist,
  coverUrl,
}: YouTubeVideoModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  const [video, setVideo] = useState<YouTubeVideo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey] = useState(() => !!import.meta.env.VITE_YOUTUBE_API_KEY);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Search for video when modal opens
  useEffect(() => {
    if (!isOpen || !title || !artist) return;
    setVideo(null);
    setError(null);
    setIsSearching(true);

    searchYouTubeVideo(title, artist)
      .then((result) => {
        if (result) {
          setVideo(result);
        } else {
          setError("no_api_key");
        }
      })
      .catch(() => setError("search_failed"))
      .finally(() => setIsSearching(false));
  }, [isOpen, title, artist]);

  // Mount/unmount animation
  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = window.setTimeout(() => setRendered(false), 400);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handler);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!mounted || !rendered) return null;

  const fallbackUrl = getYouTubeSearchUrl(title, artist);

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-400",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative z-10 w-full max-w-4xl mx-4 transition-all duration-400",
          visible ? "scale-100 translate-y-0" : "scale-95 translate-y-8"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-3">
            {/* YouTube logo - official branding */}
            <div className="flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-lg">
              <Youtube className="w-5 h-5 text-white" />
              <span className="text-white text-sm font-bold tracking-wide">YouTube</span>
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold truncate max-w-xs sm:max-w-md">{title}</p>
              <p className="text-white/50 text-sm truncate">{artist}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Open on YouTube button */}
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm transition-all"
              title="Open on YouTube"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Open on YouTube</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all hover:scale-110 hover:rotate-90 text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Container */}
        <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50 bg-black"
          style={{ aspectRatio: "16/9" }}
        >
          {isSearching ? (
            // Loading state
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90">
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-10 blur-2xl scale-110"
                />
              )}
              <Loader2 className="w-12 h-12 text-red-500 animate-spin relative z-10" />
              <p className="text-white/60 text-sm relative z-10">Searching for video...</p>
            </div>
          ) : video ? (
            // Embed the YouTube player using the official IFrame embed
            <iframe
              key={video.videoId}
              src={getYouTubeEmbedUrl(video.videoId)}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 w-full h-full border-0"
            />
          ) : (
            // No API key or error state
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#0f0f0f] to-[#1a0a0a]">
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-10 blur-2xl scale-110"
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-4 text-center px-8">
                {error === "no_api_key" ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center">
                      <Youtube className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                      <p className="text-white font-semibold mb-1">YouTube API Key Required</p>
                      <p className="text-white/50 text-sm max-w-sm">
                        Add your free <strong>YouTube Data API v3</strong> key to{" "}
                        <code className="text-yellow-400">.env</code> as{" "}
                        <code className="text-yellow-400">VITE_YOUTUBE_API_KEY</code> to enable video search.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                      <Youtube className="w-8 h-8 text-white/30" />
                    </div>
                    <div>
                      <p className="text-white font-semibold mb-1">No embeddable video found</p>
                      <p className="text-white/50 text-sm max-w-sm">
                        The music label has disabled embedding for this song's videos.
                        Watch it directly on YouTube instead.
                      </p>
                    </div>
                  </>
                )}

                {/* Always show Open on YouTube as fallback */}
                <a
                  href={fallbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-all hover:scale-105 mt-2"
                >
                  <Youtube className="w-5 h-5" />
                  Search on YouTube
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer — legal note */}
        {video && (
          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-white/30 text-xs">
              Playing via official YouTube embed · {video.channelTitle}
            </p>
            <a
              href={`https://www.youtube.com/watch?v=${video.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1 transition-colors"
            >
              Watch on YouTube <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
