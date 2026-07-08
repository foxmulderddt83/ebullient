import { useState, useEffect, useRef } from "react";
import { ExternalLink, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { BackgroundParticles } from "./ui/BackgroundParticles";

interface VideoItem {
  id: string;
  title?: string;
  vimeo_id?: string;
  vimeo_url: string;
  thumbnail_url?: string;
}

export const AdventureSection = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [settings, setSettings] = useState({
    adventure_title: "The Sky is Calling",
    adventure_desc: "Join OneDayPilot and transform your perspective. Our introductory flights are designed for everyone, from curious beginners to aviation enthusiasts.",
    bg_gradient_adventure: ""
  });
  const [styles, setStyles] = useState<Record<string, any>>({});

  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateMobileView = () => setIsMobileView(window.innerWidth < 1024);
    updateMobileView();
    window.addEventListener("resize", updateMobileView);
    return () => window.removeEventListener("resize", updateMobileView);
  }, []);

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

    const fetchVimeoThumbnail = async (vimeoId: string): Promise<string> => {
      try {
        const response = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}`);
        if (response.ok) {
          const data = await response.json();
          return data.thumbnail_url || "";
        }
      } catch (err) {
        console.warn(`Failed to fetch Vimeo thumbnail for ${vimeoId}:`, err);
      }
      return "";
    };

    const fetchVideos = async () => {
      if (!supabase) return;
      const { data } = await supabase.from("videos").select("*").order("order", { ascending: true });
      if (data && data.length > 0) {
        const videosWithThumbs = await Promise.all((data as VideoItem[]).map(async (v) => {
          const provider = getProvider(v);
          if (provider === "vimeo") {
            const vimeoId = v.vimeo_id || extractVimeoIdFromUrl(v.vimeo_url || "");
            if (vimeoId) {
              const thumb = await fetchVimeoThumbnail(vimeoId);
              return { ...v, thumbnail_url: thumb };
            }
          } else if (provider === "youtube") {
            const id = extractYouTubeId(v.vimeo_url || "");
            if (id) {
              return { ...v, thumbnail_url: `https://img.youtube.com/vi/${id}/hqdefault.jpg` };
            }
          }
          return v;
        }));
        
        setVideos(videosWithThumbs);
        setSelectedVideo(videosWithThumbs[0]);
      }
    };

    const bootstrap = async () => {
      if (!supabase) return;
      await ensureAuthSession();
      await Promise.all([fetchSettings(), fetchVideos()]);
    };

    bootstrap();
  }, []);

  const extractYouTubeId = (url: string) => {
    if (!url) return "";
    const normalized = url.trim();
    const match =
      normalized.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/) ||
      normalized.match(/[?&]v=([a-zA-Z0-9_-]{6,})/) ||
      normalized.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/) ||
      normalized.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
    return match?.[1] || "";
  };

  const extractVimeoIdFromUrl = (url: string) => {
    if (!url) return "";
    const match =
      url.match(/vimeo\.com\/(?:video\/)?(\d+)/) ||
      url.match(/player\.vimeo\.com\/video\/(\d+)/);
    return match?.[1] || "";
  };

  const getProvider = (v: VideoItem): "youtube" | "vimeo" | "unknown" => {
    const url = (v.vimeo_url || "").toLowerCase();
    if (url.includes("youtu.be") || url.includes("youtube.com")) return "youtube";
    if (v.vimeo_id || url.includes("vimeo.com")) return "vimeo";
    return "unknown";
  };

  const getEmbedUrl = (v: VideoItem, autoPlay: boolean = false) => {
    const provider = getProvider(v);

    if (provider === "youtube") {
      const id = extractYouTubeId(v.vimeo_url || "");
      if (!id) return v.vimeo_url || "";
      const params = new URLSearchParams({
        autoplay: autoPlay ? "1" : "0",
        mute: autoPlay ? "1" : "0",
        rel: "0",
        modestbranding: "1"
      });
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }

    const vimeoId = v.vimeo_id || extractVimeoIdFromUrl(v.vimeo_url || "");
    if (vimeoId) {
      const base = `https://player.vimeo.com/video/${vimeoId}?badge=0&autopause=0&player_id=0&app_id=122963`;
      if (!autoPlay) return base;
      return `${base}&autoplay=1&muted=1`;
    }

    const url = v.vimeo_url || "";
    if (!autoPlay || !url) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}autoplay=1&muted=1`;
  };

  const getThumbnailUrl = (v: VideoItem) => {
    if (v.thumbnail_url) return v.thumbnail_url;
    
    const provider = getProvider(v);
    if (provider === "youtube") {
      const id = extractYouTubeId(v.vimeo_url || "");
      if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }

    const vimeoId = v.vimeo_id || extractVimeoIdFromUrl(v.vimeo_url || "");
    if (vimeoId) return `https://vumbnail.com/${vimeoId}.jpg`;
    return "";
  };

  const getExternalVideoUrl = (v: VideoItem) => {
    const provider = getProvider(v);
    if (provider === "youtube") {
      const id = extractYouTubeId(v.vimeo_url || "");
      return id ? `https://www.youtube.com/watch?v=${id}` : v.vimeo_url || "";
    }
    const vimeoId = v.vimeo_id || extractVimeoIdFromUrl(v.vimeo_url || "");
    return vimeoId ? `https://vimeo.com/${vimeoId}` : v.vimeo_url || "";
  };

  return (
    <section 
      id="sky" 
      className="relative overflow-hidden pt-16 pb-2 md:pt-24 md:pb-4"
      style={settings.bg_gradient_adventure ? { background: settings.bg_gradient_adventure } : { background: "#FFFFFF" }}
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
      <BackgroundParticles variant="light" isPaused={isGlobalPaused} />
      <div className="w-full relative z-10 px-2 lg:px-4">
        <div className="max-w-[1900px] mx-auto">
          <div className="mx-auto mb-10 max-w-4xl text-center md:mb-14">
            <div className="mb-4 flex items-center justify-center gap-3">
              <div className="h-[2px] w-10 bg-[#CC1F1F]" />
              <span className="text-[10px] font-black uppercase tracking-[0.35em] text-[#CC1F1F] font-condensed">
                Flight Stories
              </span>
              <div className="h-[2px] w-10 bg-[#CC1F1F]" />
            </div>
            <h2 
              className="mb-4 text-4xl uppercase leading-none text-gray-900 md:text-7xl font-title tracking-[0.05em]"
              style={{
                color: styles.adventure_title?.color || '#111111',
                fontSize: styles.adventure_title?.fontSize || 'clamp(2.5rem, 8vw, 5rem)',
                fontWeight: styles.adventure_title?.fontWeight,
                fontStyle: styles.adventure_title?.fontStyle,
              }}
            >
              {settings.adventure_title}
            </h2>
            <p 
            className="mx-auto max-w-3xl text-sm font-semibold uppercase tracking-[0.18em] text-gray-800 md:text-lg font-condensed"
              style={{
                color: styles.adventure_desc?.color || "#555555",
                fontSize: styles.adventure_desc?.fontSize || 'clamp(0.9rem, 1.5vw, 1.125rem)',
                fontWeight: styles.adventure_desc?.fontWeight,
                fontStyle: styles.adventure_desc?.fontStyle,
              }}
            >
              {settings.adventure_desc}
            </p>
          </div>

          {videos.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No videos yet</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Main Panel */}
              <motion.div 
                initial={isMobileView ? false : { opacity: 0, scale: 0.95, y: 30 }}
                whileInView={isMobileView ? undefined : { opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={isMobileView ? undefined : { duration: 0.6, ease: "easeOut" }}
                className="lg:col-span-9 xl:col-span-9 lg:h-[calc(100vh-10rem)] lg:max-h-[960px]"
              >
                {selectedVideo && (
                  <div
                    className="overflow-hidden border border-gray-200 bg-white shadow-[0_15px_50px_-10px_rgba(0,0,0,0.08)] rounded-2xl md:rounded-3xl flex flex-col h-full"
                  >
                    <div
                      ref={videoRef}
                      className={`${isMobileView ? "aspect-video" : "flex-1 min-h-0"} w-full bg-black relative group cursor-pointer`}
                      onClick={() => setIsPlaying(true)}
                    >
                      {!isPlaying ? (
                        <>
                          {getThumbnailUrl(selectedVideo) ? (
                            <img 
                              src={getThumbnailUrl(selectedVideo)}
                              alt={selectedVideo.title || "Video thumbnail"}
                              className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-slate-900" />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#CC1F1F]/90 text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
                              <Play className="ml-2 h-10 w-10 fill-current" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <iframe
                          src={getEmbedUrl(selectedVideo, true)}
                          className="absolute inset-0 w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
                          loading="lazy"
                          title={selectedVideo.title || "Adventure Video Player"}
                        />
                      )}
                    </div>
                    <div className="border-t border-gray-100 bg-white p-4 md:p-5">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-[0.32em] text-[#CC1F1F] font-condensed">
                          Featured Video
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-[#CC1F1F]/60 to-transparent" />
                        <a
                          href={getExternalVideoUrl(selectedVideo)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {getProvider(selectedVideo) === "youtube" ? "YouTube" : getProvider(selectedVideo) === "vimeo" ? "Vimeo" : "Open"}
                        </a>
                      </div>
                      <h4 className="text-2xl uppercase text-gray-900 md:text-3xl font-title tracking-[0.04em]">{selectedVideo.title || "Introduction"}</h4>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Thumbnail Gallery */}
              <div className="lg:col-span-3 xl:col-span-3 lg:sticky lg:top-28 lg:pl-6 mt-6 lg:mt-0">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h4 className="text-xs font-black uppercase tracking-[0.28em] text-[#CC1F1F] font-condensed">Video Gallery</h4>
                    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">{videos.length} Videos</span>
                  </div>
                  
                  <div 
                    className="space-y-3 pr-2 custom-scrollbar py-1 max-h-[50vh] lg:h-[calc(100vh-10rem)] lg:max-h-[960px] overflow-y-auto"
                  >
                    {videos.map((v, index) => (
                      <motion.div 
                        key={`${v.id}-${index}`} 
                        initial={isMobileView ? false : { opacity: 0, scale: 0.9, x: 20 }}
                        whileInView={isMobileView ? undefined : { opacity: 1, scale: 1, x: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={isMobileView ? undefined : { duration: 0.35, ease: "easeOut", delay: index * 0.03 }}
                        onClick={() => {
                          setSelectedVideo(v);
                          setIsPlaying(true); // Auto-play when thumbnail is clicked
                        }}
                        className={`group cursor-pointer overflow-hidden border rounded-2xl transition-colors ${
                          selectedVideo?.id === v.id 
                            ? "border-[#CC1F1F] border-2 bg-[#CC1F1F]/5 shadow-[0_10px_30px_-10px_rgba(204,31,31,0.35)]" 
                            : "border-gray-200 bg-white hover:border-[#CC1F1F]/50 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex gap-2 p-2 md:gap-4 md:p-4">
                          <div className="w-28 md:w-44 flex-shrink-0 aspect-video rounded-xl overflow-hidden bg-slate-100 relative border border-white/5 shadow-sm">
                            {getThumbnailUrl(v) ? (
                              <>
                                <img 
                                  src={getThumbnailUrl(v)}
                                  alt={v.title}
                                  className={`w-full h-full object-cover ${
                                    selectedVideo?.id === v.id ? "scale-110" : "group-hover:scale-110"
                                  }`}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&q=80';
                                  }}
                                />
                                {selectedVideo?.id === v.id ? (
                                  <div className="absolute inset-0 flex items-center justify-center bg-[#CC1F1F]/20 backdrop-blur-[1px]">
                                    <div className="bg-[#CC1F1F] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-900">
                                      Playing
                                    </div>
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors">
                                    <div className="flex h-9 w-9 scale-95 items-center justify-center rounded-full bg-white/90 shadow-md group-hover:scale-100 transition-transform">
                                      <div className="ml-1 h-0 w-0 border-b-[5px] border-l-[8px] border-b-transparent border-l-[#CC1F1F] border-t-[5px] border-t-transparent" />
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
                            <h5 className="line-clamp-2 text-sm md:text-base font-bold text-gray-900 leading-snug">
                              {v.title || "Untitled Video"}
                            </h5>
                            <div className="flex items-center gap-1.5 md:gap-2 mt-1">
                              <span className="text-[9px] md:text-xs font-medium uppercase text-gray-500">
                                {getProvider(v) === "youtube" ? "YouTube" : getProvider(v) === "vimeo" ? "Vimeo" : "Video"}
                              </span>
                              <span className="h-1 w-1 rounded-full bg-slate-300" />
                              <span className="text-[9px] md:text-xs font-medium uppercase text-gray-500">Adventure</span>
                              {selectedVideo?.id === v.id && (
                                <span className="h-1 w-1 rounded-full bg-[#CC1F1F]" />
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
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
