import { useState, useEffect, useCallback } from "react";
import { ChevronRight, Plane, MapPin, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { BackgroundParticles } from "./ui/BackgroundParticles";

import hero1 from "@/assets/hero-1.jpg";
import hero2 from "@/assets/hero-2.jpg";
import hero3 from "@/assets/hero-3.jpg";
import experiencePilot from "@/assets/experience-pilot.jpg";
import experienceSpecial from "@/assets/experience-special.jpg";
import airplaneServices from "@/assets/airplane-services.jpg";

interface HeroSlide {
  id?: string;
  image_url: string;
  title: string;
  subtitle: string;
}

interface CornerImage {
  src: string;
  alt: string;
  label: string;
  sublabel: string;
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

const CORNER_IMAGES: CornerImage[] = [
  {
    src: hero1,
    alt: "KL City Flight",
    label: "KL City Flight",
    sublabel: "Subang",
  },
  {
    src: experiencePilot,
    alt: "Pilot Experience",
    label: "Pilot Experience",
    sublabel: "Hands-on",
  },
  {
    src: airplaneServices,
    alt: "Aircraft Services",
    label: "Flight Services",
    sublabel: "Professional",
  },
  {
    src: experienceSpecial,
    alt: "Special Events",
    label: "Special Events",
    sublabel: "Memorable",
  },
];

export const HeroCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<HeroSlide[]>(DEFAULT_SLIDES);
  const [heroButtonText, setHeroButtonText] = useState("BOOK YOUR FLIGHT");
  const [heroGradient, setHeroGradient] = useState<string>("");
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  const [direction, setDirection] = useState(1);
  const [hoveredCorner, setHoveredCorner] = useState<number | null>(null);

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

  // Corner positions for images
  const cornerPositions = [
    "top-0 left-0", // Top-left
    "top-0 right-0", // Top-right
    "bottom-0 left-0", // Bottom-left
    "bottom-0 right-0", // Bottom-right
  ];

  return (
    <section
      id="home"
      className="relative min-h-screen w-full overflow-hidden"
      style={{ background: heroGradient || '#06091a' }}
    >
      <BackgroundParticles />

      {/* ── Background with dark gradient ── */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse at center, rgba(6,9,26,0.85) 0%, rgba(6,9,26,0.98) 100%)
          `,
        }}
      />

      {/* ── Corner Images Grid - OXBOLD Style ── */}
      <div className="absolute inset-0 z-10">
        {CORNER_IMAGES.map((img, index) => (
          <motion.div
            key={index}
            className={`absolute ${cornerPositions[index]} w-[35%] md:w-[28%] lg:w-[24%] aspect-[4/3] cursor-pointer overflow-hidden`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + index * 0.15, duration: 0.6 }}
            onMouseEnter={() => setHoveredCorner(index)}
            onMouseLeave={() => setHoveredCorner(null)}
            onClick={() => {
              trackEvent({
                action_type: 'click',
                entity_type: 'corner_image',
                entity_id: `corner-${index}`,
                entity_name: img.label,
              });
              document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {/* Image Container with Clipped Corners */}
            <div 
              className="relative w-full h-full overflow-hidden"
              style={{
                clipPath: index === 0 
                  ? 'polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)' // Top-left
                  : index === 1
                  ? 'polygon(0 0, 100% 0, 100% 100%, 30% 100%, 0 70%)' // Top-right
                  : index === 2
                  ? 'polygon(0 0, 70% 0, 100% 30%, 100% 100%, 0 100%)' // Bottom-left
                  : 'polygon(30% 0, 100% 0, 100% 100%, 0 100%, 0 30%)', // Bottom-right
              }}
            >
              <motion.img
                src={img.src}
                alt={img.alt}
                className="w-full h-full object-cover"
                animate={{ 
                  scale: hoveredCorner === index ? 1.1 : 1,
                }}
                transition={{ duration: 0.4 }}
                style={{ filter: 'saturate(1.1) contrast(1.05)' }}
              />
              
              {/* Gradient Overlay */}
              <div 
                className="absolute inset-0 transition-opacity duration-300"
                style={{
                  background: hoveredCorner === index
                    ? 'linear-gradient(to top, rgba(234,88,12,0.7) 0%, rgba(6,9,26,0.4) 60%, transparent 100%)'
                    : 'linear-gradient(to top, rgba(6,9,26,0.85) 0%, rgba(6,9,26,0.4) 60%, transparent 100%)',
                }}
              />

              {/* Label */}
              <motion.div 
                className="absolute bottom-3 left-3 right-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.15 }}
              >
                <p 
                  className="text-white text-xs md:text-sm font-bold uppercase tracking-wider"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {img.label}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-[#ea580c]" />
                  <span 
                    className="text-white/60 text-[10px] md:text-xs uppercase tracking-wide"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {img.sublabel}
                  </span>
                </div>
              </motion.div>

              {/* Hover indicator */}
              <motion.div
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-[#ea580c]"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: hoveredCorner === index ? 1 : 0, 
                  scale: hoveredCorner === index ? 1 : 0 
                }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Center Panel - OXBOLD Style ── */}
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <motion.div 
          className="relative w-[85%] md:w-[60%] lg:w-[50%] max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          {/* Center Panel Background */}
          <div 
            className="relative p-6 md:p-10 lg:p-12"
            style={{
              background: 'linear-gradient(180deg, rgba(6,9,26,0.95) 0%, rgba(6,9,26,0.98) 100%)',
              clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
              boxShadow: '0 0 60px rgba(234,88,12,0.15), inset 0 0 60px rgba(234,88,12,0.05)',
            }}
          >
            {/* Border accent */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
                border: '1px solid rgba(234,88,12,0.3)',
              }}
            />

            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-3 mb-4"
            >
              <Plane className="w-5 h-5 text-[#ea580c]" />
              <span
                className="text-[#ea580c] text-[10px] md:text-xs font-black tracking-[0.35em] uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                One Day Pilot Experience
              </span>
            </motion.div>

            {/* Main title with slide animation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                <h1
                  className="text-white mb-3 leading-none"
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 'clamp(2rem, 5vw, 4rem)',
                    letterSpacing: '0.03em',
                    textShadow: '0 4px 30px rgba(0,0,0,0.8)',
                    lineHeight: '1',
                  }}
                >
                  {slides[currentSlide].title}
                </h1>

                <p
                  className="mb-6"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 'clamp(0.8rem, 1.5vw, 1rem)',
                    fontWeight: 500,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  {slides[currentSlide].subtitle}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Stats Row */}
            <div className="flex items-center gap-6 mb-6 pb-6 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#ea580c]" />
                <span 
                  className="text-white/70 text-xs uppercase tracking-wide"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Subang, Malaysia
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-[#ea580c] text-[#ea580c]" />
                ))}
                <span 
                  className="text-white/70 text-xs ml-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  5.0
                </span>
              </div>
            </div>

            {/* Price & CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span 
                  className="text-white/50 text-xs uppercase tracking-wider block"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Starting from
                </span>
                <span 
                  className="text-[#ea580c] text-2xl md:text-3xl font-black"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
                >
                  RM800+
                </span>
              </div>

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
                className="group flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 text-white font-black text-xs md:text-sm tracking-[0.2em] uppercase transition-all duration-300 hover:brightness-110 hover:-translate-y-1"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  background: '#ea580c',
                  clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
                  boxShadow: '0 8px 30px -6px rgba(234,88,12,0.7)',
                }}
              >
                {heroButtonText}
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Slide indicators inside panel */}
            <div className="flex gap-2 mt-6 justify-center">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setDirection(index > currentSlide ? 1 : -1);
                    setCurrentSlide(index);
                  }}
                  className="transition-all duration-300"
                  style={{
                    width: index === currentSlide ? '24px' : '8px',
                    height: '3px',
                    background: index === currentSlide ? '#ea580c' : 'rgba(255,255,255,0.3)',
                  }}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Decorative Elements ── */}
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] z-30"
        style={{ background: 'linear-gradient(90deg, transparent, #ea580c, transparent)' }}
      />
      
      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] z-30"
        style={{ background: 'linear-gradient(90deg, #ea580c 0%, rgba(250,204,21,0.5) 30%, transparent 100%)' }}
      />

      {/* Side decorative lines */}
      <div
        className="absolute top-[20%] left-0 w-[2px] h-[60%] z-30 hidden md:block"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(234,88,12,0.3), transparent)' }}
      />
      <div
        className="absolute top-[20%] right-0 w-[2px] h-[60%] z-30 hidden md:block"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(234,88,12,0.3), transparent)' }}
      />
    </section>
  );
};
