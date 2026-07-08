import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
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
  ShieldCheck,
  Info,
  QrCode
} from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { eventDetails } from "@/data/mockData";
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
  promotion_start_at?: string | null;
  promotion_end_at?: string | null;
  event_registration_template?: string | null;
  event_time_slots?: string | null;
  event_schedule?: string | null;
};

type EventProgramItem = {
  title: string;
  time?: string;
  location?: string;
};

const formatFlightTime = (time: string | null | undefined) => {
  if (!time) return "TBD";
  if (time.toLowerCase().includes('am') || time.toLowerCase().includes('pm')) {
    return time.toUpperCase();
  }
  try {
    if (!time.includes(':')) return time.toUpperCase();
    const parts = time.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (isNaN(h)) return time.toUpperCase();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.padStart(2, '0')} ${ampm}`;
  } catch (error) {
    return time.toUpperCase();
  }
};

const resolveImageUrl = (url: string | null | undefined) => {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("/") || url.startsWith("data:")) {
    return url;
  }
  if (!supabase) return url;
  // Use supabase storage to get the public URL correctly
  return supabase.storage.from('media').getPublicUrl(url).data.publicUrl;
};

const EventDetails = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [config, setConfig] = useState(eventDetails);
  const [heroImg, setHeroImg] = useState(eventHero);
  const [isExpired, setIsExpired] = useState(false);
  const [testTimeLeft, setTestTimeLeft] = useState<number | null>(null);
  const [showDocumentSubmission, setShowDocumentSubmission] = useState(true);
  const [documentLabel, setDocumentLabel] = useState("Document Submission");
  const [eventData, setEventData] = useState<EventRecord | null>(null);

  useEffect(() => {
    const fetchEventAndSettings = async () => {
      const eid = searchParams.get("eid");
      const expires = searchParams.get("expires");
      const isTest = searchParams.get("test") === "true";

      // 1. Check Test Expiry
      if (expires) {
        const expiryTime = parseInt(expires);
        const remaining = expiryTime - Date.now();
        if (remaining <= 0) {
          setIsExpired(true);
          return;
        }
        setTestTimeLeft(Math.floor(remaining / 1000));
      }

      if (!supabase) return;

      // 2. Fetch Global Settings in parallel with Event Data
      const isUuid = eid && eid !== 'default' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eid);

      // Parallelize: settings, event by event_id, event by UUID (if applicable)
      const [{ data: settingsData }, { data: byManualId }, { data: byUuid }] = await Promise.all([
        supabase.from('site_settings').select('*').in('key', [
          'event_title', 'event_date', 'event_location', 'event_price',
          'event_description', 'event_hero_image', 'event_schedule',
          'event_registration_template'
        ]),
        eid && eid !== 'default' ? supabase.from('events').select('*').eq('event_id', eid).maybeSingle() : Promise.resolve({ data: null }),
        isUuid ? supabase.from('events').select('*').eq('id', eid).maybeSingle() : Promise.resolve({ data: null })
      ]);

      const currentConfig = { ...eventDetails };
      if (settingsData) {
        settingsData.forEach(setting => {
          if (setting.key === 'event_title') currentConfig.title = setting.value;
          if (setting.key === 'event_date') currentConfig.date = setting.value;
          if (setting.key === 'event_location') currentConfig.location = setting.value;
          if (setting.key === 'event_price') currentConfig.price = setting.value;
          if (setting.key === 'event_description') currentConfig.description = setting.value;
          if (setting.key === 'event_hero_image' && setting.value) setHeroImg(resolveImageUrl(setting.value));
          if (setting.key === 'event_schedule') {
            try {
              const parsed = JSON.parse(setting.value);
              if (Array.isArray(parsed)) {
                currentConfig.schedule = parsed;
              }
            } catch {
              currentConfig.schedule = eventDetails.schedule;
            }
          }
          if (setting.key === 'event_registration_template') {
            try {
              const template = JSON.parse(setting.value) as {
                steps?: { fields?: string[] }[];
                labels?: { document_submission?: string };
              };
              const hasDocument = template.steps?.some((step) => (step.fields || []).includes('document')) || false;
              setShowDocumentSubmission(hasDocument);
              if (template.labels?.document_submission) {
                setDocumentLabel(template.labels.document_submission);
              }
            } catch (e) {
              console.error("Failed to parse registration template", e);
            }
          }
        });
      }

      // 3. Override with Specific Event Data if EID exists
      if (eid && eid !== 'default') {
        let eventData: EventRecord | null = byManualId || byUuid;

        if (eventData) {
          // Check for Event Profile
          // Priority: Event Image > Profile Image > Global/Default

          let resolvedHeroImg = resolveImageUrl(settingsData?.find(s => s.key === 'event_hero_image')?.value) || eventHero;

          // Parallelize profile data fetch with location data fetch
          const [{ data: profileData }, { data: locData }] = await Promise.all([
            eventData.event_profile_id
              ? supabase.from('event_profiles').select('*').eq('id', eventData.event_profile_id).maybeSingle()
              : Promise.resolve({ data: null }),
            supabase.from('site_settings').select('value').eq('key', `event_location_${eventData.id}`).maybeSingle()
          ]);

          if (locData) currentConfig.location = locData.value;

          if (eventData.event_profile_id && profileData) {

            if (profileData) {
              if (profileData.event_hero_image) {
                resolvedHeroImg = resolveImageUrl(profileData.event_hero_image);
              }
              if (profileData.event_description) currentConfig.description = profileData.event_description;

              if (!eventData.event_schedule && profileData.event_schedule) {
                try {
                  const parsedSchedule = JSON.parse(profileData.event_schedule);
                  if (Array.isArray(parsedSchedule)) {
                    currentConfig.schedule = parsedSchedule;
                  }
                } catch (e) {
                  console.error("Failed to parse profile schedule", e);
                }
              }

              if (!eventData.event_registration_template && profileData.event_registration_template) {
                try {
                  const template = JSON.parse(profileData.event_registration_template) as {
                    steps?: { fields?: string[] }[];
                    labels?: { document_submission?: string };
                  };
                  const hasDocument = template.steps?.some((step) => (step.fields || []).includes('document')) || false;
                  setShowDocumentSubmission(hasDocument);
                  if (template.labels?.document_submission) {
                    setDocumentLabel(template.labels.document_submission);
                  }
                } catch (e) {
                  console.error("Failed to parse profile registration template", e);
                }
              }
            }
          }

          // Apply event-specific snapshots if they exist (overrides profile)
          if (eventData.event_schedule) {
            try {
              const parsedSchedule = JSON.parse(eventData.event_schedule);
              if (Array.isArray(parsedSchedule)) {
                currentConfig.schedule = parsedSchedule;
              }
            } catch (e) {
              console.error("Failed to parse event schedule", e);
            }
          }

          if (eventData.event_registration_template) {
            try {
              const template = JSON.parse(eventData.event_registration_template) as {
                steps?: { fields?: string[] }[];
                labels?: { document_submission?: string };
              };
              const hasDocument = template.steps?.some((step) => (step.fields || []).includes('document')) || false;
              setShowDocumentSubmission(hasDocument);
              if (template.labels?.document_submission) {
                setDocumentLabel(template.labels.document_submission);
              }
            } catch (e) {
              console.error("Failed to parse event registration template", e);
            }
          }

          setEventData(eventData);
          // Always use Event Data for core details
          currentConfig.title = eventData.name;
          currentConfig.location = eventData.location || currentConfig.location;
          if (eventData.price !== null && eventData.price !== undefined) {
            currentConfig.price = eventData.promotion_price
              ? `MYR ${eventData.promotion_price}`
              : `MYR ${eventData.price}`;
          }

          if (!eventData.event_profile_id) currentConfig.date = eventData.event_date;

          // If event has specific image, it overrides everything
          if (eventData.event_image_url) {
            resolvedHeroImg = resolveImageUrl(eventData.event_image_url);
          }

          setHeroImg(resolvedHeroImg);

          currentConfig.date = eventData.event_date; // Date is specific to the instance
          if (eventData.event_description) currentConfig.description = eventData.event_description;

          // Check Event Expiry (unless in test mode)
          if (!isTest) {
            const now = new Date();

            let expiryDate: Date | null = null;

            // Priority: event_date + event_time
            if (eventData.event_date) {
              const timeStr = eventData.event_time || "23:59:59";
              expiryDate = new Date(`${eventData.event_date}T${timeStr}`);
            }

            // Override with end_time if present (more specific)
            if (eventData.end_time) {
              const end = new Date(eventData.end_time);
              if (!Number.isNaN(end.getTime())) {
                expiryDate = end;
              }
            }

            if (expiryDate && now > expiryDate) {
              setIsExpired(true);
            }
          }
        }
      }

      setConfig(currentConfig);
    };

    fetchEventAndSettings();
  }, [searchParams]);

  useEffect(() => {
    if (testTimeLeft === null || testTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setTestTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [testTimeLeft]);

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const programItems = useMemo<EventProgramItem[] | null>(() => {
    if (!eventData?.event_program) return null;
    const raw = eventData.event_program;
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
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
            const record = item as Record<string, unknown>;
            const title = typeof record.title === "string" ? record.title : typeof record.name === "string" ? record.name : "";
            const time = typeof record.time === "string" ? record.time : "";
            const location = typeof record.location === "string" ? record.location : "";
            return { title, time, location };
          })
          .filter(item => item.title);
      }
    }
    const lines = String(raw).split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    return lines.map((line) => ({ title: line }));
  }, [eventData?.event_program]);

  const timingInfo = useMemo(() => {
    if (!eventData) return null;
    const now = new Date();

    // Construct start date/time prioritizing event_date and event_time
    let start: Date | null = null;
    if (eventData.event_date) {
      const timeStr = eventData.event_time || "00:00:00";
      start = new Date(`${eventData.event_date}T${timeStr}`);
    } else if (eventData.start_time) {
      start = new Date(eventData.start_time);
    }

    // End time prioritization
    let end: Date | null = eventData.end_time ? new Date(eventData.end_time) : null;
    if (!end && eventData.event_date) {
      // If no end time, default to end of the day for the set event_date
      end = new Date(`${eventData.event_date}T23:59:59`);
    }

    if (!start || Number.isNaN(start.getTime())) return null;
    if (end && Number.isNaN(end.getTime())) return null;

    if (now < start) {
      const diff = Math.max(0, start.getTime() - now.getTime());
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      return {
        status: "upcoming",
        primary: `Starts in ${hours}h ${mins}m`,
        secondary: format(start, "MMM dd, yyyy • hh:mm a").toUpperCase()
      };
    }

    if (end && now <= end) {
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      const todayRemainingMs = Math.max(0, Math.min(end.getTime(), endOfToday.getTime()) - now.getTime());
      const todayHours = Math.floor(todayRemainingMs / 3600000);
      const todayMins = Math.floor((todayRemainingMs % 3600000) / 60000);
      const nextMs = Math.max(0, end.getTime() - endOfToday.getTime());
      const nextHours = Math.ceil(nextMs / 3600000);
      return {
        status: "running",
        primary: `Today remaining ${todayHours}h ${todayMins}m`,
        secondary: nextMs > 0 ? `Next days remaining ${nextHours}h` : null
      };
    }

    if (!end) {
      return {
        status: "running",
        primary: "Event is live",
        secondary: null
      };
    }

    return {
      status: "ended",
      primary: "Event ended",
      secondary: null
    };
  }, [eventData]);

  const qrValue = useMemo(() => {
    const eventKey = eventData?.event_id || eventData?.id || searchParams.get("eid") || "default";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/event/register?eid=${eventKey}`;
  }, [eventData, searchParams]);

  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-xs animate-fade-in">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold">Event Expired</h1>
          <p className="text-muted-foreground">
            This registration link is no longer valid. The event has already passed or the link has expired.
          </p>
          <Button
            onClick={() => navigate('/')}
            className="w-full h-12 rounded-xl font-bold text-sm uppercase tracking-wider"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Test Mode Banner */}
      {searchParams.get("test") === "true" && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-xs font-bold sticky top-0 z-[60] flex items-center justify-center gap-2 shadow-md">
          <ShieldCheck className="w-3 h-3" />
          <span>TEST MODE: Link expires in {testTimeLeft !== null ? formatTimeLeft(testTimeLeft) : '...'}</span>
        </div>
      )}

      {/* Header */}
      <header className={`fixed ${searchParams.get("test") === "true" ? 'top-8' : 'top-0'} left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-slate-200`}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => {
              const params = searchParams.toString();
              navigate(params ? `/?${params}` : "/");
            }}
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
      <main className={`max-w-lg mx-auto ${searchParams.get("test") === "true" ? 'pt-22' : 'pt-14'} pb-24`}>
        {/* Hero Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={heroImg}
            alt="Event venue"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <Badge className="absolute bottom-4 left-4 bg-event-pink text-white border-none rounded-md px-3 py-1 text-[10px] font-bold tracking-wider">
            TRENDING
          </Badge>
        </div>

        {/* Event Info */}
        <div className="px-4 py-6 animate-slide-up">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">{config.title}</h2>

            <Dialog>
              <DialogTrigger asChild>
                <button className="flex flex-col items-center gap-1 group shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-event-pink/5 border border-event-pink/10 flex items-center justify-center text-event-pink group-hover:bg-event-pink group-hover:text-white transition-all shadow-sm">
                    <Info className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-event-pink">Details</span>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-0 border-none shadow-2xl bg-white/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
                <DialogHeader className="p-6 sm:p-8 pb-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                  <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                    <div className="p-2 bg-event-pink/10 rounded-xl">
                      <Info className="w-5 h-5 text-event-pink" />
                    </div>
                    Event Details
                  </DialogTitle>
                </DialogHeader>

                <div className="p-6 sm:p-8 space-y-6 sm:space-y-8">
                  {/* Meta tags */}
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm group hover:border-event-pink/20 transition-colors">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden border border-slate-100">
                        <img src={heroImg} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date & Time</p>
                        <p className="font-bold text-slate-900">{config.date}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm group hover:border-event-pink/20 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-event-pink transition-colors">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</p>
                        <p className="font-bold text-slate-900">{config.location}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm group hover:border-event-pink/20 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-event-pink transition-colors">
                        <Ticket className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Fee</p>
                        <p className="font-bold text-event-pink">{config.price}</p>
                      </div>
                    </div>
                  </div>

                  {/* About Section */}
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-event-pink rounded-full" />
                      About the Event
                    </h3>
                    <div className="bg-slate-50/50 p-4 sm:p-6 rounded-[2rem] border border-slate-100">
                      <p className="text-slate-600 leading-relaxed text-[15px] font-medium italic whitespace-pre-wrap">
                        "{config.description}"
                      </p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Inline Description Section */}
          <div className="mb-6">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2 px-1">
              <div className="w-1 h-3 bg-event-pink rounded-full" />
              About Event
            </h3>
            <div className="bg-slate-50/30 p-4 rounded-2xl border border-slate-100/50">
              <p className="text-slate-600 leading-relaxed text-[14px] font-medium whitespace-pre-wrap">
                {config.description}
              </p>
            </div>
          </div>

          {timingInfo && (
            <div className="mb-6 rounded-3xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">Time Remaining</p>
                <p className="text-base sm:text-lg font-black text-slate-900 mt-1 sm:mt-2 truncate">{timingInfo.primary}</p>
                {timingInfo.secondary && (
                  <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mt-0.5 sm:mt-1 truncate">{timingInfo.secondary}</p>
                )}
              </div>
              <div className="w-14 h-14 sm:w-20 sm:h-20 shrink-0 rounded-2xl bg-event-pink/10 text-event-pink flex items-center justify-center overflow-hidden border border-event-pink/10">
                <img src={heroImg} className="w-full h-full object-cover" alt="" />
              </div>
            </div>
          )}

          <div className="mb-6 rounded-3xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 items-center justify-between">
            <div className="text-center sm:text-left">
              <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">Event QR</p>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1 sm:mt-2">Show this at the entrance</h3>
              <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mt-1 sm:mt-2">Scan to open registration</p>
            </div>
            <div className="w-full sm:w-auto flex items-center justify-center">
              <div className="bg-white p-2 sm:p-3 rounded-2xl border border-slate-200 shadow-inner">
                <QRCode value={qrValue} size={140} className="h-28 w-28 sm:h-44 sm:w-44" />
              </div>
            </div>
          </div>

          {programItems && (
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-5 text-slate-900 flex items-center gap-2 px-1">
                <QrCode className="w-5 h-5 text-event-pink" />
                Program Highlights
              </h3>
              <div className="space-y-4">
                {programItems.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="flex gap-3 sm:gap-4 group">
                    <div className="w-12 sm:w-16 shrink-0 flex flex-col pt-1">
                      <span className="text-[11px] sm:text-[13px] font-bold text-event-pink leading-tight">
                        {item.time ? formatFlightTime(item.time) : "—"}
                      </span>
                      {item.location && (
                        <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase truncate mt-0.5">{item.location}</span>
                      )}
                    </div>
                    <div className="flex-1 p-3 sm:p-4 rounded-2xl border border-slate-200 bg-white shadow-sm border-l-4 border-l-event-pink group-hover:shadow-md transition-shadow">
                      <h4 className="font-bold text-slate-800 mb-1 text-[13px] sm:text-base leading-snug">{item.title}</h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Submission Card */}
          {showDocumentSubmission && (
            <button
              onClick={() => navigate(`/event/register?${searchParams.toString()}`)}
              className="w-full mb-8 p-5 bg-event-pink-soft rounded-2xl flex items-center gap-4 hover:opacity-90 transition-all border border-event-pink/20 shadow-sm"
            >
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                <FileText className="w-6 h-6 text-event-pink" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-bold text-slate-900">{documentLabel}</h4>
                <p className="text-xs text-slate-500 mt-0.5">Required for registration</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          )}

          {/* Schedule */}
          <div className="mb-4">
            <h3 className="font-bold text-lg mb-5 text-slate-900 px-1">Schedule</h3>
            <div className="space-y-4">
              {config.schedule.map((item, index) => (
                <div
                  key={index}
                  className="flex gap-3 sm:gap-4 group"
                >
                  <div className="w-12 sm:w-16 shrink-0 flex flex-col pt-1">
                    {(() => {
                      const formatted = formatFlightTime(item.time);
                      const [timePart, ampmPart] = formatted.split(' ');
                      return (
                        <>
                          <span className="text-[11px] sm:text-[13px] font-bold text-event-pink leading-tight">{timePart}</span>
                          <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase leading-tight mt-0.5">{ampmPart}</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex-1 p-3 sm:p-4 rounded-2xl border border-slate-200 bg-white shadow-sm border-l-4 border-l-event-pink group-hover:shadow-md transition-shadow">
                    <h4 className="font-bold text-slate-800 mb-1 text-[13px] sm:text-base leading-snug">{item.title}</h4>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium">{item.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-50">
        <div className="max-w-lg mx-auto flex gap-2 sm:gap-3">
          <Button
            variant="secondary"
            size="icon"
            className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl transition-all shadow-sm ${isBookmarked ? "text-event-pink border-event-pink bg-event-pink/5" : "text-slate-400 border-slate-200"}`}
            onClick={() => setIsBookmarked(!isBookmarked)}
          >
            <Bookmark className={`w-5 h-5 sm:w-6 sm:h-6 ${isBookmarked ? "fill-current" : ""}`} />
          </Button>
          <Button
            onClick={() => navigate(`/event/register?${searchParams.toString()}`)}
            className="flex-1 gradient-event text-white font-bold h-12 sm:h-14 rounded-xl sm:rounded-2xl shadow-lg shadow-event-pink/20 hover:opacity-90 transition-all active:scale-[0.98] text-sm uppercase tracking-wider"
          >
            Register Now
            <ChevronRight className="ml-1 sm:ml-2 w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
