import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, ChevronLeft, ChevronRight, Plane, Car, Video, Gift, Sparkles, Check, Trash2, RotateCcw } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";
import { motion } from "framer-motion";

interface AddonPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  promotion_price?: number | null;
  promotion_start_at?: string | null;
  promotion_end_at?: string | null;
  image_url?: string;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
  icon?: string;
}

const DEFAULT_CATEGORIES = [
  { id: "cat_flight_upgrades", name: "Flight Upgrades", icon: "plane" },
  { id: "cat_logistics", name: "Logistics & Others", icon: "car" },
  { id: "cat_media", name: "Video & Media", icon: "video" },
  { id: "cat_celebration", name: "Celebration", icon: "gift" },
];

const DEFAULT_ADDONS: AddonPackage[] = [
  { id: "add_ext_time", category_id: "cat_flight_upgrades", name: "Extended Flight Time (+30 Mins)", description: "Extend your flight time by 30 minutes.", price: 900 },
  { id: "add_passenger", category_id: "cat_flight_upgrades", name: "Additional Passenger", description: "Bring a friend along for the ride.", price: 200 },
  { id: "add_hangar", category_id: "cat_logistics", name: "Hangar Tour Pass (Guest)", description: "Tour the hangar and see the aircraft up close.", price: 65 },
  { id: "add_transfer", category_id: "cat_logistics", name: "Luxury Car Transfer (Round Trip)", description: "Arrive in style with our luxury car transfer.", price: 450 },
  { id: "add_reel", category_id: "cat_media", name: "Highlight Reel Video (Social Ready)", description: "A fast-paced, vertical clip for Instagram & TikTok.", price: 150 },
  { id: "add_raw", category_id: "cat_media", name: "Go Pro Cockpit Raw Video", description: "Take home the full & unedited HD Cockpit footage.", price: 199 },
  { id: "add_movie", category_id: "cat_media", name: "Sky Moments Video", description: "A cinematic 2-minute mini-movie telling your full story.", price: 350 },
  { id: "add_uniform", category_id: "cat_celebration", name: "Pilot Uniform Rental", description: "Look the part with a pilot uniform.", price: 100 },
  { id: "add_cake", category_id: "cat_celebration", name: "Aviation Theme Cake", description: "Celebrate with a delicious cake.", price: 180 },
  { id: "add_flowers", category_id: "cat_celebration", name: "Premium Flower Bouquet", description: "Beautiful flowers for a special occasion.", price: 250 },
  { id: "add_board", category_id: "cat_celebration", name: "Arrival Greeting Board", description: "Personalized greeting board upon arrival.", price: 108 },
];

interface AddonsSelectionProps {
  currentCategoryIndex?: number;
  onCategoryChange?: (index: number) => void;
  onComplete?: () => void;
  onBackToFlight?: () => void;
  excludeCategoryId?: string | null;
  parentPackageId?: string | null;
}

export const AddonsSelection = ({
  currentCategoryIndex = 0,
  onCategoryChange,
  onComplete,
  onBackToFlight,
  excludeCategoryId,
  parentPackageId
}: AddonsSelectionProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [addons, setAddons] = useState<AddonPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [showSlowLoading, setShowSlowLoading] = useState(false);
  const { items, total, addItem, removeItem } = useCart();

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

  const basePackageItem = items.find(it => it.sort_order === 0) ?? items.find(it => it.sort_order !== 1);
  const addonItems = items.filter(it => it.sort_order !== 0 && it.sort_order !== undefined);

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (parentPackageId) {
          const { data: linked, error: linkError } = await supabase
            .from('package_addons')
            .select('addon_package_id, sort_order')
            .eq('parent_package_id', parentPackageId);

          if (linkError) throw linkError;

          if (linked && linked.length > 0) {
            const addonIds = linked.map(l => l.addon_package_id);
            const { data: pkgs, error: pkgError } = await supabase
              .from('packages')
              .select('*')
              .in('id', addonIds)
              .eq('is_active', true);

            if (pkgError) throw pkgError;

            if (pkgs) {
              const addonsWithGroup = pkgs.map(p => {
                const link = linked.find(l => l.addon_package_id === p.id);
                return {
                  ...p,
                  category_id: `group-${link?.sort_order || 0}`
                };
              });
              setAddons(addonsWithGroup);

              const groups = Array.from(new Set(linked.map(l => l.sort_order))).sort((a, b) => a - b);
              const fakeCategories = groups.map(g => ({
                id: `group-${g}`,
                name: `Add-ons Group ${g + 1}`,
                icon: 'gift'
              }));
              setCategories(fakeCategories);
            }
          } else {
            setAddons([]);
            setCategories([]);
          }
        } else {
          let query = supabase
            .from('packages')
            .select('*')
            .gte('sort_order', 1)
            .eq('is_active', true);

          if (excludeCategoryId) query = query.neq('category_id', excludeCategoryId);

          const { data: pkgsData, error: pkgsError } = await query
            .order('name', { ascending: true });

          if (pkgsError) throw pkgsError;

          if (pkgsData && pkgsData.length > 0) {
            setAddons(pkgsData);
            const catIds = Array.from(new Set(pkgsData.map(p => p.category_id)));
            if (catIds.length > 0) {
              const { data: catsData, error: catsError } = await supabase
                .from('categories')
                .select('*')
                .in('id', catIds)
                .order('sort_order', { ascending: true });
              if (catsError) throw catsError;
              if (catsData) setCategories(catsData);
            }
          } else {
            setAddons([]);
            setCategories([]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch add-ons", error);
        toast.error("Failed to load customization options");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [excludeCategoryId, parentPackageId, retryCount]);

  const getCategoryIcon = (catName: string) => {
    const lower = catName.toLowerCase();
    if (lower.includes("flight")) return <Plane className="w-5 h-5" />;
    if (lower.includes("logistic") || lower.includes("transport")) return <Car className="w-5 h-5" />;
    if (lower.includes("video") || lower.includes("media")) return <Video className="w-5 h-5" />;
    if (lower.includes("celebration") || lower.includes("gift")) return <Gift className="w-5 h-5" />;
    return <Sparkles className="w-5 h-5" />;
  };

  useEffect(() => {
    if (!loading && addons.length === 0 && onComplete) {
      onComplete();
    }
  }, [loading, addons.length, onComplete]);

  if (loading) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-3 text-slate-400 mb-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#CC1F1F]/30 border-t-[#CC1F1F]" />
          <span className="text-xs tracking-[0.3em] uppercase font-bold" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Loading upgrades
          </span>
        </div>
        {showSlowLoading && (
          <div className="animate-in fade-in duration-500">
            <p className="text-[10px] text-slate-400 mb-4 uppercase tracking-wider">Connection slow... hang in there</p>
            <Button 
              onClick={() => setRetryCount(prev => prev + 1)}
              variant="outline"
              size="sm"
              className="h-8 text-[9px] uppercase tracking-widest border-slate-200"
            >
              <RotateCcw className="w-3 h-3 mr-2" />
              Retry
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (addons.length === 0) {
    return null;
  }

  const currentCategory = categories[currentCategoryIndex];
  if (!currentCategory) {
    return (
      <div className="text-center py-12">
        <Button onClick={onComplete} className="h-12 px-10 rounded-full text-sm font-bold uppercase tracking-wider" style={{ background: 'linear-gradient(135deg, #CC1F1F 0%, #A11818 100%)' }}>
          Continue to Final Details
        </Button>
      </div>
    );
  }

  const categoryAddons = addons.filter(a => a.category_id === currentCategory.id);

  return (
    <div className="space-y-8">
      {/* Step header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-3">
          <span className="h-[1px] w-8 bg-[#CC1F1F]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#CD5C5C]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Step {currentCategoryIndex + 1} of {categories.length} · Customize
          </span>
          <span className="h-[1px] w-8 bg-[#CD5C5C]" />
        </div>
        <h2
          className="leading-none text-slate-900"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: "0.025em" }}
        >
          {currentCategory.name}
        </h2>
      </div>

      {/* Category progress dots */}
      {categories.length > 1 && (
        <div className="flex justify-center gap-2 mb-4">
          {categories.map((_, i) => (
            <button
              key={i}
              onClick={() => onCategoryChange?.(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === currentCategoryIndex ? 'w-10 bg-[#CD5C5C]' : 'w-4 bg-slate-200 hover:bg-slate-300'}`}
              aria-label={`Go to category ${i + 1}`}
            />
          ))}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4">
        {/* Summary Calculation Box */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200/60 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Package</div>
              <div className="mt-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider">{basePackageItem?.category_name || "—"}</div>
              <div className="mt-0.5 text-sm font-bold text-gray-900 truncate uppercase">{basePackageItem?.name || "—"}</div>
              <div className="mt-1 text-sm font-bold text-[#CD5C5C]">
                {basePackageItem ? `RM ${(basePackageItem.price * basePackageItem.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200/60 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Add-ons</div>
              <div className="mt-1.5 text-sm font-bold text-gray-900">{addonItems.length} item(s)</div>
              <div className="mt-1 text-sm font-bold text-[#CD5C5C]">
                RM {addonItems.reduce((sum, it) => sum + it.price * it.quantity, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200/60 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</div>
              <div className="mt-1.5 text-sm font-bold text-gray-900">Paying now</div>
              <div className="mt-1 text-sm font-bold text-[#CD5C5C]">RM {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-slate-100/50 border border-slate-200/60 p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Calculation</div>
            <div className="mt-2 space-y-1 text-xs text-gray-700">
              {basePackageItem && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] uppercase tracking-tighter text-slate-400 font-bold">{basePackageItem.category_name}</span>
                    <span className="truncate">{basePackageItem.name} × {basePackageItem.quantity}</span>
                  </div>
                  <span className="shrink-0 font-bold text-gray-900">RM {(basePackageItem.price * basePackageItem.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {addonItems.map((it) => (
                <div key={`${it.id}-${it.sort_order}`} className="flex items-center justify-between gap-3 group/item">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] uppercase tracking-tighter text-slate-400 font-bold">{it.category_name}</span>
                    <span className="truncate">{it.name} × {it.quantity}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 font-bold text-gray-900">RM {(it.price * it.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <button 
                      type="button"
                      onClick={() => {
                        removeItem(it.id, it.sort_order);
                        toast.error(`Removed ${it.name} from trip`);
                      }}
                      className="p-1 text-[#CD5C5C] hover:bg-red-50 rounded-md transition-all"
                      title="Remove from trip"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
                <span className="font-bold text-gray-900">Total</span>
                <span className="shrink-0 font-bold text-[#CD5C5C]">RM {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoryAddons.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <p className="text-slate-400 text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                No upgrades available for this category.
              </p>
            </div>
          ) : (
            categoryAddons.map((addon, addonIdx) => {
              const now = new Date();
              const start = addon.promotion_start_at ? new Date(addon.promotion_start_at) : null;
              const end = addon.promotion_end_at ? new Date(addon.promotion_end_at) : null;

              const isPromotionActive = addon.promotion_price &&
                (!start || start <= now) &&
                (!end || end > now);

              const finalPrice = isPromotionActive && addon.promotion_price ? Number(addon.promotion_price) : Number(addon.price);

              return (
                <motion.div
                  key={addon.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: addonIdx * 0.05 }}
                  className="group relative flex h-full w-[260px] min-h-[350px] shrink-0 flex-col overflow-hidden border border-white/10 bg-zinc-800/40 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#CC1F1F]/55 hover:bg-zinc-700/60 shadow-none rounded-3xl md:w-[380px] md:min-h-[420px]"
                >
                  {addon.image_url ? (
                    <div className="absolute inset-0 z-0">
                      <img
                        src={addon.image_url}
                        alt={addon.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        style={{ opacity: 1.0 }}
                        width={400}
                        height={300}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 z-0 opacity-20">
                      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" />
                    </div>
                  )}

                  <div className="relative p-4 pt-8 md:p-6 md:pt-12 flex flex-col items-center justify-end text-center z-10 flex-1 min-h-[220px] md:min-h-[280px]">
                    <div className="space-y-1 mb-3 md:mb-4">
                      <h4
                        className="text-4xl md:text-6xl lg:text-7xl uppercase leading-none drop-shadow-2xl"
                        style={{ 
                          fontFamily: "'Bebas Neue', sans-serif", 
                          letterSpacing: "0.04em",
                          color: "whitesmoke",
                          textShadow: "0 2px 15px rgba(0,0,0,0.6)"
                        }}
                      >
                        {addon.name}
                      </h4>
                      {addon.description && (
                        <p
                          className="text-xl md:text-2xl lg:text-3xl uppercase leading-tight"
                          style={{ 
                            fontFamily: "'Bebas Neue', sans-serif", 
                            letterSpacing: "0.05em",
                            color: "whitesmoke",
                            textShadow: "0 2px 10px rgba(0,0,0,0.5)"
                          }}
                        >
                          {addon.description}
                        </p>
                      )}
                    </div>

                    {isPromotionActive && addon.promotion_price ? (
                      <div className="mt-auto flex flex-col items-center relative px-4 py-2 md:px-6 md:py-3 rounded-2xl overflow-hidden group/price">
                        {/* Localized background for price visibility */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-[-1] border border-white/10" />
                        <p
                          className="text-2xl md:text-4xl font-black uppercase tracking-[0.18em] text-[#CD5C5C]"
                          style={{ 
                            fontFamily: "'Barlow Condensed', sans-serif",
                            textShadow: "0 2px 8px rgba(0,0,0,0.3)"
                          }}
                        >
                          RM {addon.promotion_price.toLocaleString()}
                        </p>
                        <p className="text-xs md:text-sm text-white/50 line-through font-bold">RM {addon.price.toLocaleString()}</p>
                      </div>
                    ) : (
                      <div className="mt-auto relative px-4 py-2 md:px-6 md:py-3 rounded-2xl overflow-hidden group/price">
                        {/* Localized background for price visibility */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-[-1] border border-white/10" />
                        <p
                          className="text-2xl md:text-4xl font-black uppercase tracking-[0.18em] text-[#CD5C5C]"
                          style={{ 
                            fontFamily: "'Barlow Condensed', sans-serif",
                            textShadow: "0 2px 8px rgba(0,0,0,0.3)"
                          }}
                        >
                          RM {addon.price.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-3 pt-1 md:p-4 md:pt-2 flex-1 flex flex-col justify-end relative z-10">
                    {(() => {
                      const isSelected = items.some(it => it.id === addon.id);
                      return (
                        <Button
                          type="button"
                          className={cn(
                            "h-10 md:h-12 w-full rounded-xl border font-black uppercase tracking-[0.18em] transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs md:text-base",
                            isSelected
                              ? "bg-[#CD5C5C] text-white border-white/50 shadow-[0_0_20px_rgba(205,92,92,0.5)] scale-[1.02]"
                              : "bg-slate-800/80 border-white/50 text-white hover:bg-slate-700/90"
                          )}
                          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                          onClick={() => {
                            addItem({
                              id: addon.id,
                              name: addon.name,
                              price: finalPrice,
                              original_price: Number(addon.price),
                              promotion_end_at: isPromotionActive && addon.promotion_end_at ? addon.promotion_end_at : undefined,
                              image_url: addon.image_url,
                              parentPackageId: parentPackageId || undefined,
                              sort_order: 1,
                              category_id: addon.category_id,
                              category_name: currentCategory?.name
                            });
                            trackEvent({
                              action_type: 'click',
                              entity_type: 'dynamic_panel',
                              entity_id: `addon_add_${addon.id}`,
                              entity_name: `Add Addon: ${addon.name}`,
                              source: 'AddonsSelection'
                            });
                            toast.success(`Added ${addon.name} to trip`);
                          }}
                        >
                          {isSelected && <Check className="w-4 h-4" />}
                          {isSelected ? "Added to Trip" : "Add to Trip"}
                        </Button>
                      );
                    })()}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Navigation */}
        <div className="flex flex-row items-center mt-8 gap-3 sm:gap-4">
          <Button
            onClick={() => onBackToFlight?.()}
            variant="outline"
            className="h-11 flex-1 sm:flex-none px-4 sm:px-5 rounded-xl text-white text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] bg-[#CD5C5C] border-none hover:scale-105 hover:shadow-[0_0_25px_rgba(205,92,92,0.6)] transition-all duration-300 gap-2 shadow-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="truncate">Back</span>
          </Button>

          <Button
            onClick={() => onComplete?.()}
            className="h-11 flex-[2] sm:flex-none px-6 sm:px-10 rounded-xl text-white text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(205,92,92,0.6)] gap-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              background: '#CD5C5C',
            }}
          >
            <span className="truncate">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};