import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plane, Car, Video, Gift, Check, ShoppingCart, Plus } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
  max_quantity?: number;
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
        const { data: pkgsRes, error: pkgsError } = await supabase
          .from('packages')
          .select('*')
          .gte('sort_order', 1)
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (pkgsError) throw pkgsError;

        if (pkgsRes && pkgsRes.length > 0) {
          setPackages(pkgsRes);
          const catIds = Array.from(new Set(pkgsRes.map(p => p.category_id)));
          if (catIds.length > 0) {
            const { data: catsRes, error: catsError } = await supabase
              .from('categories')
              .select('*')
              .in('id', catIds)
              .order('sort_order', { ascending: true });
            if (catsError) throw catsError;
            if (catsRes) setCategories(catsRes);
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

  if (loading) {
    return (
      <div className="py-32 text-center">
        <div className="inline-flex items-center gap-3 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-[#CC1F1F] animate-pulse" />
          <span className="text-xs tracking-[0.3em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Loading packages</span>
        </div>
      </div>
    );
  }

  return (
    <section
      id="pricing"
      className="relative py-24 md:py-32 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #FAFBFC 0%, #F4F6FA 100%)',
      }}
    >
      {/* Decorative sky-grid background */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(15,23,42,1) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      {/* Red glow accent */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none opacity-30"
           style={{ background: 'radial-gradient(circle, rgba(204,31,31,0.15) 0%, transparent 60%)' }} />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16 md:mb-20"
        >
          <div className="inline-flex items-center gap-3 mb-5">
            <span className="w-10 h-[1px] bg-[#CC1F1F]" />
            <span className="text-[#CC1F1F] text-[10px] font-bold tracking-[0.4em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Customize Your Flight
            </span>
            <span className="w-10 h-[1px] bg-[#CC1F1F]" />
          </div>
          <h2
            className="text-slate-900 mb-4 leading-none"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)',
              letterSpacing: '0.02em',
            }}
          >
            Tailor Your <span className="text-[#CC1F1F]">Journey</span>
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto text-[15px] leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Premium upgrades to elevate your One Day Pilot experience — choose what makes your flight unforgettable.
          </p>
        </motion.div>

        {categories.length === 0 ? (
          <div className="text-center text-sm text-slate-400">No packages available.</div>
        ) : (
          <div className="grid gap-7 max-w-5xl mx-auto">
            {categories.map((category, idx) => {
              const categoryPackages = packages.filter(p => p.category_id === category.id);
              if (categoryPackages.length === 0) return null;

              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: idx * 0.08 }}
                  className="group relative bg-white rounded-3xl border border-slate-200/70 overflow-hidden hover:border-slate-300/70 transition-all duration-500 hover:shadow-[0_24px_60px_-20px_rgba(15,23,42,0.18)]"
                >
                  {/* Top accent bar */}
                  <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #CC1F1F 0%, #FF4444 50%, #CC1F1F 100%)' }} />

                  <div className="p-8 md:p-10">
                    {/* Category header */}
                    <div className="flex items-center gap-4 mb-8 pb-6 border-b border-dashed border-slate-200">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#CC1F1F] shrink-0"
                        style={{
                          background: 'linear-gradient(135deg, rgba(204,31,31,0.08) 0%, rgba(204,31,31,0.03) 100%)',
                          border: '1px solid rgba(204,31,31,0.15)',
                        }}
                      >
                        {getIcon(category.icon || category.name)}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold tracking-[0.32em] uppercase block mb-0.5" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                          Category · 0{idx + 1}
                        </span>
                        <h3
                          className="text-slate-900 leading-tight"
                          style={{
                            fontFamily: "'Bebas Neue', sans-serif",
                            fontSize: '1.85rem',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {category.name}
                        </h3>
                      </div>
                    </div>

                    {/* Packages */}
                    <div className="space-y-5">
                      {categoryPackages.map((pkg, pkgIdx) => (
                        <motion.div
                          key={pkg.id}
                          initial={{ opacity: 0, x: -16 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, delay: pkgIdx * 0.05 }}
                          className="group/pkg relative p-5 rounded-2xl bg-slate-50/60 border border-slate-200/60 hover:bg-white hover:border-[#CC1F1F]/25 hover:shadow-[0_8px_24px_-8px_rgba(204,31,31,0.12)] transition-all duration-400"
                        >
                          <div className="flex flex-col sm:flex-row gap-5">
                            {pkg.image_url && (
                              <div className="w-full sm:w-44 h-44 sm:h-32 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200/80">
                                <img
                                  src={pkg.image_url}
                                  alt={pkg.name}
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover/pkg:scale-110"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 flex flex-col">
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <h4
                                  className="font-bold text-slate-900 group-hover/pkg:text-[#CC1F1F] transition-colors leading-tight"
                                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1.1rem' }}
                                >
                                  {pkg.name}
                                </h4>
                                <span
                                  className="sm:hidden whitespace-nowrap text-[#CC1F1F]"
                                  style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.02em' }}
                                >
                                  RM{pkg.price}
                                </span>
                              </div>
                              <p className="text-sm text-slate-500 leading-relaxed flex-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                {pkg.description}
                              </p>
                            </div>
                            <div className="hidden sm:flex flex-col items-end justify-between gap-3 shrink-0 pl-4 border-l border-dashed border-slate-200">
                              <div className="text-right">
                                <span className="text-[9px] text-slate-400 tracking-[0.3em] uppercase block mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Price</span>
                                <span
                                  className="text-slate-900 leading-none"
                                  style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', letterSpacing: '0.01em' }}
                                >
                                  <span className="text-sm align-top text-slate-400">RM</span>{pkg.price}
                                </span>
                                {pkg.name.includes('/pax') && <span className="text-[10px] font-medium text-slate-400 block">per pax</span>}
                              </div>
                              <Button
                                size="sm"
                                className="h-9 gap-1.5 px-5 rounded-xl border border-[#CC1F1F]/70 bg-transparent text-[#CC1F1F] font-bold text-[11px] tracking-[0.18em] uppercase transition-all duration-300 hover:bg-[#CC1F1F] hover:text-white"
                                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                                onClick={() => {
                                  addItem({
                                    id: pkg.id,
                                    name: pkg.name,
                                    price: pkg.price,
                                    image_url: pkg.image_url,
                                    sort_order: pkg.sort_order,
                                    category_id: pkg.category_id,
                                    category_name: category.name
                                  });
                                  toast.success(`Added ${pkg.name} to cart`);
                                }}
                              >
                                <Plus className="w-3 h-3" /> Add
                              </Button>
                            </div>
                          </div>

                          {/* Mobile action row */}
                          <div className="sm:hidden mt-4 pt-4 border-t border-dashed border-slate-200">
                            <Button
                              size="sm"
                              className="w-full h-10 gap-2 rounded-xl border border-[#CC1F1F]/70 bg-transparent text-[#CC1F1F] font-bold text-[11px] tracking-[0.18em] uppercase transition-all duration-300 hover:bg-[#CC1F1F] hover:text-white"
                              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                              onClick={() => {
                                addItem({
                                  id: pkg.id,
                                  name: pkg.name,
                                  price: pkg.price,
                                  image_url: pkg.image_url,
                                  sort_order: pkg.sort_order,
                                  category_id: pkg.category_id,
                                  category_name: category.name
                                });
                                toast.success(`Added ${pkg.name} to cart`);
                              }}
                            >
                              <Plus className="w-4 h-4" /> Add to Trip
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
