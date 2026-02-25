import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  glow?: boolean;
}

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ className, variant = "primary", size = "md", glow = true, children, ...props }, ref) => {
    const variants = {
      primary: cn(
        "bg-gradient-to-r from-primary to-neon-purple text-primary-foreground",
        glow && "shadow-[0_0_20px_hsl(190_100%_50%/0.3),0_0_40px_hsl(270_100%_60%/0.2)]",
        "hover:shadow-[0_0_30px_hsl(190_100%_50%/0.5),0_0_60px_hsl(270_100%_60%/0.3)]"
      ),
      secondary: cn(
        "bg-gradient-to-r from-accent to-neon-purple text-accent-foreground",
        glow && "shadow-[0_0_20px_hsl(320_100%_60%/0.3)]",
        "hover:shadow-[0_0_30px_hsl(320_100%_60%/0.5)]"
      ),
      ghost: cn(
        "bg-transparent text-foreground",
        "hover:bg-muted/50"
      ),
      outline: cn(
        "bg-transparent border border-primary/50 text-primary",
        glow && "shadow-[0_0_10px_hsl(190_100%_50%/0.2)]",
        "hover:bg-primary/10 hover:border-primary hover:shadow-[0_0_20px_hsl(190_100%_50%/0.3)]"
      ),
    };

    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "relative font-semibold rounded-xl transition-all duration-300",
          "hover:scale-[1.02] active:scale-[0.98]",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

NeonButton.displayName = "NeonButton";
