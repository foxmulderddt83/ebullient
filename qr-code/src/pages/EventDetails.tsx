import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, 
  Share2, 
  MapPin, 
  Ticket, 
  FileText, 
  ChevronRight,
  Bookmark,
  XCircle,
  QrCode,
  ShieldCheck,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { eventDetails as mockEventDetails } from "@/data/mockData";
import eventHero from "@/assets/event-hero.jpg";
import { supabase } from "@/lib/supabase";

type EventRecord = {
  id: string;
  event_id?: string | null;
  name: string;
  event_date?: string | null;
  event_time?: string | null;
  event_description?: string | null;
  event_program?: string | null;
  event_image_url?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  event_profile_id?: string | null;
  price?: number | string | null;
  promotion_price?: number | string | null;
  payment_required?: boolean | null;
  payment_amount?: number | null;
  payment_description?: string | null;
  enable_chip_payment?: boolean | null;
  enable_deposit?: boolean | null;
  deposit_amount?: number | null;
  event_registration_template?: string | null;
};

const EventDetails = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [eventDetails, setEventDetails] = useState(mockEventDetails);
  const [heroImg, setHeroImg] = useState(eventHero);
  const [isLoading, setIsLoading] = useState(true);
  const [rawProgram, setRawProgram] = useState<string | null>(null);

  const programItems = useMemo(() => {
    if (!rawProgram) return null;
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawProgram);
    } catch {
      parsed = null;
    }
    if (Array.isArray(parsed)) {
      if (parsed.every(item => typeof item === "string")) {
        return parsed.map((item) => ({ title: String(item) }));
      }
      if (parsed.every(item => typeof item === "object" && item !== null)) {
        return parsed
          .map((item) => {
            const record = item as Record<string, any>;
            const title = typeof record.title === "string" ? record.title : typeof record.name === "string" ? record.name : "";
            const time = typeof record.time === "string" ? record.time : "";
            const location = typeof record.location === "string" ? record.location : "";
            return { title, time, location };
          })
          .filter(item => item.title);
      }
    }
    const lines = String(rawProgram).split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    return lines.map((line) => ({ title: line }));
  }, [rawProgram]);

  useEffect(() => {
    const fetchEvent = async () => {
      const eid = searchParams.get("eid");
      if (!eid || !supabase) {
        setIsLoading(false);
        return;
      }

      // 1. Fetch Global Settings for defaults
      const { data: settingsData } = await supabase.from('site_settings').select('*').in('key', [
        'event_title', 'event_date', 'event_location', 'event_price', 'event_description', 'event_hero_image'
      ]);

      const currentConfig = { ...mockEventDetails };
      if (settingsData) {
        settingsData.forEach(setting => {
          if (setting.key === 'event_title') currentConfig.title = setting.value;
          if (setting.key === 'event_date') currentConfig.date = setting.value;
          if (setting.key === 'event_location') currentConfig.location = setting.value;
          if (setting.key === 'event_price') currentConfig.price = setting.value;
          if (setting.key === 'event_description') currentConfig.description = setting.value;
          if (setting.key === 'event_hero_image' && setting.value) setHeroImg(setting.value);
        });
      }

      // 2. Fetch Specific Event Data
      let eventData: EventRecord | null = null;
      const { data: byManualId } = await supabase.from('events').select('*').eq('event_id', eid).maybeSingle();
      if (byManualId) {
        eventData = byManualId;
      } else {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eid);
        if (isUuid) {
          const { data: byUuid } = await supabase.from('events').select('*').eq('id', eid).maybeSingle();
          eventData = byUuid;
        }
      }

      if (eventData) {
        // Apply payment details (from event record fields)
        currentConfig.payment_required = eventData.payment_required;
        currentConfig.payment_amount = eventData.payment_amount;
        currentConfig.payment_description = eventData.payment_description;
        currentConfig.enable_chip_payment = eventData.enable_chip_payment;
        currentConfig.enable_deposit = eventData.enable_deposit;
        currentConfig.deposit_amount = eventData.deposit_amount;

        // Try to parse latest payment info from template (in case profile was updated without resaving event)
        let templateJsonStr = eventData.event_registration_template;
        
        // If event has a profile, apply profile overrides
        if (eventData.event_profile_id) {
          const { data: profileData } = await supabase
            .from('event_profiles')
            .select('*')
            .eq('id', eventData.event_profile_id)
            .maybeSingle();
          
          if (profileData) {
            if (profileData.event_hero_image) setHeroImg(profileData.event_hero_image);
              if (profileData.event_description) currentConfig.description = profileData.event_description;
              // Profile template always takes precedence to reflect latest profile config
              if (profileData.event_registration_template) {
                 templateJsonStr = profileData.event_registration_template;
              }
            }
        }

        // Apply event-specific details
        currentConfig.title = eventData.name;
        currentConfig.date = eventData.event_date || currentConfig.date;
        currentConfig.location = eventData.location || currentConfig.location;
        if (eventData.event_description) currentConfig.description = eventData.event_description;
        if (eventData.event_image_url) setHeroImg(eventData.event_image_url);
        if (eventData.event_program) setRawProgram(eventData.event_program);
        
        if (eventData.price !== null && eventData.price !== undefined) {
          currentConfig.price = eventData.promotion_price 
            ? `MYR ${eventData.promotion_price}` 
            : `MYR ${eventData.price}`;
        }

        if (templateJsonStr) {
          try {
            const template = JSON.parse(templateJsonStr);
            const pReq = template.fieldsConfig?.payment_required;
            if (pReq) {
              currentConfig.payment_required = !!pReq.required;
              if (pReq.payment_amount !== undefined) currentConfig.payment_amount = pReq.payment_amount;
              if (pReq.payment_description !== undefined) currentConfig.payment_description = pReq.payment_description;
              if (pReq.deposit_amount !== undefined) currentConfig.deposit_amount = pReq.deposit_amount;
            }
            const chip = template.fieldsConfig?.enable_chip_payment;
            if (chip) {
              currentConfig.enable_chip_payment = !!chip.required;
            }
            const dep = template.fieldsConfig?.enable_deposit;
            if (dep) {
              currentConfig.enable_deposit = !!dep.required;
            }
          } catch (e) {
            console.error("Failed to parse event_registration_template in EventDetails", e);
          }
        }
      }

      setEventDetails(currentConfig);
      setIsLoading(false);
    };

    fetchEvent();
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <button 
            onClick={() => navigate(`/${searchParams.toString() ? '?' + searchParams.toString() : ''}`)}
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold">Event Details</h1>
          <button className="p-2 -mr-2 hover:bg-muted rounded-lg transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto pt-14 pb-24">
        {/* Hero Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img 
            src={heroImg} 
            alt="Event venue" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <Badge className="absolute bottom-4 left-4 bg-primary text-primary-foreground">
            TRENDING
          </Badge>
        </div>

        {/* Event Info */}
        <div className="px-4 py-6 animate-slide-up">
          <h2 className="text-2xl font-bold mb-4">{eventDetails.title}</h2>

          {/* Meta tags */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-full text-sm overflow-hidden border border-border/50">
              <img src={heroImg} className="w-4 h-4 rounded-full object-cover" alt="" />
              <span>{eventDetails.date}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-full text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{eventDetails.location}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-full text-sm">
              <Ticket className="w-4 h-4 text-primary" />
              <span className="font-semibold text-primary">{eventDetails.price}</span>
            </div>
          </div>

          {/* About */}
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-2">About Event</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {eventDetails.description}
            </p>
          </div>

          {/* Payment Info */}
          {eventDetails.payment_required && (
            <div className="mb-6 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Payment Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-bold text-primary">MYR {Number(eventDetails.payment_amount || 0).toFixed(2)}</span>
                </div>
                {eventDetails.enable_deposit && eventDetails.deposit_amount && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Minimum Deposit:</span>
                    <span className="font-bold text-primary">MYR {Number(eventDetails.deposit_amount).toFixed(2)}</span>
                  </div>
                )}
                {eventDetails.enable_chip_payment && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-white/50 p-2 rounded-lg">
                    <ShieldCheck className="w-3 h-3 text-blue-500" />
                    <span>Secure Online Payment enabled via CHIP</span>
                  </div>
                )}
                {eventDetails.payment_description && (
                  <p className="text-xs text-muted-foreground mt-2 border-t border-primary/10 pt-2 italic">
                    {eventDetails.payment_description}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Document Submission Card */}
          <button className="w-full mb-6 p-4 bg-accent/50 rounded-xl flex items-center gap-4 hover:bg-accent transition-colors">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-semibold">Document Submission</h4>
              <p className="text-sm text-muted-foreground">ID & Portfolio required</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Program Highlights */}
          {programItems && (
            <div className="mb-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                Program Highlights
              </h3>
              <div className="space-y-3">
                {programItems.map((item: any, index: number) => (
                  <div key={`${item.title}-${index}`} className="flex gap-4 group">
                    <div className="w-14 shrink-0 flex flex-col pt-1">
                      <span className="text-[13px] font-bold text-primary">{item.time || "—"}</span>
                      {item.location && (
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.location}</span>
                      )}
                    </div>
                    <div className="flex-1 p-3 rounded-xl border border-border bg-card shadow-sm border-l-4 border-l-primary">
                      <h4 className="font-semibold text-foreground text-sm">{item.title}</h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schedule */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Schedule</h3>
            <div className="space-y-4">
              {eventDetails.schedule.map((item, index) => (
                <div 
                  key={index}
                  className="flex gap-4 items-start"
                >
                  <div className="flex flex-col items-center min-w-[50px]">
                    <span className="text-primary font-semibold text-sm">
                      {item.time.split(" ")[0]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.time.split(" ")[1]}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="relative bg-card rounded-2xl shadow-lg border border-border overflow-hidden hover:shadow-xl transition-shadow">
                      {/* Curved accent line on the left that follows the panel curve */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-l-[16px]" />
                      <div className="p-4 pl-6">
                        <h4 className="font-semibold text-foreground">{item.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{item.location}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border p-4">
        <div className="max-w-lg mx-auto flex gap-3">
          <Button
            variant="secondary"
            size="icon"
            className={`shrink-0 border-slate-200 shadow-sm ${isBookmarked ? "text-primary border-primary" : ""}`}
            onClick={() => setIsBookmarked(!isBookmarked)}
          >
            <Bookmark className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`} />
          </Button>
          <Button 
            onClick={() => navigate(`/register?${searchParams.toString()}`)}
            className="flex-1 gradient-primary text-primary-foreground font-semibold py-6 rounded-xl"
          >
            Register Now
            <ChevronRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
