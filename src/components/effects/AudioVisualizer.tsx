import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/contexts/PlayerContext";

interface AudioVisualizerProps {
  isPlaying: boolean;
  className?: string;
  barCount?: number;
  variant?: "bars" | "wave" | "circle" | "spectrum";
}

export function AudioVisualizer({
  isPlaying,
  className,
  barCount = 20,
  variant = "bars",
}: AudioVisualizerProps) {
  const { progress, duration } = usePlayer();
  const [heights, setHeights] = useState<number[]>(Array(barCount).fill(15));
  const animationRef = useRef<number>();
  const progressRef = useRef(progress);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!isPlaying) {
      // Smoothly animate bars down when paused
      const animateDown = () => {
        setHeights(prev => {
          const newHeights = prev.map(h => h + (15 - h) * 0.1);
          const allSettled = newHeights.every(h => Math.abs(h - 15) < 0.5);
          if (!allSettled) {
            animationRef.current = requestAnimationFrame(animateDown);
          }
          return newHeights;
        });
      };
      animateDown();
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }

    const animate = (timestamp: number) => {
      setHeights(prev => prev.map((prevHeight, i) => {
        const position = i / barCount;

        // Smooth flowing waves
        const wave1 = Math.sin(timestamp * 0.002 - position * Math.PI * 2.5) * 22;
        const wave2 = Math.sin(timestamp * 0.0015 - position * Math.PI * 1.8) * 16;

        const targetHeight = 52 + wave1 + wave2;

        // Balanced interpolation - not too slow, not too fast
        const smoothed = prevHeight + (targetHeight - prevHeight) * 0.08;

        return Math.min(92, Math.max(18, smoothed));
      }));

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, barCount]);

  if (variant === "bars" || variant === "spectrum") {
    return (
      <div className={cn("flex items-end justify-center gap-[2px] h-full", className)}>
        {heights.map((height, i) => {
          const progress = i / barCount;
          const hue = 330 - progress * 100;

          return (
            <div
              key={i}
              className="rounded-sm will-change-transform"
              style={{
                width: `${100 / barCount}%`,
                minWidth: '3px',
                maxWidth: '10px',
                height: `${height}%`,
                background: `hsla(${hue}, 85%, 60%, 0.95)`,
                boxShadow: isPlaying
                  ? `0 0 10px hsla(${hue}, 90%, 55%, 0.6)`
                  : 'none',
              }}
            />
          );
        })}
      </div>
    );
  }

  if (variant === "wave") {
    const points = heights.map((h, i) => {
      const x = (i / (barCount - 1)) * 200;
      const y = 25 - (h - 50) * 0.4;
      return `${x},${y}`;
    }).join(' L');

    return (
      <div className={cn("relative", className)}>
        <svg viewBox="0 0 200 50" className="w-full h-full">
          <defs>
            <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(320, 100%, 60%)" />
              <stop offset="50%" stopColor="hsl(280, 100%, 60%)" />
              <stop offset="100%" stopColor="hsl(240, 100%, 60%)" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d={`M0,25 L${points} L200,25`}
            fill="none"
            stroke="url(#waveGradient)"
            strokeWidth="2"
            filter="url(#glow)"
          />
        </svg>
      </div>
    );
  }

  if (variant === "circle") {
    return (
      <div className={cn("relative flex items-center justify-center", className)}>
        <div className="relative w-full h-full">
          {heights.slice(0, 12).map((height, i) => {
            const angle = (i / 12) * 360;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 w-1 rounded-full origin-bottom"
                style={{
                  height: `${height * 0.4}%`,
                  transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                  background: `linear-gradient(to top, hsl(320, 100%, 55%), hsl(${280 + i * 8}, 100%, 60%))`,
                  boxShadow: `0 0 4px hsl(320, 100%, 55%)`,
                  transition: 'height 0.12s ease-out',
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
