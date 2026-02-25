import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  type: 'confetti' | 'star' | 'circle' | 'sparkle';
}

const colors = [
  'hsl(185, 100%, 55%)', // cyan
  'hsl(315, 100%, 65%)', // magenta
  'hsl(270, 100%, 65%)', // purple
  'hsl(335, 100%, 65%)', // pink
  'hsl(160, 100%, 50%)', // green
  'hsl(45, 100%, 60%)',  // gold
  'hsl(0, 100%, 65%)',   // red
];

export function WelcomeAnimation({ onComplete }: { onComplete: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showMessage, setShowMessage] = useState(true);

  const createParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    const types: Particle['type'][] = ['confetti', 'star', 'circle', 'sparkle'];
    
    // Create particles from multiple sources
    for (let i = 0; i < 150; i++) {
      const sourceX = Math.random() * 100;
      const isFromBottom = i < 75;
      
      newParticles.push({
        id: i,
        x: sourceX,
        y: isFromBottom ? 110 : -10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 12 + 6,
        rotation: Math.random() * 360,
        velocityX: (Math.random() - 0.5) * 15,
        velocityY: isFromBottom ? -(Math.random() * 20 + 15) : (Math.random() * 10 + 5),
        type: types[Math.floor(Math.random() * types.length)],
      });
    }
    setParticles(newParticles);
  }, []);

  useEffect(() => {
    createParticles();
    
    // Hide message after 2 seconds
    const messageTimer = setTimeout(() => {
      setShowMessage(false);
    }, 2500);

    // Complete animation after 4 seconds
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 4000);

    return () => {
      clearTimeout(messageTimer);
      clearTimeout(completeTimer);
    };
  }, [createParticles, onComplete]);

  const renderParticle = (particle: Particle) => {
    switch (particle.type) {
      case 'star':
        return (
          <svg viewBox="0 0 24 24" width={particle.size} height={particle.size}>
            <path
              fill={particle.color}
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          </svg>
        );
      case 'sparkle':
        return (
          <div
            className="relative"
            style={{
              width: particle.size,
              height: particle.size,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: particle.color,
                clipPath: 'polygon(50% 0%, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0% 50%, 40% 40%)',
              }}
            />
          </div>
        );
      case 'circle':
        return (
          <div
            className="rounded-full"
            style={{
              width: particle.size,
              height: particle.size,
              background: particle.color,
              boxShadow: `0 0 ${particle.size}px ${particle.color}`,
            }}
          />
        );
      default: // confetti
        return (
          <div
            style={{
              width: particle.size,
              height: particle.size / 2,
              background: particle.color,
              borderRadius: '2px',
            }}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {/* Celebration particles */}
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              x: `${particle.x}vw`,
              y: `${particle.y}vh`,
              rotate: particle.rotation,
              opacity: 1,
              scale: 0,
            }}
            animate={{
              x: `${particle.x + particle.velocityX}vw`,
              y: `${particle.y + particle.velocityY + 50}vh`,
              rotate: particle.rotation + (Math.random() > 0.5 ? 720 : -720),
              opacity: [1, 1, 0],
              scale: [0, 1.2, 1, 0.5],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="absolute"
          >
            {renderParticle(particle)}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Welcome message */}
      <AnimatePresence>
        {showMessage && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0, y: -50 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 20,
            }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="relative">
              {/* Glow rings */}
              <motion.div
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute -inset-20 rounded-full bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30 blur-3xl"
              />
              
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-16 border-2 border-dashed border-primary/40 rounded-full"
              />
              
              <div className="relative text-center px-12 py-8 rounded-3xl backdrop-blur-xl bg-card/80 border border-primary/50 shadow-[0_0_60px_hsl(185_100%_55%/0.3)]">
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <span className="text-6xl mb-4 block">🎉</span>
                </motion.div>
                <h1 className="text-3xl md:text-5xl font-orbitron font-bold neon-text mb-3">
                  Welcome Back!
                </h1>
                <p className="text-muted-foreground text-lg">
                  Let's vibe to some amazing music
                </p>
                
                {/* Sparkles around text */}
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [0, 1, 0],
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: i * 0.2,
                      repeat: Infinity,
                    }}
                    className="absolute w-2 h-2 bg-primary rounded-full"
                    style={{
                      top: `${20 + Math.random() * 60}%`,
                      left: `${Math.random() * 100}%`,
                      boxShadow: '0 0 10px hsl(185 100% 55%)',
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
