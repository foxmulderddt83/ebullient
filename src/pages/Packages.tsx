import { useState, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// Same lazy shape the home page uses, so the wizard is only pulled in when this
// page is actually visited.
const BookingWizard = lazy(() =>
  import("@/components/BookingWizard").then(m => ({ default: m.BookingWizard }))
);
import {
  PageShell,
  PageTransition,
  Reveal,
  SectionTitle,
  GlassCard,
  ActionLink,
  BrandLoader,
  THEME,
} from "@/components/page/PageChrome";
import { Plus, MapPin, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Packages page.
 *
 * Ported from the standalone public/OneDayPilot Main.html. That file lived
 * outside the SPA, so opening it from the nav threw the visitor onto a bare
 * document with no site header and no footer. The copy here is carried over
 * verbatim; only the presentation is new.
 */

const WHATSAPP =
  "https://wa.me/601165127889?text=Hi%20OneDayPilot%0A%0AInterested%20Package%3A%0APreferred%20Date%3A%0ANumber%20of%20Pax%3A";

const TRUST_STRIP = [
  "✈️ 5000+ Flight Experiences",
  "👨‍✈️ Certified Pilots",
  "🏆 15+ Years Aviation Industry",
  "⭐ Customer Favourite Experience",
];

const MEETING_POINT = [
  {
    title: "📍 Flight Operations",
    items: [
      "Aerotree Flight Services Hangar 2",
      "SAAS International Airport",
      "47200 Subang",
      "Selangor Darul Ehsan",
      "Malaysia",
    ],
  },
  {
    title: "🚗 Parking Information",
    items: [
      "Visitor parking available",
      "Arrive 30 minutes earlier",
      "Easy Grab & Taxi access",
      "Airport security checkpoint",
      "Follow OneDayPilot directions",
    ],
  },
  {
    title: "🧾 What To Bring",
    items: [
      "NRIC or Passport",
      "Comfortable clothing",
      "Covered shoes",
      "Camera or smartphone",
      "Excitement and smiles",
    ],
  },
];

const ROUTES = [
  {
    image: "/BG/R1.jpeg",
    title: "🛫 30 Minutes Route",
    body: "Perfect for first-time flyers. Explore key landmarks around Klang Valley.",
  },
  {
    image: "/BG/R3.jpeg",
    title: "🛫 45 Minutes Route",
    body: "Extended experience with more landmarks and flight time.",
  },
  {
    image: "/BG/R5.jpeg",
    title: "🛫 60 Minutes Route",
    body: "Premium flight route with maximum sightseeing opportunities.",
  },
];

const AIRCRAFT = [
  {
    image: "/BG/Piper PA-28 4.jpeg",
    name: "Piper PA28",
    blurb: "A sporty aircraft designed for enjoyable flight handling and training experiences.",
    points: [
      "Stable landing characteristics",
      "Sporty handling performance",
      "Excellent training aircraft",
      "Pilot-focused cockpit layout",
    ],
  },
  {
    image: "/BG/C172 4.jpeg",
    name: "Cessna 172",
    blurb: "The world's most popular general aviation aircraft.",
    points: [
      "Excellent visibility",
      "Smooth flight characteristics",
      "Perfect for beginners",
      "Comfortable passenger cabin",
    ],
  },
  {
    image: "/BG/Super Petrel 3.jpg",
    name: "Super Petrel XP Plus",
    blurb: "Experience amphibious aviation with water takeoffs and landings.",
    points: [
      "Water landing capability",
      "Adventure flying experience",
      "Premium seaplane operations",
      "Unique Malaysia experience",
    ],
  },
];

const HIGHLIGHTS = [
  { title: "🛩 Fly A Real Aircraft", body: "Take the controls under supervision of Certified Pilots." },
  { title: "🌇 Amazing Scenic Views", body: "See Kuala Lumpur and surrounding landmarks from the sky." },
  { title: "📷 Great For Photos", body: "Capture unforgettable aviation memories." },
  { title: "🎁 Perfect Gift", body: "Birthdays, graduations, anniversaries and special occasions." },
];

const REVIEWS = [
  {
    quote:
      "\"Amazing experience. The pilot explained everything clearly and even let me take control during cruise flight.\"",
    author: "– Jason L.",
  },
  {
    quote: "\"Bought this as a birthday gift for my husband. He absolutely loved it.\"",
    author: "– Amanda T.",
  },
  {
    quote: "\"The views over Kuala Lumpur were incredible. Highly recommended.\"",
    author: "– Daniel K.",
  },
];

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Do I need any flying experience?",
    a: "No. All experiences are conducted with licensed professional pilots who will guide you throughout the flight.",
  },
  {
    q: "What is One Day Pilot?",
    a: "One Day Pilot is a hands-on aviation experience where you can sit beside a real pilot and experience basic aircraft controls during flight. Perfect for anyone curious about flying before joining flight school.",
  },
  {
    q: "Is there an age requirement?",
    a: (
      <>
        Yes.
        <br />
        🔹Co-pilot participants must be at least 12 years old
        <br />
        🔹Passengers must be at least 5 years old.
        <br />
        🔹Pilot training should be at least 18 years old
        <br />
        Participants above 60 years old may be asked for a medical report.
      </>
    ),
  },
  {
    q: "Is there a height or weight limit?",
    a: (
      <>
        Yes, for safety and cockpit comfort.
        <br />
        <br />
        Height : 152cm-193cm
        <br />
        Weight : Max 3 passenger with combine weight not more than 230kg.
      </>
    ),
  },
  {
    q: "Is One Day Pilot safe?",
    a: (
      <>
        Safety is our highest priority.
        <br />
        All flights are conducted by certified pilots with full safety briefings before take-off.
      </>
    ),
  },
  {
    q: "Can I bring my own camera?",
    a: (
      <>
        Yes.
        <br />
        Personal cameras and smartphones are welcome.
        <br />
        We also offer optional GoPro, 360° inflight and professional video services
      </>
    ),
  },
  {
    q: "What should I wear?",
    a: (
      <>
        Wear comfortable clothing, long trousers or jeans and covered shoes.
        <br />
        Please bring your NRIC or passport on the flight day.
      </>
    ),
  },
  {
    q: "What happens if the weather is bad?",
    a: (
      <>
        Flights may be delayed or rescheduled due to unsafe weather conditions.
        <br />
        If conditions remain unsafe, rescheduling (within 3 months) or refund options will be provided.
      </>
    ),
  },
  {
    q: "What does the package include?",
    a: (
      <>
        The package includes safety briefing, aircraft familiarisation, and hands-on flying experience during
        cruise flight.
        <br />
        Available flight durations are 30, 45, and 60 minutes..
      </>
    ),
  },
  {
    q: "How do I book?",
    a: (
      <>
        You can book online or contact us directly via WhatsApp or email.
        <br />
        🔹WhatsApp: +6011 6512 7889
        <br />
        🔹WhatsApp: +6018 253 7889
        <br />
        🔹Email: booking@onedaypilot.com
        <br />
        Full payment is usually required before the flight date.
      </>
    ),
  },
  {
    q: "Will I control the aircraft?",
    a: (
      <>
        Yes, during the cruise portion of the flight under pilot supervision.
        <br />
        Take-off and landing are handled by the pilot for safety reasons.
      </>
    ),
  },
];

const TRUST_BAR = [
  "✈️ Certified Pilots Only",
  "🛩 CASA Approved Aircraft",
  "📍 Subang Airport Operations",
  "⭐ 5-Star Guest Experience",
];

const FaqItem = ({ q, a, index }: { q: string; a: React.ReactNode; index: number }) => {
  const [open, setOpen] = useState(false);
  return (
    <Reveal delay={index * 0.04}>
      <div
        className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${
          open ? "border-[#CD5C5C]/40 bg-white" : "border-black/5 bg-white/85"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        >
          <span
            className="text-base md:text-lg uppercase text-slate-900"
            style={{ fontFamily: THEME.condensed, letterSpacing: "0.06em" }}
          >
            {q}
          </span>
          <motion.span
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="shrink-0 rounded-full border p-1"
            style={{ borderColor: open ? THEME.accent : "rgba(15,23,42,0.15)" }}
          >
            <Plus className="h-4 w-4" style={{ color: open ? THEME.accent : "#cbd5e1" }} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="px-6 pb-6 text-sm md:text-base leading-relaxed text-slate-600">{a}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
};

export default function Packages() {
  return (
    <>
      <PageTransition label="Packages" />
      <Header />
      <PageShell>
        {/* ── HERO ── */}
        <section className="relative flex min-h-[92vh] items-center overflow-hidden pt-28 pb-16">
          <motion.div
            className="absolute inset-0 z-0"
            initial={{ scale: 1.14, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1], delay: 0.55 }}
            style={{
              // Daylight wash rather than the old near-black scrim, so the skyline
              // still reads while slate text stays legible on top of it.
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.62), rgba(248,250,252,.94)), url("/BG/KL Twintower-2.png")',
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />

          <div className="container relative z-10 mx-auto max-w-[1400px] px-5 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl"
            >
              <Link
                to="/"
                className="mb-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600 transition-colors hover:border-[#CD5C5C]/50 hover:text-slate-900"
                style={{ fontFamily: THEME.condensed }}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Link>

              <h1
                className="text-4xl leading-[1.02] text-slate-900 sm:text-6xl lg:text-7xl xl:text-8xl uppercase"
                style={{ fontFamily: THEME.display, letterSpacing: "0.02em" }}
              >
                {["TAKE CONTROLS", "OF AN UNFORGETABLE", "EXPERIENCE"].map((line, i) => (
                  <motion.span
                    key={line}
                    className="block"
                    initial={{ opacity: 0, y: 26 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.75, delay: 0.85 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {line}
                  </motion.span>
                ))}
              </h1>

              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 16, delay: 1.3 }}
                className="mt-7 inline-flex items-baseline gap-3 rounded-full border border-slate-200 bg-white/85 px-6 py-3"
              >
                <span
                  className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-700"
                  style={{ fontFamily: THEME.condensed }}
                >
                  From
                </span>
                <span className="text-3xl md:text-4xl" style={{ fontFamily: THEME.display, color: THEME.accent }}>
                  RM699
                </span>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.45 }}
                className="mt-7 max-w-2xl text-sm leading-relaxed text-slate-700 md:text-lg"
              >
                Experience what it feels like to fly a real aircraft with professional pilots and guided
                introductory flight experiences.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 1.6 }}
                className="mt-9 flex flex-wrap gap-4"
              >
                <ActionLink href="#book-now">Book Your Flight</ActionLink>
                <ActionLink href={WHATSAPP} variant="secondary" external>
                  Book via WhatsApp
                </ActionLink>
              </motion.div>
            </motion.div>

            {/* Trust strip */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.8 }}
              className="mt-16 grid grid-cols-2 gap-3 lg:grid-cols-4"
            >
              {TRUST_STRIP.map(item => (
                <div
                  key={item}
                  className="rounded-2xl border border-black/5 bg-white/85 px-4 py-4 text-center text-[11px] font-semibold text-slate-700 md:text-sm"
                >
                  {item}
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── BOOKING WIZARD ──
            The same component the home page renders at #booking. It brings its
            own light background and its own id="booking", so the wrapper carries
            a distinct id to anchor against without duplicating that one, and
            scroll-mt-20 keeps the fixed header from covering its top. */}
        <section id="book-now" className="scroll-mt-20">
          <Suspense
            fallback={
              <div className="flex min-h-[420px] items-center justify-center">
                <BrandLoader label="Preparing your booking" />
              </div>
            }
          >
            <BookingWizard />
          </Suspense>
        </section>

        {/* ── MEETING POINT ── */}
        <section id="airport-info" className="scroll-mt-24 py-20 md:py-28">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <SectionTitle subtitle="Your aviation journey begins here. Easy access, ample parking and professional flight facilities.">
              Our Meeting Point
            </SectionTitle>

            <div className="grid gap-6 md:grid-cols-3">
              {MEETING_POINT.map((card, i) => (
                <Reveal key={card.title} delay={i * 0.1}>
                  <GlassCard className="h-full p-7">
                    <h3
                      className="text-xl uppercase text-slate-900 md:text-2xl"
                      style={{ fontFamily: THEME.display, letterSpacing: "0.04em" }}
                    >
                      {card.title}
                    </h3>
                    <ul className="mt-5 space-y-2.5">
                      {card.items.map(item => (
                        <li key={item} className="flex items-start gap-3 text-sm text-slate-600">
                          <span
                            className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                            style={{ background: THEME.accent }}
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </GlassCard>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.15}>
              <GlassCard hover={false} className="mt-10 overflow-hidden">
                <iframe
                  title="OneDayPilot flight operations location"
                  src="https://maps.google.com/maps?q=Aerotree+Flight+Services+Hangar+2&t=&z=17&ie=UTF8&iwloc=&output=embed"
                  width="100%"
                  height={500}
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="block w-full grayscale-[0.35] transition-[filter] duration-500 hover:grayscale-0"
                />
                <div className="flex justify-center border-t border-black/5 bg-white/85 p-6">
                  <ActionLink
                    href="https://maps.google.com/maps?q=Aerotree+Flight+Services+Hangar+2"
                    external
                  >
                    <MapPin className="h-4 w-4" /> Get Directions
                  </ActionLink>
                </div>
              </GlassCard>
            </Reveal>
          </div>
        </section>

        {/* ── ROUTES ── */}
        <section id="routes" className="scroll-mt-24 py-20 md:py-28">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <SectionTitle subtitle="Actual routes may vary depending on weather conditions and air traffic control instructions.">
              Flight Routes Around Kuala Lumpur
            </SectionTitle>

            <div className="grid gap-6 md:grid-cols-3 md:gap-8">
              {ROUTES.map((route, i) => (
                <Reveal key={route.title} delay={i * 0.12}>
                  <GlassCard className="group h-full">
                    <div className="relative h-[320px] overflow-hidden md:h-[420px]">
                      <div
                        className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                        style={{
                          backgroundImage: `url('${route.image}')`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                    </div>
                    <div className="p-7">
                      <h3
                        className="text-xl uppercase text-slate-900 md:text-2xl"
                        style={{ fontFamily: THEME.display, letterSpacing: "0.04em" }}
                      >
                        {route.title}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">{route.body}</p>
                    </div>
                  </GlassCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── AIRCRAFT ── */}
        <section id="aircraft" className="scroll-mt-24 py-20 md:py-28">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <SectionTitle subtitle="Fly in professionally maintained aircraft operated by Certified Pilots.">
              Aircraft Available For Flight Experience
            </SectionTitle>

            <div className="grid gap-6 md:grid-cols-3 md:gap-8">
              {AIRCRAFT.map((plane, i) => (
                <Reveal key={plane.name} delay={i * 0.12}>
                  <GlassCard className="group h-full">
                    <div className="relative h-[320px] overflow-hidden">
                      <div
                        className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                        style={{
                          backgroundImage: `url('${plane.image}')`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                    </div>
                    <div className="p-7">
                      <h3
                        className="text-2xl uppercase text-slate-900"
                        style={{ fontFamily: THEME.display, letterSpacing: "0.04em" }}
                      >
                        {plane.name}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">{plane.blurb}</p>
                      <ul className="mt-5 space-y-2.5">
                        {plane.points.map(point => (
                          <li key={point} className="flex items-start gap-3 text-sm text-slate-600">
                            <span
                              className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                              style={{ background: THEME.accent }}
                            />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </GlassCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── SEAPLANE ── */}
        <section className="relative overflow-hidden py-20 md:py-28">
          {/* Seaplane drifting across the section. Kept: it runs once, and a
              translate on a composited layer is close to free. The infinite
              bob that used to sit on the aircraft photo below was not — it
              never stopped, so it took a frame budget for the whole visit. */}
          <motion.div
            className="pointer-events-none absolute top-10 z-0 w-40 opacity-30 md:w-72"
            initial={{ x: "-20vw" }}
            whileInView={{ x: "115vw" }}
            viewport={{ once: true }}
            transition={{ duration: 14, ease: "linear" }}
          >
            <img src="/BG/superpetrel-flyYX.png" alt="" loading="lazy" className="h-auto w-full" />
          </motion.div>

          <div className="container relative z-10 mx-auto max-w-[1400px] px-5 lg:px-8">
            <GlassCard hover={false} patterned className="p-8 md:p-14">
              <div className="grid items-center gap-10 lg:grid-cols-2">
                <Reveal>
                  <div
                    className="h-[280px] bg-contain bg-center bg-no-repeat md:h-[420px]"
                    style={{ backgroundImage: "url('/BG/Super Petrel XP Plus 2.png')" }}
                  />
                </Reveal>

                <Reveal delay={0.12}>
                  <h2
                    className="text-3xl uppercase leading-[1.08] text-slate-900 md:text-5xl"
                    style={{ fontFamily: THEME.display, letterSpacing: "0.03em" }}
                  >
                    Seaplane Experience
                    <br />
                    <span style={{ color: THEME.accent }}>Super Petrel XP Plus</span>
                  </h2>
                  <p className="mt-6 text-sm leading-relaxed text-slate-700 md:text-base">
                    Discover Malaysia from a completely different perspective. Experience water takeoffs, water
                    landings and breathtaking scenery aboard one of the world's most unique amphibious aircraft.
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-slate-700 md:text-base">
                    Whether you are an aviation enthusiast, adventure seeker or simply looking for a
                    once-in-a-lifetime gift, the Super Petrel XP Plus delivers an unforgettable experience.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-4">
                    <ActionLink href="/BG/Super-Petrel-XP-Plus-Flyer.pdf" download>
                      Download Flyer
                    </ActionLink>
                    <ActionLink
                      href="https://www.onedaypilot.com/?sharePackageId=869f5818-d19a-4547-a028-96eca5d24a76#booking"
                      variant="secondary"
                      external
                    >
                      Schedule Demo
                    </ActionLink>
                  </div>
                </Reveal>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* ── WHY PEOPLE LOVE ── */}
        <section className="py-20 md:py-28">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <SectionTitle subtitle="More than a sightseeing flight. An aviation experience you'll remember forever.">
              Why People Love OneDayPilot
            </SectionTitle>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {HIGHLIGHTS.map((item, i) => (
                <Reveal key={item.title} delay={i * 0.1}>
                  <GlassCard className="h-full p-7 text-center">
                    <h3
                      className="text-xl uppercase text-slate-900"
                      style={{ fontFamily: THEME.display, letterSpacing: "0.04em" }}
                    >
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.body}</p>
                  </GlassCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── REVIEWS ── */}
        <section className="py-20 md:py-28">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <SectionTitle subtitle="Thousands of guests have already experienced flight with us.">
              What Our Customers Say
            </SectionTitle>

            <div className="grid gap-6 md:grid-cols-3">
              {REVIEWS.map((review, i) => (
                <Reveal key={review.author} delay={i * 0.12}>
                  <GlassCard className="h-full p-8">
                    <div className="text-lg tracking-[0.15em]">⭐⭐⭐⭐⭐</div>
                    <p className="mt-4 text-sm leading-relaxed text-slate-700 md:text-base">{review.quote}</p>
                    <p
                      className="mt-6 text-[12px] font-black uppercase tracking-[0.2em]"
                      style={{ color: THEME.accent, fontFamily: THEME.condensed }}
                    >
                      {review.author}
                    </p>
                  </GlassCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="scroll-mt-24 py-20 md:py-28">
          <div className="container mx-auto max-w-4xl px-5 lg:px-8">
            <SectionTitle subtitle="Everything you need to know before your flight experience.">
              Frequently Asked Questions
            </SectionTitle>
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <FaqItem key={faq.q} q={faq.q} a={faq.a} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── TRUST BAR ── */}
        <section className="py-10">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal>
              <div className="grid gap-3 rounded-3xl border border-black/5 bg-white/85 p-6 sm:grid-cols-2 lg:grid-cols-4">
                {TRUST_BAR.map(item => (
                  <div key={item} className="text-center text-xs font-semibold text-slate-700 md:text-sm">
                    {item}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── SOCIAL CTA ── */}
        <section className="py-20 md:py-28">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal>
              <GlassCard hover={false} patterned className="p-10 text-center md:p-16">
                <h2
                  className="text-3xl uppercase text-slate-900 md:text-5xl"
                  style={{ fontFamily: THEME.display, letterSpacing: "0.03em" }}
                >
                  Follow Our Aviation Adventures
                </h2>
                <p className="mt-5 text-sm text-slate-700 md:text-base">
                  Share your flight experience and tag us using{" "}
                  <span style={{ color: THEME.accent }}>#OneDayPilot</span>
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-4">
                  <ActionLink href="https://instagram.com/onedaypilot" external>
                    Instagram
                  </ActionLink>
                  <ActionLink href="https://facebook.com/onedaypilot" variant="secondary" external>
                    Facebook
                  </ActionLink>
                  <ActionLink href="https://tiktok.com/@onedaypilot" variant="secondary" external>
                    TikTok
                  </ActionLink>
                </div>
              </GlassCard>
            </Reveal>
          </div>
        </section>

        {/* ── FINAL STRIP ── */}
        <section className="pb-24 pt-10">
          <div className="container mx-auto max-w-[1400px] px-5 text-center lg:px-8">
            <Reveal>
              <h2
                className="text-3xl uppercase leading-tight text-slate-900 md:text-6xl"
                style={{ fontFamily: THEME.display, letterSpacing: "0.03em" }}
              >
                Your Aviation Journey Starts Today
              </h2>
              <p className="mx-auto mt-6 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
                Whether you dream of becoming a pilot or simply wish to experience the thrill of flight,
                OneDayPilot offers an unforgettable introduction to aviation.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-4">
                <ActionLink href="#book-now">Book Your Flight</ActionLink>
                <ActionLink href={WHATSAPP} variant="secondary" external>
                  Book Instantly via WhatsApp
                </ActionLink>
              </div>
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 md:text-sm">
                ⚡ Limited daily slots available – booking required in advance
              </p>
            </Reveal>
          </div>
        </section>
      </PageShell>

      <Footer />

      {/* Floating WhatsApp.
          The entrance is still framer, but the halo used to be animate-ping —
          an infinite scale+fade on a fixed element, which forces the compositor
          to keep that layer live for the entire visit, scrolling or not. It is
          a hover-only ring now. */}
      <motion.a
        href={WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Book via WhatsApp"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18, delay: 2 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.94 }}
        // Bottom-right with clearance from the edge. FloatingCart sits at
        // bottom-24 right-6, so this stays below it without overlapping.
        className="group fixed bottom-8 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-slate-900 shadow-[0_12px_40px_-8px_rgba(37,211,102,0.7)]"
      >
        <span className="pointer-events-none absolute inset-0 rounded-full bg-[#25D366] opacity-0 transition-all duration-500 group-hover:scale-150 group-hover:opacity-25" />
        <svg viewBox="0 0 448 512" width="28" height="28" fill="currentColor" className="relative z-10">
          <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.2-8.5-44.2-27.1-16.4-14.6-27.4-32.7-30.6-38.1-3.2-5.4-.3-8.3 2.4-11.1 2.5-2.5 5.5-6.5 8.3-9.7 2.8-3.2 3.7-5.5 5.5-9.2 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 13.2 5.7 23.5 9.2 31.6 11.8 13.3 4.2 25.4 3.6 35 2.2 10.7-1.5 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
        </svg>
      </motion.a>
    </>
  );
}
