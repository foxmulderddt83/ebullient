import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { BackgroundParticles } from "./ui/BackgroundParticles";

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
  const [heroButtonText, setHeroButtonText] = useState("BOOK YOUR FLIGHT");
  const [heroGradient, setHeroGradient] = useState<string>("");
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.paused === "boolean") setIsGlobalPaused(detail.paused);
    };
    window.addEventListener("toggle-animation-freeze", handleToggle);
    return () => window.removeEventListener("toggle-animation-freeze", handleToggle);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) return;
      const { data: slidesData } = await supabase
        .from("hero_slides").select("*").order("order", { ascending: true });
      if (slidesData && slidesData.length > 0) setSlides(slidesData as HeroSlide[]);
      const { data: settingsData } = await supabase
        .from("site_settings").select("*").in("key", ["hero_button_text", "bg_gradient_hero"]);
      if (settingsData) {
        const buttonText = settingsData.find(s => s.key === "hero_button_text")?.value;
        if (buttonText) setHeroButtonText(buttonText);
        const gradient = settingsData.find(s => s.key === "bg_gradient_hero")?.value;
        if (gradient) setHeroGradient(gradient);
      }
    };
    fetchData();
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
    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [nextSlide, isGlobalPaused]);

  if (slides.length === 0) return null;

  return (
    <section
      id="home"
      className="relative h-screen w-full overflow-hidden"
      style={{ background: heroGradient || '#06091a' }}
    >
      <BackgroundParticles />

      {/* ── Slide Images ── */}
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentSlide}
          custom={direction}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-0 z-0"
        >
          <img
            src={slides[currentSlide].image_url}
            alt={slides[currentSlide].title}
            className="w-full h-full object-cover"
            style={{ filter: 'saturate(1.1) contrast(1.05)' }}
          />
          {/* Multi-layer gradient overlay — OXBOLD style: dark bottom-heavy */}
          <div
            className="absolute inset-0"
            style={{
              background: `
                linear-gradient(to bottom,
                  rgba(6,9,18,0.3) 0%,
                  rgba(6,9,18,0.1) 30%,
                  rgba(6,9,18,0.5) 65%,
                  rgba(6,9,18,0.88) 100%
                ),
                linear-gradient(to right,
                  rgba(6,9,18,0.4) 0%,
                  transparent 40%,
                  transparent 100%
                )
              `,
            }}
          />
          {/* Red accent vignette — bottom left */}
          <div
            className="absolute bottom-0 left-0 w-2/3 h-1/3"
            style={{
              background: 'radial-gradient(ellipse at bottom left, rgba(234,88,12,0.12) 0%, transparent 70%)',
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* ── Diagonal top-right accent bar ── */}
      <div
        className="absolute top-0 right-0 w-1/3 h-1 z-10"
        style={{ background: 'linear-gradient(90deg, transparent, #ea580c)' }}
      />

      {/* ── Content ── */}
      <div className="absolute inset-0 flex items-end z-10 pb-16 md:pb-24">
        <div className="container mx-auto px-6 md:px-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="max-w-4xl"
            >
              {/* Eyebrow */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3 mb-4"
              >
                <div className="w-8 h-[2px] bg-[#ea580c]" />
                <span
                  className="text-[#ea580c] text-[10px] font-black tracking-[0.35em] uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  One Day Pilot Experience
                </span>
              </motion.div>

              {/* Main title — huge OXBOLD display */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-white mb-4 leading-none"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 'clamp(3.2rem, 9vw, 7rem)',
                  letterSpacing: '0.03em',
                  textShadow: '0 4px 30px rgba(0,0,0,0.8)',
                  lineHeight: '0.95',
                }}
              >
                {slides[currentSlide].title}
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mb-8"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 'clamp(0.9rem, 2vw, 1.15rem)',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                {slides[currentSlide].subtitle}
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="flex flex-wrap gap-4"
              >
                {/* Primary CTA — angled OXBOLD */}
                <button
                  onClick={() => {
                    trackEvent({
                      action_type: 'click',
                      entity_type: 'hero_slide',
                      entity_id: slides[currentSlide].id || `slide-${currentSlide}`,
                      entity_name: slides[currentSlide].title,
                      details: { button_text: heroButtonText }
                    });
                    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="group flex items-center gap-2 px-8 py-4 text-white font-black text-sm tracking-[0.2em] uppercase transition-all duration-300 hover:brightness-110 hover:-translate-y-1"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    background: '#ea580c',
                    clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
                    boxShadow: '0 8px 30px -6px rgba(234,88,12,0.7)',
                    letterSpacing: '0.2em',
                  }}
                >
                  {heroButtonText}
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Secondary — ghost button */}
                <button
                  onClick={() => document.getElementById('experience')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center gap-2 px-8 py-4 text-white font-black text-sm tracking-[0.2em] uppercase transition-all duration-300 hover:bg-white/10"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    border: '1px solid rgba(255,255,255,0.3)',
                    clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
                    letterSpacing: '0.2em',
                  }}
                >
                  Our Story
                </button>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Side Navigation — OXBOLD vertical ── */}
      <div className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
        <button
          onClick={prevSlide}
          className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white transition-all hover:bg-white/10"
          style={{
            border: '1px solid rgba(255,255,255,0.2)',
            clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
          }}
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {/* Slide counter */}
        <div
          className="text-center py-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          <span className="text-[#ea580c] font-black text-sm">
            {String(currentSlide + 1).padStart(2, '0')}
          </span>
          <div className="w-px h-6 bg-white/20 mx-auto my-1" />
          <span className="text-white/40 text-sm font-bold">
            {String(slides.length).padStart(2, '0')}
          </span>
        </div>
        <button
          onClick={nextSlide}
          className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white transition-all hover:bg-white/10"
          style={{
            border: '1px solid rgba(255,255,255,0.2)',
            clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
          }}
          aria-label="Next slide"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Bottom dot indicators ── */}
      <div className="absolute bottom-8 left-6 md:left-12 z-20 flex gap-2 items-center">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setDirection(index > currentSlide ? 1 : -1);
              setCurrentSlide(index);
            }}
            className="transition-all duration-300"
            style={{
              width: index === currentSlide ? '28px' : '8px',
              height: '3px',
              background: index === currentSlide ? '#ea580c' : 'rgba(255,255,255,0.3)',
              clipPath: 'none',
            }}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* ── Bottom left decorative line ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] z-10"
        style={{ background: 'linear-gradient(90deg, #ea580c 0%, rgba(250,204,21,0.5) 30%, transparent 100%)' }}
      />
    </section>
  );
};
