import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";

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

// Default categories/packages to match the user's image if DB is empty
const DEFAULT_CATEGORIES = [
  { id: "cat_flight_upgrades", name: "Flight Upgrades", icon: "plane" },
  { id: "cat_logistics", name: "Logistics & Others", icon: "car" },
  { id: "cat_media", name: "Video & Media", icon: "video" },
  { id: "cat_celebration", name: "Celebration", icon: "gift" },
];

const DEFAULT_ADDONS: AddonPackage[] = [
  // Flight Upgrades
  { id: "add_ext_time", category_id: "cat_flight_upgrades", name: "Extended Flight Time (+30 Mins)", description: "Extend your flight time by 30 minutes.", price: 900 },
  { id: "add_passenger", category_id: "cat_flight_upgrades", name: "Additional Passenger", description: "Bring a friend along for the ride.", price: 200 },
  
  // Logistics
  { id: "add_hangar", category_id: "cat_logistics", name: "Hangar Tour Pass (Guest)", description: "Tour the hangar and see the aircraft up close.", price: 65 },
  { id: "add_transfer", category_id: "cat_logistics", name: "Luxury Car Transfer (Round Trip)", description: "Arrive in style with our luxury car transfer.", price: 450 },
  
  // Media
  { id: "add_reel", category_id: "cat_media", name: "Highlight Reel Video (Social Ready)", description: "A fast-paced, vertical clip for Instagram & TikTok.", price: 150 },
  { id: "add_raw", category_id: "cat_media", name: "Go Pro Cockpit Raw Video", description: "Take home the full & unedited HD Cockpit footage.", price: 199 },
  { id: "add_movie", category_id: "cat_media", name: "Sky Moments Video", description: "A cinematic 2-minute mini-movie telling your full story.", price: 350 },
  
  // Celebration
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
  const { addItem } = useCart();

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        if (parentPackageId) {
           // Fetch linked addons specific to the selected package
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
                // Map sort_order from link table to package object for grouping
                const addonsWithGroup = pkgs.map(p => {
                   const link = linked.find(l => l.addon_package_id === p.id);
                   return {
                      ...p,
                      category_id: `group-${link?.sort_order || 0}` // Hijack category_id for grouping
                   };
                });
                
                setAddons(addonsWithGroup);
                
                // Create categories from groups
                const groups = Array.from(new Set(linked.map(l => l.sort_order))).sort((a,b) => a - b);
                const fakeCategories = groups.map(g => ({
                   id: `group-${g}`,
                   name: `Add-ons Group ${g + 1}`,
                   icon: 'gift'
                }));
                setCategories(fakeCategories);
             }
           } else {
             // Fallback if no specific addons are defined: show nothing or default?
             // User implied strict relationship. Show nothing implies "No addons".
             setAddons([]);
             setCategories([]);
           }
        } else {
          // Default behavior: Fetch Packages where sort_order >= 1
          let query = supabase
            .from('packages')
            .select('*')
            .gte('sort_order', 1)
            .eq('is_active', true);

          if (excludeCategoryId) {
            query = query.neq('category_id', excludeCategoryId);
          }

          const { data: pkgsData, error: pkgsError } = await query
            .order('name', { ascending: true });

          if (pkgsError) throw pkgsError;

          if (pkgsData && pkgsData.length > 0) {
            setAddons(pkgsData);
            
            // 2. Extract unique category IDs from these packages
            const catIds = Array.from(new Set(pkgsData.map(p => p.category_id)));
            
            if (catIds.length > 0) {
              const { data: catsData, error: catsError } = await supabase
                .from('categories')
                .select('*')
                .in('id', catIds)
                .order('sort_order', { ascending: true });
              
              if (catsError) throw catsError;
              
              if (catsData) {
                // If we are at sort_order 0 (AddonsSelection stage), we might want to filter categories
                // based on the selected package's category if requested, but for now we follow the general rule
                // that sort_order >= 1 items are shown here.
                setCategories(catsData);
              }
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
  }, [excludeCategoryId, parentPackageId]);

  const getCategoryIcon = (catName: string) => {
    const lower = catName.toLowerCase();
    if (lower.includes("flight")) return "✈️"; // Plane
    if (lower.includes("logistic") || lower.includes("transport")) return "🚗"; // Car
    if (lower.includes("video") || lower.includes("media")) return "📹"; // Video
    if (lower.includes("celebration") || lower.includes("gift")) return "🎁"; // Gift
    return "✨";
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading customization options...</p>
      </div>
    );
  }

  if (addons.length === 0) {
    // If no addons, immediately proceed to passenger details
    if (onComplete) {
      onComplete();
    }
    return null;
  }

  const currentCategory = categories[currentCategoryIndex];
  if (!currentCategory) {
    // If somehow we have addons but no categories, or index out of bounds
    return (
      <div className="text-center py-12">
        <Button onClick={onComplete}>Continue to Final Details</Button>
      </div>
    );
  }

  const categoryAddons = addons.filter(a => a.category_id === currentCategory.id);

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">{currentCategory.name}</h2>
        <p className="text-amber-600 font-medium uppercase tracking-wider text-sm">
          Step {currentCategoryIndex + 1} of {categories.length}: Customise Your Journey
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card key={currentCategory.id} className="h-full border-2 border-black shadow-[0_0_30px_-12px_rgba(0,0,0,0.15)] hover:border-primary hover:shadow-[0_0_40px_-10px_rgba(239,68,68,0.3)] transition-all duration-500 overflow-hidden">
          <CardHeader className="pb-3 border-b bg-slate-900 text-white">
            <CardTitle className="text-lg font-bold flex items-center gap-2 uppercase tracking-wide">
              <span className="text-primary">{getCategoryIcon(currentCategory.name)}</span>
              {currentCategory.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6 bg-white">
            {categoryAddons.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No upgrades available for this category.</p>
            ) : (
              categoryAddons.map((addon) => {
                const now = new Date();
                const start = addon.promotion_start_at ? new Date(addon.promotion_start_at) : null;
                const end = addon.promotion_end_at ? new Date(addon.promotion_end_at) : null;

                const isPromotionActive = addon.promotion_price && 
                  (!start || start <= now) &&
                  (!end || end > now);
                
                const finalPrice = isPromotionActive && addon.promotion_price ? Number(addon.promotion_price) : Number(addon.price);

                return (
                <div key={addon.id} className="group relative flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-white border border-black hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-primary transition-colors">{addon.name}</h4>
                      <div className="sm:hidden flex flex-col items-end">
                        {isPromotionActive && addon.promotion_price ? (
                          <>
                            <span className="font-bold text-primary text-sm whitespace-nowrap">RM {addon.promotion_price}</span>
                            <span className="text-[10px] text-muted-foreground line-through">RM {addon.price}</span>
                          </>
                        ) : (
                          <span className="font-bold text-primary text-sm whitespace-nowrap">RM {addon.price}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-snug line-clamp-2">
                      {addon.description}
                    </p>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 min-w-[100px] border-t sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
                    <div className="hidden sm:flex flex-col items-end">
                        {isPromotionActive && addon.promotion_price ? (
                          <>
                            <span className="font-bold text-slate-900 text-base">RM {addon.promotion_price}</span>
                            <span className="text-xs text-muted-foreground line-through">RM {addon.price}</span>
                          </>
                        ) : (
                          <span className="font-bold text-slate-900 text-base">RM {addon.price}</span>
                        )}
                    </div>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="h-8 gap-1.5 w-full sm:w-auto border-slate-200 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-all shadow-sm"
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
                          category_id: addon.category_id
                        });
                        trackEvent({
                          action_type: 'click',
                          entity_type: 'dynamic_panel',
                          entity_id: `addon_add_${addon.id}`,
                          entity_name: `Add Addon: ${addon.name}`
                        });
                        toast.success(`Added ${addon.name} to trip`);
                      }}
                    >
                      <Plus className="w-4 h-4" /> Add to Trip
                    </Button>
                  </div>
                </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between items-center mt-8 gap-4">
           <Button
             onClick={() => {
               if (currentCategoryIndex === 0) {
                 onBackToFlight?.();
               } else {
                 onCategoryChange?.(currentCategoryIndex - 1);
               }
             }}
             className="bg-[#EAB308] hover:bg-[#D9A306] text-slate-900 font-bold px-6 h-12 transition-all shadow-md"
           >
             {currentCategoryIndex === 0 ? "Back to Select Flight" : "Previous Category"}
           </Button>
          
          {currentCategoryIndex < categories.length - 1 ? (
            <Button
              onClick={() => onCategoryChange?.(currentCategoryIndex + 1)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-10 h-12 transition-all shadow-md rounded-md"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={onComplete}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-10 h-12 transition-all shadow-md rounded-md"
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
