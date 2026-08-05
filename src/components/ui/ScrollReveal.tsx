import { motion, useReducedMotion } from "framer-motion";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  staggerChildren?: boolean;
  animationType?: "fade" | "slide" | "scale" | "blur";
  direction?: "up" | "down" | "left" | "right";
  /**
   * Replay the reveal every time the section re-enters the viewport.
   * Defaults to true so scrolling the home page keeps its sense of motion;
   * pass false to animate only on first sight.
   */
  repeat?: boolean;
}

// Matches the Reveal used on the Packages / Flight Information pages, so a
// section entering on the home page moves exactly like one there.
const REVEAL_TRANSITION = {
  duration: 0.7,
  ease: [0.16, 1, 0.3, 1] as const,
};

export const ScrollReveal = ({
  children,
  delay = 0,
  staggerChildren = false,
  animationType = "fade",
  direction = "up",
  repeat = true,
}: ScrollRevealProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || reduceMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        } else if (repeat) {
          // Reset so the next entry replays the reveal.
          setIsInView(false);
        }
      },
      // threshold 0 rather than a fraction: a section taller than the viewport
      // can never expose a given percentage of itself, so a fractional
      // threshold would leave it stuck hidden forever. The inset rootMargin is
      // what delays the trigger until the section is properly on screen.
      { threshold: 0, rootMargin: "-80px 0px -80px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [repeat, reduceMotion]);

  const hiddenState = useMemo(() => {
    switch (animationType) {
      case "slide":
        return {
          opacity: 0,
          x: direction === "left" ? -60 : direction === "right" ? 60 : 0,
          y: direction === "up" ? 40 : direction === "down" ? -40 : 0,
        };
      case "scale":
        return { opacity: 0, scale: 0.85 };
      case "blur":
        return { opacity: 0, filter: "blur(12px)" };
      default:
        return { opacity: 0, y: 32 };
    }
  }, [animationType, direction]);

  const shownState = { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" };

  // Motion is skipped entirely for visitors who ask for reduced motion; the
  // content still renders, it just never moves.
  if (reduceMotion) {
    return (
      <div ref={containerRef} className="w-full">
        {children}
      </div>
    );
  }

  // One persistent wrapper in both states. Swapping between two different
  // element trees (the old approach) remounted the children on every reveal,
  // which would reset the booking wizard's form and refire its data fetches
  // each time the section scrolled back into view.
  if (!staggerChildren) {
    return (
      <div ref={containerRef} className="w-full">
        <motion.div
          initial={false}
          animate={isInView ? shownState : hiddenState}
          transition={{ ...REVEAL_TRANSITION, delay: isInView ? delay : 0 }}
          style={{ willChange: "transform, opacity" }}
        >
          {children}
        </motion.div>
      </div>
    );
  }

  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.15,
        delayChildren: delay,
      },
    },
  };

  return (
    <div ref={containerRef} className="w-full">
      <motion.div
        variants={containerVariants}
        initial={false}
        animate={isInView ? "show" : "hidden"}
        style={{ willChange: "transform, opacity" }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export { };
