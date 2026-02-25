import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface SeekBarProps {
  value: number;
  duration: number;
  isPlaying?: boolean;
  onSeek: (seconds: number) => void;
  size?: "mini" | "fullscreen";
  className?: string;
}

export function SeekBar({
  value,
  duration,
  isPlaying = false,
  onSeek,
  size = "mini",
  className,
}: SeekBarProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) setInternalValue(value);
  }, [value, isDragging]);

  const disabled = !duration || duration <= 0;
  const percent = duration > 0 ? (internalValue / duration) * 100 : 0;

  const handleSeek = (clientX: number) => {
    if (!trackRef.current || disabled) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newPercent = x / rect.width;
    const newValue = newPercent * duration;
    setInternalValue(newValue);
    return newValue;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    const newValue = handleSeek(e.clientX);
    if (newValue !== undefined) onSeek(newValue);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleSeek(moveEvent.clientX);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const finalValue = handleSeek(upEvent.clientX);
      if (finalValue !== undefined) onSeek(finalValue);
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    const touch = e.touches[0];
    if (touch) {
      const newValue = handleSeek(touch.clientX);
      if (newValue !== undefined) onSeek(newValue);
    }

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const t = moveEvent.touches[0];
      if (t) handleSeek(t.clientX);
    };

    const handleTouchEnd = (endEvent: TouchEvent) => {
      const t = endEvent.changedTouches[0];
      if (t) {
        const finalValue = handleSeek(t.clientX);
        if (finalValue !== undefined) onSeek(finalValue);
      }
      setIsDragging(false);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };

    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);
  };

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative h-1.5 select-none group pointer-events-auto z-10",
        disabled ? "cursor-default" : isDragging ? "cursor-grabbing" : "cursor-grab",
        className
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Track background */}
      <div className="absolute inset-0 rounded-full overflow-hidden bg-white/10 border border-white/20" />

      {/* Colorful progress fill */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full overflow-hidden",
          !isDragging && "transition-[width] duration-75"
        )}
        style={{ width: `${percent}%` }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 shadow-[0_0_12px_rgba(236,72,153,0.5)]" />
      </div>

      {/* Thumb - Transparent with border */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-full",
          "transition-all duration-200 ease-out",
          "w-3 h-3",
          "bg-white/20 backdrop-blur-sm border-2 border-white",
          "shadow-[0_0_8px_rgba(255,255,255,0.5),0_2px_4px_rgba(0,0,0,0.2)]",
          isDragging && "scale-150 bg-white/30",
          !isDragging && "group-hover:scale-125 group-hover:bg-white/30",
          disabled && "opacity-0"
        )}
        style={{ left: `calc(${percent}% - 6px)` }}
      />
    </div>
  );
}
