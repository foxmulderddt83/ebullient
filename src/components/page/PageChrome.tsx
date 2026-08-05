import { ReactNode, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plane } from "lucide-react";

/**
 * Shared chrome for the standalone marketing pages (Packages, Flight Information).
 *
 * These pages used to be static HTML files in /public, which meant navigating to
 * them dropped the visitor out of the SPA entirely — no header, no footer, no
 * transition. They are React routes now, so everything here exists to make that
 * arrival feel deliberate rather than like a page load.
 */

/** Site palette, kept in one place so both pages stay in step with the footer. */
export const THEME = {
  accent: "#CD5C5C",
  gold: "#D4AF37",
  goldBright: "#FFD700",
  ink: "#0D0D0D",
  display: "'Bebas Neue', sans-serif",
  condensed: "'Barlow Condensed', sans-serif",
} as const;

/** Faint hexagon weave reused from the footer panels. */
export const HEX_PATTERN =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath fill='%23ffffff' fill-opacity='0.03' d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.89v12.72l11 6.35 11-6.35V17.89l-11-6.35-11 6.35z'/%3E%3C/svg%3E")`;

/**
 * Full-bleed curtain that wipes away on mount. It buys the page a beat to lay
 * itself out and gives the arrival a sense of occasion, which a plain repaint
 * does not. Honours prefers-reduced-motion by skipping straight to the content.
 */
export const PageTransition = ({ label }: { label: string }) => {
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(reduceMotion === true);

  useEffect(() => {
    if (reduceMotion) return;
    const t = setTimeout(() => setDone(true), 1150);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden pointer-events-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeInOut" } }}
        >
          {/* Two panels part like hangar doors */}
          <motion.div
            className="absolute inset-y-0 left-0 w-1/2"
            style={{ background: THEME.ink }}
            initial={{ x: 0 }}
            exit={{ x: "-100%", transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }}
          />
          <motion.div
            className="absolute inset-y-0 right-0 w-1/2"
            style={{ background: THEME.ink }}
            initial={{ x: 0 }}
            exit={{ x: "100%", transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }}
          />

          <motion.div
            className="relative z-10 flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <motion.div
              animate={{ x: [-18, 18, -18], y: [0, -6, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Plane className="w-9 h-9 -rotate-12" style={{ color: THEME.accent }} />
            </motion.div>
            <span
              className="text-white/90 text-xl md:text-2xl uppercase"
              style={{ fontFamily: THEME.display, letterSpacing: "0.22em" }}
            >
              {label}
            </span>
            <div className="h-px w-40 overflow-hidden bg-white/10">
              <motion.div
                className="h-full w-full"
                style={{ background: `linear-gradient(90deg, transparent, ${THEME.accent}, transparent)` }}
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Scroll-triggered reveal. Replaces the hand-rolled scroll listener the static
 * pages used, which toggled inline styles on every scroll event.
 */
export const Reveal = ({
  children,
  delay = 0,
  y = 32,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
);

/** Section heading with the runway rule underneath. */
export const SectionTitle = ({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: ReactNode;
}) => (
  <Reveal className="text-center mb-12 md:mb-16">
    <h2
      className="text-3xl md:text-5xl lg:text-6xl uppercase text-white leading-[1.05]"
      style={{ fontFamily: THEME.display, letterSpacing: "0.03em" }}
    >
      {children}
    </h2>
    <div className="mt-4 flex items-center justify-center gap-3">
      <span className="h-px w-10 md:w-16" style={{ background: `linear-gradient(90deg, transparent, ${THEME.accent})` }} />
      <Plane className="w-4 h-4 rotate-45" style={{ color: THEME.accent }} />
      <span className="h-px w-10 md:w-16" style={{ background: `linear-gradient(90deg, ${THEME.accent}, transparent)` }} />
    </div>
    {subtitle && (
      <p className="mt-5 mx-auto max-w-3xl text-sm md:text-base leading-relaxed text-gray-400">
        {subtitle}
      </p>
    )}
  </Reveal>
);

/** Glass panel matching the footer's card treatment. */
export const GlassCard = ({
  children,
  className = "",
  hover = true,
  patterned = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  patterned?: boolean;
}) => (
  <motion.div
    whileHover={
      hover
        ? {
            y: -8,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderColor: "rgba(205,92,92,0.3)",
            boxShadow: "0 40px 100px -40px rgba(0,0,0,0.8), 0 0 20px rgba(205,92,92,0.1)",
          }
        : undefined
    }
    transition={{ duration: 0.4, ease: "easeOut" }}
    className={`relative overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_28px_90px_-35px_rgba(0,0,0,0.7)] rounded-2xl md:rounded-3xl ${className}`}
    style={patterned ? { backgroundImage: HEX_PATTERN, backgroundSize: "28px 49px" } : undefined}
  >
    {children}
  </motion.div>
);

/** Primary / secondary buttons in the site's condensed uppercase style. */
export const ActionLink = ({
  href,
  children,
  variant = "primary",
  download,
  external,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  download?: boolean;
  external?: boolean;
}) => (
  <motion.a
    href={href}
    download={download}
    target={external ? "_blank" : undefined}
    rel={external ? "noopener noreferrer" : undefined}
    whileHover={{ scale: 1.04, y: -2 }}
    whileTap={{ scale: 0.97 }}
    transition={{ type: "spring", stiffness: 400, damping: 22 }}
    className={`relative inline-flex items-center justify-center gap-2 overflow-hidden px-7 py-3.5 text-[13px] font-black uppercase rounded-full transition-colors ${
      variant === "primary"
        ? "text-white shadow-[0_12px_36px_-10px_rgba(205,92,92,0.7)]"
        : "text-white border border-white/20 bg-white/5 hover:bg-white/10 backdrop-blur-sm"
    }`}
    style={{
      fontFamily: THEME.condensed,
      letterSpacing: "0.2em",
      background: variant === "primary" ? THEME.accent : undefined,
    }}
  >
    {variant === "primary" && (
      <motion.span
        aria-hidden
        className="absolute top-0 h-full w-12 bg-white/30 skew-x-[-25deg] blur-sm"
        animate={{ left: ["-30%", "130%"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear", repeatDelay: 1.6 }}
      />
    )}
    <span className="relative z-10">{children}</span>
  </motion.a>
);

/** Shared dark page shell: base colour, drifting glow, hex weave, header offset. */
export const PageShell = ({ children }: { children: ReactNode }) => (
  <div className="relative min-h-screen overflow-x-hidden" style={{ background: THEME.ink }}>
    {/* Ambient drifting glows */}
    <div className="pointer-events-none fixed inset-0 z-0">
      <motion.div
        className="absolute -top-40 -left-40 h-[38rem] w-[38rem] rounded-full blur-3xl"
        style={{ background: "rgba(205,92,92,0.10)" }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 -right-40 h-[32rem] w-[32rem] rounded-full blur-3xl"
        style={{ background: "rgba(212,175,55,0.07)" }}
        animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
    <div
      className="pointer-events-none fixed inset-0 z-0 opacity-60"
      style={{ backgroundImage: HEX_PATTERN, backgroundSize: "28px 49px" }}
    />
    <div className="relative z-10">{children}</div>
  </div>
);
