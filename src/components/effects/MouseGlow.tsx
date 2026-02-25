import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface MouseGlowProps {
  className?: string;
}

export function MouseGlow({ className }: MouseGlowProps) {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (glowRef.current) {
        glowRef.current.style.left = `${e.clientX}px`;
        glowRef.current.style.top = `${e.clientY}px`;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      ref={glowRef}
      className={cn(
        "fixed w-[300px] h-[300px] pointer-events-none",
        "rounded-full opacity-20",
        "bg-gradient-radial from-primary/40 via-primary/10 to-transparent",
        "blur-3xl -translate-x-1/2 -translate-y-1/2",
        "transition-opacity duration-300",
        className
      )}
      style={{ zIndex: 1 }}
    />
  );
}
