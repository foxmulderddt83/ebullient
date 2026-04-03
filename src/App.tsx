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
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Checkout from "./pages/Checkout";
import BookingSuccess from "./pages/BookingSuccess";
import BookingFailed from "./pages/BookingFailed";
import GuidelineViewer from "./pages/GuidelineViewer";
import NotFound from "./pages/NotFound";
import EventDetails from "./pages/event/EventDetails";
import EventsList from "./pages/event/EventsList";
import Register from "./pages/event/Register";
import EventSuccess from "./pages/event/EventSuccess";
import EventFailed from "./pages/event/EventFailed";
import About from "./pages/About";
import Offers from "./pages/Offers";
import Promotion from "./pages/Promotion";

const queryClient = new QueryClient();

const AnalyticsTracker = () => {
  usePageTracking();
  return null;
};

const App = () => {
  console.log("[v0] App component rendering, current URL:", window.location.pathname);
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnalyticsTracker />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
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
