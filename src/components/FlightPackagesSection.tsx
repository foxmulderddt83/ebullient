import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, useInView } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Check, Clock, User, Shield, Route, Video, Shirt, Briefcase, Plane, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import confetti from 'canvas-confetti';
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";
import { trackShareEvent } from "@/lib/agentTracking";
import { useSlashPrice, slashedPrice } from "@/lib/slashPrice";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  is_main_default?: boolean;
  bg_opacity?: number;
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
  /**
   * Restricts the main packages on show to this set. A landing page scoped
   * to a coupon passes the packages that coupon actually pays for, so the
   * page never offers something the discount will refuse at checkout.
   * Null or empty means no restriction.
   */
  allowedPackageIds?: string[] | null;
}

export const FlightPackagesSection = ({ 
  onPackageSelect, 
  onSelect, 
  onCategorySelect,
  hidePadding = false,
  sortOrder = 0,
  categoryId = null,
  showTitle = false,
  buttonText,
  isCompact = false,
  allowedPackageIds = null
}: FlightPackagesSectionProps) => {
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadStartTime] = useState(Date.now());
  const [showSlowLoading, setShowSlowLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        if (loading) setShowSlowLoading(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowSlowLoading(false);
    }
  }, [loading]);
  const [bgGradient, setBgGradient] = useState<string>("");
  const [promotionBannerUrl, setPromotionBannerUrl] = useState<string>("");
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  const [sharedPackageId, setSharedPackageId] = useState<string | null>(null);
  const [hoveredPackageByGroup, setHoveredPackageByGroup] = useState<Record<string, string | null>>({});
  const lastExternalRefreshRef = useRef(0);
  const { addItem, items, setIsOpen } = useCart();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(scrollRef);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  // Read once for the whole grid. A live campaign sets the price of the
  // package it targets outright: what the card shows is what goes in the
  // cart and what gets charged. There is no coupon anywhere behind it.
  const slash = useSlashPrice();
  const [isSelecting, setIsSelecting] = useState(false);

  const basePackageInCart = items.find(i => i.sort_order === 0);

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
    if (!supabase) return;
    const channel = supabase
      .channel('public:site-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'packages' },
        () => setRetryCount(prev => prev + 1)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => setRetryCount(prev => prev + 1)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings' },
        () => setRetryCount(prev => prev + 1)
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [supabase]);

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.paused === 'boolean') {
        setIsGlobalPaused(detail.paused);
      }
    };

    const handleDataUpdate = () => {
      setRetryCount(prev => prev + 1);
    };

    window.addEventListener('toggle-animation-freeze', handleToggle);
    window.addEventListener('oneday:mainpage-update', handleDataUpdate);
    window.addEventListener('storage', (e) => {
      if (e.key === 'oneday:mainpage-update') handleDataUpdate();
    });
    
    const channel = new BroadcastChannel('oneday:mainpage-update');
    channel.onmessage = handleDataUpdate;

    return () => {
      window.removeEventListener('toggle-animation-freeze', handleToggle);
      window.removeEventListener('oneday:mainpage-update', handleDataUpdate);
      channel.close();
    };
  }, []);

  const handleSelect = (pkg: FlightPackage, e?: React.MouseEvent, overrideImage?: string) => {
    if (e) e.stopPropagation();
    if (isSelecting) return;

    // block from other packages once already selected because at one booking only one sort_order = 0 can have
    if (pkg.sort_order === 0) {
      const existingBase = items.find(i => i.sort_order === 0);
      if (existingBase && existingBase.id !== pkg.id) {
        setShowLimitDialog(true);
        return;
      }
    }

    // Check if adding a sort_order > 0 item requires a sort_order=0 item in cart
    if (pkg.sort_order > 0) {
      // Find any item in the cart from the SAME category with sort_order=0
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
    
    const askingPrice = isPromotionActive && pkg.promotion_price ? Number(pkg.promotion_price) : Number(pkg.price);
    // A live challenge is the last word on the price - it cuts whatever was
    // already on show, promotion included.
    const finalPrice = slashedPrice(slash, pkg.id, askingPrice) ?? askingPrice;

    const group = categoryGroups.find(g => g.id === pkg.category_id);
    const categoryName = group ? group.name : "";

    // Add to cart immediately
    addItem({
      id: pkg.id, // Use actual package ID for booking_items.package_id
      name: pkg.name,
      price: finalPrice,
      original_price: Number(pkg.price),
      promotion_end_at: isPromotionActive && pkg.promotion_end_at ? pkg.promotion_end_at : undefined,
      image_url: overrideImage || pkg.image_url,
      sort_order: pkg.sort_order,
      category_id: pkg.category_id,
      category_name: categoryName
    });

    // Track selection
    trackEvent({
      action_type: 'click',
      entity_type: 'video', // Flight packages are often categorized as 'video' or 'experience' in this app's existing tracking
      entity_id: pkg.id,
      entity_name: `Package Selected: ${pkg.name}`,
      source: 'FlightPackagesSection'
    });

    // Attribute the click to the agent share link the visitor arrived on, so
    // the agent report can rank which package their audience opens most.
    trackShareEvent({
      event_type: 'package_click',
      packageId: pkg.id,
      packageName: pkg.name,
      metadata: { price: finalPrice, category: categoryName },
    });

    toast.success(`Added ${pkg.name} to cart`);

    // Party effect (confetti) for main packages only (sort_order 0)
    if (pkg.sort_order === 0) {
      if (typeof window !== 'undefined' && 'caches' in window) {
        window.caches.keys().then((names) => {
          names.forEach((name) => {
            window.caches.delete(name);
          });
        }).catch((err) => {
          console.error("Failed to clear cache storage:", err);
        });
      }
      setIsSelecting(true);
      const duration = 2 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        // since particles fall down, start them a bit higher than random
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      // Wait for 2 seconds before proceeding
      setTimeout(() => {
        setIsSelecting(false);
        if (onPackageSelect) onPackageSelect(pkg.category_id, pkg.sort_order, pkg.id);
        if (onSelect) onSelect();
        if (onCategorySelect) onCategorySelect(pkg.category_id, pkg.sort_order + 1);
      }, 2000);
    } else {
      // Restore automatic navigation/callbacks immediately for add-ons
      if (onPackageSelect) onPackageSelect(pkg.category_id, pkg.sort_order, pkg.id);
      if (onSelect) onSelect();
      if (onCategorySelect) onCategorySelect(pkg.category_id, pkg.sort_order + 1);
    }
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

  const getActivePrice = (pkg: FlightPackage) => {
    const start = pkg.promotion_start_at ? new Date(pkg.promotion_start_at) : null;
    const end = pkg.promotion_end_at ? new Date(pkg.promotion_end_at) : null;
    const isPromotionActive = !!(pkg.promotion_price && (!start || start <= currentTime) && (!end || end > currentTime));
    const askingPrice = isPromotionActive && pkg.promotion_price ? Number(pkg.promotion_price) : Number(pkg.price);
    // A live challenge is the last word on the price, promotion included.
    const challengePrice = slashedPrice(slash, pkg.id, askingPrice);
    return {
      isPromotionActive,
      askingPrice,
      challengePrice,
      displayPrice: challengePrice ?? askingPrice,
    };
  };

  const handleManualScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      setIsHovered(true); // Stop auto-scroll when manually interacting
      
      const container = scrollRef.current;
      const isMobile = window.innerWidth < 768;
      const itemWidth = isMobile ? 260 : 420;
      const gap = 3;
      const scrollAmount = direction === 'left' ? -(itemWidth + gap) : (itemWidth + gap);
      
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
        if (window.innerWidth < 768 || !scrollRef.current?.matches(':hover')) {
          setIsHovered(false);
        }
      }, 3000);
    }
  };

  /**
   * Main packages only: add-ons are picked on a later step and a coupon's
   * package scope has nothing to say about them, so the filter is confined
   * to sortOrder 0 where the choice of package is actually made.
   */
  const scopedGroups = useMemo(() => {
    if (sortOrder !== 0 || !allowedPackageIds?.length) return categoryGroups;
    const allow = new Set(allowedPackageIds);
    return categoryGroups
      .map(group => ({ ...group, packages: group.packages.filter(p => allow.has(p.id)) }))
      .filter(group => group.packages.length > 0);
  }, [categoryGroups, allowedPackageIds, sortOrder]);

  const allPackages = scopedGroups.flatMap(group => group.packages);

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const handleDragStart = (e: React.MouseEvent) => {
    // Only allow drag with left mouse button
    if (e.button !== 0) return;
    
    if (!scrollRef.current) return;
    
    // Check if the click target is a button or link
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }

    setIsDragging(true);
    setIsHovered(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    // Prevent image dragging interference
    const images = scrollRef.current.querySelectorAll('img');
    images.forEach(img => img.setAttribute('draggable', 'false'));
  };

  const handleDragEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      document.body.style.userSelect = '';
    }
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Drag sensitivity
    scrollRef.current.scrollLeft = scrollLeftState - walk;
    exactScrollRef.current = scrollRef.current.scrollLeft;
  };

  const isReversingRef = useRef(false);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const exactScrollRef = useRef<number>(0);

  useEffect(() => {
    const animateScroll = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (isInView && !loading && allPackages.length > 0 && !isGlobalPaused && !isHovered && scrollRef.current) {
        const container = scrollRef.current;
        const maxScroll = container.scrollWidth - container.clientWidth;

        if (maxScroll > 0) {
          // Adjust speed as needed (pixels per second)
          const speed = (50 * deltaTime) / 1000;
          
          if (isReversingRef.current) {
            exactScrollRef.current -= speed;
            if (exactScrollRef.current <= 0) {
              exactScrollRef.current = 0;
              isReversingRef.current = false;
            }
          } else {
            exactScrollRef.current += speed;
            if (exactScrollRef.current >= maxScroll) {
              exactScrollRef.current = maxScroll;
              isReversingRef.current = true;
            }
          }
          
          // Apply to container
          container.scrollLeft = exactScrollRef.current;
          
          // Sync back in case of user manual scroll during this time
          if (Math.abs(container.scrollLeft - exactScrollRef.current) > 2) {
             exactScrollRef.current = container.scrollLeft;
          }
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(animateScroll);
    };

    if (isInView && !loading && allPackages.length > 0 && !isGlobalPaused && !isHovered) {
      lastTimeRef.current = performance.now();
      if (scrollRef.current) {
        exactScrollRef.current = scrollRef.current.scrollLeft;
      }
      animationFrameRef.current = requestAnimationFrame(animateScroll);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInView, loading, allPackages.length, isGlobalPaused, isHovered]);

  useEffect(() => {
    const fetchPackages = async (attempt = 1) => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Add a small delay on mobile to avoid race conditions with session restoration
        if (window.innerWidth < 768 && attempt === 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Fetch background gradient and other settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('site_settings')
          .select('key, value')
          .in('key', ['bg_gradient_booking_wizard', 'promotion_image_banner']);
        
        if (!settingsError && settingsData) {
          const gradientSetting = settingsData.find(s => s.key === 'bg_gradient_booking_wizard');
          if (gradientSetting) setBgGradient(gradientSetting.value);

          const bannerSetting = settingsData.find(s => s.key === 'promotion_image_banner');
          if (bannerSetting) setPromotionBannerUrl(bannerSetting.value);
        }

        if (sharedPackageId && sortOrder === 0) {
          // ... (keep shared package logic, but add error handling)
          const { data: sharedPkg, error: sharedError } = await supabase
            .from('packages')
            .select('*')
            .eq('id', sharedPackageId)
            .eq('is_active', true)
            .single();

          if (sharedError) throw sharedError;
          if (!sharedPkg || sharedPkg.sort_order !== 0) {
            setCategoryGroups([]);
            setLoading(false);
            return;
          }

          const { data: relatedPackages, error: relatedError } = await supabase
            .from('packages')
            .select('*')
            .eq('category_id', sharedPkg.category_id)
            .eq('sort_order', 0)
            .eq('is_active', true)
            .order('name', { ascending: true });

          if (relatedError) throw relatedError;

          const { data: sharedCategory, error: catError } = await supabase
            .from('categories')
            .select('id, name')
            .eq('id', sharedPkg.category_id)
            .single();
          
          if (catError) throw catError;

          const mappedPackages = (relatedPackages || []).map(pkg => {
            const lines = pkg.description ? pkg.description.split(/\r?\n/).filter((f: string) => f.trim() !== '') : [];
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
              sort_order: pkg.sort_order,
              bg_opacity: pkg.bg_opacity,
              is_main_default: pkg.id === sharedPackageId
            };
          });

          setCategoryGroups([{
            id: sharedCategory?.id || sharedPkg.category_id,
            name: sharedCategory?.name || "Shared Category",
            packages: mappedPackages
          }]);
          setLoading(false);
          return;
        }

        let finalCategories: { id: string, name: string }[] = [];

        if (categoryId) {
          const { data: catData, error: catError } = await supabase
            .from('categories')
            .select('id, name')
            .eq('id', categoryId) 
            .single();
          
          if (catError) throw catError;
          if (catData) finalCategories = [catData];
        } else {
          const { data: categories, error: catError } = await supabase
            .from('categories')
            .select('id, name')
            .eq('is_main_page', true)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

          if (catError) throw catError;
          finalCategories = categories || [];
        }

        const categoryIds = finalCategories.map(c => c.id);

        if (categoryIds.length === 0) {
          setCategoryGroups([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('packages')
          .select('*')
          .eq('is_active', true)
          .eq('sort_order', sortOrder)
          .in('category_id', categoryIds)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });

        if (error) throw error;

        if (data) {
          const groups: CategoryGroup[] = finalCategories.map(cat => {
            const catPackages = data
              .filter(pkg => pkg.category_id === cat.id)
              .map(pkg => {
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
                  sort_order: pkg.sort_order,
                  bg_opacity: pkg.bg_opacity
                };
              });

            return {
              id: cat.id,
              name: cat.name,
              packages: catPackages
            };
          }).filter(g => g.packages.length > 0);

          setCategoryGroups(groups);
        }
        setLoading(false);
      } catch (err: any) {
        console.error(`Fetch attempt ${attempt} failed:`, err);
        
        // Retry logic with exponential backoff (max 3 attempts)
        if (attempt < 3) {
          const delay = Math.pow(2, attempt) * 500;
          setTimeout(() => fetchPackages(attempt + 1), delay);
        } else {
          setLoading(false);
          // toast.error("Failed to load packages. Please check your connection.");
        }
      }
    };

    fetchPackages();
  }, [supabase, retryCount, categoryId, sortOrder, sharedPackageId]);

  const getIconForFeature = (feature: string) => {
    const lower = feature.toLowerCase();
    if (lower.includes("min flight")) return <Clock className="w-4 h-4 mr-3 shrink-0 text-[#CD5C5C]" />;
    if (lower.includes("pax")) return <User className="w-4 h-4 mr-3 shrink-0 text-[#CD5C5C]" />;
    if (lower.includes("insurance")) return <Shield className="w-4 h-4 mr-3 shrink-0 text-[#CD5C5C]" />;
    if (lower.includes("route")) return <Route className="w-4 h-4 mr-3 shrink-0 text-[#CD5C5C]" />;
    if (lower.includes("uniform")) return <Shirt className="w-4 h-4 mr-3 shrink-0 text-[#CD5C5C]" />;
    if (lower.includes("video") || lower.includes("reel")) return <Video className="w-4 h-4 mr-3 shrink-0 text-[#CD5C5C]" />;
    if (lower.includes("briefing") || lower.includes("assistance")) return <Briefcase className="w-4 h-4 mr-3 shrink-0 text-[#CD5C5C]" />;
    return <Check className="w-4 h-4 mr-3 shrink-0 text-[#CD5C5C]" />;
  };

  if (scopedGroups.length === 0) {
    if (loading) return (
      <div className="py-20 text-center flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#CD5C5C] mb-4"></div>
        <p className="text-muted-foreground font-medium">Loading flight packages...</p>
        {showSlowLoading && (
          <div className="mt-6 animate-in fade-in duration-500">
            <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">This is taking longer than usual. It might be due to a slow connection or temporary issue.</p>
            <Button 
              onClick={() => {
                setLoading(true);
                setRetryCount(prev => prev + 1);
              }}
              variant="outline"
              size="sm"
              className="gap-2 border-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Force Refresh
            </Button>
          </div>
        )}
      </div>
    );
    
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground mb-4">No flight packages found for this section.</p>
        <Button 
          variant="outline" 
          onClick={() => {
            setLoading(true);
            setRetryCount(prev => prev + 1);
          }}
          className="mx-auto"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Refresh Packages
        </Button>
      </div>
    );
  }

  return (
    <section 
      className={`${hidePadding ? "" : "section-padding"} relative overflow-hidden`}
      style={bgGradient && !hidePadding ? { background: bgGradient } : { background: hidePadding ? "transparent" : "linear-gradient(135deg, #FFFFFF 0%, #FFF5F5 60%, #F8F8F8 100%)" }}
    >
      {/* Light theme - no dark particle background needed */}
      <div className="absolute top-0 right-0 h-[3px] w-1/3 bg-gradient-to-l from-[#CD5C5C] to-transparent" />
      <div className="absolute bottom-0 left-0 h-px w-1/2 bg-gradient-to-r from-[#CD5C5C] via-[#CD5C5C]/50 to-transparent" />
      <div className={`${hidePadding ? "" : "w-full relative z-10"}`}>
        <div className="space-y-8">
          {showTitle && (
            <div className="text-center mb-8">
              <div className="mb-4 flex items-center justify-center gap-3">
                <div className="h-[2px] w-10 bg-[#CD5C5C]" />
                <span className="text-xs font-black uppercase tracking-[0.35em] text-[#CD5C5C] font-condensed">
                  Flight Packages
                </span>
                <div className="h-[2px] w-10 bg-[#CD5C5C]" />
              </div>
              <h2 className="text-4xl uppercase leading-none text-slate-900 md:text-7xl font-title tracking-[0.05em]">
                Select Your Flight
              </h2>
            </div>
          )}
          
          <div className="relative group/scroll-container">
            <div 
              className={cn(
                "overflow-x-auto pb-6 no-scrollbar touch-auto relative",
                isDragging ? "cursor-grabbing" : "cursor-grab"
              )}
              ref={scrollRef}
              onMouseDown={handleDragStart}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={() => {
                handleDragEnd();
                setIsHovered(false);
              }}
              onMouseEnter={() => setIsHovered(true)}
            >
              {/* Invisible overlay to capture drag events without interference from children */}
              {isDragging && (
                <div 
                  className="fixed inset-0 z-[9999] cursor-grabbing" 
                  onMouseMove={handleDragMove}
                  onMouseUp={handleDragEnd}
                />
              )}
              
              <div 
                className="flex gap-[3px] min-w-max px-0 mx-auto w-fit select-none"
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setIsHovered(true) }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') setIsHovered(false) }}
                onTouchStart={() => setIsHovered(true)}
                onTouchEnd={() => setIsHovered(false)}
                onTouchCancel={() => setIsHovered(false)}
              >
                {sortOrder === 0 && (sharedPackageId || scopedGroups.some(g => g.packages.length > 1)) ? (
                  <>
                    {scopedGroups.map((group, groupIdx) => (
                      (() => {
                        const defaultPkg = group.packages.find(p => p.is_main_default) || group.packages[0];
                        const hoveredId = hoveredPackageByGroup[group.id];
                        const hoveredPkg = hoveredId ? group.packages.find(p => p.id === hoveredId) : undefined;
                        const displayPkg = hoveredPkg || defaultPkg;
                        const priceInfo = displayPkg ? getActivePrice(displayPkg) : null;

                        return (
                          <motion.div
                            key={`${group.id}-${groupIdx}`}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="group relative flex h-full w-[260px] min-h-[380px] shrink-0 flex-col overflow-hidden border border-white/10 bg-zinc-800/40 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#CD5C5C]/55 hover:bg-zinc-700/60 md:w-[420px] md:min-h-[420px] shadow-none rounded-3xl"
                          >
                            {defaultPkg?.image_url ? (
                              <div className="absolute inset-0 z-0">
                                <img
                                  src={defaultPkg.image_url}
                                  alt={defaultPkg.name}
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                  style={{ 
                                    opacity: defaultPkg.bg_opacity ?? 1.0,
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="absolute inset-0 z-0 opacity-20">
                                <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" />
                              </div>
                            )}

                            <div className="relative p-4 pt-6 md:p-6 md:pt-10 flex flex-col items-center justify-end text-center z-10 min-h-[120px] md:min-h-[140px]">
                              {/* Share Button in Main Panel */}
                              <div className="absolute top-3 right-3 md:top-4 md:right-4 z-20">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(e) => displayPkg && handleShare(displayPkg, e)}
                                      className="h-8 w-8 md:h-10 md:w-10 flex items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm text-white transition-all hover:bg-white/20 active:scale-[0.98]"
                                      aria-label="Copy share link"
                                    >
                                      <img src="/share-icon.svg" alt="Share" className="w-4 h-4 md:w-5 md:h-5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    create the share link
                                  </TooltipContent>
                                </Tooltip>
                              </div>

                              <h4 className="text-2xl md:text-3xl uppercase leading-none text-white relative z-10 font-title tracking-[0.04em]">
                                {group.name}
                              </h4>
                              {priceInfo && (
                                <div className="mt-1.5 md:mt-2 relative px-3 py-1 md:px-4 md:py-1.5 rounded-2xl overflow-hidden group/price">
                                  {/* Localized background for price visibility */}
                                  <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-[-1] border border-white/5" />
                                  {priceInfo.challengePrice !== null ? (
                                    <>
                                      <p className="text-lg md:text-xl font-bold uppercase tracking-[0.15em] text-emerald-400 font-condensed text-center">
                                        RM {priceInfo.challengePrice.toLocaleString()}
                                      </p>
                                      <p className="text-[10px] md:text-xs font-bold text-white/50 line-through text-center">
                                        RM {priceInfo.askingPrice.toLocaleString()}
                                      </p>
                                      <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.18em] text-emerald-400 text-center font-condensed">
                                        Challenge price
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-lg md:text-xl font-bold uppercase tracking-[0.15em] text-[#CD5C5C] font-condensed">
                                      RM {priceInfo.displayPrice.toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="p-3 pt-1 md:p-4 md:pt-2 flex-1 flex flex-col justify-end relative z-10">
                              <div className="grid gap-2 md:gap-3">
                                {group.packages.map((pkg) => (
                                  <div key={pkg.id} className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      disabled={isSelecting}
                                      className={cn(
                                        "h-10 md:h-12 flex-1 rounded-xl border font-black uppercase tracking-[0.18em] transition-all active:scale-[0.98] flex items-center justify-center gap-2 font-condensed text-xs md:text-sm",
                                        displayPkg?.id === pkg.id 
                                          ? "bg-[#CD5C5C] text-white border-white/50 shadow-[0_0_20px_rgba(205,92,92,0.5)] scale-[1.02]" 
                                          : (basePackageInCart && basePackageInCart.id !== pkg.id && pkg.sort_order === 0)
                                            ? "bg-slate-800/50 border-white/10 text-white/30 cursor-not-allowed"
                                            : "bg-slate-800/80 border-white/50 text-white hover:bg-slate-700/90"
                                      )}
                                      onPointerEnter={() => setHoveredPackageByGroup(prev => ({ ...prev, [group.id]: pkg.id }))}
                                      onFocus={() => setHoveredPackageByGroup(prev => ({ ...prev, [group.id]: pkg.id }))}
                                      onClick={(e) => {
                                        setHoveredPackageByGroup(prev => ({ ...prev, [group.id]: pkg.id }));
                                        handleSelect(pkg, e, defaultPkg?.image_url);
                                      }}
                                    >
                                      {displayPkg?.id === pkg.id && <Check className="w-5 h-5" />}
                                      {pkg.name}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })()
                    ))}
                  </>
                ) : allPackages.map((pkg, idx) => {
                  const start = pkg.promotion_start_at ? new Date(pkg.promotion_start_at) : null;
                  const end = pkg.promotion_end_at ? new Date(pkg.promotion_end_at) : null;
                  
                  const isPromotionActive = pkg.promotion_price && 
                     (!start || start <= currentTime) &&
                     (!end || end > currentTime);

                  // A live challenge cuts whatever price was already on show,
                  // promotion included - it is the last word on the number.
                  const askingPrice = isPromotionActive && pkg.promotion_price
                    ? Number(pkg.promotion_price)
                    : Number(pkg.price);
                  const challengePrice = slashedPrice(slash, pkg.id, askingPrice);

                  const isSelected = items.some(i => i.id === pkg.id);
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
                      className={`group relative flex h-full w-[260px] min-h-[350px] shrink-0 flex-col overflow-hidden border border-white/10 bg-zinc-800/40 backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:border-[#CD5C5C]/55 hover:bg-zinc-700/60 md:w-[420px] md:min-h-[500px] shadow-none rounded-3xl ${!pkg.image_url ? 'bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border-zinc-700/50' : ''}`}
                      style={{}}
                    >

                    
                    {pkg.image_url ? (
                      <div className="absolute inset-0 z-0">
                        <img 
                          loading="lazy"
                          src={pkg.image_url} 
                          alt={pkg.name} 
                          decoding="async"
                          width={420}
                          height={500}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                          style={{ 
                            opacity: pkg.bg_opacity ?? 1.0,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 z-0 opacity-20">
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]" />
                      </div>
                    )}

                    {pkg.is_popular && (
                      <div className={`absolute top-2 ${shareEligible ? "right-14" : "right-2"} z-20 border border-[#CD5C5C]/40 bg-[#CD5C5C] text-white ${isCompact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} font-black uppercase tracking-[0.22em] shadow-[0_10px_25px_-5px_rgba(205,92,92,0.8)] rounded-lg font-condensed`}>
                        Popular
                      </div>
                    )}

                    {shareEligible && (
                      <div className="absolute top-4 right-4 z-30">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => handleShare(pkg, e)}
                              className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm text-white transition-all hover:bg-white/20 active:scale-[0.98]"
                              aria-label="Copy share link"
                            >
                              <img src="/share-icon.svg" alt="Share" className="w-5 h-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            create the share link
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                    
                    <div className={`${isCompact ? "p-2 md:p-3" : "p-3 md:p-4"} relative z-10 text-center backdrop-blur-[1px]`}>
                      <div className="relative px-3 py-1.5 md:px-4 md:py-2 rounded-2xl overflow-hidden mb-1 md:mb-2 inline-block">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-[-1] border border-white/5" />
                        <h4 
                          className={`${isCompact ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl"} uppercase leading-none font-title tracking-[0.04em]`}
                          style={{ 
                            color: "whitesmoke",
                            textShadow: "0 2px 10px rgba(0,0,0,0.5)"
                          }}
                        >
                          {pkg.name}
                        </h4>
                      </div>
                      {pkg.subtitle && (
                        <p className={`mt-0.5 md:mt-1 text-base md:text-lg font-bold uppercase tracking-[0.16em] text-white ${isCompact ? "" : "mb-0.5 md:mb-1"} font-condensed`}>
                          {pkg.subtitle}
                        </p>
                      )}
                      
                      <div className="flex flex-col items-center justify-center mt-1.5 md:mt-2">
                        {challengePrice !== null ? (
                          <div className="relative px-4 py-1.5 md:px-5 md:py-2 rounded-2xl overflow-hidden group/price">
                            {/* Localized background for price visibility */}
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-[-1] border border-white/5" />
                            <div className={`${isCompact ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl"} flex items-center gap-2 text-emerald-400 font-title tracking-[0.04em]`} style={{ textShadow: "none" }}>
                              RM {challengePrice.toLocaleString()}
                            </div>
                            <div className="text-xs md:text-sm font-bold text-white/50 line-through text-center">
                              RM {askingPrice.toLocaleString()}
                            </div>
                            <div className="mt-0.5 md:mt-1 text-sm md:text-base font-black uppercase tracking-[0.18em] text-emerald-400 text-center font-condensed" style={{ textShadow: "0 0 15px rgba(52,211,153,0.5)" }}>
                              Challenge price
                            </div>
                          </div>
                        ) : isPromotionActive && pkg.promotion_price ? (
                          <div className="relative px-4 py-1.5 md:px-5 md:py-2 rounded-2xl overflow-hidden group/price">
                            {/* Localized background for price visibility */}
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-[-1] border border-white/5" />
                            <div className={`${isCompact ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl"} flex items-center gap-2 text-[#CD5C5C] font-title tracking-[0.04em]`} style={{ textShadow: "none" }}>
                              RM {pkg.promotion_price.toLocaleString()}
                            </div>
                            <div className="text-xs md:text-sm font-bold text-white/50 line-through text-center">
                              RM {pkg.price.toLocaleString()}
                            </div>
                            {timeLeft && (
                              <div className="mt-0.5 md:mt-1 text-sm md:text-base font-black uppercase tracking-[0.18em] text-[#CD5C5C] animate-pulse text-center font-condensed" style={{ textShadow: "0 0 15px rgba(205,92,92,0.5)" }}>
                                {timeLeft}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="relative px-4 py-1.5 md:px-5 md:py-2 rounded-2xl overflow-hidden group/price">
                            {/* Localized background for price visibility */}
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-[-1] border border-white/5" />
                            <div className={`${isCompact ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl"} text-[#CD5C5C] font-title tracking-[0.04em]`} style={{ textShadow: "none" }}>
                              RM {pkg.price.toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`${isCompact ? "p-2 md:p-3" : "p-3 md:p-4"} flex-1 relative z-10`}>
                      <ul className={`${isCompact ? "space-y-1 md:space-y-1.5" : "space-y-1.5 md:space-y-2.5"}`}>
                        {pkg.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start text-sm md:text-base font-bold text-white font-jakarta">
                            {getIconForFeature(feature)}
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className={`${isCompact ? "p-2 md:p-3" : "p-3 md:p-4"} pt-0 relative z-10 mt-auto`}>
                      <Button 
                        type="button"
                        disabled={isSelecting}
                        className={cn(
                          "relative z-20 h-9 w-full rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 active:scale-[0.98] font-condensed flex items-center justify-center gap-2 border",
                          (basePackageInCart && basePackageInCart.id !== pkg.id && pkg.sort_order === 0)
                              ? "bg-slate-800/50 border-white/10 text-white/30 cursor-not-allowed"
                              : isSelected
                                ? "bg-[#CD5C5C] text-white border-white/50 shadow-[0_4px_12px_rgba(205,92,92,0.4)]"
                                : "bg-slate-800/80 border-white/50 text-white hover:bg-slate-700/90"
                        )}
                        size="sm"
                        onClick={(e) => {
                          handleSelect(pkg, e);
                        }}
                      >
                        {isSelected && <Check className="w-4 h-4" />}
                        {buttonText || (onPackageSelect ? "Select" : "Book")}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <AlertDialogContent className="max-w-[400px] rounded-3xl border-white/10 bg-slate-900/95 backdrop-blur-xl text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-wider font-condensed flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#CD5C5C] flex items-center justify-center text-white">
                <RotateCcw className="w-4 h-4" />
              </div>
              Selection Limit
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 font-medium">
              Only one main flight package can be selected per booking. Please remove your current selection before choosing another.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => {
                setShowLimitDialog(false);
                setIsOpen(true);
              }}
              className="bg-[#CD5C5C] hover:bg-[#A14A4A] text-white font-bold uppercase tracking-widest rounded-xl h-11 px-8"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
