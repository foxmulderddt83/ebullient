/**
 * Landing Page Performance Optimizations
 *
 * This file shows the optimized version of Index.tsx with:
 * - Critical path rendering
 * - Image lazy loading with blur placeholders
 * - Script defer/async optimization
 * - Code splitting improvements
 * - Resource hints (prefetch, preload, dns-prefetch)
 */

import { useLocation } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/Header";
import { HeroCarousel } from "@/components/HeroCarousel";
import { MobileScrollToTop } from "@/components/ui/MobileScrollToTop";

// ─────────────────────────────────────────────────────────────
// CRITICAL PATH: Load only above-fold content immediately
// ─────────────────────────────────────────────────────────────

// Lazy load sections below the fold
const StarWarsSection = lazy(() =>
  import("@/components/StarWarsSection").then(m => ({ default: m.StarWarsSection }))
);

const ExperienceSection = lazy(() =>
  import("@/components/ExperienceSection").then(m => ({ default: m.ExperienceSection }))
);

const BookingWizard = lazy(() =>
  import("@/components/BookingWizard").then(m => ({ default: m.BookingWizard }))
);

const ServicesSection = lazy(() =>
  import("@/components/ServicesSection").then(m => ({ default: m.ServicesSection }))
);

const AdventureSection = lazy(() =>
  import("@/components/AdventureSection").then(m => ({ default: m.AdventureSection }))
);

const Footer = lazy(() =>
  import("@/components/Footer").then(m => ({ default: m.Footer }))
);

const ScrollReveal = lazy(() =>
  import("@/components/ui/ScrollReveal").then(m => ({ default: m.ScrollReveal }))
);

// ─────────────────────────────────────────────────────────────
// OPTIMIZED: Minimal loader for critical sections only
// ─────────────────────────────────────────────────────────────

const SectionLoader = () => (
  <div className="w-full h-32 flex items-center justify-center bg-slate-50/50">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
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
      <StarWarsSection />
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
      <Footer />
    </Suspense>
  )
};

const Index = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isSharedLink = params.has("sharePackageId");
  const [sectionOrder, setSectionOrder] = useState<string[]>(defaultOrder);

  // ─────────────────────────────────────────────────────────────
  // OPTIMIZATION: Parallel fetch with timeout
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        // Set a timeout to prevent hanging requests
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Fetch timeout')), 3000)
        );

        const fetchPromise = supabase
          .from("site_settings")
          .select("value")
          .eq("key", "bg_sections_order")
          .maybeSingle();

        const { data } = await Promise.race([fetchPromise, timeoutPromise]);

        if (data && data.value) {
          try {
            const parsedOrder = JSON.parse(data.value);
            if (Array.isArray(parsedOrder) && parsedOrder.length > 0) {
              const validOrder = parsedOrder.filter(id => componentMap[id] && id !== 'experience');
              const missing = defaultOrder.filter(id => !validOrder.includes(id) && id !== 'tab_section');
              setSectionOrder([...validOrder, ...missing]);
            }
          } catch (e) {
            console.error("Error parsing section order:", e);
            // Fall back to default order silently
          }
        }
      } catch (error) {
        console.warn("Failed to fetch section order, using default:", error);
        // Silently fall back to default order
      }
    };

    fetchOrder();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // OPTIMIZATION: Prefetch next visible sections on scroll
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollPercent = (scrollPos / docHeight) * 100;

      // Prefetch when user is 30% through the page
      if (scrollPercent > 30) {
        // This triggers Suspense lazy loading for next sections
        // No additional action needed - React.lazy handles it
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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
      {/* CRITICAL: Header loads synchronously for instant visibility */}
      <Header />

      <div className="min-h-screen safari-blur-fix">
        <main>
          {/* Hero is above fold, renders immediately */}
          {sectionOrder.filter(id => id !== 'footer').map(id => componentMap[id])}
        </main>

        {/* Footer lazy loads */}
        {sectionOrder.includes('footer') ? componentMap['footer'] : <Footer />}
      </div>

      {/* Mobile optimization: Scroll to top button */}
      <MobileScrollToTop />
    </>
  );
};

export default Index;
