import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { motion, useAnimation, useInView, AnimatePresence } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
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

const DEFAULT_EXPERIENCES: ExperienceItem[] = [
  {
    title: "Be One Day Pilot",
    description:
      "Experience the thrill of flying an aircraft — no license required! Our Be One Day Pilot program offers you the unique opportunity to sit in the pilot's seat and take control under the guidance of a certified flight instructor.",
    image_url: experiencePilot,
  },
  {
    title: "Special Arrangement For You",
    description:
      "Experience the thrill of flying an aircraft — no license required! Our Be One Day Pilot program offers you the unique opportunity to sit in the pilot's seat and take control under the guidance of a certified flight instructor.",
    image_url: experienceSpecial,
  },
];

export const ExperienceSection = () => {
  const [experiences, setExperiences] = useState<ExperienceItem[]>(DEFAULT_EXPERIENCES);
  const [loading, setLoading] = useState(true);
  const [selectedExp, setSelectedExp] = useState<ExperienceItem | null>(null);
  const [bgGradient, setBgGradient] = useState<string>("");
  const [headerSettings, setHeaderSettings] = useState<{
    title: string;
    subtitle: string;
    titleStyle: any;
    subtitleStyle: any;
  }>({
    title: 'Be One Day Pilot',
    subtitle: 'Unique and Amazing Experience',
    titleStyle: {},
    subtitleStyle: {}
  });
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  const [hasCombined, setHasCombined] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const isInView = useInView(scrollRef, { once: true, amount: 0.2 });

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.paused === 'boolean') {
        setIsGlobalPaused(detail.paused);
      }
    };
    window.addEventListener('toggle-animation-freeze', handleToggle);
    return () => window.removeEventListener('toggle-animation-freeze', handleToggle);
  }, []);

  useEffect(() => {
    if (isInView && !loading && experiences.length > 0 && !isGlobalPaused && hasCombined) {
      const startAutoScroll = async () => {
        if (!scrollRef.current) return;
        
        setTimeout(async () => {
          if (!scrollRef.current) return;
          const scrollWidth = scrollRef.current.scrollWidth;
          const scrollDistance = scrollWidth / 2;
          
          await controls.start({
            x: [0, -scrollDistance],
            transition: {
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: 25,
                ease: "linear",
              },
            },
          });
        }, 100);
      };
      startAutoScroll();
    } else {
      controls.stop();
    }
  }, [isInView, loading, experiences.length, controls, isGlobalPaused, hasCombined]);

  useEffect(() => {
    const fetchExperiences = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        // Fetch background gradient
        const { data: settingsData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'bg_gradient_experience')
          .maybeSingle();
        
        if (settingsData) {
          setBgGradient(settingsData.value);
        }

        // Fetch header settings and styles
        const { data: headerData } = await supabase
          .from('site_settings')
          .select('key, value, style')
          .in('key', ['experiences_title', 'experiences_subtitle']);

        if (headerData && headerData.length > 0) {
          const updates: any = {};
          headerData.forEach(item => {
            if (item.key === 'experiences_title') {
              updates.title = item.value;
              updates.titleStyle = item.style || {};
            } else if (item.key === 'experiences_subtitle') {
              updates.subtitle = item.value;
              updates.subtitleStyle = item.style || {};
            }
          });
          setHeaderSettings(prev => ({ ...prev, ...updates }));
        }

        const { data } = await supabase
          .from("experiences")
          .select("*")
          .order("order", { ascending: true });
        
        if (data && data.length > 0) {
          setExperiences(data as ExperienceItem[]);
        }
      } catch (err) {
        console.error("Error fetching experiences:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchExperiences();
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
      id="about"
      className={cn("relative overflow-hidden py-16 md:py-24", !bgGradient && "bg-[#06091a]")}
      style={bgGradient ? { background: bgGradient } : {}}
    >
      {/* Page Split Panels Entrance */}
      {!hasCombined && (
        <div className="absolute inset-0 z-[100] flex pointer-events-none">
          <motion.div 
            initial={{ x: 0 }}
            animate={isInView ? { x: "-100%" } : { x: 0 }}
            transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
            className="w-1/2 h-full bg-slate-950 border-r border-slate-900 flex items-center justify-end"
          >
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mr-4 text-white/10 font-black text-8xl md:text-9xl uppercase select-none"
            >
              FLY
            </motion.div>
          </motion.div>
          <motion.div 
            initial={{ x: 0 }}
            animate={isInView ? { x: "100%" } : { x: 0 }}
            transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
            onAnimationComplete={() => {
              // Wait for cards to finish their combine animation before starting auto-scroll
              setTimeout(() => setHasCombined(true), 2000);
            }}
            className="w-1/2 h-full bg-slate-950 border-l border-slate-900 flex items-center justify-start"
          >
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="ml-4 text-white/10 font-black text-8xl md:text-9xl uppercase select-none"
            >
              HIGH
            </motion.div>
          </motion.div>
        </div>
      )}
      
      <BackgroundParticles variant="dark" isPaused={isGlobalPaused} />
      
      {/* Non-colorful Background Airplane Decoration - Left */}
      <div className="absolute top-1/2 left-[0%] md:left-[-5%] -translate-y-1/2 w-[350px] md:w-[600px] opacity-[0.12] pointer-events-none z-0 transform -rotate-12">
        <img src="/airplane_transparent.svg" alt="" className="w-full h-auto filter brightness-0" />
      </div>

      <div className="absolute top-0 right-0 h-px w-1/3 bg-gradient-to-l from-[#ea580c] to-transparent" />
      <div className="absolute bottom-0 left-0 h-px w-1/2 bg-gradient-to-r from-[#ea580c] via-[#facc15]/50 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-8 md:mb-12">
          <motion.p 
            initial={{ opacity: 0, y: -20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mb-4 text-[10px] font-black uppercase tracking-[0.35em] text-[#ea580c] md:text-xs"
            style={{
              ...headerSettings.subtitleStyle,
              fontFamily: "'Barlow Condensed', sans-serif",
            }}
          >
            {headerSettings.subtitle}
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="section-title text-4xl uppercase leading-none text-white md:text-6xl"
            style={{
              ...headerSettings.titleStyle,
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: "0.05em",
              color: headerSettings.titleStyle?.color || "#f8fafc",
              textShadow: "0 8px 24px rgba(0,0,0,0.45)",
            }}
          >
            {headerSettings.title}
          </motion.h2>
        </div>

        <div className="relative group max-w-6xl mx-auto">
          <div 
            className="overflow-x-auto pb-8 no-scrollbar touch-pan-x touch-pan-y"
            ref={scrollRef}
          >
            <motion.div 
              animate={controls}
              onHoverStart={() => controls.stop()}
              onHoverEnd={() => {
                const scrollWidth = scrollRef.current?.scrollWidth || 0;
                const scrollDistance = scrollWidth / 2;
                if (scrollDistance > 0 && hasCombined) {
                  controls.start({
                    x: [null, -scrollDistance],
                    transition: {
                      x: {
                        repeat: Infinity,
                        repeatType: "loop",
                        duration: 25,
                        ease: "linear",
                      },
                    },
                  });
                }
              }}
              className="flex gap-8 min-w-max px-4"
            >
              {[...experiences, ...experiences].map((exp, index) => {
                const isLongText = exp.description.length > 150;
                const realIndex = index % experiences.length;
                return (
                  <motion.div
                    key={`${exp.id || index}-${index}`}
                    initial={{ 
                      opacity: 0, 
                      x: index % 2 === 0 ? -400 : 400,
                      rotateY: index % 2 === 0 ? -45 : 45
                    }}
                    animate={isInView ? { 
                      opacity: 1, 
                      x: 0,
                      rotateY: 0
                    } : {}}
                    transition={{
                      duration: 1,
                      delay: 0.6 + (realIndex * 0.15),
                      ease: [0.215, 0.61, 0.355, 1]
                    }}
                    className="group w-[300px] shrink-0 overflow-hidden border border-white/10 bg-[#0b1327] shadow-[0_24px_70px_-28px_rgba(0,0,0,0.85)] transition-all duration-500 hover:-translate-y-2 hover:border-[#ea580c]/50 hover:shadow-[0_28px_80px_-24px_rgba(234,88,12,0.45)] md:w-[400px]"
                    style={{ clipPath: "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))" }}
                  >
                    <div className="relative h-48 md:h-64 overflow-hidden">
                      <img
                        src={exp.image_url}
                        alt={exp.title}
                        className="w-full h-full object-cover saturate-110 transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#06091a] via-[#06091a]/35 to-transparent" />
                    </div>
                    <div className="p-6">
                      <div className="mb-3 flex items-center gap-3">
                        <span
                          className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ea580c]"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                        >
                          Flight Story
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-[#ea580c]/60 to-transparent" />
                      </div>
                      <h3
                        className="mb-3 truncate text-2xl uppercase leading-none text-white md:text-3xl"
                        style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}
                      >
                        {exp.title}
                      </h3>
                      <p className="mb-5 text-sm leading-relaxed text-white/70 line-clamp-3 md:text-[15px]">
                        {exp.description}
                      </p>
                      
                      {(isLongText || (exp.images && exp.images.length > 0)) && (
                        <button
                          onClick={() => {
                            setSelectedExp(exp);
                            setCurrentImgIndex(0);
                            trackEvent({
                              action_type: 'click',
                              entity_type: 'experience',
                              entity_id: exp.id || `experience-${index}`,
                              entity_name: exp.title,
                              details: { description_preview: exp.description.substring(0, 50) }
                            });
                          }}
                          className="group/btn inline-flex items-center gap-2 border border-[#ea580c]/30 bg-[#ea580c]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#ea580c] transition-all duration-300 hover:bg-[#ea580c] hover:text-white"
                          style={{ clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))" }}
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

      <Dialog open={!!selectedExp} onOpenChange={(open) => !open && setSelectedExp(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto border-none bg-transparent p-0 shadow-none">
          <div className="relative m-4 overflow-hidden border border-white/10 bg-[#08101f] shadow-[0_28px_90px_-30px_rgba(0,0,0,0.95)]">
            <button
              onClick={() => setSelectedExp(null)}
              className="absolute right-4 top-4 z-50 rounded-full border border-white/15 bg-white/10 p-2 text-white backdrop-blur-md transition-colors hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="group relative h-[300px] bg-slate-100 md:h-[450px]">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImgIndex}
                  src={allGalleryImages[currentImgIndex]}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>

              {allGalleryImages.length > 1 && (
                <>
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={prevImage}
                      className="rounded-full border border-white/20 bg-black/40 p-2 text-white shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-black/55"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={nextImage}
                      className="rounded-full border border-white/20 bg-black/40 p-2 text-white shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-black/55"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                  
                  {/* Indicators */}
                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-3 py-1.5 backdrop-blur-sm">
                    {allGalleryImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setCurrentImgIndex(i); }}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full transition-all",
                          i === currentImgIndex ? "bg-white w-4" : "bg-white/50"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-8 md:p-10 space-y-6">
              <DialogHeader>
                <DialogTitle
                  className="text-3xl uppercase text-white md:text-4xl"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}
                >
                  {selectedExp?.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Detailed view of {selectedExp?.title}
                </DialogDescription>
              </DialogHeader>

              <div className="max-w-none">
                <p className="whitespace-pre-line text-base leading-relaxed text-white/75 md:text-lg">
                  {selectedExp?.description}
                </p>
              </div>

              {allGalleryImages.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {allGalleryImages.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentImgIndex(i)}
                      className={cn(
                        "h-20 w-20 shrink-0 overflow-hidden border transition-all",
                        i === currentImgIndex
                          ? "scale-105 border-[#ea580c] shadow-[0_0_0_1px_rgba(234,88,12,0.45)]"
                          : "border-white/10 opacity-60 hover:opacity-100"
                      )}
                      style={{ clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}
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
