import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  PageShell,
  PageTransition,
  Reveal,
  SectionTitle,
  GlassCard,
  ActionLink,
  THEME,
} from "@/components/page/PageChrome";
import { ArrowLeft, AlertTriangle, Megaphone, FileDown } from "lucide-react";

/**
 * Flight Information & Preparation Guide.
 *
 * Ported from the standalone public/flight-information.html, which the footer
 * linked to directly and which rendered with no site header or footer. Copy is
 * carried over verbatim; the page's own hand-rolled footer is dropped in favour
 * of the shared <Footer />.
 */

const STORAGE = "https://kjukdoqkunuifiorcdpz.supabase.co/storage/v1/object/public/media";

const JOURNEY = [
  { step: "1. Check-In", body: <>Arrival and registration.</> },
  {
    step: "2. Safety Briefing",
    body: (
      <>
        Meet your pilot and learn
        <br /> pre-flight check.
      </>
    ),
  },
  { step: "3. Flight Experience", body: <>Take the controls under supervision.</> },
  { step: "4. Photos &amp; Debrief", body: <>Capture your memories after landing.</> },
];

const REQUIREMENTS = [
  { title: "🪪 Identification", body: <>Identification Card or Passport</> },
  {
    title: "👕 Dress Code",
    body: (
      <>
        Wear comfortable clothing, long trousers or jeans and covered shoes.
        <br />
        Please bring your NRIC or passport on the flight day.
      </>
    ),
  },
  { title: "📏 Height Requirement", body: <>Height : 152cm-193cm</> },
  {
    title: "⚖️ Weight Requirement",
    body: <>Weight : Max 3 passenger with combine weight not more than 230kg.</>,
  },
  {
    title: "👦 Age Requirement",
    body: (
      <>
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
  { title: "⏰ Arrival Time", body: <>Check in 60 minutes before your flight</> },
];

const ARRIVAL = [
  {
    title: "📍 Location",
    body: (
      <>
        All flight experiences operate from Sultan Abdul Aziz Shah Airport (Subang Airport).
        <br />
        <br />
        Please arrive at least 60 minutes before your scheduled flight.
        <br />
        <br />
        Your final meeting point will be confirmed by our team before your flight.
      </>
    ),
  },
  {
    title: "🚗 Parking",
    body: (
      <>
        Visitor parking is available within the airport vicinity.
        <br />
        <br />
        Please refer to the parking guide below before arrival.
      </>
    ),
  },
];

const FIND_US = [
  {
    image: `${STORAGE}/backgrounds/1782178025704_SubangAP-1.jpg`,
    title: "Step 1",
    body: (
      <>
        Arrive at Sultan Abdul Aziz Shah Airport (Subang Airport).
        <br />
        <br />
        Look for the terminal entrance area near MyNews.
      </>
    ),
  },
  {
    image: `${STORAGE}/backgrounds/1782178021221_SubangAP-2.jpeg`,
    title: "Step 2",
    body: (
      <>
        Proceed to SkyPark Terminal.
        <br />
        <br />
        Have your booking details ready and wait for further instructions.
      </>
    ),
  },
  {
    image: `${STORAGE}/backgrounds/1782178026136_SubangAP-overview.jpg`,
    title: "Airport Overview",
    body: (
      <>
        Both Terminal Meeting Point and Office Meeting Point are located within Subang Airport.
        <br />
        <br />
        Our team will guide you to the correct location.
      </>
    ),
  },
];

const MEETING_POINTS = [
  {
    image: `${STORAGE}/backgrounds/1782178025941_SubangAP-MP1.jpg`,
    title: "Terminal Meeting Point",
    body: (
      <>
        Inside SkyPark Terminal.
        <br />
        <br />
        Our representative will meet you at the designated waiting area.
      </>
    ),
  },
  {
    image: `${STORAGE}/backgrounds/1782178021577_SubangAP-MP2.jpeg`,
    title: "Office Meeting Point",
    body: (
      <>
        OneDayPilot Office (Control Post 1)
        <br />
        <br />
        Please proceed here only if instructed by our team.
      </>
    ),
  },
];

const TRANSPORT = [
  { title: "🚆 SkyPark Link", body: <>Direct train connection to SkyPark Terminal.</> },
  { title: "🚕 Grab / Taxi", body: <>Set destination to: SkyPark Terminal, Subang Airport</> },
];

const GALLERIES = [
  {
    heading: "✈ Take The Pilot Seat",
    subtitle:
      "Experience the excitement of sitting in a real aircraft cockpit. Learn basic flight controls and enjoy stunning aerial views while flying alongside a professional pilot.",
    images: [
      `${STORAGE}/backgrounds/1782178015026_cockpit-1.jpeg`,
      `${STORAGE}/backgrounds/1782178015622_cockpit-2.jpeg`,
      `${STORAGE}/backgrounds/1782178015898_cockpit-3.jpeg`,
    ],
  },
  {
    heading: "📹 Relive Every Moment",
    subtitle:
      "Capture your flight from unique angles with optional inflight GoPro and 360° recording services. Perfect for sharing your aviation adventure with friends and family.",
    images: [
      `${STORAGE}/backgrounds/1782178017203_gopro-1.jpeg`,
      `${STORAGE}/backgrounds/1782178017475_gopro-2.jpeg`,
      `${STORAGE}/backgrounds/1782178017899_gopro-3.jpeg`,
    ],
  },
  {
    heading: "📸 Moments To Remember",
    subtitle:
      "Whether you're celebrating a special occasion, sharing the adventure with loved ones or simply creating lifelong memories, every flight becomes a story worth telling.",
    images: [
      `${STORAGE}/backgrounds/1782178016260_family-1.jpeg`,
      `${STORAGE}/backgrounds/1782178016604_family-2.jpeg`,
      `${STORAGE}/backgrounds/1782178016873_family-3.jpeg`,
    ],
  },
];

const AVIATION_INFO = [
  {
    title: "Safety & Compliance",
    body: "Flights are conducted by certified pilots in accordance with applicable aviation safety requirements. Aircraft are maintained and operated in compliance with relevant aviation regulations.",
  },
  {
    title: "Insurance & Membership",
    body: "All flights are covered by aviation insurance. Participants are required to complete the necessary Social Member registration with the flying club prior to the flight experience.",
  },
  {
    title: "Future Pathways",
    body: "Participants interested in aviation may continue their journey through flying clubs, recognised flight schools and pilot licensing pathways. Our team will be happy to share available options after your experience.",
  },
  {
    title: "Operational Notice",
    body: "Flight operations are subject to weather conditions, air traffic control requirements and overall safety considerations. Safety will always take priority over scheduling.",
  },
];

/**
 * Highlighted advisory panel — the old .notice-box.
 *
 * The accent rule used to pulse on an infinite loop and the panel carried a
 * backdrop blur. Three of these sit on the page, so that was three permanently
 * running animations plus three backdrop re-samples on every scrolled frame.
 * A solid accent rule and an opaque tint read the same and cost nothing.
 */
const NoticeBox = ({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Reveal>
    <div className="relative overflow-hidden rounded-2xl border border-[#CD5C5C]/30 bg-[#CD5C5C]/10 p-7 md:p-9">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: THEME.accent }}
      />
      <div className="flex items-start gap-4">
        <span className="mt-0.5 shrink-0" style={{ color: THEME.accent }}>
          {icon}
        </span>
        <div className="text-sm leading-relaxed text-slate-700 md:text-base">{children}</div>
      </div>
    </div>
  </Reveal>
);

/** Photo card used by the arrival steps and meeting points. */
const PhotoCard = ({
  image,
  title,
  body,
  delay,
}: {
  image: string;
  title: string;
  body: React.ReactNode;
  delay: number;
}) => (
  <Reveal delay={delay}>
    <GlassCard className="group h-full">
      <div className="relative h-56 overflow-hidden md:h-64">
        <img
          src={image}
          alt={title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
      </div>
      <div className="p-7">
        <h3
          className="text-xl uppercase text-slate-900 md:text-2xl"
          style={{ fontFamily: THEME.display, letterSpacing: "0.04em" }}
        >
          {title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{body}</p>
      </div>
    </GlassCard>
  </Reveal>
);

export default function FlightInformation() {
  return (
    <>
      <PageTransition label="Flight Information" />
      <Header />
      <PageShell>
        {/* ── HERO ── */}
        <section className="relative flex min-h-[70vh] items-center overflow-hidden pt-28 pb-16">
          <motion.div
            className="absolute inset-0 z-0"
            initial={{ scale: 1.12, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1], delay: 0.55 }}
            style={{
              // Daylight wash rather than a near-black scrim. Light at the top so
              // the airport photograph actually reads, then thickening downward:
              // the heading and body sit over the lower half, and slate text needs
              // the extra cover there to stay legible. It also lets the hero blend
              // into the page background instead of ending on a hard edge.
              backgroundImage: `linear-gradient(rgba(255,255,255,.20) 0%, rgba(255,255,255,.52) 45%, rgba(248,250,252,.92) 100%), url('${STORAGE}/backgrounds/1782178026136_SubangAP-overview.jpg')`,
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
                className="text-4xl uppercase leading-[1.04] text-slate-900 sm:text-6xl lg:text-7xl"
                style={{ fontFamily: THEME.display, letterSpacing: "0.02em" }}
              >
                {["Flight Information &", "Preparation Guide"].map((line, i) => (
                  <motion.span
                    key={line}
                    className="block"
                    initial={{ opacity: 0, y: 26 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.75, delay: 0.9 + i * 0.13, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {line}
                  </motion.span>
                ))}
              </h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.25 }}
                className="mt-7 max-w-2xl text-sm leading-relaxed text-slate-700 md:text-lg"
              >
                Everything you need to know before your OneDayPilot experience.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 1.4 }}
                className="mt-9"
              >
                <ActionLink href="/packages">Back To Packages</ActionLink>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── IMPORTANT NOTICE ── */}
        <section className="py-10">
          <div className="container mx-auto max-w-5xl px-5 lg:px-8">
            <NoticeBox icon={<AlertTriangle className="h-6 w-6" />}>
              <strong className="block text-slate-900">✈️ Important Notice</strong>
              <span className="mt-2 block">
                All flight experiences are subject to weather conditions and aircraft availability. Please
                arrive at least 60 minutes before departure.
              </span>
            </NoticeBox>
          </div>
        </section>

        {/* ── FLIGHT DAY JOURNEY ── */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <SectionTitle>Your Flight Day Journey</SectionTitle>

            <div className="relative">
              {/* Runway line linking the steps */}
              <motion.div
                className="absolute left-0 right-0 top-[46px] hidden h-px origin-left lg:block"
                style={{ background: `linear-gradient(90deg, transparent, ${THEME.accent}, transparent)` }}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {JOURNEY.map((item, i) => (
                  <Reveal key={item.step} delay={i * 0.12}>
                    <div className="text-center">
                      <div
                        className="relative z-10 mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-full border-2 bg-white shadow-[0_12px_30px_-14px_rgba(15,23,42,0.35)] transition-transform duration-300 ease-out hover:scale-110"
                        style={{ borderColor: THEME.accent }}
                      >
                        <span className="text-4xl" style={{ fontFamily: THEME.display, color: THEME.accent }}>
                          {i + 1}
                        </span>
                      </div>
                      <h3
                        className="mt-5 text-lg uppercase text-slate-900 md:text-xl"
                        style={{ fontFamily: THEME.display, letterSpacing: "0.05em" }}
                      >
                        {item.step.replace(/^\d+\.\s*/, "")}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── PARTICIPANT REQUIREMENTS ── */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <SectionTitle>Participant Requirements</SectionTitle>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {REQUIREMENTS.map((item, i) => (
                <Reveal key={item.title} delay={i * 0.08}>
                  <GlassCard className="h-full p-7">
                    <h3
                      className="text-xl uppercase text-slate-900 md:text-2xl"
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

        {/* ── GETTING HERE ── */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto max-w-5xl px-5 lg:px-8">
            <SectionTitle subtitle="Everything you need to know before arriving at Subang Airport for your OneDayPilot experience.">
              Getting Here &amp; Meeting Point Guide
            </SectionTitle>
            <NoticeBox icon={<Megaphone className="h-6 w-6" />}>
              <strong className="block text-slate-900">📢 Meeting Point Confirmation</strong>
              <span className="mt-2 block">
                Subang Airport has multiple operating areas. Your final meeting point will be confirmed via
                WhatsApp before your flight day. Please do not proceed directly to Terminal Meeting Point or
                Office Meeting Point unless instructed by our team.
              </span>
            </NoticeBox>
          </div>
        </section>

        {/* ── ARRIVAL INFORMATION ── */}
        <section className="pb-20 md:pb-24">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <div className="grid gap-6 md:grid-cols-2">
              {ARRIVAL.map((item, i) => (
                <Reveal key={item.title} delay={i * 0.1}>
                  <GlassCard className="h-full p-7 md:p-9">
                    <h3
                      className="text-xl uppercase text-slate-900 md:text-2xl"
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

        {/* ── PARKING GUIDE ── */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <SectionTitle subtitle="Recommended parking area for visitors.">Parking Guide</SectionTitle>
            <Reveal>
              <GlassCard hover={false} className="p-3 md:p-4">
                <img
                  src="/BG/parking-map.jpg"
                  alt="Recommended visitor parking area at Subang Airport"
                  loading="lazy"
                  decoding="async"
                  className="w-full rounded-xl md:rounded-2xl"
                />
              </GlassCard>
            </Reveal>
          </div>
        </section>

        {/* ── HOW TO FIND US ── */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <SectionTitle subtitle="Please follow Steps 1 & 2 first. Your assigned meeting point will be confirmed by our team before your flight.">
              How To Find Us
            </SectionTitle>
            <div className="grid gap-6 md:grid-cols-3">
              {FIND_US.map((item, i) => (
                <PhotoCard key={item.title} {...item} delay={i * 0.12} />
              ))}
            </div>
          </div>
        </section>

        {/* ── MEETING POINTS ── */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <SectionTitle subtitle="Please proceed only to the meeting point assigned by our team.">
              Meeting Points
            </SectionTitle>
            <div className="grid gap-6 md:grid-cols-2">
              {MEETING_POINTS.map((item, i) => (
                <PhotoCard key={item.title} {...item} delay={i * 0.12} />
              ))}
            </div>
          </div>
        </section>

        {/* ── PUBLIC TRANSPORT ── */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <SectionTitle>Public Transport</SectionTitle>
            <div className="grid gap-6 md:grid-cols-2">
              {TRANSPORT.map((item, i) => (
                <Reveal key={item.title} delay={i * 0.1}>
                  <GlassCard className="h-full p-7 md:p-9">
                    <h3
                      className="text-xl uppercase text-slate-900 md:text-2xl"
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

        {/* ── WEATHER ── */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto max-w-4xl px-5 lg:px-8">
            <SectionTitle>Weather &amp; Rescheduling</SectionTitle>
            <Reveal>
              <GlassCard className="p-8 text-center md:p-12">
                <p className="text-sm leading-relaxed text-slate-700 md:text-lg">
                  Safety always comes first. Flights may be delayed or rescheduled due to weather. If
                  conditions remain unsafe, alternative dates will be offered.
                </p>
              </GlassCard>
            </Reveal>
          </div>
        </section>

        {/* ── CAPTURE YOUR EXPERIENCE ── */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <SectionTitle subtitle="Every flight creates unforgettable memories. From taking the controls in the cockpit to sharing the experience with family and friends, these moments will stay with you long after landing.">
              Capture Your Experience
            </SectionTitle>

            <div className="space-y-20">
              {GALLERIES.map(gallery => (
                <div key={gallery.heading}>
                  <Reveal className="text-center">
                    <h3
                      className="text-2xl uppercase text-slate-900 md:text-4xl"
                      style={{ fontFamily: THEME.display, letterSpacing: "0.04em" }}
                    >
                      {gallery.heading}
                    </h3>
                    <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
                      {gallery.subtitle}
                    </p>
                  </Reveal>

                  <div className="mt-8 grid gap-5 md:grid-cols-3">
                    {gallery.images.map((src, i) => (
                      <Reveal key={src} delay={i * 0.1}>
                        <div className="group overflow-hidden rounded-2xl border border-black/5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.22)] transition-transform duration-300 ease-out hover:-translate-y-2">
                          <img
                            src={src}
                            alt={gallery.heading}
                            loading="lazy"
                            decoding="async"
                            className="h-64 w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06] md:h-72"
                          />
                        </div>
                      </Reveal>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── AVIATION INFORMATION ── */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal>
              <GlassCard hover={false} patterned className="p-8 md:p-14">
                <h2
                  className="text-center text-3xl uppercase text-slate-900 md:text-5xl"
                  style={{ fontFamily: THEME.display, letterSpacing: "0.03em" }}
                >
                  ✈ Important Information
                </h2>
                <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-10">
                  {AVIATION_INFO.map((item, i) => (
                    <Reveal key={item.title} delay={i * 0.1}>
                      <div className="border-l-2 pl-5" style={{ borderColor: `${THEME.accent}55` }}>
                        <h3
                          className="text-lg uppercase text-slate-900 md:text-2xl"
                          style={{ fontFamily: THEME.display, letterSpacing: "0.04em" }}
                        >
                          {item.title}
                        </h3>
                        <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.body}</p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </GlassCard>
            </Reveal>
          </div>
        </section>

        {/* ── VISITOR GUIDE PDF ── */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto max-w-4xl px-5 lg:px-8">
            <Reveal>
              <GlassCard hover={false} patterned className="p-10 text-center md:p-14">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white/85">
                  <FileDown className="h-7 w-7" style={{ color: THEME.accent }} />
                </div>
                <h2
                  className="text-3xl uppercase text-slate-900 md:text-5xl"
                  style={{ fontFamily: THEME.display, letterSpacing: "0.03em" }}
                >
                  📘 Visitor Guide
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-700 md:text-base">
                  Planning your visit to Subang Airport?
                  <br />
                  <br />
                  Download our complete Visitor Guide for meeting points, parking information, flight day
                  preparation and important safety requirements.
                </p>
                <div className="mt-9 flex justify-center">
                  <ActionLink
                    href={`${STORAGE}/categories/1782171502494_Guide_Book.pdf`}
                    external
                  >
                    Download Visitor Guide (PDF)
                  </ActionLink>
                </div>
              </GlassCard>
            </Reveal>
          </div>
        </section>

        {/* ── DISCLAIMER ── */}
        <section className="pb-24">
          <div className="container mx-auto max-w-5xl px-5 lg:px-8">
            <NoticeBox icon={<AlertTriangle className="h-6 w-6" />}>
              <strong className="block text-slate-900">⚠ Disclaimer</strong>
              <span className="mt-2 block">
                This is an introductory flight experience only. Participation does not constitute flight
                training and does not lead to the issuance of any pilot licence, aviation qualification or
                certification.
              </span>
            </NoticeBox>
          </div>
        </section>
      </PageShell>

      <Footer />
    </>
  );
}
