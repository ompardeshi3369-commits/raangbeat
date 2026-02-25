import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/contexts/PlayerContext";

interface BassReactiveBackgroundProps {
  className?: string;
}

export function BassReactiveBackground({ className }: BassReactiveBackgroundProps) {
  const { isPlaying, currentTrack } = usePlayer();

  // Rendered intensity (throttled to reduce re-render flicker)
  const [intensity, setIntensity] = useState(0);

  // Internal animation state
  const intensityRef = useRef(0);
  const targetIntensityRef = useRef(0);
  const lastTargetUpdateRef = useRef(0);
  const lastStateUpdateRef = useRef(0);
  const animationRef = useRef<number>();

  const moodColor = useMemo(() => {
    switch (currentTrack?.mood) {
      case "romantic":
        return "rgba(255, 100, 150,";
      case "sad":
        return "rgba(100, 150, 255,";
      case "chill":
        return "rgba(100, 255, 180,";
      case "party":
        return "rgba(180, 100, 255,";
      default:
        return "rgba(100, 200, 255,";
    }
  }, [currentTrack?.mood]);

  useEffect(() => {
    if (!isPlaying) {
      setIntensity(0);
      intensityRef.current = 0;
      targetIntensityRef.current = 0;
      lastTargetUpdateRef.current = 0;
      lastStateUpdateRef.current = 0;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = (t: number) => {
      const now = t ?? performance.now();

      // Update target intensity at a steady cadence (avoid random per-frame jumps)
      if (now - lastTargetUpdateRef.current > 220) {
        const wave = 0.52 + Math.sin(now * 0.0018) * 0.22;
        const noise = (Math.random() - 0.5) * 0.08;
        targetIntensityRef.current = Math.max(0.22, Math.min(1, wave + noise));
        lastTargetUpdateRef.current = now;
      }

      // Smoothly approach target
      const current = intensityRef.current;
      const next = current + (targetIntensityRef.current - current) * 0.06;
      intensityRef.current = next;

      // Throttle React updates to ~30fps to prevent visible flicker
      if (now - lastStateUpdateRef.current > 33) {
        setIntensity(next);
        lastStateUpdateRef.current = now;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  if (!isPlaying) return null;

  return (
    <>
      {/* Edge glow effect */}
      <div
        className={cn(
          "fixed inset-0 pointer-events-none z-[1] mix-blend-screen transition-opacity duration-500 ease-out",
          className
        )}
        style={{
          boxShadow: `inset 0 0 ${150 + intensity * 200}px ${moodColor} ${intensity * 0.5})`,
          opacity: intensity,
        }}
      />

      {/* Corner pulses */}
      <div
        className="fixed top-0 left-0 w-96 h-96 pointer-events-none z-[1] rounded-full blur-3xl mix-blend-screen"
        style={{
          background: `radial-gradient(circle, ${moodColor} ${intensity * 0.6}) 0%, transparent 70%)`,
          transform: `scale(${1 + intensity * 0.75})`,
          transition: "transform 0.35s ease-out",
        }}
      />
      <div
        className="fixed bottom-0 right-0 w-96 h-96 pointer-events-none z-[1] rounded-full blur-3xl mix-blend-screen"
        style={{
          background: `radial-gradient(circle, ${moodColor} ${intensity * 0.6}) 0%, transparent 70%)`,
          transform: `scale(${1 + intensity * 0.75})`,
          transition: "transform 0.35s ease-out",
        }}
      />

      {/* Screen pulse overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] mix-blend-screen"
        style={{
          background: `${moodColor} ${intensity * 0.07})`,
          transition: "background 0.4s ease-out",
        }}
      />
    </>
  );
}
