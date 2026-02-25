import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { FloatingProfileButton } from "./FloatingProfileButton";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { MoodBackground } from "@/components/effects/MoodBackground";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user } = useAuth();
  const { currentTrack, isPlaying } = usePlayer();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const currentMood = currentTrack?.mood || null;

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex w-full">
      {/* Global mood background across all pages */}
      <MoodBackground mood={currentMood} isPlaying={isPlaying} />
      <AppSidebar onCollapsedChange={setSidebarCollapsed} />
      <FloatingProfileButton showSignOut={sidebarCollapsed} />
      <main 
        className={cn(
          "flex-1 transition-all duration-300 relative z-10",
          sidebarCollapsed ? "ml-16" : "ml-64"
        )}
      >
        {children}
      </main>
    </div>
  );
}
