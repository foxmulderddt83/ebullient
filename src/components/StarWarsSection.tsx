import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BackgroundParticles } from "./ui/BackgroundParticles";
import { supabase } from "@/lib/supabase";
import { Volume2, VolumeX } from "lucide-react";

const DEFAULT_SECTION_TEXT = `One Day Pilot program is special design for people who want to enjoy a once in a life-time experience by flying an aircraft by doing it a hand on experience. You will act as a co-pilot and fly the aircraft yourself with an experience pilot beside you when you are in the air.

You will have a ground briefing by pilot before take-off, to understand the command, what to do and don't when in the air. Pilot will explain about the aircraft and how he will transfer the flight control to you and vice-versa. The take-off and landing will be control by pilot to ensure safety for your experience.

For Malaysian citizen, you must bring NRIC to the airport, for Non-Malaysian, you must bring passport to the airport for immigration/custom security check. Without this document, you are unable to go into airport restricted zone to enjoy this experience.

It might be someone dream who wish to fly an aircraft or it's your dream. Now, this is the opportunity for you to sign up the One Day Pilot flight experience or with your friends or buy it as a Gift Vouchers to someone special to make their dream come true with you as well. Whether you enjoy a One Day Pilot Flight Experience or decide to continue your training to become a fully-qualified pilot, you will gain a great sense of achievement.`;
const DEFAULT_TITLE_TEXT = "What is One Day Pilot?";
const ANIMATION_DURATION = 60;
const DEFAULT_BG_PNG = "/bg-experience2.png";
const DEFAULT_BG_WEBP = "/bg-experience2.webp";

export const StarWarsSection = () => {
  const [settings, setSettings] = useState({
    title: DEFAULT_TITLE_TEXT,
    text: DEFAULT_SECTION_TEXT,
    titleColor: "#CC1F1F",
    textColor: "#f1f5f9",
    titleSize: "text-2xl md:text-5xl",
    textSize: "text-[14px] md:text-lg",
    background: "bg-gray-950",
    bgImage: DEFAULT_BG_PNG,
    bgImageOpacity: 0.3
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', [
          'starwars_title',
          'starwars_text',
          'starwars_title_color',
          'starwars_text_color',
          'starwars_title_size',
          'starwars_text_size',
          'bg_gradient_starwars',
          'starwars_bg_image',
          'starwars_bg_image_opacity'
        ]);

      if (data) {
        const newSettings = { ...settings };
        data.forEach(item => {
          if (item.value) {
            switch (item.key) {
              case 'starwars_title': newSettings.title = item.value; break;
              case 'starwars_text': newSettings.text = item.value; break;
              case 'starwars_title_color': newSettings.titleColor = item.value; break;
              case 'starwars_text_color': newSettings.textColor = item.value; break;
              case 'starwars_title_size': newSettings.titleSize = item.value; break;
              case 'starwars_text_size': newSettings.textSize = item.value; break;
              case 'bg_gradient_starwars': newSettings.background = item.value; break;
              case 'starwars_bg_image': newSettings.bgImage = item.value; break;
              case 'starwars_bg_image_opacity': {
                const parsedOpacity = Number(item.value);
                newSettings.bgImageOpacity = Number.isFinite(parsedOpacity)
                  ? Math.min(1, Math.max(0, parsedOpacity))
                  : 0.3;
                break;
              }
            }
          }
        });
        setSettings(newSettings);
      }
    };
    fetchSettings();
  }, []);

  const baseLines = useMemo(() =>
    settings.text.split('\n').map(p => p.trim()),
    [settings.text]
  );

  const lines = useMemo(() => [...baseLines, "---"], [baseLines]);
  const lineDelayStep = 4;
  const titleLetters = useMemo(() => settings.title.split(""), [settings.title]);

  const [isManualScroll, setIsManualScroll] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startManualScroll = () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
    setIsManualScroll(true);
  };

  const endManualScroll = () => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsManualScroll(false);
      scrollTimeoutRef.current = null;
    }, 2000);
  };

  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem("starwars-audio-muted");
    return saved === "true";
  });

  const [isVisible, setIsVisible] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const handleGlobalInteraction = () => {
      if (!hasInteracted) {
        setHasInteracted(true);
      }
    };

    window.addEventListener("mousedown", handleGlobalInteraction);
    window.addEventListener("touchstart", handleGlobalInteraction);
    window.addEventListener("keydown", handleGlobalInteraction);

    return () => {
      window.removeEventListener("mousedown", handleGlobalInteraction);
      window.removeEventListener("touchstart", handleGlobalInteraction);
      window.removeEventListener("keydown", handleGlobalInteraction);
    };
  }, [hasInteracted]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.2, rootMargin: "-50px 0px -50px 0px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);

    const handleMuteToggle = (event: any) => {
      const newMuted = event.detail;
      setIsMuted(newMuted);
      if (audioRef.current) audioRef.current.muted = newMuted;
    };

    window.addEventListener("starwars-mute-toggle", handleMuteToggle);

    return () => {
      audioRef.current?.pause();
      observer.disconnect();
      window.removeEventListener("starwars-mute-toggle", handleMuteToggle);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("starwars-section-visible", { detail: isVisible }));
    const audioShouldPlay = isVisible && !isMuted && hasInteracted;

    if (audioShouldPlay) {
      if (!audioRef.current) {
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = "/star-trek-theme.mp3";
        audio.loop = true;
        audio.muted = isMuted;
        audio.onerror = (e) => console.error("Audio loading error:", e);
        audioRef.current = audio;
      }
      
      audioRef.current.muted = isMuted;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.log("Audio play blocked by browser, waiting for interaction:", e.message);
        });
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [isVisible, isMuted, hasInteracted]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem("starwars-audio-muted", String(newMuted));
    if (audioRef.current) audioRef.current.muted = newMuted;
    
    // If unmuting, ensure we have interaction flag set
    if (!newMuted) {
      setHasInteracted(true);
    }
    
    window.dispatchEvent(new CustomEvent("starwars-mute-toggle", { detail: newMuted }));
  };

  const isCustomBg = settings.background && (settings.background.startsWith('linear-gradient') || settings.background.startsWith('radial-gradient'));
  const effectiveBgImage = settings.bgImage || DEFAULT_BG_PNG;
  const effectiveBgWebp = effectiveBgImage === DEFAULT_BG_PNG ? DEFAULT_BG_WEBP : (effectiveBgImage.endsWith(".webp") ? effectiveBgImage : null);

  return (
    <section
      ref={sectionRef}
      id="briefing"
      onMouseDown={startManualScroll}
      onMouseUp={endManualScroll}
      onMouseLeave={endManualScroll}
      onTouchStart={startManualScroll}
      onTouchEnd={endManualScroll}
      className={`relative py-6 md:py-10 overflow-hidden min-h-[400px] md:min-h-[480px] flex flex-col items-center justify-start text-center px-4 cursor-pointer select-none will-change-transform ${!isCustomBg ? settings.background : ''}`}
      style={{ background: isCustomBg ? settings.background : undefined }}
    >
      {/* Atmospheric layers — sky vignette + stars */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at top, rgba(204,31,31,0.05) 0%, transparent 50%), radial-gradient(ellipse at bottom, rgba(8,15,30,0.6) 0%, transparent 60%)',
        }}
      />

      {/* Right Side Experience Image */}
      <div
        className="absolute inset-y-0 right-0 w-full md:w-2/3 z-0 pointer-events-none overflow-hidden"
        style={{
          opacity: settings.bgImageOpacity,
          maskImage: 'linear-gradient(to left, black 15%, transparent 95%)',
          WebkitMaskImage: 'linear-gradient(to left, black 15%, transparent 95%)'
        }}
      >
        {effectiveBgWebp ? (
          <picture>
            <source srcSet={effectiveBgWebp} type="image/webp" />
            <img
              src={effectiveBgImage}
              alt=""
              loading="lazy"
              decoding="async"
              width={1200}
              height={700}
              className="absolute inset-0 w-full h-full object-cover object-right"
            />
          </picture>
        ) : (
          <img
            src={effectiveBgImage}
            alt=""
            loading="lazy"
            decoding="async"
            width={1200}
            height={700}
            className="absolute inset-0 w-full h-full object-cover object-right"
          />
        )}
      </div>
      <BackgroundParticles variant="dark" count={40} speedMultiplier={4} isPaused={false} />

      {/* Top frame markers */}
      <div className="absolute top-4 left-6 right-6 z-30 pointer-events-none flex justify-between items-center text-white/30 text-[9px] tracking-[0.32em]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <div className="flex items-center gap-2">
          <span className="w-1 h-1 bg-[#CC1F1F]" />
          <span>FLIGHT BRIEFING · 001</span>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <span>HOLD · TAP TO READ</span>
          <span className="w-1 h-1 bg-[#CC1F1F]" />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8 }}
        className="relative z-30 mb-2 md:mb-4 mt-2 md:mt-4 flex flex-col items-center"
      >
        <div className="inline-flex items-center gap-3 mb-4">
          <span className="w-8 h-[1px] bg-[#CC1F1F]" />
          <span className="text-[#CC1F1F]/80 text-[9px] font-bold tracking-[0.42em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Pre-Flight Briefing
          </span>
          <span className="w-8 h-[1px] bg-[#CC1F1F]" />
        </div>

        <h2
          className={`${settings.titleSize} uppercase tracking-tight mb-3 flex flex-wrap justify-center font-title`}
          style={{
            color: settings.titleColor,
            textShadow: `0 0 30px ${settings.titleColor}55, 0 4px 24px rgba(0,0,0,0.6)`,
            letterSpacing: '0.04em',
          }}
        >
          {titleLetters.map((letter, index) => (
            <motion.span
              key={index}
              style={{ display: "inline-block", whiteSpace: letter === " " ? "pre" : "normal" }}
              animate={{ y: [0, -3, 0] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                delay: index * 0.06,
                ease: "easeInOut"
              }}
            >
              {letter}
            </motion.span>
          ))}
        </h2>

        <div className="flex items-center gap-2">
          <div className="h-px w-8 bg-[#CC1F1F]/40" />
          <div className="h-1 w-12 bg-[#CC1F1F] rounded-full shadow-[0_0_16px_rgba(204,31,31,0.9)]" />
          <div className="h-px w-8 bg-[#CC1F1F]/40" />
        </div>
      </motion.div>

      <div className="relative w-full max-w-7xl h-[220px] md:h-[260px] mt-2 md:mt-4 overflow-hidden z-10">
        {isManualScroll ? (
          <div
            className="h-full overflow-y-auto px-2 md:px-4 pb-10 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div className="mx-auto max-w-5xl space-y-5 pt-2 pb-10">
              {baseLines.map((line, index) => (
                <p
                  key={index}
                  className={`${settings.textSize} font-normal leading-relaxed tracking-wide px-2 whitespace-pre-wrap font-jakarta`}
                  style={{
                    color: settings.textColor,
                    textShadow: "0 4px 16px rgba(0,0,0,0.9)"
                  }}
                >
                  {line}
                </p>
              ))}
              <div className="flex justify-center pt-8">
                <div className="h-0.5 w-full max-w-2xl bg-[#CC1F1F]/40 rounded-full" />
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center">
            {lines.map((line, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: -250, scale: 0.85 }}
                animate={{
                  opacity: [0, 0, 1, 1, 1, 0],
                  y: [-250, -100, 150, 450, 1000, 1200],
                  scale: [0.85, 0.92, 1.15, 1.32, 0.92, 0.72],
                }}
                transition={{
                  duration: ANIMATION_DURATION,
                  repeat: Infinity,
                  delay: (index * lineDelayStep) - 16,
                  ease: "linear",
                }}
                className="absolute w-full px-4 flex items-center justify-center min-h-[80px] md:min-h-[100px] will-change-transform"
              >
                {line === "---" ? (
                  <div className="w-full max-w-3xl flex items-center gap-3">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#CC1F1F]/60" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#CC1F1F] shadow-[0_0_12px_rgba(204,31,31,0.8)]" />
                    <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#CC1F1F]/60" />
                  </div>
                ) : line === "" ? null : (
                  <p
                    className={`${settings.textSize} font-normal leading-relaxed tracking-wide max-w-5xl px-2 whitespace-pre-wrap font-jakarta`}
                    style={{
                      color: settings.textColor,
                      textShadow: '0 4px 16px rgba(0,0,0,0.9)',
                    }}
                  >
                    {line}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 text-white/30 text-[9px] tracking-[0.32em]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        {isManualScroll ? "AUTO-SCROLL PAUSED" : "TAP & HOLD TO READ AT YOUR OWN PACE"}
      </div>

      {/* Sound Toggle */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleMute}
        className="absolute bottom-6 right-6 z-40 p-3 rounded-full bg-black/40 border border-white/10 backdrop-blur-md text-white/60 hover:text-[#CC1F1F] hover:border-[#CC1F1F]/40 transition-all shadow-xl"
        title={isMuted ? "Unmute Theme" : "Mute Theme"}
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </motion.button>
    </section>
  );
};
