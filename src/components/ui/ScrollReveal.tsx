import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
}

export const ScrollReveal = ({ children, delay = 0 }: ScrollRevealProps) => {
  return (
    <motion.div
      initial={{ y: -200, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: "-120px" }}
      transition={{ 
        duration: 2.0, 
        delay, 
        type: "spring", 
        bounce: 0.1,
        damping: 25,
        stiffness: 30
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
};
