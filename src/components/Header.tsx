import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { getSiteSettings } from "@/lib/siteSettings";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { Menu, X, Phone, Mail, ChevronRight, Plane, Home, Briefcase, Compass, Aperture, ShieldCheck, MessageSquare, Calendar, Award } from "lucide-react";

const DEFAULT_NAV_ITEMS = [
  { name: "Home", href: "/#home", icon: Home },
  // Was "/OneDayPilot Main.html" — a static file outside the SPA, so opening it
  // dropped the header and footer entirely. It is a real route now.
  { name: "Packages", href: "/packages", icon: Briefcase },
  { name: "Gallery", href: "/#sky", icon: Aperture },
  { name: "Services", href: "/#services", icon: ShieldCheck },
  { name: "Contact", href: "/#contact", icon: MessageSquare },
  { name: "Events", href: "/events", icon: Calendar },
  { name: "About", href: "/about", icon: Award },
];

// Hoisted: motion(Link) called during render would return a fresh component type
// every pass, remounting the nav item and restarting its entrance animation.
const MotionLink = motion(Link);

/**
 * True for in-app routes ("/about"), false for same-page anchors ("/#home"),
 * absolute URLs and any leftover static file links.
 */
const isRouteLink = (href: string) =>
  href.startsWith("/") && !href.startsWith("/#") && !href.includes(".html") && !href.startsWith("//");

export const Header = () => {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState("");
  const [navItems, setNavItems] = useState(DEFAULT_NAV_ITEMS);
  const [settings, setSettings] = useState({
    contact_phone: "+6011 6512 7889",
    contact_email: "booking@onedaypilot.com",
    site_logo_main: "",
  });

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
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
      const data = await getSiteSettings();

      if (data) {
        const newSettings = { ...settings };
        const navOrderSettings: Record<string, number> = {};

        data.forEach((s) => {
          if (s.key === "contact_phone") newSettings.contact_phone = s.value;
          if (s.key === "contact_email") newSettings.contact_email = s.value;
          if (s.key === "site_logo_main") newSettings.site_logo_main = s.value;
          if (s.key === "site_title") (newSettings as any).site_title = s.value;

          // Look for keys like nav_Home_index or nav_About_index
          if (s.key.startsWith("nav_") && s.key.endsWith("_index")) {
            const itemName = s.key.replace("nav_", "").replace("_index", "");
            navOrderSettings[itemName.toLowerCase()] = parseInt(s.value, 10);
          }
        });
        setSettings(newSettings);

        // Sort nav items based on index number
        const sortedNavItems = [...DEFAULT_NAV_ITEMS].sort((a, b) => {
          const orderA = navOrderSettings[a.name.toLowerCase()];
          const orderB = navOrderSettings[b.name.toLowerCase()];

          // If no index number then arrange at the last
          const valA = orderA !== undefined && !isNaN(orderA) ? orderA : 999999;
          const valB = orderB !== undefined && !isNaN(orderB) ? orderB : 999999;

          return valA - valB;
        });
        setNavItems(sortedNavItems);

        const logoUrl = newSettings.site_logo_main || "/logo.png";
        const siteTitle = (newSettings as any).site_title || "OneDayPilot";
        document.title = siteTitle;
        // The favicon and the touch icon are deliberately left alone. These
        // two looked up ids that index.html does not define, so they had never
        // run - and wiring them up would have swapped a real multi-size .ico
        // for logo.png, which is 263x191 and not square. The icons are static
        // and correct; rebuild them with `npm run favicon` if the logo changes.
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
      className="fixed top-0 left-0 right-0 z-50 transition-[background,backdrop-filter,box-shadow,border] duration-500"
      style={{
        background: isScrolled
          ? 'rgba(255,255,255,0.85)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
        backdropFilter: isScrolled ? 'blur(24px) saturate(180%)' : 'blur(8px)',
        WebkitBackdropFilter: isScrolled ? 'blur(24px) saturate(180%)' : 'blur(8px)',
        borderBottom: isScrolled ? '1px solid rgba(205,92,92,0.15)' : '1px solid transparent',
        boxShadow: isScrolled ? '0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 40px -12px rgba(15,23,42,0.08)' : 'none',
      }}
    >
      {/* Scroll progress — runway stripe */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[3px] origin-left z-[60]"
        style={{
          scaleX,
          background: 'linear-gradient(90deg, #CD5C5C 0%, #FFD700 50%, #CD5C5C 100%)',
          boxShadow: '0 0 10px rgba(205,92,92,0.5)',
        }}
      />

      <div className="max-w-[1920px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-[76px]">

          {/* ── Logo ── */}
          <a href="#home" className="flex items-center gap-3 group shrink-0">
            <motion.img
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              src={settings.site_logo_main || "/logo.png"}
              alt="OneDayPilot Logo"
              {...({ fetchpriority: "high" } as any)}
              decoding="async"
              width={220}
              height={56}
              className="h-11 md:h-[56px] w-auto object-contain transition-all duration-500 group-hover:scale-105 group-hover:rotate-[-2deg]"
            />
            <div className={`hidden lg:flex flex-col leading-none pl-1 border-l ${isScrolled ? 'border-slate-200/70' : 'border-white/30'}`}>
              <span
                className={`font-medium tracking-[0.32em] text-[9px] uppercase pl-3 transition-colors duration-500 ${isScrolled ? 'text-slate-500' : 'text-slate-400'}`}
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Est. Subang · KUL
              </span>
              <span
                className={`font-black tracking-[0.18em] text-[15px] uppercase leading-none pl-3 mt-0.5 transition-colors duration-500 ${isScrolled ? 'text-slate-900' : 'text-slate-400'}`}
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                Flight Experience
              </span>
            </div>
          </a>

          {/* ── Desktop Nav ── */}
          <nav className="hidden lg:flex items-center gap-0.5 bg-white/40 border border-slate-200/60 rounded-full px-2 py-1.5 backdrop-blur-sm mx-6">
            {navItems.map((item) => {
              const isHashLink = item.href.startsWith("/#");
              const isActive = isHashLink
                ? activeHash === item.href.substring(1)
                : location.pathname === item.href;

              // Route links go through the router so the destination page can play
              // its entrance transition; a plain <a> would hard-reload and lose it.
              const Tag: any = isRouteLink(item.href) ? Link : "a";
              const linkProps = isRouteLink(item.href) ? { to: item.href } : { href: item.href };

              return (
                <Tag
                  key={item.name}
                  {...linkProps}
                  className="relative px-4 py-2 text-[11px] font-bold tracking-[0.16em] uppercase transition-all duration-300 group rounded-full flex items-center gap-2.5"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: isActive ? '#ffffff' : '#0f172a',
                    background: isActive ? '#CD5C5C' : 'transparent',
                    boxShadow: isActive ? '0 4px 16px -4px rgba(205,92,92,0.5), inset 0 1px 0 rgba(255,255,255,0.25)' : 'none',
                  }}
                >
                  <item.icon className={`w-3.5 h-3.5 relative z-10 transition-colors duration-200 ${isActive ? 'text-[#FFD700]' : 'text-[#D4AF37] group-hover:text-[#FFD700]'}`} />
                  <span className="relative z-10 group-hover:text-[#CD5C5C] transition-colors duration-200" style={isActive ? { color: '#fff' } : undefined}>
                    {item.name}
                  </span>
                  {!isActive && (
                    <span className="absolute inset-x-3 bottom-1 h-px bg-[#CD5C5C] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                  )}
                </Tag>
              );
            })}
          </nav>

          {/* ── CTA + Contact ── */}
          <div className="hidden lg:flex items-center gap-6 shrink-0">
            <a
              href={`tel:${settings.contact_phone.replace(/\s+/g, '')}`}
              className={`flex items-center gap-2 transition-colors text-xs group whitespace-nowrap ${isScrolled ? 'text-slate-900 hover:text-slate-700' : 'text-slate-400 hover:text-slate-500'}`}
              style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.08em' }}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0 ${isScrolled ? 'bg-slate-100 border border-slate-200 group-hover:bg-slate-200' : 'bg-white/10 border border-white/20 group-hover:bg-white/20'}`}>
                <Phone className="w-3 h-3 text-[#FFD700]" />
              </span>
              <span className="font-semibold">{settings.contact_phone}</span>
            </a>

            <a
              href="/#booking"
              className="relative flex items-center gap-2 pl-5 pr-2 py-2 text-white font-bold text-[11px] tracking-[0.18em] uppercase transition-all duration-300 rounded-full overflow-hidden group hover:shadow-[0_8px_24px_-6px_rgba(205,92,92,0.55)] whitespace-nowrap"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                background: 'linear-gradient(135deg, #CD5C5C 0%, #8B3A3A 100%)',
                boxShadow: '0 4px 14px -3px rgba(205,92,92,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
            >
              <span className="relative z-10">Book Flight</span>
              <span className="relative z-10 w-6 h-6 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors shrink-0">
                <Plane className="w-3 h-3 text-[#FFD700] -rotate-45 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </a>
          </div>

          {/* ── Mobile Menu Button ── */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`lg:hidden p-2 rounded-full transition-all duration-300 ${isScrolled ? 'text-slate-800 bg-white/60 border border-slate-200/60' : 'text-white bg-white/10 border border-white/20'} backdrop-blur-sm`}
            style={{ lineHeight: 0 }}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isMobileMenuOpen ? (
                <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <X className="w-5 h-5" />
                </motion.div>
              ) : (
                <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Menu className="w-5 h-5" />
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
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="lg:hidden overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.98)',
                backdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(205,92,92,0.12)',
              }}
            >
              {/* Boarding-pass perforation */}
              <div className="flex justify-between px-3 py-2 border-b border-dashed border-slate-200">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span key={i} className="w-1 h-1 rounded-full bg-slate-200" />
                ))}
              </div>

              <nav className="flex flex-col py-3">
                {navItems.map((item, i) => {
                  const isHashLink = item.href.startsWith("/#");
                  const isActive = isHashLink
                    ? activeHash === item.href.substring(1)
                    : location.pathname === item.href;
                  const MotionTag: any = isRouteLink(item.href) ? MotionLink : motion.a;
                  const linkProps = isRouteLink(item.href) ? { to: item.href } : { href: item.href };
                  return (
                    <MotionTag
                      key={item.name}
                      {...linkProps}
                      initial={{ x: -16, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-between px-6 py-3.5 text-[13px] font-bold tracking-[0.18em] uppercase transition-all"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        color: isActive ? '#CD5C5C' : '#0f172a',
                        background: isActive ? 'linear-gradient(90deg, rgba(205,92,92,0.06), transparent)' : 'transparent',
                        borderLeft: isActive ? '2px solid #CD5C5C' : '2px solid transparent',
                      }}
                    >
                      <span className="flex items-center gap-4">
                        <item.icon className={`w-4 h-4 ${isActive ? 'text-[#CD5C5C]' : 'text-slate-400'}`} />
                        {item.name}
                      </span>
                      <ChevronRight className="w-4 h-4 opacity-30" />
                    </MotionTag>
                  );
                })}

                <div className="px-6 py-5 mt-1 space-y-3 border-t border-dashed border-slate-200">
                  <a
                    href={`tel:${settings.contact_phone.replace(/\s+/g, '')}`}
                    className="flex items-center gap-3 text-slate-700 text-xs"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' }}
                  >
                    <span className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center">
                      <Phone className="w-3 h-3 text-[#CD5C5C]" />
                    </span>
                    <span className="font-semibold">{settings.contact_phone}</span>
                  </a>
                  <a
                    href={`mailto:${settings.contact_email}`}
                    className="flex items-center gap-3 text-slate-700 text-xs"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' }}
                  >
                    <span className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center">
                      <Mail className="w-3 h-3 text-[#CD5C5C]" />
                    </span>
                    <span className="font-semibold">{settings.contact_email}</span>
                  </a>
                  <a
                    href="/#booking"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="mt-3 flex items-center justify-center gap-2 py-3.5 text-white font-bold text-[12px] tracking-[0.2em] uppercase w-full rounded-full"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      background: 'linear-gradient(135deg, #CD5C5C 0%, #8B3A3A 100%)',
                      boxShadow: '0 6px 20px -6px rgba(205,92,92,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
                    }}
                  >
                    Book Your Flight
                    <Plane className="w-4 h-4 -rotate-45" />
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
