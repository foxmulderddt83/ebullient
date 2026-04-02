import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { FlightPackagesSection } from "./FlightPackagesSection";
import { AddonsSelection } from "./AddonsSelection";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { ChevronRight, ChevronLeft, Check, Plane, ListPlus, CreditCard, Users, Scale, Ruler, Camera, Image as ImageIcon, X, Clock as ClockIcon, QrCode, ShoppingBag as ShoppingBagIcon, ShieldCheck, Mail, Phone, MessageSquare, Star, Loader2, MessageCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { notificationService } from "@/lib/notificationService";
import { BackgroundParticles } from "./ui/BackgroundParticles";
import { trackEvent } from "@/lib/analytics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { compressFile } from "@/utils/fileCompression";
import { generateBookingReference } from "@/lib/utils";

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
}

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
      
      // Get the video's actual dimensions
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      
      // Determine the crop area based on the NRIC frame guidance
      // The frame is max-w-md (448px) and aspect-ratio 85.6/53.98
      // We want to crop the area inside the frame for a cleaner capture
      
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
          <p className="text-sm text-slate-500">Please enable camera permissions in your browser settings to take a photo.</p>
        </div>
        <Button type="button" onClick={onClose} variant="outline">Close</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full aspect-[4/3] sm:aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        
        {/* NRIC Frame Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4 sm:p-8">
          <div className="relative w-full max-w-md aspect-[85.6/53.98] border-2 border-white/30 rounded-2xl shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]">
            {/* Corner marks */}
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />

            {/* NRIC Chip Guidance (Left side) */}
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

      {/* Controls */}
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
          <div className="absolute -inset-2 bg-primary/20 rounded-full blur-md group-hover:bg-primary/30 transition-all animate-pulse" />
          <div className="relative w-16 h-16 bg-white rounded-full border-4 border-slate-900 flex items-center justify-center shadow-xl group-active:scale-90 transition-transform">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white">
              <Camera className="w-6 h-6" />
            </div>
          </div>
        </button>

        <div className="w-12" /> {/* Spacer to balance */}
      </div>
    </div>
  );
};

export const applyWatermark = async (file: File): Promise<{ url: string; file: File }> => {
  // Fetch settings from Supabase
  const settings = {
    watermark_text: "FOR ONEDAYPILOT ONLY",
    watermark_color: "rgba(255, 0, 0, 0.5)",
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

        // Use a fixed target size for consistent watermark look, or scale based on original
        // To ensure "zoom" style and high quality, we use the original dimensions
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Watermark settings
        const watermarkText = settings.watermark_text;
        
        // Scale font and lines based on image width
        const baseSize = Math.max(img.width / 25, 18) * (parseFloat(settings.watermark_font_size) / 30);
        ctx.font = `300 ${baseSize}px Arial`; // Thin font weight (300)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textWidth = ctx.measureText(watermarkText).width;

        const drawWatermark = (x: number, y: number) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-Math.PI / 8); // Slight diagonal tilt

          const lineHeight = baseSize * 1.2;
          const padding = baseSize * 0.5;

          // Draw thin red lines above and below
          ctx.strokeStyle = settings.watermark_color.replace(/[\d\.]+\)$/g, '0.4)'); // Slightly more transparent version of color
          ctx.lineWidth = parseFloat(settings.watermark_line_thickness); 
          
          // Top line
          ctx.beginPath();
          ctx.moveTo(-textWidth / 2 - padding, -lineHeight / 2);
          ctx.lineTo(textWidth / 2 + padding, -lineHeight / 2);
          ctx.stroke();

          // Bottom line
          ctx.beginPath();
          ctx.moveTo(-textWidth / 2 - padding, lineHeight / 2);
          ctx.lineTo(textWidth / 2 + padding, lineHeight / 2);
          ctx.stroke();

          // Draw text without shadow for a cleaner, thinner look
          ctx.fillStyle = settings.watermark_color;
          ctx.shadowBlur = 0; // No shadow
          ctx.fillText(watermarkText, 0, 0);

          ctx.restore();
        };

        // Apply watermark based on position setting
        const margin = baseSize * 1.5;
        const position = settings.watermark_position;

        if (position === 'corners') {
          drawWatermark(margin + (textWidth / 2), margin + baseSize); // Top-left
          drawWatermark(canvas.width - margin - (textWidth / 2), canvas.height - margin - baseSize); // Bottom-right
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
          // Default to corners
          drawWatermark(margin + (textWidth / 2), margin + baseSize); 
          drawWatermark(canvas.width - margin - (textWidth / 2), canvas.height - margin - baseSize);
        }

        canvas.toBlob(async (blob) => {
          if (blob) {
            let watermarkedFile = new File([blob], file.name, { type: 'image/jpeg' });
            
            try {
              // Ensure watermarked file is compressed < 1MB
              watermarkedFile = await compressFile(watermarkedFile);
            } catch (error) {
              console.error("Compression failed for watermark:", error);
              // Fallback to original blob if compression fails for some reason (though unlikely for images)
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

export const BookingWizard = () => {
  const [step, setStep] = useState(1);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
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

  // OTP Verification logic
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
    if (!supabase) return true;
    try {
      // 1. Try Edge Function first (best way to handle CORS/RLS)
      try {
        const { data, error } = await supabase.functions.invoke('check-whatsapp-status');
        if (!error && data?.connected) return true;
      } catch (efError) {
        console.warn('Edge Function check failed, trying database/API fallback:', efError);
      }

      // 2. Check from DB status (updated by bot periodically)
      const { data } = await supabase.from('site_settings').select('value').eq('key', 'whatsapp_bot_status').maybeSingle();
      if (data && data.value === 'connected') return true;

      // 3. Fallback: Direct API check
      const { data: apiUrlData } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'whatsapp_api_url')
        .maybeSingle();

      const API_URL = apiUrlData?.value || import.meta.env.VITE_WHATSAPP_API_URL;
      
      if (API_URL) {
        const res = await fetch(`${API_URL}/api/status`).catch(() => null);
        if (res && res.ok) {
          const json = await res.json();
          return Boolean(json.connected);
        }
      }
      return false;
    } catch (e) {
      return false;
    }
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
        const file = reviewImages[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${i}.${fileExt}`;
        const filePath = `reviews/${selectedReviewServiceId}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file);
        if (!uploadError) {
          const publicUrl = supabase.storage.from(bucketName).getPublicUrl(filePath).data.publicUrl;
          image_urls.push(publicUrl);
          image_paths.push(filePath);
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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const { items, total } = useCart();
  
  const depositAmount = parseFloat(siteSettings.payment_deposit_amount || '0');
  const hasDepositOption = depositAmount > 0 && total > depositAmount;
  const currentTotal = paymentType === 'deposit' ? depositAmount : total;
  const topRef = useRef<HTMLDivElement>(null);
  const isFirstMount = useRef(true);
  const navigate = useNavigate();

  // Passenger State
  const [passengers, setPassengers] = useState<Passenger[]>([
    { id: 1, type: 'adult', weight: 0, height: 0, name: '', ic_passport_number: '', country_of_origin: '', gender: '' }
  ]);
  const [cameraOpen, setCameraOpen] = useState<{ passengerId: number; side: 'front' | 'back' } | null>(null);
  const [uploadMethodSelector, setUploadMethodSelector] = useState<{ passengerId: number; side: 'front' | 'back' } | null>(null);

  const [isMultiCategory, setIsMultiCategory] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [blockedTimes, setBlockedTimes] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showWhatsAppSupport, setShowWhatsAppSupport] = useState(false);
  const supportSettings = {
    email: siteSettings.email || "support@oneday.com",
    phone: siteSettings.phone || "+60123456789",
    whatsapp: siteSettings.whatsapp || "+60123456789"
  };

  const resetToSelectFlight = () => {
    setStep(1);
    setCurrentSortOrder(0);
    setSelectedCategoryId(null);
    setShowPassengerDetails(false);
    scrollToTop();
  };

  const today = new Date().toISOString().split('T')[0];

  const timeSlots = [
    "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM"
  ];

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

  const scrollToTop = () => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleSharedPackage = async () => {
      if (!supabase) return;
      const params = new URLSearchParams(window.location.search);
      const sharedId = params.get("sharePackageId");
      if (!sharedId) return;

      const { data: sharedPkg, error: sharedError } = await supabase
        .from('packages')
        .select('category_id, sort_order')
        .eq('id', sharedId)
        .eq('is_active', true)
        .single();

      if (!sharedError && sharedPkg) {
        setIsMultiCategory(false);
        setSelectedCategoryId(sharedPkg.category_id);
        setCurrentSortOrder(0); // Start at stage 1 for the shared package
        
        // Fetch unique sort orders for this category to determine stages
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
      }
    };
    handleSharedPackage();
  }, [supabase]);

  useEffect(() => {
    const fetchMainCategory = async () => {
      if (!supabase) return;
      
      const params = new URLSearchParams(window.location.search);
      if (params.has("sharePackageId")) return; // Skip if in shared mode
      
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('id')
        .eq('is_main_page', true)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!catError && categories && categories.length > 0) {
        // If there's only one main category, we can determine the stages immediately
        if (categories.length === 1) {
          setIsMultiCategory(false);
          const mainCatId = categories[0].id;
          setSelectedCategoryId(mainCatId);

          // Get unique sort_orders for this category
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
              // ALWAYS start with sort_order 0 in Step 1
              setCurrentSortOrder(0);
            }
          }
        } else {
          // Multiple categories. We'll show all in Step 1.
          setIsMultiCategory(true);
          setSelectedCategoryId(null);
          setTotalStages(3); // Default assumption: Main -> Customise -> Checkout
          setUniqueSortOrders([0]); // Initial sort order for all
          setCurrentSortOrder(0);
        }
      }
    };

    fetchMainCategory();
  }, []);

  useEffect(() => {
    const fetchSiteSettings = async () => {
      if (!supabase) return;
      const { data, error } = await supabase.from('site_settings').select('*');
      if (data && !error) {
        const settingsMap: Record<string, string> = {};
        const stylesMap: Record<string, any> = {};
        
        data.forEach((curr: any) => {
          settingsMap[curr.key] = curr.value;
          if (curr.style) {
            stylesMap[curr.key] = curr.style;
          }
        });
        
        // Backward compatibility for booking wizard gradient key
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
        const { data, error } = await supabase
          .from('bookings')
          .select('flight_time')
          .eq('flight_date', selectedDate)
          .or('payment_status.eq.paid,status.eq.confirmed');
        
        if (data && !error) {
          const times = data.map(b => b.flight_time).filter(Boolean) as string[];
          setBlockedTimes(times);
        }
      };
      fetchBlockedTimes();
    } else {
      setBlockedTimes([]);
    }
  }, [selectedDate]);

  useEffect(() => {
    const handleGoToPassenger = () => {
      setStep(2);
      setShowPassengerDetails(true);
      setCurrentSortOrder(0);
      scrollToTop();
    };

    window.addEventListener('goToPassengerInfo', handleGoToPassenger);

    // Check localStorage for forced step
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
    if (passengers.length >= 3) {
      toast.error("Maximum 3 passengers allowed");
      return;
    }
    setPassengers(prev => [...prev, { 
      id: prev.length + 1, 
      type: 'adult', 
      weight: 0, 
      height: 0,
      name: '',
      ic_passport_number: '',
      country_of_origin: '',
      gender: ''
    }]);
  };

  const removePassenger = (id: number) => {
    if (passengers.length <= 1) return;
    setPassengers(prev => prev.filter(p => p.id !== id));
  };

  const handleCameraCapture = async (file: File) => {
    if (!cameraOpen) return;
    const { passengerId, side } = cameraOpen;
    
    // Enforce 1MB image limit for captured IDs
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Captured image is too large (max 1MB). Please try again or use lower resolution.");
      return;
    }

    try {
      const { url, file: watermarkedFile } = await applyWatermark(file);
      const passenger = passengers.find(p => p.id === passengerId);
      if (passenger) {
        const currentUrl = side === 'front' ? passenger.id_front : passenger.id_back;
        if (currentUrl && currentUrl.startsWith('blob:')) {
          URL.revokeObjectURL(currentUrl);
        }
      }
      updatePassenger(passengerId, side === 'front' ? 'id_front' : 'id_back', url);
      updatePassenger(passengerId, side === 'front' ? 'id_front_file' : 'id_back_file', watermarkedFile);
      setCameraOpen(null);
      toast.success(`${side === 'front' ? 'Front' : 'Back'} ID captured!`);
    } catch (error) {
      console.error("Capture process error:", error);
      toast.error("Failed to process captured image");
    }
  };

  useEffect(() => {
    // Cleanup blob URLs on unmount
    return () => {
      passengers.forEach(p => {
        if (p.id_front && p.id_front.startsWith('blob:')) {
          URL.revokeObjectURL(p.id_front);
        }
        if (p.id_back && p.id_back.startsWith('blob:')) {
          URL.revokeObjectURL(p.id_back);
        }
      });
    };
  }, []);

  const validatePassengers = () => {
    // Dynamic Rules from safetySettings or Defaults
    const maxWeightPerPax = Number(safetySettings.safety_max_weight_per_pax || 120);
    const combinedWeight2Pax = Number(safetySettings.safety_combined_weight_2pax || 160);
    const combinedWeight3Pax = Number(safetySettings.safety_combined_weight_3pax || 200);
    const minHeight = Number(safetySettings.safety_min_height || 150);
    const maxHeight = Number(safetySettings.safety_max_height || 180);
    const totalWeightLimit = Number(safetySettings.safety_total_weight_limit || 200);

    const totalWeight = passengers.reduce((sum, p) => sum + Number(p.weight), 0);
    const count = passengers.length;

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
      if (p.height < minHeight || p.height > maxHeight) {
        toast.error(`Passenger ${p.id} height must be between ${minHeight}cm and ${maxHeight}cm for safety.`);
        return false;
      }
      if (p.weight <= 0) {
        toast.error(`Please enter valid weight for Passenger ${p.id}`);
        return false;
      }
    }

    if (count === 1) {
      if (totalWeight >= maxWeightPerPax) {
        toast.error(`Maximum weight for 1 passenger is ${maxWeightPerPax}kg`);
        return false;
      }
    } else if (count === 2) {
      if (totalWeight >= combinedWeight2Pax) {
        toast.error(`Combined weight for 2 passengers must be below ${combinedWeight2Pax}kg`);
        return false;
      }
    } else if (count === 3) {
      if (totalWeight >= combinedWeight3Pax) {
        toast.error(`Combined weight for 3 passengers must be below ${combinedWeight3Pax}kg`);
        return false;
      }
    }

    if (totalWeight >= totalWeightLimit) {
      toast.error(`Total passenger weight must be below ${totalWeightLimit}kg`);
      return false;
    }

    return true;
  };

  const nextStep = async (skipValidation = false, catId?: string, sortOrd?: number, pkgId?: string) => {
    if (catId) setSelectedCategoryId(catId);
    if (pkgId) setSelectedPackageId(pkgId);
    
    // If sortOrd is provided (e.g. from Step 1 package select), 
    // we want to move to sortOrd + 1 to check for sequential packages in the same category
    if (sortOrd !== undefined) {
      setCurrentSortOrder(sortOrd + 1);
    }

    if (!skipValidation) {
      if (step === 1) {
        // When moving from Step 1 to Step 2, if we have a category selected,
        // we check if there are any packages with sort_order = 1 in that category.
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
            // We have sort_order=1 packages, so Step 2 will show them via FlightPackagesSection
            setCurrentSortOrder(1);
            trackEvent({
              action_type: 'view',
              entity_type: 'dynamic_panel',
              entity_id: `customise_sort_order_1`,
              entity_name: `Customise: Sequential Package 1`
            });
          } else {
            // No sort_order=1 packages, go straight to AddonsSelection stage (currentSortOrder = 0)
            setCurrentSortOrder(0);
            trackEvent({
              action_type: 'view',
              entity_type: 'dynamic_panel',
              entity_id: `addons_selection`,
              entity_name: `Addons Selection`
            });
          }
        }
      }
      
      if (step === 2) {
        // If we are currently showing a higher sort_order package in the Customise step
        // check if there's even MORE in the sequence before moving to Addons/Details
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
              entity_name: `Customise: Sequential Package ${data[0].sort_order}`
            });
            scrollToTop();
            return;
          } else {
            // End of package sequence, move to Add-ons Selection stage (currentSortOrder = 0)
            setCurrentSortOrder(0);
            trackEvent({
              action_type: 'view',
              entity_type: 'dynamic_panel',
              entity_id: `addons_selection`,
              entity_name: `Addons Selection`
            });
            scrollToTop();
            return;
          }
        }

        // If we are in AddonsSelection (currentSortOrder === 0) and not yet in Passenger Details, 
        // check if we should move to Passenger Details.
        if (currentSortOrder === 0 && !showPassengerDetails) {
           // WHATSAPP CHECK BEFORE PASSENGER DETAILS
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
             entity_name: 'Passenger Details'
           });
           scrollToTop();
           return;
        }

        // If we were already in Passenger Details, validate and move to Step 3
        if (showPassengerDetails) {
          if (!validatePassengers()) return;
        }
      }
    }
    
    if (step === 3) {
      // WHATSAPP CHECK BEFORE CHECKOUT
      const isConnected = await checkWhatsAppStatus();
      if (!isConnected) {
        setShowWhatsAppSupport(true);
        return;
      }
      
      // Track moving to checkout
      trackEvent({
        action_type: 'click',
        entity_type: 'page',
        entity_id: '/checkout',
        entity_name: 'Proceed to Checkout'
      });

      navigate('/checkout');
      return;
    }

    setStep(prev => {
      const next = prev + 1;
      // Track step change
      trackEvent({
        action_type: 'view',
        entity_type: 'page',
        entity_id: `booking_wizard_step_${next}`,
        entity_name: `Booking Wizard: Step ${next}`
      });
      return next;
    });
  };

  const prevStep = () => {
    if (step === 2) {
      if (showPassengerDetails) {
        setShowPassengerDetails(false);
        // Track going back from passenger details
        trackEvent({
          action_type: 'click',
          entity_type: 'page',
          entity_id: 'booking_wizard_back_from_passengers',
          entity_name: 'Back from Passenger Details'
        });
      } else if (currentSortOrder === 0 && uniqueSortOrders.length > 0) {
        // We were in AddonsSelection, go back to the last sequential package
        setCurrentSortOrder(uniqueSortOrders[uniqueSortOrders.length - 1]);
        // If there was only one stage, go back to Step 1
        if (uniqueSortOrders.length === 1) {
          setStep(1);
          if (isMultiCategory) setSelectedCategoryId(null);
        }
      } else if (uniqueSortOrders.length > 0) {
        const currentIndex = uniqueSortOrders.indexOf(currentSortOrder);
        if (currentIndex > 0) {
          // Go to previous sort_order
          const prevOrder = uniqueSortOrders[currentIndex - 1];
          setCurrentSortOrder(prevOrder);
          // If we just moved back to the first sort_order, we are back at Step 1
          if (currentIndex - 1 === 0) {
            setStep(1);
            if (isMultiCategory) setSelectedCategoryId(null);
          }
        } else {
          // Already at the first sort_order, go back to Step 1
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
    
    if (!supabase) {
      toast.error("Supabase is not configured properly.");
      return;
    }

    // Amount Validation (CHIP / Standard MYR Gateway Limits)
    if (total < 1.01) {
      toast.error("Minimum payment amount is RM 1.01");
      return;
    }
    if (total > 50000) {
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
    toast.info("Checking connection status...");

    try {
      // Ensure WhatsApp is connected before allowing booking
      const isConnected = await checkWhatsAppStatus();
      if (!isConnected) {
        setIsProcessing(false);
        setShowWhatsAppSupport(true);
        toast.error("WhatsApp bot disconnected. Please contact support to proceed.");
        return;
      }

      toast.info("Processing your booking...");

      // Validate Prices (Promotion Expiry Check)
      const packageIds = items.map(i => i.id);
      const { data: currentPackages } = await supabase
        .from('packages')
        .select('id, name, price, promotion_price, promotion_start_at, promotion_end_at')
        .in('id', packageIds);
      
      if (currentPackages) {
        const now = new Date();
        for (const item of items) {
          const pkg = currentPackages.find(p => p.id === item.id);
          if (pkg) {
            const isPromo = pkg.promotion_price && 
              (!pkg.promotion_start_at || new Date(pkg.promotion_start_at) <= now) &&
              (!pkg.promotion_end_at || new Date(pkg.promotion_end_at) > now);
            
            const expectedPrice = isPromo ? Number(pkg.promotion_price) : Number(pkg.price);
            
            // Allow small float difference
            if (Math.abs(expectedPrice - item.price) > 0.01) {
              throw new Error(`Price for ${pkg.name} has changed (Promotion status updated). Please re-select the package.`);
            }
          }
        }
      }

      const formData = new FormData(e.target as HTMLFormElement);
      const name = formData.get("name") as string;
      const email = formData.get("email") as string;
      let phone = formData.get("phone") as string;
      const flightDate = selectedDate;

      // Format Phone Number (Ensure country code)
      phone = phone.replace(/[^\d+]/g, '');
      if (phone.startsWith('0')) {
        phone = '+6' + phone; // Default to Malaysia if starts with 0
      } else if (!phone.startsWith('+')) {
        phone = '+' + phone;
      }

      if (phone.length < 10) {
        throw new Error("Please enter a valid phone number with country code.");
      }

      // Check if slot is still available
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('booking_id')
        .eq('flight_date', flightDate)
        .eq('flight_time', selectedTime)
        .or('payment_status.eq.paid,status.eq.confirmed')
        .maybeSingle();

      if (existingBooking) {
        throw new Error("This time slot has already been booked. Please select another time.");
      }

      // 1. Create/Get Customer
      let customerId;
      
      // Try to find existing customer by email or phone
      let existingCustomer = null;
      if (email || phone) {
        const query = supabase
          .from('customers')
          .select('id');
        
        if (email) {
          query.eq('email', email);
        } else {
          query.eq('phone', phone);
        }

        const { data, error } = await query.maybeSingle();
        
        if (error) {
          console.error("Error fetching customer:", error);
        }
        existingCustomer = data;
      }

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({ name, email, phone })
          .select()
          .single();
        
        if (createError) throw new Error(`Customer creation failed: ${createError.message}`);
        customerId = newCustomer.id;
      }

      // 2. Create Booking
      const bookingRef = await generateBookingReference(flightDate || undefined);
      const specialNotes = formData.get("notes") as string;
      
      // Calculate add_items_summary
      const addItemsSummary = items
        .filter(item => item.parentPackageId)
        .map(item => `${item.name} - RM ${(item.price * item.quantity).toFixed(2)}`)
        .join('\n');

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: customerId,
          booking_reference: bookingRef,
          total_amount: total,
          payment_status: 'unpaid',
          payment_gateway: paymentMethod === 'qr' ? 'manual' : 'CHIP',
          payment_method: paymentMethod === 'qr' ? 'qr_transfer' : 'online_banking',
          flight_date: flightDate,
          flight_time: selectedTime,
          notes: specialNotes,
          add_items_summary: addItemsSummary,
          payment_type: paymentType,
          deposit_amount: paymentType === 'deposit' ? depositAmount : total,
          outstanding_balance: paymentType === 'full' ? 0 : (total - depositAmount),
          status: (paymentType === 'deposit' || paymentMethod === 'qr') ? 'pending_verification' : 'pending'
        })
        .select()
        .single();

      if (bookingError) throw new Error(`Booking creation failed: ${bookingError.message}`);

      // 3. Create Booking Items
      const bookingItems = items.map(item => ({
        booking_id: booking.booking_id,
        package_id: item.id, 
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('booking_items')
        .insert(bookingItems);

      if (itemsError) throw new Error(`Adding items failed: ${itemsError.message}`);

      // 3.5 Create Booking Passengers
      const passengersWithUploadedIds = await Promise.all(passengers.map(async (p) => {
        let frontUrl = null;
        let backUrl = null;

        if (p.id_front_file) {
          try {
            const compressedFile = await compressFile(p.id_front_file);
            const fileExt = compressedFile.name.split('.').pop();
            const fileName = `passenger-ids/${booking.booking_id}-${p.id}-front.${fileExt}`;
            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(fileName, compressedFile, { upsert: true });
            
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
            const fileName = `passenger-ids/${booking.booking_id}-${p.id}-back.${fileExt}`;
            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(fileName, compressedFile, { upsert: true });
            
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
          booking_id: booking.booking_id,
          type: p.type,
          weight: p.weight,
          height: p.height,
          name: p.name,
          ic_passport_number: p.ic_passport_number,
          country_of_origin: p.country_of_origin,
          gender: p.gender,
          id_front_url: frontUrl, 
          id_back_url: backUrl
        };
      }));

      const { error: passengersError } = await supabase
        .from('booking_passengers')
        .insert(passengersWithUploadedIds);

      if (passengersError) throw new Error(`Adding passengers failed: ${passengersError.message}`);

      // 4. Handle Payment based on Method
      if (paymentMethod === 'qr') {
        // Handle QR Payment (Upload Proofs)
        if (paymentProof.length > 0) {
          try {
            const uploadedUrls: string[] = [];
            
            for (let i = 0; i < paymentProof.length; i++) {
              const file = paymentProof[i];
              const compressedProof = await compressFile(file);
              const fileExt = compressedProof.name.split('.').pop();
              const fileName = `payment-proofs/${booking.booking_id}_${i}.${fileExt}`;
              
              const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(fileName, compressedProof);
              
              if (uploadError) throw new Error(`Proof upload failed for file ${i + 1}: ${uploadError.message}`);

              const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(fileName);
                
              uploadedUrls.push(publicUrl);
            }

            // Use RPC to bypass RLS and handle status update securely
            // Fallback to direct update if RPC fails
            const { error: updateError } = await supabase.rpc('submit_payment_proof', {
              p_booking_id: booking.booking_id,
              p_proof_url: uploadedUrls[0] || '' // Fallback for single field
            });

            if (updateError) {
              console.warn("RPC submit_payment_proof failed, trying direct update fallback:", updateError.message);
              // Fallback to direct update using booking_id (primary key)
              const { error: directUpdateError } = await supabase
                .from('bookings')
                .update({ 
                  payment_proof_url: uploadedUrls[0] || '',
                  payment_proof_urls: uploadedUrls,
                  payment_status: 'pending_verification',
                  status: 'pending_verification'
                })
                .eq('booking_id', booking.booking_id);
                
              if (directUpdateError) {
                console.error("Direct update fallback also failed:", directUpdateError);
                throw new Error(`Failed to update booking status: ${directUpdateError.message}`);
              }
            } else {
              // Even if RPC succeeds, we still want to update payment_proof_urls as JSONB
              await supabase
                .from('bookings')
                .update({ 
                  payment_proof_urls: uploadedUrls
                })
                .eq('booking_id', booking.booking_id);
            }
          } catch (error: any) {
             console.error("Payment proof processing error:", error);
             toast.error(`Failed to upload payment proof: ${error.message}`);
             throw error; 
          }
        }

        try {
          await notificationService.sendPendingApprovalNotifications(booking.booking_id);
        } catch (e) {
          console.error("Failed to send frontend notifications:", e);
        }

        toast.success("Booking submitted successfully! We will verify your payment shortly.");
        resetToSelectFlight();
        setIsProcessing(false);
        return;
      }

      // Handle Online Payment (CHIP)
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('chip-payment-initiate', {
        body: { 
          booking_id: booking.booking_id,
          payment_type: paymentType 
        }
      });

      if (paymentError) {
        console.error("Payment initiation failed:", paymentError);
        throw new Error(`Payment initiation failed: ${paymentError.message}`);
      }

      if (paymentData?.checkout_url) {
        window.location.href = paymentData.checkout_url;
      } else {
         throw new Error("No checkout URL returned from payment gateway.");
      }

    } catch (error: any) {
      console.error('Payment processing error:', error);
      toast.error(error.message || "An error occurred during payment processing.");
      setIsProcessing(false);
    }
  };

  const currentStageIndex = uniqueSortOrders.indexOf(currentSortOrder) + 1;

  return (
    <div 
      id="booking" 
      className="relative overflow-hidden pb-10 md:pb-16"
      style={siteSettings.bg_gradient_booking ? { background: siteSettings.bg_gradient_booking } : { background: "#06091a" }}
      ref={topRef}
    >
      {/* Background Layer */}
      <div 
        className="absolute inset-0 z-[-1]"
        style={siteSettings.bg_gradient_booking_wizard ? { background: siteSettings.bg_gradient_booking_wizard } : {}}
      />
      <BackgroundParticles 
        variant="dark" 
        isPaused={isProcessing || !!cameraOpen || !!uploadMethodSelector || isReviewOpen} 
      />
      <div className="absolute top-0 right-0 h-px w-1/3 bg-gradient-to-l from-[#ea580c] to-transparent" />
      <div className="absolute bottom-0 left-0 h-px w-1/2 bg-gradient-to-r from-[#ea580c] via-[#facc15]/50 to-transparent" />
      {/* Wizard Header / Progress Bar */}
      <div 
        className="sticky top-0 z-30 relative overflow-hidden border-b border-white/10 py-6 text-white shadow-[0_18px_55px_-30px_rgba(0,0,0,0.95)] backdrop-blur-md"
        style={siteSettings.bg_gradient_booking_wizard ? { background: siteSettings.bg_gradient_booking_wizard } : { backgroundColor: '#0f172a' }}
      >
        <BackgroundParticles />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <h1 
              className="mb-6 text-center text-3xl uppercase leading-none text-white md:text-5xl"
              style={{
                color: settingsStyles.booking_title?.color,
                fontSize: settingsStyles.booking_title?.fontSize,
                fontWeight: settingsStyles.booking_title?.fontWeight,
                fontStyle: settingsStyles.booking_title?.fontStyle,
                fontFamily: "'Bebas Neue', sans-serif",
                letterSpacing: "0.05em",
                textShadow: "0 8px 24px rgba(0,0,0,0.45)",
              }}
            >
              {siteSettings.booking_title || 'Book Your Flight Experience'}
            </h1>
            
            <div className="relative flex justify-between items-center max-w-2xl mx-auto">
              {/* Progress Line */}
              <div className="absolute top-1/2 left-0 h-1 w-full -z-0 bg-white/10"></div>
              <div 
                className="absolute top-1/2 left-0 h-1 -z-0 bg-[#ea580c] transition-all duration-500"
                style={{ width: `${((step - 1) / 2) * 100}%` }}
              ></div>

              {/* Step 1 */}
              <div className={`relative z-10 flex flex-col items-center gap-2 ${step >= 1 ? 'text-[#ea580c]' : 'text-white/45'}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${step >= 1 ? 'border-[#ea580c] bg-[#08101f]' : 'border-white/15 bg-white/5'} ${step === 1 ? 'scale-110 animate-pulse shadow-[0_0_20px_rgba(234,88,12,0.55)]' : ''}`}>
                  <Plane className="w-5 h-5" />
                </div>
                <span className={`hidden text-[10px] font-black uppercase tracking-[0.24em] md:block ${step === 1 ? 'drop-shadow-[0_0_10px_rgba(234,88,12,0.55)]' : ''}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Select Flight</span>
              </div>

              {/* Step 2 */}
              <div className={`relative z-10 flex flex-col items-center gap-2 ${step >= 2 ? 'text-[#ea580c]' : 'text-white/45'}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${step >= 2 ? 'border-[#ea580c] bg-[#08101f]' : 'border-white/15 bg-white/5'} ${step === 2 ? 'scale-110 animate-pulse shadow-[0_0_20px_rgba(234,88,12,0.55)]' : ''}`}>
                  <ListPlus className="w-5 h-5" />
                </div>
                <span className={`hidden text-[10px] font-black uppercase tracking-[0.24em] md:block ${step === 2 ? 'drop-shadow-[0_0_10px_rgba(234,88,12,0.55)]' : ''}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Customise</span>
              </div>

              {/* Step 3 */}
              <div className={`relative z-10 flex flex-col items-center gap-2 ${step >= 3 ? 'text-[#ea580c]' : 'text-white/45'}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${step >= 3 ? 'border-[#ea580c] bg-[#08101f]' : 'border-white/15 bg-white/5'} ${step === 3 ? 'scale-110 animate-pulse shadow-[0_0_20px_rgba(234,88,12,0.55)]' : ''}`}>
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className={`hidden text-[10px] font-black uppercase tracking-[0.24em] md:block ${step === 3 ? 'drop-shadow-[0_0_10px_rgba(234,88,12,0.55)]' : ''}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Checkout</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-2 md:px-4 py-1 md:py-2">
        <div className="mx-auto max-w-6xl overflow-hidden border border-white/10 bg-white/[0.04] p-3 shadow-[0_28px_90px_-35px_rgba(0,0,0,0.95)] backdrop-blur-md md:rounded-[2rem] md:p-6 lg:p-8">
          
          {/* Step 1 Content: Flight Packages */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <FlightPackagesSection 
                 hidePadding={true} 
                 showTitle={false}
                 onSelect={() => setHasInteracted(true)} 
                 onCategorySelect={(catId, sortOrder) => {
                   setSelectedCategoryId(catId);
                   setCurrentSortOrder(sortOrder);
                 }}
                 onPackageSelect={(catId, sortOrder, pkgId) => nextStep(false, catId, sortOrder, pkgId)}
                 sortOrder={currentSortOrder}
                 categoryId={selectedCategoryId}
               />
            </div>
          )}

          {/* Step 2 Content: Add-ons & Passenger Details */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* 
                If currentSortOrder > 0, it means we are in the sequential package selection phase.
                We reuse FlightPackagesSection but filter by the selected category and current sort order.
              */}
              {currentSortOrder > 0 ? (
                <div className="space-y-8">
                  <FlightPackagesSection 
                    hidePadding={true} 
                    onSelect={() => setHasInteracted(true)} 
                    sortOrder={currentSortOrder}
                    categoryId={selectedCategoryId}
                    buttonText="Add to Trip"
                    isCompact={true}
                  />

                  <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/10 pt-8">
                    <Button 
                      type="button"
                      onClick={resetToSelectFlight} 
                      className="h-12 border border-[#ea580c]/35 bg-[#ea580c]/10 px-6 text-[#ea580c] transition-all hover:bg-[#ea580c] hover:text-white"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))" }}
                    >
                      Back to Select Flight
                    </Button>
                    <Button 
                      type="button"
                      onClick={() => nextStep()} 
                      className="h-12 rounded-none px-10 text-white shadow-[0_18px_50px_-18px_rgba(234,88,12,0.6)] transition-all"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "#ea580c", clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))" }}
                    >
                      Next
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
                  <div className="text-center">
                    <h2 className="text-4xl uppercase leading-none text-white md:text-5xl" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>Passenger Details</h2>
                    <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/65" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Almost done! Please provide details for all passengers.</p>
                  </div>

                  <Card className="overflow-hidden border border-white/10 bg-[#08101f] shadow-[0_24px_70px_-30px_rgba(0,0,0,0.9)]">
                    <CardHeader className="relative overflow-hidden border-b border-white/10 bg-[#0b1327] text-white">
                      <BackgroundParticles />
                      <CardTitle className="flex items-center gap-2 text-xl relative z-10">
                        <Users className="w-5 h-5 text-[#ea580c]" />
                        Passenger Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="bg-transparent p-6">
                        <form id="passenger-details-form" className="space-y-6" onSubmit={(e) => { e.preventDefault(); nextStep(); }}>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
                          <div>
                            <h3 className="font-bold text-xl text-slate-900">Who is flying?</h3>
                            <p className="text-sm text-slate-500">Add details for all passengers (Max 3)</p>
                          </div>
                          <Button 
                            type="button"
                            onClick={addPassenger} 
                            disabled={passengers.length >= 3} 
                            variant="secondary" 
                            className="w-full sm:w-auto border-slate-200 shadow-sm font-bold"
                          >
                            + Add Passenger
                          </Button>
                        </div>

                        <div className="grid gap-6">
                          {passengers.map((p, index) => {
                            const bgColors = ["bg-white/[0.03]", "bg-[#0c152b]", "bg-[#111d39]"];
                            const bgColor = bgColors[index % bgColors.length];
                            
                            return (
                              <div key={p.id} className="space-y-6">
                                  <div className={`space-y-4 border border-white/10 p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.85)] ${bgColor}`}>
                                <div className="flex flex-col sm:grid sm:grid-cols-12 gap-4 items-end">
                                  <div className="w-full sm:col-span-12 space-y-2">
                                  <Label className="font-bold text-white/80">Full Name</Label>
                                  <Input 
                                    name={`passenger_${index}_name`}
                                    autoComplete="name"
                                    placeholder="Full Name as per ID/Passport" 
                                    className="h-11 border-white/15 bg-white/[0.04] text-white"
                                    value={p.name || ''}
                                    onChange={(e) => updatePassenger(p.id, 'name', e.target.value)}
                                  />
                                </div>
                                <div className="w-full sm:col-span-6 space-y-2">
                                  <Label className="font-bold text-white/80">IC / Passport Number</Label>
                                  <Input 
                                    name={`passenger_${index}_ic`}
                                    autoComplete="on"
                                    placeholder="IC or Passport Number" 
                                    className="h-11 border-white/15 bg-white/[0.04] text-white"
                                    value={p.ic_passport_number || ''}
                                    onChange={(e) => updatePassenger(p.id, 'ic_passport_number', e.target.value)}
                                  />
                                </div>
                                <div className="w-full sm:col-span-6 space-y-2">
                                  <Label className="font-bold text-white/80">Country of Origin</Label>
                                  <Select 
                                    value={p.country_of_origin || ''} 
                                    onValueChange={(value) => updatePassenger(p.id, 'country_of_origin', value)}
                                  >
                                    <SelectTrigger className="h-11 border-white/15 bg-white/[0.04] text-white">
                                      <SelectValue placeholder="Select Country" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {COUNTRIES.map((country) => (
                                        <SelectItem key={country} value={country}>
                                          {country}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="w-full sm:col-span-4 space-y-2">
                                  <Label className="font-bold text-white/80">Gender</Label>
                                  <select 
                                    name={`passenger_${index}_gender`}
                                    autoComplete="sex"
                                    className="flex h-11 w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={p.gender || ''}
                                    onChange={(e) => updatePassenger(p.id, 'gender', e.target.value)}
                                  >
                                    <option value="" disabled>Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                  </select>
                                </div>

                                <div className="w-full sm:col-span-4 space-y-2">
                                  <Label className="font-bold text-white/80">Passenger Type</Label>
                                  <select 
                                    name={`passenger_${index}_type`}
                                    autoComplete="off"
                                    className="flex h-11 w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={p.type}
                                    onChange={(e) => updatePassenger(p.id, 'type', e.target.value as Passenger['type'])}
                                  >
                                    <option value="adult">Adult</option>
                                    <option value="kid">Child (6+)</option>
                                  </select>
                                </div>
                                <div className="w-full sm:col-span-2 space-y-2">
                                  <Label className="flex items-center gap-1 font-bold text-white/80"><Scale className="w-3 h-3" /> Weight (kg)</Label>
                                  <Input 
                                    name={`passenger_${index}_weight`}
                                    autoComplete="on"
                                    type="number" 
                                    placeholder="e.g. 70" 
                                    className="h-11 border-white/15 bg-white/[0.04] text-white"
                                    value={p.weight || ''}
                                    onChange={(e) => updatePassenger(p.id, 'weight', parseFloat(e.target.value))}
                                  />
                                </div>
                                <div className="w-full sm:col-span-2 space-y-2">
                                  <Label className="flex items-center gap-1 font-bold text-white/80"><Ruler className="w-3 h-3" /> Height (cm)</Label>
                                  <Input 
                                    name={`passenger_${index}_height`}
                                    autoComplete="on"
                                    type="number" 
                                    placeholder="e.g. 170" 
                                    className="h-11 border-white/15 bg-white/[0.04] text-white"
                                    value={p.height || ''}
                                    onChange={(e) => updatePassenger(p.id, 'height', parseFloat(e.target.value))}
                                  />
                                </div>
                                <div className="w-full sm:col-span-2 flex justify-end">
                                  {passengers.length > 1 && (
                                    <Button type="button" variant="destructive" size="icon" onClick={() => removePassenger(p.id)} className="w-full h-11">
                                      <span className="font-bold text-lg sm:hidden mr-2">Remove</span>
                                      <span className="font-bold text-xl">×</span>
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* ID Documents */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
                                <div className="space-y-2">
                                  <Label className="font-bold text-slate-700 flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> ID Document (Front)</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Max 1MB</span>
                                  </Label>
                                  <div className="relative">
                                    <input 
                                      type="file" 
                                      id={`p-${p.id}-front`} 
                                      className="hidden" 
                                      accept="image/*"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          if (file.size > 1 * 1024 * 1024) { // 1MB limit
                                            toast.error("File is too large. Max 1MB allowed.");
                                            return;
                                          }
                                          try {
                                            const { url, file: watermarkedFile } = await applyWatermark(file);
                                            // Revoke old URL if it exists to prevent memory leaks
                                            if (p.id_front && p.id_front.startsWith('blob:')) {
                                              URL.revokeObjectURL(p.id_front);
                                            }
                                            updatePassenger(p.id, 'id_front', url);
                                            updatePassenger(p.id, 'id_front_file', watermarkedFile);
                                          } catch (error) {
                                            console.error("Watermark error:", error);
                                            toast.error("Failed to process image");
                                          }
                                        }
                                      }}
                                    />
                                    
                                    {p.id_front ? (
                                      <label 
                                        htmlFor={`p-${p.id}-front`}
                                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors overflow-hidden bg-white group"
                                      >
                                        <div className="relative w-full h-full">
                                          <img src={p.id_front} alt="ID Front" className="w-full h-full object-cover" />
                                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-white font-bold text-sm bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">Change</span>
                                          </div>
                                        </div>
                                      </label>
                                    ) : (
                                      <Button 
                                        type="button"
                                        variant="outline" 
                                        className="w-full h-24 border-2 border-dashed border-slate-300 hover:border-primary hover:bg-primary/5 group transition-all rounded-xl"
                                        onClick={() => setUploadMethodSelector({ passengerId: p.id, side: 'front' })}
                                      >
                                        <div className="flex flex-col items-center gap-2">
                                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                            <ImageIcon className="w-5 h-5 text-slate-500 group-hover:text-primary" />
                                          </div>
                                          <div className="text-center">
                                            <p className="text-sm font-extrabold text-slate-800 group-hover:text-primary transition-colors">Upload Front ID</p>
                                            <p className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">Camera or Local Storage</p>
                                          </div>
                                        </div>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="font-bold text-slate-700 flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> ID Document (Back)</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Max 1MB</span>
                                  </Label>
                                  <div className="relative">
                                    <input 
                                      type="file" 
                                      id={`p-${p.id}-back`} 
                                      className="hidden" 
                                      accept="image/*"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          if (file.size > 1 * 1024 * 1024) { // 1MB limit
                                            toast.error("File is too large. Max 1MB allowed.");
                                            return;
                                          }
                                          try {
                                            const { url, file: watermarkedFile } = await applyWatermark(file);
                                            // Revoke old URL if it exists to prevent memory leaks
                                            if (p.id_back && p.id_back.startsWith('blob:')) {
                                              URL.revokeObjectURL(p.id_back);
                                            }
                                            updatePassenger(p.id, 'id_back', url);
                                            updatePassenger(p.id, 'id_back_file', watermarkedFile);
                                          } catch (error) {
                                            console.error("Watermark error:", error);
                                            toast.error("Failed to process image");
                                          }
                                        }
                                      }}
                                    />
                                    
                                    {p.id_back ? (
                                      <label 
                                        htmlFor={`p-${p.id}-back`}
                                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors overflow-hidden bg-white group"
                                      >
                                        <div className="relative w-full h-full">
                                          <img src={p.id_back} alt="ID Back" className="w-full h-full object-cover" />
                                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-white font-bold text-sm bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">Change</span>
                                          </div>
                                        </div>
                                      </label>
                                    ) : (
                                      <Button 
                                        type="button"
                                        variant="outline" 
                                        className="w-full h-24 border-2 border-dashed border-slate-300 hover:border-primary hover:bg-primary/5 group transition-all rounded-xl"
                                        onClick={() => setUploadMethodSelector({ passengerId: p.id, side: 'back' })}
                                      >
                                        <div className="flex flex-col items-center gap-2">
                                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                            <ImageIcon className="w-5 h-5 text-slate-500 group-hover:text-primary" />
                                          </div>
                                          <div className="text-center">
                                            <p className="text-sm font-extrabold text-slate-800 group-hover:text-primary transition-colors">Upload Back ID</p>
                                            <p className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">Camera or Local Storage</p>
                                          </div>
                                        </div>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <hr className="border-slate-900 border-2" />
                          </div>
                          );
                        })}
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900 space-y-2">
                          <p className="font-bold flex items-center gap-2 text-amber-800">
                            <Scale className="w-4 h-4" /> Safety Regulations:
                          </p>
                          <ul className="list-disc pl-5 space-y-1 opacity-90 font-medium">
                            <li>Maximum weight per passenger: {safetySettings.safety_max_weight_per_pax || '120'}kg</li>
                            <li>Combined weight limit: 2 pax &lt; {safetySettings.safety_combined_weight_2pax || '160'}kg, 3 pax &lt; {safetySettings.safety_combined_weight_3pax || '200'}kg</li>
                            <li>Height requirement: {safetySettings.safety_min_height || '150'}cm - {safetySettings.safety_max_height || '180'}cm</li>
                            <li>Total weight (excluding pilot) must be below {safetySettings.safety_total_weight_limit || '200'}kg</li>
                          </ul>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-8 pt-8 border-t">
                    <Button 
                      type="button"
                      variant="secondary" 
                      onClick={resetToSelectFlight}
                      className="w-full md:w-auto gap-2 bg-[#EAB308] hover:bg-[#D9A306] text-slate-900 font-bold order-2 md:order-1 h-12 px-6 shadow-md transition-all border-slate-200"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back to Select Flight
                    </Button>
                    <Button 
                      form="passenger-details-form"
                      type="submit"
                      className="w-full md:w-auto gap-2 bg-primary hover:bg-primary/90 text-white px-10 h-12 text-lg font-bold order-1 md:order-2 shadow-xl transition-all hover:scale-105"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-4xl uppercase leading-none text-white md:text-5xl" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>Checkout</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
                {/* Contact Form */}
                <div className="lg:col-span-7">
                  <Card className="overflow-hidden border border-white/10 bg-[#08101f] shadow-[0_24px_70px_-30px_rgba(0,0,0,0.9)]">
                    <CardHeader className="border-b border-white/10 bg-[#0b1327] py-4 md:py-5">
                      <CardTitle className="text-xl uppercase text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>Contact Details</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-4 md:p-6 md:pt-6">
                      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-white/60 md:text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Please provide your contact information to receive booking confirmation.</p>
                      <form id="checkout-form" onSubmit={handlePayment} className="space-y-4 md:space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-bold text-white/80">Full Name</Label>
                            <Input id="name" name="name" required placeholder="John Doe" className="h-11 border-white/15 bg-white/[0.04] text-base text-white placeholder:text-white/30" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-bold text-white/80">Email</Label>
                            <Input id="email" name="email" type="email" required placeholder="john@example.com" className="h-11 border-white/15 bg-white/[0.04] text-base text-white placeholder:text-white/30" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="phone" className="text-sm font-bold text-white/80">Phone Number</Label>
                            <Input id="phone" name="phone" type="tel" required placeholder="+60 12 345 6789" className="h-11 border-white/15 bg-white/[0.04] text-base text-white placeholder:text-white/30" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="date" className="text-sm font-bold text-white/80">Preferred Flight Date</Label>
                            <Input 
                              id="date" 
                              name="date" 
                              type="date" 
                              required 
                              min={today}
                              className="h-11 border-white/15 bg-white/[0.04] text-base text-white" 
                              onChange={(e) => setSelectedDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="time" className="text-sm font-bold text-white/80 flex items-center gap-1">
                              <ClockIcon className="w-3 h-3" /> Preferred Time
                            </Label>
                            <Select value={selectedTime} onValueChange={setSelectedTime} required>
                              <SelectTrigger className="h-11 border-white/15 bg-white/[0.04] text-base text-white">
                                <SelectValue placeholder="Select time" />
                              </SelectTrigger>
                              <SelectContent>
                                {timeSlots.map((time) => {
                                  const isBlocked = blockedTimes.includes(time);
                                  const isInPast = isTimeInPast(time);
                                  const isDisabled = isBlocked || isInPast;
                                  
                                  return (
                                    <SelectItem key={time} value={time} disabled={isDisabled}>
                                      {time} {isBlocked ? '(Booked)' : isInPast ? '(Unavailable)' : ''}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="notes" className="text-sm font-bold text-white/80">Special Requests (Optional)</Label>
                          <Input id="notes" name="notes" placeholder="Any dietary requirements or special occasions?" className="h-11 border-white/15 bg-white/[0.04] text-base text-white placeholder:text-white/30" />
                        </div>

                        {siteSettings.payment_qr_enabled === 'true' && (
                          <div className="space-y-4 border-t border-white/10 pt-4">
                            <Label className="text-sm font-bold text-white/80">Payment Method</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                              <div 
                                className={`flex cursor-pointer items-center gap-4 border p-3 transition-all md:p-4 ${paymentMethod === 'online' ? 'border-[#ea580c] bg-[#ea580c]/10 shadow-[0_0_0_1px_rgba(234,88,12,0.25)]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}
                                onClick={() => setPaymentMethod('online')}
                                style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))" }}
                              >
                                <div className={`shrink-0 rounded-lg p-2 ${paymentMethod === 'online' ? 'bg-[#ea580c] text-white' : 'bg-white/10 text-white/65'}`}>
                                  <CreditCard className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-sm font-bold text-white md:text-base">Online Banking</span>
                                  <p className="mt-0.5 text-[10px] font-medium leading-tight text-white/55 md:text-xs">Secure FPX payment</p>
                                </div>
                              </div>

                              <div 
                                className={`flex cursor-pointer items-center gap-4 border p-3 transition-all md:p-4 ${paymentMethod === 'qr' ? 'border-[#ea580c] bg-[#ea580c]/10 shadow-[0_0_0_1px_rgba(234,88,12,0.25)]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}
                                onClick={() => setPaymentMethod('qr')}
                                style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))" }}
                              >
                                <div className={`shrink-0 rounded-lg p-2 ${paymentMethod === 'qr' ? 'bg-[#ea580c] text-white' : 'bg-white/10 text-white/65'}`}>
                                  <QrCode className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-sm font-bold text-white md:text-base">QR Pay</span>
                                  <p className="mt-0.5 text-[10px] font-medium leading-tight text-white/55 md:text-xs">DuitNow QR / Manual</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {paymentMethod === 'qr' && (
                          <div className="animate-in zoom-in-95 space-y-6 border border-white/10 bg-white/[0.03] p-4 duration-300 md:p-8">
                            <div className="text-center space-y-2 md:space-y-3">
                              <h3 className="text-2xl uppercase text-white md:text-3xl" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>Scan to Pay</h3>
                              <p className="mx-auto max-w-xs text-xs font-medium text-white/65 md:text-sm">Please scan the QR code below using your banking app to complete the payment.</p>
                            </div>
                            
                            {siteSettings.payment_qr_code_url && (
                              <div className="flex justify-center">
                                <div className="group relative w-full max-w-full overflow-hidden border border-white/10 bg-[#0b1327] p-2 shadow-xl md:max-w-lg md:p-6 md:shadow-2xl">
                                   <div className="absolute inset-0 bg-gradient-to-br from-[#ea580c]/10 to-transparent opacity-50"></div>
                                   <img 
                                    src={siteSettings.payment_qr_code_url} 
                                    alt="Payment QR" 
                                    className="w-full aspect-square object-contain mx-auto relative z-10 transform transition-transform duration-500 group-hover:scale-110"
                                    style={{ maxWidth: '100%' }}
                                   />
                                   <div className="relative z-10 mt-2 border-t border-white/10 pt-2 text-center md:mt-4 md:pt-4">
                                     <p className="animate-pulse text-[12px] font-black uppercase tracking-[0.2em] text-[#ea580c] md:text-[14px]">Scan to Pay Now</p>
                                     <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-white/60 md:text-[12px]">Official DuitNow QR</p>
                                   </div>
                                </div>
                              </div>
                            )}

                            <div className="overflow-hidden border border-white/10 bg-[#0b1327] divide-y divide-white/10">
                              <div className="flex justify-between p-3 md:p-4 items-center">
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-tight text-white/60">Bank Name</span>
                                <span className="text-sm font-bold text-white md:text-base">{siteSettings.payment_bank_name}</span>
                              </div>
                              <div className="flex justify-between p-3 md:p-4 items-center">
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-tight text-white/60">Account Name</span>
                                <span className="text-sm font-bold text-white md:text-base">{siteSettings.payment_account_name}</span>
                              </div>
                              <div className="flex justify-between p-3 md:p-4 items-center">
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-tight text-white/60">Account Number</span>
                                <span className="text-sm font-mono font-bold text-white md:text-base">{siteSettings.payment_account_number}</span>
                              </div>
                              <div className="flex items-center justify-between bg-[#ea580c]/10 p-3 md:p-4">
                                <span className="text-[10px] font-black uppercase tracking-tight text-[#ea580c] md:text-xs">Total Amount</span>
                                <span className="text-lg font-black text-[#ea580c] md:text-xl">RM {currentTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>

                                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <Input 
                                      id="payment-proof"
                                      name="payment-proof"
                                      type="file" 
                                      accept="image/*,application/pdf" 
                                      multiple
                                      onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        if (files.length > 0) {
                                          const validFiles: File[] = [];
                                          for (const file of files) {
                                            const isImage = file.type.startsWith('image/');
                                            const limit = isImage ? 1 * 1024 * 1024 : 5 * 1024 * 1024;
                                            const limitLabel = isImage ? "1MB" : "5MB";

                                            if (file.size > limit) {
                                              toast.error(`File ${file.name} is too large. Max ${limitLabel} allowed.`);
                                              continue;
                                            }
                                            validFiles.push(file);
                                          }
                                          setPaymentProof(prev => [...prev, ...validFiles]);
                                          // Clear input so same file can be selected again
                                          e.target.value = '';
                                        }
                                      }}
                                      className="hidden"
                                    />
                                    <Label
                                      htmlFor="payment-proof"
                                      className="inline-flex w-full cursor-pointer items-center justify-center rounded-none border border-[#ea580c] bg-[#ea580c] px-4 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-white shadow-[0_18px_50px_-18px_rgba(234,88,12,0.6)] transition-all hover:brightness-110 md:w-auto md:text-sm"
                                      style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))", animationDuration: '1.8s' }}
                                    >
                                      Upload receipt
                                    </Label>
                                    <div className="flex flex-col gap-1 w-full mt-2">
                                      {paymentProof.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between gap-2 border border-white/10 bg-white/[0.04] p-2">
                                          <span className="max-w-[150px] truncate text-[10px] font-bold text-white/75 md:text-xs">
                                            {file.name}
                                          </span>
                                          <button 
                                            type="button"
                                            onClick={() => setPaymentProof(prev => prev.filter((_, i) => i !== idx))}
                                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                          </button>
                                        </div>
                                      ))}
                                      {paymentProof.length === 0 && (
                                        <span className="text-[10px] font-bold italic text-white/45 md:text-xs">
                                          No file chosen
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-[10px] font-bold text-white/60 md:text-xs">Please upload the transaction receipt as proof of payment. You can upload multiple files. (Max 1MB for images, 5MB for PDF)</p>
                          </div>
                        )}
                      </form>
                    </CardContent>
                  </Card>
                </div>

                {/* Summary */}
                <div className="lg:col-span-5">
                  <Card className="sticky overflow-hidden border border-white/10 bg-[#08101f] shadow-[0_24px_70px_-30px_rgba(0,0,0,0.9)] lg:top-32">
                    <CardHeader className="relative overflow-hidden bg-[#0b1327] py-3 text-white md:py-6">
                      <BackgroundParticles />
                      <CardTitle className="text-base md:text-xl flex items-center gap-2 relative z-10">
                        <ShoppingBagIcon className="w-5 h-5 text-[#ea580c]" />
                        Order Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6">
                      <div className="space-y-4 md:space-y-6">
                        <div className="max-h-[250px] md:max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {items.map((item) => {
                            const end = item.promotion_end_at ? new Date(item.promotion_end_at) : null;
                            let timeLeft = "";
                            if (end) {
                              const diff = end.getTime() - currentTime.getTime();
                              if (diff > 0) {
                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                const secs = Math.floor((diff % (1000 * 60)) / 1000);
                                timeLeft = `${hours}h ${mins}m ${secs}s`;
                              } else {
                                timeLeft = "Expired";
                              }
                            }

                            return (
                            <div key={item.id} className="mb-3 flex items-start justify-between border border-white/10 bg-white/[0.03] p-3 md:mb-4 md:p-4 last:mb-0">
                              <div className="space-y-0.5 md:space-y-1 pr-4">
                                <h4 className="text-xs font-bold leading-tight text-white md:text-base">{item.name}</h4>
                                <div className="flex items-center gap-2">
                                  <span className="bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-white/70 md:px-2 md:text-[10px]">Qty: {item.quantity}</span>
                                </div>
                                {timeLeft && (
                                  <div className="text-[11px] md:text-xs font-bold text-red-600 animate-pulse mt-1">
                                    Ends in: {timeLeft}
                                  </div>
                                )}
                              </div>
                              <div className="text-right min-w-[80px] md:min-w-[100px]">
                                {Number(item.original_price) > Number(item.price) && (
                                  <p className="text-[10px] md:text-xs text-muted-foreground line-through decoration-red-500 decoration-2">
                                    RM {(Number(item.original_price) * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </p>
                                )}
                                <p className="text-xs font-black text-white md:text-base">RM {(Number(item.price) * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                        
                        <div className="space-y-3 border border-white/10 bg-white/[0.03] p-3 pt-4 md:space-y-4 md:p-5">
                          {/* Payment Type Selection */}
                          {hasDepositOption && (
                            <div className="space-y-3 pb-3 border-b border-slate-200">
                              <span className="block text-[10px] font-black uppercase tracking-widest text-white/65 md:text-xs">Payment Option</span>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPaymentType('full')}
                                  className={`flex flex-col items-center justify-center border p-2 transition-all ${
                                    paymentType === 'full' 
                                      ? 'border-[#ea580c] bg-[#ea580c]/10' 
                                      : 'border-white/10 bg-white/[0.04] hover:border-white/20'
                                  }`}
                                  style={{ clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))" }}
                                >
                                  <span className={`text-[10px] font-bold md:text-xs ${paymentType === 'full' ? 'text-[#ea580c]' : 'text-white/70'}`}>Full Payment</span>
                                  <span className={`text-[9px] font-black md:text-[10px] ${paymentType === 'full' ? 'text-[#ea580c]/75' : 'text-white/45'}`}>RM {total.toLocaleString()}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPaymentType('deposit')}
                                  className={`flex flex-col items-center justify-center border p-2 transition-all ${
                                    paymentType === 'deposit' 
                                      ? 'border-[#ea580c] bg-[#ea580c]/10' 
                                      : 'border-white/10 bg-white/[0.04] hover:border-white/20'
                                  }`}
                                  style={{ clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))" }}
                                >
                                  <span className={`text-[10px] font-bold md:text-xs ${paymentType === 'deposit' ? 'text-[#ea580c]' : 'text-white/70'}`}>Pay Deposit</span>
                                  <span className={`text-[9px] font-black md:text-[10px] ${paymentType === 'deposit' ? 'text-[#ea580c]/75' : 'text-white/45'}`}>RM {depositAmount.toLocaleString()}</span>
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs font-bold text-white/70 md:text-sm">
                            <span className="font-bold">Subtotal</span>
                            <span className="font-black text-white">RM {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          
                          {paymentType === 'deposit' && (
                            <div className="flex items-center justify-between text-xs font-bold text-[#ea580c] md:text-sm">
                              <span className="font-bold">Deposit Only</span>
                              <span className="font-black">RM {depositAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between border-t border-white/10 pt-3 text-lg font-black text-white md:pt-4 md:text-2xl">
                            <span>Total Payable</span>
                            <span className="text-[#ea580c]">RM {currentTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        <div className="pt-2 space-y-3 md:space-y-4">
                          <Button 
                            type="submit" 
                            form="checkout-form" 
                            className="w-full rounded-none py-6 text-base font-black uppercase tracking-[0.2em] text-white shadow-[0_18px_50px_-18px_rgba(234,88,12,0.6)] transition-all hover:scale-[1.02] active:scale-[0.98] md:py-7 md:text-lg" 
                            size="lg"
                            disabled={isProcessing}
                            style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "#ea580c", clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))" }}
                          >
                            {isProcessing ? (
                              <div className="flex items-center gap-3">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Processing...</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {paymentMethod === 'qr' ? "Submit Booking" : "Proceed to Payment"}
                                <ChevronRight className="w-5 h-5" />
                              </div>
                            )}
                          </Button>
                          <div className="flex flex-col items-center gap-2 pt-2">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white md:text-xs">
                              <ShieldCheck className="w-4 h-4 text-[#ea580c]" />
                              Secure & Encrypted Checkout
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-white/65">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#ea580c] animate-pulse"></span>
                              {paymentMethod === 'qr' ? "Manual Verification" : "Instant Verification"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

                <Button 
                  type="button"
                  variant="secondary" 
                  onClick={prevStep} 
                  className="gap-2 border border-[#ea580c]/35 bg-[#ea580c]/10 font-bold text-[#ea580c] shadow-sm hover:bg-[#ea580c] hover:text-white"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))" }}
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Details
                </Button>
            </div>
          )}
        </div>
      </div>

      {/* Camera Modal */}
      <Dialog open={!!cameraOpen} onOpenChange={() => setCameraOpen(null)}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-black border-none">
          <DialogHeader className="p-4 bg-slate-900 text-white flex-row items-center justify-between space-y-0 relative overflow-hidden">
            <BackgroundParticles />
            <div className="relative z-10">
              <DialogTitle className="text-lg font-bold">
                {cameraOpen?.side === 'front' ? 'ID Front' : 'ID Back'} Capture
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Align your Malaysia NRIC within the frame
              </DialogDescription>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setCameraOpen(null)}
              className="text-white hover:bg-white/10 relative z-10"
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogHeader>
          <div className="p-4 bg-black">
            {cameraOpen && (
              <CameraCapture 
                isFront={cameraOpen.side === 'front'}
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
          <DialogHeader className="p-6 bg-slate-900 text-white relative overflow-hidden">
            <BackgroundParticles />
            <div className="relative z-10">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" />
                Upload ID {uploadMethodSelector?.side === 'front' ? '(Front)' : '(Back)'}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
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
                  const inputId = `p-${uploadMethodSelector.passengerId}-${uploadMethodSelector.side}`;
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
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
            <Button type="button" variant="ghost" onClick={() => setUploadMethodSelector(null)} className="text-slate-500 font-bold">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showWhatsAppSupport} onOpenChange={setShowWhatsAppSupport}>
        <DialogContent className="sm:max-w-md bg-white border-2 border-black shadow-2xl rounded-3xl overflow-hidden p-0">
          <div className="bg-red-500 h-2 w-full" />
          <div className="p-6 md:p-8 space-y-6">
            <DialogHeader className="space-y-3">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2">
                <MessageSquare className="w-8 h-8 text-red-500 animate-pulse" />
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

      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[500px] max-h-[92vh] overflow-hidden p-0 rounded-2xl sm:rounded-3xl border-none shadow-2xl flex flex-col">
          <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-black p-4 sm:p-6 flex items-center justify-between shrink-0">
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
              <div className="bg-slate-50/80 p-4 sm:p-6 rounded-2xl border border-black shadow-inner">
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
                  <div className="text-center py-12 px-4 bg-white/50 rounded-xl border border-dashed border-black">
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
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
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
                        className="w-full h-12 rounded-xl border-2 border-black bg-slate-50/50 px-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none cursor-pointer"
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
                      value={reviewForm.name}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, name: e.target.value }))}
                      className="h-12 rounded-xl border-2 border-black bg-slate-50/50 px-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Rating Experience</Label>
                  <div className="flex justify-between items-center bg-slate-50/80 p-4 rounded-2xl border border-black shadow-inner">
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
                    <span className="text-2xl font-black text-primary bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border border-black">
                      {reviewForm.rating}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Your Story</Label>
                  <Textarea 
                    placeholder="Tell us about your flight experience..." 
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                    className="min-h-[120px] rounded-2xl border-2 border-black bg-slate-50/50 p-4 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Visual Proof (Optional) - Max 1MB</Label>
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
                            // 1MB limit for images
                            if (file.size > 1 * 1024 * 1024) {
                              toast.error(`File ${file.name} is too large. Max 1MB allowed.`);
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
                      className="h-14 rounded-2xl border-2 border-dashed border-black bg-slate-50/30 px-4 py-3 text-xs font-bold file:bg-primary file:text-white file:border-none file:rounded-lg file:px-4 file:py-1 file:mr-4 file:hover:bg-primary/90 transition-all cursor-pointer group-hover:border-primary/50 group-hover:bg-primary/5"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ImageIcon className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-black">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
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
                              className="h-12 rounded-xl border-2 border-black bg-slate-50/50 px-4 pl-10 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all w-full"
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
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                          <div className="bg-primary/5 border border-black rounded-xl p-3 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                              <ClockIcon className="w-4 h-4 animate-pulse" />
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
                              value={otpInput}
                              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                              className="h-14 rounded-xl border-2 border-black bg-white text-center tracking-[0.5em] text-2xl font-black focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                            />
                            <Button 
                              type="button" 
                              variant="outline"
                              onClick={() => setIsVerifying(false)}
                              className="h-14 px-4 rounded-xl text-xs font-black border-2 border-black hover:bg-slate-50 hover:border-slate-200 transition-all"
                            >
                              EDIT
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border-2 border-black rounded-2xl p-4 flex items-center gap-4 text-emerald-700 animate-in zoom-in-95">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                        <Check className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">Identity Verified</p>
                        <p className="text-sm font-black">{phoneNumber}</p>
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
              className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/30 hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none group"
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
    </div>
  );
};
