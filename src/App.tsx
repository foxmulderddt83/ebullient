import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { FloatingCart } from "@/components/FloatingCart";
import { FloatingSupport } from "@/components/FloatingSupport";
import { SocialProofPopup } from "@/components/SocialProofPopup";
import { usePageTracking } from "@/lib/analytics";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BrandLoader } from "@/components/page/PageChrome";
import Index from "./pages/Index";

// Lazy load heavy pages
const Admin = lazy(() => import("./pages/Admin"));
const Checkout = lazy(() => import("./pages/Checkout"));
const BookingSuccess = lazy(() => import("./pages/BookingSuccess"));
const BookingFailed = lazy(() => import("./pages/BookingFailed"));
const GuidelineViewer = lazy(() => import("./pages/GuidelineViewer"));
const NotFound = lazy(() => import("./pages/NotFound"));
const EventDetails = lazy(() => import("./pages/event/EventDetails"));
const EventsList = lazy(() => import("./pages/event/EventsList"));
const Register = lazy(() => import("./pages/event/Register"));
const EventSuccess = lazy(() => import("./pages/event/EventSuccess"));
const EventFailed = lazy(() => import("./pages/event/EventFailed"));
const About = lazy(() => import("./pages/About"));
const Offers = lazy(() => import("./pages/Offers"));
const Promotion = lazy(() => import("./pages/Promotion"));
const PdfRender = lazy(() => import("./pages/PdfRender"));
const Packages = lazy(() => import("./pages/Packages"));
const FlightInformation = lazy(() => import("./pages/FlightInformation"));

const queryClient = new QueryClient();

// Loading component for Suspense and Initial Session
// Uses the shared BrandLoader so the first paint, the home page's section
// fallbacks and the marketing pages all show the same loading treatment.
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-white">
    <BrandLoader label="One Day Pilot" />
  </div>
);

const App = () => {
  const [isSessionReady, setIsSessionReady] = useState(false);

  useEffect(() => {
    const initSession = async () => {
      if (supabase) {
        try {
          // Force a small wait on mobile to ensure localStorage is readable
          if (window.innerWidth < 768) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          await supabase.auth.getSession();
        } catch (e) {
          console.error("Auth session init error:", e);
        }
      }
      setIsSessionReady(true);
    };

    initSession();

    // Globally refetch active queries when tab becomes visible or regains focus
    const handleAppVisible = () => {
      queryClient.invalidateQueries();
    };

    window.addEventListener('oneday:app-visible' as any, handleAppVisible);
    return () => window.removeEventListener('oneday:app-visible' as any, handleAppVisible);
  }, []);

  if (!isSessionReady) return <PageLoader />;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CartProvider>
            {/* SVG Filters for Logo */}
            <svg width="0" height="0" className="absolute pointer-events-none">
              <defs>
                {/* Filter to remove white background */}
                <filter id="remove-white-bg" colorInterpolationFilters="sRGB">
                  <feColorMatrix type="matrix" values="
                    1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    -1 -1 -1 1 1
                  " />
                </filter>
                {/* Filter to remove black background and keep red/white */}
                <filter id="remove-black-bg" colorInterpolationFilters="sRGB">
                  <feColorMatrix type="matrix" values="
                    1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    1 1 1 0 -0.5
                  " />
                </filter>
              </defs>
            </svg>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/booking/success" element={<BookingSuccess />} />
                <Route path="/booking/failed" element={<BookingFailed />} />
                <Route path="/guidelines" element={<GuidelineViewer />} />
                <Route path="/events" element={<EventsList />} />
                <Route path="/event" element={<EventDetails />} />
                <Route path="/event/register" element={<Register />} />
                <Route path="/event/success" element={<EventSuccess />} />
                <Route path="/event/failed" element={<EventFailed />} />
                <Route path="/offers" element={<Offers />} />
                <Route path="/promotion" element={<Promotion />} />
                <Route path="/about" element={<About />} />
                <Route path="/packages" element={<Packages />} />
                <Route path="/flight-information" element={<FlightInformation />} />
                <Route path="/pdf-render" element={<PdfRender />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <FloatingCart />
            <FloatingSupport />
            <SocialProofPopup />
          </CartProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
