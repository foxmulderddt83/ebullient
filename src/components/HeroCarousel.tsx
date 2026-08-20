import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plane } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

import hero1 from "@/assets/hero-1.jpg";
import hero2 from "@/assets/hero-2.jpg";
import hero3 from "@/assets/hero-3.jpg";

interface HeroSlide {
  id?: string;
  image_url: string;
  title: string;
  subtitle: string;
}

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    image_url: hero1,
    title: "Fly Around Kuala Lumpur City",
    subtitle: "Soar above the skyline — see KL like never before",
  },
  {
    image_url: hero2,
    title: "Filming Production",
    subtitle: "Turn the skies into your set — film with cinematic flair",
  },
  {
    image_url: hero3,
    title: "Piper PA28",
    subtitle: "Take the controls & fly around KL today",
  },
];

export const HeroCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<HeroSlide[]>(DEFAULT_SLIDES);
  const [heroButtonText, setHeroButtonText] = useState("BOOK NOW");
  const [heroGradient, setHeroGradient] = useState<string>("");
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  const [direction, setDirection] = useState(1);
  const [buttonStyles, setButtonStyles] = useState({
    btn1_text: "BOOK NOW",
    btn1_size: "text-sm",
    btn1_color: "#ffffff",
    btn1_bg: "#CD5C5C",
    btn2_text: "OUR STORY",
    btn2_size: "text-sm",
    btn2_color: "#ffffff",
    btn2_bg: "transparent"
  });

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.paused === "boolean") setIsGlobalPaused(detail.paused);
    };
    window.addEventListener("toggle-animation-freeze", handleToggle);
    return () => window.removeEventListener("toggle-animation-freeze", handleToggle);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const fetchData = async () => {
        if (!supabase) return;
        const { data: slidesData } = await supabase
          .from("hero_slides").select("*").order("order", { ascending: true });
        if (slidesData && slidesData.length > 0) setSlides(slidesData as HeroSlide[]);
        const { data: settingsData } = await supabase
          .from("site_settings").select("*").in("key", [
            "hero_button_text", "bg_gradient_hero",
            "hero_btn1_text", "hero_btn1_size", "hero_btn1_color", "hero_btn1_bg",
            "hero_btn2_text", "hero_btn2_size", "hero_btn2_color", "hero_btn2_bg"
          ]);
        if (settingsData) {
          const btn1Text = settingsData.find(s => s.key === "hero_btn1_text")?.value || settingsData.find(s => s.key === "hero_button_text")?.value;
          if (btn1Text) setHeroButtonText(btn1Text);

          setButtonStyles(prev => ({
            btn1_text: btn1Text || prev.btn1_text,
            btn1_size: settingsData.find(s => s.key === "hero_btn1_size")?.value || prev.btn1_size,
            btn1_color: settingsData.find(s => s.key === "hero_btn1_color")?.value || prev.btn1_color,
            btn1_bg: settingsData.find(s => s.key === "hero_btn1_bg")?.value || prev.btn1_bg,
            btn2_text: settingsData.find(s => s.key === "hero_btn2_text")?.value || prev.btn2_text,
            btn2_size: settingsData.find(s => s.key === "hero_btn2_size")?.value || prev.btn2_size,
            btn2_color: settingsData.find(s => s.key === "hero_btn2_color")?.value || prev.btn2_color,
            btn2_bg: settingsData.find(s => s.key === "hero_btn2_bg")?.value || prev.btn2_bg,
          }));

          const gradient = settingsData.find(s => s.key === "bg_gradient_hero")?.value;
          if (gradient) setHeroGradient(gradient);
        }
      };
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const nextSlide = useCallback(() => {
    if (slides.length === 0) return;
    setDirection(1);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    if (slides.length === 0) return;
    setDirection(-1);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (isGlobalPaused) return;
    const interval = setInterval(nextSlide, 6500);
    return () => clearInterval(interval);
  }, [nextSlide, isGlobalPaused]);

  if (slides.length === 0) return null;

  return (
    <section
      id="home"
      className="relative h-screen w-full overflow-hidden"
      style={{ background: heroGradient || '#0B1424' }}
    >
      {/* ── Slide Images ── */}
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentSlide}
          custom={direction}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-0"
        >
          <img
            src={slides[currentSlide].image_url}
            alt={slides[currentSlide].title}
            className="w-full h-full object-cover"
            style={{ filter: 'saturate(1.15) contrast(1.06) brightness(1.02)' }}
            {...({ fetchpriority: currentSlide === 0 ? "high" : "auto" } as any)}
            loading={currentSlide === 0 ? "eager" : "lazy"}
            decoding="async"
            width={1920}
            height={1080}
          />
          {/* Cinematic multi-stop overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: `
                linear-gradient(180deg,
                  rgba(11,20,36,0.15) 0%,
                  rgba(11,20,36,0.05) 25%,
                  rgba(11,20,36,0.35) 60%,
                  rgba(11,20,36,0.85) 100%
                ),
                linear-gradient(90deg,
                  rgba(11,20,36,0.55) 0%,
                  rgba(11,20,36,0.15) 45%,
                  transparent 100%
                )
              `,
            }}
          />
          {/* Red runway-light glow */}
          <div
            className="absolute bottom-0 left-0 w-3/4 h-2/5 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 20% 100%, rgba(205,92,92,0.22) 0%, transparent 60%)',
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* ── HUD: Top runway-frame ── */}
      <div className="absolute top-[88px] left-0 right-0 z-10 px-6 md:px-12 pointer-events-none">
        <div className="flex items-center justify-between text-white/40 text-[10px] tracking-[0.3em] font-condensed">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#CD5C5C] animate-pulse" />
            <span>LIVE · WMSA · SUBANG</span>
          </div>
          <div className="hidden md:flex items-center gap-4 font-mono">
            <span>03°07'N</span>
            <span>101°33'E</span>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="absolute inset-0 flex items-end z-10 pb-20 md:pb-28">
        <div className="container mx-auto px-6 md:px-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-4xl"
            >
              {/* Eyebrow with crosshair marker */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 }}
                className="flex items-center gap-3 mb-5"
              >
                <div className="relative">
                  <div className="w-10 h-[2px] bg-[#CD5C5C]" />
                  <div className="absolute -right-1 -top-[3px] w-2 h-2 border-r-2 border-t-2 border-[#CD5C5C] rotate-45" />
                </div>
                <span className="text-white text-[10px] font-bold tracking-[0.35em] uppercase font-condensed">
                  One Day Pilot · Flight Experience
                </span>
              </motion.div>

              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="text-white mb-5 font-title tracking-[0.015em] leading-[0.92]"
                style={{
                  fontSize: 'clamp(3.5rem, 10vw, 7.5rem)', // Slightly larger on desktop for more impact
                  textShadow: '0 4px 32px rgba(0,0,0,0.4)',
                }}
              >
                {slides[currentSlide].title}
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                className="mb-9 max-w-2xl font-jakarta tracking-[0.01em] text-white/80 leading-relaxed"
                style={{
                  fontSize: 'clamp(1rem, 1.8vw, 1.25rem)', // Increased size for desktop readability
                }}
              >
                {slides[currentSlide].subtitle}
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 }}
                className="flex flex-wrap gap-3"
              >
                {/* Primary */}
                <button
                  onClick={() => {
                    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`group relative flex items-center gap-3 pl-7 pr-3 py-3.5 font-bold tracking-[0.18em] uppercase transition-all duration-500 hover:-translate-y-0.5 rounded-full overflow-hidden ${buttonStyles.btn1_size}`}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    background: `linear-gradient(135deg, ${buttonStyles.btn1_bg} 0%, ${buttonStyles.btn1_bg}cc 100%)`,
                    color: buttonStyles.btn1_color,
                    boxShadow: `0 8px 32px -8px ${buttonStyles.btn1_bg}aa, inset 0 1px 0 rgba(255,255,255,0.25)`,
                    letterSpacing: '0.18em',
                  }}
                >
                  <span className="relative z-10">{heroButtonText}</span>
                  <span className="relative z-10 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
                    <Plane className="w-3.5 h-3.5 -rotate-45 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </button>

                {/* Secondary — glass */}
                <button
                  onClick={() => document.getElementById('experience')?.scrollIntoView({ behavior: 'smooth' })}
                  className="group flex items-center gap-2 px-7 py-3.5 font-bold tracking-[0.18em] uppercase transition-all duration-300 hover:bg-white/15 rounded-full"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    background: 'rgba(255,255,255,0.06)',
                    color: buttonStyles.btn2_color || '#fff',
                    border: '1px solid rgba(255,255,255,0.25)',
                    backdropFilter: 'blur(8px)',
                    letterSpacing: '0.18em',
                    fontSize: buttonStyles.btn2_size === 'text-sm' ? '0.875rem' : buttonStyles.btn2_size === 'text-base' ? '1rem' : buttonStyles.btn2_size === 'text-lg' ? '1.125rem' : '0.875rem',
                  }}
                >
                  {buttonStyles.btn2_text}
                  <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Right side: slide nav as flight ticker ── */}
      <div className="absolute right-5 md:right-10 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2.5">
        <button
          onClick={prevSlide}
          className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-all hover:bg-white/10 rounded-full border border-white/25 backdrop-blur-sm"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          className="flex flex-col items-center px-3 py-3 rounded-2xl border border-white/15 bg-black/20 backdrop-blur-md min-w-[58px]"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          <span className="text-[#CD5C5C] text-2xl leading-none tracking-wider">
            {String(currentSlide + 1).padStart(2, '0')}
          </span>
          <span className="text-white/30 text-[9px] tracking-[0.3em] my-1.5" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>OF</span>
          <span className="text-white/50 text-lg leading-none tracking-wider">
            {String(slides.length).padStart(2, '0')}
          </span>
        </div>

        <button
          onClick={nextSlide}
          className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-all hover:bg-white/10 rounded-full border border-white/25 backdrop-blur-sm"
          aria-label="Next slide"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Bottom progress indicators ── */}
      <div className="absolute bottom-8 left-6 md:left-12 z-20 flex gap-2 items-center">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setDirection(index > currentSlide ? 1 : -1);
              setCurrentSlide(index);
            }}
            className="transition-all duration-500 relative h-[3px] overflow-hidden rounded-full"
            style={{
              width: index === currentSlide ? '44px' : '14px',
              background: 'rgba(255,255,255,0.25)',
            }}
            aria-label={`Go to slide ${index + 1}`}
          >
            {index === currentSlide && (
              <motion.span
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 6.5, ease: 'linear' }}
                key={currentSlide}
                className="absolute inset-y-0 left-0 bg-[#CD5C5C]"
              />
            )}
          </button>
        ))}
      </div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 right-1/2 translate-x-1/2 md:right-12 md:translate-x-0 z-10 flex flex-col items-center gap-2 text-white/50"
      >
        <span className="text-[9px] tracking-[0.4em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-[1px] h-6 bg-gradient-to-b from-white/60 to-transparent"
        />
      </motion.div>
    </section>
  );
};
