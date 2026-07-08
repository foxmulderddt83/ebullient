import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const MobileScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Show button if scrolled down more than 20px and it's a mobile view
      if (window.scrollY > 20 && window.innerWidth < 1024) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    window.addEventListener("resize", toggleVisibility);
    return () => {
      window.removeEventListener("scroll", toggleVisibility);
      window.removeEventListener("resize", toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          onClick={scrollToTop}
          className={cn(
            "fixed bottom-40 right-6 z-[60] h-9 w-9 flex items-center justify-center rounded-full bg-[#CD5C5C]/60 backdrop-blur-sm text-white shadow-lg border border-white/20 active:scale-95 transition-all lg:hidden"
          )}
          aria-label="Scroll to top"
        >
          <ChevronUp className="w-4 h-4 stroke-[3px]" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};
