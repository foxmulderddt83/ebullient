import { ReactNode, useEffect, useRef, useState } from "react";
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
    // Was 1150ms. The curtain is the first thing between the visitor and the
    // page, and it was holding the content back longer than the page needs to
    // lay itself out. 700ms still reads as a deliberate arrival.
    const t = setTimeout(() => setDone(true), 700);
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
            {/* The plane used to bob and the rule used to run a shimmer, both
                on infinite loops. Over a 700ms curtain neither completes a
                cycle, so they were pure cost for no read. */}
            <Plane className="w-9 h-9 -rotate-12" style={{ color: THEME.accent }} />
            <span
              className="text-slate-900 text-xl md:text-2xl uppercase"
              style={{ fontFamily: THEME.display, letterSpacing: "0.22em" }}
            >
              {label}
            </span>
            <div
              className="h-px w-40"
              style={{ background: `linear-gradient(90deg, transparent, ${THEME.accent}, transparent)` }}
            />
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
const REVEAL_EASE = "cubic-bezier(.16,1,.3,1)";

/**
 * One IntersectionObserver for every Reveal on the page.
 *
 * framer-motion's whileInView creates an observer per motion component, and
 * these pages have sixty-odd of them. Sixty observers all reporting into the
 * same scroll, each waking its own component to run a JS-driven animation, is
 * a lot of work for what is ultimately a fade and a 24px slide. One observer
 * feeding a boolean into a CSS transition does the same job on the compositor.
 */
const revealCallbacks = new WeakMap<Element, () => void>();
let revealObserver: IntersectionObserver | null = null;

const getRevealObserver = () => {
  if (revealObserver) return revealObserver;
  revealObserver = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        revealCallbacks.get(entry.target)?.();
        // Reveal once, then stop watching. Nothing here survives to cost
        // anything on later scrolls.
        revealObserver?.unobserve(entry.target);
        revealCallbacks.delete(entry.target);
      }
    },
    { rootMargin: "0px 0px -60px 0px" }
  );
  return revealObserver;
};

export const Reveal = ({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) => {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = getRevealObserver();
    revealCallbacks.set(el, () => setShown(true));
    observer.observe(el);
    return () => {
      observer.unobserve(el);
      revealCallbacks.delete(el);
    };
  }, [reduceMotion]);

  // Nothing to animate — render a plain div, so this subtree gets no observer
  // and no transition at all.
  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translateY(${y}px)`,
        transition: `opacity .5s ${REVEAL_EASE} ${delay}s, transform .5s ${REVEAL_EASE} ${delay}s`,
      }}
    >
      {children}
    </div>
  );
};

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

/**
 * Glass panel — the footer's card treatment, inverted for a light page.
 *
 * Performance note. This carried `backdrop-blur-md` and a framer-motion hover.
 * backdrop-filter is the expensive one: the browser must re-sample everything
 * behind the element whenever it or the page moves, so with two or three dozen
 * cards on the page the blur was being recomputed continuously while scrolling.
 * The page sits on a near-white base, so a slightly more opaque white reads
 * almost identically for none of the cost. The lift is a plain CSS transition
 * now — the GPU handles it without a motion component per card.
 */
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
  <div
    className={`relative overflow-hidden border border-black/5 bg-white/85 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.22)] rounded-2xl md:rounded-3xl ${
      hover
        ? "transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-2 hover:border-[#CD5C5C]/35 hover:shadow-[0_34px_80px_-34px_rgba(15,23,42,0.28)]"
        : ""
    } ${className}`}
    style={patterned ? { backgroundImage: HEX_PATTERN, backgroundSize: "28px 49px" } : undefined}
  >
    {children}
  </div>
);

/**
 * Primary / secondary buttons in the site's condensed uppercase style.
 *
 * Performance note. Every primary button used to run a blurred sheen across
 * itself on an infinite loop, whether or not it was on screen — a dozen of
 * these were animating at once. The sheen now sweeps on hover only, so it still
 * catches the eye where it matters and costs nothing at rest. Hover/press are
 * CSS transitions rather than a spring, which keeps the buttons off the JS
 * animation loop entirely.
 */
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
  <a
    href={href}
    download={download}
    target={external ? "_blank" : undefined}
    rel={external ? "noopener noreferrer" : undefined}
    className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden px-7 py-3.5 text-[13px] font-black uppercase rounded-full transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.98] ${
      variant === "primary"
        ? "text-white shadow-[0_12px_36px_-10px_rgba(205,92,92,0.55)]"
        : "text-slate-900 border border-slate-200 bg-white/90 hover:bg-white hover:border-[#CD5C5C]/40 shadow-sm"
    }`}
    style={{
      fontFamily: THEME.condensed,
      letterSpacing: "0.2em",
      background: variant === "primary" ? THEME.accent : undefined,
    }}
  >
    {variant === "primary" && (
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 h-full w-12 -translate-x-[200%] skew-x-[-25deg] bg-white/30 transition-transform duration-700 ease-out group-hover:translate-x-[900%]"
      />
    )}
    <span className="relative z-10">{children}</span>
  </a>
);

/**
 * Shared daytime page shell: pale base, warm glows, hex weave.
 *
 * Performance note. The glows used to be three `blur-3xl` divs on infinite x/y
 * loops. A 64px filter over a 600px circle is one of the most expensive things
 * a browser can repaint, and because the layer was fixed and always animating,
 * that cost was paid on every single frame of every scroll — three times over.
 * They are radial-gradients now: same sunlight, no filter, no animation, and
 * the whole backdrop collapses into one static layer the compositor can cache.
 * The hex weave is painted into the same element rather than a second fixed
 * layer, halving the full-screen overdraw.
 */
export const PageShell = ({ children }: { children: ReactNode }) => (
  <div
    className="relative min-h-screen overflow-x-hidden"
    style={{ background: `linear-gradient(180deg, #ffffff 0%, ${THEME.paper} 45%, #eef2f7 100%)` }}
  >
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        backgroundImage: [
          HEX_PATTERN,
          "radial-gradient(38rem 38rem at 8% 6%, rgba(205,92,92,0.13), transparent 70%)",
          "radial-gradient(32rem 32rem at 96% 52%, rgba(212,175,55,0.15), transparent 70%)",
          "radial-gradient(26rem 26rem at 42% 24%, rgba(56,132,255,0.09), transparent 70%)",
        ].join(", "),
        backgroundSize: "28px 49px, auto, auto, auto",
      }}
    />
    <div className="relative z-10">{children}</div>
  </div>
);
