import { cn } from "@/lib/utils";
import { ReactNode, CSSProperties, MouseEventHandler } from "react";

export interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

export function GlassCard({ children, className, hover = false, glow = false, style, onClick }: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-card/60 backdrop-blur-xl",
        "border border-border/30",
        hover && "transition-all duration-300 hover:bg-card/80 hover:border-primary/30 hover:shadow-[0_0_30px_hsl(190_100%_50%/0.15)]",
        glow && "shadow-[0_0_20px_hsl(190_100%_50%/0.1)]",
        onClick && "cursor-pointer",
        className
      )}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
