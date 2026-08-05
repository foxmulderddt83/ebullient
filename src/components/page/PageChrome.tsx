import { ReactNode, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plane } from "lucide-react";

/**
 * Shared chrome for the standalone marketing pages (Packages, Flight Information)
 * and the home page's loading states.
 *
 * These pages used to be static HTML files in /public, which meant navigating to
 * them dropped the visitor out of the SPA entirely — no header, no footer, no
 * transition. They are React routes now, so everything here exists to make that
 * arrival feel deliberate rather than like a page load.
 *
 * The palette is daytime on purpose: flights only operate in daylight, so a
 * near-black page misrepresented the product. Colours follow the site header —
 * white glass over a near-white base, slate-900 text, #CD5C5C accent — with the
 * footer's panel and hexagon-weave language kept intact.
 */

/** Site palette, kept in one place so both pages stay in step with the header. */
export const THEME = {
  accent: "#CD5C5C",
  accentDeep: "#8B3A3A",
  gold: "#D4AF37",
  goldBright: "#FFD700",
  /** Body/heading text — the same slate the header nav uses. */
  ink: "#0f172a",
  /** Page base. */
  paper: "#F8FAFC",
  display: "'Bebas Neue', sans-serif",
  condensed: "'Barlow Condensed', sans-serif",
} as const;

/**
 * Faint hexagon weave, echoing the footer panels. Dark-on-light here — the
 * footer's version is white-on-dark, which is invisible over a pale page.
 */
export const HEX_PATTERN =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath fill='%230f172a' fill-opacity='0.04' d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.89v12.72l11 6.35 11-6.35V17.89l-11-6.35-11 6.35z'/%3E%3C/svg%3E")`;

/**
 * Brand loading indicator. Shared by the page curtain and the home page's
 * section fallbacks so every wait on the site looks like the same product
 * rather than three different spinners.
 */
export const BrandLoader = ({
  label = "One Day Pilot",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) => (
  <div className={`flex flex-col items-center justify-center gap-3 ${compact ? "py-10" : "py-24"}`}>
    {/* Aircraft tracing a holding pattern */}
    <div className={`relative ${compact ? "h-10 w-10" : "h-14 w-14"}`}>
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-dashed"
        style={{ borderColor: `${THEME.accent}44` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
      >
        <Plane
          className={compact ? "h-4 w-4" : "h-5 w-5"}
          style={{ color: THEME.accent, position: "absolute", top: -2, left: "50%", marginLeft: -10 }}
        />
      </motion.div>
    </div>
    <span
      className={`uppercase text-slate-500 ${compact ? "text-[10px]" : "text-xs"}`}
      style={{ fontFamily: THEME.condensed, letterSpacing: "0.3em" }}
    >
      {label}
    </span>
  </div>
);

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
            style={{ background: `linear-gradient(135deg, #ffffff 0%, ${THEME.paper} 100%)` }}
            initial={{ x: 0 }}
            exit={{ x: "-100%", transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }}
          />
          <motion.div
            className="absolute inset-y-0 right-0 w-1/2"
            style={{ background: `linear-gradient(225deg, #ffffff 0%, ${THEME.paper} 100%)` }}
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
              className="text-slate-900 text-xl md:text-2xl uppercase"
              style={{ fontFamily: THEME.display, letterSpacing: "0.22em" }}
            >
              {label}
            </span>
            <div className="h-px w-40 overflow-hidden bg-slate-200">
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
      className="text-3xl md:text-5xl lg:text-6xl uppercase text-slate-900 leading-[1.05]"
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
      <p className="mt-5 mx-auto max-w-3xl text-sm md:text-base leading-relaxed text-slate-600">
        {subtitle}
      </p>
    )}
  </Reveal>
);

/** Glass panel — the footer's card treatment, inverted for a light page. */
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
            backgroundColor: "rgba(255,255,255,0.96)",
            borderColor: "rgba(205,92,92,0.35)",
            boxShadow: "0 34px 80px -34px rgba(15,23,42,0.28), 0 0 24px rgba(205,92,92,0.10)",
          }
        : undefined
    }
    transition={{ duration: 0.4, ease: "easeOut" }}
    className={`relative overflow-hidden border border-black/5 bg-white/75 backdrop-blur-md shadow-[0_20px_60px_-30px_rgba(15,23,42,0.22)] rounded-2xl md:rounded-3xl ${className}`}
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
        ? "text-white shadow-[0_12px_36px_-10px_rgba(205,92,92,0.55)]"
        : "text-slate-900 border border-slate-200 bg-white/80 hover:bg-white hover:border-[#CD5C5C]/40 backdrop-blur-sm shadow-sm"
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

/** Shared daytime page shell: pale base, drifting warm glows, hex weave. */
export const PageShell = ({ children }: { children: ReactNode }) => (
  <div
    className="relative min-h-screen overflow-x-hidden"
    style={{ background: `linear-gradient(180deg, #ffffff 0%, ${THEME.paper} 45%, #eef2f7 100%)` }}
  >
    {/* Ambient drifting glows — sunlight rather than neon */}
    <div className="pointer-events-none fixed inset-0 z-0">
      <motion.div
        className="absolute -top-40 -left-40 h-[38rem] w-[38rem] rounded-full blur-3xl"
        style={{ background: "rgba(205,92,92,0.10)" }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 -right-40 h-[32rem] w-[32rem] rounded-full blur-3xl"
        style={{ background: "rgba(212,175,55,0.12)" }}
        animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[20%] left-1/3 h-[26rem] w-[26rem] rounded-full blur-3xl"
        style={{ background: "rgba(56,132,255,0.07)" }}
        animate={{ x: [0, 40, 0], y: [0, 50, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{ backgroundImage: HEX_PATTERN, backgroundSize: "28px 49px" }}
    />
    <div className="relative z-10">{children}</div>
  </div>
);
