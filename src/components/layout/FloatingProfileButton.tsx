import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { profilesApi } from "@/lib/mongodb";

interface FloatingProfileButtonProps {
  showSignOut?: boolean;
}

export function FloatingProfileButton({ showSignOut = false }: FloatingProfileButtonProps) {
  const { user, signOut } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const { profile } = await profilesApi.get(user.id);
        if (profile) {
          setAvatarUrl(profile.avatarUrl);
          setDisplayName(profile.displayName || user.email?.split("@")[0] || "User");
        } else {
          setDisplayName(user.email?.split("@")[0] || "User");
        }
      } catch (error) {
        console.error("Error loading profile:", error);
        setDisplayName(user.email?.split("@")[0] || "User");
      }
    };

    loadProfile();
  }, [user]);

  if (!user) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
      {/* Floating Sign Out Button - only when sidebar is collapsed */}
      {showSignOut && (
        <button
          onClick={signOut}
          className={cn(
            "p-2.5 rounded-full",
            "bg-destructive/10 backdrop-blur-xl border border-destructive/30",
            "text-destructive hover:bg-destructive/20 hover:scale-110",
            "transition-all duration-300 ease-out",
            "shadow-lg shadow-destructive/20",
            "animate-fade-in"
          )}
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      )}

      {/* Profile Button */}
      <Link
        to="/profile"
        className="flex items-center"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Username tooltip with slide animation */}
        <div
          className={cn(
            "absolute right-14 px-4 py-2 rounded-xl",
            "bg-background/90 backdrop-blur-xl border border-primary/30",
            "shadow-lg shadow-primary/10",
            "transition-all duration-300 ease-out transform",
            "whitespace-nowrap",
            isHovered
              ? "opacity-100 translate-x-0 scale-100"
              : "opacity-0 translate-x-4 scale-95 pointer-events-none"
          )}
        >
          <span className="text-sm font-medium bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {displayName}
          </span>
          {/* Arrow pointer */}
          <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 border-l-8 border-l-background/90 border-y-4 border-y-transparent" />
        </div>

        {/* Profile Avatar Button */}
        <div
          className={cn(
            "w-11 h-11 rounded-full overflow-hidden",
            "border-2 border-primary/50 ring-2 ring-primary/20",
            "transition-all duration-300 ease-out",
            "hover:border-primary hover:ring-primary/40 hover:ring-4",
            "hover:shadow-lg hover:shadow-primary/30",
            "hover:scale-110",
            "cursor-pointer"
          )}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <User className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
