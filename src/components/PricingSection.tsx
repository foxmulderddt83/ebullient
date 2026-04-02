import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plane, Car, Video, Gift, Check, ShoppingCart, Plus } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

interface Package {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  is_active: boolean;
  sort_order: number;
}

export const PricingSection = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        // Fetch packages where sort_order >= 1
        const { data: pkgsRes, error: pkgsError } = await supabase
          .from('packages')
          .select('*')
          .gte('sort_order', 1)
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (pkgsError) throw pkgsError;

        if (pkgsRes && pkgsRes.length > 0) {
          setPackages(pkgsRes);
          
          // Extract unique category IDs from these packages
          const catIds = Array.from(new Set(pkgsRes.map(p => p.category_id)));
          
          if (catIds.length > 0) {
            const { data: catsRes, error: catsError } = await supabase
              .from('categories')
              .select('*')
              .in('id', catIds)
              .order('sort_order', { ascending: true });
            
            if (catsError) throw catsError;
            
            if (catsRes) {
              setCategories(catsRes);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
      
      setLoading(false);
    };

    fetchData();
  }, []);

  const getIcon = (iconName: string) => {
    const normalized = (iconName || "").toLowerCase();
    if (normalized.includes("plane")) return <Plane className="w-5 h-5" />;
    if (normalized.includes("car")) return <Car className="w-5 h-5" />;
    if (normalized.includes("video")) return <Video className="w-5 h-5" />;
    if (normalized.includes("gift")) return <Gift className="w-5 h-5" />;
    return <Check className="w-5 h-5" />;
  };

  const getColorClass = (index: number) => {
    const colors = [
      "text-blue-600",
      "text-slate-600",
      "text-purple-600",
      "text-red-600"
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return <div className="py-20 text-center">Loading packages...</div>;
  }

  return (
    <section id="pricing" className="section-padding bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="section-title font-heading mb-4">Customise Your Journey</h2>
          <p className="text-orange-400 font-medium tracking-wide uppercase text-sm">
            TAILOR YOUR FLIGHT WITH THESE PREMIUM EXPERIENCES UPGRADES
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">No packages available.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            {categories.map((category, idx) => {
              const categoryPackages = packages.filter(p => p.category_id === category.id);
              if (categoryPackages.length === 0) return null;

              return (
                <div key={category.id} className="bg-card rounded-xl shadow-sm border border-black p-6 hover:shadow-md transition-shadow">
                  <div className={`flex items-center gap-3 mb-6 ${getColorClass(idx)}`}>
                    {getIcon(category.icon || category.name)}
                    <h3 className="text-lg font-bold uppercase tracking-wide">{category.name}</h3>
                  </div>

                  <div className="space-y-6">
                    {categoryPackages.map(pkg => (
                      <div key={pkg.id} className="group p-3 rounded-lg bg-muted/30 sm:bg-transparent border border-black sm:border-0">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-3 sm:gap-4">
                          <div className="flex-1">
                            <div className="flex justify-between items-start gap-2">
                              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                                {pkg.name}
                              </h4>
                              <span className="sm:hidden font-bold text-primary whitespace-nowrap">RM {pkg.price}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                              {pkg.description}
                            </p>
                          </div>
                          <div className="w-full sm:w-auto text-right whitespace-nowrap flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
                            <div className="hidden sm:block">
                              <span className="font-bold text-foreground">RM {pkg.price}</span>
                              {pkg.name.includes('/pax') && <span className="text-xs text-muted-foreground">/pax</span>}
                            </div>
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              className="h-9 sm:h-8 gap-1 w-full sm:w-auto border-slate-200 shadow-sm hover:bg-primary hover:text-white transition-colors"
                              onClick={() => {
                                addItem({
                                  id: pkg.id,
                                  name: pkg.name,
                                  price: pkg.price,
                                  image_url: pkg.image_url,
                                  sort_order: pkg.sort_order,
                                  category_id: pkg.category_id
                                });
                                toast.success(`Added ${pkg.name} to cart`);
                              }}
                            >
                              <Plus className="w-4 h-4 sm:w-3 sm:h-3" /> Add to Trip
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
