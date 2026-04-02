import { useState, useEffect } from "react";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
          "contact_address",
          "contact_phone",
          "contact_whatsapp",
          "contact_email",
          "business_hours",
          "google_maps_link",
        ]);

      if (data) {
        const newSettings = { ...settings };
        data.forEach((s) => {
          if (s.key === "contact_address") newSettings.contact_address = s.value;
          if (s.key === "contact_phone") newSettings.contact_phone = s.value;
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
        });
        setSettings(newSettings);
      }
    };

    fetchSettings();
  }, []);

  return (
    <section id="contact" className="section-padding bg-transparent">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="section-title font-heading mb-4">Buzz Us</h2>
          <p className="section-subtitle">
            Feel free to ask for details, don't save any questions!
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10">
            {/* Contact Information */}
            <div className="space-y-10 bg-card/40 p-8 rounded-2xl border border-black shadow-soft">
              {/* Office */}
              <div className="relative">
                <div className="absolute -left-4 top-0 w-1 h-8 bg-accent/40 rounded-full" />
                <h3 className="text-2xl font-heading font-bold mb-6 flex items-center gap-3">
                  Our <span className="text-accent">Office</span>
                </h3>
                <div className="space-y-5">
                  <div className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-accent/20">
                      <MapPin className="w-5 h-5 text-accent" />
                    </div>
                    <p className="text-muted-foreground leading-relaxed pt-1">
                      {settings.contact_address}
                    </p>
                  </div>
                  <div className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-accent/20">
                      <Phone className="w-5 h-5 text-accent" />
                    </div>
                    <p className="text-muted-foreground pt-2">
                      {settings.contact_phone}
                    </p>
                  </div>
                  <div className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-green-500/20">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-muted-foreground pt-2">
                      <span className="font-semibold text-green-600">WhatsApp:</span> {settings.contact_whatsapp}
                    </p>
                  </div>
                  <div className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-accent/20">
                      <Mail className="w-5 h-5 text-accent" />
                    </div>
                    <a
                      href={`mailto:${settings.contact_email}`}
                      className="text-accent hover:underline pt-2 font-medium"
                    >
                      {settings.contact_email}
                    </a>
                  </div>
                </div>
              </div>

              {/* Business Hours */}
              <div className="relative">
                <div className="absolute -left-4 top-0 w-1 h-8 bg-accent/40 rounded-full" />
                <h3 className="text-2xl font-heading font-bold mb-6 flex items-center gap-3">
                  Business <span className="text-accent">Hours</span>
                </h3>
                <div className="bg-background/50 p-6 rounded-xl border border-black">
                  <div className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-accent" />
                    </div>
                    <div className="space-y-3 pt-1 w-full">
                      {settings.business_hours && settings.business_hours.length > 0 ? (
                        groupBusinessHours(settings.business_hours).map((group, idx) => (
                          <div key={idx} className="flex justify-between items-center border-b border-border/50 pb-2 last:border-0 last:pb-0">
                            <span className="text-foreground font-medium">
                              {group.startDay === group.endDay
                                ? (shortDays[group.startDay] || group.startDay)
                                : `${shortDays[group.startDay] || group.startDay} - ${shortDays[group.endDay] || group.endDay}`}
                            </span>
                            <span className={group.isOpen ? "text-muted-foreground" : "text-destructive font-semibold uppercase text-xs"}>
                              {group.hours}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">Hours not configured</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Get in Touch */}
              <div className="bg-primary/5 p-6 rounded-xl border border-black">
                <h3 className="text-lg font-heading font-bold mb-2 flex items-center gap-2">
                  Get in <span className="text-primary">Touch</span>
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  If you prefer to contact us, just direct message or use the
                  contact info above. We usually respond within 24 hours.
                </p>
              </div>
            </div>

            {/* Google Maps Panel */}
            <div className="h-[400px] lg:h-full min-h-[450px] bg-card/40 rounded-2xl border border-black shadow-soft overflow-hidden relative group">
              <iframe
                src={settings.google_maps_link}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="grayscale-[0.2] contrast-[1.1] transition-all duration-700 group-hover:grayscale-0 group-hover:contrast-[1.2]"
              />
              <div className="absolute inset-0 pointer-events-none border-2 border-black rounded-2xl transition-colors group-hover:border-black" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
