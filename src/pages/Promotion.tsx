import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Clock, ShoppingBag, Calendar } from "lucide-react";
import { format } from "date-fns";

type PromotionItem = {
  id: string;
  type: 'package' | 'event' | 'category';
  name: string;
  description?: string;
  price?: number;
  promotion_price?: number;
  promotion_start_at?: string;
  promotion_end_at?: string;
  image_url?: string;
  original_price?: number;
  offer_percentage?: number;
};

const Promotion = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get("type"); // 'package', 'event', 'category'
  const id = searchParams.get("id");
  const [item, setItem] = useState<PromotionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const fetchPromotion = async () => {
      if (!id || !type) return;

      let data;
      let promotionItem: PromotionItem | null = null;

      if (type === 'package') {
        const { data: pkg } = await supabase
          .from('packages')
          .select('*')
          .eq('id', id)
          .single();
        
        if (pkg) {
          promotionItem = {
            id: pkg.id,
            type: 'package',
            name: pkg.name,
            description: pkg.description,
            price: pkg.price,
            promotion_price: pkg.promotion_price,
            promotion_start_at: pkg.promotion_start_at,
            promotion_end_at: pkg.promotion_end_at,
            image_url: pkg.image_url,
            original_price: pkg.price
          };
        }
      } else if (type === 'event') {
        const { data: evt } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .single();
          
        if (evt) {
          promotionItem = {
            id: evt.id,
            type: 'event',
            name: evt.name,
            description: evt.event_description,
            price: evt.price,
            promotion_price: evt.promotion_price,
            promotion_start_at: evt.promotion_start_at,
            promotion_end_at: evt.promotion_end_at,
            image_url: evt.event_image_url,
            original_price: evt.price
          };
        }
      }

      setItem(promotionItem);
      setLoading(false);
    };

    fetchPromotion();
  }, [id, type]);

  useEffect(() => {
    if (!item?.promotion_end_at) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(item.promotion_end_at!).getTime();
      const distance = end - now;

      if (distance < 0) {
        setTimeLeft("EXPIRED");
        clearInterval(timer);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [item]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
  }

  if (!item) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Promotion not found</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="pt-24 pb-12 px-4">
          <div className="container mx-auto max-w-4xl">
            {/* Space for fixed button */}
            <div className="h-16 mb-6"></div>
          {/* Back Button */}
          <div className="fixed top-20 left-4 z-40 md:top-24 md:left-8">
            <Link to="/">
              <Button 
                variant="outline" 
                className="gap-2 px-4 py-3 sm:px-6 sm:py-6 rounded-2xl border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white transition-all duration-300 font-black uppercase tracking-tighter shadow-lg active:scale-95 group bg-white/80 backdrop-blur-md"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:-translate-x-2" />
                <span className="text-xs sm:text-base">Back to Flight Deck</span>
              </Button>
            </Link>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-black/5">
            <div className="relative h-64 sm:h-96">
              <img 
                src={item.image_url || "/placeholder.svg"} 
                alt={item.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 sm:p-10 text-white">
                <div className="inline-flex items-center gap-2 bg-primary px-3 py-1 rounded-full mb-3 shadow-lg shadow-primary/20">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Limited Time Offer</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight mb-2">{item.name}</h1>
                <p className="text-white/90 font-medium max-w-xl">{item.description}</p>
              </div>
            </div>

            <div className="p-6 sm:p-10 grid gap-8 md:grid-cols-2">
              <div className="space-y-6">
                <div className="bg-primary/5/50 rounded-2xl p-6 border border-primary/10">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-4">Offer Ends In</h3>
                  <div className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight tabular-nums">
                    {timeLeft}
                  </div>
                  <p className="text-xs font-bold text-primary/40 mt-2 uppercase tracking-widest">Don't miss out!</p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Promotion Details</h3>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-black/5">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Regular Price</span>
                    <span className="text-lg font-black text-slate-400 line-through">MYR {item.original_price?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                    <span className="text-xs font-black uppercase tracking-widest">Offer Price</span>
                    <span className="text-2xl font-black">MYR {item.promotion_price?.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="prose prose-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-4">About this Deal</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Grab this exclusive offer now! Book before the timer runs out to secure this special rate. 
                    Terms and conditions apply.
                  </p>
                </div>

                <Button 
                  size="lg"
                  className="w-full h-14 text-sm font-black uppercase tracking-widest rounded-xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                  onClick={() => {
                     if (item.type === 'package') {
                       // Logic to add to trip or view package
                       // For now, redirect to booking wizard or home with package selected?
                       // User said "add to trip" - maybe just go to home and open wizard?
                       navigate(`/?package=${item.id}`);
                     } else {
                       navigate(`/event?eid=${item.id}`);
                     }
                  }}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" /> Book Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Promotion;
