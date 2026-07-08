import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type OfferCategory = {
  id: string;
  name: string;
  offer_percentage: number | null;
  offer_start: string | null;
  offer_end: string | null;
  offer_is_active: boolean | null;
  offer_image_url: string | null;
};

type OfferPackage = {
  id: string;
  name: string;
  price: number;
  sort_order: number;
  category_id: string;
};

const Offers = () => {
  const [categories, setCategories] = useState<OfferCategory[]>([]);
  const [packages, setPackages] = useState<OfferPackage[]>([]);

  useEffect(() => {
    const fetchOffers = async () => {
      if (!supabase) return;

      const { data: categoryData } = await supabase
        .from("categories")
        .select("id, name, offer_percentage, offer_start, offer_end, offer_is_active, offer_image_url")
        .eq("offer_is_active", true)
        .order("sort_order", { ascending: true });

      const { data: packageData } = await supabase
        .from("packages")
        .select("id, name, price, sort_order, category_id")
        .in("sort_order", [0, 1])
        .order("sort_order", { ascending: true });

      setCategories((categoryData || []) as OfferCategory[]);
      setPackages((packageData || []) as OfferPackage[]);
    };

    fetchOffers();
  }, []);

  const offerCards = useMemo(() => {
    return categories
      .filter(cat => (cat.offer_percentage || 0) > 0)
      .map(cat => {
        const catPackages = packages.filter(pkg => pkg.category_id === cat.id);
        return { category: cat, packages: catPackages };
      });
  }, [categories, packages]);

  const getOfferTiming = (start?: string | null, end?: string | null) => {
    if (!start || !end) return "Schedule not set";
    const now = new Date();
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "Schedule not set";
    if (now < startDate) {
      const diff = Math.max(0, startDate.getTime() - now.getTime());
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      return `Starts in ${hours}h ${mins}m`;
    }
    if (now <= endDate) {
      const diff = Math.max(0, endDate.getTime() - now.getTime());
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      return `Ends in ${hours}h ${mins}m`;
    }
    return "Offer ended";
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-24 md:pt-28 pb-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary">Limited Time</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">Offer Packages</h1>
            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-600 mt-2">Main packages with special discounts</p>
          </div>

          {offerCards.length === 0 ? (
            <div className="rounded-3xl border border-black/5 bg-white/80 backdrop-blur-sm shadow-xl p-8 text-center">
              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-600">No active offers right now</p>
              <Button className="mt-6 h-11 rounded-2xl font-black uppercase tracking-widest text-[11px] sm:text-xs" onClick={() => window.location.href = "/"}>
                Back to Home
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {offerCards.map(({ category, packages }) => (
                <div key={category.id} className="rounded-3xl border border-black/5 bg-white/90 backdrop-blur-sm shadow-xl p-6 sm:p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      {category.offer_image_url ? (
                        <img
                          src={category.offer_image_url}
                          alt={category.name}
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover shadow-md"
                        />
                      ) : (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-xl">
                          {category.name?.charAt(0) || "O"}
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary">Offer</p>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{category.name}</h2>
                        <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-600 mt-1">{category.offer_percentage || 0}% off main packages</p>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-600">Offer Window</p>
                      <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mt-1">
                        {category.offer_start && category.offer_end
                          ? `${format(new Date(category.offer_start), "MMM dd, yyyy HH:mm")} - ${format(new Date(category.offer_end), "MMM dd, yyyy HH:mm")}`
                          : "Schedule not set"}
                      </p>
                      <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-rose-600 mt-2">
                        {getOfferTiming(category.offer_start, category.offer_end)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {packages.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-black/10 p-4 text-center text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-500">
                        No main packages found for this category
                      </div>
                    ) : (
                      packages.map(pkg => {
                        const discount = category.offer_percentage ? category.offer_percentage / 100 : 0;
                        const discounted = pkg.price * (1 - discount);
                        return (
                          <div key={pkg.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-600">Main Package {pkg.sort_order + 1}</p>
                            <h3 className="text-lg font-black text-slate-900 mt-2">{pkg.name}</h3>
                            <div className="mt-3 flex items-center justify-between">
                              <div>
                                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-400">Original</p>
                                <p className="text-base font-black text-slate-400 line-through">RM {pkg.price.toFixed(2)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary">Offer Price</p>
                                <p className="text-lg font-black text-primary">RM {discounted.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Offers;
