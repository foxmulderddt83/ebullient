import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MapPin, Plane, Heart, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";

// Types of notifications
type NotificationType = "booking" | "review" | "visit" | "love";

interface NotificationData {
  id: string;
  type: NotificationType;
  name: string;
  avatar?: string;
  message: string;
  rating?: number;
  location?: string;
  timeAgo: string;
}

// Mock data generators
const NAMES = [
  "Sarah M.", "James L.", "Ahmad R.", "Wei Chen", "Jessica K.", "David B.", 
  "Fatima H.", "John D.", "Priya S.", "Michael T.", "Emma W.", "Daniel K.",
  "Sofia R.", "Ali Z.", "Grace L.", "Ryan P.", "Olivia M.", "Lucas H.",
  "Tan Y.", "Rajiv M.", "Lisa T.", "Kevin C.", "Michelle L.", "Brian K."
];

const CITIES = [
  "Kuala Lumpur", "Subang Jaya", "Penang", "Johor Bahru", "Singapore", 
  "Selangor", "Petaling Jaya", "Shah Alam", "Cyberjaya", "Putrajaya",
  "Ipoh", "Malacca", "Kota Kinabalu", "Kuching", "Seremban", "Kuantan"
];

const AVATAR_URLS = [
  // Men (Asian/Malaysian)
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1506803682981-6e718a9dd3ee?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1512484776495-a09d92e87c3b?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1542178243-bc20204b769f?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1564564321837-a57b60765186?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1530268729831-4b0b9e170218?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?auto=format&fit=crop&w=150&q=80",
  
  // Women (Asian/Malaysian)
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1545996124-0501ebae84d0?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1525875975442-025410385c5b?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1532074205216-d0e1f4b87368?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1567532939604-b6c5b0ad2e01?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1531123897727-8f129e16fd3c?auto=format&fit=crop&w=150&q=80"
];

export const SocialProofPopup = () => {
  const location = useLocation();
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [packages, setPackages] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [verticalPos, setVerticalPos] = useState<"top" | "middle" | "bottom">("bottom");
  const [horizontalPos, setHorizontalPos] = useState<"left" | "right">("left");
  const lastUsedAvatars = useRef<string[]>([]); // Track recently used avatars to avoid repetition

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Define pages to exclude
  const isMainPage = location.pathname === "/";
  const isCheckoutPage = location.pathname.includes("checkout");
  const isAdminPage = location.pathname.includes("admin") || location.pathname.includes("login");
  
  // Only show on the main page, specifically exclude checkout/admin, and disable for mobile
  const shouldShow = isMainPage && !isCheckoutPage && !isAdminPage && !isMobile;

  useEffect(() => {
    if (!shouldShow) {
      setIsVisible(false);
      return;
    }

    const fetchData = async () => {
      if (!supabase) return;
      
      try {
        const { data: servicesData } = await supabase
          .from('services')
          .select('title')
          .limit(10);
          
        const { data: packagesData } = await supabase
          .from('packages')
          .select('name')
          .limit(10);
          
        if (servicesData) setServices(servicesData.map(s => s.title));
        if (packagesData) setPackages(packagesData.map(p => p.name));
      } catch (error) {
        console.error("Error fetching social proof data:", error);
      }
    };
    
    fetchData();
  }, []);

  // Helper to generate random notification
  const generateNotification = (): NotificationData => {
    const typeProb = Math.random();
    let type: NotificationType;
    
    // Distribution: 30% booking, 30% visit, 20% review, 20% love
    if (typeProb < 0.3) type = "visit";
    else if (typeProb < 0.6) type = "booking";
    else if (typeProb < 0.8) type = "review";
    else type = "love";

    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    
    // Select an avatar that hasn't been used recently
    const availableAvatars = AVATAR_URLS.filter(url => !lastUsedAvatars.current.includes(url));
    const pool = availableAvatars.length > 0 ? availableAvatars : AVATAR_URLS;
    const avatar = pool[Math.floor(Math.random() * pool.length)];
    
    // Update history (keep last 8 to ensure variety but allow reuse eventually)
    lastUsedAvatars.current = [...lastUsedAvatars.current, avatar];
    if (lastUsedAvatars.current.length > 8) {
      lastUsedAvatars.current.shift();
    }
    
    let message = "";
    let rating = undefined;
    
    // Dynamic content based on fetched data
    const getRandomService = () => services.length > 0 
      ? services[Math.floor(Math.random() * services.length)] 
      : "Pilot Experience";
      
    const getRandomPackage = () => packages.length > 0 
      ? packages[Math.floor(Math.random() * packages.length)] 
      : "Sunset Flight";

    const COMMENTS = {
      booking: [
        `just joined the OneDay Flying Club!`,
        `reserved a trial flight for ${getRandomService()}.`,
        `booked a ${getRandomPackage()} session.`,
        "is starting their pilot journey today.",
        "just secured a spot for flight training.",
        `registered for the ${getRandomPackage()} experience.`,
        "just purchased a flying gift voucher."
      ],
      review: [
        `Amazing ${getRandomService()}! Best aviation club in Malaysia.`,
        "Professional instructors and well-maintained aircraft. 10/10!",
        "The most thrilling experience at the flying club so far!",
        "High quality flight training. Safety is definitely their priority.",
        "Best birthday gift ever. The cockpit view was breathtaking!",
        "Friendly community and great aviation environment.",
        "Smooth takeoff and landing. Highly skilled pilots!"
      ],
      visit: [
        `is exploring the OneDay Aviation fleet.`,
        `is checking out ${getRandomPackage()} requirements.`,
        "is reading about the Private Pilot License (PPL).",
        "is viewing the flight training schedule.",
        "is looking at student pilot testimonials.",
        "is interested in the flight simulator experience."
      ],
      love: [
        "is dreaming of becoming a licensed pilot!",
        "loves the passion for aviation at OneDay.",
        "is inspired by the student solo flight stories.",
        "added 'Solo Flight' to their bucket list.",
        "is excited to join the local aviation community!"
      ]
    };

    switch (type) {
      case "booking":
        message = COMMENTS.booking[Math.floor(Math.random() * COMMENTS.booking.length)];
        break;
      case "review":
        message = COMMENTS.review[Math.floor(Math.random() * COMMENTS.review.length)];
        rating = 4 + (Math.random() > 0.3 ? 1 : 0); // Mostly 5 stars, some 4
        break;
      case "visit":
        message = COMMENTS.visit[Math.floor(Math.random() * COMMENTS.visit.length)];
        break;
      case "love":
        message = COMMENTS.love[Math.floor(Math.random() * COMMENTS.love.length)];
        break;
    }

    return {
      id: Math.random().toString(36).substr(2, 9),
      type,
      name,
      avatar,
      message,
      rating,
      location: city,
      timeAgo: "Just now"
    };
  };

  useEffect(() => {
    if (!shouldShow) return;
    
    let displayTimeoutId: NodeJS.Timeout;
    let cycleTimeoutId: NodeJS.Timeout;
    let hideTimeoutId: NodeJS.Timeout;
    
    const scheduleNext = () => {
      // Random interval between 15s and 60s
      const delay = Math.floor(Math.random() * (60000 - 15000 + 1)) + 15000;
      
      cycleTimeoutId = setTimeout(() => {
        const newNotification = generateNotification();
        
        // Randomize position
        const vPositions: ("top" | "middle" | "bottom")[] = ["top", "middle", "bottom"];
        const hPositions: ("left" | "right")[] = ["left", "right"];
        setVerticalPos(vPositions[Math.floor(Math.random() * vPositions.length)]);
        setHorizontalPos(hPositions[Math.floor(Math.random() * hPositions.length)]);
        
        setNotification(newNotification);
        setIsVisible(true);

        // Hide after 4 seconds
        hideTimeoutId = setTimeout(() => {
          setIsVisible(false);
          scheduleNext(); // Schedule next one after hiding
        }, 4000);
      }, delay);
    };

    // Start the cycle with an initial delay
    displayTimeoutId = setTimeout(() => {
      const vPositions: ("top" | "middle" | "bottom")[] = ["top", "middle", "bottom"];
      const hPositions: ("left" | "right")[] = ["left", "right"];
      setVerticalPos(vPositions[Math.floor(Math.random() * vPositions.length)]);
      setHorizontalPos(hPositions[Math.floor(Math.random() * hPositions.length)]);
      
      setNotification(generateNotification());
      setIsVisible(true);
      
      hideTimeoutId = setTimeout(() => {
        setIsVisible(false);
        scheduleNext();
      }, 4000);
    }, 2000);

    return () => {
      clearTimeout(displayTimeoutId);
      clearTimeout(cycleTimeoutId);
      clearTimeout(hideTimeoutId);
    };
  }, [services, packages, shouldShow]); // Re-run when data is loaded or visibility changes

  if (!shouldShow || !notification) return null;

  const getPositionClasses = () => {
    const classes = horizontalPos === "left" ? "left-4 md:left-6" : "right-4 md:right-6";
    
    switch (verticalPos) {
      case "top":
        return `${classes} top-20`; // Below header
      case "middle":
        return `${classes} top-1/2 -translate-y-1/2`;
      case "bottom":
      default:
        return `${classes} bottom-6`;
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ 
            opacity: 0, 
            x: horizontalPos === "left" ? -50 : 50, 
            y: verticalPos === "top" ? -20 : verticalPos === "bottom" ? 20 : 0 
          }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ 
            opacity: 0, 
            x: horizontalPos === "left" ? -50 : 50, 
            scale: 0.9 
          }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={`fixed z-50 max-w-[260px] md:max-w-sm w-full md:w-auto ${getPositionClasses()}`}
        >
          <div className="bg-white/95 backdrop-blur-md border border-black shadow-lg rounded-2xl p-3 md:p-4 flex items-start gap-3 md:gap-4 pr-5 md:pr-6 relative overflow-hidden">
            {/* Static Background for 'Love' type - removed animation to optimize speed */}
            {notification.type === 'love' && (
              <div className="absolute inset-0 bg-red-500/5 z-0" />
            )}
            
            <div className="relative z-10 shrink-0">
              <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-white shadow-sm">
                <AvatarImage src={notification.avatar} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {notification.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              {/* Type Badge Icon */}
              <div className={`absolute -bottom-1 -right-1 rounded-full p-0.5 md:p-1 border border-white shadow-sm ${
                notification.type === 'love' ? 'bg-red-100 text-red-500' :
                notification.type === 'review' ? 'bg-yellow-100 text-yellow-600' :
                notification.type === 'booking' ? 'bg-green-100 text-green-600' :
                'bg-blue-100 text-blue-600'
              }`}>
                {notification.type === 'love' && <Heart className="w-2.5 h-2.5 md:w-3 md:h-3 fill-current" />}
                {notification.type === 'review' && <Star className="w-2.5 h-2.5 md:w-3 md:h-3 fill-current" />}
                {notification.type === 'booking' && <Plane className="w-2.5 h-2.5 md:w-3 md:h-3" />}
                {notification.type === 'visit' && <User className="w-2.5 h-2.5 md:w-3 md:h-3" />}
              </div>
            </div>

            <div className="flex-1 min-w-0 relative z-10">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-xs md:text-sm font-bold text-slate-900 truncate pr-2">
                  {notification.name}
                </p>
                <span className="text-[9px] md:text-[10px] text-muted-foreground whitespace-nowrap">
                  {notification.timeAgo}
                </span>
              </div>

              <div className="text-[10px] md:text-xs text-slate-600 leading-tight mb-1 md:mb-1.5">
                {notification.location && (
                  <span className="inline-flex items-center text-slate-400 mr-1 md:mr-1.5">
                    <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5" />
                    {notification.location}
                  </span>
                )}
              </div>

              <p className="text-xs md:text-sm text-slate-700 font-medium line-clamp-2 md:line-clamp-none">
                {notification.message}
              </p>

              {notification.rating && (
                <div className="flex items-center mt-1 md:mt-1.5 gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-2.5 h-2.5 md:w-3 md:h-3 ${i < notification.rating! ? "text-yellow-400 fill-current" : "text-slate-200"}`} 
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Floating Hearts Animation removed to optimize speed */}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
