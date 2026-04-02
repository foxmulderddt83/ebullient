import { useState, useEffect, useMemo, forwardRef, ElementRef, ComponentPropsWithoutRef } from "react";
import { Facebook, Instagram, Youtube, MapPin, Clock, BookOpen, Music, Phone, Mail, X, Star, MousePointer2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal, DialogOverlay, DialogDescription } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { BackgroundParticles } from "./ui/BackgroundParticles";
import { trackEvent } from "@/lib/analytics";
import TermsText from "../../Terms & Conditions.txt?raw";
import PrivacyText from "../../Privacy Policy.txt?raw";
import RefundText from "../../Sales & Refund Policy.txt?raw";


const PolicyDialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1 bg-white/10 text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900 disabled:pointer-events-none z-50">
        <X className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
PolicyDialogContent.displayName = DialogPrimitive.Content.displayName;

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47-.13-.08-.26-.17-.39-.26V14.9c.06 3.15-1.48 6.33-4.39 7.64-2.32 1.07-5.16 1.05-7.4-.19-2.23-1.24-3.77-3.73-3.81-6.28-.02-2.91 1.65-5.83 4.31-7.01 1.07-.48 2.24-.69 3.41-.69V12.4c-.9.01-1.84.26-2.58.79-.97.7-1.44 1.94-1.23 3.13.15 1.12.98 2.14 2.06 2.47 1.13.35 2.45.1 3.29-.73.81-.8 1.02-2.02.95-3.11V0z" />
  </svg>
);

const RedIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M12 6v10" />
    <path d="M8 10h8" />
  </svg>
);

const footerLinks = [
  { name: "Home", href: "/" },
  { name: "About", href: "/about" },
  { name: "Packages", href: "/#services" },
  { name: "Story Telling", href: "/#experience" },
];

interface BusinessHour {
  day: string;
  isOpen: boolean;
  hours: string;
}

const groupBusinessHours = (days: BusinessHour[]) => {
  if (!days || days.length === 0) return [];

  const groups = [];
  let currentGroup = {
    startDay: days[0].day,
    endDay: days[0].day,
    hours: days[0].isOpen ? days[0].hours : "Closed",
    isOpen: days[0].isOpen
  };

  for (let i = 1; i < days.length; i++) {
    const day = days[i];
    const hours = day.isOpen ? day.hours : "Closed";

    if (hours === currentGroup.hours) {
      currentGroup.endDay = day.day;
    } else {
      groups.push(currentGroup);
      currentGroup = {
        startDay: day.day,
        endDay: day.day,
        hours: hours,
        isOpen: day.isOpen
      };
    }
  }
  groups.push(currentGroup);
  return groups;
};

const shortDays: Record<string, string> = {
  "Monday": "Mon", "Tuesday": "Tue", "Wednesday": "Wed", "Thursday": "Thu", "Friday": "Fri", "Saturday": "Sat", "Sunday": "Sun"
};

export const Footer = () => {
  const [settings, setSettings] = useState({
    social_facebook: "#",
    social_instagram: "#",
    social_youtube: "#",
    social_tiktok: "#",
    social_red: "#",
    contact_address: "Aerotree Flight Services Hangar 2, SAAS International Airport, 47200 Subang, Selangor Darul Ehsan, Malaysia.",
    contact_address_sales: "Lot 9.1A - 11.1A, 1st Floor, Jalan Perdana 4/8, Pandan Perdana, 55300 Kuala Lumpur, Wilayah Persekutuan, Malaysia.",
    contact_phone: "+603 9200 2998",
    contact_hotline: "+6011 6512 7889",
    contact_whatsapp: "+6011 6512 7889 | +6011 5503 2279",
    contact_email: "booking@onedaypilot.com",
    business_hours: [] as BusinessHour[],
    google_maps_link: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3983.9405628555136!2d101.5638402749709!3d3.126300296849318!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31cc4fb75b62f44b%3A0x974f2192cd2dacda!2sOne%20Day%20Pilot%20Official!5e0!3m2!1sen!2smy!4v1707200000000!5m2!1sen!2smy",
    policy_terms: "",
    policy_privacy: "",
    policy_refund: "",
    site_logo_main: "",
    bottom_main_page_bg_color: "#1a1a1a",
    bg_gradient_footer: "",
  });

  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyTitle, setPolicyTitle] = useState<string>("");
  const [policyContent, setPolicyContent] = useState<string>("");
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

  // Split content into readable paragraphs while keeping symbols/emojis intact
  const formattedPolicy = useMemo(() => {
    if (!policyContent) return null;

    // Check if content is HTML (from rich text editor)
    if (policyContent.trim().startsWith('<')) {
      return <div dangerouslySetInnerHTML={{ __html: policyContent }} />;
    }

    const getEmoji = (text: string) => {
      const lower = text.toLowerCase();
      if (lower.includes("welcome")) return "👋 ";
      if (lower.includes("general")) return "🌐 ";
      if (lower.includes("data")) return "💾 ";
      if (lower.includes("security")) return "🛡️ ";
      if (lower.includes("payment")) return "💳 ";
      if (lower.includes("cancellation") || lower.includes("refund")) return "💸 ";
      if (lower.includes("contact")) return "📞 ";
      if (lower.includes("law") || lower.includes("governing")) return "⚖️ ";
      if (lower.includes("intellectual")) return "🧠 ";
      if (lower.includes("cookies")) return "🍪 ";
      if (lower.includes("prohibited")) return "🚫 ";
      if (lower.includes("limitation")) return "🛑 ";
      if (lower.includes("disclaimer")) return "⚠️ ";
      if (lower.includes("modification")) return "✏️ ";
      return "";
    };

    const blocks = policyContent.split(/\r?\n\s*\r?\n/).map(b => b.trim()).filter(Boolean);
    return blocks.map((block, idx) => (
      <p key={idx} className="mb-4 leading-7 tracking-wide font-semibold text-slate-700">
        {block.split(/\r?\n/).map((line, i) => {
          // Detect if line is likely a header (all caps or short and ends with colon)
          const isHeader = (line.length < 100 && line === line.toUpperCase() && /[A-Z]/.test(line)) || line.trim().endsWith(":");
          const emoji = isHeader || i === 0 ? getEmoji(line) : "";
          
          return (
            <span key={i} className={`block ${isHeader ? "text-slate-900 font-extrabold text-lg mt-4 mb-2" : ""}`}>
              {emoji}{line}
            </span>
          );
        })}
      </p>
    ));
  }, [policyContent]);

  const openPolicy = (title: string, content: string) => {
    setPolicyTitle(title);
    setPolicyContent(content);
    setPolicyOpen(true);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .in("key", [
          "social_facebook",
          "social_instagram",
          "social_youtube",
          "social_tiktok",
          "social_red",
          "contact_address",
          "contact_address_sales",
          "contact_phone",
          "contact_hotline",
          "contact_whatsapp",
          "contact_email",
          "business_hours",
          "google_maps_link",
          "policy_terms",
          "policy_privacy",
          "policy_refund",
          "site_logo_main",
          "bottom_main_page_bg_color",
          "bg_gradient_footer"
        ]);

      if (data) {
        const newSettings = { ...settings };
        data.forEach((s) => {
          if (s.key === "social_facebook") newSettings.social_facebook = s.value;
          if (s.key === "social_instagram") newSettings.social_instagram = s.value;
          if (s.key === "social_youtube") newSettings.social_youtube = s.value;
          if (s.key === "social_tiktok") newSettings.social_tiktok = s.value;
          if (s.key === "social_red") newSettings.social_red = s.value;
          if (s.key === "contact_address") newSettings.contact_address = s.value;
          if (s.key === "contact_address_sales") newSettings.contact_address_sales = s.value;
          if (s.key === "contact_phone") newSettings.contact_phone = s.value;
          if (s.key === "contact_hotline") newSettings.contact_hotline = s.value;
          if (s.key === "contact_whatsapp") newSettings.contact_whatsapp = s.value;
          if (s.key === "contact_email") newSettings.contact_email = s.value;
          if (s.key === "business_hours") {
            try {
              newSettings.business_hours = JSON.parse(s.value);
            } catch (e) {
              console.error("Error parsing business_hours:", e);
            }
          }
          if (s.key === "google_maps_link") newSettings.google_maps_link = s.value;
          if (s.key === "policy_terms") newSettings.policy_terms = s.value;
          if (s.key === "policy_privacy") newSettings.policy_privacy = s.value;
          if (s.key === "policy_refund") newSettings.policy_refund = s.value;
          if (s.key === "site_logo_main") newSettings.site_logo_main = s.value;
          if (s.key === "bottom_main_page_bg_color") newSettings.bottom_main_page_bg_color = s.value;
          if (s.key === "bg_gradient_footer") newSettings.bg_gradient_footer = s.value;
        });
        setSettings(newSettings);
      }
    };

    fetchSettings();
  }, []);

  const socialLinks = [
    { icon: Youtube, href: settings.social_youtube, label: "YouTube", color: "text-[#FF0000]", hoverBg: "hover:bg-[#FF0000]/20", glowColor: "rgba(255, 0, 0, 0.5)" },
    { icon: Instagram, href: settings.social_instagram, label: "Instagram", color: "text-[#E4405F]", hoverBg: "hover:bg-[#E4405F]/20", glowColor: "rgba(228, 64, 95, 0.5)" },
    { icon: Facebook, href: settings.social_facebook, label: "Facebook", color: "text-[#1877F2]", hoverBg: "hover:bg-[#1877F2]/20", glowColor: "rgba(24, 119, 242, 0.5)" },
    { icon: TikTokIcon, href: settings.social_tiktok, label: "TikTok", color: "text-[#00f2ea]", hoverBg: "hover:bg-[#00f2ea]/20", glowColor: "rgba(0, 242, 234, 0.5)" },
    { icon: RedIcon, href: settings.social_red, label: "Red", color: "text-[#ff2442]", hoverBg: "hover:bg-[#ff2442]/20", glowColor: "rgba(255, 36, 66, 0.5)" },
  ];

  return (
    <footer id="contact" className="py-16 relative overflow-hidden" style={{ background: settings.bg_gradient_footer || settings.bottom_main_page_bg_color }}>
      <BackgroundParticles variant="dark" isPaused={isGlobalPaused} />
      <div className="absolute top-0 right-0 h-px w-1/3 bg-gradient-to-l from-[#ea580c] to-transparent" />
      <div className="absolute bottom-0 left-0 h-px w-1/2 bg-gradient-to-r from-[#ea580c] via-[#facc15]/50 to-transparent" />
      <div className="container mx-auto px-4">
        <div
          className="group relative overflow-hidden border border-white/10 bg-[#08101f] p-0 shadow-[0_28px_90px_-35px_rgba(0,0,0,0.95)] backdrop-blur-md"
          style={{ clipPath: "polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px))" }}
        >
          <div className="absolute -mr-32 -mt-32 h-64 w-64 rounded-full bg-[#ea580c]/10 blur-3xl transition-colors group-hover:bg-[#ea580c]/15" />
          
          <div className="absolute -top-12 -left-12 w-64 md:w-96 opacity-15 pointer-events-none transform rotate-[15deg] scale-x-[-1] group-hover:translate-x-4 group-hover:translate-y-4 transition-all duration-1000 ease-out z-0">
            <img src="/airplane_transparent.svg" alt="" className="w-full h-auto filter brightness-0" />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch relative z-10">
            {/* Left Side: Contact Info */}
            <div className="p-8 md:p-12 space-y-12">
              {/* Logo & Description */}
              <div className="space-y-6">
                <div className="flex items-center">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="p-0 rounded-xl"
                  >
                    <img 
                       src={settings.site_logo_main || "/logooneday.jpeg"} 
                       alt="OneDayPilot" 
                       className="h-14 md:h-[72px] w-auto object-contain" 
                       style={!settings.site_logo_main ? { filter: "url(#remove-black-bg)" } : {}}
                     />
                  </motion.div>
                </div>
                <div className="space-y-3">
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ea580c]"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    Ready For Takeoff
                  </span>
                  <p className="max-w-md text-white/70 text-sm leading-relaxed">
                  Experience the thrill of flying - no license required! Join us for an unforgettable journey above the clouds.
                  </p>
                </div>
                <div className="relative group/subscribe mb-4">
                  <motion.div
                    animate={!isGlobalPaused ? {
                      scale: [1, 1.05, 1],
                    } : {}}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="relative flex cursor-pointer items-center gap-2 overflow-hidden border border-[#ea580c]/35 bg-[#ea580c] px-5 py-3 text-[13px] font-black uppercase tracking-[0.22em] text-white shadow-[0_18px_50px_-18px_rgba(234,88,12,0.6)]"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))" }}
                  >
                    {/* Shine Effect */}
                    <motion.div
                      animate={!isGlobalPaused ? {
                        left: ["-100%", "200%"],
                      } : {}}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear",
                        repeatDelay: 1
                      }}
                      className="absolute top-0 h-full w-12 bg-white/30 skew-x-[-25deg] blur-sm z-10"
                    />

                    {/* Star Loop Animations */}
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={!isGlobalPaused ? {
                          opacity: [0, 1, 0],
                          scale: [0, 1, 0],
                          x: [0, (i - 1) * 30],
                          y: [0, -30 - (i * 10)],
                        } : {}}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.4,
                          ease: "easeOut"
                        }}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      >
                        <Star className="w-3 h-3 fill-[#facc15] text-[#facc15]" />
                      </motion.div>
                    ))}

                    <Youtube className="w-5 h-5 fill-white stroke-none relative z-20" />
                    <span className="relative z-20 tracking-[0.22em]">Subscribe</span>
                    <motion.div
                      animate={!isGlobalPaused ? {
                        scale: [1, 1.2, 1],
                        rotate: [0, -10, 0],
                        x: [0, 2, 0],
                        y: [0, -2, 0]
                      } : {}}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="relative z-20 ml-1"
                    >
                      <MousePointer2 className="w-4 h-4 fill-white text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]" />
                    </motion.div>
                  </motion.div>
                </div>
                <div className="flex gap-3">
                  {socialLinks.map((social, index) => {
                    const Icon = social.icon;
                    return (
                      <motion.a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackEvent({
                          action_type: 'click',
                          entity_type: 'custom',
                          entity_id: `social_${social.label.toLowerCase()}`,
                          entity_name: `Social Link: ${social.label}`
                        })}
                        aria-label={social.label}
                        animate={!isGlobalPaused ? {
                          boxShadow: [
                            `0 0 0px ${social.glowColor}`,
                            `0 0 12px ${social.glowColor}`,
                            `0 0 0px ${social.glowColor}`
                          ],
                          filter: [
                            "brightness(1)",
                            "brightness(1.2)",
                            "brightness(1)"
                          ]
                        } : {}}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: index * 0.2 // Stagger the animation
                        }}
                        className={`flex h-10 w-10 items-center justify-center border border-white/10 bg-white/[0.04] ${social.color} ${social.hoverBg} shadow-sm transition-all duration-300 hover:scale-110`}
                        style={{ clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}
                      >
                        <Icon className="w-5 h-5" />
                      </motion.a>
                    );
                  })}
                </div>
              </div>

              {/* Contact Details Grid */}
              <div className="max-w-md mx-auto">
                {/* Business Hours */}
                <div className="group/hours relative overflow-hidden border border-white/10 bg-white/[0.04] p-6 transition-all duration-300 hover:bg-white/[0.07]">
                  <h3 className="mb-4 flex items-center gap-2 text-2xl uppercase text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>
                    <Clock className="w-5 h-5 text-[#ea580c]" />
                    Business Hours
                  </h3>
                  <div className="space-y-2 text-sm text-white/60">
                    {settings.business_hours && settings.business_hours.length > 0 ? (
                      groupBusinessHours(settings.business_hours).map((group, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>
                            {group.startDay === group.endDay
                              ? (shortDays[group.startDay] || group.startDay)
                              : `${shortDays[group.startDay] || group.startDay} - ${shortDays[group.endDay] || group.endDay}`}
                          </span>
                          <span className={group.isOpen ? "text-white/80" : "text-red-400 font-semibold"}>
                            {group.hours}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-white/60">Hours not configured</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Map & Images */}
            <div className="relative min-h-[400px] overflow-hidden border-t border-white/10 lg:min-h-full lg:border-l lg:border-t-0">
              <iframe
                src={settings.google_maps_link}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="grayscale-[0.2] contrast-[1.1] hover:grayscale-0 transition-all duration-700"
              />
              {/* Image Overlay Panel */}
              <div className="absolute bottom-6 right-6 flex gap-3 z-20 pointer-events-none">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="h-24 w-24 overflow-hidden border border-white/20 shadow-xl transition-transform duration-300 hover:-translate-y-2 pointer-events-auto"
                  style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))" }}
                >
                  <img src="https://images.unsplash.com/photo-1569154941061-e231b4725ef1?q=80&w=200&auto=format&fit=crop" alt="Flight" className="w-full h-full object-cover" />
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="h-24 w-24 overflow-hidden border border-white/20 shadow-xl transition-transform duration-300 delay-75 hover:-translate-y-2 pointer-events-auto"
                  style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))" }}
                >
                  <img src="https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?q=80&w=200&auto=format&fit=crop" alt="Pilot" className="w-full h-full object-cover" />
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Official Footer Info Section */}
        <div className="relative mt-16 overflow-visible border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm md:p-12">
          <div className="pointer-events-none absolute -left-3 -top-7 z-50 -rotate-2 scale-100 transform md:scale-110">
            <div className="relative flex items-center">
              <div className="h-10 w-1.5 bg-[#006837] shadow-lg" />
              <motion.div 
                animate={!isGlobalPaused ? { 
                  boxShadow: [
                    "0 0 0px rgba(237, 28, 36, 0)",
                    "0 0 15px rgba(237, 28, 36, 0.8)",
                    "0 0 25px rgba(237, 28, 36, 0.4)",
                    "0 0 15px rgba(237, 28, 36, 0.8)",
                    "0 0 0px rgba(237, 28, 36, 0)"
                  ],
                  filter: [
                    "brightness(1)",
                    "brightness(1.2)",
                    "brightness(1)"
                  ]
                } : {}}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="flex items-center justify-center bg-[#ed1c24] px-5 py-2 shadow-2xl"
              >
                <span 
                  className="whitespace-nowrap text-lg font-black uppercase tracking-[0.18em] text-white md:text-xl" 
                  style={{ 
                    fontFamily: "'Barlow Condensed', sans-serif",
                    textShadow: '1px 1px 2px rgba(0,0,0,0.2)'
                  }}
                >
                  Get in Touch
                </span>
              </motion.div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {/* Column 1: Address */}
            <div className="space-y-6">
              <h4 className="flex items-center gap-2 text-2xl uppercase text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>
                <MapPin className="w-5 h-5 text-[#ea580c]" />
                Our Locations
              </h4>
              <div className="space-y-6">
                <div className="space-y-2 group">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40 transition-colors group-hover:text-[#ea580c]">Sales Office</p>
                  <p className="text-white/70 text-sm leading-relaxed group-hover:text-white transition-colors">
                    {settings.contact_address_sales}
                  </p>
                </div>
                <div className="space-y-2 group">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40 transition-colors group-hover:text-[#ea580c]">Flight Operations</p>
                  <p className="text-white/70 text-sm leading-relaxed group-hover:text-white transition-colors">
                    {settings.contact_address}
                  </p>
                </div>
              </div>
            </div>

            {/* Column 2: Contact & Links */}
            <div className="space-y-6">
              <h4 className="flex items-center gap-2 text-2xl uppercase text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>
                <Phone className="w-5 h-5 text-[#ea580c]" />
                Contact & Info
              </h4>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <a href={`tel:${settings.contact_hotline}`} className="flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-[#ea580c]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ea580c]/70"></span>
                    Hotline: {settings.contact_hotline}
                  </a>
                  <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-[#ea580c]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ea580c]/70"></span>
                    {settings.contact_email}
                  </a>
                </div>
                
                <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
                  <button 
                    type="button"
                    onClick={() => openPolicy("Terms & Conditions", settings.policy_terms || TermsText)}
                    className="text-left text-white/50 hover:text-white text-sm transition-colors flex items-center gap-2"
                  >
                    <span className="w-1 h-1 rounded-full bg-white/20"></span>
                    Terms & Conditions
                  </button>
                  <button 
                    type="button"
                    onClick={() => openPolicy("Privacy Policy", settings.policy_privacy || PrivacyText)}
                    className="text-left text-white/50 hover:text-white text-sm transition-colors flex items-center gap-2"
                  >
                    <span className="w-1 h-1 rounded-full bg-white/20"></span>
                    Privacy Policy
                  </button>
                  <button 
                    type="button"
                    onClick={() => openPolicy("Refund Policy", settings.policy_refund || RefundText)}
                    className="text-left text-white/50 hover:text-white text-sm transition-colors flex items-center gap-2"
                  >
                    <span className="w-1 h-1 rounded-full bg-white/20"></span>
                    Refund Policy
                  </button>
                </div>
              </div>
            </div>

            {/* Column 3: Social & Branding */}
            <div className="space-y-6">
              <h4 className="flex items-center gap-2 text-2xl uppercase text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>
                <Music className="w-5 h-5 text-[#ea580c]" />
                Connect With Us
              </h4>
              <div className="space-y-4">
                <p className="text-white/60 text-sm leading-relaxed">
                  Follow our aviation adventures on social media. Tag us in your photos with #OneDayPilot!
                </p>
                <div className="flex flex-wrap gap-3">
                  {socialLinks.map((social, index) => {
                    const Icon = social.icon;
                    return (
                      <motion.a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackEvent({
                          action_type: 'click',
                          entity_type: 'custom',
                          entity_id: `social_bottom_${social.label.toLowerCase()}`,
                          entity_name: `Social Link (Bottom): ${social.label}`
                        })}
                        aria-label={social.label}
                        animate={!isGlobalPaused ? {
                          boxShadow: [
                            `0 0 0px ${social.glowColor}`,
                            `0 0 12px ${social.glowColor}`,
                            `0 0 0px ${social.glowColor}`
                          ],
                          filter: [
                            "brightness(1)",
                            "brightness(1.2)",
                            "brightness(1)"
                          ]
                        } : {}}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: index * 0.2
                        }}
                        className={`flex h-10 w-10 items-center justify-center border border-white/10 bg-white/[0.04] ${social.color} ${social.hoverBg} shadow-sm transition-all duration-300 hover:scale-110`}
                        style={{ clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}
                      >
                        <Icon className="w-4 h-4" />
                      </motion.a>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-center md:flex-row">
          <p className="text-secondary-foreground/40 text-xs tracking-wide">
            © {new Date().getFullYear()} ONEDAYPILOT. ALL RIGHTS RESERVED.
          </p>
          <Link 
            to="/admin" 
            className="text-xs font-medium uppercase tracking-[0.24em] text-white/25 transition-colors hover:text-[#ea580c]"
          >
            Admin Access
          </Link>
        </div>
      </div>
      {/* Policy Dialog */}
      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <PolicyDialogContent className="max-w-3xl w-[92vw] p-0 overflow-hidden bg-white text-slate-900">
          <DialogHeader className="p-4 md:p-6 border-b bg-slate-900 text-white">
            <DialogTitle className="text-base md:text-lg font-bold text-white flex items-center gap-2">
              {policyTitle === "Terms & Conditions" && "📜"}
              {policyTitle === "Privacy Policy" && "🔒"}
              {policyTitle === "Refund Policy" && "💸"}
              {policyTitle}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Read our {policyTitle} to understand your rights and responsibilities.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 md:p-6 max-h-[70vh] overflow-y-auto">
            <div className="prose prose-sm md:prose-base max-w-none text-slate-800">
              {formattedPolicy}
            </div>
          </div>
        </PolicyDialogContent>
      </Dialog>
    </footer>
  );
};
