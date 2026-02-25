import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ListMusic } from "lucide-react";

interface ThrowAnimationProps {
  show: boolean;
  type: 'like' | 'playlist';
  startPosition: { x: number; y: number };
  onComplete: () => void;
}

export function ThrowAnimation({ show, type, startPosition, onComplete }: ThrowAnimationProps) {
  const [particles, setParticles] = useState<{ id: number; delay: number }[]>([]);

  useEffect(() => {
    if (show) {
      // Create trailing particles
      setParticles(
        Array.from({ length: 5 }, (_, i) => ({
          id: i,
          delay: i * 0.05,
        }))
      );
      
      const timer = setTimeout(() => {
        onComplete();
        setParticles([]);
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  // Target positions (approximate - will fly to top-left for sidebar)
  const endX = type === 'like' ? -startPosition.x + 100 : -startPosition.x + 100;
  const endY = type === 'like' ? -startPosition.y + 300 : -startPosition.y + 400;

  const iconColor = type === 'like' ? 'hsl(0, 100%, 65%)' : 'hsl(185, 100%, 55%)';

  return (
    <AnimatePresence>
      {show && (
        <div 
          className="fixed z-[99] pointer-events-none"
          style={{ left: startPosition.x, top: startPosition.y }}
        >
          {/* Main flying icon */}
          <motion.div
            initial={{ scale: 1, x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: endX,
              y: endY,
              scale: [1, 1.5, 0.5],
              opacity: [1, 1, 0],
              rotate: [0, 20, -10, 0],
            }}
            transition={{
              duration: 0.7,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            className="relative"
          >
            {type === 'like' ? (
              <Heart 
                className="w-6 h-6 fill-red-500 text-red-500" 
                style={{ filter: `drop-shadow(0 0 10px ${iconColor})` }}
              />
            ) : (
              <ListMusic 
                className="w-6 h-6 text-primary" 
                style={{ filter: `drop-shadow(0 0 10px ${iconColor})` }}
              />
            )}
          </motion.div>

          {/* Trail particles */}
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              initial={{ scale: 0.5, x: 0, y: 0, opacity: 0.8 }}
              animate={{
                x: endX * (0.3 + particle.id * 0.15),
                y: endY * (0.3 + particle.id * 0.15),
                scale: 0,
                opacity: 0,
              }}
              transition={{
                duration: 0.5,
                delay: particle.delay,
                ease: "easeOut",
              }}
              className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
              style={{
                background: iconColor,
                boxShadow: `0 0 8px ${iconColor}`,
              }}
            />
          ))}

          {/* Burst effect at start */}
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full"
            style={{
              background: `radial-gradient(circle, ${iconColor} 0%, transparent 70%)`,
            }}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
