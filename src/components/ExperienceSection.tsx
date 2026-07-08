import { useState, useEffect, useRef } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackgroundParticles } from "./ui/BackgroundParticles";

import experiencePilot from "@/assets/experience-pilot.jpg";
import experienceSpecial from "@/assets/experience-special.jpg";

interface ExperienceItem {
  id?: string;
  title: string;
  description: string;
  image_url: string;
  images?: string[];
}

interface Feature {
  id?: string;
  icon_name: string;
  title: string;
  description: string;
  image_url?: string;
  text_color?: string;
  text_size?: string;
  icon_color?: string;
  icon_size?: string;
}

type LucideIconType = keyof typeof LucideIcons;

const DEFAULT_EXPERIENCES: ExperienceItem[] = [
  {
    title: "Be One Day Pilot",
    description:
      "Experience the thrill of flying an aircraft under the guidance of a certified instructor and enjoy a truly unforgettable aviation moment.",
    image_url: experiencePilot,
  },
  {
    title: "Special Arrangement For You",
    description:
      "From private celebrations to curated surprise flights, we tailor the journey so it feels personal, cinematic, and one of a kind.",
    image_url: experienceSpecial,
  },
];

const DEFAULT_FEATURES: Feature[] = [
  {
    icon_name: "Shield",
    title: "Expert Support Team",
    description: "Licensed instructors and a helpful ground team guide you from briefing to landing.",
  },
  {
    icon_name: "Award",
    title: "Trusted Since 2014",
    description: "Years of safe and memorable experiences have made One Day Pilot a trusted name.",
  },
  {
    icon_name: "Star",
    title: "Unmatched Experience",
    description: "Hands-on flying, cinematic views, and memories that last far beyond the runway.",
  },
];

const CIRCLE_TEXT = "ONE DAY PILOT  •  FLIGHT EXPERIENCE  •  SAFE  •  GUIDED  •  CERTIFIED  •  ";

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return hex;
  const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const FeatureCard = ({ 
  feature, 
  index, 
  isActive, 
  isGlobalPaused, 
  onMouseEnter 
}: { 
  feature: Feature, 
  index: number, 
  isActive: boolean, 
  isGlobalPaused: boolean,
  onMouseEnter: () => void
}) => {
  const [imgError, setImgError] = useState(false);
  const iconKey = (feature.icon_name in LucideIcons ? feature.icon_name : "HelpCircle") as LucideIconType;
  const Icon = (LucideIcons as unknown as Record<LucideIconType, LucideIcon>)[iconKey] || LucideIcons.HelpCircle;

  return (
    <motion.div
      initial={{ opacity: 0, x: index < 2 ? -30 : 30, y: 20 }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      animate={isActive ? { y: -8, scale: 1.02 } : { y: 0, scale: 1 }}
      transition={{ duration: 0.45 }}
      onMouseEnter={onMouseEnter}
      onClick={() => {}}
      className="relative overflow-hidden rounded-[28px] border border-gray-200 bg-white/95 p-5 shadow-[0_25px_80px_-30px_rgba(0,0,0,0.35)] backdrop-blur-md md:p-6"
      style={{ 
        marginLeft: index < 2 ? (index % 2 === 0 ? "0" : "2rem") : "0",
        marginRight: index >= 2 ? ((index - 2) % 2 === 0 ? "0" : "2rem") : "0"
      }}
    >
      <motion.div
        animate={!isGlobalPaused ? { left: ["-120%", "180%"] } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 2 + index }}
        className="absolute top-0 h-full w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg]"
      />
      <div className="relative z-10 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#CC1F1F]/20 bg-[#CC1F1F]/10 text-[#CC1F1F]">
          {feature.image_url && !imgError ? (
            <img
              src={feature.image_url}
              alt={feature.title}
              className={`${feature.icon_size || "w-7 h-7"} object-contain`}
              width={28}
              height={28}
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
            />
          ) : (
            <Icon className={`${feature.icon_size || "w-7 h-7"}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#CC1F1F]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-[#CC1F1F]/60 to-transparent" />
          </div>
          <h3 className={`mb-2 text-2xl uppercase leading-tight ${feature.text_size || ""}`} style={{ color: feature.text_color || "#111111", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>
            {feature.title}
          </h3>
          <p className="text-sm leading-relaxed text-gray-600 md:text-[15px]">{feature.description}</p>
        </div>
      </div>
    </motion.div>
  );
};

export const ExperienceSection = () => {
  const [experiences, setExperiences] = useState<ExperienceItem[]>(DEFAULT_EXPERIENCES);
  const [features, setFeatures] = useState<Feature[]>(DEFAULT_FEATURES);
  const [selectedExp, setSelectedExp] = useState<ExperienceItem | null>(null);
  const [bgGradient, setBgGradient] = useState<string>("");
  const [headerSettings, setHeaderSettings] = useState<{
    title: string;
    subtitle: string;
    titleStyle: any;
    subtitleStyle: any;
  }>({
    title: "Be One Day Pilot",
    subtitle: "Unique and Amazing Experience",
    titleStyle: {},
    subtitleStyle: {},
  });
  const [featureHeader, setFeatureHeader] = useState<{
    title: string;
    subtitle: string;
    styles: Record<string, any>;
  }>({
    title: "Learn More About Our One Day Pilot Experience Program",
    subtitle: "Precision-crafted experiences with cinematic views, guided confidence, and unforgettable flying moments.",
    styles: {},
  });
  const [sectionImages, setSectionImages] = useState({
    image1: experiencePilot,
    image2: experienceSpecial,
  });
  const [circleSettings, setCircleSettings] = useState({
    text: CIRCLE_TEXT,
    textColor: "#1E3A8A",
    textSize: 14,
    letterSpacing: 8,
    bgColor1: "#CC1F1F",
    bgColor2: "#FFFFFF",
    bgDirection: "diagonal",
    bgOpacity: 0.08,
  });
  const [experienceYears, setExperienceYears] = useState("10+");
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!scrollRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;

    setIsDragging(true);
    setIsPaused(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
    document.body.style.userSelect = 'none';
    const images = scrollRef.current.querySelectorAll('img');
    images.forEach(img => img.setAttribute('draggable', 'false'));
  };

  const handleDragEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      document.body.style.userSelect = '';
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = setTimeout(() => {
        if (!scrollRef.current?.matches(':hover')) {
          setIsPaused(false);
        }
      }, 1800);
    }
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  const handleManualScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    setIsPaused(true);

    const container = scrollRef.current;
    const itemWidth = window.innerWidth < 768 ? 300 : 380;
    const gap = 20;
    const scrollAmount = direction === "left" ? -(itemWidth + gap) : itemWidth + gap;

    container.scrollBy({
      left: scrollAmount,
      behavior: "smooth",
    });

    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
    }

    resumeTimeoutRef.current = setTimeout(() => {
      if (!container.matches(":hover")) {
        setIsPaused(false);
      }
    }, 1800);
  };

  useEffect(() => {
    const updateMobileView = () => setIsMobileView(window.innerWidth < 768);
    updateMobileView();
    window.addEventListener("resize", updateMobileView);
    return () => window.removeEventListener("resize", updateMobileView);
  }, []);

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.paused === "boolean") {
        setIsGlobalPaused(detail.paused);
      }
    };
    window.addEventListener("toggle-animation-freeze", handleToggle);
    return () => window.removeEventListener("toggle-animation-freeze", handleToggle);
  }, []);

  useEffect(() => {
    if (isGlobalPaused || features.length === 0) return;
    const interval = setInterval(() => {
      setActiveFeatureIndex((prev) => (prev + 1) % features.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isGlobalPaused, features.length]);

  useEffect(() => {
    if (experiences.length === 0 || isGlobalPaused || selectedExp || isPaused || isMobileView) {
      controls.stop();
      return;
    }

    const startMarquee = async () => {
      if (!scrollRef.current) return;
      const scrollWidth = scrollRef.current.scrollWidth;
      const singleSetWidth = scrollWidth / 2;
      if (scrollRef.current.scrollLeft !== 0) {
        scrollRef.current.scrollTo({ left: 0 });
      }

      await controls.start({
        x: [0, -singleSetWidth],
        transition: {
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: experiences.length * 13,
            ease: "linear",
          },
        },
      });
    };

    startMarquee();
  }, [experiences.length, isPaused, selectedExp, isGlobalPaused, isMobileView, controls]);

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) return;

      try {
        const [{ data: settingsData }, { data: experienceData }, { data: featureData }] = await Promise.all([
          supabase
            .from("site_settings")
            .select("key, value, style")
            .in("key", [
              "bg_gradient_experience",
              "bg_gradient_features",
              "experiences_title",
              "experiences_subtitle",
              "features_title",
              "features_subtitle",
              "experience_start_year",
              "features_image_1",
              "features_image_2",
              "experience_circle_text",
              "experience_circle_text_color",
              "experience_circle_text_size",
              "experience_circle_letter_spacing",
              "experience_circle_bg_color1",
              "experience_circle_bg_color2",
              "experience_circle_bg_direction",
              "experience_circle_bg_opacity",
            ]),
          supabase.from("experiences").select("*").order("order", { ascending: true }),
          supabase.from("features").select("*").order("order", { ascending: true }),
        ]);

        if (settingsData) {
          const updates: Partial<typeof headerSettings> = {};
          const featureUpdates: Partial<typeof featureHeader> = { styles: {} };
          const image1 = settingsData.find((s) => s.key === "features_image_1")?.value;
          const image2 = settingsData.find((s) => s.key === "features_image_2")?.value;
          const bg =
            settingsData.find((s) => s.key === "bg_gradient_experience")?.value ||
            settingsData.find((s) => s.key === "bg_gradient_features")?.value;
          const startYear = settingsData.find((s) => s.key === "experience_start_year")?.value;
          const circleUpdates: Partial<typeof circleSettings> = {};

          settingsData.forEach((item) => {
            if (item.key === "experiences_title") {
              updates.title = item.value;
              updates.titleStyle = item.style || {};
            }
            if (item.key === "experiences_subtitle") {
              updates.subtitle = item.value;
              updates.subtitleStyle = item.style || {};
            }
            if (item.key === "features_title") {
              featureUpdates.title = item.value;
              featureUpdates.styles = {
                ...(featureUpdates.styles || {}),
                features_title: item.style || {},
              };
            }
            if (item.key === "features_subtitle") {
              featureUpdates.subtitle = item.value;
              featureUpdates.styles = {
                ...(featureUpdates.styles || {}),
                features_subtitle: item.style || {},
              };
            }
            if (item.key === "experience_circle_text") {
              circleUpdates.text = item.value;
            }
            if (item.key === "experience_circle_text_color") {
              circleUpdates.textColor = item.value;
            }
            if (item.key === "experience_circle_text_size") {
              const size = parseFloat(item.value);
              if (!Number.isNaN(size)) circleUpdates.textSize = size;
            }
            if (item.key === "experience_circle_letter_spacing") {
              const spacing = parseFloat(item.value);
              if (!Number.isNaN(spacing)) circleUpdates.letterSpacing = spacing;
            }
            if (item.key === "experience_circle_bg_color1") {
              circleUpdates.bgColor1 = item.value;
            }
            if (item.key === "experience_circle_bg_color2") {
              circleUpdates.bgColor2 = item.value;
            }
            if (item.key === "experience_circle_bg_direction") {
              circleUpdates.bgDirection = item.value;
            }
            if (item.key === "experience_circle_bg_opacity") {
              const opacity = parseFloat(item.value);
              if (!Number.isNaN(opacity)) circleUpdates.bgOpacity = opacity;
            }
          });

          if (bg) setBgGradient(bg);
          if (Object.keys(updates).length > 0) {
            setHeaderSettings((prev) => ({ ...prev, ...updates }));
          }
          if (Object.keys(featureUpdates).length > 0) {
            setFeatureHeader((prev) => ({
              title: featureUpdates.title || prev.title,
              subtitle: featureUpdates.subtitle || prev.subtitle,
              styles: featureUpdates.styles || prev.styles,
            }));
          }
          if (image1 || image2) {
            setSectionImages({
              image1: image1 || experiencePilot,
              image2: image2 || experienceSpecial,
            });
          }
          if (startYear) {
            const years = new Date().getFullYear() - parseInt(startYear, 10);
            if (!Number.isNaN(years)) {
              setExperienceYears(`${years}+`);
            }
          }
          if (Object.keys(circleUpdates).length > 0) {
            setCircleSettings((prev) => ({ ...prev, ...circleUpdates }));
          }
        }

        if (experienceData && experienceData.length > 0) {
          setExperiences(experienceData as ExperienceItem[]);
        }
        if (featureData && featureData.length > 0) {
          setFeatures(featureData as Feature[]);
        }
      } catch (err) {
        console.error("Error fetching experience section data:", err);
      }
    };

    fetchData();
  }, []);

  const allGalleryImages = selectedExp ? [selectedExp.image_url, ...(selectedExp.images || [])] : [];

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImgIndex((prev) => (prev + 1) % allGalleryImages.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImgIndex((prev) => (prev - 1 + allGalleryImages.length) % allGalleryImages.length);
  };

  return (
    <section
      id="experience"
      className={cn("relative overflow-hidden pt-4 pb-2 md:pt-6 md:pb-4", !bgGradient && "bg-white")}
      style={bgGradient ? { background: bgGradient } : {}}
    >
      <div className="absolute inset-0 z-0 opacity-20 mix-blend-multiply pointer-events-none overflow-hidden">
        <picture>
          <source srcSet="/bg-experience.webp" type="image/webp" />
          <img
            src="/bg-experience.png"
            alt=""
            loading="lazy"
            decoding="async"
            width={1920}
            height={1080}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </picture>
      </div>
      <div
        className="absolute inset-y-0 left-0 w-full lg:w-1/2 opacity-10 pointer-events-none z-0 overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, black 20%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, black 20%, transparent 100%)",
        }}
      >
        <img
          src="/windows_view.png"
          alt=""
          loading="lazy"
          decoding="async"
          width={1200}
          height={800}
          className="absolute inset-0 w-full h-full object-cover object-left"
        />
      </div>
      <BackgroundParticles variant="light" isPaused={isGlobalPaused} />

      <div className="w-full relative z-10 px-2 lg:px-4">
        <div className="max-w-[1900px] mx-auto">
          <div className="mx-auto mb-10 max-w-4xl text-center md:mb-14">
            <p
              className="mb-4 text-[10px] font-black uppercase tracking-[0.35em] text-[#CC1F1F] md:text-lg font-condensed"
              style={{
                ...headerSettings.subtitleStyle,
                fontSize: headerSettings.subtitleStyle?.fontSize || 'clamp(0.9rem, 1.5vw, 1.125rem)',
              }}
            >
              {headerSettings.subtitle}
            </p>
            <h2
              className="text-4xl uppercase leading-none text-gray-900 md:text-7xl font-title tracking-[0.05em]"
              style={{
                ...headerSettings.titleStyle,
                color: headerSettings.titleStyle?.color || "#111111",
                fontSize: headerSettings.titleStyle?.fontSize || 'clamp(2.5rem, 8vw, 5rem)',
              }}
            >
              {headerSettings.title}
            </h2>
          </div>

          {/* Story Carousel at Top */}
          <div className="mx-auto mt-6 mb-20 max-w-full lg:max-w-[1900px]">
          <div className="mb-4 text-center">
            <div className="mb-4 flex items-center justify-center gap-4">
              <div className="h-[2px] w-12 bg-[#CC1F1F]" />
              <span className="text-xs font-black uppercase tracking-[0.4em] text-[#CC1F1F] font-condensed">
                Memory Will Remain Here
              </span>
              <div className="h-[2px] w-12 bg-[#CC1F1F]" />
            </div>
          </div>

          <div className="relative group/scroll-container">
            <button
              onClick={() => handleManualScroll("left")}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center rounded-full border-2 border-[#CC1F1F] bg-white p-2 text-gray-900 shadow-lg transition-all duration-300 opacity-0 group-hover/scroll-container:opacity-100"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            <button
              onClick={() => handleManualScroll("right")}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center rounded-full border-2 border-[#CC1F1F] bg-white p-2 text-gray-900 shadow-lg transition-all duration-300 opacity-0 group-hover/scroll-container:opacity-100"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            <div
              className="overflow-x-auto pb-8 no-scrollbar touch-auto cursor-grab active:cursor-grabbing select-none"
              ref={scrollRef}
              onMouseDown={handleDragStart}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              //onMouseLeave={handleDragEnd}
              onMouseEnter={() => {
                setIsPaused(true);
                if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
              }}
              onMouseLeave={() => {
                if (!isDragging) {
                  if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
                  resumeTimeoutRef.current = setTimeout(() => setIsPaused(false), 1800);
                }
              }}
              onTouchStart={() => {
                setIsPaused(true);
                if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
              }}
              onTouchEnd={() => {
                if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
                resumeTimeoutRef.current = setTimeout(() => setIsPaused(false), 1800);
              }}
            >
              <motion.div className="flex min-w-max gap-5 px-4" animate={isMobileView ? undefined : controls}>
                {[...experiences, ...experiences].map((exp, index) => {
                  const isLongText = exp.description.length > 150;
                  return (
                    <motion.div
                      key={`${exp.id || index}-${index}`}
                      initial={isMobileView ? false : { opacity: 0, scale: 0.94, y: 20 }}
                      whileInView={isMobileView ? undefined : { opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={isMobileView ? undefined : { duration: 0.5, delay: (index % experiences.length) * 0.1 }}
                      className="group relative w-[300px] shrink-0 overflow-hidden rounded-[30px] border border-gray-200 bg-white border-t-2 border-t-[#CC1F1F] shadow-[0_35px_80px_-20px_rgba(0,0,0,0.55)] transition-all duration-500 hover:-translate-y-2 hover:border-[#CC1F1F]/40 hover:shadow-[0_45px_110px_-30px_rgba(204,31,31,0.35)] md:w-[380px]"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath fill='%23ffffff' fill-opacity='0.03' d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.89v12.72l11 6.35 11-6.35V17.89l-11-6.35-11 6.35z'/%3E%3C/svg%3E")`,
                        backgroundSize: "28px 49px",
                        marginTop: index % 2 === 0 ? "1.5rem" : "0",
                        marginBottom: index % 2 !== 0 ? "1.5rem" : "0",
                      }}
                    >
                      <motion.div
                        animate={!isGlobalPaused && !isMobileView ? { left: ["-150%", "200%"] } : {}}
                        transition={isMobileView ? undefined : { duration: 5, repeat: Infinity, ease: "linear", repeatDelay: 2 + index * 0.5 }}
                        className="absolute top-0 h-full w-32 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent skew-x-[-25deg] pointer-events-none z-10"
                      />
                      <div className="relative h-60 overflow-hidden md:h-80">
                        <img
                          loading="lazy"
                          decoding="async"
                          width={380}
                          height={320}
                          src={exp.image_url}
                          alt={exp.title}
                          className="h-full w-full object-cover saturate-110 transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                      </div>
                      <div className="p-6">
                        <div className="mb-3 flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.35em] text-[#CC1F1F] font-condensed">
                            Flight Story
                          </span>
                          <div className="h-px flex-1 bg-gradient-to-r from-[#CC1F1F]/60 to-transparent" />
                        </div>
                        <h4 className="mb-3 truncate text-2xl uppercase leading-none text-gray-900 md:text-3xl font-title tracking-[0.04em]">
                          {exp.title}
                        </h4>
                        <p className="mb-5 line-clamp-3 text-sm leading-relaxed text-gray-600 md:text-[15px] font-sans">
                          {exp.description}
                        </p>

                        {(isLongText || (exp.images && exp.images.length > 0)) && (
                          <button
                            onClick={() => {
                              setSelectedExp(exp);
                              setCurrentImgIndex(0);
                            }}
                            className="group/btn inline-flex items-center gap-2 rounded-full border border-[#CC1F1F]/30 bg-[#CC1F1F]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#CC1F1F] transition-all duration-300 hover:bg-[#CC1F1F] hover:text-gray-900"
                          >
                            View Story
                            <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Feature Layout at Bottom */}
        <div className="mx-auto mb-8 text-center max-w-3xl">
          <p
            className="mx-auto text-sm font-semibold uppercase tracking-[0.18em] text-gray-600 md:text-lg font-condensed"
            style={{
              color: featureHeader.styles.features_subtitle?.color || "#5f5f5f",
              fontSize: featureHeader.styles.features_subtitle?.fontSize || 'clamp(0.9rem, 1.5vw, 1.125rem)',
              fontWeight: featureHeader.styles.features_subtitle?.fontWeight,
              fontStyle: featureHeader.styles.features_subtitle?.fontStyle,
            }}
          >
            {featureHeader.subtitle}
          </p>
        </div>

        <div className="mx-auto grid max-w-[1900px] items-center gap-8 lg:grid-cols-[0.95fr_1.1fr_0.95fr] xl:gap-10 pb-2">
          <div className="relative z-20 space-y-4">
            {features.slice(0, 2).map((feature, index) => (
              <FeatureCard
                key={feature.id || index}
                feature={feature}
                index={index}
                isActive={activeFeatureIndex === index && !isGlobalPaused}
                isGlobalPaused={isGlobalPaused}
                onMouseEnter={() => setActiveFeatureIndex(index)}
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative mx-auto flex w-full max-w-[700px] items-center justify-center py-10"
          >
            <motion.div
              animate={!isGlobalPaused ? { rotate: 360 } : {}}
              transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              className="absolute z-0 flex h-[340px] w-[340px] items-center justify-center rounded-full border border-[#CC1F1F]/15 md:h-[680px] md:w-[680px]"
              style={{
                background: (() => {
                  const dirMap: Record<string, string> = {
                    vertical: "180deg",
                    horizontal: "90deg",
                    diagonal: "135deg",
                    diagonal_reverse: "45deg",
                  };
                  const angle = dirMap[circleSettings.bgDirection] || circleSettings.bgDirection || "135deg";
                  const c1 = hexToRgba(circleSettings.bgColor1, circleSettings.bgOpacity);
                  const c2 = hexToRgba(circleSettings.bgColor2, circleSettings.bgOpacity);
                  return `linear-gradient(${angle}, ${c1} 0%, ${c2} 100%)`;
                })(),
              }}
            >
              <div className="absolute inset-8 rounded-full border border-[#CC1F1F]/10 md:inset-12" />
              <svg viewBox="0 0 300 300" className="h-full w-full">
                <defs>
                  <path id="experience-circle-path" d="M 150, 150 m -125, 0 a 125,125 0 1,1 250,0 a 125,125 0 1,1 -250,0" />
                </defs>
                <text
                  fill={circleSettings.textColor || "#1E3A8A"}
                  fontSize={circleSettings.textSize || 14}
                  fontWeight="700"
                  letterSpacing={circleSettings.letterSpacing || 8}
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  <textPath href="#experience-circle-path">{(circleSettings.text || CIRCLE_TEXT).repeat(2)}</textPath>
                </text>
              </svg>
            </motion.div>

            <motion.div
              animate={!isGlobalPaused ? { y: [0, -12, 0] } : {}}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10"
            >
              <div className="absolute left-[-3rem] top-[10%] z-30 hidden w-56 rounded-[32px] border border-gray-200 bg-white p-3.5 shadow-[0_25px_70px_-20px_rgba(0,0,0,0.4)] md:block">
                <img src={sectionImages.image1} alt="Pilot Experience" className="h-52 w-full rounded-[24px] object-cover" />
              </div>

              <div className="relative overflow-visible">
                <img src={sectionImages.image2} alt="Special Experience" className="relative z-20 mx-auto h-[380px] w-auto object-contain md:h-[620px]" />
              </div>

              <div className="absolute bottom-[5%] right-[-2rem] z-30 rounded-[35px] border border-[#CC1F1F]/20 bg-white px-8 py-6 text-center shadow-[0_30px_100px_-20px_rgba(204,31,31,0.4)] md:right-[-3rem]">
                <div className="text-6xl leading-none text-[#CC1F1F] md:text-7xl" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.06em" }}>
                  {experienceYears}
                </div>
                <div className="mt-2.5 text-[12px] font-black uppercase tracking-[0.4em] text-gray-700" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  Years In The Sky
                </div>
              </div>
            </motion.div>
          </motion.div>

          <div className="relative z-20 space-y-5">
            {[features[2], ...features.slice(3)].filter(Boolean).map((feature, idx) => {
              const actualIndex = idx + 2;
              return (
                <FeatureCard
                  key={feature!.id || actualIndex}
                  feature={feature!}
                  index={actualIndex}
                  isActive={activeFeatureIndex === actualIndex && !isGlobalPaused}
                  isGlobalPaused={isGlobalPaused}
                  onMouseEnter={() => setActiveFeatureIndex(actualIndex)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>

    <Dialog open={!!selectedExp} onOpenChange={(open) => !open && setSelectedExp(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto border-none bg-transparent p-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedExp?.title || "Experience Details"}</DialogTitle>
          </DialogHeader>
          <div
            className="relative m-4 overflow-hidden rounded-[32px] border border-gray-200 bg-white border-t-2 border-t-[#CC1F1F] shadow-[0_28px_90px_-30px_rgba(0,0,0,0.95)]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath fill='%23ffffff' fill-opacity='0.03' d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.89v12.72l11 6.35 11-6.35V17.89l-11-6.35-11 6.35z'/%3E%3C/svg%3E")`,
              backgroundSize: "28px 49px",
            }}
          >
            <motion.div
              animate={!isGlobalPaused && !isMobileView ? { left: ["-150%", "200%"] } : {}}
              transition={isMobileView ? undefined : { duration: 6, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
              className="absolute top-0 h-full w-48 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent skew-x-[-25deg] pointer-events-none z-10"
            />
            <button
              onClick={() => setSelectedExp(null)}
              className="absolute right-4 top-4 z-50 rounded-full border border-gray-300 bg-white/10 p-2 text-white backdrop-blur-md transition-colors hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="group relative h-[300px] bg-slate-100 md:h-[450px]">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImgIndex}
                  src={allGalleryImages[currentImgIndex]}
                  initial={isMobileView ? false : { opacity: 0 }}
                  animate={isMobileView ? undefined : { opacity: 1 }}
                  exit={isMobileView ? undefined : { opacity: 0 }}
                  transition={isMobileView ? undefined : { duration: 0.3 }}
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>

              {allGalleryImages.length > 1 && (
                <>
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={prevImage} className="rounded-full border border-gray-300 bg-white/90 p-2 text-gray-900 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white">
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={nextImage} className="rounded-full border border-gray-300 bg-white/90 p-2 text-gray-900 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white">
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 backdrop-blur-sm">
                    {allGalleryImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImgIndex(i);
                        }}
                        className={cn("h-1.5 w-1.5 rounded-full transition-all", i === currentImgIndex ? "bg-white w-4" : "bg-white/50")}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-6 p-8 md:p-10">
              <DialogHeader>
                <DialogTitle className="text-3xl uppercase text-gray-900 md:text-4xl" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>
                  {selectedExp?.title}
                </DialogTitle>
                <DialogDescription className="sr-only">Detailed view of {selectedExp?.title}</DialogDescription>
              </DialogHeader>

              <div className="max-w-none">
                <p className="whitespace-pre-line text-base leading-relaxed text-gray-700 md:text-lg">{selectedExp?.description}</p>
              </div>

              {allGalleryImages.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {allGalleryImages.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentImgIndex(i)}
                      className={cn(
                        "h-20 w-20 shrink-0 overflow-hidden rounded-xl border transition-all",
                        i === currentImgIndex ? "scale-105 border-[#CC1F1F] shadow-[0_0_0_1px_rgba(204,31,31,0.45)]" : "border-gray-200 opacity-60 hover:opacity-100"
                      )}
                    >
                      <img src={url} className="w-full h-full object-cover" alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
