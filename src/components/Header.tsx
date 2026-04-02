import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Menu, X, Phone, Mail, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { name: "About", href: "/about" },
  { name: "Packages", href: "/#booking" },
  { name: "Story Telling", href: "/#experience" },
  { name: "Services", href: "/#services" },
  { name: "Buzz Us", href: "/#contact" },
  { name: "Events", href: "/events" },
];

export const Header = () => {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState("");
  const [settings, setSettings] = useState({
    contact_phone: "+6011 6512 7889",
    contact_email: "booking@onedaypilot.com",
    site_logo_main: "",
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      const sections = navItems
        .filter(item => item.href.startsWith("/#"))
        .map(item => item.href.substring(2));
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom >= 150) {
            setActiveHash("#" + section);
            break;
          }
        }
      }
      if (window.scrollY < 100) setActiveHash("");
    };
    window.addEventListener("scroll", handleScroll);

    const fetchSettings = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .in("key", ["contact_phone", "contact_email", "site_logo_main", "site_title"]);
      if (data) {
        const newSettings = { ...settings };
        data.forEach((s) => {
          if (s.key === "contact_phone") newSettings.contact_phone = s.value;
          if (s.key === "contact_email") newSettings.contact_email = s.value;
          if (s.key === "site_logo_main") newSettings.site_logo_main = s.value;
          if (s.key === "site_title") (newSettings as any).site_title = s.value;
        });
        setSettings(newSettings);
        const logoUrl = newSettings.site_logo_main || "/logooneday.jpeg";
        const siteTitle = (newSettings as any).site_title || "OneDayPilot";
        document.title = siteTitle;
        const favicon = document.getElementById('favicon') as HTMLLinkElement;
        if (favicon) favicon.href = logoUrl;
        const appleIcon = document.getElementById('apple-touch-icon') as HTMLLinkElement;
        if (appleIcon) appleIcon.href = logoUrl;
        const ogImage = document.getElementById('og-image') as HTMLMetaElement;
        if (ogImage) ogImage.content = logoUrl;
        const twitterImage = document.getElementById('twitter-image') as HTMLMetaElement;
        if (twitterImage) twitterImage.content = logoUrl;
        const siteTitleEl = document.getElementById('site-title');
        if (siteTitleEl) siteTitleEl.innerText = siteTitle;
        const ogTitle = document.getElementById('og-title') as HTMLMetaElement;
        if (ogTitle) ogTitle.content = siteTitle;
      }
    };
    fetchSettings();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: isScrolled
          ? 'rgba(6, 9, 18, 0.96)'
          : 'linear-gradient(to bottom, rgba(6,9,18,0.85) 0%, transparent 100%)',
        backdropFilter: isScrolled ? 'blur(14px)' : 'none',
        borderBottom: isScrolled ? '1px solid rgba(234,88,12,0.3)' : '1px solid transparent',
        boxShadow: isScrolled ? '0 4px 30px rgba(0,0,0,0.5)' : 'none',
      }}
    >
      {/* Top accent bar */}
      {isScrolled && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent 0%, #ea580c 30%, #facc15 70%, transparent 100%)' }}
        />
      )}

      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">

          {/* ── Logo ── */}
          <a href="#home" className="flex items-center gap-3 group">
            <motion.img
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              src={settings.site_logo_main || "/logooneday.jpeg"}
              alt="OneDayPilot Logo"
              className="h-12 md:h-[60px] w-auto object-contain transition-all duration-300 group-hover:brightness-110"
            />
            {/* Brand text mark beside logo */}
            <div className="hidden xl:flex flex-col leading-none">
              <span
                className="text-white font-black tracking-widest text-[10px] uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.25em' }}
              >
                One Day
              </span>
              <span
                className="text-[#ea580c] font-black tracking-widest text-[18px] uppercase leading-none"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.1em' }}
              >
                PILOT
              </span>
            </div>
          </a>

          {/* ── Desktop Nav ── */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isHashLink = item.href.startsWith("/#");
              const isActive = isHashLink
                ? activeHash === item.href.substring(1)
                : location.pathname === item.href;

              return (
                <a
                  key={item.name}
                  href={item.href}
                  className="relative px-3 py-2 text-[11px] font-black tracking-[0.18em] uppercase transition-all duration-200 group"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: isActive ? '#ea580c' : 'rgba(255,255,255,0.85)',
                  }}
                >
                  {/* Hover underline */}
                  <span
                    className="absolute bottom-0 left-3 right-3 h-[2px] transition-all duration-300 origin-left"
                    style={{
                      background: 'linear-gradient(90deg, #ea580c, #facc15)',
                      transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
                    }}
                  />
                  <span className="relative z-10 group-hover:text-white transition-colors duration-200">
                    {item.name}
                  </span>
                </a>
              );
            })}
          </nav>

          {/* ── CTA + Contact ── */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href={`tel:${settings.contact_phone.replace(/\s+/g, '')}`}
              className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' }}
            >
              <Phone className="w-3.5 h-3.5 text-[#ea580c]" />
              <span>{settings.contact_phone}</span>
            </a>

            {/* BOOK NOW CTA — OXBOLD angled button */}
            <a
              href="/#booking"
              className="flex items-center gap-1.5 px-5 py-2.5 text-white font-black text-[11px] tracking-[0.2em] uppercase transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                background: '#ea580c',
                clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                boxShadow: '0 4px 20px -4px rgba(234,88,12,0.6)',
              }}
            >
              Book Now
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* ── Mobile Menu Button ── */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-white"
            style={{ lineHeight: 0 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isMobileMenuOpen ? (
                <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <X className="w-6 h-6" />
                </motion.div>
              ) : (
                <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Menu className="w-6 h-6" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* ── Mobile Menu ── */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="lg:hidden overflow-hidden"
              style={{
                background: 'rgba(6,9,18,0.98)',
                borderTop: '1px solid rgba(234,88,12,0.3)',
                borderBottom: '2px solid #ea580c',
              }}
            >
              <nav className="flex flex-col py-2">
                {navItems.map((item, i) => {
                  const isHashLink = item.href.startsWith("/#");
                  const isActive = isHashLink
                    ? activeHash === item.href.substring(1)
                    : location.pathname === item.href;
                  return (
                    <motion.a
                      key={item.name}
                      href={item.href}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-between px-5 py-3 text-[12px] font-black tracking-[0.2em] uppercase transition-all"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        color: isActive ? '#ea580c' : 'rgba(255,255,255,0.8)',
                        borderLeft: isActive ? '3px solid #ea580c' : '3px solid transparent',
                      }}
                    >
                      <span>{item.name}</span>
                      <ChevronRight className="w-4 h-4 opacity-40" />
                    </motion.a>
                  );
                })}

                {/* Mobile contact */}
                <div className="px-5 py-4 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <a
                    href={`tel:${settings.contact_phone.replace(/\s+/g, '')}`}
                    className="flex items-center gap-2 text-white/70 text-xs py-1.5"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    <Phone className="w-3.5 h-3.5 text-[#ea580c]" />
                    <span>{settings.contact_phone}</span>
                  </a>
                  <a
                    href={`mailto:${settings.contact_email}`}
                    className="flex items-center gap-2 text-white/70 text-xs py-1.5"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    <Mail className="w-3.5 h-3.5 text-[#ea580c]" />
                    <span>{settings.contact_email}</span>
                  </a>
                  <a
                    href="/#booking"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="mt-3 flex items-center justify-center gap-2 py-3 text-white font-black text-[12px] tracking-[0.2em] uppercase w-full"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      background: '#ea580c',
                      clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                    }}
                  >
                    Book Your Flight
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};
