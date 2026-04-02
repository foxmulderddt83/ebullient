import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useAnimation, useInView, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Check, Clock, User, Shield, Route, Video, Shirt, Briefcase, Plane, ChevronLeft, ChevronRight } from "lucide-react";
import { BackgroundParticles } from "./ui/BackgroundParticles";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";

interface FlightPackage {
  id: string;
  name: string;
  price: number;
  promotion_price?: number | null;
  promotion_start_at?: string | null;
  promotion_end_at?: string | null;
  subtitle?: string;
  features: string[];
  is_popular?: boolean;
  image_url?: string;
  category_id: string;
  sort_order: number;
}

interface CategoryGroup {
  id: string;
  name: string;
  packages: FlightPackage[];
}

interface FlightPackagesSectionProps {
  onPackageSelect?: (categoryId: string, sortOrder: number, packageId: string) => void;
  onSelect?: () => void;
  onCategorySelect?: (categoryId: string, sortOrder: number) => void;
  hidePadding?: boolean;
  sortOrder?: number;
  categoryId?: string | null;
  showTitle?: boolean;
  buttonText?: string;
  isCompact?: boolean;
}

const Confetti = () => {
  const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"];
  
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[40] overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            y: -20,
            x: Math.random() * window.innerWidth,
            opacity: 1,
            rotate: 0
          }}
          animate={{
            y: window.innerHeight + 20,
            rotate: 360 + Math.random() * 360,
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            ease: "linear",
            delay: Math.random() * 2,
            repeat: Infinity,
            repeatDelay: Math.random() * 2
          }}
          style={{
            position: "absolute",
            width: 10 + Math.random() * 10,
            height: 10 + Math.random() * 10,
            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
            borderRadius: Math.random() > 0.5 ? "50%" : "0%"
          }}
        />
      ))}
    </div>,
    document.body
  );
};

export const FlightPackagesSection = ({ 
  onPackageSelect, 
  onSelect, 
  onCategorySelect,
  hidePadding = false,
  sortOrder = 0,
  categoryId = null,
  showTitle = false,
  buttonText,
  isCompact = false
}: FlightPackagesSectionProps) => {
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [celebratingPackageId, setCelebratingPackageId] = useState<string | null>(null);
  const [bgGradient, setBgGradient] = useState<string>("");
  const [promotionBannerUrl, setPromotionBannerUrl] = useState<string>("");
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  const [sharedPackageId, setSharedPackageId] = useState<string | null>(null);
  const { addItem, items } = useCart();
  const scrollRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const isInView = useInView(scrollRef);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000); // Update every second for countdown
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("sharePackageId");
    setSharedPackageId(sharedId);
  }, []);

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.paused === 'boolean') {
        setIsGlobalPaused(detail.paused);
      }
    };
    window.addEventListener('toggle-animation-freeze', handleToggle);
    return () => window.removeEventListener('toggle-animation-freeze', handleToggle);
  }, []);

  const handleSelect = (pkg: FlightPackage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Check if adding a sort_order=1 item requires a sort_order=0 item in cart
    if (pkg.sort_order === 1) {
      // Use category_id as the matching ID between sort_order 0 and 1
      const hasBase = items.some(i => i.category_id === pkg.category_id && i.sort_order === 0);
      if (!hasBase) {
        toast.error("Please add the main package first");
        return;
      }
    }
    
    // Check for active promotion
    const now = new Date();
    const start = pkg.promotion_start_at ? new Date(pkg.promotion_start_at) : null;
    const end = pkg.promotion_end_at ? new Date(pkg.promotion_end_at) : null;

    const isPromotionActive = pkg.promotion_price && 
      (!start || start <= now) &&
      (!end || end > now);
    
    const finalPrice = isPromotionActive && pkg.promotion_price ? Number(pkg.promotion_price) : Number(pkg.price);

    // Add to cart immediately
    addItem({
      id: pkg.id, // Use actual package ID for booking_items.package_id
      name: pkg.name,
      price: finalPrice,
      original_price: Number(pkg.price),
      promotion_end_at: isPromotionActive && pkg.promotion_end_at ? pkg.promotion_end_at : undefined,
      image_url: pkg.image_url,
      sort_order: pkg.sort_order,
      category_id: pkg.category_id
    });

    // Track selection
    trackEvent({
      action_type: 'click',
      entity_type: 'video', // Flight packages are often categorized as 'video' or 'experience' in this app's existing tracking
      entity_id: pkg.id,
      entity_name: `Package Selected: ${pkg.name}`
    });

    toast.success(`Added ${pkg.name} to cart`);

    // Trigger celebration
    setCelebratingPackageId(pkg.id);

    // Delay navigation/callbacks by 2 seconds
    setTimeout(() => {
      setCelebratingPackageId(null);
      // Restore automatic navigation/callbacks
      if (onPackageSelect) onPackageSelect(pkg.category_id, pkg.sort_order, pkg.id);
      if (onSelect) onSelect();
      if (onCategorySelect) onCategorySelect(pkg.category_id, pkg.sort_order);
    }, 2000);
  };

  const buildShareUrl = (packageId: string) => {
    const url = new URL(window.location.href);
    if (!url.hash) url.hash = "#booking";
    url.searchParams.set("sharePackageId", packageId);
    return url.toString();
  };

  const handleShare = async (pkg: FlightPackage, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = buildShareUrl(pkg.id);
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Share link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  const handleManualScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      setIsHovered(true); // Stop auto-scroll when manually interacting
      
      const container = scrollRef.current;
      const scrollAmount = direction === 'left' ? -400 : 400;
      
      // If clicking left and already near the start, scroll to absolute 0
      if (direction === 'left' && container.scrollLeft < 50) {
        container.scrollTo({
          left: 0,
          behavior: 'smooth'
        });
      } else {
        container.scrollBy({
          left: scrollAmount,
          behavior: 'smooth'
        });
      }
      
      // Resume auto-scroll after a delay if not hovered
      setTimeout(() => {
        if (!scrollRef.current?.matches(':hover')) {
          setIsHovered(false);
        }
      }, 3000);
    }
  };

  const allPackages = categoryGroups.flatMap(group => group.packages);

  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const startAnimation = async () => {
      if (isInView && !loading && allPackages.length > 0 && !isGlobalPaused && !isHovered) {
        const scrollWidth = scrollRef.current?.scrollWidth || 0;
        const clientWidth = scrollRef.current?.clientWidth || 0;
        const maxScroll = scrollWidth - clientWidth;

        if (maxScroll > 0) {
          controls.start({
            x: [null, -maxScroll],
            transition: {
              x: {
                repeat: Infinity,
                repeatType: "reverse",
                duration: 30,
                ease: "linear",
              },
            },
          });
        }
      } else {
        controls.stop();
      }
    };

    startAnimation();
  }, [isInView, loading, allPackages.length, controls, isGlobalPaused, isHovered]);

  useEffect(() => {
    const fetchPackages = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      
      try {
        // Fetch background gradient - Use booking wizard gradient as requested
        const { data: settingsData } = await supabase
          .from('site_settings')
          .select('key, value')
          .in('key', ['bg_gradient_booking_wizard', 'promotion_image_banner']);
        
        if (settingsData) {
          const gradientSetting = settingsData.find(s => s.key === 'bg_gradient_booking_wizard');
          if (gradientSetting) setBgGradient(gradientSetting.value);

          const bannerSetting = settingsData.find(s => s.key === 'promotion_image_banner');
          if (bannerSetting) setPromotionBannerUrl(bannerSetting.value);
        }

        if (sharedPackageId && sortOrder === 0) {
          const { data: sharedPkg, error: sharedError } = await supabase
            .from('packages')
            .select('*')
            .eq('id', sharedPackageId)
            .eq('is_active', true)
            .single();

          if (sharedError || !sharedPkg || sharedPkg.sort_order !== 0) {
            setCategoryGroups([]);
            return;
          }

          const { data: sharedCategory } = await supabase
            .from('categories')
            .select('id, name')
            .eq('id', sharedPkg.category_id)
            .single();

          const lines = sharedPkg.description ? sharedPkg.description.split(/\r?\n/).filter((f: string) => f.trim() !== '') : [];
          const subtitle = lines.length > 0 ? lines[0] : "";
          const features = lines.length > 1 ? lines.slice(1) : [];

          setCategoryGroups([{
            id: sharedCategory?.id || sharedPkg.category_id,
            name: sharedCategory?.name || "Shared Package",
            packages: [{
              id: sharedPkg.id,
              name: sharedPkg.name,
              price: typeof sharedPkg.price === 'string' ? parseFloat(sharedPkg.price) : sharedPkg.price,
              promotion_price: sharedPkg.promotion_price ? (typeof sharedPkg.promotion_price === 'string' ? parseFloat(sharedPkg.promotion_price) : sharedPkg.promotion_price) : null,
              promotion_start_at: sharedPkg.promotion_start_at,
              promotion_end_at: sharedPkg.promotion_end_at,
              subtitle: subtitle,
              features: features,
              is_popular: sharedPkg.name.toLowerCase().includes('business'),
              image_url: sharedPkg.image_url,
              category_id: sharedPkg.category_id,
              sort_order: sharedPkg.sort_order
            }]
          }]);
          return;
        }

        let finalCategories: { id: string, name: string }[] = [];

        if (categoryId) {
          // If a specific category is requested, just fetch that one
          const { data: catData, error: catError } = await supabase
            .from('categories')
            .select('id, name')
            .eq('id', categoryId)
            .single();
          
          if (!catError && catData) {
            finalCategories = [catData];
          }
        } else {
          // 1. Fetch categories that should be shown on main page
          const { data: categories, error: catError } = await supabase
            .from('categories')
            .select('id, name')
            .eq('is_main_page', true)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

          console.log("Main page categories found:", categories);

          if (catError) {
             console.error("Error fetching main page categories:", catError);
          }

          finalCategories = categories || [];
        }

        const categoryIds = finalCategories.map(c => c.id);

      // 2. Fetch packages
      if (categoryIds.length === 0) {
        setCategoryGroups([]);
        setLoading(false);
        return;
      }

      const query = supabase
        .from('packages')
        .select('*')
        .eq('is_active', true)
        .eq('sort_order', sortOrder)
        .in('category_id', categoryIds);

      const { data, error } = await query
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (!error && data) {
        const groups: CategoryGroup[] = finalCategories.map(cat => {
          const catPackages = data
            .filter(pkg => pkg.category_id === cat.id)
            .map(pkg => {
              // Parse description: Line 1 is subtitle, rest are features
              const lines = pkg.description ? pkg.description.split(/\r?\n/).filter(f => f.trim() !== '') : [];
              const subtitle = lines.length > 0 ? lines[0] : "";
              const features = lines.length > 1 ? lines.slice(1) : [];
              
              return {
                id: pkg.id,
                name: pkg.name,
                price: typeof pkg.price === 'string' ? parseFloat(pkg.price) : pkg.price,
                promotion_price: pkg.promotion_price ? (typeof pkg.promotion_price === 'string' ? parseFloat(pkg.promotion_price) : pkg.promotion_price) : null,
                promotion_start_at: pkg.promotion_start_at,
                promotion_end_at: pkg.promotion_end_at,
                subtitle: subtitle,
                features: features,
                is_popular: pkg.name.toLowerCase().includes('business'),
                image_url: pkg.image_url,
                category_id: pkg.category_id,
                sort_order: pkg.sort_order
              };
            });
          
          return {
            id: cat.id,
            name: cat.name,
            packages: catPackages
          };
        }).filter(group => group.packages.length > 0);

        setCategoryGroups(groups);
      }
    } catch (error) {
      console.error("Failed to fetch flight packages", error);
    } finally {
      setLoading(false);
    }
  };

    fetchPackages();
  }, [sortOrder, categoryId, sharedPackageId]);

  const getIconForFeature = (feature: string) => {
    const lower = feature.toLowerCase();
    if (lower.includes("min flight")) return <Clock className="w-4 h-4 mr-2 shrink-0" />;
    if (lower.includes("pax")) return <User className="w-4 h-4 mr-2 shrink-0" />;
    if (lower.includes("insurance")) return <Shield className="w-4 h-4 mr-2 shrink-0" />;
    if (lower.includes("route")) return <Route className="w-4 h-4 mr-2 shrink-0" />;
    if (lower.includes("uniform")) return <Shirt className="w-4 h-4 mr-2 shrink-0" />;
    if (lower.includes("video") || lower.includes("reel")) return <Video className="w-4 h-4 mr-2 shrink-0" />;
    if (lower.includes("briefing") || lower.includes("assistance")) return <Briefcase className="w-4 h-4 mr-2 shrink-0" />;
    return <Check className="w-4 h-4 mr-2 shrink-0" />;
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading flight packages...</p>
      </div>
    );
  }

  if (categoryGroups.length === 0) {
    return null;
  }

  return (
    <section 
      className={`${hidePadding ? "" : "section-padding"} relative overflow-hidden`}
      style={bgGradient && !hidePadding ? { background: bgGradient } : { background: "#06091a" }}
    >
      <BackgroundParticles variant="dark" count={15} isPaused={isGlobalPaused} />
      <div className="absolute top-0 right-0 h-px w-1/3 bg-gradient-to-l from-[#ea580c] to-transparent" />
      <div className="absolute bottom-0 left-0 h-px w-1/2 bg-gradient-to-r from-[#ea580c] via-[#facc15]/50 to-transparent" />
      <div className={`${hidePadding ? "" : "container mx-auto px-4 relative z-10"}`}>
        <div className="space-y-8">
          {showTitle && (
            <div className="text-center mb-8">
              <div className="mb-4 flex items-center justify-center gap-3">
                <div className="h-[2px] w-10 bg-[#ea580c]" />
                <span
                  className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ea580c]"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Flight Packages
                </span>
                <div className="h-[2px] w-10 bg-[#ea580c]" />
              </div>
              <h2
                className="text-4xl uppercase leading-none text-white md:text-6xl"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em", textShadow: "0 8px 24px rgba(0,0,0,0.45)" }}
              >
                Choose Your Flight Package
              </h2>
              <p
                className="mx-auto mt-3 max-w-2xl text-sm font-semibold uppercase tracking-[0.18em] text-white/65 md:text-base"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Start by selecting your main flight experience.
              </p>
            </div>
          )}
          
          <div className="relative group/scroll-container">
            {/* Left Scroll Button */}
            <button
              onClick={() => handleManualScroll('left')}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-40 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-2 rounded-full transition-all duration-300 opacity-0 group-hover/scroll-container:opacity-100 flex items-center justify-center border border-white/20 shadow-lg"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            {/* Right Scroll Button */}
            <button
              onClick={() => handleManualScroll('right')}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-40 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-2 rounded-full transition-all duration-300 opacity-0 group-hover/scroll-container:opacity-100 flex items-center justify-center border border-white/20 shadow-lg"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            <div 
              className="overflow-x-auto pb-6 no-scrollbar touch-auto"
              ref={scrollRef}
            >
              <motion.div 
                animate={controls}
                className="flex gap-6 min-w-max px-4"
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
              >
                {allPackages.map((pkg, idx) => {
                  const start = pkg.promotion_start_at ? new Date(pkg.promotion_start_at) : null;
                  const end = pkg.promotion_end_at ? new Date(pkg.promotion_end_at) : null;
                  
                  const isPromotionActive = pkg.promotion_price && 
                     (!start || start <= currentTime) &&
                     (!end || end > currentTime);

                  const shareEligible = pkg.sort_order === 0;
 
                   let timeLeft = "";
                   if (isPromotionActive && end) {
                     const diff = end.getTime() - currentTime.getTime();
                     if (diff > 0) {
                       const hours = Math.floor(diff / (1000 * 60 * 60));
                       const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                       const secs = Math.floor((diff % (1000 * 60)) / 1000);
                       timeLeft = `${hours}h ${mins}m ${secs}s`;
                     }
                   }

                   return (
                    <motion.div 
                      key={`${pkg.id}-${idx}`} 
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      onClick={(e) => {
                        if (celebratingPackageId) return; // Prevent double clicks during celebration
                        handleSelect(pkg, e);
                      }}
                      className={`group relative flex h-full w-[280px] shrink-0 cursor-pointer flex-col overflow-hidden border border-white/10 bg-white/[0.04] backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:border-[#ea580c]/55 hover:bg-white/[0.07] hover:shadow-[0_28px_80px_-30px_rgba(234,88,12,0.45)] md:w-[320px] ${
                        pkg.is_popular ? "shadow-[0_24px_70px_-32px_rgba(234,88,12,0.25)]" : "shadow-[0_20px_60px_-30px_rgba(0,0,0,0.65)]"
                      }`}
                      style={{ clipPath: "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))" }}
                    >

                    
                    {pkg.image_url && (
                      <div className="absolute inset-0 z-0">
                        <img 
                          src={pkg.image_url} 
                          alt={pkg.name} 
                          className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-500" 
                        />
                      </div>
                    )}

                    {pkg.is_popular && (
                      <div
                        className={`absolute top-2 ${shareEligible ? "right-12" : "right-2"} z-20 border border-[#ea580c]/40 bg-[#ea580c] text-white ${isCompact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"} font-black uppercase tracking-[0.22em] shadow-[0_16px_40px_-18px_rgba(234,88,12,0.7)]`}
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))" }}
                      >
                        Popular
                      </div>
                    )}

                    {shareEligible && (
                      <button
                        type="button"
                        onClick={(e) => handleShare(pkg, e)}
                        className="absolute top-2 right-2 z-30 h-8 w-8 flex items-center justify-center transition-all hover:scale-110 active:scale-95 drop-shadow-md"
                        aria-label="Copy share link"
                      >
                        <img src="/share-icon.svg" alt="Share" className="w-full h-full" />
                      </button>
                    )}
                    
                    <div className={`${isCompact ? "p-3" : "p-5"} relative z-10 border-b border-white/10 bg-black/10 text-center backdrop-blur-[2px]`}>
                      <h3
                        className={`${isCompact ? "text-xl" : "text-2xl"} uppercase leading-none text-white`}
                        style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}
                      >
                        {pkg.name}
                      </h3>
                      {pkg.subtitle && (
                        <p
                          className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60 ${isCompact ? "" : "mb-2"}`}
                          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                        >
                          {pkg.subtitle}
                        </p>
                      )}
                      
                      <div className="flex flex-col items-center justify-center">
                        {isPromotionActive && pkg.promotion_price ? (
                          <>
                            <div className={`${isCompact ? "text-2xl" : "text-3xl"} flex items-center gap-2 text-[#ea580c]`} style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>
                              RM {pkg.promotion_price.toLocaleString()}
                            </div>
                            <div className="text-xs font-bold text-white/50 line-through">
                              RM {pkg.price.toLocaleString()}
                            </div>
                            {timeLeft && (
                              <div className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#ea580c] animate-pulse drop-shadow-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                Ends in: {timeLeft}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className={`${isCompact ? "text-2xl" : "text-3xl"} text-[#ea580c]`} style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>
                            RM {pkg.price.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`${isCompact ? "p-3" : "p-5"} flex-1 relative z-10`}>
                      <ul className={`${isCompact ? "space-y-1" : "space-y-2"}`}>
                        {pkg.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start text-[11px] font-medium text-white/70">
                            {getIconForFeature(feature)}
                            <span className="ml-2">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className={`${isCompact ? "p-3" : "p-5"} pt-0 relative z-10 mt-auto`}>
                      <Button 
                        className="relative z-20 h-11 w-full rounded-none text-[11px] font-black uppercase tracking-[0.22em] text-white shadow-[0_18px_50px_-18px_rgba(234,88,12,0.6)] transition-all duration-300 active:scale-[0.98]"
                        size="sm"
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          background: "#ea580c",
                          clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))",
                        }}
                        onClick={(e) => {
                          if (celebratingPackageId) return; // Prevent double clicks during celebration
                          handleSelect(pkg, e);
                        }}
                      >
                        {buttonText || (onPackageSelect ? "Select" : "Book")}
                      </Button>
                    </div>

                    <AnimatePresence>
                      {celebratingPackageId === pkg.id && (
                        <>
                          {/* Floating Emoji */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.5, x: 20 }}
                            animate={{ opacity: 1, scale: 1.2, x: 0 }}
                            exit={{ opacity: 0, scale: 0.8, x: 20 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="absolute right-4 bottom-20 z-50 text-4xl pointer-events-none"
                          >
                            🎉
                          </motion.div>
                          
                          {/* Full Screen Confetti */}
                          <Confetti />
                        </>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
