import { useLocation } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/Header";
import { HeroCarousel } from "@/components/HeroCarousel";
import { MobileScrollToTop } from "@/components/ui/MobileScrollToTop";
import { BrandLoader, PageTransition } from "@/components/page/PageChrome";

// Lazy load sections below the fold
const StarWarsSection = lazy(() => import("@/components/StarWarsSection").then(m => ({ default: m.StarWarsSection })));
const ExperienceSection = lazy(() => import("@/components/ExperienceSection").then(m => ({ default: m.ExperienceSection })));
const BookingWizard = lazy(() => import("@/components/BookingWizard").then(m => ({ default: m.BookingWizard })));
const ServicesSection = lazy(() => import("@/components/ServicesSection").then(m => ({ default: m.ServicesSection })));
const AdventureSection = lazy(() => import("@/components/AdventureSection").then(m => ({ default: m.AdventureSection })));
const Footer = lazy(() => import("@/components/Footer").then(m => ({ default: m.Footer })));
const ScrollReveal = lazy(() => import("@/components/ui/ScrollReveal").then(m => ({ default: m.ScrollReveal })));

// Loading placeholder for sections. Uses the same BrandLoader the Packages page
// and the page curtain use, so every wait on the site looks like one product
// rather than a different spinner per surface.
const SectionLoader = () => (
  <div className="w-full flex items-center justify-center bg-slate-50/50">
    <BrandLoader compact label="One Day Pilot" />
  </div>
);

const defaultOrder = [
  "hero",
  "starwars",
  "adventure",
  "booking",
  "services",
  "footer"
];

const componentMap: Record<string, React.ReactNode> = {
  "hero": <HeroCarousel key="hero" />,
  "starwars": (
    <Suspense key="starwars" fallback={<SectionLoader />}>
      <ScrollReveal>
        <StarWarsSection />
      </ScrollReveal>
    </Suspense>
  ),
  "adventure": (
    <Suspense key="adventure" fallback={<SectionLoader />}>
      <ScrollReveal>
        <AdventureSection />
      </ScrollReveal>
    </Suspense>
  ),
  "experience": (
    <Suspense key="experience" fallback={<SectionLoader />}>
      <ScrollReveal>
        <ExperienceSection />
      </ScrollReveal>
    </Suspense>
  ),
  "booking": (
    <div id="booking" key="booking">
      <Suspense fallback={<SectionLoader />}>
        <ScrollReveal>
          <BookingWizard />
        </ScrollReveal>
      </Suspense>
    </div>
  ),
  "services": (
    <div id="services" key="services">
      <Suspense fallback={<SectionLoader />}>
        <ScrollReveal>
          <ServicesSection />
        </ScrollReveal>
      </Suspense>
    </div>
  ),
  "footer": (
    <Suspense key="footer" fallback={<SectionLoader />}>
      <ScrollReveal>
        <Footer />
      </ScrollReveal>
    </Suspense>
  )
};

const Index = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isSharedLink = params.has("sharePackageId");
  const [sectionOrder, setSectionOrder] = useState<string[]>(defaultOrder);

  useEffect(() => {
    const fetchOrder = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "bg_sections_order")
        .maybeSingle();

      if (data && data.value) {
        try {
          const parsedOrder = JSON.parse(data.value);
          if (Array.isArray(parsedOrder) && parsedOrder.length > 0) {
            // Merge parsed order with missing default components
            const validOrder = parsedOrder.filter(id => componentMap[id] && id !== 'experience');
            const missing = defaultOrder.filter(id => !validOrder.includes(id) && id !== 'tab_section');
            setSectionOrder([...validOrder, ...missing]);
          }
        } catch (e) {
          console.error("Error parsing section order:", e);
        }
      }
    };

    fetchOrder();
  }, []);

  if (isSharedLink) {
    return (
      <div className="min-h-screen bg-slate-50 pt-10">
        <div id="booking" className="max-w-7xl mx-auto px-4">
          <BookingWizard />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Same arrival curtain the Packages page uses, so entering the site and
          moving between its pages feel like one piece. */}
      <PageTransition label="One Day Pilot" />
      <Header />
      <div className="min-h-screen safari-blur-fix">
        <main>
          {sectionOrder.filter(id => id !== 'footer').map(id => componentMap[id])}
        </main>
        {sectionOrder.includes('footer') ? componentMap['footer'] : <Footer />}
      </div>
      <MobileScrollToTop />
    </>
  );
};

export default Index;
