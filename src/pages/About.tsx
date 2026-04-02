import React, { useEffect, useState, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, X, ZoomIn } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface AboutSection {
  id: string;
  section_key: string;
  title: string;
  content: string;
  image_url: string | null;
  images: string[] | null;
  bg_color: string | null;
  display_order: number;
  additional_data: any;
}

const AutoScrollGallery = ({ images, title, onImageClick, isLogos = false, imageData = [] }: { 
  images: string[], 
  title: string, 
  onImageClick: (url: string) => void,
  isLogos?: boolean,
  imageData?: { url: string, description?: string }[]
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const scrollPosRef = useRef(0);
  
  // Use imageData if provided, otherwise construct it from images
  const displayData: { url: string; description?: string }[] = imageData.length > 0 
    ? imageData 
    : images.map(url => ({ url }));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animationFrameId: number;
    const speed = 0.5; // Pixels per frame

    const animate = () => {
      if (!el || isHovered) return;
      
      scrollPosRef.current += speed;
      
      // Reset when scrolled past 1/3 (since we duplicated 3 times)
      if (scrollPosRef.current >= el.scrollWidth / 3) {
        scrollPosRef.current = 0;
      }
      
      el.scrollLeft = scrollPosRef.current;
      animationFrameId = requestAnimationFrame(animate);
    };

    if (el.scrollWidth > el.clientWidth && !isHovered) {
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [images, isHovered]);

  const handleScroll = () => {
    if (isHovered && scrollRef.current) {
      scrollPosRef.current = scrollRef.current.scrollLeft;
    }
  };

  return (
    <div 
      className="w-full overflow-hidden relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (scrollRef.current) {
          scrollPosRef.current = scrollRef.current.scrollLeft;
        }
      }}
    >
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex gap-6 overflow-x-auto py-4 no-scrollbar ${isLogos ? 'items-center' : 'items-stretch'} ${isHovered ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ 
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Render three times for infinite loop illusion */}
        {[...displayData, ...displayData, ...displayData].map((item, idx) => (
          <div 
            key={idx} 
            className={`flex-shrink-0 relative group/image cursor-zoom-in ${
              isLogos 
                ? 'w-48 h-32 p-4 bg-white rounded-xl shadow-sm border border-slate-100' 
                : 'w-80 md:w-96 rounded-xl overflow-hidden shadow-lg bg-white flex flex-col'
            }`}
            onClick={() => onImageClick(item.url)}
          >
            <div className={isLogos ? "w-full h-full" : "aspect-[4/3] overflow-hidden"}>
              <img 
                src={item.url} 
                alt={`${title} ${idx}`} 
                className={`w-full h-full ${isLogos ? 'object-contain' : 'object-cover'} transition-transform duration-700 group-hover/image:scale-110`}
              />
            </div>
            
            {!isLogos && item.description && (
              <div className="p-4 bg-white">
                <p className="text-slate-900 font-bold text-sm truncate">{item.description}</p>
              </div>
            )}
            
            {/* Zoom Icon Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover/image:opacity-100">
              <ZoomIn className="text-white w-8 h-8 drop-shadow-md" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Gradient Masks */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white/80 to-transparent z-10 pointer-events-none" />
    </div>
  );
};

const SectionRenderer = ({ section, onImageClick }: { section: AboutSection, onImageClick: (url: string) => void }) => {
  const isClients = section.section_key === 'our_clients' || section.additional_data?.is_logos;
  const allImages = section.images && section.images.length > 0 
    ? section.images 
    : (section.image_url ? [section.image_url] : []);
  
  // Extract image data from additional_data if it exists (for descriptions)
  const imageData = section.additional_data?.image_data || [];

  return (
    <motion.section 
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className="p-8 md:p-12 rounded-3xl transition-colors duration-500 overflow-hidden"
      style={{ backgroundColor: section.bg_color || '#ffffff' }}
    >
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter italic">
            {section.title}
          </h2>
          {section.content && (
            <div className="prose prose-lg text-slate-600 max-w-3xl whitespace-pre-line mx-auto text-center font-medium">
              {section.content}
            </div>
          )}
        </div>

        {allImages.length > 0 && (
          <div className="mt-8">
            <AutoScrollGallery 
              images={allImages} 
              title={section.title} 
              onImageClick={onImageClick}
              isLogos={isClients}
              imageData={imageData}
            />
          </div>
        )}
      </div>
    </motion.section>
  );
};

const About = () => {
  const [sections, setSections] = useState<AboutSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const ensureAuthSession = async () => {
      if (!supabase) return false;
      const { data: { session } } = await supabase.auth.getSession();
      return !!session;
    };

    const fetchSections = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        await ensureAuthSession();
        const { data, error } = await supabase
          .from('about_page')
          .select('*')
          .order('display_order');
        
        if (error) throw error;
        
        // Filter out specific sections as requested
        const filteredData = (data || []).filter(section => {
          const title = (section.title || '').toLowerCase();
          return !title.includes('safety is our top priority') && 
                 !title.includes('expert flight instructor') && 
                 !title.includes('flexible booking');
        });

        setSections(filteredData);
      } catch (error) {
        console.error("Error fetching about page content:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="pb-16">
        {/* Top Black Panel */}
        <div className="bg-slate-950 pt-32 pb-20 relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
            <img src="/airplane_transparent.svg" alt="" className="w-full h-auto filter invert rotate-12" />
          </div>
          
          <div className="container mx-auto px-4 relative z-10">
            {/* Placeholder for fixed button space */}
            <div className="h-16 mb-12 invisible"></div>
            {/* Back Button */}
            <div className="fixed top-20 left-4 z-40 md:top-24 md:left-8">
              <Link to="/">
                <Button 
                  variant="outline" 
                  className="gap-2 px-4 py-3 sm:px-6 sm:py-6 rounded-2xl border-2 border-white text-white hover:bg-white hover:text-slate-900 transition-all duration-300 font-black uppercase tracking-tighter shadow-[0_0_20px_rgba(0,0,0,0.3)] active:scale-95 group bg-slate-900/40 backdrop-blur-md"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:-translate-x-2" />
                  <span className="text-xs sm:text-base">Back to Flight Deck</span>
                </Button>
              </Link>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-4xl"
            >
              <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tighter uppercase italic">
                Our Aviation <span className="text-primary">Legacy</span>
              </h1>
              <p className="text-slate-400 text-lg md:text-xl font-medium max-w-2xl leading-relaxed">
                Discover the story behind OneDayPilot, our commitment to safety, and our mission to make the sky accessible to everyone.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="container mx-auto px-4 mt-12">
          <div className="space-y-12">
            {sections.map((section) => (
              <SectionRenderer 
                key={section.id} 
                section={section} 
                onImageClick={setSelectedImage} 
              />
            ))}
          </div>
        </div>
      </main>

      {/* Image Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-7xl max-h-[90vh] w-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute -top-12 right-0 text-white hover:bg-white/20 rounded-full"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-6 w-6" />
              </Button>
              <img 
                src={selectedImage} 
                alt="Zoomed view" 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
};

export default About;
