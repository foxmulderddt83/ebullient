import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { MapPin, Clock, DollarSign, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import eventHero from "@/assets/event-hero.jpg";

interface EventProfile {
  id: string;
  name: string;
  event_hero_image?: string | null;
}

interface Event {
  id: string;
  name: string;
  event_date: string;
  event_time: string;
  event_id?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  is_active: boolean;
  event_description?: string | null;
  event_image_url?: string | null;
  price?: number | string | null;
  promotion_price?: number | string | null;
  promotion_start_at?: string | null;
  promotion_end_at?: string | null;
  event_profile_id?: string | null;
}

const EventsList = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventProfiles, setEventProfiles] = useState<EventProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [promotionBannerUrl, setPromotionBannerUrl] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!supabase) return;
      
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .order("start_time", { ascending: true });

      const { data: profilesData } = await supabase
        .from("event_profiles")
        .select("*");
      
      const { data: settingsData } = await supabase
        .from('site_settings')
        .select('key, value')
        .eq('key', 'promotion_image_banner')
        .maybeSingle();
      
      if (settingsData) {
        setPromotionBannerUrl(settingsData.value);
      }

      if (eventsError) {
        console.error("Error fetching events:", eventsError);
      } else {
        if (profilesData) {
          setEventProfiles(profilesData);
        }

        const now = new Date();
        const upcomingEvents = (eventsData || []).filter(event => {
          if (event.event_date && event.event_time) {
            return new Date(`${event.event_date}T${event.event_time}`) > now;
          }
          if (event.end_time) {
            return new Date(event.end_time) > now;
          }
          if (event.start_time) {
            return new Date(event.start_time) > now;
          }
          return true; // If no date info, show it
        });
        setEvents(upcomingEvents);
      }
      setLoading(false);
    };

    fetchEvents();
  }, []);

  const getEventImage = (event: Event) => {
    if (event.event_profile_id) {
      const profile = eventProfiles.find(p => p.id === event.event_profile_id);
      if (profile?.event_hero_image) {
        return profile.event_hero_image;
      }
    }
    return event.event_image_url || eventHero;
  };

  const getEventTimeLabel = (event: Event) => {
    if (event.event_date && event.event_time) {
      try {
        const formattedDate = format(new Date(event.event_date + 'T00:00:00'), "MMM dd, yyyy");
        return `${formattedDate} • ${event.event_time}`;
      } catch (e) {
        return `${event.event_date} • ${event.event_time}`;
      }
    }
    if (event.start_time) {
      try {
        return format(new Date(event.start_time), "MMM dd, yyyy • HH:mm");
      } catch (e) {
        return `${event.event_date} • ${event.event_time}`;
      }
    }
    return `${event.event_date} • ${event.event_time}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black">
      <Header />
      <main className="pt-24 md:pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Placeholder for fixed button space */}
          <div className="h-16 mb-12 invisible"></div>
          {/* Back Button */}
          <div className="fixed top-20 left-4 z-40 md:top-24 md:left-8">
            <Link to="/">
              <Button 
                variant="outline" 
                className="gap-2 px-4 py-3 sm:px-6 sm:py-6 rounded-2xl border-2 border-white text-white hover:bg-white hover:text-slate-900 transition-all duration-300 font-black uppercase tracking-tighter shadow-[0_0_20px_rgba(0,0,0,0.3)] active:scale-95 group bg-slate-900/40 backdrop-blur-md"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:-translate-x-2" />
                <span className="text-xs sm:text-base">Back to Flight Deck</span>
              </Button>
            </Link>
          </div>
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter">
              Upcoming Events
            </h1>
            <p className="text-slate-400 mt-4 font-medium uppercase tracking-widest text-xs">
              Join us for exciting aviation experiences
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[2.5rem] border border-black shadow-xl shadow-slate-950/20">
              <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No upcoming events scheduled</p>
              <Button 
                onClick={() => navigate("/")}
                className="mt-6 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-xs h-12 px-8 rounded-2xl shadow-xl shadow-primary/20"
              >
                Return Home
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {events.map((event) => {
                const start = event.promotion_start_at ? new Date(event.promotion_start_at) : null;
                const end = event.promotion_end_at ? new Date(event.promotion_end_at) : null;
                
                const isStartValid = start && !isNaN(start.getTime());
                const isEndValid = end && !isNaN(end.getTime());

                const isPromotionActive = event.promotion_price && 
                   (!isStartValid || start! <= currentTime) &&
                   (!isEndValid || end! > currentTime);

                 let timeLeft = "";
                 if (isPromotionActive && isEndValid) {
                   const diff = end!.getTime() - currentTime.getTime();
                   if (diff > 0) {
                     const hours = Math.floor(diff / (1000 * 60 * 60));
                     const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                     const secs = Math.floor((diff % (1000 * 60)) / 1000);
                     timeLeft = `${hours}h ${mins}m ${secs}s`;
                   }
                 }

                return (
                  <div 
                    key={event.id}
                    className="bg-white rounded-[2.5rem] border border-black overflow-hidden shadow-xl shadow-slate-950/20 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 flex flex-col group relative"
                  >
                    {/* Promotion Decoration like FlightPackagesSection */}
                    <div className="absolute top-2 left-2 w-20 h-20 pointer-events-none z-30 transform -rotate-12 group-hover:scale-110 group-hover:rotate-0 transition-all duration-500">
                      {isPromotionActive ? (
                        <div className="animate-glowing-fast">
                          <img 
                            src={promotionBannerUrl || "/special_promo_banner.png"} 
                            alt="Promotion" 
                            className="w-full h-auto drop-shadow-lg"
                          />
                        </div>
                      ) : (
                        <img src="/airplane_transparent.svg" alt="" className="w-full h-auto drop-shadow-lg opacity-20 group-hover:opacity-40" />
                      )}
                    </div>

                    <div className="aspect-[16/9] relative overflow-hidden bg-slate-100">
                      <img 
                        src={getEventImage(event)} 
                        alt={event.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    </div>
                    
                    <div className="p-6 sm:p-8 flex flex-col flex-1">
                      <div className="flex-1">
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight line-clamp-2 mb-4">
                          {event.name}
                        </h2>

                        {event.event_description && (
                          <div className="mb-6">
                            <p className="text-slate-500 text-xs font-medium leading-relaxed line-clamp-3 whitespace-pre-wrap italic">
                              "{event.event_description}"
                            </p>
                          </div>
                        )}
                        
                        <div className="space-y-3 mb-6">
                          <div className="flex items-center gap-3 text-slate-600">
                            <div className="bg-slate-50 p-0.5 rounded-xl border border-black overflow-hidden w-8 h-8 flex items-center justify-center">
                              <img 
                                src={getEventImage(event)} 
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest">
                              {getEventTimeLabel(event)}
                            </span>
                          </div>
                          
                          {event.location && (
                            <div className="flex items-center gap-3 text-slate-600">
                              <div className="bg-slate-50 p-2 rounded-xl border border-black">
                                <MapPin className="w-4 h-4 text-primary" />
                              </div>
                              <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest line-clamp-1">
                            {event.location}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-slate-600">
                        <div className="bg-slate-50 p-2 rounded-xl border border-black">
                          <DollarSign className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            {isPromotionActive ? (
                              <>
                                <span className="text-lg font-black text-primary">MYR {event.promotion_price}</span>
                                <span className="text-xs font-bold text-slate-400 line-through decoration-red-500 decoration-2">MYR {event.price || '0.00'}</span>
                                <Badge className="bg-primary text-white border-none text-[8px] px-2 h-5 font-black uppercase tracking-tighter">PROMO</Badge>
                              </>
                            ) : (
                              <span className="text-lg font-black text-slate-900">MYR {event.price || '0.00'}</span>
                            )}
                          </div>
                          {isPromotionActive && timeLeft && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 animate-pulse mt-1">
                              <Clock className="w-3 h-3" />
                              <span className="uppercase tracking-widest">ENDS IN: {timeLeft}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                      <Button 
                        onClick={() => navigate(`/event?eid=${event.event_id || event.id}`)}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-xs h-14 rounded-2xl shadow-xl shadow-primary/20 group-hover:translate-y-[-4px] transition-all active:scale-95"
                      >
                        View Event Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EventsList;
