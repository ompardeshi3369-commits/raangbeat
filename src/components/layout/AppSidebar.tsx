import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Home, Library, Users, User, LogOut, Search, Music2, Heart, Clock, ChevronLeft, ChevronRight, Wand2, Upload, Shield, Globe, Youtube, Film } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SearchModal } from "@/components/search/SearchModal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const libraryLinks = [
  { to: "/library?tab=favorites", label: "Favorites", icon: Heart },
  { to: "/library?tab=recent", label: "Recently Played", icon: Clock },
  { to: "/library?tab=playlists", label: "Playlists", icon: Music2 },
];

interface AppSidebarProps {
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function AppSidebar({ onCollapsedChange }: AppSidebarProps) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const mainNavLinks = [
    { to: "/home", label: "Home", icon: Home },
    { to: "/discover", label: "Discover", icon: Globe },
    { to: "/youtube", label: "Music Videos", icon: Youtube },
    { to: "/movies", label: "Movies & TV", icon: Film },
    { to: "/library", label: "Library", icon: Library },
    { to: "/artists", label: "Artists", icon: Users },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  const handleCollapse = (value: boolean) => {
    setCollapsed(value);
    onCollapsedChange?.(value);
  };

  const isActive = (path: string) => {
    if (path.includes("?")) {
      return location.pathname + location.search === path;
    }
    return location.pathname === path;
  };

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300 ease-out",
          "bg-sidebar-background/95 backdrop-blur-xl border-r border-sidebar-border",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
          {!collapsed && (
            <Link to="/home" className="text-xl font-orbitron font-bold gradient-text tracking-wider">
              RAANG BEAT
            </Link>
          )}
          <button
            onClick={() => handleCollapse(!collapsed)}
            className={cn(
              "p-2 rounded-lg hover:bg-sidebar-accent transition-colors",
              collapsed && "mx-auto"
            )}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Search Button */}
        <div className="p-3">
          <button
            onClick={() => setShowSearch(true)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
              "bg-muted/50 border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 group"
            )}
          >
            <Search className="w-5 h-5 group-hover:text-primary transition-colors flex-shrink-0" />
            {!collapsed && <span className="text-sm">Search...</span>}
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="mb-4">
            {!collapsed && (
              <span className="text-xs font-medium text-muted-foreground px-3 mb-2 block">MENU</span>
            )}
            {mainNavLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all mb-1",
                  isActive(link.to)
                    ? "bg-gradient-to-r from-primary/20 to-accent/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
              >
                <link.icon className={cn("w-5 h-5 flex-shrink-0", isActive(link.to) && "text-primary")} />
                {!collapsed && <span className="font-medium">{link.label}</span>}
              </Link>
            ))}
          </div>

          {/* Theme Toggle - Moved up with label */}
          <div className={cn("pb-4 border-b border-sidebar-border mb-4", collapsed ? "flex justify-center" : "px-3")}>
            {!collapsed && (
              <span className="text-xs font-medium text-muted-foreground mb-2 block">APPEARANCE</span>
            )}
            <ThemeToggle showName={!collapsed} />
          </div>

          {/* AI Recommendations */}
          <div className="pb-4 border-b border-sidebar-border mb-4">
            <Link
              to="/home?ai=true"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                "bg-gradient-to-r from-neon-purple/20 to-primary/10 border border-neon-purple/30",
                "text-neon-purple hover:from-neon-purple/30 hover:to-primary/20"
              )}
            >
              <Wand2 className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">AI For You</span>}
            </Link>
          </div>

          {/* Library Section */}
          <div className="pt-2">
            {!collapsed && (
              <span className="text-xs font-medium text-muted-foreground px-3 mb-2 block">YOUR LIBRARY</span>
            )}
            {libraryLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all mb-1",
                  isActive(link.to)
                    ? "bg-gradient-to-r from-primary/20 to-accent/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
              >
                <link.icon className={cn("w-5 h-5 flex-shrink-0", isActive(link.to) && "text-primary")} />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            ))}
          </div>
        </nav>

        {/* Bottom spacer to avoid music player overlap */}
        <div className="pb-24" />
      </aside>


      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </>
  );
}
