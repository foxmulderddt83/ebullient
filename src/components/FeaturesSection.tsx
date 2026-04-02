import { useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { BackgroundParticles } from "./ui/BackgroundParticles";
import experiencePilot from "@/assets/experience-pilot.jpg";
import experienceSpecial from "@/assets/experience-special.jpg";

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

const DEFAULT_FEATURES: Feature[] = [
  {
    icon_name: "Shield",
    title: "Expert & Professional Support Team",
    description:
      "Our team is made up of skilled, licensed instructors with real-world flying experience. From the moment you book to the time you land, our friendly and knowledgeable team is here to guide you every step of the way.",
  },
  {
    icon_name: "Award",
    title: "Trusted Since 2014 & Certified",
    description:
      "With over a decade of experience in the aviation industry, One Day Pilot has been a pioneer in offering thrilling and safe flight experiences. Our commitment to safety and customer satisfaction has earned us certification from relevant authorities.",
  },
  {
    icon_name: "Star",
    title: "Unmatched Experience",
    description:
      "More than just a joyride, One Day Pilot offers an immersive, hands-on introduction to aviation that leaves you with lasting memories and a unique story to tell.",
  },
];

type LucideIconType = keyof typeof LucideIcons;

export const FeaturesSection = () => {
  const [features, setFeatures] = useState<Feature[]>(DEFAULT_FEATURES);
  const [sectionTitle, setSectionTitle] = useState("Learn More About Our One Day Pilot Experience Program");
  const [sectionStyles, setSectionStyles] = useState<Record<string, any>>({});
  const [experienceYears, setExperienceYears] = useState("10+");
  const [sectionImages, setSectionImages] = useState({
    image1: experiencePilot,
    image2: experienceSpecial
  });
  const [bgGradient, setBgGradient] = useState<string | null>(null);
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);

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
    const fetchSettings = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from("site_settings")
        .select("key, value, style")
        .in("key", ["features_title", "experience_start_year", "features_image_1", "features_image_2", "bg_gradient_features"]);
      
      if (data) {
        const titleRow = data.find(s => s.key === "features_title");
        const title = titleRow?.value;
        const titleStyle = titleRow?.style;
        const startYear = data.find(s => s.key === "experience_start_year")?.value;
        const img1 = data.find(s => s.key === "features_image_1")?.value;
        const img2 = data.find(s => s.key === "features_image_2")?.value;
        const bgGrad = data.find(s => s.key === "bg_gradient_features")?.value;
        
        if (title) setSectionTitle(title);
        if (titleStyle) setSectionStyles({ features_title: titleStyle });
        if (bgGrad) setBgGradient(bgGrad);
        
        if (startYear) {
          const currentYear = new Date().getFullYear();
          const years = currentYear - parseInt(startYear);
          setExperienceYears(`${years}+`);
        }

        if (img1 || img2) {
          setSectionImages({
            image1: img1 || experiencePilot,
            image2: img2 || experienceSpecial
          });
        }
      }
    };

    const fetchFeatures = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from("features")
        .select("*")
        .order("order", { ascending: true });
      
      if (data && data.length > 0) {
        setFeatures(data as Feature[]);
      }
    };

    fetchSettings();
    fetchFeatures();
  }, []);

  return (
    <section
      id="experience"
      className="relative overflow-hidden py-16 md:py-24"
      style={{ background: bgGradient || "#06091a" }}
    >
      <BackgroundParticles variant="dark" isPaused={isGlobalPaused} />
      <div className="absolute top-0 right-0 h-px w-1/3 bg-gradient-to-l from-[#ea580c] to-transparent" />
      <div className="absolute bottom-0 left-0 h-px w-1/2 bg-gradient-to-r from-[#ea580c] via-[#facc15]/50 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#06091a] to-transparent" />
      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="h-[2px] w-10 bg-[#ea580c]" />
            <span
              className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ea580c]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Why Choose One Day Pilot
            </span>
            <div className="h-[2px] w-10 bg-[#ea580c]" />
          </div>
          <h2
            className="mb-4 text-4xl uppercase leading-none text-white md:text-6xl"
            style={{
              color: sectionStyles.features_title?.color || "#f8fafc",
              fontSize: sectionStyles.features_title?.fontSize,
              fontWeight: sectionStyles.features_title?.fontWeight,
              fontStyle: sectionStyles.features_title?.fontStyle,
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: "0.04em",
              textShadow: "0 8px 24px rgba(0,0,0,0.45)",
            }}
          >
            {sectionTitle}
          </h2>
          <p
            className="mx-auto max-w-2xl text-sm font-semibold uppercase tracking-[0.18em] text-white/60 md:text-base"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Precision-crafted experiences with cinematic views, guided confidence, and unforgettable flying moments.
          </p>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] xl:gap-12">
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-4 md:space-y-6"
            >
              <div
                className="overflow-hidden border border-white/10 bg-[#0b1327] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
                style={{ clipPath: "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))" }}
              >
                <img
                  src={sectionImages.image1}
                  alt="Pilot Experience"
                  className="h-56 w-full object-cover saturate-110 md:h-72"
                />
              </div>
              <div
                className="flex h-36 items-center justify-center border border-[#ea580c]/30 bg-gradient-to-br from-[#ea580c] to-[#c2410c] px-6 text-white shadow-[0_24px_60px_-20px_rgba(234,88,12,0.55)] md:h-44"
                style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))" }}
              >
                <div className="text-center">
                  <div
                    className="text-5xl leading-none md:text-6xl"
                    style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.06em" }}
                  >
                    {experienceYears}
                  </div>
                  <div
                    className="mt-2 text-xs font-black uppercase tracking-[0.35em] text-white/80"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    Years In The Sky
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="pt-8 md:pt-12"
            >
              <div
                className="relative overflow-hidden border border-white/10 bg-[#0b1327] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.75)]"
                style={{ clipPath: "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))" }}
              >
                <img
                  src={sectionImages.image2}
                  alt="Special Experience"
                  className="h-[26rem] w-full object-cover saturate-110 md:h-[34rem]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#06091a]/80 via-transparent to-transparent" />
              </div>
            </motion.div>
          </div>

          <div className="space-y-5">
            {features.map((feature, index) => {
              const iconKey = (feature.icon_name in LucideIcons ? feature.icon_name : "HelpCircle") as LucideIconType;
              const Icon = (LucideIcons as unknown as Record<LucideIconType, LucideIcon>)[iconKey] || LucideIcons.HelpCircle;

              return (
                <motion.div
                  key={feature.id || index}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="group cursor-pointer border border-white/10 bg-[#0b1327] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#ea580c]/50 hover:bg-[#0d1731] hover:shadow-[0_24px_60px_-24px_rgba(234,88,12,0.45)] md:p-6"
                  style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))" }}
                  onClick={() => {
                    trackEvent({
                      action_type: 'click',
                      entity_type: 'feature',
                      entity_id: feature.id || `feature-${index}`,
                      entity_name: feature.title
                    });
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-[#ea580c]/30 bg-[#ea580c]/12 text-[#ea580c] transition-all duration-300 group-hover:bg-[#ea580c] group-hover:text-white">
                      {feature.image_url ? (
                        <img
                          src={feature.image_url}
                          alt={feature.title}
                          className={`${feature.icon_size || 'w-7 h-7'} object-contain transition-transform duration-300 group-hover:scale-110`}
                        />
                      ) : (
                        <Icon
                          className={`${feature.icon_size || 'w-7 h-7'} transition-colors duration-300`}
                          style={{ color: feature.icon_color || undefined }}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span
                          className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ea580c]"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-[#ea580c]/60 to-transparent" />
                      </div>
                      <h3
                        className={`mb-2 text-2xl uppercase leading-tight text-white ${feature.text_size || ''}`}
                        style={{
                          color: feature.text_color || "#f8fafc",
                          fontFamily: "'Bebas Neue', sans-serif",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {feature.title}
                      </h3>
                      <p className="text-sm font-medium leading-relaxed text-white/70 md:text-[15px]">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
