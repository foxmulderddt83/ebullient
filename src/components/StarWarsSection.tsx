import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BackgroundParticles } from "./ui/BackgroundParticles";
import { supabase } from "@/lib/supabase";

const DEFAULT_SECTION_TEXT = `One Day Pilot program is special design for people who want to enjoy a once in a life-time experience by flying an aircraft by doing it a hand on experience. You will act as a co-pilot and fly the aircraft yourself with an experience pilot beside you when you are in the air.

You will have a ground briefing by pilot before take-off, to understand the command, what to do and don't when in the air. Pilot will explain about the aircraft and how he will transfer the flight control to you and vice-versa. The take-off and landing will be control by pilot to ensure safety for your experience.

For Malaysian citizen, you must bring NRIC to the airport, for Non-Malaysian, you must bring passport to the airport for immigration/custom security check. Without this document, you are unable to go into airport restricted zone to enjoy this experience.

It might be someone dream who wish to fly an aircraft or it's your dream. Now, this is the opportunity for you to sign up the One Day Pilot flight experience or with your friends or buy it as a Gift Vouchers to someone special to make their dream come true with you as well. Whether you enjoy a One Day Pilot Flight Experience or decide to continue your training to become a fully-qualified pilot, you will gain a great sense of achievement.`;
const DEFAULT_TITLE_TEXT = "What is One Day Pilot?";
const ANIMATION_DURATION = 60;

export const StarWarsSection = () => {
  const [settings, setSettings] = useState({
    title: DEFAULT_TITLE_TEXT,
    text: DEFAULT_SECTION_TEXT,
    titleColor: "#ef4444",
    textColor: "#f1f5f9",
    titleSize: "text-xl md:text-3xl",
    textSize: "text-[13px] md:text-base",
    background: "bg-black"
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
          'bg_gradient_starwars'
        ]);
        
      if (data) {
        const newSettings = { ...settings };
        data.forEach(item => {
          if (item.value) {
            switch(item.key) {
              case 'starwars_title': newSettings.title = item.value; break;
              case 'starwars_text': newSettings.text = item.value; break;
              case 'starwars_title_color': newSettings.titleColor = item.value; break;
              case 'starwars_text_color': newSettings.textColor = item.value; break;
              case 'starwars_title_size': newSettings.titleSize = item.value; break;
              case 'starwars_text_size': newSettings.textSize = item.value; break;
              case 'bg_gradient_starwars': newSettings.background = item.value; break;
            }
          }
        });
        setSettings(newSettings);
      }
    };
    
    fetchSettings();
  }, []);

  const baseLines = useMemo(() => 
    // Split by one or more newlines to identify individual lines/paragraphs
    // We keep all segments including the empty ones to represent blank spaces
    settings.text.split('\n').map(p => p.trim()),
    [settings.text]
  );

  const lines = useMemo(() => [...baseLines, "---"], [baseLines]);
  // Use a 4-second delay between each line (including blank ones)
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
    // Clear any existing timeout first
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    // Set a new timeout to resume animation after 2 seconds
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

  useEffect(() => {
    // Initialize audio only if it doesn't exist
    if (!audioRef.current) {
      const audio = new Audio("/luis_humanoide-adventures-on-the-enterprise-inspired-by-star-trek-295857.mp3");
      audio.loop = true;
      audio.muted = isMuted;
      audioRef.current = audio;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { 
        threshold: 0.2,
        rootMargin: "-50px 0px -50px 0px"
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    const handleMuteToggle = (event: any) => {
      const newMuted = event.detail;
      setIsMuted(newMuted);
      if (audioRef.current) {
        audioRef.current.muted = newMuted;
      }
    };

    window.addEventListener("starwars-mute-toggle", handleMuteToggle);

    return () => {
      audioRef.current?.pause();
      observer.disconnect();
      window.removeEventListener("starwars-mute-toggle", handleMuteToggle);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Separate effect to handle play/pause based on visibility and mute status
  useEffect(() => {
    // Notify FloatingSupport about section visibility
    window.dispatchEvent(new CustomEvent("starwars-section-visible", { detail: isVisible }));

    if (!audioRef.current) return;

    audioRef.current.muted = isMuted;

    if (isVisible) {
      audioRef.current.play().catch(e => {
        console.log("Audio play failed or was blocked by browser:", e.message);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isVisible, isMuted]);

  return (
    <section
      ref={sectionRef}
      onMouseDown={startManualScroll}
      onMouseUp={endManualScroll}
      onMouseLeave={endManualScroll}
      onTouchStart={startManualScroll}
      onTouchEnd={endManualScroll}
      className={`relative py-8 md:py-10 overflow-hidden min-h-[450px] md:min-h-[500px] flex flex-col items-center justify-start text-center px-4 cursor-pointer select-none will-change-transform ${settings.background}`}
      style={{ background: settings.background.startsWith('linear-gradient') || settings.background.startsWith('radial-gradient') ? settings.background : undefined }}
    >
      <BackgroundParticles variant="dark" count={40} speedMultiplier={4} isPaused={false} />
      
      <div className="absolute top-0 left-0 right-0 h-16 md:h-24 bg-gradient-to-b from-black via-black/80 to-transparent z-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-16 md:h-24 bg-gradient-to-t from-black via-black/80 to-transparent z-20 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative z-30 mb-4 md:mb-6 mt-2 md:mt-4 flex flex-col items-center"
      >
        <h2 
          className={`${settings.titleSize} font-black uppercase tracking-tighter mb-2 flex flex-wrap justify-center`}
          style={{ color: settings.titleColor, textShadow: `0 0 15px ${settings.titleColor}80` }}
        >
          {titleLetters.map((letter, index) => (
            <motion.span
              key={index}
              style={{ display: "inline-block", whiteSpace: letter === " " ? "pre" : "normal" }}
              animate={{
                rotate: [0, -5, 5, -5, 5, 0],
                y: [0, -2, 2, -2, 2, 0],
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatDelay: 2,
                delay: index * 0.05,
                ease: "easeInOut"
              }}
            >
              {letter}
            </motion.span>
          ))}
        </h2>
        <div className="h-0.5 md:h-1 w-20 md:w-24 bg-primary mx-auto rounded-full shadow-[0_0_8px_#ef4444]" />
      </motion.div>

      <div className="relative w-full max-w-7xl h-[300px] md:h-[350px] mt-2 md:mt-4 overflow-hidden z-10">
        {isManualScroll ? (
          <div
            className="h-full overflow-y-auto px-2 md:px-4 pb-10 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div className="mx-auto max-w-5xl space-y-4 md:space-y-5 pt-1 pb-10">
              {baseLines.map((line, index) => (
                <p
                  key={index}
                  className={`${settings.textSize} font-bold leading-relaxed tracking-wide italic drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] px-2 whitespace-pre-wrap`}
                  style={{ color: settings.textColor }}
                >
                  {line}
                </p>
              ))}
              <div className="flex justify-center pt-8">
                <div className="h-0.5 w-full max-w-2xl bg-primary/40 rounded-full" />
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center">
            {/* Displaying paragraphs directly without require to view section */}
            {lines.map((line, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: -250, scale: 0.8 }}
                animate={{
                  opacity: [0, 0, 1, 1, 1, 0], // More precise fade in/out
                  y: [-250, -100, 150, 450, 1000, 1200], // Smooth flow
                  scale: [0.8, 0.9, 1.2, 1.4, 0.9, 0.7], // Scale peak at center
                }}
                transition={{
                  duration: ANIMATION_DURATION,
                  repeat: Infinity,
                  // Reduce gap after first paragraph by using a uniform delay calculation
                  delay: (index * lineDelayStep) - 16,
                  ease: "linear",
                }}
                className="absolute w-full px-4 flex items-center justify-center min-h-[80px] md:min-h-[100px] will-change-transform"
              >
                {line === "---" ? (
                  <div className="w-full max-w-3xl h-0.5 md:h-1 bg-primary/60 rounded-full shadow-[0_0_12px_#ef4444]" />
                ) : line === "" ? null : (
                  <p 
                  className={`${settings.textSize} font-bold leading-relaxed tracking-wide italic drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] max-w-5xl px-2 whitespace-pre-wrap`}
                  style={{ color: settings.textColor }}
                >
                  {line}
                </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
