import { useState, useEffect, useMemo, useRef } from "react";
import { Play, ChevronRight, X, Maximize2, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { BackgroundParticles } from "./ui/BackgroundParticles";

const PilotDecoration = ({ isGlobalPaused }: { isGlobalPaused: boolean }) => (
  <div className="absolute top-[60%] md:top-1/2 right-[-2%] md:right-[-8%] -translate-y-1/2 w-[400px] md:w-[600px] opacity-[0.15] pointer-events-none z-0 select-none">
    <svg viewBox="0 0 520 480" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pilotSkinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FDDBB4"/>
          <stop offset="100%" stopColor="#F0C090"/>
        </linearGradient>
        <linearGradient id="pilotUniformGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a2a4a"/>
          <stop offset="100%" stopColor="#0d1a30"/>
        </linearGradient>
        <linearGradient id="pilotCapGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e3560"/>
          <stop offset="100%" stopColor="#0d1a30"/>
        </linearGradient>
        <linearGradient id="pilotGoldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFD700"/>
          <stop offset="100%" stopColor="#C8A000"/>
        </linearGradient>
        <linearGradient id="pilotShirtGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f0f4f8"/>
          <stop offset="100%" stopColor="#dde4ec"/>
        </linearGradient>
        <filter id="pilotDropShadow">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.18)"/>
        </filter>
      </defs>

      <g transform="translate(200,30)" filter="url(#pilotDropShadow)">
        <rect x="28" y="310" width="22" height="90" rx="8" fill="#1a2a4a"/>
        <rect x="58" y="310" width="22" height="90" rx="8" fill="#1a2a4a"/>
        <line x1="39" y1="315" x2="39" y2="395" stroke="#0d1a30" strokeWidth="1.5" opacity="0.5"/>
        <line x1="69" y1="315" x2="69" y2="395" stroke="#0d1a30" strokeWidth="1.5" opacity="0.5"/>
        <ellipse cx="39" cy="398" rx="16" ry="8" fill="#1a1a1a"/>
        <ellipse cx="69" cy="398" rx="16" ry="8" fill="#1a1a1a"/>
        
        <rect x="14" y="190" width="80" height="130" rx="14" fill="url(#pilotUniformGrad)"/>
        <path d="M 54,195 L 40,220 L 54,215 L 68,220 L 54,195 Z" fill="url(#pilotShirtGrad)"/>
        <rect x="46" y="195" width="16" height="80" rx="3" fill="url(#pilotShirtGrad)"/>
        <circle cx="54" cy="220" r="2.5" fill="#ccc"/>
        <circle cx="54" cy="232" r="2.5" fill="#ccc"/>
        <circle cx="54" cy="244" r="2.5" fill="#ccc"/>

        <path d="M 50,215 L 54,270 L 58,215 L 56,208 L 52,208 Z" fill="#0d1a30"/>
        <path d="M 52,268 L 54,278 L 56,268 Z" fill="#0d1a30"/>

        <rect x="10" y="192" width="26" height="10" rx="4" fill="url(#pilotCapGrad)"/>
        <line x1="14" y1="196" x2="32" y2="196" stroke="url(#pilotGoldGrad)" strokeWidth="2"/>
        <rect x="72" y="192" width="26" height="10" rx="4" fill="url(#pilotCapGrad)"/>
        <line x1="76" y1="196" x2="94" y2="196" stroke="url(#pilotGoldGrad)" strokeWidth="2"/>

        <g transform="translate(30,210)">
          <path d="M 24,5 Q 10,2 0,5 Q 8,8 24,7 Z" fill="url(#pilotGoldGrad)"/>
          <path d="M 24,5 Q 38,2 48,5 Q 40,8 24,7 Z" fill="url(#pilotGoldGrad)"/>
          <path d="M 20,2 L 28,2 L 30,10 L 24,13 L 18,10 Z" fill="url(#pilotGoldGrad)"/>
        </g>

        {/* Rank stripes */}
        <rect x="12" y="270" width="20" height="3" rx="1" fill="url(#pilotGoldGrad)"/>
        <rect x="12" y="276" width="20" height="3" rx="1" fill="url(#pilotGoldGrad)"/>
        <rect x="12" y="282" width="20" height="3" rx="1" fill="url(#pilotGoldGrad)"/>
        <rect x="12" y="288" width="20" height="3" rx="1" fill="url(#pilotGoldGrad)"/>
        <rect x="76" y="270" width="20" height="3" rx="1" fill="url(#pilotGoldGrad)"/>
        <rect x="76" y="276" width="20" height="3" rx="1" fill="url(#pilotGoldGrad)"/>
        <rect x="76" y="282" width="20" height="3" rx="1" fill="url(#pilotGoldGrad)"/>
        <rect x="76" y="288" width="20" height="3" rx="1" fill="url(#pilotGoldGrad)"/>

        {/* Animated Pointing Arm (Points towards center) */}
        <motion.g
          animate={isGlobalPaused ? {} : { 
            rotate: [0, -3, 0],
            x: [0, -8, 0]
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ originX: "12px", originY: "200px" }}
        >
          {/* Upper arm */}
          <path d="M 12,200 Q -10,195 -30,190" stroke="url(#pilotUniformGrad)" strokeWidth="22" strokeLinecap="round" fill="none"/>
          {/* Lower arm */}
          <path d="M -30,190 Q -55,185 -80,185" stroke="url(#pilotUniformGrad)" strokeWidth="20" strokeLinecap="round" fill="none"/>
          {/* Hand/Finger pointing */}
          <ellipse cx="-85" cy="185" rx="14" ry="10" fill="url(#pilotSkinGrad)" />
          {/* Pointing finger */}
          <path d="M -95,185 L -115,185" stroke="url(#pilotSkinGrad)" strokeWidth="6" strokeLinecap="round" />
          {/* Rank stripe on cuff */}
          <path d="M -40,188 Q -30,190 -25,192" stroke="url(#pilotGoldGrad)" strokeWidth="3" fill="none"/>
        </motion.g>

        <path d="M 95,205 Q 118,230 115,270" stroke="url(#pilotUniformGrad)" strokeWidth="22" strokeLinecap="round" fill="none"/>
        <ellipse cx="114" cy="278" rx="12" ry="10" fill="url(#pilotSkinGrad)"/>
        <rect x="46" y="165" width="18" height="30" rx="7" fill="url(#pilotSkinGrad)"/>
        <ellipse cx="54" cy="148" rx="38" ry="42" fill="url(#pilotSkinGrad)"/>
        
        <path d="M 10,126 Q 54,118 98,126 L 96,134 Q 54,128 12,134 Z" fill="#0d1a30"/>
        <path d="M 14,130 Q 14,105 54,100 Q 94,105 94,130 Q 74,126 54,126 Q 34,126 14,130 Z" fill="url(#pilotCapGrad)"/>
        <rect x="14" y="124" width="80" height="6" rx="2" fill="url(#pilotGoldGrad)"/>
      </g>
    </svg>
  </div>
);

interface VideoItem {
  id: string;
  title?: string;
  vimeo_id?: string;
  vimeo_url: string;
}

export const AdventureSection = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [settings, setSettings] = useState({
    adventure_title: "The Sky is Calling",
    adventure_desc: "Join OneDayPilot and transform your perspective. Our introductory flights are designed for everyone, from curious beginners to aviation enthusiasts.",
    bg_gradient_adventure: ""
  });
  const [styles, setStyles] = useState<Record<string, any>>({});

  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(videoRef, { amount: 0.5, once: true });

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
    const ensureAuthSession = async () => {
      if (!supabase) return false;
      const { data: { session } } = await supabase.auth.getSession();
      return !!session;
    };

    const fetchSettings = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .in("key", ["adventure_title", "adventure_desc", "bg_gradient_adventure"]);
      
      if (data) {
        const newSettings = { ...settings };
        const newStyles: Record<string, any> = {};
        data.forEach((s) => {
          if (s.key === "adventure_title") {
            newSettings.adventure_title = s.value;
            if (s.style) newStyles.adventure_title = s.style;
          }
          if (s.key === "adventure_desc") {
            newSettings.adventure_desc = s.value;
            if (s.style) newStyles.adventure_desc = s.style;
          }
          if (s.key === "bg_gradient_adventure") newSettings.bg_gradient_adventure = s.value;
        });
        setSettings(newSettings);
        setStyles(newStyles);
      }
    };

    const fetchVideos = async () => {
      if (!supabase) return;
      const { data } = await supabase.from("videos").select("*").order("order", { ascending: true });
      if (data && data.length > 0) {
        setVideos(data as VideoItem[]);
        setSelectedVideo(data[0] as VideoItem);
      }
    };

    const bootstrap = async () => {
      if (!supabase) return;
      await ensureAuthSession();
      await Promise.all([fetchSettings(), fetchVideos()]);
    };

    bootstrap();
  }, []);

  const getEmbedUrl = (v: VideoItem, autoPlay: boolean = false) => {
    let url = "";
    if (v.vimeo_id) {
      url = `https://player.vimeo.com/video/${v.vimeo_id}?badge=0&autopause=0&player_id=0&app_id=122963`;
    } else {
      url = v.vimeo_url?.includes("player.vimeo.com") ? v.vimeo_url : v.vimeo_url;
    }

    if (autoPlay && url) {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}autoplay=1&muted=1`;
    }
    return url;
  };

  return (
    <section 
      id="sky" 
      className="relative overflow-hidden py-16 md:py-24"
      style={settings.bg_gradient_adventure ? { background: settings.bg_gradient_adventure } : { background: "#06091a" }}
    >
      <BackgroundParticles variant="dark" isPaused={isGlobalPaused} />
      <PilotDecoration isGlobalPaused={isGlobalPaused} />
      <div className="absolute top-0 right-0 h-px w-1/3 bg-gradient-to-l from-[#ea580c] to-transparent" />
      <div className="absolute bottom-0 left-0 h-px w-1/2 bg-gradient-to-r from-[#ea580c] via-[#facc15]/50 to-transparent" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="mx-auto mb-10 max-w-4xl text-center md:mb-14">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="h-[2px] w-10 bg-[#ea580c]" />
            <span
              className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ea580c]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Flight Stories
            </span>
            <div className="h-[2px] w-10 bg-[#ea580c]" />
          </div>
          <h2 
            className="mb-4 text-4xl uppercase leading-none text-white md:text-6xl"
            style={{
              color: styles.adventure_title?.color || '#f8fafc',
              fontSize: styles.adventure_title?.fontSize,
              fontWeight: styles.adventure_title?.fontWeight,
              fontStyle: styles.adventure_title?.fontStyle,
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: "0.05em",
              textShadow: "0 8px 24px rgba(0,0,0,0.45)",
            }}
          >
            {settings.adventure_title}
          </h2>
          <p 
            className="mx-auto max-w-3xl text-sm font-semibold uppercase tracking-[0.18em] text-white/65 md:text-base"
            style={{
              color: styles.adventure_desc?.color || "rgba(255,255,255,0.65)",
              fontSize: styles.adventure_desc?.fontSize,
              fontWeight: styles.adventure_desc?.fontWeight,
              fontStyle: styles.adventure_desc?.fontStyle,
              fontFamily: "'Barlow Condensed', sans-serif",
            }}
          >
            {settings.adventure_desc}
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          {videos.length === 0 ? (
            <div className="py-12 text-center text-white/60">No videos yet</div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Main Panel */}
              <div className="lg:w-2/3">
                {selectedVideo && (
                  <div
                    className="overflow-hidden border border-white/10 bg-[#08101f] shadow-[0_24px_70px_-28px_rgba(0,0,0,0.9)]"
                    style={{ clipPath: "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))" }}
                  >
                    <div ref={videoRef} className="aspect-video w-full">
                      <iframe
                        src={getEmbedUrl(selectedVideo, isInView)}
                        className="w-full h-full"
                        allow="autoplay; fullscreen; picture-in-picture"
                        loading="lazy"
                        title={selectedVideo.title || "Main Video"}
                      />
                    </div>
                    <div className="border-t border-white/10 bg-[#0b1327] p-5">
                      <div className="mb-2 flex items-center gap-3">
                        <span
                          className="text-[10px] font-black uppercase tracking-[0.32em] text-[#ea580c]"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                        >
                          Featured Video
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-[#ea580c]/60 to-transparent" />
                      </div>
                      <h3 className="text-2xl uppercase text-white md:text-3xl" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>{selectedVideo.title || "Introduction"}</h3>
                    </div>
                  </div>
                )}
              </div>

              {/* Thumbnail Gallery */}
              <div className="lg:w-1/3">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4 px-1">
                    <h4 className="text-xs font-black uppercase tracking-[0.28em] text-[#ea580c]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Video Gallery</h4>
                    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">{videos.length} Videos</span>
                  </div>
                  
                  <div className="space-y-4 pr-2 custom-scrollbar py-2">
                    {videos.map((v) => (
                      <div 
                        key={v.id} 
                        onClick={() => {
                          setSelectedVideo(v);
                          trackEvent({
                            action_type: 'click',
                            entity_type: 'video',
                            entity_id: v.id,
                            entity_name: v.title || 'Untitled Video',
                            details: { vimeo_id: v.vimeo_id }
                          });
                          // Scroll main video into view on mobile
                          if (window.innerWidth < 1024) {
                            window.scrollTo({ top: document.getElementById('sky')?.offsetTop || 0, behavior: 'smooth' });
                          }
                        }}
                        className={`group cursor-pointer overflow-hidden border transition-all duration-300 ${
                          selectedVideo?.id === v.id 
                            ? "border-[#ea580c] bg-[#ea580c]/10 shadow-[0_18px_50px_-24px_rgba(234,88,12,0.5)]" 
                            : "border-white/10 bg-[#08101f] shadow-[0_18px_50px_-28px_rgba(0,0,0,0.85)] hover:border-[#ea580c]/50 hover:bg-[#0d1731]"
                        }`}
                        style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))" }}
                      >
                        <div className="flex gap-3 p-2">
                          <div className="w-28 md:w-32 flex-shrink-0 aspect-video rounded-lg overflow-hidden bg-slate-100 relative">
                            {v.vimeo_id ? (
                              <>
                                <motion.img 
                                  initial={{ opacity: 0 }}
                                  animate={isGlobalPaused ? {} : { opacity: 1 }}
                                  src={`https://vumbnail.com/${v.vimeo_id}.jpg`}
                                  alt={v.title}
                                  className={`w-full h-full object-cover transition-transform duration-500 ${
                                    selectedVideo?.id === v.id ? "scale-110" : "group-hover:scale-110"
                                  }`}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&q=80';
                                  }}
                                />
                                {selectedVideo?.id === v.id ? (
                                  <div className="absolute inset-0 flex items-center justify-center bg-[#ea580c]/20 backdrop-blur-[1px]">
                                    <div className={`bg-[#ea580c] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white ${isGlobalPaused ? '' : 'animate-pulse'}`}>
                                      Playing
                                    </div>
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-colors group-hover:bg-slate-900/20">
                                    <div className="flex h-8 w-8 scale-90 items-center justify-center bg-white/90 shadow-md transition-transform group-hover:scale-100">
                                      <div className="ml-1 h-0 w-0 border-b-[5px] border-l-[8px] border-b-transparent border-l-[#ea580c] border-t-[5px] border-t-transparent" />
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                                <div className="w-8 h-8 rounded-full bg-slate-200" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <h5 className="truncate text-sm font-bold text-white transition-colors">
                              {v.title || "Untitled Video"}
                            </h5>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-medium uppercase text-white/50">Aviation Adventure</span>
                              {selectedVideo?.id === v.id && (
                                <span className={`h-1 w-1 rounded-full bg-[#ea580c] ${isGlobalPaused ? '' : 'animate-ping'}`} />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
