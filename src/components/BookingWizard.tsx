import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getSiteSettings, invalidateSiteSettings } from "@/lib/siteSettings";
import { FlightPackagesSection } from "./FlightPackagesSection";
import { AddonsSelection } from "./AddonsSelection";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { ChevronRight, ChevronLeft, Check, Plane, ListPlus, CreditCard, Users, Scale, Ruler, Camera, Image as ImageIcon, X, Clock as ClockIcon, Calendar, QrCode, ShoppingBag as ShoppingBagIcon, ShieldCheck, Mail, Phone, MessageSquare, Star, Loader2, MessageCircle, CheckCircle2, RotateCcw, Info, Trash2, type LucideIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { notificationService } from "@/lib/notificationService";
import { trackEvent } from "@/lib/analytics";
import { compressFile } from "@/utils/fileCompression";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { generateBookingReference, cn } from "@/lib/utils";
import { captureShareForm, readShareContext, resolveShareLink, trackShareEvent } from "@/lib/agentTracking";
import { fetchSlashState, priceAfterReward } from "@/lib/slashCampaign";
import { fetchSlashPrice } from "@/lib/slashPrice";

interface AppliedCoupon {
  coupon_id: string;
  code: string;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  discount_amount: number;
  description?: string | null;
  agent_name?: string | null;
  expires_at?: string | null;
}

// Custom blinking animation for "Flying" label
const blinkingStyles = `
@keyframes gentle-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
.animate-gentle-blink {
  animation: gentle-blink 1.5s ease-in-out infinite;
}
`;

interface Passenger {
  id: number;
  type: 'adult' | 'kid';
  weight: number; // kg
  height: number; // cm
  name: string;
  ic_passport_number: string;
  country_of_origin: string;
  gender: string;
  id_front?: string;
  id_back?: string;
  id_front_file?: File;
  id_back_file?: File;
  will_fly: boolean;
  bgColor?: string;
}

const PASSENGER_COLORS = [
  'bg-sky-50/70',
  'bg-emerald-50/70',
  'bg-violet-50/70',
  'bg-amber-50/70',
  'bg-rose-50/70',
  'bg-cyan-50/70',
  'bg-indigo-50/70',
  'bg-teal-50/70',
  'bg-fuchsia-50/70',
  'bg-orange-50/70',
  'bg-slate-100/50'
];

const getPassengerColor = (index: number) => PASSENGER_COLORS[index % PASSENGER_COLORS.length];

const PASSENGERS_STORAGE_KEY = "booking_wizard_passengers";
const DEFAULT_PASSENGERS: Passenger[] = [
  { id: 1, type: 'adult', weight: 0, height: 0, name: '', ic_passport_number: '', country_of_origin: '', gender: '', will_fly: true, bgColor: 'bg-blue-50/50' }
];

const sanitizeStoredPassengers = (value: unknown): Passenger[] => {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_PASSENGERS;

  const cleaned = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<Passenger>;

      return {
        id: Number(candidate.id) || Date.now(),
        type: candidate.type === "kid" ? "kid" : "adult",
        weight: Number(candidate.weight) || 0,
        height: Number(candidate.height) || 0,
        name: typeof candidate.name === "string" ? candidate.name : "",
        ic_passport_number: typeof candidate.ic_passport_number === "string" ? candidate.ic_passport_number : "",
        country_of_origin: typeof candidate.country_of_origin === "string" ? candidate.country_of_origin : "",
        gender: typeof candidate.gender === "string" ? candidate.gender : "",
        id_front: (typeof candidate.id_front === "string" && !candidate.id_front.startsWith('blob:')) ? candidate.id_front : undefined,
        id_back: (typeof candidate.id_back === "string" && !candidate.id_back.startsWith('blob:')) ? candidate.id_back : undefined,
        will_fly: typeof candidate.will_fly === "boolean" ? candidate.will_fly : false,
        bgColor: typeof candidate.bgColor === "string" ? candidate.bgColor : getPassengerColor(0),
      } as Passenger;
    })
    .filter((item): item is Passenger => item !== null);

  const normalized = cleaned.map((p, idx) => ({
    ...p,
    id: idx + 1,
    will_fly: typeof p.will_fly === "boolean" ? p.will_fly : idx === 0,
    bgColor: p.bgColor || getPassengerColor(idx),
  }));

  if (normalized.length === 0) return DEFAULT_PASSENGERS;
  if (!normalized.some((p) => p.will_fly)) {
    normalized[0] = { ...normalized[0], will_fly: true };
  }
  return normalized;
};

export const CameraCapture = ({ 
  onCapture, 
  onClose,
  isFront = true 
}: { 
  onCapture: (file: File) => void; 
  onClose: () => void;
  isFront?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const updateMobileView = () => setIsMobileView(window.innerWidth < 768);
    updateMobileView();
    window.addEventListener("resize", updateMobileView);
    return () => window.removeEventListener("resize", updateMobileView);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);
      } catch (err) {
        console.error("Camera error:", err);
        setHasPermission(false);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capture = () => {
    if (videoRef.current && !isCapturing) {
      setIsCapturing(true);
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            onCapture(file);
          }
          setIsCapturing(false);
        }, 'image/jpeg', 0.95);
      }
    }
  };

  if (hasPermission === false) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <Camera className="w-8 h-8 text-red-600" />
        </div>
        <div className="space-y-2">
          <p className="font-bold text-slate-900">Camera Access Denied</p>
          <p className="text-sm text-gray-500">Please enable camera permissions in your browser settings to take a photo.</p>
        </div>
        <Button type="button" onClick={onClose} variant="outline">Close</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full aspect-[4/3] sm:aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4 sm:p-8">
          <div className="relative w-full max-w-md aspect-[85.6/53.98] border-2 border-white/30 rounded-2xl shadow-[0_0_0_1000px_rgba(20,20,30,0.65)]">
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />

            {isFront && (
              <div className="absolute left-[8%] top-[30%] w-[18%] aspect-[1.2/1] border-2 border-primary/60 rounded-lg flex flex-col items-center justify-center bg-primary/10 backdrop-blur-[2px]">
                 <div className="flex flex-col items-center justify-center gap-0.5">
                    <div className="w-4 h-3 bg-primary/40 rounded-sm" />
                    <span className="text-[7px] text-white font-black tracking-tighter uppercase">IC CHIP</span>
                 </div>
              </div>
            )}
            
            <div className="absolute -top-10 left-0 right-0 text-center">
              <span className="text-white text-[10px] font-black uppercase tracking-[0.2em] bg-primary px-4 py-1.5 rounded-full shadow-lg">
                Align {isFront ? 'Front' : 'Back'} of ID
              </span>
            </div>

            <div className="absolute -bottom-10 left-0 right-0 text-center">
              <span className="text-white/70 text-[10px] font-bold uppercase tracking-wider">
                Hold steady and snap
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center items-center gap-8 py-2">
        <Button 
          type="button"
          variant="outline"
          size="icon"
          onClick={onClose}
          className="w-12 h-12 rounded-full border-2 border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 transition-all"
        >
          <X className="w-6 h-6" />
        </Button>
        
        <button 
          type="button"
          onClick={capture}
          disabled={isCapturing}
          className="relative group disabled:opacity-50"
        >
          <div className={`absolute -inset-2 bg-primary/20 rounded-full blur-md group-hover:bg-primary/30 transition-all ${isMobileView ? '' : 'animate-pulse'}`} />
          <div className="relative w-16 h-16 bg-white rounded-full border-4 border-zinc-900 flex items-center justify-center shadow-xl group-active:scale-90 transition-transform">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white">
              <Camera className="w-6 h-6" />
            </div>
          </div>
        </button>

        <div className="w-12" />
      </div>
    </div>
  );
};

export const applyWatermark = async (file: File): Promise<{ url: string; file: File }> => {
  const settings = {
    watermark_text: "FOR ONEDAYPILOT ONLY",
    watermark_color: "rgba(205, 92, 92, 0.5)",
    watermark_font_size: "30",
    watermark_line_thickness: "0.5",
    watermark_position: "corners"
  };

  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .filter('key', 'in', '("watermark_text","watermark_color","watermark_font_size","watermark_line_thickness","watermark_position")');
    
    if (data && !error) {
      data.forEach(item => {
        if (item.key in settings) {
          (settings as any)[item.key] = item.value;
        }
      });
    }
  } catch (err) {
    console.warn("Failed to fetch watermark settings, using defaults", err);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        const watermarkText = settings.watermark_text;
        
        const baseSize = Math.max(img.width / 25, 18) * (parseFloat(settings.watermark_font_size) / 30);
        ctx.font = `300 ${baseSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textWidth = ctx.measureText(watermarkText).width;

        const drawWatermark = (x: number, y: number) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-Math.PI / 8);

          const lineHeight = baseSize * 1.2;
          const padding = baseSize * 0.5;

          ctx.strokeStyle = settings.watermark_color.replace(/[\d\.]+\)$/g, '0.4)');
          ctx.lineWidth = parseFloat(settings.watermark_line_thickness); 
          
          ctx.beginPath();
          ctx.moveTo(-textWidth / 2 - padding, -lineHeight / 2);
          ctx.lineTo(textWidth / 2 + padding, -lineHeight / 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(-textWidth / 2 - padding, lineHeight / 2);
          ctx.lineTo(textWidth / 2 + padding, lineHeight / 2);
          ctx.stroke();

          ctx.fillStyle = settings.watermark_color;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          ctx.fillText(watermarkText, 0, 0);

          ctx.restore();
        };

        const margin = baseSize * 1.5;
        const position = settings.watermark_position;

        if (position === 'corners') {
          drawWatermark(margin + (textWidth / 2), margin + baseSize);
          drawWatermark(canvas.width - margin - (textWidth / 2), canvas.height - margin - baseSize);
        } else if (position === 'center') {
          drawWatermark(canvas.width / 2, canvas.height / 2);
        } else if (position === 'bottom-right') {
          drawWatermark(canvas.width - margin - (textWidth / 2), canvas.height - margin - baseSize);
        } else if (position === 'top-left') {
          drawWatermark(margin + (textWidth / 2), margin + baseSize);
        } else if (position === 'tiled') {
          const spacingX = textWidth * 2;
          const spacingY = baseSize * 6;
          for (let y = spacingY; y < canvas.height; y += spacingY) {
            for (let x = spacingX; x < canvas.width; x += spacingX) {
              drawWatermark(x, y);
            }
          }
        } else {
          drawWatermark(margin + (textWidth / 2), margin + baseSize); 
          drawWatermark(canvas.width - margin - (textWidth / 2), canvas.height - margin - baseSize);
        }

        canvas.toBlob(async (blob) => {
          if (blob) {
            let watermarkedFile = new File([blob], file.name, { type: 'image/jpeg' });
            
            try {
              watermarkedFile = await compressFile(watermarkedFile);
            } catch (error) {
              console.error("Compression failed for watermark:", error);
            }

            const url = URL.createObjectURL(watermarkedFile);
            resolve({ url, file: watermarkedFile });
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/jpeg', 0.8);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const formatFlightTime = (time: string | null | undefined) => {
  if (!time) return "TBD";
  if (time.toLowerCase().includes('am') || time.toLowerCase().includes('pm')) {
    return time.toUpperCase();
  }
  try {
    if (!time.includes(':')) return time.toUpperCase();
    const parts = time.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (isNaN(h)) return time.toUpperCase();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.substring(0, 2).padStart(2, '0')} ${ampm}`;
  } catch (error) {
    return time.toUpperCase();
  }
};

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", 
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", 
  "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", 
  "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", 
  "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", 
  "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", 
  "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", 
  "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", 
  "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", 
  "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", 
  "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", 
  "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", 
  "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", 
  "Kazakhstan", "Kenya", "Kiribati", "Korea, North", "Korea, South", "Kosovo", 
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", 
  "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", 
  "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", 
  "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", 
  "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", 
  "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia", 
  "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", 
  "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", 
  "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", 
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", 
  "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", 
  "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", 
  "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", 
  "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", 
  "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", 
  "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", 
  "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", 
  "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

const BOOKING_STEP_ICONS: Record<string, LucideIcon> = {
  Plane,
  ListPlus,
  CreditCard,
  Star,
  ShieldCheck,
  ShoppingBag: ShoppingBagIcon,
  QrCode,
  CheckCircle2,
};

interface BookingWizardProps {
  /** Restricts the packages on offer - see FlightPackagesSection. */
  allowedPackageIds?: string[] | null;
}

export const BookingWizard = ({ allowedPackageIds = null }: BookingWizardProps = {}) => {
  const [step, setStep] = useState(1);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 5, comment: '' });
  const [reviewImages, setReviewImages] = useState<FileList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [selectedReviewServiceId, setSelectedReviewServiceId] = useState<string>("");

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('toggle-animation-freeze', { detail: { paused: isReviewOpen } }));
  }, [isReviewOpen]);

  useEffect(() => {
    if (isReviewOpen) {
      const fetchReviewsData = async () => {
        if (!supabase) return;
        
        const [reviewsRes, servicesRes] = await Promise.all([
          supabase.from('reviews').select('*, service:services(title)').eq('is_approved', true).order('created_at', { ascending: false }),
          supabase.from('services').select('*').order('order', { ascending: true })
        ]);

        if (reviewsRes.data) setAllReviews(reviewsRes.data);
        if (servicesRes.data) {
          setAllServices(servicesRes.data);
          if (servicesRes.data.length > 0 && !selectedReviewServiceId) {
            setSelectedReviewServiceId(servicesRes.data[0].id);
          }
        }
      };
      fetchReviewsData();
    }
  }, [isReviewOpen, supabase]);

  useEffect(() => {
    if (otpInput.length === 4 && otp && !isVerified) {
      if (otpInput === otp) {
        setIsVerified(true);
        toast.success("Phone number verified!");
        setIsVerifying(false);
      } else {
        toast.error("Invalid OTP. Please try again.");
        setOtpInput('');
      }
    }
  }, [otpInput, otp, isVerified]);

  const checkWhatsAppStatus = async () => {
    // ALWAYS return true to prevent blocking the user
    return true;
  };

  const handleSendOTP = async () => {
    if (!/^\+[1-9]\d{9,14}$/.test(phoneNumber)) {
      toast.error("Please enter a valid WhatsApp number with country code (e.g. +60123456789)");
      return;
    }
    setIsSendingOtp(true);
    const isConnected = await checkWhatsAppStatus();
    if (!isConnected) {
      setIsSendingOtp(false);
      toast.error("WhatsApp bot disconnected. Please try again later.");
      return;
    }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setOtp(code);
    try {
      const messageText = `*Verification Code*\n\nYour 4-digit verification code for OneDayPilot review is: *${code}*\n\nPlease enter this code in the website to verify your review submission.`;
      const { error } = await supabase.from('notification_queue').insert({
        phone: phoneNumber,
        message: messageText,
        status: 'pending',
        type: 'whatsapp'
      });
      if (error) throw error;
      toast.success("OTP sent to your WhatsApp!");
      setIsVerifying(true);
    } catch (error) {
      toast.error("Failed to send OTP. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReviewServiceId || !supabase || !isVerified) {
      if (!isVerified) toast.error("Please verify your WhatsApp number first");
      return;
    }
    setIsSubmitting(true);
    const isConnected = await checkWhatsAppStatus();
    if (!isConnected) {
      setIsSubmitting(false);
      toast.error("WhatsApp bot disconnected. Submission failed.");
      return;
    }

    const image_urls: string[] = [];
    const image_paths: string[] = [];
    if (reviewImages && reviewImages.length > 0) {
      const bucketName = import.meta.env.VITE_SUPABASE_BUCKET || "media";
      for (let i = 0; i < reviewImages.length; i++) {
        try {
          const file = reviewImages[i];
          const compressedFile = await compressFile(file);
          const fileExt = compressedFile.name.split('.').pop();
          const fileName = `${Date.now()}-${i}.${fileExt}`;
          const filePath = `reviews/${selectedReviewServiceId}/${fileName}`;
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, compressedFile, { upsert: true, cacheControl: '31536000' });
          if (!uploadError) {
            const publicUrl = supabase.storage.from(bucketName).getPublicUrl(filePath).data.publicUrl;
            image_urls.push(publicUrl);
            image_paths.push(filePath);
          }
        } catch (err: any) {
          console.error("Compression error:", err);
          toast.error(`Failed to compress image ${i+1}: ${err.message}`);
        }
      }
    }

    const { data, error } = await supabase.from('reviews').insert({
      service_id: selectedReviewServiceId,
      customer_name: reviewForm.name,
      rating: reviewForm.rating,
      comment: reviewForm.comment,
      image_urls: image_urls,
      image_paths: image_paths,
      phone_number: phoneNumber,
      is_approved: true
    }).select('*, service:services(title)').single();

    if (error) {
      toast.error("Failed to submit review");
    } else {
      toast.success("Review submitted!");
      if (data) setAllReviews(prev => [data, ...prev]);
      setReviewForm({ name: '', rating: 5, comment: '' });
      setReviewImages(null);
      setPhoneNumber('');
      setOtp('');
      setOtpInput('');
      setIsVerified(false);
      setIsVerifying(false);
    }
    setIsSubmitting(false);
  };

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [currentSortOrder, setCurrentSortOrder] = useState(0);
  const [totalStages, setTotalStages] = useState(1);
  const [uniqueSortOrders, setUniqueSortOrders] = useState<number[]>([]);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [showPassengerDetails, setShowPassengerDetails] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [safetySettings, setSafetySettings] = useState<Record<string, string>>({});
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({});
  const [settingsStyles, setSettingsStyles] = useState<Record<string, any>>({});
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'qr'>('online');
  const [paymentType, setPaymentType] = useState<'full' | 'deposit'>('full');
  const [paymentProof, setPaymentProof] = useState<File[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [retryCount, setRetryCount] = useState(0);
  const [liveUpdateTick, setLiveUpdateTick] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showSlowInitialLoad, setShowSlowInitialLoad] = useState(false);
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  const lastExternalRefreshRef = useRef(0);

  useEffect(() => {
    if (isInitialLoading) {
      const timer = setTimeout(() => {
        if (isInitialLoading) setShowSlowInitialLoad(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowSlowInitialLoad(false);
    }
  }, [isInitialLoading]);

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
        () => {
          // The refetch below reads through the shared cache, so it has to
          // be dropped first or an admin edit would never reach this tab.
          invalidateSiteSettings();
          setRetryCount(prev => prev + 1);
        }
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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshFromExternal = () => {
      const now = Date.now();
      if (now - lastExternalRefreshRef.current < 500) return;
      lastExternalRefreshRef.current = now;
      setLiveUpdateTick(now);
    };

    const handleCustomUpdate = () => refreshFromExternal();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'oneday:mainpage-update') refreshFromExternal();
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('oneday:mainpage-update');
      channel.onmessage = () => refreshFromExternal();
    } catch {}

    window.addEventListener('oneday:mainpage-update', handleCustomUpdate as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('oneday:mainpage-update', handleCustomUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
      try {
        channel?.close();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const updateMobileView = () => setIsMobileView(window.innerWidth < 768);
    updateMobileView();
    window.addEventListener("resize", updateMobileView);
    return () => window.removeEventListener("resize", updateMobileView);
  }, []);
  const { items, total, addItem, updateQuantity, removeItem, clearCart, touched: cartTouched } = useCart();

  // Agent coupon. Declared here (rather than beside the other checkout state
  // further down) because the payable totals below depend on it.
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  /**
   * True when a price-slash campaign is running on this visit.
   *
   * A campaign sets the package price directly, so there is no discount
   * left for a code to apply and the coupon box comes off the checkout.
   * Anything typed there could only fight with a price the group has
   * already won.
   */
  const [slashActive, setSlashActive] = useState(false);
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // The discount can never exceed the cart, so the payable total never goes negative.
  const discountAmount = appliedCoupon ? Math.min(Number(appliedCoupon.discount_amount) || 0, total) : 0;
  const netTotal = Math.max(0, total - discountAmount);

  const depositAmount = parseFloat(siteSettings.payment_deposit_amount || '0');
  const hasDepositOption = depositAmount > 0 && netTotal > depositAmount;
  const currentTotal = paymentType === 'deposit' ? depositAmount : netTotal;
  const topRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFirstMount = useRef(true);
  const navigate = useNavigate();

  const [passengers, setPassengers] = useState<Passenger[]>(() => {
    if (typeof window === "undefined") return DEFAULT_PASSENGERS;

    try {
      const raw = localStorage.getItem(PASSENGERS_STORAGE_KEY);
      if (!raw) return DEFAULT_PASSENGERS;
      return sanitizeStoredPassengers(JSON.parse(raw));
    } catch {
      return DEFAULT_PASSENGERS;
    }
  });

  const flySelectedCount = passengers.reduce((sum, p) => sum + (p.will_fly ? 1 : 0), 0);
  const basePackageItem = items.find((i) => i.sort_order === 0) ?? items.find((i) => i.sort_order !== 1);
  const hasMainPackage = items.some(item => item.sort_order === 0 || item.sort_order === undefined);
  const addonItems = items.filter((i) => i.sort_order === 1);

  // Calculate passenger limits from all packages and add-ons in cart
  const [maxFlyersFromPackages, setMaxFlyersFromPackages] = useState(1);
  const [totalMaxPassengers, setTotalMaxPassengers] = useState(1);
  
  useEffect(() => {
    const calculateLimits = async () => {
      if (!supabase || items.length === 0) {
        setMaxFlyersFromPackages(1);
        setTotalMaxPassengers(1);
        return;
      }
      
      try {
        const itemIds = items.map(i => i.id);
        const { data: pkgs, error } = await supabase
          .from('packages')
          .select('id, max_quantity, sort_order')
          .in('id', itemIds);
        
        if (error) throw error;
        
        let mainPackageCapacity = 0;
        let addonPackageCapacity = 0;
        
        if (pkgs) {
          items.forEach(item => {
            const pkg = pkgs.find(p => p.id === item.id);
            if (pkg) {
              const maxPerUnit = pkg.max_quantity || 1;
              const totalForThisItem = maxPerUnit * (item.quantity || 1);

              // Main Package (sort_order 0) determines the "Flyer" limit
              if (pkg.sort_order === 0 || pkg.sort_order === null || pkg.sort_order === undefined) {
                mainPackageCapacity += totalForThisItem;
              } 
              // Add-ons (sort_order 1) only add to the "Total Passengers" limit
              else if (pkg.sort_order === 1) {
                addonPackageCapacity += totalForThisItem;
              }
            }
          });
        }
        
        const finalFlyerLimit = Math.max(1, mainPackageCapacity);
        const finalTotalLimit = Math.max(1, mainPackageCapacity + addonPackageCapacity);
        
        setMaxFlyersFromPackages(finalFlyerLimit);
        setTotalMaxPassengers(finalTotalLimit);
      } catch (err) {
        console.error("Error calculating limits:", err);
      }
    };
    
    calculateLimits();
  }, [items, supabase]);

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!scrollRef.current) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;

    setIsDragging(true);
    setIsHovered(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
    
    document.body.style.userSelect = 'none';
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
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeftState - walk;
    exactScrollRef.current = scrollRef.current.scrollLeft;
  };

  const isReversingRef = useRef(false);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const exactScrollRef = useRef<number>(0);

  const handleManualScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      setIsHovered(true); // Stop auto-scroll when manually interacting
      
      const container = scrollRef.current;
      const isMobile = window.innerWidth < 768;
      const itemWidth = isMobile ? 300 : 420;
      const gap = 3;
      const scrollAmount = direction === 'left' ? -(itemWidth + gap) : (itemWidth + gap);
      
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

  useEffect(() => {
    if (isMobileView) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const animateScroll = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (!isGlobalPaused && !isHovered && scrollRef.current) {
        const container = scrollRef.current;
        const maxScroll = container.scrollWidth - container.clientWidth;

        if (maxScroll > 0) {
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
          
          container.scrollLeft = exactScrollRef.current;
          
          if (Math.abs(container.scrollLeft - exactScrollRef.current) > 2) {
             exactScrollRef.current = container.scrollLeft;
          }
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(animateScroll);
    };

    if (!isGlobalPaused && !isHovered) {
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
  }, [isGlobalPaused, isHovered, isMobileView]);
  const [cameraOpen, setCameraOpen] = useState<{ passengerId: number | 'receipt'; side: 'front' | 'back' | 'receipt' } | null>(null);
  const [uploadMethodSelector, setUploadMethodSelector] = useState<{ passengerId: number | 'receipt'; side: 'front' | 'back' | 'receipt' } | null>(null);
  const [uploadingProgress, setUploadingProgress] = useState<Record<string, boolean>>({});

  const [isMultiCategory, setIsMultiCategory] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [blockedTimes, setBlockedTimes] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProgressOverlay, setShowProgressOverlay] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1); // 1: Info, 2: Date/Time, 3: Payment
  const [contactInfo, setContactInfo] = useState({ name: '', email: '', phone: '' });
  const [specialRequests, setSpecialRequests] = useState<string>('');

  // ------------------------------------------------------------------
  // Agent coupons
  // ------------------------------------------------------------------
  // All validation happens in Postgres (validate_coupon), so the expiry,
  // the usage cap and the package scope cannot be bypassed from the browser.
  const validateCoupon = async (
    rawCode: string,
    opts: { silent?: boolean } = {},
  ): Promise<AppliedCoupon | null> => {
    const code = (rawCode || '').trim();
    if (!code || !supabase) return null;

    setCouponChecking(true);
    setCouponError(null);
    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: code,
        p_package_ids: items.map(i => i.id),
        p_subtotal: total,
        p_email: contactInfo.email || null,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.valid) {
        setAppliedCoupon(null);
        setCouponError(result?.message || 'This coupon code is not valid.');
        if (!opts.silent) toast.error(result?.message || 'This coupon code is not valid.');
        return null;
      }

      const applied: AppliedCoupon = {
        coupon_id: result.coupon_id,
        code: result.code,
        discount_type: result.discount_type,
        discount_value: Number(result.discount_value),
        discount_amount: Number(result.discount_amount),
        description: result.description,
        agent_name: result.agent_name,
        expires_at: result.expires_at,
      };

      setAppliedCoupon(applied);
      setCouponInput(applied.code);
      setCouponError(null);

      if (!opts.silent) {
        toast.success(`Coupon ${applied.code} applied — RM ${applied.discount_amount.toFixed(2)} off`);
      }

      trackShareEvent({
        event_type: 'coupon_applied',
        metadata: { code: applied.code, discount: applied.discount_amount },
      });

      return applied;
    } catch (e: any) {
      console.error('Coupon validation failed:', e);
      setAppliedCoupon(null);
      setCouponError('Could not check that coupon. Please try again.');
      if (!opts.silent) toast.error('Could not check that coupon. Please try again.');
      return null;
    } finally {
      setCouponChecking(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  // Pick up ?ref= (share link) and ?coupon= from the URL once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const init = async () => {
      await resolveShareLink();
      if (cancelled) return;

      // A live campaign wins over whatever code the share link put on the
      // URL: that one was chosen before anybody had played, so it cannot
      // know the price the group has since reached. Resolved here rather
      // than in its own effect so the two can never race each other.
      const ctx = readShareContext();
      const slash = (ctx.landingPageId || ctx.token)
        ? await fetchSlashState({ landingPageId: ctx.landingPageId ?? null })
        : null;
      if (cancelled) return;

      // A challenge prices the package itself. Nothing to apply, and no
      // agent code either: theirs was written against the sticker price.
      if (slash) {
        setSlashActive(true);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const code = params.get('coupon');
      if (code) await validateCoupon(code, { silent: true });
    };

    init();
    return () => { cancelled = true; };
    // Runs once - the URL is read directly rather than tracked as state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The cart drives both the package scope and the discount amount, so a
  // coupon that was valid for the old cart has to be re-checked.
  useEffect(() => {
    if (!appliedCoupon) return;
    if (items.length === 0) { removeCoupon(); return; }

    const timer = setTimeout(() => {
      validateCoupon(appliedCoupon.code, { silent: true });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, total]);

  // Keep the agent's report up to date with whatever the visitor has typed,
  // whether or not they ever reach the payment gateway.
  useEffect(() => {
    const ctx = readShareContext();
    if (!ctx.shareLinkId && !ctx.landingPageId) return;

    // Something the visitor actually did. A cart alone used to be enough,
    // but the cart is restored from localStorage on load, so an item left
    // over from an earlier visit filed a capture on a plain refresh - the
    // agent got a row with no name, no contact and no flight, for someone
    // who had not typed, scrolled or clicked. The cart only counts when
    // this session is the one that changed it.
    const typed = !!(contactInfo.name || contactInfo.email || contactInfo.phone);
    if (!typed && !(cartTouched && items.length > 0)) return;

    const timer = setTimeout(() => {
      captureShareForm({
        name: contactInfo.name,
        email: contactInfo.email,
        phone: contactInfo.phone,
        selectedDate: selectedDate || null,
        selectedTime: selectedTime || null,
        passengerCount: passengers.length,
        specialRequests,
        couponCode: appliedCoupon?.code ?? couponInput ?? null,
        cartItems: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        cartTotal: total,
        discountAmount,
        stepReached: `Step ${step} · Checkout ${checkoutStep}`,
        furthestStep: checkoutStep,
      });
    }, 1200);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactInfo.name, contactInfo.email, contactInfo.phone, selectedDate, selectedTime,
      specialRequests, items, total, discountAmount, step, checkoutStep, appliedCoupon?.code,
      cartTouched]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showProgressOverlay) {
      timer = setInterval(() => {
        setProgressCount(prev => prev + 1);
      }, 1000);
    } else {
      setProgressCount(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showProgressOverlay]);
  const [showWhatsAppSupport, setShowWhatsAppSupport] = useState(false);
  const [showSafetyLimitSupport, setShowSafetyLimitSupport] = useState(false);
  const [safetyLimitReason, setSafetyLimitReason] = useState<string>("");
  const supportSettings = {
    email: siteSettings.email || "support@oneday.com",
    phone: siteSettings.phone || "+60123456789",
    whatsapp: siteSettings.whatsapp || "+60123456789"
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const passengersForStorage = passengers.map(({ id_front_file, id_back_file, ...rest }) => rest);
    localStorage.setItem(PASSENGERS_STORAGE_KEY, JSON.stringify(passengersForStorage));
  }, [passengers]);

  const resetToSelectFlight = () => {
    setStep(1);
    setCurrentSortOrder(0);
    // Only a multi-category site has a chooser to go back to. On a single
    // category site - or any ?sharePackageId= link, which forces single
    // category mode - clearing this strands the wizard on "Could not load
    // flight categories" with nothing left on screen to re-select.
    if (isMultiCategory) setSelectedCategoryId(null);
    setShowPassengerDetails(false);
    scrollToTop();
  };

  const today = new Date().toISOString().split('T')[0];

  const timeSlots = (() => {
    const slots: string[] = [];
    const startMinutes = 9 * 60;
    const endMinutes = 18 * 60;
    const intervalMinutes = 30;

    for (let minutes = startMinutes; minutes <= endMinutes; minutes += intervalMinutes) {
      const hours24 = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const ampm = hours24 >= 12 ? "PM" : "AM";
      const hours12 = hours24 % 12 || 12;
      slots.push(`${hours12.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")} ${ampm}`);
    }

    return slots;
  })();

  const isTimeInPast = (timeStr: string) => {
    if (selectedDate !== today) return false;
    
    const now = new Date();
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    
    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);
    
    return slotTime <= now;
  };

  const isWithinBuffer = (time1: string, time2: string) => {
    const toMinutes = (t: string) => {
      if (!t) return 0;
      // Handle both 24h (HH:mm) and 12h (HH:mm AM/PM) formats
      const cleanT = t.trim().toUpperCase();
      if (cleanT.includes('AM') || cleanT.includes('PM')) {
        const [timePart, ampm] = cleanT.split(' ');
        if (!timePart) return 0;
        let [h, m] = timePart.split(':').map(Number);
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h * 60 + (m || 0);
      } else {
        const parts = cleanT.split(':');
        let h = Number(parts[0]) || 0;
        let m = Number(parts[1]) || 0;
        return h * 60 + m;
      }
    };
    
    // Match the 30-minute buffer in SQL (< 1800 seconds)
    return Math.abs(toMinutes(time1) - toMinutes(time2)) < 30;
  };

  const scrollToTop = () => {
    if (topRef.current) {
      // Use instant scroll to avoid layout shifts that can trigger component unmounts on mobile
      topRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
  };

  /**
   * Turns a ?sharePackageId= link into the category that package sits in.
   *
   * A shared link forces the wizard into single-category mode, so this is
   * the only thing that ever hands it a category to show. That makes it a
   * recovery path, not just a boot step - it has to stay callable, or a
   * retry has nothing to retry with.
   */
  const resolveSharedPackage = useCallback(async () => {
    if (!supabase) return false;
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("sharePackageId");
    if (!sharedId) return false;

    const { data: sharedPkg, error: sharedError } = await supabase
      .from('packages')
      .select('category_id, sort_order')
      .eq('id', sharedId)
      .eq('is_active', true)
      .single();

    if (sharedError || !sharedPkg) return false;

    setIsMultiCategory(false);
    setSelectedCategoryId(sharedPkg.category_id);
    setCurrentSortOrder(0);

    const { data: packages } = await supabase
      .from('packages')
      .select('sort_order')
      .eq('category_id', sharedPkg.category_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (packages) {
      const uniqueOrders = Array.from(new Set(packages.map(p => p.sort_order)));
      setUniqueSortOrders(uniqueOrders);
      setTotalStages(uniqueOrders.length + 1);
    }
    return true;
  }, []);

  useEffect(() => { resolveSharedPackage(); }, [resolveSharedPackage]);

  useEffect(() => {
    const fetchMainCategory = async (attempt = 1) => {
      if (!supabase) {
        setIsInitialLoading(false);
        return;
      }
      
      // A shared link has no category chooser to fall back on, so the
      // retry path re-resolves the share instead of bailing out here and
      // leaving the wizard with no category at all.
      const params = new URLSearchParams(window.location.search);
      if (params.has("sharePackageId")) {
        await resolveSharedPackage();
        setIsInitialLoading(false);
        return;
      }
      
      try {
         const { data: categories, error: catError } = await supabase
           .from('categories')
           .select('id')
           .eq('is_main_page', true)
           .eq('is_active', true)
           .order('sort_order', { ascending: true });
 
         if (catError) throw catError;
 
         if (categories && categories.length > 0) {
           if (categories.length === 1) {
             setIsMultiCategory(false);
             const mainCatId = categories[0].id;
             setSelectedCategoryId(mainCatId);
 
             const { data: packages, error: pkgError } = await supabase
               .from('packages')
               .select('sort_order')
               .eq('category_id', mainCatId)
               .eq('is_active', true)
               .order('sort_order', { ascending: true });
 
             if (!pkgError && packages) {
               const uniqueOrders = Array.from(new Set(packages.map(p => p.sort_order)));
               setUniqueSortOrders(uniqueOrders);
               setTotalStages(uniqueOrders.length + 1);
               if (uniqueOrders.length > 0) {
                 setCurrentSortOrder(0);
               }
             }
           } else {
             setIsMultiCategory(true);
             setSelectedCategoryId(null);
             setTotalStages(3);
             setUniqueSortOrders([0]);
             setCurrentSortOrder(0);
           }
         }
         setIsInitialLoading(false);
       } catch (err) {
         console.error(`Attempt ${attempt} failed to fetch main category:`, err);
         if (attempt < 3) {
           console.log(`Retrying fetchMainCategory (attempt ${attempt + 1})...`);
           setTimeout(() => fetchMainCategory(attempt + 1), 1000 * attempt);
         } else {
           setIsInitialLoading(false);
         }
       }
    };

    fetchMainCategory();
  }, [retryCount, liveUpdateTick, resolveSharedPackage]);

  useEffect(() => {
    const fetchSiteSettings = async () => {
      if (!supabase) return;
      const data = await getSiteSettings();
      if (data.length) {
        const settingsMap: Record<string, string> = {};
        const stylesMap: Record<string, any> = {};
        
        data.forEach((curr: any) => {
          settingsMap[curr.key] = curr.value;
          if (curr.style) {
            stylesMap[curr.key] = curr.style;
          }
        });
        
        if (settingsMap.bg_gradient_booking_wizard) {
          settingsMap.bg_gradient_booking = settingsMap.bg_gradient_booking_wizard;
        } else if (settingsMap.bg_gradient_booking) {
          settingsMap.bg_gradient_booking_wizard = settingsMap.bg_gradient_booking;
        }
        
        setSiteSettings(settingsMap);
        setSettingsStyles(stylesMap);
      }
    };
    fetchSiteSettings();
  }, []);

  useEffect(() => {
    const fetchSafetySettings = async () => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .like('key', 'safety_%');
      
      if (!error && data) {
        const settings: Record<string, string> = {};
        data.forEach(item => {
          settings[item.key] = item.value;
        });
        setSafetySettings(settings);
      }
    };
    fetchSafetySettings();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      const fetchBlockedTimes = async () => {
        if (!supabase) return;
        // Use RPC to bypass RLS and get all relevant bookings for this date
        const { data, error } = await supabase.rpc('get_blocked_times', { 
          p_flight_date: selectedDate 
        });

        if (!error && data) {
          const times = (data as any[])
            .map((row) => formatFlightTime(row.flight_time))
            .filter(Boolean) as string[];
          setBlockedTimes(times);
        } else if (error) {
          console.error("Error fetching blocked times:", error);
        }
      };
      fetchBlockedTimes();
    } else {
      setBlockedTimes([]);
    }
  }, [selectedDate, step, checkoutStep]);

  useEffect(() => {
    if (selectedTime && selectedDate) {
      const isStillAvailable = !blockedTimes.some(bt => isWithinBuffer(bt, selectedTime)) && !isTimeInPast(selectedTime);
      if (!isStillAvailable) {
        setSelectedTime("");
        toast.error("The previously selected time is no longer available. Please choose another time.");
      }
    }
  }, [blockedTimes, selectedDate]);

  const handleNext = () => {
    trackEvent({
      action_type: 'click',
      entity_type: 'booking_step',
      entity_id: `step_${step}_next`,
      entity_name: `Booking Step ${step} Next`,
      source: 'BookingWizard'
    });
    setStep(step + 1);
    scrollToTop();
  };

  const handleBack = () => {
    trackEvent({
      action_type: 'click',
      entity_type: 'booking_step',
      entity_id: `step_${step}_back`,
      entity_name: `Booking Step ${step} Back`,
      source: 'BookingWizard'
    });

    if (step === 2) {
      if (showPassengerDetails) {
        resetToSelectFlight();
        return;
      }
      // If we are in a sequential package (sort_order > 0), 
      // go back to main packages page (sort_order 0)
      if (currentSortOrder > 0) {
        resetToSelectFlight();
        return;
      }
    }

    if (step === 3) {
      if (checkoutStep > 1) {
        setCheckoutStep((prev) => (prev - 1) as 1 | 2 | 3);
        scrollToTop();
        return;
      }
      setStep(2);
      setShowPassengerDetails(true);
      scrollToTop();
      return;
    }

    if (step > 1) {
      setStep(step - 1);
    } else {
      // If already at step 1, ensure we are at sort_order 0
      setCurrentSortOrder(0);
      if (isMultiCategory) setSelectedCategoryId(null);
    }
    scrollToTop();
  };

  useEffect(() => {
    const handleGoToPassenger = () => {
      setStep(2);
      setShowPassengerDetails(true);
      setCurrentSortOrder(0);
      scrollToTop();
    };

    window.addEventListener('goToPassengerInfo', handleGoToPassenger);

    const forcedStep = localStorage.getItem('forceBookingStep');
    if (forcedStep === '2') {
      handleGoToPassenger();
      localStorage.removeItem('forceBookingStep');
    }

    return () => {
      window.removeEventListener('goToPassengerInfo', handleGoToPassenger);
    };
  }, []);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    scrollToTop();
  }, [step, currentSortOrder]);

  const updatePassenger = <K extends keyof Passenger>(id: number, field: K, value: Passenger[K]) => {
    setPassengers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addPassenger = () => {
    // Check if we can add more passengers based on total max passengers
    if (passengers.length >= totalMaxPassengers) {
      toast.error(`Maximum ${totalMaxPassengers} passenger(s) allowed based on selected packages and add-ons.`);
      return;
    }
    
    setPassengers(prev => {
      const nextId = Math.max(0, ...prev.map(p => p.id)) + 1;
      return [...prev, { 
        id: nextId, 
        type: 'adult', 
        weight: 0, 
        height: 0,
        name: '',
        ic_passport_number: '',
        country_of_origin: '',
        gender: '',
        will_fly: false,
        bgColor: getPassengerColor(prev.length)
      }];
    });
  };

  const removePassenger = (id: number) => {
    if (passengers.length <= 1) return;
    setPassengers(prev => prev.filter(p => p.id !== id));
  };

  const handleCameraCapture = async (file: File) => {
    if (!cameraOpen) return;
    const { passengerId, side } = cameraOpen;
    
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Captured image is too large (max 3MB). Please try again or use lower resolution.");
      return;
    }

    const progressKey = passengerId === 'receipt' ? 'receipt' : `${passengerId}-${side}`;
    setUploadingProgress(prev => ({ ...prev, [progressKey]: true }));

    try {
      const { url, file: watermarkedFile } = await applyWatermark(file);
      
      if (passengerId === 'receipt') {
        setPaymentProof(prev => [...prev, watermarkedFile]);
      } else {
        const passenger = passengers.find(p => p.id === passengerId);
        if (passenger) {
          const currentUrl = side === 'front' ? passenger.id_front : passenger.id_back;
          if (currentUrl && currentUrl.startsWith('blob:')) {
            URL.revokeObjectURL(currentUrl);
          }
        }
        updatePassenger(passengerId as number, side === 'front' ? 'id_front' : 'id_back', url);
        updatePassenger(passengerId as number, side === 'front' ? 'id_front_file' : 'id_back_file', watermarkedFile);
      }
      
      setCameraOpen(null);
      toast.success(`${passengerId === 'receipt' ? 'Receipt' : (side === 'front' ? 'Front' : 'Back') + ' ID'} captured!`);
    } catch (error) {
      console.error("Capture process error:", error);
      toast.error("Failed to process captured image");
    } finally {
      setUploadingProgress(prev => ({ ...prev, [progressKey]: false }));
    }
  };

  const validatePassengers = () => {
    const maxWeightPerPax = Number(safetySettings.safety_max_weight_per_pax || 120);
    const combinedWeight2Pax = Number(safetySettings.safety_combined_weight_2pax || 160);
    const combinedWeight3Pax = Number(safetySettings.safety_combined_weight_3pax || 200);
    const combinedWeight4Pax = Number(safetySettings.safety_combined_weight_4pax || 240);
    const minHeight = Number(safetySettings.safety_min_height || 150);
    const maxHeight = Number(safetySettings.safety_max_height || 180);
    const totalWeightLimit = Number(safetySettings.safety_total_weight_limit || 200);

    const flyingPassengers = passengers.filter(p => p.will_fly);
    const totalWeight = flyingPassengers.reduce((sum, p) => sum + Number(p.weight || 0), 0);
    const count = flyingPassengers.length;

    for (const p of passengers) {
      if (!p.name) {
        toast.error(`Please enter Full Name for Passenger ${p.id}`);
        return false;
      }
      if (!p.ic_passport_number) {
        toast.error(`Please enter IC / Passport Number for Passenger ${p.id}`);
        return false;
      }
      if (!p.country_of_origin) {
        toast.error(`Please enter Country of Origin for Passenger ${p.id}`);
        return false;
      }
      if (!p.gender) {
        toast.error(`Please select Gender for Passenger ${p.id}`);
        return false;
      }
      
      // Height and Weight only required if flying
      if (p.will_fly) {
        if (!p.height || p.height < minHeight || p.height > maxHeight) {
          setSafetyLimitReason(`Flying Passenger ${p.id} height must be between ${minHeight}cm and ${maxHeight}cm for safety.`);
          setShowSafetyLimitSupport(true);
          return false;
        }
        if (!p.weight || p.weight <= 0) {
          toast.error(`Please enter valid weight for Flying Passenger ${p.id}`);
          return false;
        }
      }

      if (!p.id_front_file && !p.id_front) {
        toast.error(`Please upload ID Document (Front) for Passenger ${p.id}`);
        return false;
      }
    }

    if (count > 0) {
      if (count === 1) {
        if (totalWeight >= maxWeightPerPax) {
          setSafetyLimitReason(`Maximum weight for 1 flyer must be below ${maxWeightPerPax}kg`);
          setShowSafetyLimitSupport(true);
          return false;
        }
      } else if (count === 2) {
        if (totalWeight >= combinedWeight2Pax) {
          setSafetyLimitReason(`Combined weight for 2 flyers must be below ${combinedWeight2Pax}kg`);
          setShowSafetyLimitSupport(true);
          return false;
        }
      } else if (count === 3) {
        if (totalWeight >= combinedWeight3Pax) {
          setSafetyLimitReason(`Combined weight for 3 flyers must be below ${combinedWeight3Pax}kg`);
          setShowSafetyLimitSupport(true);
          return false;
        }
      } else if (count === 4) {
        if (totalWeight >= combinedWeight4Pax) {
          setSafetyLimitReason(`Combined weight for 4 flyers must be below ${combinedWeight4Pax}kg`);
          setShowSafetyLimitSupport(true);
          return false;
        }
      }

      if (totalWeight >= totalWeightLimit) {
        setSafetyLimitReason(`Total flyer weight must be below ${totalWeightLimit}kg`);
        setShowSafetyLimitSupport(true);
        return false;
      }
    }

    return true;
  };

  const nextStep = async (skipValidation = false, catId?: string, sortOrd?: number, pkgId?: string) => {
    if (catId) setSelectedCategoryId(catId);
    if (pkgId) setSelectedPackageId(pkgId);
    
    if (sortOrd !== undefined) {
      setCurrentSortOrder(sortOrd + 1);
    }

    if (!skipValidation) {
      if (step === 1) {
        if (catId || selectedCategoryId) {
          const targetCatId = catId || selectedCategoryId;
          const { data, error } = await supabase
            .from('packages')
            .select('id, sort_order')
            .eq('category_id', targetCatId)
            .eq('is_active', true)
            .eq('sort_order', 1)
            .limit(1);

          if (!error && data && data.length > 0) {
            setCurrentSortOrder(1);
            trackEvent({
              action_type: 'view',
              entity_type: 'dynamic_panel',
              entity_id: `customise_sort_order_1`,
              entity_name: `Customise: Sequential Package 1`,
              source: 'BookingWizard'
            });
          } else {
            setCurrentSortOrder(0);
            trackEvent({
              action_type: 'view',
              entity_type: 'dynamic_panel',
              entity_id: `addons_selection`,
              entity_name: `Addons Selection`,
              source: 'BookingWizard'
            });
          }
        }
      }
      
      if (step === 2) {
        if (currentSortOrder > 0 && (selectedCategoryId || catId)) {
          const targetCatId = catId || selectedCategoryId;
          const { data, error } = await supabase
            .from('packages')
            .select('id, sort_order')
            .eq('category_id', targetCatId)
            .eq('is_active', true)
            .gt('sort_order', currentSortOrder)
            .order('sort_order', { ascending: true })
            .limit(1);

          if (!error && data && data.length > 0) {
            setCurrentSortOrder(data[0].sort_order);
            trackEvent({
              action_type: 'view',
              entity_type: 'dynamic_panel',
              entity_id: `customise_sort_order_${data[0].sort_order}`,
              entity_name: `Customise: Sequential Package ${data[0].sort_order}`,
              source: 'BookingWizard'
            });
            scrollToTop();
            return;
          } else {
            setCurrentSortOrder(0);
            trackEvent({
              action_type: 'view',
              entity_type: 'dynamic_panel',
              entity_id: `addons_selection`,
              entity_name: `Addons Selection`,
              source: 'BookingWizard'
            });
            scrollToTop();
            return;
          }
        }

        if (currentSortOrder === 0 && !showPassengerDetails) {
           const isConnected = await checkWhatsAppStatus();
           if (!isConnected) {
             setShowWhatsAppSupport(true);
             return;
           }
           setShowPassengerDetails(true);
           trackEvent({
             action_type: 'view',
             entity_type: 'page',
             entity_id: 'passenger_details',
             entity_name: 'Passenger Details',
             source: 'BookingWizard'
           });
           scrollToTop();
           return;
        }

        if (showPassengerDetails) {
          if (!validatePassengers()) return;
        }
      }
    }
    
    if (step === 3) {
      const isConnected = await checkWhatsAppStatus();
      if (!isConnected) {
        setShowWhatsAppSupport(true);
        return;
      }
      
      trackEvent({
        action_type: 'click',
        entity_type: 'page',
        entity_id: '/checkout',
        entity_name: 'Proceed to Checkout',
        source: 'BookingWizard'
      });

      navigate('/checkout');
      return;
    }

    setStep(prev => {
      const next = prev + 1;
      trackEvent({
        action_type: 'view',
        entity_type: 'page',
        entity_id: `booking_wizard_step_${next}`,
        entity_name: `Booking Wizard: Step ${next}`,
        source: 'BookingWizard'
      });
      return next;
    });
  };

  const prevStep = () => {
    if (step === 2) {
      if (showPassengerDetails) {
        setShowPassengerDetails(false);
        trackEvent({
          action_type: 'click',
          entity_type: 'page',
          entity_id: 'booking_wizard_back_from_passengers',
          entity_name: 'Back from Passenger Details',
          source: 'BookingWizard'
        });
      } else if (currentSortOrder === 0 && uniqueSortOrders.length > 0) {
        setCurrentSortOrder(uniqueSortOrders[uniqueSortOrders.length - 1]);
        if (uniqueSortOrders.length === 1) {
          setStep(1);
          if (isMultiCategory) setSelectedCategoryId(null);
        }
      } else if (uniqueSortOrders.length > 0) {
        const currentIndex = uniqueSortOrders.indexOf(currentSortOrder);
        if (currentIndex > 0) {
          const prevOrder = uniqueSortOrders[currentIndex - 1];
          setCurrentSortOrder(prevOrder);
          if (currentIndex - 1 === 0) {
            setStep(1);
            if (isMultiCategory) setSelectedCategoryId(null);
          }
        } else {
          setStep(1);
          if (isMultiCategory) setSelectedCategoryId(null);
        }
      } else {
        setStep(1);
        setCurrentSortOrder(0);
        if (isMultiCategory) setSelectedCategoryId(null);
      }
      scrollToTop();
      return;
    }
    
    if (step === 3) {
      setStep(2);
      setShowPassengerDetails(true);
      scrollToTop();
      return;
    }

    setStep(prev => prev - 1);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isProcessing) return;

    if (!supabase) {
      toast.error("Supabase is not configured properly.");
      return;
    }

    if (netTotal < 1.01) {
      toast.error(discountAmount > 0
        ? "The discount leaves less than the RM 1.01 minimum payable. Please remove the coupon or add another package."
        : "Minimum payment amount is RM 1.01");
      return;
    }
    if (netTotal > 50000) {
      toast.error("Maximum payment amount is RM 50,000.00");
      return;
    }

    if (!selectedTime || !selectedDate) {
      toast.error("Please select a date and time for your flight.");
      return;
    }

    if (paymentMethod === 'qr' && paymentProof.length === 0) {
      toast.error("Please upload the payment receipt.");
      return;
    }

    setIsProcessing(true);
    setShowProgressOverlay(true);
    
    // Use the component-specific scrollToTop which is safer on mobile
    scrollToTop();

    // Background check for WhatsApp status (non-blocking)
    checkWhatsAppStatus().then(isConnected => {
      if (!isConnected) {
        console.warn("WhatsApp bot might be disconnected, but proceeding with booking.");
      }
    });

    toast.info("Processing your booking...");

    try {
      // Give the UI a moment to show the overlay and finish any scrolling
      await new Promise(resolve => setTimeout(resolve, 500));

      let name = contactInfo.name;
      let email = contactInfo.email;
      let phone = contactInfo.phone;
      const flightDate = selectedDate;
      const specialNotes = (document.getElementById('notes') as HTMLInputElement)?.value || '';

      if (!name || !email || !phone) {
        throw new Error("Contact information is incomplete. Please go back to step 1.");
      }

      phone = phone.replace(/[^\d+]/g, '');
      if (phone.startsWith('0')) {
        phone = '+6' + phone;
      } else if (!phone.startsWith('+')) {
        phone = '+' + phone;
      }

      if (phone.length < 10) {
        throw new Error("Please enter a valid phone number with country code.");
      }

      if (!selectedTime) {
        throw new Error("Please select a flight time.");
      }

      // 1. Validate timeslot FIRST before doing anything else
      const { data: isTaken, error: isTakenError } = await supabase.rpc('is_timeslot_taken', {
        p_flight_date: flightDate,
        p_flight_time: selectedTime
      });

      if (isTakenError) {
        // Log the error details to help debugging
        console.error("Timeslot validation error:", isTakenError);
        throw new Error(`Failed to validate timeslot: ${isTakenError.message}`);
      }

      if (isTaken) {
        throw new Error("This time slot is already booked or too close to another booking (within 30 minutes). Please select another time.");
      }

      // 2. Check prices
      const packageIds = items.map(i => i.id);
      const { data: currentPackages } = await supabase
        .from('packages')
        .select('id, name, price, promotion_price, promotion_start_at, promotion_end_at')
        .in('id', packageIds);
      
      // Read the campaign fresh: it is the only thing allowed to have moved
      // a price below the packages table, and the cut comes from Postgres,
      // so this can confirm a discount but never invent one.
      const slashNow = await fetchSlashPrice();

      if (currentPackages) {
        const now = new Date();
        for (const item of items) {
          const pkg = currentPackages.find(p => p.id === item.id);
          if (pkg) {
            const isPromo = pkg.promotion_price &&
              (!pkg.promotion_start_at || new Date(pkg.promotion_start_at) <= now) &&
              (!pkg.promotion_end_at || new Date(pkg.promotion_end_at) > now);

            const askingPrice = isPromo ? Number(pkg.promotion_price) : Number(pkg.price);
            const isChallenge = !!slashNow && slashNow.packageId === pkg.id;
            const expectedPrice = isChallenge
              ? priceAfterReward(askingPrice, slashNow.reward, slashNow.rewardType)
              : askingPrice;

            if (Math.abs(expectedPrice - item.price) > 0.01) {
              // More people playing moves this mid-session, which is the
              // campaign working rather than an error - so say that.
              throw new Error(isChallenge
                ? `The challenge price for ${pkg.name} is now RM ${expectedPrice.toFixed(2)}. Please re-select the package to take it.`
                : `Price for ${pkg.name} has changed (Promotion status updated). Please re-select the package.`);
            }
          }
        }
      }

      // Re-check the coupon at the last moment: it may have expired, been
      // used up by somebody else, or stopped matching the cart since it was
      // typed in. The server is the authority on the discount we charge.
      let finalDiscount = 0;
      let finalCoupon: AppliedCoupon | null = null;

      if (appliedCoupon) {
        const { data: recheck, error: recheckError } = await supabase.rpc('validate_coupon', {
          p_code: appliedCoupon.code,
          p_package_ids: items.map(i => i.id),
          p_subtotal: total,
          p_email: email,
        });

        if (recheckError) throw new Error(`Coupon check failed: ${recheckError.message}`);

        const verdict = recheck as any;
        if (!verdict?.valid) {
          setAppliedCoupon(null);
          setCouponError(verdict?.message || 'This coupon is no longer valid.');
          throw new Error(verdict?.message || 'This coupon is no longer valid. Please review your total.');
        }

        finalDiscount = Math.min(Number(verdict.discount_amount) || 0, total);
        finalCoupon = { ...appliedCoupon, discount_amount: finalDiscount };
        setAppliedCoupon(finalCoupon);
      }

      const payableTotal = Math.max(0, total - finalDiscount);

      if (payableTotal < 1.01) {
        throw new Error("The discount leaves less than the RM 1.01 minimum payable.");
      }

      const shareCtx = readShareContext();

      let customerId;
      
      const { data: customerIdData, error: customerIdError } = await supabase.rpc('find_or_create_customer', {
        p_name: name,
        p_email: email,
        p_phone: phone,
        p_selected_date: flightDate,
        p_selected_time: selectedTime,
        p_notes: specialRequests
      });

      if (customerIdError) {
        throw new Error(`Customer lookup failed: ${customerIdError.message}`);
      }

      customerId = customerIdData;

      const bookingRef = await generateBookingReference(flightDate || undefined);
      if (!globalThis.crypto?.randomUUID) {
        throw new Error("Your browser does not support secure ID generation. Please update your browser.");
      }
      const bookingId = globalThis.crypto.randomUUID();
      
      const addItemsSummary = items
        .filter(item => item.parentPackageId)
        .map(item => `${item.name} - RM ${(item.price * item.quantity).toFixed(2)}`)
        .join('\n');

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          booking_id: bookingId,
          customer_id: customerId,
          booking_reference: bookingRef,
          total_amount: payableTotal,
          subtotal_amount: total,
          discount_amount: finalDiscount,
          coupon_id: finalCoupon?.coupon_id ?? null,
          coupon_code: finalCoupon?.code ?? null,
          share_link_id: shareCtx.shareLinkId,
          payment_status: 'unpaid',
          payment_gateway: paymentMethod === 'qr' ? 'manual' : 'CHIP',
          payment_method: paymentMethod === 'qr' ? 'qr_pay' : 'online_banking',
          flight_date: flightDate,
          flight_time: selectedTime,
          notes: specialNotes,
          add_items_summary: addItemsSummary,
          payment_type: paymentType,
          deposit_amount: paymentType === 'deposit' ? depositAmount : payableTotal,
          outstanding_balance: paymentType === 'full' ? 0 : (payableTotal - depositAmount),
          status: (paymentType === 'deposit' || paymentMethod === 'qr') ? 'pending_verification' : 'pending'
        });

      if (bookingError) throw new Error(`Booking creation failed: ${bookingError.message}`);

      // Burn the coupon now that a booking row exists. redeem_coupon is
      // idempotent per booking, so a retry never double-counts it.
      if (finalCoupon) {
        const { data: redeemResult, error: redeemError } = await supabase.rpc('redeem_coupon', {
          p_code: finalCoupon.code,
          p_booking_id: bookingId,
          p_discount: finalDiscount,
          p_order_total: payableTotal,
          p_email: email,
          p_phone: phone,
          p_name: name,
          p_share_link_id: shareCtx.shareLinkId,
        });

        if (redeemError) {
          console.error('Coupon redemption failed:', redeemError);
        } else if (!(redeemResult as any)?.ok) {
          console.warn('Coupon not redeemed:', (redeemResult as any)?.message);
        }
      }

      // Mark the agent's capture row as converted.
      captureShareForm({
        name, email, phone,
        selectedDate: flightDate || null,
        selectedTime,
        passengerCount: passengers.length,
        specialRequests,
        couponCode: finalCoupon?.code ?? null,
        cartItems: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        cartTotal: total,
        discountAmount: finalDiscount,
        stepReached: 'Payment submitted',
        furthestStep: 3,
        completed: true,
        bookingId,
      });

      trackShareEvent({
        event_type: 'checkout_start',
        metadata: { booking_id: bookingId, total: payableTotal, discount: finalDiscount },
      });

      const bookingItems = items.map(item => ({
        booking_id: bookingId,
        package_id: item.id, 
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('booking_items')
        .insert(bookingItems);

      if (itemsError) throw new Error(`Adding items failed: ${itemsError.message}`);

      const passengersWithUploadedIds = await Promise.all(passengers.map(async (p) => {
        let frontUrl = null;
        let backUrl = null;

        if (p.id_front_file) {
          try {
            const compressedFile = await compressFile(p.id_front_file);
            const fileExt = compressedFile.name.split('.').pop();
              const fileName = `passenger-ids/${bookingId}-${p.id}-front.${fileExt}`;
            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(fileName, compressedFile, { upsert: true, cacheControl: '31536000' });
            
            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(fileName);
              frontUrl = publicUrl;
            } else {
              console.error("Front ID upload error:", uploadError);
              toast.error(`Failed to upload Front ID for ${p.name}: ${uploadError.message}`);
            }
          } catch (error: any) {
            console.error("Front ID processing error:", error);
            toast.error(`Failed to process Front ID for ${p.name}: ${error.message}`);
          }
        }

        if (p.id_back_file) {
          try {
            const compressedFile = await compressFile(p.id_back_file);
            const fileExt = compressedFile.name.split('.').pop();
              const fileName = `passenger-ids/${bookingId}-${p.id}-back.${fileExt}`;
            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(fileName, compressedFile, { upsert: true, cacheControl: '31536000' });
            
            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(fileName);
              backUrl = publicUrl;
            } else {
              console.error("Back ID upload error:", uploadError);
              toast.error(`Failed to upload Back ID for ${p.name}: ${uploadError.message}`);
            }
          } catch (error: any) {
            console.error("Back ID processing error:", error);
            toast.error(`Failed to process Back ID for ${p.name}: ${error.message}`);
          }
        }

        return {
          booking_id: bookingId,
          type: p.type,
          weight: p.weight,
          height: p.height,
          name: p.name,
          ic_passport_number: p.ic_passport_number,
          country_of_origin: p.country_of_origin,
          gender: p.gender,
          id_front_url: frontUrl, 
          id_back_url: backUrl,
          status: p.will_fly ? 'Flying' : 'Passenger',
          will_fly: p.will_fly
        };
      }));

      const { error: passengersError } = await supabase
        .from('booking_passengers')
        .insert(passengersWithUploadedIds);

      if (passengersError) throw new Error(`Adding passengers failed: ${passengersError.message}`);

      if (paymentMethod === 'qr') {
        if (paymentProof.length > 0) {
          try {
            const uploadedUrls: string[] = [];
            
            for (let i = 0; i < paymentProof.length; i++) {
              const file = paymentProof[i];
              const compressedProof = await compressFile(file);
              const fileExt = compressedProof.name.split('.').pop();
              const fileName = `payment-proofs/${bookingId}_${i}.${fileExt}`;
              
              const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(fileName, compressedProof, { upsert: true, cacheControl: '31536000' });
              
              if (uploadError) throw new Error(`Proof upload failed for file ${i + 1}: ${uploadError.message}`);

              const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(fileName);
                
              uploadedUrls.push(publicUrl);
            }

            const { error: updateError } = await supabase.rpc('submit_payment_proof', {
              p_booking_id: bookingId,
              p_proof_url: uploadedUrls[0] || ''
            });

            if (updateError) {
              throw new Error(`Failed to submit payment proof: ${updateError.message}`);
            }
          } catch (error: any) {
             console.error("Payment proof processing error:", error);
             toast.error(`Failed to upload payment proof: ${error.message}`);
             throw error; 
          }
        }

        try {
          // Only send notifications if they haven't been sent yet
          const { data: bookingCheck } = await supabase
            .from('bookings')
            .select('notifications_sent')
            .eq('booking_id', bookingId)
            .single();

          if (bookingCheck && !bookingCheck.notifications_sent) {
            await notificationService.sendPendingApprovalNotifications(bookingId);
            
            // Mark as sent
            await supabase
              .from('bookings')
              .update({ notifications_sent: true })
              .eq('booking_id', bookingId);
          }
        } catch (e) {
          console.error("Failed to send frontend notifications:", e);
        }

        toast.success("Booking submitted successfully! We will verify your payment shortly.");
        clearCart();
        navigate(`/booking/success?id=${bookingId}`);
        setIsProcessing(false);
        setShowProgressOverlay(false);
        return;
      }

      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('chip-payment-initiate', {
        body: { 
          booking_id: bookingId,
          payment_type: paymentType 
        }
      });

      if (paymentError) {
        console.error("Payment initiation failed:", paymentError);
        throw new Error(`Payment initiation failed: ${paymentError.message}`);
      }

      if (paymentData?.checkout_url) {
        clearCart();
        window.location.href = paymentData.checkout_url;
      } else {
         throw new Error("No checkout URL returned from payment gateway.");
      }

    } catch (error: any) {
      console.error('Payment processing error:', error);
      let errorMessage = error.message || "An error occurred during payment processing.";
      
      if (errorMessage.includes('duplicate key value violates unique constraint') && errorMessage.includes('booking_reference')) {
        errorMessage = "A booking conflict occurred (duplicate reference for this date). This happens when multiple people book at the same time. Please try again.";
      }
      
      toast.error(errorMessage);
       setIsProcessing(false);
       setShowProgressOverlay(false);
     }
  };

  const currentStageIndex = uniqueSortOrders.indexOf(currentSortOrder) + 1;
  const sharedBgImage = siteSettings.bg_image_experience || "/bg-experience.webp";
  const sharedBgOpacity = Math.min(1, Math.max(0, Number(siteSettings.bg_image_experience_opacity ?? "0.2") || 0.2));

  const bannerImageSetting = siteSettings.booking_wizard_banner_image;
  const bannerImage = bannerImageSetting === 'none' ? null : (bannerImageSetting || "/banner_experience.png");
  const bannerOpacity = Math.min(1, Math.max(0, Number(siteSettings.booking_wizard_banner_opacity ?? "1") || 1));
  const bannerGradientStart = Math.min(100, Math.max(0, Number(siteSettings.booking_wizard_banner_gradient_start ?? "50") || 50));
  const bannerGradientEndRaw = Math.min(100, Math.max(0, Number(siteSettings.booking_wizard_banner_gradient_end ?? "85") || 85));
  const bannerGradientEnd = Math.max(bannerGradientStart, bannerGradientEndRaw);

  const step1IconName = siteSettings.booking_wizard_step1_icon || "Plane";
  const step2IconName = siteSettings.booking_wizard_step2_icon || "ListPlus";
  const step3IconName = siteSettings.booking_wizard_step3_icon || "CreditCard";
  const Step1Icon = BOOKING_STEP_ICONS[step1IconName] || Plane;
  const Step2Icon = BOOKING_STEP_ICONS[step2IconName] || ListPlus;
  const Step3Icon = BOOKING_STEP_ICONS[step3IconName] || CreditCard;
  const step1Label = siteSettings.booking_wizard_step1_label || "Select Flight";
  const step2Label = siteSettings.booking_wizard_step2_label || "Customise";
  const step3Label = siteSettings.booking_wizard_step3_label || "Checkout";

  return (
    <div 
      id="booking" 
      className="relative overflow-hidden pb-2 md:pb-4"
      style={siteSettings.bg_gradient_booking ? { background: siteSettings.bg_gradient_booking } : { background: "#FFFFFF" }}
      ref={topRef}
    >
      {/* Custom blinking animation styles */}
      <style>{blinkingStyles}</style>
      
      {/* Background Layer */}
      <div 
        className="absolute inset-0 z-0 mix-blend-multiply pointer-events-none"
        style={{
          backgroundImage: `url('${sharedBgImage}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          opacity: sharedBgOpacity
        }}
      />
      <div className="w-full px-2 md:px-4 lg:px-6 py-1 md:py-2 mt-4 md:mt-8">
        <div className="mx-auto w-full max-w-[1900px] overflow-hidden bg-gray-100/40 backdrop-blur-md md:rounded-[2rem]">
          {/* Wizard Header / Progress Bar */}
          <div 
            className="sticky top-0 z-30 relative overflow-hidden py-6 text-white"
          >
        {/* Background Gradient & Banner Image with Right-side Mask */}
        <div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            ...(siteSettings.bg_gradient_booking_wizard ? { background: siteSettings.bg_gradient_booking_wizard } : { background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF5F5 60%, #F5F5F5 100%)' }),
            maskImage: `linear-gradient(to right, black ${bannerGradientStart}%, transparent ${bannerGradientEnd}%)`,
            WebkitMaskImage: `linear-gradient(to right, black ${bannerGradientStart}%, transparent ${bannerGradientEnd}%)`
          }}
        >
          {bannerImage && (
            <div className="absolute inset-0" style={{ opacity: bannerOpacity }}>
              <img 
                loading="lazy"
                src={bannerImage}
                alt="" 
                decoding="async"
                width={1600}
                height={700}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
        <div className="w-full px-4 md:px-6 lg:px-8 relative z-10">
          <div className="max-w-6xl mx-auto">
            <h1 
  className="mb-6 text-center uppercase leading-none md:text-7xl font-title tracking-[0.08em]"
  style={{
    color: settingsStyles.booking_title?.color || '#2D2D2D',
    fontSize: settingsStyles.booking_title?.fontSize || 'clamp(2.5rem, 8vw, 5rem)',
    fontWeight: settingsStyles.booking_title?.fontWeight || '900',
    fontStyle: settingsStyles.booking_title?.fontStyle,
  }}
>
  {siteSettings.booking_title || 'Book Your Flight Experience'}
</h1>
            
            <div className="relative flex justify-between items-center max-w-2xl mx-auto">
              <div className="absolute top-1/2 left-0 h-1 w-full -z-0 bg-gray-200"></div>
              <div 
                className="absolute top-1/2 left-0 h-1 -z-0 bg-[#CD5C5C] transition-all duration-500"
                style={{ width: `${((step - 1) / 2) * 100}%` }}
              ></div>

              <motion.div 
                initial={isMobileView ? false : { opacity: 0, scale: 0.3, y: 20 }}
                whileInView={isMobileView ? undefined : { opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={isMobileView ? undefined : { 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 15, 
                  delay: 0.1,
                  duration: 0.6
                }}
                className={`relative z-10 flex flex-col items-center gap-2 ${step >= 1 ? 'text-[#CD5C5C]' : 'text-zinc-500'}`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${step >= 1 ? 'border-[#CD5C5C] bg-white' : 'border-gray-300 bg-gray-100'} ${step === 1 ? 'scale-110 shadow-[0_15px_40px_-10px_rgba(205,92,92,0.8)]' : ''}`}>
                  <Step1Icon className={`w-6 h-6`} />
                </div>
                <span className={`hidden text-[10px] font-black uppercase tracking-[0.24em] md:block font-condensed`}>{step1Label}</span>
              </motion.div>

              <motion.div 
                initial={isMobileView ? false : { opacity: 0, scale: 0.3, y: 20 }}
                whileInView={isMobileView ? undefined : { opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={isMobileView ? undefined : { 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 15, 
                  delay: 0.2,
                  duration: 0.6
                }}
                className={`relative z-10 flex flex-col items-center gap-2 ${step >= 2 ? 'text-[#CD5C5C]' : 'text-zinc-500'}`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${step >= 2 ? 'border-[#CD5C5C] bg-white' : 'border-gray-300 bg-gray-100'} ${step === 2 ? 'scale-110 shadow-[0_15px_40px_-10px_rgba(205,92,92,0.8)]' : ''}`}>
                  <Step2Icon className={`w-6 h-6`} />
                </div>
                <span className={`hidden text-[10px] font-black uppercase tracking-[0.24em] md:block font-condensed`}>{step2Label}</span>
              </motion.div>

              <motion.div 
                initial={isMobileView ? false : { opacity: 0, scale: 0.3, y: 20 }}
                whileInView={isMobileView ? undefined : { opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={isMobileView ? undefined : { 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 15, 
                  delay: 0.3,
                  duration: 0.6
                }}
                className={`relative z-10 flex flex-col items-center gap-2 ${step >= 3 ? 'text-[#CD5C5C]' : 'text-zinc-500'}`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${step >= 3 ? 'border-[#CD5C5C] bg-white' : 'border-gray-300 bg-gray-100'} ${step === 3 ? 'scale-110 shadow-[0_15px_40px_-10px_rgba(205,92,92,0.8)]' : ''}`}>
                  <Step3Icon className={`w-6 h-6`} />
                </div>
                <span className={`hidden text-[10px] font-black uppercase tracking-[0.24em] md:block font-condensed`}>{step3Label}</span>
              </motion.div>
            </div>
            </div>
          </div>
          </div>

          <div className="p-2 md:p-6 lg:p-8">
          
          {/* Step 1 Content: Flight Packages */}
          {step === 1 && (
            <div className={`space-y-8 ${isMobileView ? '' : 'animate-in fade-in slide-in-from-bottom-4 duration-500'}`}>
              {isInitialLoading ? (
                <div className="py-20 text-center flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#CD5C5C] mb-4"></div>
                  <p className="text-gray-500 font-medium">Loading flight categories...</p>
                  {showSlowInitialLoad && (
                    <div className="mt-6 animate-in fade-in duration-500">
                      <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">Still working on it. Mobile networks can sometimes be a bit slow.</p>
                      <Button 
                        onClick={() => {
                          setIsInitialLoading(true);
                          setRetryCount(prev => prev + 1);
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-2 border-slate-200"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retry Connection
                      </Button>
                    </div>
                  )}
                </div>
              ) : !selectedCategoryId && !isMultiCategory ? (
                <div className="py-20 text-center">
                  <p className="text-gray-500 mb-4">Could not load flight categories. Please try again.</p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsInitialLoading(true);
                      setRetryCount(prev => prev + 1);
                    }}
                    className="mx-auto border-[#CD5C5C] text-[#CD5C5C] hover:bg-[#CD5C5C] hover:text-white"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retry Loading
                  </Button>
                </div>
              ) : (
            <div className="relative group/scroll-container px-0 md:px-10">
              {/* Left Scroll Button (Outside Frame - Desktop Only) */}
              <button
                onClick={() => handleManualScroll('left')}
                className="hidden md:flex absolute -left-4 lg:-left-8 top-1/2 -translate-y-1/2 z-40 bg-[#CD5C5C]/60 hover:bg-[#CD5C5C]/90 backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 opacity-0 group-hover/scroll-container:opacity-100 items-center justify-center border-2 border-white/50 shadow-xl hover:scale-110 active:scale-95"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Right Scroll Button (Outside Frame - Desktop Only) */}
              <button
                onClick={() => handleManualScroll('right')}
                className="hidden md:flex absolute -right-4 lg:-right-8 top-1/2 -translate-y-1/2 z-40 bg-[#CD5C5C]/60 hover:bg-[#CD5C5C]/90 backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 opacity-0 group-hover/scroll-container:opacity-100 items-center justify-center border-2 border-white/50 shadow-xl hover:scale-110 active:scale-95"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

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
                  className="flex gap-[3px] min-w-max px-0 mx-auto w-fit"
                  onPointerEnter={(e) => { if (e.pointerType === 'mouse') setIsHovered(true) }}
                  onPointerLeave={(e) => { if (e.pointerType === 'mouse') setIsHovered(false) }}
                  onTouchStart={() => setIsHovered(true)}
                  onTouchEnd={() => setIsHovered(false)}
                  onTouchCancel={() => setIsHovered(false)}
                >
                  <FlightPackagesSection 
                    hidePadding={true} 
                    showTitle={false}
                    allowedPackageIds={allowedPackageIds}
                    onSelect={() => setHasInteracted(true)} 
                    onCategorySelect={(catId, sortOrder) => {
                      setSelectedCategoryId(catId);
                      setCurrentSortOrder(sortOrder);
                    }}
                    onPackageSelect={(catId, sortOrder, pkgId) => {
                      if (sortOrder === 0) {
                        setPassengers(prev => prev.length > 0 ? [prev[0]] : DEFAULT_PASSENGERS);
                      }
                      nextStep(false, catId, sortOrder, pkgId);
                    }}
                    sortOrder={currentSortOrder}
                    categoryId={selectedCategoryId}
                  />
                </div>
              </div>
            </div>
          )}
          
          {hasMainPackage && (
             <div className="flex justify-center mt-8 pb-4">
               <Button 
                 onClick={() => {
                   trackEvent({
                     action_type: 'click',
                     entity_type: 'booking_step',
                     entity_id: 'step_1_next',
                     entity_name: 'Booking Step 1 Next',
                     source: 'BookingWizard'
                   });
                   if (basePackageItem) {
                     nextStep(false, basePackageItem.category_id, basePackageItem.sort_order ?? 0, basePackageItem.id);
                   } else {
                     nextStep(true);
                   }
                 }}
                 className="h-12 px-10 text-white text-sm font-bold uppercase tracking-wider transition-all hover:scale-105 hover:shadow-[0_0_25px_rgba(205,92,92,0.6)]"
                 style={{ 
                   fontFamily: "'Barlow Condensed', sans-serif", 
                   background: "#CD5C5C",
                   borderRadius: "0.75rem" 
                 }}
               >
                 Next Step
                 <ChevronRight className="ml-2 w-5 h-5" />
               </Button>
             </div>
           )}
          </div>
          )}

          {/* Step 2 Content: Add-ons & Passenger Details */}
          {step === 2 && (
            <div className={`space-y-8 ${isMobileView ? '' : 'animate-in fade-in slide-in-from-bottom-4 duration-500'}`}>
              {currentSortOrder > 0 ? (
                <div className="space-y-8">
                  {/* Summary Calculation Box for Add-ons */}
                  <div className="max-w-6xl mx-auto px-0 md:px-10">
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
                  </div>

                  <div className="relative group/scroll-container px-0 md:px-10">
                    {/* Left Scroll Button (Outside Frame - Desktop Only) */}
                    <button
                      onClick={() => handleManualScroll('left')}
                      className="hidden md:flex absolute -left-4 lg:-left-8 top-1/2 -translate-y-1/2 z-40 bg-[#CD5C5C]/60 hover:bg-[#CD5C5C]/90 backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 opacity-0 group-hover/scroll-container:opacity-100 items-center justify-center border-2 border-white/50 shadow-xl hover:scale-110 active:scale-95"
                      aria-label="Scroll left"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>

                    {/* Right Scroll Button (Outside Frame - Desktop Only) */}
                    <button
                      onClick={() => handleManualScroll('right')}
                      className="hidden md:flex absolute -right-4 lg:-right-8 top-1/2 -translate-y-1/2 z-40 bg-[#CD5C5C]/60 hover:bg-[#CD5C5C]/90 backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 opacity-0 group-hover/scroll-container:opacity-100 items-center justify-center border-2 border-white/50 shadow-xl hover:scale-110 active:scale-95"
                      aria-label="Scroll right"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>

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
                      className="flex gap-[3px] min-w-max px-0 mx-auto w-fit"
                      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setIsHovered(true) }}
                      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setIsHovered(false) }}
                      onTouchStart={() => setIsHovered(true)}
                      onTouchEnd={() => setIsHovered(false)}
                      onTouchCancel={() => setIsHovered(false)}
                    >
                        <FlightPackagesSection 
                          hidePadding={true} 
                          onSelect={() => setHasInteracted(true)} 
                          sortOrder={currentSortOrder}
                          categoryId={selectedCategoryId}
                          allowedPackageIds={allowedPackageIds}
                          buttonText="Add to Trip"
                          isCompact={true}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-row items-center gap-3 sm:gap-4 border-t border-gray-200 pt-8">
                    <Button 
                      type="button"
                      onClick={handleBack} 
                      className="h-11 flex-1 sm:flex-none px-4 sm:px-6 text-white text-[10px] sm:text-sm font-bold uppercase tracking-wider transition-all hover:scale-105 hover:shadow-[0_0_25px_rgba(205,92,92,0.6)]"
                      style={{ 
                        fontFamily: "'Barlow Condensed', sans-serif", 
                        background: "#CD5C5C",
                        borderRadius: "0.75rem" 
                      }}
                    >
                      <ChevronLeft className="w-4 h-4 sm:hidden" />
                      <span className="truncate">Back</span>                     
                    </Button>
                    <Button 
                      type="button"
                      onClick={() => nextStep()} 
                      className="h-11 flex-[2] sm:flex-none px-6 sm:px-10 text-white text-[10px] sm:text-sm font-bold uppercase tracking-wider transition-all hover:scale-105 hover:shadow-[0_0_25px_rgba(205,92,92,0.6)]"
                      style={{ 
                        fontFamily: "'Barlow Condensed', sans-serif", 
                        background: "#CD5C5C", 
                        borderRadius: "0.75rem" 
                      }}
                    >
                      <span className="truncate">Next</span>
                      <ChevronRight className="w-4 h-4 sm:hidden" />
                    </Button>
                  </div>
                </div>
              ) : !showPassengerDetails ? (
                <div className="space-y-8">
                  <AddonsSelection 
                    currentCategoryIndex={currentCategoryIndex}
                    onCategoryChange={setCurrentCategoryIndex}
                    onComplete={() => setShowPassengerDetails(true)}
                    onBackToFlight={resetToSelectFlight}
                    excludeCategoryId={selectedCategoryId}
                    parentPackageId={selectedPackageId}
                  />
                </div>
              ) : (
                <div className="space-y-8">
                  {/* ── FIXED: white bg card, all text in gray-700/gray-900 ── */}
                  <Card className="overflow-hidden border border-gray-200 bg-white rounded-2xl shadow-lg">
                    <CardHeader className="border-b border-gray-100 bg-white rounded-t-2xl py-4 px-6">
                      <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
                        <Users className="w-5 h-5 text-[#CD5C5C]" />
                        Passenger Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="bg-white p-6">
                      <form id="passenger-details-form" className="space-y-6" onSubmit={(e) => { e.preventDefault(); nextStep(); }}>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-6">
                          <div>
                            <h3 className="font-bold text-xl text-gray-900">Who is flying?</h3>
                            <p className="text-sm text-gray-500">
                              Max passengers allowed: {totalMaxPassengers} · Selected to fly: {flySelectedCount}/{maxFlyersFromPackages}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-amber-50/40 p-4 sm:p-5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-lg bg-sky-50/90 border border-sky-100 p-4 shadow-sm">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Package</div>
                              <div className="mt-1.5 text-xs font-medium text-sky-600/70 uppercase tracking-wider">{basePackageItem?.category_name || "—"}</div>
                              <div className="mt-0.5 text-sm font-bold text-sky-900 truncate uppercase">{basePackageItem?.name || "—"}</div>
                              <div className="mt-1 text-sm font-bold text-[#CD5C5C]">
                                {basePackageItem ? `RM ${(basePackageItem.price * basePackageItem.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                              </div>
                            </div>
                            <div className="rounded-lg bg-emerald-50/90 border border-emerald-100 p-4 shadow-sm">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Add-ons</div>
                              <div className="mt-1.5 text-sm font-bold text-emerald-900">{addonItems.length} item(s)</div>
                              <div className="mt-1 text-sm font-bold text-[#CD5C5C]">
                                RM {addonItems.reduce((sum, it) => sum + it.price * it.quantity, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>
                            <div className="rounded-lg bg-rose-50/90 border border-rose-100 p-4 shadow-sm">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Total</div>
                              <div className="mt-1.5 text-sm font-bold text-rose-900">Paying now</div>
                              <div className="mt-1 text-sm font-bold text-[#CD5C5C]">RM {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                          </div>



                          <div className="mt-4 rounded-lg bg-indigo-50/90 border border-indigo-100 p-4 shadow-sm">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Calculation</div>
                            <div className="mt-2 space-y-1 text-xs text-indigo-900">
                              {basePackageItem && (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[9px] uppercase tracking-tighter text-indigo-500/70 font-bold">{basePackageItem.category_name}</span>
                                    <span className="truncate font-semibold">{basePackageItem.name} × {basePackageItem.quantity}</span>
                                  </div>
                                  <span className="shrink-0 font-bold text-indigo-900">RM {(basePackageItem.price * basePackageItem.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {addonItems.map((it) => (
                                <div key={`${it.id}-${it.sort_order}`} className="flex items-center justify-between gap-3">
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[9px] uppercase tracking-tighter text-indigo-500/70 font-bold">{it.category_name}</span>
                                    <span className="truncate font-semibold">{it.name} × {it.quantity}</span>
                                  </div>
                                  <span className="shrink-0 font-bold text-indigo-900">RM {(it.price * it.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              ))}
                              <div className="mt-2 pt-2 border-t border-indigo-200/60 flex items-center justify-between gap-3">
                                <span className="font-bold text-indigo-900">Total</span>
                                <span className="shrink-0 font-bold text-[#CD5C5C]">RM {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-6">
                          {passengers.map((p, index) => (
                            <div key={p.id} className="space-y-6">
                              <div className={`relative space-y-4 border border-gray-100 rounded-xl p-5 shadow-sm transition-colors ${p.bgColor || 'bg-white'}`}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className="text-sm font-bold text-gray-900">Passenger {index + 1}</div>
                                    <div className="flex items-center gap-2">
                                      <div className={`${p.will_fly ? "text-xs sm:text-sm font-extrabold animate-gentle-blink bg-emerald-100 text-emerald-700 border border-emerald-200" : "text-[11px] font-bold bg-gray-100 text-gray-500 border border-gray-200"} uppercase tracking-wider px-3 py-1 rounded-full transition-all`}>
                                        {p.will_fly ? "Flying" : "Not Flying"}
                                      </div>
                                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 select-none">
                                        <Checkbox
                                        checked={p.will_fly}
                                        onCheckedChange={(checked) => {
                                          const next = checked === true;
                                          if (next && flySelectedCount >= maxFlyersFromPackages) {
                                            toast.error(`Maximum ${maxFlyersFromPackages} flyer(s) allowed based on selected packages.`);
                                            return;
                                          }
                                          updatePassenger(p.id, 'will_fly', next);
                                          // Clear weight and height when unchecked
                                          if (!next) {
                                            updatePassenger(p.id, 'weight', 0);
                                            updatePassenger(p.id, 'height', 0);
                                          }
                                        }}
                                      />
                                        I Want To Fly
                                      </label>
                                    </div>
                                  </div>
                                  {passengers.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      onClick={() => removePassenger(p.id)}
                                      className="h-8 w-8 rounded-lg shrink-0"
                                      aria-label="Remove passenger"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                                <div className="flex flex-col sm:grid sm:grid-cols-12 gap-4 items-end">
                                  <div className="w-full sm:col-span-12 space-y-2">
                                    <Label className="font-bold text-gray-700">Full Name</Label>
                                    <Input 
                                      name={`passenger_${index}_name`}
                                      autoComplete="name"
                                      placeholder="Full Name as per ID/Passport" 
                                      className="h-11 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#CD5C5C]"
                                      value={p.name || ''}
                                      onChange={(e) => updatePassenger(p.id, 'name', e.target.value)}
                                    />
                                  </div>
                                  <div className="w-full sm:col-span-6 space-y-2">
                                    <Label className="font-bold text-gray-700">IC / Passport Number</Label>
                                    <Input 
                                      name={`passenger_${index}_ic`}
                                      autoComplete="on"
                                      placeholder="IC or Passport Number" 
                                      className="h-11 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#CD5C5C]"
                                      value={p.ic_passport_number || ''}
                                      onChange={(e) => updatePassenger(p.id, 'ic_passport_number', e.target.value)}
                                    />
                                  </div>
                                  <div className="w-full sm:col-span-6 space-y-2">
                                    <Label className="font-bold text-gray-700">Country of Origin</Label>
                                    <Select 
                                      value={p.country_of_origin || ''} 
                                      onValueChange={(value) => updatePassenger(p.id, 'country_of_origin', value)}
                                    >
                                      <SelectTrigger className="h-11 border-gray-200 bg-white text-gray-900 focus:border-[#CD5C5C]">
                                        <SelectValue placeholder="Select Country" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white border-gray-300">
                                        {COUNTRIES.map((country) => (
                                          <SelectItem key={country} value={country} className="text-gray-900 focus:bg-slate-100 focus:text-gray-900">
                                            {country}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="w-full sm:col-span-4 space-y-2">
                                    <Label className="font-bold text-gray-700">Gender</Label>
                                    <Select 
                                      value={p.gender || ''} 
                                      onValueChange={(value) => updatePassenger(p.id, 'gender', value)}
                                    >
                                      <SelectTrigger className="h-11 border-gray-200 bg-white text-gray-900 focus:border-[#CD5C5C]">
                                        <SelectValue placeholder="Select Gender" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white border-gray-300">
                                        <SelectItem value="Male" className="text-gray-900 focus:bg-slate-100">Male</SelectItem>
                                        <SelectItem value="Female" className="text-gray-900 focus:bg-slate-100">Female</SelectItem>
                                        <SelectItem value="Other" className="text-gray-900 focus:bg-slate-100">Other</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="w-full sm:col-span-4 space-y-2">
                                    <Label className="font-bold text-gray-700">Passenger Type</Label>
                                    <Select 
                                      value={p.type} 
                                      onValueChange={(value) => updatePassenger(p.id, 'type', value as Passenger['type'])}
                                    >
                                      <SelectTrigger className="h-11 border-gray-200 bg-white text-gray-900 focus:border-[#CD5C5C]">
                                        <SelectValue placeholder="Select Type" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white border-gray-300">
                                        <SelectItem value="adult" className="text-gray-900 focus:bg-slate-100">Adult</SelectItem>
                                        <SelectItem value="kid" className="text-gray-900 focus:bg-slate-100">Child (6+)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {p.will_fly && (
                                    <div className="w-full sm:col-span-2 space-y-2">
                                      <Label className="flex items-center gap-1 font-bold text-gray-900">
                                        <Scale className="w-3 h-3" /> Weight (kg)
                                        <span className="text-[#CD5C5C] ml-0.5">*</span>
                                      </Label>
                                      <Input 
                                        name={`passenger_${index}_weight`}
                                        autoComplete="on"
                                        type="number" 
                                        placeholder="e.g. 70" 
                                        className="h-11 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#CD5C5C]"
                                        value={p.weight || ''}
                                        onChange={(e) => updatePassenger(p.id, 'weight', parseFloat(e.target.value) || 0)}
                                      />
                                    </div>
                                  )}
                                  {p.will_fly && (
                                    <div className="w-full sm:col-span-2 space-y-2">
                                      <Label className="flex items-center gap-1 font-bold text-gray-900">
                                        <Ruler className="w-3 h-3" /> Height (cm)
                                        <span className="text-[#CD5C5C] ml-0.5">*</span>
                                      </Label>
                                      <Input 
                                        name={`passenger_${index}_height`}
                                        autoComplete="on"
                                        type="number" 
                                        placeholder="e.g. 170" 
                                        className="h-11 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#CD5C5C]"
                                        value={p.height || ''}
                                        onChange={(e) => updatePassenger(p.id, 'height', parseFloat(e.target.value) || 0)}
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* ID Documents */}
                                <div className="grid grid-cols-1 gap-4 pt-2 border-t border-gray-100">
                                  {/* Front ID */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <Label className="font-bold text-gray-700 flex items-center gap-2">
                                          <ImageIcon className="w-4 h-4" /> ID Document (Front)
                                        </Label>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <button 
                                              type="button" 
                                              className="text-[#CD5C5C] animate-pulse hover:text-[#b54a4a] transition-colors focus:outline-none p-0.5 rounded-full hover:bg-red-50 flex items-center justify-center"
                                              aria-label="View ID Front Sample"
                                            >
                                              <Info className="w-5 h-5" />
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-[95vw] sm:w-[600px] md:w-[700px] max-w-[720px] p-3 bg-white border border-slate-200 shadow-xl rounded-xl z-[9999]" side="top" align="start">
                                            <div className="space-y-2">
                                              <p className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">Sample ID (Front)</p>
                                              <img
                                                src="https://kjukdoqkunuifiorcdpz.supabase.co/storage/v1/object/public/media/categories/1782521475043_NRIC.jpg"
                                                alt="ID Front Sample"
                                                className="w-full rounded-lg border border-slate-100 shadow-sm"
                                                width={500}
                                                height={400}
                                                loading="lazy"
                                                decoding="async"
                                              />
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Max 3MB</span>
                                    </div>
                                    <div className="relative">
                                      <input 
                                        type="file" 
                                        id={`p-${p.id}-front`} 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            if (file.size > 3 * 1024 * 1024) {
                                              toast.error("File is too large. Max 3MB allowed.");
                                              return;
                                            }
                                            const progressKey = `${p.id}-front`;
                                            setUploadingProgress(prev => ({ ...prev, [progressKey]: true }));
                                            try {
                                              const { url, file: watermarkedFile } = await applyWatermark(file);
                                              if (p.id_front && p.id_front.startsWith('blob:')) {
                                                URL.revokeObjectURL(p.id_front);
                                              }
                                              updatePassenger(p.id, 'id_front', url);
                                              updatePassenger(p.id, 'id_front_file', watermarkedFile);
                                            } catch (error) {
                                              console.error("Watermark error:", error);
                                              toast.error("Failed to process image");
                                            } finally {
                                              setUploadingProgress(prev => ({ ...prev, [progressKey]: false }));
                                            }
                                          }
                                        }}
                                      />
                                      
                                      {uploadingProgress[`${p.id}-front`] && (
                                        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl animate-in fade-in duration-300">
                                          <div className="relative w-12 h-12">
                                            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                                            <div className="absolute inset-0 border-4 border-[#CD5C5C] border-t-transparent rounded-full animate-spin"></div>
                                          </div>
                                          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#CD5C5C] animate-pulse">Processing...</p>
                                        </div>
                                      )}

                                      {p.id_front ? (
                                        <div className="group relative w-full h-32 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-md">
                                          <img
                                            src={p.id_front}
                                            alt="Front ID"
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                          />
                                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                              type="button"
                                              variant="secondary"
                                              size="sm"
                                              className="h-8 font-black uppercase text-[10px] tracking-widest bg-white text-gray-900 hover:bg-white/90"
                                              onClick={() => setUploadMethodSelector({ passengerId: p.id, side: 'front' })}
                                            >
                                              Change
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="destructive"
                                              size="sm"
                                              className="h-8 font-black uppercase text-[10px] tracking-widest bg-red-600 text-white hover:bg-red-700"
                                              onClick={() => {
                                                if (p.id_front && p.id_front.startsWith('blob:')) {
                                                  URL.revokeObjectURL(p.id_front);
                                                }
                                                updatePassenger(p.id, 'id_front', undefined);
                                                updatePassenger(p.id, 'id_front_file', undefined);
                                              }}
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </div>
                                          <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                          </div>
                                        </div>
                                      ) : (
                                        <Button 
                                          type="button"
                                          variant="outline" 
                                          className="w-full h-32 border-2 border-dashed border-slate-300 hover:border-[#CD5C5C] hover:bg-red-50 group transition-all rounded-xl bg-white"
                                          onClick={() => setUploadMethodSelector({ passengerId: p.id, side: 'front' })}
                                        >
                                          <div className="flex flex-col items-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                                              <ImageIcon className="w-5 h-5 text-slate-500 group-hover:text-[#CD5C5C]" />
                                            </div>
                                            <p className="text-sm font-extrabold text-gray-800 group-hover:text-[#CD5C5C]">Upload Front ID</p>
                                          </div>
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Back ID */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <Label className="font-bold text-gray-700 flex items-center gap-2">
                                          <ImageIcon className="w-4 h-4" /> ID Document (Back)
                                        </Label>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <button
                                              type="button"
                                              className="text-[#CD5C5C] animate-pulse hover:text-[#b54a4a] transition-colors focus:outline-none p-0.5 rounded-full hover:bg-red-50 flex items-center justify-center"
                                              aria-label="View ID Back Sample"
                                            >
                                              <Info className="w-5 h-5" />
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-[95vw] sm:w-[600px] md:w-[700px] max-w-[720px] p-3 bg-white border border-slate-200 shadow-xl rounded-xl z-[9999]" side="top" align="start">
                                            <div className="space-y-2">
                                              <p className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">Sample ID (Back)</p>
                                              <img
                                                src="https://kjukdoqkunuifiorcdpz.supabase.co/storage/v1/object/public/media/categories/1782521475043_NRIC.jpg"
                                                alt="ID Back Sample"
                                                className="w-full rounded-lg border border-slate-100 shadow-sm"
                                                width={500}
                                                height={400}
                                                loading="lazy"
                                                decoding="async"
                                              />
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Max 3MB</span>
                                    </div>
                                    <div className="relative">
                                      <input
                                        type="file"
                                        id={`p-${p.id}-back`}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            if (file.size > 3 * 1024 * 1024) {
                                              toast.error("File is too large. Max 3MB allowed.");
                                              return;
                                            }
                                            const progressKey = `${p.id}-back`;
                                            setUploadingProgress(prev => ({ ...prev, [progressKey]: true }));
                                            try {
                                              const { url, file: watermarkedFile } = await applyWatermark(file);
                                              if (p.id_back && p.id_back.startsWith('blob:')) {
                                                URL.revokeObjectURL(p.id_back);
                                              }
                                              updatePassenger(p.id, 'id_back', url);
                                              updatePassenger(p.id, 'id_back_file', watermarkedFile);
                                            } catch (error) {
                                              console.error("Watermark error:", error);
                                              toast.error("Failed to process image");
                                            } finally {
                                              setUploadingProgress(prev => ({ ...prev, [progressKey]: false }));
                                            }
                                          }
                                        }}
                                      />

                                      {uploadingProgress[`${p.id}-back`] && (
                                        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl animate-in fade-in duration-300">
                                          <div className="relative w-12 h-12">
                                            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                                            <div className="absolute inset-0 border-4 border-[#CD5C5C] border-t-transparent rounded-full animate-spin"></div>
                                          </div>
                                          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#CD5C5C] animate-pulse">Processing...</p>
                                        </div>
                                      )}

                                      {p.id_back ? (
                                        <div className="group relative w-full h-32 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-md">
                                          <img
                                            src={p.id_back}
                                            alt="Back ID"
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                          />
                                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                              type="button"
                                              variant="secondary"
                                              size="sm"
                                              className="h-8 font-black uppercase text-[10px] tracking-widest bg-white text-gray-900 hover:bg-white/90"
                                              onClick={() => setUploadMethodSelector({ passengerId: p.id, side: 'back' })}
                                            >
                                              Change
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="destructive"
                                              size="sm"
                                              className="h-8 font-black uppercase text-[10px] tracking-widest bg-red-600 text-white hover:bg-red-700"
                                              onClick={() => {
                                                if (p.id_back && p.id_back.startsWith('blob:')) {
                                                  URL.revokeObjectURL(p.id_back);
                                                }
                                                updatePassenger(p.id, 'id_back', undefined);
                                                updatePassenger(p.id, 'id_back_file', undefined);
                                              }}
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </div>
                                          <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                          </div>
                                        </div>
                                      ) : (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className="w-full h-32 border-2 border-dashed border-slate-300 hover:border-[#CD5C5C] hover:bg-red-50 group transition-all rounded-xl bg-white"
                                          onClick={() => setUploadMethodSelector({ passengerId: p.id, side: 'back' })}
                                        >
                                          <div className="flex flex-col items-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                                              <ImageIcon className="w-5 h-5 text-slate-500 group-hover:text-[#CD5C5C]" />
                                            </div>
                                            <p className="text-sm font-extrabold text-gray-800 group-hover:text-[#CD5C5C]">Upload Back ID</p>
                                          </div>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <hr className="border-gray-100" />
                            </div>
                          ))}
                          
                          <Button 
                            type="button"
                            onClick={addPassenger} 
                            variant="outline" 
                            className="w-full border-2 border-dashed border-[#CD5C5C] bg-[#CD5C5C]/5 hover:bg-[#CD5C5C] hover:text-white text-[#CD5C5C] transition-all h-14 text-sm font-black uppercase tracking-[0.1em] rounded-xl mt-4 flex items-center justify-center gap-2 group shadow-sm"
                            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                            disabled={passengers.length >= totalMaxPassengers}
                          >
                            <div className="w-8 h-8 rounded-full bg-[#CD5C5C] text-white flex items-center justify-center group-hover:bg-white group-hover:text-[#CD5C5C] transition-all shadow-md">
                              <Users className="w-4 h-4" />
                            </div>
                            <span>Add Another Passenger ({passengers.length}/{totalMaxPassengers})</span>
                          </Button>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900 space-y-2">
                          <p className="font-bold flex items-center gap-2 text-amber-800">
                            <Scale className="w-4 h-4" /> Safety Regulations:
                          </p>
                          <ul className="list-disc pl-5 space-y-1 opacity-90 font-medium text-amber-800">
                            <li>Maximum weight per passenger: {safetySettings.safety_max_weight_per_pax || '120'}kg</li>
                            <li>Combined weight limit: 2 pax &lt; {safetySettings.safety_combined_weight_2pax || '160'}kg, 3 pax &lt; {safetySettings.safety_combined_weight_3pax || '200'}kg, 4 pax &lt; {safetySettings.safety_combined_weight_4pax || '240'}kg</li>
                            <li>Height requirement: {safetySettings.safety_min_height || '150'}cm - {safetySettings.safety_max_height || '180'}cm</li>
                            <li>Total weight (excluding pilot) must be below {safetySettings.safety_total_weight_limit || '200'}kg</li>
                          </ul>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  <div className="flex flex-row items-center gap-3 sm:gap-4 mt-8 pt-8 border-t border-gray-100">
                    <Button 
                      type="button"
                      onClick={handleBack}
                      className="h-11 flex-1 sm:flex-none px-4 sm:px-6 text-white text-[10px] sm:text-sm font-bold uppercase tracking-wider transition-all hover:scale-105 hover:shadow-[0_0_25px_rgba(204,31,31,0.6)]"
                      style={{ 
                        fontFamily: "'Barlow Condensed', sans-serif", 
                        background: "#CD5C5C",
                        borderRadius: "0.75rem"
                      }}
                    >
                      <ChevronLeft className="w-4 h-4" /> 
                      <span className="truncate">Back</span>
                    </Button>
                    <Button 
                      form="passenger-details-form"
                      type="submit"
                      className="h-11 flex-[2] sm:flex-none px-6 sm:px-10 text-white text-[10px] sm:text-sm font-bold uppercase tracking-wider transition-all hover:scale-105 hover:shadow-[0_0_25px_rgba(204,31,31,0.6)]"
                      style={{ 
                        fontFamily: "'Barlow Condensed', sans-serif", 
                        background: "#CD5C5C",
                        borderRadius: "0.75rem"
                      }}
                    >
                      <span className="truncate">Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className={`space-y-4 md:space-y-6 pb-10 ${isMobileView ? '' : 'animate-in fade-in slide-in-from-bottom-4 duration-500'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <h2 className="uppercase leading-none text-white" style={{ 
                      fontSize: settingsStyles.booking_title?.fontSize || '3rem',
                      fontWeight: settingsStyles.booking_title?.fontWeight || '900',
                      fontFamily: "'Bebas Neue', sans-serif", 
                      letterSpacing: "0.08em" 
                    }}>Checkout</h2>
                <Button 
                  variant="ghost" 
                  className="w-fit gap-2 text-white/70 hover:text-white hover:bg-white/10 text-sm font-bold uppercase tracking-wider" 
                  onClick={handleBack}
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Passenger Info
                </Button>
              </div>

              <div className="flex items-center gap-2 mb-6 overflow-x-auto py-2 no-scrollbar">
                {[
                  { s: 1, label: 'Contact' },
                  { s: 2, label: 'Schedule' },
                  { s: 3, label: 'Payment' }
                ].map((item) => (
                  <div key={item.s} className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutStep(item.s as 1 | 2 | 3);
                        scrollToTop();
                      }}
                      className="flex items-center gap-2 hover:opacity-80 transition-all focus:outline-none"
                    >
                      <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${checkoutStep === item.s ? 'bg-[#CD5C5C] text-white' : checkoutStep > item.s ? 'bg-green-500 text-white' : 'bg-white/20 text-white/40'}`}>
                        {checkoutStep > item.s ? <CheckCircle2 className="w-3.5 h-3.5" /> : item.s}
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-bold ${checkoutStep === item.s ? 'text-white' : 'text-white/40'}`}>{item.label}</span>
                    </button>
                    {item.s < 3 && <div className="w-4 h-[1px] bg-white/10 mx-1" />}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
                <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
                  {checkoutStep === 1 ? (
                    <Card className="border-accent/10 shadow-sm overflow-hidden rounded-2xl transition-all duration-500 animate-in fade-in slide-in-from-right-4 bg-sky-50/70">
                      <CardHeader className="bg-slate-900 text-white py-4">
                        <CardTitle className="text-sm uppercase tracking-widest font-black">Contact Details</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Full Name</Label>
                            <Input 
                              id="name" 
                              name="name"
                              value={contactInfo.name || ""}
                              onChange={(e) => setContactInfo(prev => ({ ...prev, name: e.target.value }))}
                              required 
                              placeholder="John Doe" 
                              className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold" 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Email</Label>
                            <Input 
                              id="email" 
                              name="email"
                              type="email" 
                              value={contactInfo.email || ""}
                              onChange={(e) => setContactInfo(prev => ({ ...prev, email: e.target.value }))}
                              required 
                              placeholder="john@example.com" 
                              className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold" 
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-[10px] uppercase font-black tracking-widest text-slate-500">WhatsApp Number</Label>
                          <Input 
                            id="phone" 
                            name="phone"
                            type="tel" 
                            value={contactInfo.phone || ""}
                            onChange={(e) => setContactInfo(prev => ({ ...prev, phone: e.target.value }))}
                            required 
                            placeholder="+60 12 345 6789" 
                            className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold" 
                          />
                        </div>
                        <div className="flex gap-3 pt-4">
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={handleBack}
                            className="flex-1 h-12 rounded-xl border-slate-200 font-black uppercase tracking-[0.2em] text-[11px] hover:bg-slate-50 transition-all active:scale-[0.98]"
                          >
                            Back
                          </Button>
                          <Button 
                            disabled={!contactInfo.name || !contactInfo.email || !contactInfo.phone}
                            onClick={() => { setCheckoutStep(2); scrollToTop(); }}
                            className="flex-[2] h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-lg shadow-slate-200 transition-all active:scale-[0.98]"
                          >
                            Continue to Schedule <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : checkoutStep === 2 ? (
                    <Card className="border-accent/10 shadow-sm overflow-hidden rounded-2xl transition-all duration-500 animate-in fade-in slide-in-from-right-4 bg-emerald-50/70">
                      <CardHeader className="bg-slate-900 text-white py-4">
                        <CardTitle className="text-sm uppercase tracking-widest font-black">Select Flight Schedule</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="date" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Preferred Flight Date</Label>
                            <Input 
                              id="date" 
                              name="date" 
                              type="date" 
                              required 
                              min={today}
                              value={selectedDate || ""}
                              className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold" 
                              onChange={(e) => setSelectedDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="time" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Preferred Time</Label>
                            <Select value={selectedTime} onValueChange={setSelectedTime} required disabled={!selectedDate}>
                              <SelectTrigger className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold">
                                <SelectValue placeholder={selectedDate ? "Select time" : "Choose date first"} />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {timeSlots.map((time) => {
                                  const formattedTime = formatFlightTime(time);
                                  const isBlocked = blockedTimes.some(bt => isWithinBuffer(bt, time));
                                  const isInPast = isTimeInPast(time);
                                  const isDisabled = isBlocked || isInPast;
                                  
                                  return (
                                    <SelectItem 
                                      key={time} 
                                      value={time} 
                                      disabled={isDisabled}
                                      className={isDisabled ? "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60" : "font-bold"}
                                    >
                                      <div className="flex items-center justify-between w-full gap-4">
                                        <span>{formattedTime}</span>
                                        {isBlocked && <span className="text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase font-black">Reserved</span>}
                                        {isInPast && <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase font-black">Unavailable</span>}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="notes" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Special Requests (Optional)</Label>
                          <Input 
                            id="notes" 
                            name="notes" 
                            placeholder="Any dietary requirements or special occasions?" 
                            className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold"
                            value={specialRequests}
                            onChange={(e) => setSpecialRequests(e.target.value)}
                          />
                        </div>

                        <div className="flex gap-3 pt-4">
                          <Button 
                            variant="outline"
                            onClick={() => setCheckoutStep(1)}
                            className="flex-1 h-12 rounded-xl border-slate-200 font-black uppercase tracking-[0.2em] text-[11px] hover:bg-slate-50 transition-all active:scale-[0.98]"
                          >
                            Back
                          </Button>
                          <Button 
                            disabled={!selectedDate || !selectedTime}
                            onClick={() => { setCheckoutStep(3); scrollToTop(); }}
                            className="flex-[2] h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-lg shadow-slate-200 transition-all active:scale-[0.98]"
                          >
                            Continue to Payment <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-accent/10 shadow-sm overflow-hidden rounded-2xl transition-all duration-500 animate-in fade-in slide-in-from-right-4 bg-violet-50/70">
                      <CardHeader className="bg-slate-900 text-white py-4">
                        <CardTitle className="text-sm uppercase tracking-widest font-black">Payment Details</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <form id="checkout-form" onSubmit={handlePayment} className="space-y-6">
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 rounded-xl border border-slate-100 gap-2">
                              <div>
                                <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Scheduled Flight</p>
                                <p className="font-bold text-slate-900">{selectedDate} at {formatFlightTime(selectedTime)}</p>
                              </div>
                              <Button type="button" variant="link" size="sm" onClick={() => setCheckoutStep(2)} className="h-auto p-0 text-[#CD5C5C] font-bold text-xs uppercase tracking-wider">Change</Button>
                            </div>

                            {/* Agent coupon - or, during a challenge, no box at all */}
                            <div className="space-y-2 pt-2">
                              <Label htmlFor="coupon" className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                                {slashActive ? 'Challenge Price' : 'Coupon Code (Optional)'}
                              </Label>

                              {slashActive ? (
                                <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50">
                                  <p className="font-black text-sm uppercase tracking-tight text-emerald-700 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span className="truncate">Challenge price</span>
                                  </p>
                                  <p className="mt-2 text-[11px] leading-snug text-emerald-700/80">
                                    The prices listed are the ones the group unlocked by playing, and that
                                    is what you pay. There is no code involved.
                                  </p>
                                </div>
                              ) : appliedCoupon ? (
                                <div className="flex items-center justify-between gap-3 p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50">
                                  <div className="min-w-0">
                                    <p className="font-black text-sm uppercase tracking-tight text-emerald-700 flex items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                                      <span className="truncate">{appliedCoupon.code}</span>
                                    </p>
                                    <p className="text-[11px] font-bold text-emerald-600">
                                      RM {discountAmount.toFixed(2)} off
                                      {appliedCoupon.agent_name ? ` · ${appliedCoupon.agent_name}` : ''}
                                    </p>
                                    {appliedCoupon.expires_at && (
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/80">
                                        Valid until {new Date(appliedCoupon.expires_at).toLocaleString('en-MY', {
                                          day: 'numeric', month: 'short', year: 'numeric',
                                          hour: 'numeric', minute: '2-digit',
                                        })}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={removeCoupon}
                                    className="shrink-0 h-9 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 font-black text-[10px] uppercase tracking-widest"
                                  >
                                    <X className="w-3.5 h-3.5 mr-1" /> Remove
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex gap-2">
                                    <Input
                                      id="coupon"
                                      value={couponInput}
                                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); validateCoupon(couponInput); }
                                      }}
                                      placeholder="Enter your agent's code"
                                      className="h-12 bg-slate-50 border-slate-200 rounded-xl font-black uppercase tracking-widest"
                                      disabled={couponChecking}
                                    />
                                    <Button
                                      type="button"
                                      onClick={() => validateCoupon(couponInput)}
                                      disabled={couponChecking || !couponInput.trim()}
                                      className="h-12 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-[0.2em] text-[11px] shrink-0"
                                    >
                                      {couponChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                                    </Button>
                                  </div>
                                  {couponError && (
                                    <p className="text-[11px] font-bold text-red-600">{couponError}</p>
                                  )}
                                </>
                              )}
                            </div>

                            {hasDepositOption && (
                              <div className="space-y-3 pt-2">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Payment Option</Label>
                                <div className="grid grid-cols-2 gap-4">
                                  <button
                                    type="button"
                                    onClick={() => setPaymentType('full')}
                                    className={`p-3 rounded-2xl border-2 text-xs font-black uppercase tracking-tight transition-all ${paymentType === 'full' ? 'bg-slate-50 border-slate-900 text-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                                  >
                                    Full Payment
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPaymentType('deposit')}
                                    className={`p-3 rounded-2xl border-2 text-xs font-black uppercase tracking-tight transition-all ${paymentType === 'deposit' ? 'bg-slate-50 border-slate-900 text-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                                  >
                                    Pay Deposit
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="space-y-4 pt-2">
                              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Payment Method</Label>
                              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'online' | 'qr')} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className={`flex items-center space-x-3 border-2 rounded-2xl p-4 cursor-pointer transition-all ${paymentMethod === 'online' ? 'bg-slate-50 border-slate-900' : 'hover:bg-slate-50 border-slate-100'}`} onClick={() => setPaymentMethod('online')}>
                                  <RadioGroupItem value="online" id="pm-online" />
                                  <div className="grid gap-0.5">
                                    <Label htmlFor="pm-online" className="cursor-pointer font-black text-xs uppercase tracking-tight">Online Banking</Label>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">FPX / Bank Transfer</span>
                                  </div>
                                </div>
                                <div 
                                  className={`flex items-center space-x-3 border-2 rounded-2xl p-4 cursor-pointer transition-all ${paymentMethod === 'qr' ? 'bg-slate-50 border-slate-900' : 'hover:bg-slate-50 border-slate-100'}`}
                                  onClick={() => setPaymentMethod('qr')}
                                >
                                  <RadioGroupItem value="qr" id="pm-qr" />
                                  <div className="flex-1">
                                    <Label htmlFor="pm-qr" className="cursor-pointer font-black text-xs uppercase tracking-tight flex items-center gap-2">
                                      <QrCode className="w-3.5 h-3.5" /> QR Pay / Manual
                                    </Label>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Scan DuitNow QR</p>
                                  </div>
                                </div>
                              </RadioGroup>
                            </div>

                            {paymentMethod === 'qr' && (
                              <div className={`mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-6 space-y-6">
                                  <div className="text-center space-y-2">
                                    <h3 className="font-black text-sm uppercase tracking-widest text-slate-900">Scan to Pay</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">DuitNow QR Payment</p>
                                  </div>
                                  
                                  {siteSettings.payment_qr_code_url && (
                                    <div className="flex justify-center">
                                      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 max-w-[500px] w-full">
                                        <img 
                                          src={siteSettings.payment_qr_code_url} 
                                          alt="Payment QR" 
                                          className="w-full aspect-square object-contain mx-auto"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                                    <div className="flex justify-between p-3 items-center">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Bank</span>
                                      <span className="text-xs font-black uppercase tracking-tight">{siteSettings.payment_bank_name}</span>
                                    </div>
                                    <div className="flex justify-between p-3 items-center">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Account</span>
                                      <span className="text-xs font-black uppercase tracking-tight">{siteSettings.payment_account_number}</span>
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="flex flex-col gap-3 relative">
                                      <input 
                                        id="payment-proof"
                                        type="file" 
                                        accept="image/*,application/pdf" 
                                        multiple
                                        className="hidden"
                                        onChange={async (e) => {
                                          const files = Array.from(e.target.files || []);
                                          if (files.length > 0) {
                                            const progressKey = 'receipt';
                                            setUploadingProgress(prev => ({ ...prev, [progressKey]: true }));
                                            
                                            try {
                                              const validFiles: File[] = [];
                                              for (const file of files) {
                                                const isImage = file.type.startsWith('image/');
                                                const limit = isImage ? 3 * 1024 * 1024 : 5 * 1024 * 1024;
                                                if (file.size > limit) {
                                                  toast.error(`File ${file.name} is too large.`);
                                                  continue;
                                                }
                                                
                                                if (isImage) {
                                                  const { file: watermarkedFile } = await applyWatermark(file);
                                                  validFiles.push(watermarkedFile);
                                                } else {
                                                  validFiles.push(file);
                                                }
                                              }
                                              setPaymentProof(prev => [...prev, ...validFiles]);
                                            } catch (error) {
                                              console.error("Receipt processing error:", error);
                                              toast.error("Failed to process receipt");
                                            } finally {
                                              setUploadingProgress(prev => ({ ...prev, [progressKey]: false }));
                                              e.target.value = '';
                                            }
                                          }
                                        }}
                                      />
                                      
                                      {uploadingProgress['receipt'] && (
                                        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl animate-in fade-in duration-300">
                                          <div className="relative w-12 h-12">
                                            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                                            <div className="absolute inset-0 border-4 border-[#CD5C5C] border-t-transparent rounded-full animate-spin"></div>
                                          </div>
                                          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#CD5C5C] animate-pulse">Processing...</p>
                                        </div>
                                      )}

                                      <Button
                                        type="button"
                                        onClick={() => setUploadMethodSelector({ passengerId: 'receipt', side: 'receipt' })}
                                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all hover:bg-slate-800 cursor-pointer text-center h-auto"
                                      >
                                        Upload Receipt
                                      </Button>
                                      
                                      <div className="flex flex-col gap-2">
                                        {paymentProof.map((file, idx) => (
                                          <div key={idx} className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-600 truncate">{file.name}</span>
                                            <Button 
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => setPaymentProof(prev => prev.filter((_, i) => i !== idx))}
                                              className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-3 pt-4">
                            
                            <Button 
                              type="submit"
                              disabled={
                                isProcessing || 
                                !contactInfo.name || 
                                !contactInfo.email || 
                                !contactInfo.phone || 
                                !selectedDate || 
                                !selectedTime || 
                                (paymentMethod === 'qr' && paymentProof.length === 0)
                              }
                              className="flex-[2] h-12 rounded-xl bg-[#CD5C5C] hover:bg-[#B54A4A] text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-lg shadow-[#CD5C5C]/20 transition-all active:scale-[0.98]"
                            >
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                              Place Order
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
                  <Card className="border-accent/10 shadow-sm overflow-hidden rounded-2xl bg-slate-50/70">
                    <CardHeader className="bg-slate-50 py-4 border-b border-slate-100">
                      <CardTitle className="text-xs uppercase tracking-[0.15em] font-black text-slate-900 flex items-center gap-2 font-title">
                        <ShoppingBagIcon className="w-4 h-4 text-[#CD5C5C]" /> Order Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-6">
                      <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                        {items.map((item) => (
                          <div key={`${item.id}-${item.sort_order}`} className="flex justify-between items-start gap-4 p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                            <div className="min-w-0">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{item.category_name}</p>
                              <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                              <p className="text-[10px] text-slate-500 font-medium">Qty: {item.quantity}</p>
                            </div>
                            <p className="text-xs font-black text-slate-900 shrink-0">RM {(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          </div>
                        ))}
                      </div>

                      {/* ── Contact Details ── */}
                      {checkoutStep >= 2 && contactInfo.name && (
                        <div className="space-y-2 pt-4 border-t border-dashed border-slate-200 animate-in fade-in slide-in-from-top-1 duration-300">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#CD5C5C] font-condensed">Contact Details</p>
                          <div className="space-y-1 bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">{contactInfo.name}</p>
                            <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5">
                              <Mail className="w-3 h-3" /> {contactInfo.email}
                            </p>
                            <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5">
                              <Phone className="w-3 h-3" /> {contactInfo.phone}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ── Flight Schedule ── */}
                      {checkoutStep >= 3 && selectedDate && (
                        <div className="space-y-2 pt-4 border-t border-dashed border-slate-200 animate-in fade-in slide-in-from-top-1 duration-300">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#CD5C5C] font-condensed">Flight Schedule</p>
                          <div className="flex items-center gap-3 bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                            <div className="flex-1">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Departure Date</p>
                              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-[#CD5C5C]" />
                                {new Date(selectedDate).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <div className="flex-1 border-l border-slate-200 pl-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Time Slot</p>
                              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <ClockIcon className="w-3 h-3 text-[#CD5C5C]" />
                                {selectedTime}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4 border-t border-slate-100 pt-6">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase">
                            <span>Subtotal</span>
                            <span>RM {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          {discountAmount > 0 && appliedCoupon && (
                            <div className="flex justify-between text-[11px] font-bold text-emerald-600 uppercase">
                              <span className="truncate">Coupon {appliedCoupon.code}</span>
                              <span className="shrink-0">− RM {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}

                          {paymentType === 'deposit' && (
                            <div className="flex justify-between text-[11px] font-bold text-[#CD5C5C] uppercase">
                              <span>Deposit Amount</span>
                              <span>RM {depositAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-900">Total Payable</span>
                            <span className="text-xl font-black text-[#CD5C5C]">RM {currentTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="p-6 bg-slate-900 rounded-2xl text-white space-y-4 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-[#CD5C5C]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Safe & Secure</p>
                        <p className="text-xs font-bold">SSL Encrypted Payment</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Camera Modal */}
      <Dialog open={!!cameraOpen} onOpenChange={() => setCameraOpen(null)}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-white border-none rounded-2xl">
          <DialogHeader className="p-4 bg-white border-b border-gray-100 text-gray-900 flex-row items-center justify-between space-y-0 relative">
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                {cameraOpen?.side === 'receipt' ? 'Receipt' : (cameraOpen?.side === 'front' ? 'ID Front' : 'ID Back')} Capture
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-xs">
                {cameraOpen?.side === 'receipt' ? 'Ensure the receipt is clearly visible within the frame' : 'Align your Malaysia NRIC within the frame'}
              </DialogDescription>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setCameraOpen(null)}
              className="text-gray-500 hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogHeader>
          <div className="p-4 bg-white">
            {cameraOpen && (
              <CameraCapture 
                isFront={cameraOpen.side === 'front' || cameraOpen.side === 'receipt'}
                onCapture={handleCameraCapture}
                onClose={() => setCameraOpen(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Method Selector Dialog */}
      <Dialog open={!!uploadMethodSelector} onOpenChange={() => setUploadMethodSelector(null)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <DialogHeader className="p-6 bg-white text-gray-900 relative">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-900">
                <ImageIcon className="w-5 h-5 text-primary" />
                Upload {uploadMethodSelector?.side === 'receipt' ? 'Receipt' : `ID (${uploadMethodSelector?.side === 'front' ? 'Front' : 'Back'})`}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Choose your preferred upload method
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="p-6 grid grid-cols-2 gap-4 bg-white">
            <Button 
              type="button"
              variant="outline" 
              className="flex flex-col h-40 gap-4 border-2 border-slate-100 hover:border-primary hover:bg-primary/5 transition-all group rounded-2xl"
              onClick={() => {
                if (uploadMethodSelector) {
                  setCameraOpen(uploadMethodSelector);
                  setUploadMethodSelector(null);
                }
              }}
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-900">Use Camera</p>
                <p className="text-[10px] text-slate-400 mt-1">With frame guidance</p>
              </div>
            </Button>
            
            <Button 
              type="button"
              variant="outline" 
              className="flex flex-col items-center justify-center h-40 gap-4 border-2 border-slate-100 rounded-2xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
              onClick={() => {
                if (uploadMethodSelector) {
                  const inputId = uploadMethodSelector.passengerId === 'receipt' ? 'payment-proof' : `p-${uploadMethodSelector.passengerId}-${uploadMethodSelector.side}`;
                  document.getElementById(inputId)?.click();
                  setUploadMethodSelector(null);
                }
              }}
            >
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <ImageIcon className="w-8 h-8 text-slate-500 group-hover:text-primary" />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-900">Local Storage</p>
                <p className="text-[10px] text-slate-400 mt-1">Choose from gallery</p>
              </div>
            </Button>
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center rounded-b-3xl">
            <Button type="button" variant="ghost" onClick={() => setUploadMethodSelector(null)} className="text-slate-500 text-sm font-bold uppercase tracking-wider">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showWhatsAppSupport} onOpenChange={setShowWhatsAppSupport}>
        <DialogContent className="sm:max-w-md bg-white border border-gray-200 shadow-2xl rounded-3xl overflow-hidden p-0">
          <div className="bg-red-500 h-2 w-full" />
          <div className="p-6 md:p-8 space-y-6">
            <DialogHeader className="space-y-3">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2">
                <MessageSquare className={`w-8 h-8 text-red-500 ${isMobileView ? '' : 'animate-pulse'}`} />
              </div>
              <DialogTitle className="text-2xl font-black text-center text-slate-900 leading-tight">
                Connection Interrupted
              </DialogTitle>
              <DialogDescription className="text-center text-slate-600 text-base font-medium">
                We're currently experiencing a connection issue with our automated system. Please contact our support team directly to complete your booking.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              {supportSettings.whatsapp && (
                <a 
                  href={`https://wa.me/${supportSettings.whatsapp.replace(/\+/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl bg-[#25D366]/10 border-2 border-[#25D366]/20 hover:bg-[#25D366]/20 transition-all group"
                >
                  <div className="w-12 h-12 bg-[#25D366] rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#128C7E] uppercase tracking-wider">WhatsApp Support</p>
                    <p className="text-lg font-black text-slate-900">{supportSettings.whatsapp}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#25D366]" />
                </a>
              )}

              {supportSettings.phone && (
                <a 
                  href={`tel:${supportSettings.phone}`}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50 border-2 border-blue-100 hover:bg-blue-100 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Call Us Directly</p>
                    <p className="text-lg font-black text-slate-900">{supportSettings.phone}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-blue-400" />
                </a>
              )}

              {supportSettings.email && (
                <a 
                  href={`mailto:${supportSettings.email}`}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 hover:bg-slate-100 transition-all group"
                >
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Support</p>
                    <p className="text-lg font-black text-slate-900 truncate max-w-[200px]">{supportSettings.email}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </a>
              )}
            </div>

            <Button 
              onClick={() => setShowWhatsAppSupport(false)}
              variant="outline"
              className="w-full h-12 rounded-xl font-bold border-2 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSafetyLimitSupport} onOpenChange={setShowSafetyLimitSupport}>
        <DialogContent className="sm:max-w-md bg-white border border-gray-200 shadow-2xl rounded-3xl overflow-hidden p-0">
          <div className="bg-[#CD5C5C] h-2 w-full" />
          <div className="p-6 md:p-8 space-y-6">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-2xl font-black text-center text-slate-900 leading-tight">
                Safety Limit Reached
              </DialogTitle>
              <DialogDescription className="text-center text-slate-600 text-base font-medium">
                If you are unable to book due to weight or height limit, please contact us for further assistance.
              </DialogDescription>
            </DialogHeader>

            {safetyLimitReason && (
              <div className="rounded-2xl border border-[#CD5C5C]/15 bg-[#CD5C5C]/5 px-4 py-3 text-center text-sm font-bold text-[#CD5C5C]">
                {safetyLimitReason}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                Customer Service Careline
              </div>
              <div className="mt-2 text-sm font-black text-slate-900">
                {(supportSettings.phone || "+603 9200 2998") + " | " + (supportSettings.whatsapp || "+6011 6512 7889")}
              </div>
              <div className="mt-2 text-sm font-black text-slate-900">
                {supportSettings.email || "booking@onedaypilot.com"}
              </div>
            </div>

            <Button
              onClick={() => setShowSafetyLimitSupport(false)}
              variant="outline"
              className="w-full h-12 rounded-xl font-bold border-2 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[500px] max-h-[92vh] overflow-hidden p-0 rounded-2xl sm:rounded-3xl border-none shadow-2xl flex flex-col">
          <div className="sticky top-0 z-20 bg-white backdrop-blur-md border-b border-gray-200 p-4 sm:p-6 flex items-center justify-between shrink-0">
            <DialogHeader className="p-0 space-y-1 text-left">
              <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">Review Our Experience</DialogTitle>
              <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Customer Feedback & Submission
              </DialogDescription>
            </DialogHeader>
            <DialogClose className="rounded-full p-2 hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5 text-slate-500" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-4 sm:p-6 space-y-8 pb-32">
              <div className="bg-slate-50/80 p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-inner">
                <h4 className="font-black text-slate-900 mb-5 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    Customer Reviews
                  </span>
                  <span className="text-xs font-black bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
                    {allReviews.length}
                  </span>
                </h4>
                <div className="max-h-[40vh] sm:max-h-[500px] overflow-y-auto overflow-x-hidden space-y-6 custom-scrollbar pr-1 sm:pr-2 scroll-smooth">
                  {allReviews.length === 0 ? (
                    <div className="text-center py-12 px-4 bg-white/50 rounded-xl border border-dashed border-gray-200">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageCircle className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-bold">No reviews yet</p>
                      <p className="text-xs text-slate-400 mt-1">Be the first to share your experience!</p>
                    </div>
                  ) : (
                    allReviews.map((rev) => (
                      <div key={rev.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group w-full min-w-0">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col min-w-0">
                            <p className="font-black text-slate-900 text-sm sm:text-base leading-none mb-1 group-hover:text-primary transition-colors truncate">
                              {rev.customer_name}
                            </p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate">
                              {rev.service?.title || 'General Review'}
                            </p>
                          </div>
                          <div className="flex gap-0.5 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100 shrink-0">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-3 h-3 ${i < rev.rating ? 'text-yellow-500 fill-yellow-500' : 'text-slate-200'}`} 
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium mb-4 italic break-words whitespace-pre-wrap">"{rev.comment}"</p>
                        {rev.image_urls && rev.image_urls.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x pt-2">
                            {rev.image_urls.map((url: string, idx: number) => (
                              <div key={idx} className="group relative rounded-xl overflow-hidden border-2 border-slate-100 w-20 h-20 sm:w-24 sm:h-24 shrink-0 snap-start shadow-sm bg-slate-200 transition-all hover:border-primary/50">
                                <img 
                                  src={url} 
                                  alt="Review" 
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer" 
                                  onClick={() => window.open(url, '_blank')}
                                />
                                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            
              <div className="mt-8 p-4 sm:p-6 rounded-2xl bg-slate-100 border border-slate-200/60 shadow-inner">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-xl text-slate-900 tracking-tight">Share Your Experience</h4>
                </div>
                
                <form onSubmit={submitReview} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Service Category</Label>
                      <div className="relative group">
                        <select 
                          className="w-full h-12 rounded-xl border-2 border-gray-200 bg-white px-4 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none cursor-pointer"
                          value={selectedReviewServiceId}
                          onChange={(e) => setSelectedReviewServiceId(e.target.value)}
                          required
                        >
                          <option value="" disabled>Select a service</option>
                          {allServices.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-primary transition-colors">
                          <ChevronRight className="w-4 h-4 rotate-90" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</Label>
                      <Input 
                        placeholder="e.g. John Doe" 
                        value={reviewForm.name || ""}
                        onChange={(e) => setReviewForm(prev => ({ ...prev, name: e.target.value }))}
                        className="h-12 rounded-xl border-2 border-gray-200 bg-white px-4 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Rating Experience</Label>
                    <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-inner">
                      <div className="flex gap-2 sm:gap-4">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setReviewForm(prev => ({ ...prev, rating: num }))}
                            className={`group relative p-1 transition-all duration-300 ${reviewForm.rating >= num ? 'scale-125' : 'hover:scale-110'}`}
                          >
                            <Star 
                              className={`w-8 h-8 sm:w-10 sm:h-10 transition-all ${
                                reviewForm.rating >= num 
                                  ? 'text-yellow-500 fill-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]' 
                                  : 'text-slate-200 group-hover:text-yellow-200'
                              }`} 
                            />
                          </button>
                        ))}
                      </div>
                      <span className="text-2xl font-black text-primary bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border border-gray-200">
                        {reviewForm.rating || 5}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Your Story</Label>
                    <Textarea 
                      placeholder="Tell us about your flight experience..." 
                      value={reviewForm.comment || ""}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                      className="min-h-[120px] rounded-2xl border-2 border-gray-200 bg-white p-4 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Visual Proof (Optional) - Max 3MB</Label>
                    <div className="relative group">
                      <Input 
                        type="file" 
                        multiple 
                        accept="image/*"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files) {
                            const validFiles: File[] = [];
                            let hasInvalidFile = false;
                            Array.from(files).forEach(file => {
                              if (file.size > 3 * 1024 * 1024) {
                                toast.error(`File ${file.name} is too large. Max 3MB allowed.`);
                                hasInvalidFile = true;
                              } else {
                                validFiles.push(file);
                              }
                            });

                            if (validFiles.length > 0) {
                              const dt = new DataTransfer();
                              validFiles.forEach(file => dt.items.add(file));
                              setReviewImages(dt.files);
                              if (hasInvalidFile) {
                                e.target.files = dt.files;
                              }
                            } else {
                              e.target.value = '';
                              setReviewImages(null);
                            }
                          }
                        }}
                        className="h-14 rounded-2xl border-2 border-dashed border-gray-200 bg-white px-4 py-3 text-xs font-bold text-gray-700 file:bg-primary file:text-white file:border-none file:rounded-lg file:px-4 file:py-1 file:mr-4 file:hover:bg-primary/90 transition-all cursor-pointer group-hover:border-primary/50 group-hover:bg-primary/5"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ImageIcon className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-2 h-2 rounded-full bg-primary ${isMobileView ? '' : 'animate-pulse'}`} />
                      <Label className="text-xs font-black text-slate-900 uppercase tracking-widest">WhatsApp Verification</Label>
                    </div>
                    
                    {!isVerified ? (
                      <div className="space-y-4">
                        {!isVerifying ? (
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                              <Input 
                                placeholder="+60123456789" 
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="h-12 rounded-xl border-2 border-gray-200 bg-white px-4 pl-10 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all w-full"
                              />
                              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>
                            <Button 
                              type="button" 
                              onClick={handleSendOTP} 
                              disabled={isSendingOtp}
                              className="h-12 px-4 sm:px-8 rounded-xl font-black shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all shrink-0 w-full sm:w-auto"
                            >
                              {isSendingOtp ? <Loader2 className="w-5 h-5 animate-spin" /> : 'GET OTP'}
                            </Button>
                          </div>
                        ) : (
                          <div className={`space-y-4 ${isMobileView ? '' : 'animate-in fade-in slide-in-from-top-2'}`}>
                            <div className="bg-primary/5 border border-gray-200 rounded-xl p-3 flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                                <ClockIcon className={`w-4 h-4 ${isMobileView ? '' : 'animate-pulse'}`} />
                              </div>
                              <div>
                                <p className="text-xs font-black text-primary uppercase tracking-wider">Verification Sent</p>
                                <p className="text-xs text-slate-500 font-medium">Please enter the 4-digit code sent to your WhatsApp.</p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <Input 
                                placeholder="0 0 0 0" 
                                maxLength={4}
                                value={otpInput || ""}
                                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                                className="h-14 rounded-xl border-2 border-gray-200 bg-white text-center tracking-[0.5em] text-2xl font-black text-gray-900 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                              />
                              <Button 
                                type="button" 
                                variant="outline"
                                onClick={() => setIsVerifying(false)}
                                className="h-12 px-6 rounded-xl text-sm font-bold uppercase tracking-wider border-2 border-gray-200 text-gray-700 hover:bg-slate-50 hover:border-slate-200 transition-all"
                              >
                                EDIT
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4 flex items-center gap-4 text-emerald-700 ${isMobileView ? '' : 'animate-in zoom-in-95'}`}>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                          <Check className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">Identity Verified</p>
                          <p className="text-sm font-black text-emerald-800">{phoneNumber}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
          
          <div className="sticky bottom-0 z-20 bg-white border-t border-slate-100 p-4 sm:p-6 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
            <Button 
              type="button"
              onClick={(e) => {
                if (paymentMethod === 'qr' && paymentProof.length === 0) {
                  toast.error("Please upload at least one payment receipt for QR Pay.");
                  return;
                }
                const form = (e.target as HTMLElement).closest('div')?.previousElementSibling?.querySelector('form');
                if (form) form.requestSubmit();
              }}
              className="w-full h-12 rounded-2xl font-bold text-sm uppercase tracking-wider shadow-xl shadow-primary/30 hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none group"
              disabled={isSubmitting || !isVerified}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>SUBMITTING...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>SUBMIT REVIEW</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showProgressOverlay && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-white animate-in fade-in duration-500 overflow-hidden touch-none lg:bg-slate-900/90 lg:backdrop-blur-xl">
          <div className={`text-center flex flex-col justify-center items-center transition-all duration-500 ${
            isMobileView 
              ? 'fixed inset-0 w-full h-full p-8 space-y-16 bg-white z-[10000]' 
              : 'space-y-8 p-10 max-w-md w-[90%] bg-white rounded-[2.5rem] shadow-2xl border border-white/20 animate-in zoom-in-95'
          }`}>
            <div className="relative w-40 h-40 mx-auto lg:w-32 lg:h-32">
              {/* Outer glowing ring */}
              <div className="absolute inset-0 border-[6px] lg:border-4 border-slate-100 rounded-full opacity-30 lg:opacity-20"></div>
              <div className="absolute inset-0 border-[6px] lg:border-4 border-[#CD5C5C] border-t-transparent rounded-full animate-spin shadow-[0_0_25px_rgba(205,92,92,0.3)]"></div>
              
              {/* Inner animated core */}
              <div className="absolute inset-5 lg:inset-4 bg-slate-50 rounded-full flex items-center justify-center shadow-inner">
                <div className="flex flex-col items-center">
                  <span className="text-4xl lg:text-3xl font-black text-slate-900 leading-none">{progressCount}</span>
                  <span className="text-[12px] lg:text-[10px] font-black text-slate-400 uppercase tracking-tighter">Seconds</span>
                </div>
              </div>

              {/* Pulsing decoration */}
              <div className="absolute -inset-3 lg:-inset-2 border-2 border-[#CD5C5C]/20 rounded-full animate-ping [animation-duration:3s]"></div>
            </div>
            
            <div className="space-y-6 lg:space-y-4">
              <div className="inline-flex items-center px-5 py-2 lg:px-4 lg:py-1.5 rounded-full bg-red-50 text-[#CD5C5C] text-[12px] lg:text-[10px] font-black uppercase tracking-[0.25em] animate-pulse">
                Secure Processing
              </div>
              <h3 className="text-4xl lg:text-3xl font-black uppercase tracking-wider text-slate-900 leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                Hold Tight!<br/>
                <span className="text-[#CD5C5C]">Processing Your Order</span>
              </h3>
              <p className="text-[13px] lg:text-[11px] text-slate-400 font-bold uppercase tracking-[0.12em] leading-relaxed max-w-[280px] lg:max-w-[260px] mx-auto">
                We are finalizing your flight schedule and preparing your confirmation documents.
              </p>
            </div>

            <div className="flex flex-col items-center gap-6 lg:gap-4">
              <div className="flex justify-center gap-4 lg:gap-3">
                <div className="w-3 h-3 lg:w-2.5 lg:h-2.5 bg-[#CD5C5C] rounded-full animate-bounce [animation-duration:1s] [animation-delay:-0.3s]"></div>
                <div className="w-3 h-3 lg:w-2.5 lg:h-2.5 bg-[#CD5C5C] rounded-full animate-bounce [animation-duration:1s] [animation-delay:-0.15s]"></div>
                <div className="w-3 h-3 lg:w-2.5 lg:h-2.5 bg-[#CD5C5C] rounded-full animate-bounce [animation-duration:1s]"></div>
              </div>
              <p className="text-[11px] lg:text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">Do not refresh or close</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
