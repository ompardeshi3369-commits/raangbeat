import { useState, useRef, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ThrowAnimation } from "@/components/effects/ThrowAnimation";

interface AnimatedActionButtonProps {
  onClick: () => void;
  isActive?: boolean;
  type: 'like' | 'playlist';
  children: ReactNode;
  className?: string;
  title?: string;
}

export function AnimatedActionButton({
  onClick,
  isActive = false,
  type,
  children,
  className,
  title,
}: AnimatedActionButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showThrow, setShowThrow] = useState(false);
  const [throwPosition, setThrowPosition] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    // Get button position for throw animation
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setThrowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }

    setIsAnimating(true);
    
    // Only show throw animation when adding (not removing)
    if (type === 'like' && !isActive) {
      setShowThrow(true);
    } else if (type === 'playlist') {
      setShowThrow(true);
    }
    
    onClick();

    setTimeout(() => setIsAnimating(false), 400);
  };

  const baseStyles = type === 'like' 
    ? cn(
        "relative p-2 rounded-full transition-all duration-300",
        "hover:bg-red-500/10 group",
        isActive ? "text-red-500" : "text-muted-foreground hover:text-red-400"
      )
    : cn(
        "relative p-2 rounded-xl transition-all duration-300",
        "bg-gradient-to-br from-primary/20 via-accent/10 to-transparent",
        "border border-primary/30 hover:border-primary/60",
        "hover:shadow-[0_0_20px_hsl(185_100%_55%/0.3)]",
        "text-primary hover:text-primary group"
      );

  return (
    <>
      <motion.button
        ref={buttonRef}
        onClick={handleClick}
        className={cn(baseStyles, className)}
        title={title}
        whileTap={{ scale: 0.85 }}
        animate={isAnimating ? {
          scale: [1, 1.3, 0.9, 1.1, 1],
        } : {}}
        transition={{ duration: 0.4 }}
      >
        {/* Ripple effect */}
        <AnimatePresence>
          {isAnimating && (
            <motion.div
              initial={{ scale: 0, opacity: 0.5 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className={cn(
                "absolute inset-0 rounded-full",
                type === 'like' ? "bg-red-500" : "bg-primary"
              )}
            />
          )}
        </AnimatePresence>

        {/* Sparkle effects for playlist button */}
        {type === 'playlist' && (
          <>
            <motion.div
              animate={{ 
                rotate: 360,
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{ 
                rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                opacity: { duration: 2, repeat: Infinity }
              }}
              className="absolute -inset-1 rounded-xl border border-dashed border-primary/30 pointer-events-none"
            />
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 0.8, 0],
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.6,
                  repeat: Infinity,
                }}
                className="absolute w-1 h-1 bg-primary rounded-full pointer-events-none"
                style={{
                  top: i === 0 ? '-4px' : i === 1 ? '50%' : 'auto',
                  bottom: i === 2 ? '-4px' : 'auto',
                  right: i === 1 ? '-4px' : '50%',
                  boxShadow: '0 0 6px hsl(185 100% 55%)',
                }}
              />
            ))}
          </>
        )}

        {/* Icon with animation */}
        <motion.div
          animate={isAnimating ? {
            rotate: type === 'like' ? [0, -20, 20, -10, 10, 0] : [0, 15, -15, 0],
            y: type === 'like' ? [0, -3, 0] : [0, -2, 0],
          } : {}}
          transition={{ duration: 0.4 }}
          className="relative z-10"
        >
          {children}
        </motion.div>

        {/* Heart burst particles */}
        <AnimatePresence>
          {isAnimating && type === 'like' && isActive && (
            <>
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{
                    scale: [0, 1, 0],
                    x: Math.cos((i * 60 * Math.PI) / 180) * 25,
                    y: Math.sin((i * 60 * Math.PI) / 180) * 25,
                  }}
                  transition={{ duration: 0.5, delay: i * 0.03 }}
                  className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-red-500 rounded-full"
                  style={{ boxShadow: '0 0 8px hsl(0 100% 65%)' }}
                />
              ))}
            </>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Throw animation */}
      <ThrowAnimation
        show={showThrow}
        type={type}
        startPosition={throwPosition}
        onComplete={() => setShowThrow(false)}
      />
    </>
  );
}
