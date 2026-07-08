import { useState, useEffect } from "react";
import { MapPin, Phone, Mail, Clock, MessageCircle, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

const groupBusinessHours = (days: any[]) => {
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

export const ContactSection = () => {
  const [settings, setSettings] = useState({
    contact_address: "H3-G16, Hanger 3, Old Cargo Complex Sultan Abdul Aziz Shah International Airport, 47200 Subang, Selangor.",
    contact_phone: "+603 7832 1799 | +603 9200 2998",
    contact_whatsapp: "+6011 6512 7889 | +6011 5503 2279",
    contact_email: "booking@onedaypilot.com",
    business_hours: [] as any[],
    google_maps_link: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3983.9405628555136!2d101.5638402749709!3d3.126300296849318!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31cc4fb75b62f44b%3A0x974f2192cd2dacda!2sOne%20Day%20Pilot%20Official!5e0!3m2!1sen!2smy!4v1707200000000!5m2!1sen!2smy",
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .in("key", [
          "contact_address", "contact_phone", "contact_whatsapp",
          "contact_email", "business_hours", "google_maps_link",
        ]);

      if (data) {
        const newSettings = { ...settings };
        data.forEach((s) => {
          if (s.key === "contact_address") newSettings.contact_address = s.value;
          if (s.key === "contact_phone") newSettings.contact_phone = s.value;
          if (s.key === "contact_whatsapp") newSettings.contact_whatsapp = s.value;
          if (s.key === "contact_email") newSettings.contact_email = s.value;
          if (s.key === "business_hours") {
            try { newSettings.business_hours = JSON.parse(s.value); }
            catch (e) { console.error("Error parsing business_hours:", e); }
          }
          if (s.key === "google_maps_link") newSettings.google_maps_link = s.value;
        });
        setSettings(newSettings);
      }
    };
    fetchSettings();
  }, []);

  const fadeUp = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
  };

  return (
    <section id="contact" className="relative py-24 md:py-32 overflow-hidden" style={{ background: 'linear-gradient(180deg, #F4F6FA 0%, #FAFBFC 100%)' }}>
      {/* Decorative grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(15,23,42,1) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="container mx-auto px-4 relative">
        <motion.div
          {...fadeUp}
          className="text-center mb-14 md:mb-20"
        >
          <div className="inline-flex items-center gap-3 mb-5">
            <span className="w-10 h-[1px] bg-[#CC1F1F]" />
            <span className="text-[#CC1F1F] text-[10px] font-bold tracking-[0.4em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Get In Touch
            </span>
            <span className="w-10 h-[1px] bg-[#CC1F1F]" />
          </div>
          <h2
            className="text-slate-900 mb-4 leading-none"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)',
              letterSpacing: '0.02em',
            }}
          >
            Talk To <span className="text-[#CC1F1F]">Ground Control</span>
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto text-[15px] leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Questions about your flight, gift vouchers, or custom experiences — we're cleared and ready to respond.
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Contact info — boarding pass card */}
            <motion.div
              {...fadeUp}
              className="lg:col-span-2 relative bg-white rounded-3xl border border-slate-200/70 overflow-hidden shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)]"
            >
              {/* Top runway stripe */}
              <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #CC1F1F 0%, #FF4444 50%, #CC1F1F 100%)' }} />

              {/* Boarding pass header */}
              <div className="px-7 pt-6 pb-5 border-b border-dashed border-slate-200 flex justify-between items-start">
                <div>
                  <span className="text-[9px] text-slate-400 tracking-[0.32em] uppercase block mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>OPS · Pass</span>
                  <h3 className="text-slate-900" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.03em' }}>
                    Operations Desk
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 tracking-[0.32em] uppercase block mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Gate</span>
                  <span className="text-[#CC1F1F] font-bold" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.05em' }}>H3</span>
                </div>
              </div>

              <div className="px-7 py-6 space-y-5">
                {/* Address */}
                <div className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-[#CC1F1F]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] text-slate-400 tracking-[0.3em] uppercase block mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Hangar</span>
                    <p className="text-sm text-slate-700 leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {settings.contact_address}
                    </p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-[#CC1F1F]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] text-slate-400 tracking-[0.3em] uppercase block mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Tower · Voice</span>
                    <p className="text-sm text-slate-700 font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {settings.contact_phone}
                    </p>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] text-emerald-600 tracking-[0.3em] uppercase block mb-1 font-bold" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>WhatsApp · Direct</span>
                    <p className="text-sm text-slate-700 font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {settings.contact_whatsapp}
                    </p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-[#CC1F1F]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] text-slate-400 tracking-[0.3em] uppercase block mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Email · Booking</span>
                    <a
                      href={`mailto:${settings.contact_email}`}
                      className="text-sm text-[#CC1F1F] font-semibold hover:underline inline-flex items-center gap-1 group"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      {settings.contact_email}
                      <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Perforation */}
              <div className="flex justify-between px-2 py-1">
                {Array.from({ length: 22 }).map((_, i) => (
                  <span key={i} className="w-1 h-1 rounded-full bg-slate-200" />
                ))}
              </div>

              {/* Business hours */}
              <div className="px-7 py-6 bg-slate-50/50 border-t border-dashed border-slate-200">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-3.5 h-3.5 text-[#CC1F1F]" />
                  <span className="text-[10px] text-slate-700 font-bold tracking-[0.32em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Operating Hours
                  </span>
                </div>
                <div className="space-y-2.5">
                  {settings.business_hours && settings.business_hours.length > 0 ? (
                    groupBusinessHours(settings.business_hours).map((group, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        <span className="text-slate-700 font-semibold">
                          {group.startDay === group.endDay
                            ? (shortDays[group.startDay] || group.startDay)
                            : `${shortDays[group.startDay] || group.startDay} – ${shortDays[group.endDay] || group.endDay}`}
                        </span>
                        <span className={group.isOpen ? "text-slate-500 font-mono text-[13px]" : "text-[#CC1F1F] font-bold uppercase text-[10px] tracking-[0.2em]"}>
                          {group.hours}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">Hours not configured</div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Map — large feature */}
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="lg:col-span-3 relative rounded-3xl border border-slate-200/70 overflow-hidden shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)] min-h-[500px] group"
            >
              {/* Map header strip */}
              <div className="absolute top-0 left-0 right-0 z-10 px-5 py-3 flex items-center justify-between bg-white/90 backdrop-blur-md border-b border-slate-200/70">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#CC1F1F] animate-pulse" />
                  <span className="text-[10px] text-slate-700 font-bold tracking-[0.3em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Live · Subang Airfield
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">WMSA</span>
              </div>

              <iframe
                src={settings.google_maps_link}
                width="100%"
                height="100%"
                style={{ border: 0, position: 'absolute', inset: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="grayscale-[0.15] contrast-[1.08] transition-all duration-700 group-hover:grayscale-0"
              />

              {/* Corner crosshairs */}
              <div className="absolute top-12 left-3 w-4 h-4 border-l-2 border-t-2 border-[#CC1F1F]/60 pointer-events-none" />
              <div className="absolute top-12 right-3 w-4 h-4 border-r-2 border-t-2 border-[#CC1F1F]/60 pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-l-2 border-b-2 border-[#CC1F1F]/60 pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-r-2 border-b-2 border-[#CC1F1F]/60 pointer-events-none" />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
