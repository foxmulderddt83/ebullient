import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  isStar: boolean;
}

interface BackgroundParticlesProps {
  variant?: 'dark' | 'light';
  count?: number;
  isPaused?: boolean;
  speedMultiplier?: number;
}

export const BackgroundParticles = ({ 
  variant = 'dark', 
  count, 
  isPaused = false,
  speedMultiplier = 1 
}: BackgroundParticlesProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.paused === 'boolean') {
        setIsGlobalPaused(detail.paused);
      }
    };
    window.addEventListener('toggle-animation-freeze', handleToggle);
    return () => window.removeEventListener('toggle-animation-freeze', handleToggle);
  }, []);

  const effectivelyPaused = isPaused || isGlobalPaused;

  useEffect(() => {
    const generateParticles = () => {
      const newParticles: Particle[] = [];
      const particleCount = count || (variant === 'dark' ? 30 : 0);
      
      for (let i = 0; i < particleCount; i++) {
        const baseDuration = Math.random() * 40 + 60;
        newParticles.push({
          id: i,
          x: Math.random() * 100,
          y: 110,
          size: Math.random() * 5 + 3,
          duration: baseDuration / speedMultiplier,
          delay: Math.random() * 40,
          isStar: variant === 'dark' && Math.random() > 0.85
        });
      }
      setParticles(newParticles);
    };

    generateParticles();
  }, [variant, count, speedMultiplier]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[50]">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={variant === 'dark' ? { 
            top: "110%", 
            left: `${particle.x}%`, 
            opacity: 0,
            scale: 0.5
          } : {
            left: "-20%",
            top: `${particle.y}%`,
            opacity: 0,
            scale: 1
          }}
          animate={effectivelyPaused ? {} : { 
            top: "-10%", 
            opacity: [0, 0.6, 0.6, 0], // Slightly increased peak opacity for better visibility
            scale: particle.isStar ? [0.8, 1.5, 0.8] : 1, // Further increased scale range for stars
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "linear"
          }}
          className="absolute"
          style={variant === 'dark' ? {
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.isStar ? "#FFD700" : "#FFFFFF",
            borderRadius: "50%",
            filter: particle.isStar ? "blur(1px) drop-shadow(0 0 5px #FFD700)" : "blur(1px)",
            boxShadow: particle.isStar ? "0 0 10px 2px rgba(255, 215, 0, 0.4)" : "none"
          } : {
            width: particle.size * 4, 
            height: particle.size * 2,
            filter: "blur(8px)", // Softer edges for ultra-minimal look
            pointerEvents: "none"
          }}
        >
          {variant === 'light' ? (
            <svg 
              viewBox="0 0 24 24" 
              fill="white" 
              className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.1)]"
              style={{ opacity: 0.4 }} // More transparent SVG
            >
              <path d="M17.5,19c-3.037,0-5.5-2.463-5.5-5.5c0-0.007,0-0.013,0-0.019C11.365,13.823,10.697,14,10,14c-2.209,0-4-1.791-4-4 c0-2.198,1.772-3.98,3.966-3.999C10.158,3.351,12.355,1,15,1c2.761,0,5,2.239,5,5c0,0.01,0,0.02,0,0.03 C21.144,6.471,22,7.632,22,9c0,2.209-1.791,4-4,4c-0.12,0-0.238-0.006-0.355-0.016C17.618,13.065,17.5,13.268,17.5,13.5 C17.5,16.537,19.963,19,23,19" />
            </svg>
          ) : particle.isStar && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-[1px] bg-yellow-200 rotate-45 scale-150" />
              <div className="w-full h-[1px] bg-yellow-200 -rotate-45 scale-150" />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
};
