import { useState, useEffect, useCallback } from "react";
import { Moon, Sun, Sparkles, Sunset, CloudRain, Stars } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Theme = "dark" | "neon" | "midnight" | "sunset" | "rainy" | "aurora";

const themes: { id: Theme; label: string; icon: typeof Moon }[] = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "neon", label: "Neon", icon: Sparkles },
  { id: "midnight", label: "Midnight", icon: Sun },
  { id: "sunset", label: "Sunset Neon", icon: Sunset },
  { id: "rainy", label: "Rainy Night", icon: CloudRain },
  { id: "aurora", label: "Purple Aurora", icon: Stars },
];

interface ThemeToggleProps {
  showName?: boolean;
  className?: string;
}

export function ThemeToggle({ showName = false, className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("raangbeat_theme") as Theme;
    if (saved) setTheme(saved);
  }, []);

  const applyTheme = useCallback((newTheme: Theme) => {
    const root = document.documentElement;

    if (newTheme === "neon") {
      root.style.setProperty("--primary", "320 100% 60%");
      root.style.setProperty("--accent", "190 100% 50%");
      root.style.setProperty("--neon-cyan", "190 100% 60%");
      root.style.setProperty("--neon-magenta", "320 100% 70%");
    } else if (newTheme === "midnight") {
      root.style.setProperty("--primary", "220 100% 60%");
      root.style.setProperty("--accent", "270 100% 60%");
      root.style.setProperty("--neon-cyan", "220 100% 60%");
      root.style.setProperty("--neon-magenta", "270 100% 60%");
    } else if (newTheme === "sunset") {
      root.style.setProperty("--primary", "25 100% 55%");
      root.style.setProperty("--accent", "340 100% 60%");
      root.style.setProperty("--neon-cyan", "35 100% 60%");
      root.style.setProperty("--neon-magenta", "350 100% 65%");
    } else if (newTheme === "rainy") {
      root.style.setProperty("--primary", "210 80% 50%");
      root.style.setProperty("--accent", "195 90% 45%");
      root.style.setProperty("--neon-cyan", "200 85% 55%");
      root.style.setProperty("--neon-magenta", "220 70% 60%");
    } else if (newTheme === "aurora") {
      root.style.setProperty("--primary", "280 90% 60%");
      root.style.setProperty("--accent", "160 80% 50%");
      root.style.setProperty("--neon-cyan", "170 90% 55%");
      root.style.setProperty("--neon-magenta", "290 85% 65%");
    } else {
      root.style.setProperty("--primary", "190 100% 50%");
      root.style.setProperty("--accent", "320 100% 60%");
      root.style.setProperty("--neon-cyan", "190 100% 50%");
      root.style.setProperty("--neon-magenta", "320 100% 60%");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("raangbeat_theme", theme);
    applyTheme(theme);
  }, [theme, applyTheme]);

  const cycleTheme = () => {
    const currentIndex = themes.findIndex((t) => t.id === theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const newTheme = themes[nextIndex].id;
    
    // Add transition class
    setIsTransitioning(true);
    document.documentElement.classList.add("theme-transitioning");
    
    // Apply new theme
    setTheme(newTheme);
    
    // Remove transition class after animation
    setTimeout(() => {
      setIsTransitioning(false);
      document.documentElement.classList.remove("theme-transitioning");
    }, 500);
  };

  const current = themes.find((t) => t.id === theme);
  const CurrentIcon = current?.icon || Moon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={cycleTheme}
          aria-label="Theme"
          className={cn(
            showName
              ? "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/45 transition-colors"
              : "p-2 rounded-lg transition-colors hover:bg-muted/50",
            className
          )}
        >
          <span className={cn("flex items-center gap-2", !showName && "justify-center")}> 
            <CurrentIcon className={cn(
              "w-5 h-5 text-primary transition-transform duration-300",
              isTransitioning && "animate-spin"
            )} />
            {showName && <span className="text-sm font-medium text-foreground">Theme</span>}
          </span>
          {showName && (
            <span className={cn(
              "text-xs text-muted-foreground transition-opacity duration-300",
              isTransitioning && "opacity-50"
            )}>{current?.label}</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>Theme: {current?.label}</TooltipContent>
    </Tooltip>
  );
}
