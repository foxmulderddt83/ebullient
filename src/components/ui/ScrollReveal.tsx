import { motion } from "framer-motion";
import { ReactNode, useEffect, useRef, useState } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  staggerChildren?: boolean;
  animationType?: "fade" | "slide" | "scale" | "blur";
  direction?: "up" | "down" | "left" | "right";
}

export const ScrollReveal = ({
  children,
  delay = 0,
  staggerChildren = false,
  animationType = "fade",
  direction = "up",
}: ScrollRevealProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "-80px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const getInitialProps = () => {
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
        return { opacity: 0, y: 50 };
    }
  };

  if (!staggerChildren) {
    return (
      <div ref={containerRef} className="w-full">
        {isInView ? (
          <motion.div
            initial={getInitialProps()}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{
              type: "spring",
              damping: 20,
              stiffness: 70,
              duration: 0.8,
              delay,
            }}
          >
            {children}
          </motion.div>
        ) : (
          <div style={{ visibility: "hidden" }}>{children}</div>
        )}
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

  const childVariants = {
    hidden: getInitialProps(),
    show: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        type: "spring",
        damping: 20,
        stiffness: 70,
        duration: 0.7,
      },
    },
  };

  return (
    <div ref={containerRef} className="w-full">
      {isInView ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {children}
        </motion.div>
      ) : (
        <div style={{ visibility: "hidden" }}>{children}</div>
      )}
    </div>
  );
};

export { };
