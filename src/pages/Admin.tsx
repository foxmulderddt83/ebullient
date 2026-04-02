import { logActivity as logActivityUtil } from "@/lib/activityLogger";
import { BookingPDFGenerator } from "@/components/admin/BookingPDFGenerator";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import eventHero from "@/assets/event-hero.jpg";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { compressFile } from "@/utils/fileCompression";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { generateRegistrationPDF, generateTableHtml, TableData } from "@/lib/pdfGenerator";
import { DOCUMENT_TYPES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { 
  Tooltip, 
  TooltipTrigger, 
  TooltipContent, 
  TooltipProvider 
} from "@/components/ui/tooltip";
import { 
  ChevronUp,
  ChevronDown,
  Layers,
  Grid,
  FileBox,
  Monitor,
  GripVertical, 
  Pencil, 
  Trash2, 
  Plus, 
  LogOut, 
  FileText,
  CreditCard, 
  Image as ImageIcon, 
  Layout, 
  Star, 
  Image, 
  MessageSquare, 
  ArrowLeft,
  BarChart3,
  MessageCircle,
  BellRing,
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff,
  FileCheck,
  Printer,
  Tag,
  DollarSign,
  ShoppingBag as ShoppingBagIcon,
  Video,
  UserPlus,
  Users,
  ShieldCheck,
  QrCode,
  Scale,
  MapPin,
  Plane,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Globe,
  Search,
  Check,
  Mail,
  Phone,
  Save,
  RotateCcw, 
  RefreshCw,
  Upload, 
  Settings, 
  Clock, 
  X, 
  Activity, 
  Camera,
  Bold,
  Italic,
  Type,
  Quote,
  ArrowRightLeft,
  User,
  Settings2,
  Info,
  ClipboardList,
  FileSpreadsheet,
  DownloadCloud,
  Filter,
  Edit2,
  Banknote,
  Calendar as CalendarIcon,
  Loader2,
  Download
} from "lucide-react";
import * as XLSX from 'xlsx';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";

import { EventTemplateBuilder } from "@/components/admin/EventTemplateBuilder";
import { ScheduleBuilder } from "@/components/admin/ScheduleBuilder";
import { TimeSlotBuilder } from "@/components/admin/TimeSlotBuilder";
import { ImageUploader } from "@/components/admin/ImageUploader";
import DocumentTemplates from "@/components/admin/DocumentTemplates";
import { PolicyEditor } from "@/components/admin/PolicyEditor";
import EmailConfig from "@/components/admin/EmailConfig";
import WhatsAppConfig from "@/components/admin/WhatsAppConfig";
import BusinessHoursConfig from "@/components/admin/BusinessHoursConfig";
import WatermarkConfig from "@/components/admin/WatermarkConfig";
import FinancialAnalytics from "@/components/admin/FinancialAnalytics";
import NotificationLogs from "@/components/admin/NotificationLogs";
import ActivityLogs from "@/components/admin/ActivityLogs";
import { ContentList } from "@/components/admin/ContentList";

import { notificationService } from "@/lib/notificationService";

// Charts
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { WhatsAppConnector } from "@/components/WhatsAppConnector";
import { AboutPageEditor } from "@/components/admin/AboutPageEditor";
import { BackgroundParticles } from "@/components/ui/BackgroundParticles";

interface Event {
  id: string;
  name: string;
  event_date: string;
  event_time: string;
  event_id?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  created_by?: string;
  is_active: boolean;
  created_at: string;
  event_description?: string | null;
  event_program?: string | null;
  event_image_url?: string | null;
  sort_order?: number;
  price?: number | string | null;
  promotion_price?: number | string | null;
  promotion_start_at?: string | null;
  promotion_end_at?: string | null;
  event_profile_id?: string | null;
  payment_required?: boolean;
  enable_chip_payment?: boolean;
  enable_deposit?: boolean;
  payment_amount?: number;
  deposit_amount?: number;
  payment_description?: string;
}

interface Service {
  id: string;
  title: string;
  description: string;
  label?: string;
  image_url?: string;
  image_path?: string;
  order: number;
}

interface Review {
  id: string;
  service_id: string;
  customer_name: string;
  rating: number;
  comment: string;
  is_approved: boolean;
  created_at: string;
  image_urls?: string[];
  image_paths?: string[];
  service?: { title: string };
  phone_number?: string;
}

interface AnalyticsData {
  id: string;
  name: string;
  clicks: number;
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
  is_approved: boolean;
  created_at: string;
}

interface RolePermission {
  id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_edit: boolean;
}

interface Booking {
  booking_id: string;
  customer_id?: string;
  booking_reference: string;
  invoice_id?: string;
  total_amount: number;
  status: string;
  payment_status?: string;
  payment_method?: string;
  payment_gateway?: string;
  payment_type?: 'full' | 'deposit';
  deposit_amount?: number;
  discount_amount?: number;
  outstanding_balance?: number;
  paid_amount?: number;
  paid_at?: string;
  updated_at?: string;
  payment_id?: string;
  notes?: string;
  payment_proof_url?: string;
  payment_proof_urls?: string[];
  add_items_summary?: string;
  created_at: string;
  customer?: { name: string; email: string; phone?: string };
  flight_date?: string;
  flight_time?: string;
  flight_slot?: string;
  pilot_name?: string;
  aircraft_registration?: string;
  package_details?: any;
  booking_items?: {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    package?: { name: string; description: string };
  }[];
  booking_passengers?: {
    id: string;
    type: string;
    weight: number;
    height: number;
    name: string;
    ic_passport_number: string;
    country_of_origin: string;
    gender: string;
    id_front_url?: string;
    id_back_url?: string;
  }[];
}

interface Registration {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender?: string;
  age?: number;
  weight?: number;
  address?: string;
  selected_date?: string;
  selected_time_slot?: string;
  notes?: string;
  document_url?: string;
  nric_number?: string;
  nric_confirmed?: boolean;
  event_id: string;
  created_at: string;
  payment_status?: string;
  paid_amount?: number;
  payment_method?: string;
}

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  image_url?: string;
  image_path?: string;
  order: number;
}

interface Experience {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  image_path?: string;
  images?: string[];
  order: number;
}

interface Feature {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  image_url?: string;
  image_path?: string;
  text_color?: string;
  text_size?: string;
  icon_color?: string;
  icon_size?: string;
  order: number;
}

interface Video {
  id: string;
  title?: string;
  vimeo_url: string;
  vimeo_id?: string;
  order: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  is_main_page?: boolean;
  is_active?: boolean;
  offer_percentage?: number | string | null;
  offer_start?: string | null;
  offer_end?: string | null;
  offer_is_active?: boolean;
  offer_image_url?: string | null;
}

interface Package {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number | string;
  promotion_price?: number | string | null;
  promotion_start_at?: string | null;
  promotion_end_at?: string | null;
  image_url?: string;
  image_path?: string;
  is_active: boolean;
  sort_order: number;
  google_maps_link?: string | null;
}

type SortableItemData = Service | HeroSlide | Experience | Feature | Package | Category | Video | Event;
type EditingItem = Partial<Service & HeroSlide & Experience & Feature & Package & Category & Video & Event>;
type DeletableItem = SortableItemData & { image_path?: string };

interface SiteSetting {
  key: string;
  value: string;
  style?: any;
}

type SiteSettings = Record<string, string>;
type SiteSettingStyles = Record<string, any>;

const TextStyleEditor = ({ 
  label, 
  style, 
  onChange 
}: { 
  label: string, 
  style: any, 
  onChange: (newStyle: any) => void 
}) => {
  const fontSizes = [
    { name: 'Small', value: '0.875rem' },
    { name: 'Base', value: '1rem' },
    { name: 'Large', value: '1.125rem' },
    { name: 'XL', value: '1.25rem' },
    { name: '2XL', value: '1.5rem' },
    { name: '3XL', value: '1.875rem' },
    { name: '4XL', value: '2.25rem' },
    { name: '5XL', value: '3rem' },
  ];

  return (
    <div className="p-4 bg-white/50 backdrop-blur-md border border-black rounded-xl space-y-3 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-0.5 px-1">
        <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-primary">{label} Styling</span>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-2">Color Picker</label>
          <div className="flex items-center gap-3 bg-white/50 border border-black rounded-xl p-3 shadow-sm">
            <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md ring-1 ring-black/5 shrink-0 ml-1">
              <input 
                type="color" 
                value={style?.color || '#000000'} 
                onChange={(e) => onChange({ ...style, color: e.target.value })}
                className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer"
              />
            </div>
            <Input 
              value={style?.color || '#000000'} 
              onChange={(e) => onChange({ ...style, color: e.target.value })}
              className="h-12 border-none bg-transparent font-mono uppercase text-[11px] sm:text-xs px-2 focus-visible:ring-0 placeholder:text-slate-300 w-full font-bold text-slate-700"
              placeholder="#000000"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-2">Font Size</label>
            <Select 
              value={style?.fontSize || '1.5rem'} 
              onValueChange={(val) => onChange({ ...style, fontSize: val })}
            >
              <SelectTrigger className="h-10 rounded-xl border-black bg-white shadow-sm px-4 font-black text-[11px] sm:text-xs uppercase tracking-widest text-slate-700">
                <SelectValue placeholder="Font Size" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-black/10 shadow-2xl">
                {fontSizes.map(s => (
                  <SelectItem key={s.value} value={s.value} className="py-2.5 px-4 rounded-lg focus:bg-primary/10 text-[11px] sm:text-xs font-black uppercase tracking-widest">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-2">Style Preview</label>
            <div className="h-10 rounded-xl bg-primary/5 border border-black flex items-center justify-center px-4 overflow-hidden">
              <div 
                className="truncate text-center w-full text-[11px] sm:text-xs"
                style={{ 
                  color: style?.color || 'inherit', 
                  fontSize: style?.fontSize || '1.125rem',
                  fontWeight: style?.fontWeight || 'normal',
                  fontStyle: style?.fontStyle || 'normal'
                }}
              >
                Sample Text
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2.5 border-t border-black/5">
        <div className="flex flex-col gap-1.5 w-full sm:w-auto">
          <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-2">Text Emphasis</label>
          <div className="flex bg-slate-100/50 rounded-lg p-0.5 border border-black w-fit">
            <button
              onClick={() => onChange({ ...style, fontWeight: style?.fontWeight === 'bold' ? 'normal' : 'bold' })}
              className={`w-9 h-9 rounded-md flex items-center justify-center transition-all duration-300 ${style?.fontWeight === 'bold' ? 'bg-white shadow-md text-primary scale-105' : 'text-slate-900 hover:text-slate-900'}`}
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5 stroke-[3px]" />
            </button>
            <button
              onClick={() => onChange({ ...style, fontStyle: style?.fontStyle === 'italic' ? 'normal' : 'italic' })}
              className={`w-9 h-9 rounded-md flex items-center justify-center transition-all duration-300 ${style?.fontStyle === 'italic' ? 'bg-white shadow-md text-primary scale-105' : 'text-slate-900 hover:text-slate-900'}`}
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5 stroke-[3px]" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

const SortableItem = ({ 
  id, 
  title, 
  subtitle, 
  canEdit = true, 
  onEdit, 
  onDelete,
  isMainPage,
  onToggleMainPage,
  thumbnailUrl,
  onView,
  badge
}: { 
  id: string,
  title: string,
  subtitle?: string,
  canEdit?: boolean,
  onEdit?: () => void,
  onDelete?: () => void,
  isMainPage?: boolean,
  onToggleMainPage?: (id: string, value: boolean) => void,
  thumbnailUrl?: string,
  onView?: () => void,
  badge?: React.ReactNode
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white/50 backdrop-blur-sm p-4 sm:p-5 rounded-[2.5rem] border border-black/5 mb-4 group hover:shadow-xl hover:shadow-primary/10 transition-all duration-500 shadow-sm relative overflow-hidden">
      <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
        {canEdit && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-900 hover:text-primary transition-all h-16 w-16 flex items-center justify-center bg-white rounded-[2.5rem] shadow-sm border border-black/5 -ml-1">
            <GripVertical className="w-5 h-5" />
          </div>
        )}
        
        {thumbnailUrl && (
          <div className="w-16 h-10 sm:w-24 sm:h-14 rounded-[2.5rem] bg-slate-100 overflow-hidden flex-shrink-0 border border-black/5 shadow-inner hidden sm:block">
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" onError={(e) => (e.currentTarget.src = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=100&q=80")} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-black uppercase tracking-widest text-slate-900 text-[11px] sm:text-xs truncate">{title}</h4>
            {badge}
          </div>
          {subtitle && <p className="text-[11px] sm:text-xs text-slate-900 font-medium line-clamp-1 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end border-t border-black/5 sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0">
        {onToggleMainPage !== undefined && (
          <div 
            className="flex items-center gap-4 px-6 bg-white rounded-[2.5rem] border border-black/5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all h-16 group/toggle cursor-pointer active:scale-95"
            onClick={() => onToggleMainPage(id, !isMainPage)}
          >
            <div className={cn(
              "w-10 h-10 rounded-[2.5rem] border-2 flex items-center justify-center transition-all duration-300",
              isMainPage ? "bg-primary border-primary shadow-lg shadow-primary/20" : "border-slate-300 bg-white"
            )}>
              {isMainPage && <Check className="w-6 h-6 text-white stroke-[4px]" />}
            </div>
            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest cursor-pointer whitespace-nowrap text-slate-900 group-hover/toggle:text-primary transition-colors">
              Main Page
            </label>
          </div>
        )}

        <div className="flex gap-2 w-full sm:w-auto justify-end">
          {onView && (
            <Button variant="outline" size="sm" onClick={onView} className="flex-1 sm:flex-none h-11 text-[11px] sm:text-xs font-black uppercase tracking-widest border-black/5 bg-white shadow-sm hover:bg-slate-50 rounded-xl px-6 transition-all active:scale-95">
              <Eye className="w-3.5 h-3.5 mr-2" /> View
            </Button>
          )}
          {canEdit ? (
            <>
              {onEdit && (
                <Button size="sm" onClick={onEdit} className="flex-1 sm:flex-none h-11 text-[11px] sm:text-xs font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 rounded-xl px-6 transition-all active:scale-95">
                  <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                </Button>
              )}
              {onDelete && (
                <Button size="sm" className="bg-primary text-white hover:bg-primary/90 flex-1 sm:flex-none h-11 text-[11px] sm:text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 rounded-xl px-6 transition-all active:scale-95" onClick={onDelete}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </Button>
              )}
            </>
          ) : (
            onEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit} className="flex-1 sm:flex-none h-11 text-[11px] sm:text-xs font-black uppercase tracking-widest rounded-xl px-6 hover:bg-slate-50 transition-all active:scale-95">
                <Eye className="w-3.5 h-3.5 mr-2" /> View
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );

};

const SortableBackgroundCard = ({ 
  section, 
  localSettings, 
  settings, 
  handleLocalSettingChange 
}: { 
  section: { id: string, label: string, defaultC1: string, defaultC2: string },
  localSettings: any,
  settings: any,
  handleLocalSettingChange: (key: string, value: string) => void
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  const c1 = localSettings[`bg_gradient_${section.id}_color1`] ?? settings[`bg_gradient_${section.id}_color1`] ?? section.defaultC1;
  const c2 = localSettings[`bg_gradient_${section.id}_color2`] ?? settings[`bg_gradient_${section.id}_color2`] ?? section.defaultC2;
  const dir = localSettings[`bg_gradient_${section.id}_direction`] ?? settings[`bg_gradient_${section.id}_direction`] ?? 'vertical';
  
  let previewBg = '';
  if (dir === 'vertical') previewBg = `linear-gradient(to bottom, ${c1}, ${c2})`;
  else if (dir === 'vertical-reverse') previewBg = `linear-gradient(to top, ${c1}, ${c2})`;
  else if (dir === 'horizontal') previewBg = `linear-gradient(to right, ${c1}, ${c2})`;
  else if (dir === 'horizontal-reverse') previewBg = `linear-gradient(to left, ${c1}, ${c2})`;
  else previewBg = `radial-gradient(circle, ${c1}, ${c2})`;

  return (
    <div ref={setNodeRef} style={style} className="h-full group">
      <Card className="border-black/5 h-full shadow-sm hover:shadow-xl hover:shadow-primary/80/10 transition-all duration-500 rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="pb-4 relative border-b border-black/5 bg-slate-50/50">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 -ml-2 text-slate-900 hover:text-primary transition-all bg-white rounded-xl shadow-sm border border-black/5">
              <GripVertical className="w-4 h-4" />
            </div>
            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/10">
              <Layout className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-900">{section.label}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Color 1</label>
              <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-black/10 shadow-sm">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-md ring-1 ring-black/5 shrink-0 ml-1">
                  <input 
                    type="color" 
                    value={c1}
                    onChange={(e) => handleLocalSettingChange(`bg_gradient_${section.id}_color1`, e.target.value)}
                    className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer"
                  />
                </div>
                <Input 
                  value={c1}
                  onChange={(e) => handleLocalSettingChange(`bg_gradient_${section.id}_color1`, e.target.value)}
                  className="h-10 border-none bg-transparent font-mono uppercase text-[11px] sm:text-xs px-2 focus-visible:ring-0 placeholder:text-slate-300 w-full font-bold text-slate-700"
                  placeholder="#hex"
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Color 2</label>
              <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-black/10 shadow-sm">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-md ring-1 ring-black/5 shrink-0 ml-1">
                  <input 
                    type="color" 
                    value={c2}
                    onChange={(e) => handleLocalSettingChange(`bg_gradient_${section.id}_color2`, e.target.value)}
                    className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer"
                  />
                </div>
                <Input 
                  value={c2}
                  onChange={(e) => handleLocalSettingChange(`bg_gradient_${section.id}_color2`, e.target.value)}
                  className="h-10 border-none bg-transparent font-mono uppercase text-[11px] sm:text-xs px-2 focus-visible:ring-0 placeholder:text-slate-300 w-full font-bold text-slate-700"
                  placeholder="#hex"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Gradient Direction</label>
            <Select 
              value={dir}
              onValueChange={(val) => handleLocalSettingChange(`bg_gradient_${section.id}_direction`, val)}
            >
            <SelectTrigger className="w-full border-black/10 h-11 bg-white/50 focus:bg-white rounded-xl shadow-sm transition-all font-black text-[11px] sm:text-xs uppercase tracking-widest px-8">
                <SelectValue placeholder="Select direction" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-black/10 shadow-2xl">
                <SelectItem value="vertical" className="font-bold text-[11px] sm:text-xs uppercase tracking-widest">Vertical (Top to Bottom)</SelectItem>
                <SelectItem value="vertical-reverse" className="font-bold text-[11px] sm:text-xs uppercase tracking-widest">Vertical (Bottom to Top)</SelectItem>
                <SelectItem value="horizontal" className="font-bold text-[11px] sm:text-xs uppercase tracking-widest">Horizontal (Left to Right)</SelectItem>
                <SelectItem value="horizontal-reverse" className="font-bold text-[11px] sm:text-xs uppercase tracking-widest">Horizontal (Right to Left)</SelectItem>
                <SelectItem value="center" className="font-bold text-[11px] sm:text-xs uppercase tracking-widest">Radial (Center Out)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Live Preview</label>
            <div 
              className="h-24 rounded-[1.5rem] border border-black/5 shadow-inner transition-all duration-700 relative overflow-hidden"
              style={{ background: previewBg }}
            >
              <div className="w-full h-full flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-white drop-shadow-md">Gradient Preview</span>
              </div>
              <div className="absolute bottom-2 right-3 bg-black/20 backdrop-blur-md px-2 py-1 rounded-lg">
                <code className="text-[11px] sm:text-xs text-white/90 font-mono truncate max-w-[150px] block">{previewBg}</code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SortableCategoryItem = ({ 
  category, 
  canEdit, 
  onToggleMainPage 
}: { 
  category: Category, 
  canEdit: boolean, 
  onToggleMainPage: (id: string, value: boolean) => void 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: category.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl border border-black/5 bg-white/70 backdrop-blur-sm shadow-md transition-all duration-300",
        isDragging && "shadow-2xl border-primary/20 scale-[1.02] z-50"
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        {canEdit && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 text-slate-400 hover:text-primary transition-colors">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary/5 border border-primary/10 text-primary font-black flex items-center justify-center text-[11px] sm:text-xs uppercase shrink-0">
          {category.name?.charAt(0) || '?'}
        </div>
        <div className="min-w-0">
          <p className="font-black text-slate-900 uppercase tracking-tight text-[11px] sm:text-xs truncate">{category.name || 'Untitled Category'}</p>
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 truncate">
            {category.icon ? `Icon: ${category.icon}` : 'Icon: None'} · Order: {category.sort_order ?? 0}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-50 border border-black/5 shadow-sm">
          <Checkbox
            checked={category.is_main_page || false}
            onCheckedChange={(value) => onToggleMainPage(category.id, value as boolean)}
            disabled={!canEdit}
            className="h-4 w-4 rounded-md border-black data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Active</span>
        </div>
      </div>
    </div>
  );
};

const AVAILABLE_ROLES = [
  'Administrator',
  'Account',
  'Agent',
  'Crew',
  'Pilot',
  'Co-pilot',
  'Ground Support',
  'Engineering'
];



export default function Admin() {
  const bucketName = import.meta.env.VITE_SUPABASE_BUCKET || "media";
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [registerRole, setRegisterRole] = useState("Account"); // Default role
  
  // Data States
  const [currentUserProfile, setCurrentUserProfile] = useState<AdminUser | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [currentEvent, setCurrentEvent] = useState<Partial<Event>>({});
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [filterKeyword, setFilterKeyword] = useState("");
  const [bookingFilterKeyword, setBookingFilterKeyword] = useState("");
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingTotalPages, setBookingTotalPages] = useState(1);
  const [bookingTotalCount, setBookingTotalCount] = useState(0);
  const [bookingFilterDate, setBookingFilterDate] = useState<Date | undefined>(undefined);
  const [exportDateRange, setExportDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [isExporting, setIsExporting] = useState(false);
  const [userFilterKeyword, setUserFilterKeyword] = useState("");
  const [registrationFilterKeyword, setRegistrationFilterKeyword] = useState("");
  const [selectedRegIds, setSelectedRegIds] = useState<string[]>([]);
  const [filterEventId, setFilterEventId] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(new Date());
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<Event | null>(null);
  const [isEventDetailsOpen, setIsEventDetailsOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingPaidAmount, setEditingPaidAmount] = useState(false);
  const [tempPaidAmount, setTempPaidAmount] = useState<string>("");
  const [editingDepositAmount, setEditingDepositAmount] = useState(false);
  const [tempDepositAmount, setTempDepositAmount] = useState<string>("");
  const [flightCertificateTemplates, setFlightCertificateTemplates] = useState<{id: string, name: string}[]>([]);
  const [selectedFlightCertificateTemplate, setSelectedFlightCertificateTemplate] = useState<string>("default");
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview States
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewZoom, setPreviewZoom] = useState(0.85);
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4');
  const [printPageMargins, setPrintPageMargins] = useState<'Normal' | 'Narrow' | 'None'>('Normal');

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBooking) return;

    setIsUploadingReceipt(true);
    const toastId = toast.loading("Uploading receipt...");

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `payment-proofs/${selectedBooking.booking_id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file);
      
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const currentUrls = selectedBooking.payment_proof_urls || [];
      if (selectedBooking.payment_proof_url && !currentUrls.includes(selectedBooking.payment_proof_url)) {
        currentUrls.push(selectedBooking.payment_proof_url);
      }
      const newUrls = [...currentUrls, publicUrl];

      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          payment_proof_urls: newUrls,
          payment_proof_url: selectedBooking.payment_proof_url || publicUrl 
        })
        .eq('booking_id', selectedBooking.booking_id);

      if (updateError) throw updateError;

      const updatedBooking = {
        ...selectedBooking,
        payment_proof_urls: newUrls,
        payment_proof_url: selectedBooking.payment_proof_url || publicUrl
      };

      setSelectedBooking(updatedBooking);
      setBookings(bookings.map(b => 
        b.booking_id === selectedBooking.booking_id ? updatedBooking : b
      ));

      toast.success("Receipt uploaded successfully", { id: toastId });
    } catch (error: any) {
      console.error("Error uploading receipt:", error);
      toast.error(`Upload failed: ${error.message}`, { id: toastId });
    } finally {
      setIsUploadingReceipt(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteReceipt = async (indexToDelete: number) => {
    if (!selectedBooking) return;

    // Get current URLs, ensuring we account for both payment_proof_url and payment_proof_urls
    const currentUrls = selectedBooking.payment_proof_urls || [];
    let allUrls = [...currentUrls];
    if (selectedBooking.payment_proof_url && !allUrls.includes(selectedBooking.payment_proof_url)) {
      allUrls.unshift(selectedBooking.payment_proof_url);
    }

    if (indexToDelete < 0 || indexToDelete >= allUrls.length) return;

    const urlToDelete = allUrls[indexToDelete];
    const newUrls = allUrls.filter((_, idx) => idx !== indexToDelete);
    
    // Determine what should be the main payment_proof_url (the first one, or null if empty)
    const newMainUrl = newUrls.length > 0 ? newUrls[0] : null;

    const toastId = toast.loading("Deleting receipt...");

    try {
      // Optional: Delete the file from storage if it's hosted on Supabase storage
      if (urlToDelete.includes('/storage/v1/object/public/media/payment-proofs/')) {
        const filePath = urlToDelete.split('/storage/v1/object/public/media/')[1];
        if (filePath) {
          await supabase.storage.from('media').remove([filePath]);
        }
      }

      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          payment_proof_urls: newUrls,
          payment_proof_url: newMainUrl 
        })
        .eq('booking_id', selectedBooking.booking_id);

      if (updateError) throw updateError;

      const updatedBooking = {
        ...selectedBooking,
        payment_proof_urls: newUrls,
        payment_proof_url: newMainUrl
      };

      setSelectedBooking(updatedBooking);
      setBookings(bookings.map(b => 
        b.booking_id === selectedBooking.booking_id ? updatedBooking : b
      ));

      toast.success("Receipt deleted successfully", { id: toastId });
    } catch (error: any) {
      console.error("Error deleting receipt:", error);
      toast.error(`Delete failed: ${error.message}`, { id: toastId });
    }
  };

  const handleUpdateDepositAmount = async () => {
    if (!selectedBooking) return;
    
    const newAmount = parseFloat(tempDepositAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const oldAmount = selectedBooking.deposit_amount || 0;
    
    if (newAmount === oldAmount) {
      setEditingDepositAmount(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ deposit_amount: newAmount })
        .eq('booking_id', selectedBooking.booking_id);

      if (error) throw error;

      // Log activity
      await logActivityUtil(
        supabase,
        'update_deposit_amount',
        'booking',
        selectedBooking.booking_id,
        {
          booking_reference: selectedBooking.booking_reference,
          old_amount: oldAmount,
          new_amount: newAmount
        }
      );

      // Update local state
      const updatedBooking = {
        ...selectedBooking,
        deposit_amount: newAmount
      };
      setSelectedBooking(updatedBooking);
      
      setBookings(prev => prev.map(b => b.booking_id === selectedBooking.booking_id ? { ...b, deposit_amount: newAmount } : b));

      toast.success("Deposit amount updated successfully");
      setEditingDepositAmount(false);
    } catch (error: any) {
      console.error('Error updating deposit amount:', error);
      toast.error("Failed to update deposit amount");
    }
  };

  const handleUpdatePaidAmount = async () => {
    if (!selectedBooking) return;
    
    const newAmount = parseFloat(tempPaidAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const oldAmount = selectedBooking.paid_amount || 0;
    
    if (newAmount === oldAmount) {
      setEditingPaidAmount(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ paid_amount: newAmount })
        .eq('booking_id', selectedBooking.booking_id);

      if (error) throw error;

      // Log activity
      await logActivityUtil(
        supabase,
        'update_paid_amount',
        'booking',
        selectedBooking.booking_id,
        {
          booking_reference: selectedBooking.booking_reference,
          old_amount: oldAmount,
          new_amount: newAmount
        }
      );

      // Update local state
      const updatedBooking = {
        ...selectedBooking,
        paid_amount: newAmount
      };
      setSelectedBooking(updatedBooking);
      
      setBookings(prev => prev.map(b => b.booking_id === selectedBooking.booking_id ? { ...b, paid_amount: newAmount } : b));

      toast.success("Paid amount updated successfully");
      setEditingPaidAmount(false);
    } catch (error: any) {
      console.error('Error updating paid amount:', error);
      toast.error("Failed to update paid amount");
    }
  };

  const handleTogglePaymentType = async () => {
    if (!selectedBooking) return;
    
    const newType = selectedBooking.payment_type === 'deposit' ? 'full' : 'deposit';
    const oldType = selectedBooking.payment_type;
    
    // Ask for confirmation if switching to full as it will update paid amount
    if (newType === 'full' && !window.confirm("Switching to Full Payment will update the Paid Amount to the Total Amount. Continue?")) {
      return;
    }

    const updates: any = { payment_type: newType };
    if (newType === 'full') {
      updates.paid_amount = selectedBooking.total_amount;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('booking_id', selectedBooking.booking_id);

      if (error) throw error;

      // Log activity
      await logActivityUtil(
        supabase,
        'update_payment_type',
        'booking',
        selectedBooking.booking_id,
        {
          booking_reference: selectedBooking.booking_reference,
          old_type: oldType,
          new_type: newType,
          paid_amount_synced: newType === 'full'
        }
      );

      // Update local state
      const updatedBooking = {
        ...selectedBooking,
        ...updates
      };
      setSelectedBooking(updatedBooking);
      
      setBookings(prev => prev.map(b => b.booking_id === selectedBooking.booking_id ? { ...b, ...updates } : b));

      toast.success(`Updated to ${newType === 'full' ? 'Full Payment' : 'Deposit'}`);
    } catch (error: any) {
      console.error('Error updating payment type:', error);
      toast.error("Failed to update payment type");
    }
  };

  useEffect(() => {
      setEditingPaidAmount(false);
      setTempPaidAmount("");
      setEditingDepositAmount(false);
      setTempDepositAmount("");
    }, [selectedBooking]);
  const [isEditingBooking, setIsEditingBooking] = useState(false);
  const [editBookingData, setEditBookingData] = useState<Partial<Booking> & { customer?: { name: string; email: string; phone?: string } }>({});
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [reviewServiceFilter, setReviewServiceFilter] = useState<string>("all");

  const [services, setServices] = useState<Service[]>([]);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [bgSections, setBgSections] = useState([
    { id: 'hero', label: 'Hero Carousel Overlay', defaultC1: 'hsla(220, 20%, 10%, 0.4)', defaultC2: 'hsla(220, 20%, 10%, 0.7)' },
    { id: 'services', label: 'Services Section', defaultC1: '#020617', defaultC2: '#0f172a' },
    { id: 'booking', label: 'Flight Packages & Booking Wizard', defaultC1: '#020617', defaultC2: '#0f172a' },
    { id: 'experience', label: 'Experience Section', defaultC1: '#f8fafc', defaultC2: '#f1f5f9' },
    { id: 'adventure', label: 'Adventure/Video Section', defaultC1: '#f8fafc', defaultC2: '#f1f5f9' },
    { id: 'features', label: 'Features Section', defaultC1: '#f8fafc', defaultC2: '#f1f5f9' },
    { id: 'starwars', label: 'Star Wars Section', defaultC1: '#000000', defaultC2: '#000000' },
    { id: 'tab_section', label: 'Admin Panel Background', defaultC1: '#f8fafc', defaultC2: '#f1f5f9' },
    { id: 'footer', label: 'Bottom Main Page (Footer)', defaultC1: '#1a1a1a', defaultC2: '#2a2a2a' }
  ]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [analyticsRefreshTrigger, setAnalyticsRefreshTrigger] = useState(0);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({});
  const [settingsStyles, setSettingsStyles] = useState<SiteSettingStyles>({});
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("bookings");
  const [eventProfiles, setEventProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [currentProfileName, setCurrentProfileName] = useState<string>("");
  const isMainContentActive = ['hero_slides', 'experiences', 'services', 'features', 'videos', 'content', 'starwars_section', 'about', 'booking_wizard', 'section_backgrounds'].includes(activeTab);
  const isPoliciesActive = ['policy_terms', 'policy_privacy', 'policy_refund', 'policy_cancellation', 'policy_rules'].includes(activeTab);
  const isEventActive = ['registrations', 'event_template'].includes(activeTab);
  const isConfigActive = ['email_config', 'whatsapp_config', 'payments', 'hours_config', 'logs', 'doc_templates', 'watermark_config'].includes(activeTab);
  const filteredReviews = reviewServiceFilter === "all" ? reviews : reviews.filter(review => review.service_id === reviewServiceFilter);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
    const [multipleImageFiles, setMultipleImageFiles] = useState<File[]>([]);
  const [waQr, setWaQr] = useState<string>("");
  const [isRolePermsOpen, setIsRolePermsOpen] = useState(false);
  
  // Local Settings state for manual saving
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const [localStyles, setLocalStyles] = useState<SiteSettingStyles>({});
  const [testBookingId, setTestBookingId] = useState("");
  const [testBookings, setTestBookings] = useState<Booking[]>([]);
  const [testBookingDate, setTestBookingDate] = useState<string>("");
  const [testPaymentType, setTestPaymentType] = useState<string>("all");
  const [testPaymentMethod, setTestPaymentMethod] = useState<string>("all");
  const [testPaymentGateway, setTestPaymentGateway] = useState<string>("all");
  const [isTestingNotifications, setIsTestingNotifications] = useState(false);

  const handleLocalSettingChange = (key: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleLocalStyleChange = (key: string, style: any) => {
    setLocalStyles(prev => ({ ...prev, [key]: style }));
  };

  const logActivity = async (action: string, entityType: string, entityId: string | null, details: any = {}) => {
    await logActivityUtil(supabase, action, entityType, entityId, details);
  };

  // Package Add-on Logic
  const [linkedAddons, setLinkedAddons] = useState<{addon_id: string, sort_order: number}[]>([]);
  const [availableAddons, setAvailableAddons] = useState<Package[]>([]);

  useEffect(() => {
    if (activeTab === 'packages' && editingItem?.id) {
      const fetchLinked = async () => {
         if (!supabase) return;
         const { data } = await supabase.from('package_addons').select('*').eq('parent_package_id', editingItem.id);
         if (data) setLinkedAddons(data.map(d => ({ addon_id: d.addon_package_id, sort_order: d.sort_order })));
      };
      fetchLinked();
    } else {
      setLinkedAddons([]);
    }
  }, [activeTab, editingItem?.id]);

  useEffect(() => {
     if (activeTab === 'packages') {
        const mainCatIds = categories.filter(c => c.is_main_page).map(c => c.id);
        const addons = packages.filter(p => !mainCatIds.includes(p.category_id)); 
        setAvailableAddons(addons);
     }
  }, [activeTab, packages, categories]);

  useEffect(() => {
    if (activeTab === 'payments') {
      const fetchTestBookings = async () => {
        if (!supabase) return;
        let query = supabase
          .from('bookings')
          .select('*, customer:customers(name, email, phone)')
          .order('created_at', { ascending: false })
          .limit(50);

        if (testBookingDate) {
          query = query.eq('flight_date', testBookingDate);
        }
        if (testPaymentType !== 'all') {
          query = query.eq('payment_type', testPaymentType);
        }
        if (testPaymentMethod !== 'all') {
          query = query.eq('payment_method', testPaymentMethod);
        }
        if (testPaymentGateway !== 'all') {
          query = query.eq('payment_gateway', testPaymentGateway);
        }

        const { data } = await query;
        if (data) setTestBookings(data as Booking[]);
      };
      fetchTestBookings();
    }
  }, [activeTab, testBookingDate, testPaymentType, testPaymentMethod, testPaymentGateway]);

  useEffect(() => {
    if (activeTab === 'payments' && selectedBooking) {
      setTestBookingId(selectedBooking.booking_id);
    }
  }, [activeTab, selectedBooking]);

  const extractVimeoId = (url: string) => {
    if (!url) return "";
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/) || url.match(/player\.vimeo\.com\/video\/(\d+)/);
    return match?.[1] || "";
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const bgSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isAdmin = () => {
    // Check profile role or check if it's the superadmin email
    const profileRole = currentUserProfile?.role;
    const profileEmail = currentUserProfile?.email;
    const authEmail = session?.user?.email;

    return profileRole === 'admin' || 
           profileRole === 'Administrator' || 
           profileEmail === 'admin@oneday.com' || 
           authEmail === 'admin@oneday.com';
  };

  const canView = (tab: string) => {
    if (!currentUserProfile) return false;
    if (isAdmin()) return true;
    
    const userRole = currentUserProfile.role;
    const targetModule = tab === 'event_template' ? 'registrations' : tab;
    
    // Check role-based permissions
    const perm = rolePermissions.find(p => p.role === userRole && p.module === targetModule);
    return perm ? perm.can_view : false;
  };

  const canEdit = (tab: string) => {
    if (!currentUserProfile) return false;
    if (isAdmin()) return true;

    const userRole = currentUserProfile.role;
    const targetModule = tab === 'event_template' ? 'registrations' : tab;
    
    // Check role-based permissions
    const perm = rolePermissions.find(p => p.role === userRole && p.module === targetModule);
    return perm ? perm.can_edit : false;
  };

  const fetchPublicSettings = async () => {
    if (!supabase) return;
    try {
      const { data: settingsData, error } = await supabase
        .from('site_settings')
        .select('*')
        .in('key', ['site_logo_main', 'site_logo_login', 'site_title']);
      
      if (settingsData && !error) {
        const settingsMap: SiteSettings = { ...settings };
        (settingsData as SiteSetting[]).forEach((setting) => {
          settingsMap[setting.key] = setting.value;
        });
        setSettings(prev => ({ ...prev, ...settingsMap }));
      }
    } catch (err) {
      console.error("Error fetching public settings:", err);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    
    // Always fetch public settings for logos
    fetchPublicSettings();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAllData();
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchAllData();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchBookings = async (page = bookingPage) => {
    if (!supabase) return;
    
    let query = supabase
      .from('bookings')
      .select('*, customer:customers(name, email, phone), booking_passengers(*), booking_items(id, quantity, unit_price, total_price, package:packages(name, description))', { count: 'exact' });

    // Apply Date Filter (Flight Date)
    if (bookingFilterDate) {
      const dateStr = format(bookingFilterDate, 'yyyy-MM-dd');
      query = query.eq('flight_date', dateStr);
    }

    // Apply Keyword Filter
    if (bookingFilterKeyword) {
      // 1. Search passengers
      const { data: passengers } = await supabase
        .from('booking_passengers')
        .select('booking_id')
        .or(`name.ilike.%${bookingFilterKeyword}%,ic_passport_number.ilike.%${bookingFilterKeyword}%,country_of_origin.ilike.%${bookingFilterKeyword}%`)
        .limit(100);
        
      // 2. Search bookings by reference
      const { data: directBookings } = await supabase
        .from('bookings')
        .select('booking_id')
        .ilike('booking_reference', `%${bookingFilterKeyword}%`)
        .limit(100);

      // 3. Search customers
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .or(`name.ilike.%${bookingFilterKeyword}%,email.ilike.%${bookingFilterKeyword}%,phone.ilike.%${bookingFilterKeyword}%`)
        .limit(100);
      
      const customerIds = customers?.map(c => c.id) || [];
      const { data: customerBookings } = customerIds.length > 0 
        ? await supabase.from('bookings').select('booking_id').in('customer_id', customerIds)
        : { data: [] };

      // Combine all matching booking IDs
      const allMatchingIds = new Set([
        ...(passengers?.map(p => p.booking_id) || []),
        ...(directBookings?.map(b => b.booking_id) || []),
        ...(customerBookings?.map(b => b.booking_id) || [])
      ]);
      
      const passengerBookingIds = Array.from(allMatchingIds);
      
      if (passengerBookingIds.length > 0) {
        query = query.in('booking_id', passengerBookingIds);
      } else {
        // No matches across passengers, references, or customers
        query = query.eq('booking_id', '00000000-0000-0000-0000-000000000000');
      }
    }

    // Apply Pagination
    const from = (page - 1) * 10;
    const to = from + 9;
    
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
      
    if (error) {
      console.error("Error fetching bookings details:", error);
      // Fallback: try fetching without nested joins if the complex query fails
      const { data: simpleData, error: simpleError, count: simpleCount } = await supabase
        .from('bookings')
        .select('*, customer:customers(name, email, phone), booking_passengers(*)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
        
      if (simpleError) {
        console.error("Simple booking fetch also failed:", simpleError);
        toast.error(`Failed to load bookings: ${simpleError.message}`);
      } else {
        console.log("Successfully fetched bookings with simple query (nested joins failed)");
        setBookings((simpleData || []) as Booking[]);
        if (simpleCount !== null) {
          setBookingTotalCount(simpleCount);
          setBookingTotalPages(Math.ceil(simpleCount / 10));
        }
      }
    } else {
      setBookings((data || []) as Booking[]);
      if (count !== null) {
        setBookingTotalCount(count);
        setBookingTotalPages(Math.ceil(count / 10));
      }
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [bookingPage]);

  useEffect(() => {
    if (bookingPage !== 1) setBookingPage(1);
    else fetchBookings();
  }, [bookingFilterDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (bookingPage !== 1) setBookingPage(1);
      else fetchBookings(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [bookingFilterKeyword]);

  const fetchAllData = async () => {
    if (!supabase) return;
    const { data: { session: activeSession } } = await supabase.auth.getSession();
    if (!activeSession) return;
    setAnalyticsRefreshTrigger(prev => prev + 1);

    // Fetch Current User Profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile, error: profileError } = await supabase.from('admin_users').select('*').eq('email', user.email).maybeSingle();
      if (profileError) {
        console.error("Error fetching profile:", profileError);
      } else {
        if (profile) {
          setCurrentUserProfile(profile as AdminUser);
        }

        if (user.email !== 'admin@oneday.com' && (!profile || !profile.is_approved)) {
          toast.error("Your account is pending approval. Please wait for admin approval.");
          await supabase.auth.signOut();
          setCurrentUserProfile(null);
          return;
        }
        
        // Check if admin - either via profile role or email
        const isUserAdmin = profile?.role === 'admin' || profile?.role === 'Administrator' || user.email === 'admin@oneday.com';
        if (isUserAdmin) {
           fetchAdminData();
        }
      }
    }
    
    const { data: servicesData } = await supabase.from('services').select('*').order('order');
    const { data: heroData } = await supabase.from('hero_slides').select('*').order('order');
    const { data: expData } = await supabase.from('experiences').select('*').order('order');
    const { data: featData } = await supabase.from('features').select('*').order('order');
    const { data: vidsData } = await supabase.from('videos').select('*').order('order');
    const { data: catData } = await supabase.from('categories').select('*').order('sort_order');
    const { data: pkgData } = await supabase.from('packages').select('*').order('sort_order');
    const { data: settingsData } = await supabase.from('site_settings').select('*');
    
    // Fetch background sections order if saved
    const { data: bgOrderData } = await supabase.from('site_settings').select('value').eq('key', 'bg_sections_order').maybeSingle();
    if (bgOrderData) {
      try {
        const savedOrder = JSON.parse(bgOrderData.value) as string[];
        const defaultSections = [
          { id: 'hero', label: 'Hero Carousel Overlay', defaultC1: 'hsla(220, 20%, 10%, 0.4)', defaultC2: 'hsla(220, 20%, 10%, 0.7)' },
          { id: 'services', label: 'Services Section', defaultC1: '#020617', defaultC2: '#0f172a' },
          { id: 'booking', label: 'Flight Packages & Booking Wizard', defaultC1: '#020617', defaultC2: '#0f172a' },
          { id: 'experience', label: 'Experience Section', defaultC1: '#f8fafc', defaultC2: '#f1f5f9' },
          { id: 'adventure', label: 'Adventure/Video Section', defaultC1: '#f8fafc', defaultC2: '#f1f5f9' },
          { id: 'features', label: 'Features Section', defaultC1: '#f8fafc', defaultC2: '#f1f5f9' },
          { id: 'tab_section', label: 'Admin Panel Background', defaultC1: '#f8fafc', defaultC2: '#f1f5f9' },
          { id: 'footer', label: 'Bottom Main Page (Footer)', defaultC1: '#1a1a1a', defaultC2: '#2a2a2a' }
        ];
        
        const sortedSections = savedOrder
          .map(id => defaultSections.find(s => s.id === id))
          .filter(Boolean) as typeof defaultSections;
        
        defaultSections.forEach(s => {
          if (!sortedSections.find(ss => ss.id === s.id)) {
            sortedSections.push(s);
          }
        });
        
        setBgSections(sortedSections);
      } catch (e) {
        console.error("Error parsing bg_sections_order", e);
      }
    }

    // Fetch message templates with error handling for missing table
    let msgSettingsData = null;
    try {
      const { data, error: msgError } = await supabase.from('message_settings').select('*');
      if (!msgError) {
        msgSettingsData = data;
      } else {
        console.warn('Message settings table might be missing:', msgError.message);
      }
    } catch (e) {
      console.warn('Failed to fetch message settings:', e);
    }
    
    // New fetches
    const { data: reviewsData } = await supabase.from('reviews').select('*, service:services(title)').order('created_at', { ascending: false });
    // Bookings fetched via fetchBookings() to support pagination
    await fetchBookings();
    
    const { data: registrationsData } = await supabase.from('event_registrations').select('*').order('created_at', { ascending: false });
    const { data: eventsData } = await supabase.from('events').select('*').order('event_date', { ascending: true });
    
    // Fetch Event Profiles
    const { data: profilesData } = await supabase.from('event_profiles').select('*').order('created_at', { ascending: false });
    if (profilesData) setEventProfiles(profilesData);
    
    // Fetch Flight Certificate Templates
    const { data: certTemplates } = await supabase.from('document_templates').select('id, name').eq('document_type', 'certificate').order('created_at', { ascending: false });
    if (certTemplates) setFlightCertificateTemplates(certTemplates);
    
    const servicesList = (servicesData || []) as Service[];
    const heroList = (heroData || []) as HeroSlide[];
    const experienceList = (expData || []) as Experience[];
    const featureList = (featData || []) as Feature[];
    const videoList = (vidsData || []) as Video[];
    const categoryList = (catData || []) as Category[];
    const packageList = (pkgData || []) as Package[];
    const reviewList = (reviewsData || []) as Review[];

    const analytics = servicesList.map((service) => ({
      id: service.id,
      name: service.title.substring(0, 15),
      clicks: Math.floor(Math.random() * 100) + 10
    }));

    setServices(servicesList);
    setHeroSlides(heroList);
    setExperiences(experienceList);
    setFeatures(featureList);
    setVideos(videoList);
    setCategories(categoryList);
    setPackages(packageList);
    setReviews(reviewList);
    // setBookings is handled by fetchBookings
    setRegistrations(registrationsData || []);
    setEvents((eventsData || []) as Event[]);
    setAnalyticsData(analytics);

    if (settingsData) {
      const settingsMap: SiteSettings = {};
      const stylesMap: SiteSettingStyles = {};
      (settingsData as SiteSetting[]).forEach((setting) => {
        settingsMap[setting.key] = setting.value;
        if (setting.style) {
          stylesMap[setting.key] = setting.style;
        }
      });
      setSettings(settingsMap);
      setSettingsStyles(stylesMap);
      
      // Initialize background sections order if saved
      if (settingsMap['bg_sections_order']) {
        try {
          const savedOrder = JSON.parse(settingsMap['bg_sections_order']) as string[];
          const defaultSections = [
            { id: 'hero', label: 'Hero Carousel Overlay', defaultC1: 'hsla(220, 20%, 10%, 0.4)', defaultC2: 'hsla(220, 20%, 10%, 0.7)' },
            { id: 'services', label: 'Services Section', defaultC1: '#020617', defaultC2: '#0f172a' },
            { id: 'booking', label: 'Flight Packages & Booking Wizard', defaultC1: '#020617', defaultC2: '#0f172a' },
            { id: 'experience', label: 'Experience Section', defaultC1: '#f8fafc', defaultC2: '#f1f5f9' },
            { id: 'adventure', label: 'Adventure/Video Section', defaultC1: '#f8fafc', defaultC2: '#f1f5f9' },
            { id: 'features', label: 'Features Section', defaultC1: '#f8fafc', defaultC2: '#f1f5f9' },
            { id: 'tab_section', label: 'Admin Panel Background', defaultC1: '#f8fafc', defaultC2: '#f1f5f9' },
            { id: 'footer', label: 'Bottom Main Page (Footer)', defaultC1: '#1a1a1a', defaultC2: '#2a2a2a' }
          ];
          
          const sortedSections = savedOrder
            .map(id => defaultSections.find(s => s.id === id))
            .filter(Boolean) as typeof defaultSections;
          
          // Add any missing sections that might have been added in updates
          defaultSections.forEach(s => {
            if (!sortedSections.find(ss => ss.id === s.id)) {
              sortedSections.push(s);
            }
          });
          
          setBgSections(sortedSections);
        } catch (e) {
          console.error("Error parsing bg_sections_order", e);
        }
      }

      setEmailTemplates(msgSettingsData || []);
      if (settingsMap['whatsapp_bot_qr']) setWaQr(settingsMap['whatsapp_bot_qr']);
    }
  };

  const handleReviewAction = async (id: string, approved: boolean) => {
    if (!supabase) return;
    if (!canEdit('reviews')) {
      toast.error("You don't have permission to manage reviews");
      return;
    }

    const { data: review } = await supabase.from('reviews').select('customer_name, comment').eq('id', id).single();
    const details = { 
      customer_name: review?.customer_name, 
      comment_snippet: review?.comment ? (review.comment.substring(0, 30) + (review.comment.length > 30 ? '...' : '')) : '' 
    };

    if (approved) {
      await supabase.from('reviews').update({ is_approved: true }).eq('id', id);
      toast.success("Review Approved");
      logActivity('approve', 'reviews', id, details);
    } else {
      await supabase.from('reviews').delete().eq('id', id);
      toast.success("Review Deleted");
      logActivity('delete', 'reviews', id, details);
    }
    fetchAllData();
  };

  const handleDeleteRegistration = async (id: string) => {
    if (!supabase) return;
    if (!canEdit('registrations')) {
      toast.error("You don't have permission to delete registrations");
      return;
    }

    if (!confirm("Are you sure you want to delete this registration?")) return;

    try {
      const { data: reg } = await supabase.from('event_registrations').select('name, email').eq('id', id).single();

      const { error } = await supabase
        .from('event_registrations')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("Error deleting registration:", error);
        toast.error("Failed to delete registration");
        return;
      }

      toast.success("Registration deleted");
      logActivity('delete', 'event_registrations', id, { name: reg?.name, email: reg?.email });
      fetchAllData();
    } catch (e) {
      console.error("Delete registration error:", e);
      toast.error("An error occurred");
    }
  };

  const handleBulkDeleteRegistrations = async () => {
    if (!supabase) return;
    if (selectedRegIds.length === 0) return;
    
    if (!canEdit('registrations')) {
      toast.error("You don't have permission to delete registrations");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedRegIds.length} selected registration(s)?`)) return;

    try {
      const { error } = await supabase
        .from('event_registrations')
        .delete()
        .in('id', selectedRegIds);

      if (error) {
        console.error("Error bulk deleting registrations:", error);
        toast.error("Failed to delete selected registrations");
        return;
      }

      toast.success(`${selectedRegIds.length} registration(s) deleted`);
      logActivity('bulk_delete', 'event_registrations', selectedRegIds.join(','), { count: selectedRegIds.length });
      setSelectedRegIds([]);
      fetchAllData();
    } catch (e) {
      console.error("Bulk delete registrations error:", e);
      toast.error("An error occurred during bulk deletion");
    }
  };

  const handlePrintCertificates = async (isPreview: boolean = false) => {
    if (selectedRegIds.length === 0) {
      toast.error("Please select at least one registration");
      return;
    }

    const loadingToast = toast.loading(
      isPreview ? "Preparing preview..." : `Preparing ${selectedRegIds.length} certificate(s) for printing...`
    );

    const templateId = selectedFlightCertificateTemplate === 'default' ? undefined : selectedFlightCertificateTemplate;

    try {
      // Both Preview and Print now show the dialog first
      let allHtml = "";
      for (let i = 0; i < selectedRegIds.length; i++) {
        const id = selectedRegIds[i];
        const result = await generateRegistrationPDF(id, 'certificate', true, templateId, printOrientation, pageSize, printPageMargins);
        if (result.html) {
          allHtml += `<div class="print-page">${result.html}</div>`;
          if (i < selectedRegIds.length - 1) {
            allHtml += '<div class="page-break-divider" style="page-break-after: always; height: 0; overflow: hidden;"></div>';
          }
        }
      }

      if (allHtml) {
        setPreviewHtml(allHtml);
        setShowPreviewDialog(true);
        // Set zoom based on screen size
        const width = window.innerWidth;
        if (width < 768) {
          setPreviewZoom(0.35);
        } else if (width < 1024) {
          setPreviewZoom(0.6);
        } else {
          setPreviewZoom(0.85);
        }
        
        toast.success("Preview loaded", { id: loadingToast });
      } else {
        toast.error("Could not generate content", { id: loadingToast });
      }
    } catch (error: any) {
      console.error("Error generating certificates:", error);
      toast.error(`Failed to generate: ${error.message}`, { id: loadingToast });
    }
  };

  const handlePrintEventManifest = async (event: Event, isPreview: boolean = false) => {
    const eventRegistrations = registrations.filter(r => r.event_id === event.id);
    if (eventRegistrations.length === 0) {
      toast.error("No registrations found for this event");
      return;
    }

    const loadingToast = toast.loading(
      isPreview ? "Preparing manifest preview..." : `Preparing manifest for ${eventRegistrations.length} attendee(s)...`
    );

    try {
      const tableData: TableData = {
        id: `manifest-${event.id}`,
        name: `Attendee Manifest - ${event.name}`,
        rows: eventRegistrations.length,
        cols: 4,
        headers: ["No.", "Name", "Contact Info", "NRIC / Passport"],
        data: eventRegistrations.map((r, index) => [
          (index + 1).toString(),
          r.name || '-',
          `${r.email || '-'}\n${r.phone || '-'}`,
          r.nric_number || '-'
        ])
      };

      const tableHtml = generateTableHtml(tableData);
      
      const titleHtml = `
        <div style="text-align: center; margin-bottom: 25px; font-family: sans-serif;">
          <h1 style="font-size: 24px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 2px; color: #0f172a;">Event Attendee Manifest</h1>
          <div style="height: 4px; width: 60px; background: #000; margin: 10px auto;"></div>
          <h2 style="font-size: 18px; font-weight: 800; margin: 5px 0; text-transform: uppercase; color: #1e293b;">${event.name}</h2>
          <p style="font-size: 13px; font-weight: 600; margin: 5px 0; text-transform: uppercase; tracking: 0.1em; color: #475569;">
            ${format(new Date(event.event_date + 'T00:00:00'), "EEEE d MMMM yyyy")} @ ${event.event_time}
          </p>
          <p style="font-size: 12px; font-weight: 700; margin: 5px 0; text-transform: uppercase; color: #64748b;">
            Location: ${event.location || 'TBA'}
          </p>
          <div style="margin-top: 15px; display: inline-block; padding: 4px 12px; background: #f1f5f9; border-radius: 20px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
            Total Attendees: ${eventRegistrations.length}
          </div>
        </div>
      `;

      const allHtml = `<div class="print-page">${titleHtml}${tableHtml}</div>`;

      setPreviewHtml(allHtml);
      setShowPreviewDialog(true);
      
      const width = window.innerWidth;
      if (width < 768) {
        setPreviewZoom(0.35);
      } else if (width < 1024) {
        setPreviewZoom(0.6);
      } else {
        setPreviewZoom(0.85);
      }
      
      toast.success("Manifest loaded", { id: loadingToast });
    } catch (error: any) {
      console.error("Error generating manifest:", error);
      toast.error(`Failed to generate manifest: ${error.message}`, { id: loadingToast });
    }
  };

  const handlePrintFromPreview = () => {
    if (!previewHtml) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const sizeStr = pageSize === 'A4' ? 'A4' : 'letter';
      const marginVal = printPageMargins === 'Normal' ? '20mm' : printPageMargins === 'Narrow' ? '10mm' : '0';

      printWindow.document.write(`
        <html>
          <head>
            <title>Print Document</title>
            <style>
              @page { 
                size: ${sizeStr} ${printOrientation}; 
                margin: ${marginVal}; 
              }
              body { 
                margin: 0; 
                padding: 0;
                background: white; 
              }
              .print-page {
                width: 100%;
                height: 100%;
                position: relative;
                overflow: hidden;
                box-sizing: border-box;
                page-break-after: always;
              }
              .print-page > div,
              .print-page > .a4-container {
                width: 100% !important;
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box;
              }
              .print-page:last-child {
                page-break-after: auto;
              }
              @media print {
                body { -webkit-print-color-adjust: exact; }
                .print-page { 
                  page-break-after: always;
                  border: none !important;
                }
                .print-page:last-child {
                  page-break-after: auto;
                }
              }
            </style>
          </head>
          <body>
            <div class="print-page">
              ${previewHtml}
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 500);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleDownloadRegistrationPDF = async () => {
    if (selectedRegIds.length === 0) return;
    setIsGeneratingCert(true);
    const loadingToast = toast.loading(`Generating PDF...`);
    
    const templateId = selectedFlightCertificateTemplate === 'default' ? undefined : selectedFlightCertificateTemplate;

    try {
      const id = selectedRegIds[0];
      const result = await generateRegistrationPDF(id, 'certificate', false, templateId, printOrientation, pageSize, printPageMargins);
      if (result.blob) {
        const url = window.URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificate_${id.slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("PDF generated and downloaded", { id: loadingToast });
      }
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF", { id: loadingToast });
    } finally {
      setIsGeneratingCert(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!supabase) return;
    if (!canEdit('events')) {
      toast.error("You don't have permission to delete events");
      return;
    }
    
    if (!confirm("Are you sure you want to delete this event? This will remove it from the calendar, but all registrations will be kept.")) return;

    try {
      // 1. Update registrations to remove the event reference (set event_id to null)
      const { error: updateError } = await supabase
        .from('event_registrations')
        .update({ event_id: null })
        .eq('event_id', eventId);

      if (updateError) {
        console.error("Error unlinking registrations:", updateError);
        toast.error("Failed to unlink registrations. Event cannot be deleted.");
        return;
      }

      // 2. Delete the event
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (deleteError) {
        console.error("Error deleting event:", deleteError);
        toast.error("Failed to delete event.");
        return;
      }

      toast.success("Event deleted successfully. Registrations have been preserved.");
      logActivity('delete', 'events', eventId);
      setSelectedCalendarEvent(null);
      fetchAllData();
    } catch (error) {
      console.error("Unexpected error deleting event:", error);
      toast.error("An unexpected error occurred.");
    }
  };

  const handleRefundBooking = async (id: string) => {
    if (!supabase) return;
    if (!canEdit('bookings')) {
      toast.error("You don't have permission to manage bookings");
      return;
    }

    if (!confirm("Are you sure you want to refund this booking? This will update the payment status and affect revenue.")) {
      return;
    }

    try {
      // First get the booking info for amount and reference
      const { data: booking } = await supabase
        .from('bookings')
        .select('total_amount, booking_reference, customer_id')
        .eq('booking_id', id)
        .single();

      // Update to 'cancelled' and set payment_status to 'refunded'
      const { error } = await supabase.from('bookings')
        .update({ status: 'cancelled', payment_status: 'refunded' })
        .eq('booking_id', id);

      if (error) throw error;

      toast.success("Booking marked as Refunded");
      
      if (booking) {
        logActivity('refund', 'bookings', id, { 
          booking_reference: booking.booking_reference,
          amount: booking.total_amount
        });
      }

      fetchAllData();
    } catch (error) {
      toast.error("Failed to process refund");
      console.error(error);
    }
  };

  const handleSaveBookingEdit = async () => {
    if (!supabase || !selectedBooking) return;
    if (!canEdit('bookings')) {
      toast.error("You don't have permission to edit bookings");
      return;
    }

    setLoading(true);
    try {
      // 1. Update Customer Information if changed
      if (selectedBooking.customer_id && editBookingData.customer) {
        const { error: customerError } = await supabase
          .from('customers')
          .update({
            name: editBookingData.customer.name,
            email: editBookingData.customer.email,
            phone: editBookingData.customer.phone
          })
          .eq('id', selectedBooking.customer_id);
        
        if (customerError) throw customerError;
      }

      // Calculate discount amount and sync total/outstanding if needed
      let discountAmount = 0;
      const currentTotal = selectedBooking.total_amount || 0;
      
      if (editBookingData.payment_type === 'full' && editBookingData.deposit_amount !== undefined) {
        if (editBookingData.deposit_amount < currentTotal) {
          discountAmount = currentTotal - editBookingData.deposit_amount;
        }
        editBookingData.total_amount = editBookingData.deposit_amount;
        editBookingData.outstanding_balance = 0;
      } else if (editBookingData.payment_type === 'deposit' && editBookingData.deposit_amount !== undefined && editBookingData.total_amount !== undefined) {
        editBookingData.outstanding_balance = editBookingData.total_amount - editBookingData.deposit_amount;
      }

      // 2. Update Booking Information
      const bookingUpdates: Partial<Booking> = {
        flight_date: editBookingData.flight_date,
        flight_time: editBookingData.flight_time,
        status: editBookingData.status,
        payment_type: editBookingData.payment_type,
        deposit_amount: editBookingData.deposit_amount,
        total_amount: editBookingData.total_amount,
        discount_amount: discountAmount,
        outstanding_balance: editBookingData.outstanding_balance
      };

      const { error: bookingError } = await supabase
        .from('bookings')
        .update(bookingUpdates)
        .eq('booking_id', selectedBooking.booking_id);

      if (bookingError) throw bookingError;

      toast.success("Booking details updated successfully");
      
      // Refresh all data to ensure UI is in sync
      fetchAllData();
      
      // Update selectedBooking immediately to reflect changes in UI
      const updatedBooking = {
        ...selectedBooking,
        ...bookingUpdates,
        customer: {
          ...selectedBooking.customer,
          ...editBookingData.customer
        }
      } as Booking;

      setSelectedBooking(updatedBooking);
      setIsEditingBooking(false);
      
      logActivity('update', 'bookings', selectedBooking.booking_id, {
        previous: {
          flight_date: selectedBooking.flight_date,
          flight_time: selectedBooking.flight_time,
          status: selectedBooking.status,
          payment_type: selectedBooking.payment_type,
          deposit_amount: selectedBooking.deposit_amount,
          outstanding_balance: selectedBooking.outstanding_balance,
          customer: selectedBooking.customer
        },
        updated: {
          flight_date: editBookingData.flight_date,
          flight_time: editBookingData.flight_time,
          status: editBookingData.status,
          payment_type: editBookingData.payment_type,
          deposit_amount: editBookingData.deposit_amount,
          outstanding_balance: editBookingData.outstanding_balance,
          customer: editBookingData.customer
        }
      });

    } catch (error: any) {
      console.error("Error updating booking:", error);
      toast.error("Failed to update booking: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBooking = async (id: string) => {
    if (!supabase) return;
    if (!canEdit('bookings')) {
      toast.error("You don't have permission to manage bookings");
      return;
    }
    
    // First, fetch the booking details to get customer info for notification
    const { data: bookingData, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(id, name, phone, email),
        booking_items(id, quantity, unit_price, total_price, package:packages(name, description))
      `)
      .eq('booking_id', id)
      .single();

    if (fetchError) {
      console.error("Error fetching booking details:", fetchError);
    }

    // Generate Invoice ID
    const invoiceId = bookingData?.booking_reference?.replace('BK', 'INV');

    // Update to 'confirmed', set payment_status to 'paid', and save invoice_id
    const { error } = await supabase.from('bookings')
      .update({ 
        status: 'confirmed', 
        payment_status: 'paid',
        invoice_id: invoiceId
      })
      .eq('booking_id', id);

    if (error) {
      console.error(error);
      if (error.code === '23505') {
        toast.error("Booking Conflict: A confirmed booking already exists for this time slot. Please check for duplicates or run the provided SQL script to allow multiple bookings.");
      } else {
        toast.error("Failed to approve booking: " + error.message);
      }
    } else {
      toast.success("Booking Approved & Payment Marked as Paid");
      
      // Update selectedBooking immediately to reflect changes in UI
      if (selectedBooking && selectedBooking.booking_id === id) {
        setSelectedBooking(prev => prev ? ({
          ...prev,
          status: 'confirmed',
          payment_status: 'paid',
          invoice_id: invoiceId
        }) : null);
      }
      
      logActivity('approve', 'bookings', id, { 
        booking_reference: bookingData?.booking_reference, 
        customer_name: bookingData?.customer?.name 
      });
      
      try {
        await notificationService.sendAdminApprovalNotifications(id);
        toast.success("Success notifications triggered");
      } catch (e) {
        console.error("Notification logic error:", e);
        toast.error("Booking approved, but failed to trigger notifications");
      }
      
      fetchAllData();
    }
  };

  const handlePendingBooking = async (id: string) => {
    if (!supabase) return;
    if (!canEdit('bookings')) {
      toast.error("You don't have permission to manage bookings");
      return;
    }

    const { error } = await supabase.from('bookings')
      .update({ status: 'pending' })
      .eq('booking_id', id);

    if (error) {
      toast.error("Failed to update booking status");
      console.error(error);
    } else {
      toast.success("Booking status reverted to Pending");
      const booking = bookings.find(b => b.booking_id === id);
      if (booking) {
        logActivity('update', 'bookings', id, {
            action: 'revert_to_pending',
            booking_reference: booking.booking_reference
        });
      }
      fetchAllData();
    }
  };

  const resolveTestBookingId = () => {
    const value = testBookingId.trim();
    if (value) return value;
    if (selectedBooking?.booking_id) return selectedBooking.booking_id;
    if (selectedBooking?.booking_reference) return selectedBooking.booking_reference;
    return "";
  };

  const handleTestPendingNotification = async () => {
    const bookingId = resolveTestBookingId();
    if (!bookingId) {
      toast.error("Please enter a booking ID or reference");
      return;
    }
    setIsTestingNotifications(true);
    try {
      const result = await notificationService.sendPendingApprovalNotifications(bookingId);
      if (result.success) {
        toast.success("Pending approval notification sent");
      } else {
        toast.error(result.error || "Failed to send pending approval notification");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send pending approval notification");
    } finally {
      setIsTestingNotifications(false);
    }
  };

  const handleTestApprovalNotification = async (source: 'vercel' | 'flyio' = 'vercel') => {
    const bookingId = resolveTestBookingId();
    if (!bookingId) {
      toast.error("Please enter a booking ID or reference");
      return;
    }
    setIsTestingNotifications(true);
    try {
      const result = await notificationService.sendAdminApprovalNotifications(bookingId, source);
      if (result.success) {
        toast.success(`Admin approval notification sent via ${source === 'vercel' ? 'Vercel' : 'Fly.io'}`);
      } else {
        toast.error(result.error || `Failed to send admin approval notification via ${source}`);
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to send admin approval notification via ${source}`);
    } finally {
      setIsTestingNotifications(false);
    }
  };

  const handleTestReminderNotification = async () => {
    const bookingId = resolveTestBookingId();
    if (!bookingId) {
      toast.error("Please enter a booking ID or reference");
      return;
    }
    setIsTestingNotifications(true);
    try {
      const result = await notificationService.triggerReminderTest(bookingId);
      if (result.success) {
        toast.success("Reminder notification sent");
      } else {
        toast.error(result.error || "Failed to send reminder notification");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send reminder notification");
    } finally {
      setIsTestingNotifications(false);
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!supabase) return;
    if (!canEdit('bookings')) {
      toast.error("You don't have permission to manage bookings");
      return;
    }

    const booking = bookings.find(b => b.booking_id === id);

    if (!confirm("Are you sure you want to delete this booking? This action cannot be undone.")) return;
    
    // Delete related records first to avoid foreign key constraints
    await supabase.from('notification_queue').delete().eq('booking_id', id);
    await supabase.from('booking_items').delete().eq('booking_id', id);
    await supabase.from('booking_passengers').delete().eq('booking_id', id);
    
    const { error } = await supabase.from('bookings').delete().eq('booking_id', id);
    if (error) {
      toast.error("Failed to delete booking");
      console.error(error);
    } else {
      toast.success("Booking Deleted");
      
      if (booking) {
        logActivity('delete', 'bookings', id, { 
          booking_reference: booking.booking_reference, 
          customer_name: booking.customer?.name 
        });
      }

      fetchAllData();
    }
  };

  const handleExportBookings = async () => {
    if (!exportDateRange.from || !exportDateRange.to) {
      toast.error("Please select a date range first");
      return;
    }

    setIsExporting(true);
    try {
      // Fetch all bookings within date range (ignoring pagination for export)
      const { data: exportData, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:customers(*),
          booking_passengers(*)
        `)
        .gte('created_at', exportDateRange.from.toISOString())
        .lte('created_at', exportDateRange.to.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!exportData || exportData.length === 0) {
        toast.info("No bookings found in the selected date range");
        return;
      }

      // Format data for Excel
      const formattedData = exportData.map(booking => {
        // Handle passenger details (can be multiple)
        const passengers = booking.booking_passengers || [];
        const passengerInfo = passengers.map((p: any, idx: number) => 
          `PAX ${idx + 1}: ${p.name || 'N/A'} (${p.type}, ${p.gender}, ${p.ic_passport_number || 'N/A'}, ${p.weight}kg, ${p.height}cm, ${p.country_of_origin || 'N/A'})`
        ).join(' | ');

        // Image IDs (URLs for front and back IDs of all passengers)
        const imageIds = passengers.map((p: any, idx: number) => 
          `PAX ${idx + 1} ID: [Front: ${p.id_front_url || 'None'}, Back: ${p.id_back_url || 'None'}]`
        ).join(' | ');

        return {
          'Booking Date': format(new Date(booking.created_at), 'EEEE d MMM yyyy HH:mm'),
          'Reference': booking.booking_reference,
          'Invoice ID': booking.invoice_id || '-',
          'Customer Name': booking.customer?.name || 'Guest',
          'Customer Email': booking.customer?.email || '-',
          'Customer Phone': booking.customer?.phone || '-',
          'Total Amount (RM)': booking.total_amount,
          'Paid Amount (RM)': booking.paid_amount || 0,
          'Payment Type': (booking.payment_type || 'full').toUpperCase(),
          'Deposit Amount (RM)': booking.deposit_amount || 0,
          'Booking Status': booking.status.toUpperCase(),
          'Payment Status': (booking.payment_status || 'unpaid').toUpperCase(),
          'Payment Method': booking.payment_method || '-',
          'Payment Gateway': booking.payment_gateway || 'CHIP',
          'Paid At': booking.paid_at ? format(new Date(booking.paid_at), 'EEEE d MMM yyyy HH:mm') : '-',
          'Flight Date': booking.flight_date ? format(new Date(booking.flight_date), 'EEEE d MMM yyyy') : '-',
          'Flight Time': booking.flight_time || '-',
          'Pilot Name': booking.pilot_name || '-',
          'Aircraft Reg': booking.aircraft_registration || '9M-BFF',
          'Num Passengers': passengers.length,
          'Passenger Details': passengerInfo,
          'Passenger Image IDs': imageIds,
          'Payment Proof URL': booking.payment_proof_url || '-',
          'Additional Items': booking.add_items_summary || '-',
          'Notes': booking.notes || '-'
        };
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bookings");

      // Generate filename
      const fileName = `Bookings_${format(exportDateRange.from, 'ddMMM')}_to_${format(exportDateRange.to, 'ddMMM')}.xlsx`;

      // Download
      XLSX.writeFile(wb, fileName);
      toast.success(`Exported ${exportData.length} bookings to Excel`);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error("Failed to export bookings: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      toast.error("Supabase is not configured. Please check your environment variables.");
      return;
    }
    
    // Security: Trim whitespace and normalize email
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Basic SQL Injection protection - check for common SQL patterns
    const sqlPatterns = /['";]|--|(\b(OR|AND)\b.*\b(=|>|<)\b)/i;
    if (sqlPatterns.test(cleanEmail)) {
      toast.error("Invalid characters detected in email.");
      return;
    }

    // Security Note: We do NOT apply sqlPatterns to the password.
    // Passwords should allow all special characters to remain strong.
    // Since we use Supabase (parameterized queries), special characters in 
    // passwords cannot trigger SQL injection.

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (cleanPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: cleanEmail, 
        password: cleanPassword 
      });
      
      if (error) {
        if (error.message.includes("Email not confirmed")) {
          toast.error("Your email is not confirmed. Please check your inbox for the confirmation link.");
        } else if (error.message.includes("Invalid login credentials")) {
          toast.error("Incorrect email or password. Please try again.");
        } else {
          toast.error("Login failed. Please try again later.");
          console.error('Auth error:', error.message);
        }
        return;
      }
      
      if (data.session) {
        const isSuperAdmin = cleanEmail === 'admin@oneday.com';
        const { data: profile, error: profileError } = await supabase
          .from('admin_users')
          .select('is_approved')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (profileError) {
          toast.error("Failed to verify approval status. Please try again.");
          await supabase.auth.signOut();
          return;
        }

        if (!isSuperAdmin && (!profile || !profile.is_approved)) {
          toast.error("Your account is pending approval. Please wait for admin approval.");
          await supabase.auth.signOut();
          return;
        }

        toast.success("Logged in successfully");
        await logActivity('login', 'auth', null, { email: cleanEmail });
      }
    } catch (err: any) {
      console.error('Login error:', err);
      toast.error("An unexpected error occurred during login.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    // Security: Trim whitespace and normalize email
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Basic SQL Injection protection
    const sqlPatterns = /['";]|--|(\b(OR|AND)\b.*\b(=|>|<)\b)/i;
    if (sqlPatterns.test(cleanEmail)) {
      toast.error("Invalid characters detected in email.");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (cleanPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    // 1. Sign up
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (authError) {
        if (authError.message.includes("User already registered")) {
          toast.error("This email is already registered. Please login or reset your password.");
        } else if (authError.message.includes("Password should be")) {
          toast.error("Password is too weak. Please use at least 6 characters.");
        } else {
          toast.error("Registration failed. Please try again.");
          console.error('Registration auth error:', authError.message);
        }
        return;
      }

      if (!authData.user) {
        toast.error("Account created but user data is missing. Please try again.");
        return;
      }

      const { error: profileError } = await supabase.from('admin_users').insert({
        id: authData.user.id,
        email: cleanEmail,
        role: registerRole,
        is_approved: cleanEmail === 'admin@oneday.com'
      });

      if (profileError) {
        if (profileError.code === '23505' || profileError.message?.includes("duplicate key")) {
          toast.error("This profile already exists. Please log in.");
        } else {
          toast.error("Account created but profile failed. Please contact support.");
          console.error('Profile creation error:', profileError.message);
        }
      } else {
        logActivity('register', 'auth', authData.user.id, { email: cleanEmail, role: registerRole });
      }

      toast.success("Registration submitted. Please verify your email and wait for admin approval.");
      setAuthView('login');
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error("An unexpected error occurred during registration.");
    }
  };

  const handleToggleApproval = async (userId: string, currentStatus: boolean) => {
    if (!supabase) return;
    if (!isAdmin()) {
      toast.error("Only admins can approve users");
      return;
    }
    const { error } = await supabase
      .from('admin_users')
      .update({ is_approved: !currentStatus })
      .eq('id', userId);

    if (error) toast.error(error.message);
    else {
      toast.success(currentStatus ? "User access revoked" : "User approved");
      logActivity(currentStatus ? 'revoke' : 'approve', 'admin_users', userId);
      fetchAdminData(); // Refresh admin list
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!supabase) return;
    if (!isAdmin()) {
      toast.error("Only admins can delete users");
      return;
    }
    
    if (email === 'admin@oneday.com') {
      toast.error("Cannot delete the main admin account");
      return;
    }

    if (!confirm(`Are you sure you want to delete user ${email}? This action cannot be undone.`)) {
      return;
    }

    const { error } = await supabase.rpc('delete_user_entirely', { user_id: userId });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("User deleted successfully from system");
      logActivity('delete', 'admin_users', userId, { email });
      fetchAdminData();
    }
  };

  const fetchAdminData = async () => {
    if (!supabase) return;
    const { data: { session: activeSession } } = await supabase.auth.getSession();
    if (!activeSession) return;
    const { data: users } = await supabase.from('admin_users').select('*').order('created_at', { ascending: false });
    const { data: rolePerms } = await supabase.from('role_permissions').select('*');
    if (users) setAdminUsers(users as AdminUser[]);
    if (rolePerms) setRolePermissions(rolePerms as RolePermission[]);
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await logActivity('logout', 'auth', null);
    await supabase.auth.signOut();
    setServices([]);
    setCurrentUserProfile(null);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !supabase) return;

    if (!canEdit(activeTab)) {
      toast.error("You don't have permission to edit this section");
      return;
    }

    const table = activeTab;
    const isEdit = Boolean(editingItem.id);
    const id = editingItem.id || crypto.randomUUID();
    let image_url = editingItem.image_url || "";
    let image_path = editingItem.image_path || "";

    if (table !== 'videos' && imageFile) {
      try {
        if (image_path) await supabase.storage.from(bucketName).remove([image_path]);
        
        const compressedFile = await compressFile(imageFile);
        const path = `${table}/${id}/image-${Date.now()}-${compressedFile.name}`;
        
        const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, compressedFile);
        if (uploadError) throw uploadError;
        
        image_url = supabase.storage.from(bucketName).getPublicUrl(path).data.publicUrl;
        image_path = path;
      } catch (err: any) {
        console.error("Image upload error:", err);
        toast.error(`Image upload failed: ${err.message}`);
        return;
      }
    }

    let images = editingItem.images || [];
    if (table === 'experiences' && multipleImageFiles.length > 0) {
      try {
        const uploadPromises = multipleImageFiles.map(async (file) => {
          const compressedFile = await compressFile(file);
          const path = `${table}/${id}/multi-${Date.now()}-${compressedFile.name}`;
          const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, compressedFile);
          if (uploadError) throw uploadError;
          return supabase.storage.from(bucketName).getPublicUrl(path).data.publicUrl;
        });
        
        const newUrls = await Promise.all(uploadPromises);
        images = [...images, ...newUrls];
      } catch (err: any) {
        console.error("Multiple images upload failed:", err);
        return toast.error(`Multiple images upload failed: ${err.message}`);
      }
    }

    // Clean the payload to only send fields that belong to the current table
    let payload: any = {};
    
    if (table === 'services') {
      payload = {
        title: editingItem.title,
        description: editingItem.description,
        label: editingItem.label,
        image_url: image_url,
        image_path: image_path
      };
    } else if (table === 'hero_slides') {
      payload = {
        title: editingItem.title,
        subtitle: editingItem.subtitle,
        image_url: image_url,
        image_path: image_path
      };
    } else if (table === 'experiences') {
      payload = {
        title: editingItem.title,
        description: editingItem.description,
        image_url: image_url,
        image_path: image_path,
        images: images
      };
    } else if (table === 'features') {
      payload = {
        title: editingItem.title,
        description: editingItem.description,
        icon_name: editingItem.icon_name,
        image_url: image_url,
        image_path: image_path,
        text_color: editingItem.text_color,
        text_size: editingItem.text_size,
        icon_color: editingItem.icon_color,
        icon_size: editingItem.icon_size
      };
    } else if (table === 'videos') {
      payload = {
        title: editingItem.title,
        vimeo_url: editingItem.vimeo_url?.trim(),
        vimeo_id: extractVimeoId(editingItem.vimeo_url || "")
      };
    } else if (table === 'categories') {
      const sortOrder = parseInt(String(editingItem.sort_order));
      const offerPercentage = parseFloat(String(editingItem.offer_percentage ?? ""));
      payload = {
        name: editingItem.name,
        icon: editingItem.icon,
        is_active: editingItem.is_active !== false,
        is_main_page: editingItem.is_main_page || false,
        sort_order: isNaN(sortOrder) ? undefined : sortOrder,
        offer_percentage: isNaN(offerPercentage) ? null : offerPercentage,
        offer_start: editingItem.offer_start || null,
        offer_end: editingItem.offer_end || null,
        offer_is_active: editingItem.offer_is_active || false,
        offer_image_url: editingItem.offer_image_url || null
      };
    } else if (table === 'packages') {
      const price = parseFloat(String(editingItem.price));
      const promotionPrice = editingItem.promotion_price ? parseFloat(String(editingItem.promotion_price)) : null;
      
      payload = {
        category_id: editingItem.category_id,
        name: editingItem.name,
        description: editingItem.description,
        price: isNaN(price) ? 0 : price,
        promotion_price: promotionPrice,
        promotion_start_at: editingItem.promotion_start_at || null,
        promotion_end_at: editingItem.promotion_end_at || null,
        is_active: editingItem.is_active !== false,
        image_url: image_url,
        image_path: image_path,
        sort_order: editingItem.sort_order ?? 0,
        google_maps_link: editingItem.google_maps_link || null
      };
    } else if (table === 'events') {
      payload = {
        name: editingItem.name,
        event_date: editingItem.event_date || (editingItem.start_time ? format(new Date(editingItem.start_time), "yyyy-MM-dd") : null),
        event_time: editingItem.event_time || (editingItem.start_time ? format(new Date(editingItem.start_time), "HH:mm") : null),
        event_id: editingItem.event_id?.trim() || null,
        start_time: editingItem.start_time,
        end_time: editingItem.end_time,
        location: editingItem.location || null,
        is_active: true,
        event_description: editingItem.event_description || null,
        event_program: editingItem.event_program || null,
        event_image_url: editingItem.event_image_url || null
      };
    }

    // Handle new category creation if category_id is a name instead of UUID
    if (table === 'packages' && payload.category_id) {
      const existingCategory = categories.find(c => c.id === payload.category_id);
      if (!existingCategory) {
        // Check if a category with this name already exists (case insensitive)
        const existingByName = categories.find(c => c.name.toLowerCase() === payload.category_id?.toLowerCase());
        
        if (existingByName) {
          payload.category_id = existingByName.id;
        } else {
          // It's truly a new name, need to create it
          const newCatName = payload.category_id;
          const newCatId = crypto.randomUUID();
          
          const nextOrder = categories.length > 0 
            ? Math.max(...categories.map((c) => c.sort_order || 0)) + 1 
            : 0;

          const { error: catError } = await supabase.from('categories').insert([{ 
            id: newCatId, 
            name: newCatName, 
            icon: 'Package', 
            sort_order: nextOrder,
            is_active: true,
            is_main_page: false
          }]);

          if (catError) {
            toast.error("Failed to create new category");
            return;
          }
          
          payload.category_id = newCatId;
        }
      }
    }

    let error;
    if (isEdit) {
      ({ error } = await supabase.from(table).update(payload).eq('id', id));
    } else {
      const items: SortableItemData[] = table === 'services' ? services : 
                    table === 'hero_slides' ? heroSlides : 
                    table === 'experiences' ? experiences : 
                    table === 'videos' ? videos :
                    table === 'categories' ? categories :
                    table === 'packages' ? packages : features;
      
      // Handle sort_order vs order column name difference
      const orderKey = (table === 'categories' || table === 'packages' || table === 'events') ? 'sort_order' : 'order';
      
      // Use user-provided order if available, otherwise calculate next order
      // Do not auto-number packages because sort_order represents Stage
      if (table !== 'packages' && (payload[orderKey] === undefined || payload[orderKey] === null)) {
        const nextOrder = items.length > 0 
          ? Math.max(...items.map((item: any) => (item.sort_order ?? item.order ?? 0))) + 1 
          : 0;
        payload[orderKey] = nextOrder;
      }

      ({ error } = await supabase.from(table).insert([{ id, ...payload }]));
    }

    if (error) toast.error("Save failed");
    else {
      // Save Add-ons if activeTab is packages
      if (table === 'packages' && supabase) {
         // Delete old links
         await supabase.from('package_addons').delete().eq('parent_package_id', id);
         
         // Insert new links
         if (linkedAddons.length > 0) {
            const addonPayload = linkedAddons.map(addon => ({
               parent_package_id: id,
               addon_package_id: addon.addon_id,
               sort_order: addon.sort_order
            }));
            await supabase.from('package_addons').insert(addonPayload);
         }
      }

      toast.success("Saved successfully");
      
      const logDetails: any = { 
        title: payload.title || payload.name || 'Untitled',
        ...payload 
      };
      
      if (table === 'packages' && linkedAddons.length > 0) {
        logDetails.linked_addons_count = linkedAddons.length;
      }

      logActivity(isEdit ? 'update' : 'insert', table, id, logDetails);
      setEditingItem(null);
      setImageFile(null);
      fetchAllData();
    }
  };

  const handleToggleMainPage = async (id: string, value: boolean) => {
    if (!supabase) return;
    if (!canEdit('categories')) {
      toast.error("You don't have permission to edit categories");
      return;
    }

    const { error } = await supabase
      .from('categories')
      .update({ is_main_page: value })
      .eq('id', id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Main page status updated");
      logActivity('update', 'categories', id, { is_main_page: value });
      setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, is_main_page: value } : cat));
    }
  };

  const handleToggleCategoryActive = async (id: string, value: boolean) => {
    if (!supabase) return;
    if (!canEdit('categories')) {
      toast.error("You don't have permission to edit categories");
      return;
    }

    const { error } = await supabase
      .from('categories')
      .update({ is_active: value })
      .eq('id', id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Category visibility updated");
      logActivity('update', 'categories', id, { is_active: value });
      setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, is_active: value } : cat));
    }
  };

  const handleDeleteItem = async (item: DeletableItem, tableOverride?: string) => {
    if (!confirm("Are you sure?")) return;
    if (!supabase) return;

    const table = tableOverride || activeTab;

    if (!canEdit(table)) {
      toast.error("You don't have permission to delete items from this section");
      return;
    }
    
    if (item.image_path) await supabase.storage.from(bucketName).remove([item.image_path]);
    
    const { error } = await supabase.from(table).delete().eq('id', item.id);
    if (error) {
      console.error("Delete error:", error);
      if (error.code === '23503') {
        toast.error("Cannot delete: This item is being used by other records (e.g. bookings or packages)");
      } else {
        toast.error("Delete failed: " + error.message);
      }
    }
    else {
      toast.success("Deleted");
      const itemTitle = 'name' in item ? item.name : ('title' in item ? item.title : 'Unknown Item');
      logActivity('delete', table, item.id, { item_title: itemTitle });
      fetchAllData();
    }
  };

  const handleRolePermissionChange = async (role: string, module: string, type: 'view' | 'edit', value: boolean) => {
    if (!supabase) return;
    
    // Optimistic update
    setRolePermissions(prev => {
      const existing = prev.find(p => p.role === role && p.module === module);
      if (existing) {
        return prev.map(p => 
          (p.role === role && p.module === module) 
            ? { ...p, [type === 'view' ? 'can_view' : 'can_edit']: value } 
            : p
        );
      } else {
        return [...prev, {
          id: 'temp-' + Date.now(),
          role,
          module,
          can_view: type === 'view' ? value : false,
          can_edit: type === 'edit' ? value : false
        }];
      }
    });

    // Database update
    const { data: existing } = await supabase.from('role_permissions')
      .select('id')
      .eq('role', role)
      .eq('module', module)
      .maybeSingle();

    if (existing) {
      await supabase.from('role_permissions')
        .update({ [type === 'view' ? 'can_view' : 'can_edit']: value })
        .eq('id', existing.id);
    } else {
      await supabase.from('role_permissions').insert({
        role,
        module,
        can_view: type === 'view' ? value : false,
        can_edit: type === 'edit' ? value : false
      });
    }
    logActivity('update', 'role_permissions', role, { module, type, value });
  };

  const handleBgDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = bgSections.findIndex((s) => s.id === active.id);
      const newIndex = bgSections.findIndex((s) => s.id === over?.id);
      const newOrder = arrayMove(bgSections, oldIndex, newIndex);
      
      setBgSections(newOrder);
      
      // Auto-save the new order to site_settings
      const orderString = JSON.stringify(newOrder.map(s => s.id));
      await handleUpdateSettings({ 'bg_sections_order': orderString });
      toast.success("Section arrangement saved");
    }
  };

  const applyReorder = async (table: string, newOrder: SortableItemData[]) => {
    if (!supabase) return;
    if (!canEdit(table)) {
      toast.error("You don't have permission to reorder items");
      return;
    }

    if (table === 'packages') {
      toast.error("Packages cannot be reordered via drag and drop because Sort Order represents Stage.");
      return;
    }

    if (table === 'services') setServices(newOrder as Service[]);
    else if (table === 'hero_slides') setHeroSlides(newOrder as HeroSlide[]);
    else if (table === 'experiences') setExperiences(newOrder as Experience[]);
    else if (table === 'videos') setVideos(newOrder as Video[]);
    else if (table === 'packages') setPackages(newOrder as Package[]);
    else if (table === 'categories') setCategories(newOrder as Category[]);
    else if (table === 'events') setEvents(newOrder as Event[]);
    else setFeatures(newOrder as Feature[]);

    const orderKey = (table === 'categories' || table === 'packages' || table === 'events') ? 'sort_order' : 'order';
    const updates = newOrder.map((item, index) => ({
      id: item.id,
      [orderKey]: index,
    }));

    await Promise.all(updates.map((item) =>
      supabase.from(table).update({ [orderKey]: (item as any)[orderKey] }).eq('id', item.id)
    ));

    logActivity('reorder', table, 'batch', { count: updates.length });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !supabase) return;

    const table = activeTab;
    let currentItems: SortableItemData[];
    
    if (table === 'services') currentItems = services;
    else if (table === 'hero_slides') currentItems = heroSlides;
    else if (table === 'experiences') currentItems = experiences;
    else if (table === 'videos') currentItems = videos;
    else if (table === 'packages') currentItems = packages;
    else if (table === 'categories') currentItems = categories;
    else if (table === 'events') currentItems = events;
    else currentItems = features;
    
    const oldIndex = currentItems.findIndex((i) => i.id === active.id);
    const newIndex = currentItems.findIndex((i) => i.id === over.id);
    const newOrder = arrayMove(currentItems, oldIndex, newIndex);
    await applyReorder(table, newOrder);
  };

  const handleAddItemForTab = (table: string) => {
    if (!canEdit(table)) {
      toast.error("You don't have permission to add items to this section");
      return;
    }
    setEditingItem({});
    setImageFile(null);
    setMultipleImageFiles([]);
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        const formElement = document.querySelector('form');
        if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleEditItemForTab = (item: SortableItemData) => {
    setEditingItem(item);
    setImageFile(null);
    setMultipleImageFiles([]);
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        const formElement = document.querySelector('form');
        if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleDeleteById = (table: string, items: SortableItemData[], id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    handleDeleteItem(item as DeletableItem, table);
  };

  const handlePolicySave = async (key: string, content: string) => {
    if (!supabase) return;

    if (!canEdit('settings') && !canEdit('content')) {
      toast.error("You don't have permission to update policies");
      return;
    }

    const { error } = await supabase.from('site_settings').upsert({
      key,
      value: content,
      category: 'policies'
    });

    if (error) {
      toast.error("Failed to update policy");
      console.error(error);
    } else {
      setSettings(prev => ({ ...prev, [key]: content }));
      toast.success("Policy saved successfully");
      logActivity('update', 'site_settings', key, { category: 'policies' });
    }
  };

  const handleUpdateSettings = async (updates: Record<string, string | undefined>, styles?: Record<string, any>) => {
    if (!supabase) return;

    if (!canEdit('settings')) {
      toast.error("You don't have permission to update settings");
      return;
    }

    const allKeys = new Set([...Object.keys(updates), ...Object.keys(styles || {})]);
    const upsertData = Array.from(allKeys)
      .map(key => {
        const value = updates[key] ?? settings[key] ?? '';
        const style = styles?.[key] ?? localStyles[key] ?? settingsStyles[key] ?? {};
        
        // Only include if there's an actual change in value or style
        const valueChanged = updates[key] !== undefined && updates[key] !== settings[key];
        const styleChanged = styles?.[key] !== undefined && JSON.stringify(styles[key]) !== JSON.stringify(settingsStyles[key]);
        
        if (valueChanged || styleChanged) {
          return { key, value, style };
        }
        return null;
      })
      .filter((item): item is { key: string, value: string, style: any } => item !== null);

    if (upsertData.length === 0) return;

    const { error } = await supabase.from('site_settings').upsert(upsertData);
    
    if (error) {
      toast.error("Failed to update settings");
      console.error(error);
    } else {
      setSettings(prev => ({ ...prev, ...updates }));
      if (styles) {
        setSettingsStyles(prev => ({ ...prev, ...styles }));
      }
      
      const savedKeys = upsertData.map(d => d.key);
      
      setLocalSettings(prev => {
        const newState = { ...prev };
        savedKeys.forEach(key => delete newState[key]);
        return newState;
      });
      setLocalStyles(prev => {
        const newState = { ...prev };
        savedKeys.forEach(key => delete newState[key]);
        return newState;
      });
      toast.success("Settings saved successfully");
      logActivity('update', 'site_settings', 'bulk', { updates, styles });
    }
  };

  const handleSettingFileUpload = async (key: string, file: File) => {
    if (!supabase || !canEdit('settings')) return;

    const toastId = toast.loading(`Uploading ${key.replace('_', ' ')}...`);
    
    try {
      const compressedFile = await compressFile(file);

      // 1. Check if we have an old path to delete
      const oldUrl = settings[key];
      if (oldUrl) {
        // Extract path from URL if it's from our storage
        const urlParts = oldUrl.split(`${bucketName}/`);
        if (urlParts.length > 1) {
          const oldPath = urlParts[1].split('?')[0]; // remove query params
          await supabase.storage.from(bucketName).remove([oldPath]);
        }
      }

      // 2. Upload new file
      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const path = `settings/${key}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, compressedFile);
      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from(bucketName).getPublicUrl(path).data.publicUrl;

      // 3. Update setting in DB
      const { error: dbError } = await supabase.from('site_settings').upsert({ key, value: publicUrl });
      if (dbError) throw dbError;

      setSettings(prev => ({ ...prev, [key]: publicUrl }));
      toast.success("File updated successfully", { id: toastId });
      logActivity('upload', 'site_settings', key, { url: publicUrl });
    } catch (error: any) {
      console.error(error);
      toast.error(`Upload failed: ${error.message}`, { id: toastId });
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    if (!supabase) return;

    if (!canEdit('settings')) {
      toast.error("You don't have permission to update settings");
      return;
    }

    const { error } = await supabase.from('site_settings').upsert({ key, value });
    if (error) toast.error("Failed to update setting");
    else {
      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success("Setting updated");
      logActivity('update', 'site_settings', key, { value });
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent p-4 flex-col gap-4">
        <Card className="w-full max-w-md bg-gradient-to-br from-[#4a4a4a] via-[#3d3d3d] to-[#1a1a1a] border-white/10 shadow-2xl">
          <CardHeader>
            <div className="flex justify-center mb-6">
              <img 
                src={settings.site_logo_login || "/logooneday.jpeg"} 
                alt="OneDayPilot Logo" 
                className="h-32 md:h-40 w-auto object-contain" 
                style={!settings.site_logo_login ? { filter: "url(#remove-black-bg)" } : {}}
              />
            </div>
            <CardTitle className="text-[11px] sm:text-xs text-center text-white font-heading tracking-wide">
              {authView === 'login' ? 'Admin Login' : 'Request Admin Access'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={authView === 'login' ? handleLogin : handleRegister} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] sm:text-xs font-bold text-white/90">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] sm:text-xs font-bold text-white/90">Password</label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10" 
                    autoComplete="current-password" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              
              {authView === 'register' && (
                <div className="space-y-2">
                  <label className="text-[11px] sm:text-xs font-bold text-white/90">Requested Role</label>
                  <Select value={registerRole} onValueChange={setRegisterRole}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2d2d2d] border-white/10 text-white">
                      {AVAILABLE_ROLES.map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg transition-all duration-300 font-bold">
                {authView === 'login' ? 'Login' : 'Submit Request'}
              </Button>
              
              <div className="text-center text-[11px] sm:text-xs font-bold">
                {authView === 'login' ? (
                  <button type="button" onClick={() => setAuthView('register')} className="text-white/70 hover:text-white hover:underline transition-colors">
                    Need an account? Request Access
                  </button>
                ) : (
                  <button type="button" onClick={() => setAuthView('login')} className="text-white/70 hover:text-white hover:underline transition-colors">
                    Already have an account? Login
                  </button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
        <Link 
          to="/" 
          className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-900 hover:text-slate-800 transition-colors self-center mt-4 font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Main Page
        </Link>
      </div>
    );
  }

  // Approval Check
  if (currentUserProfile && !currentUserProfile.is_approved) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent p-4 flex-col gap-4">
        <Card className="w-full max-w-md border-black">
          <CardHeader>
            <CardTitle className="text-[11px] sm:text-xs text-center text-yellow-600">Account Pending Approval</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p>Your account ({currentUserProfile.email}) is currently waiting for admin approval.</p>
            <p className="text-[11px] sm:text-xs text-slate-900">Please contact an administrator or wait for your access to be granted.</p>
            <Button onClick={handleLogout} variant="secondary" className="w-full border-black shadow-sm">Logout</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "min-h-screen relative overflow-x-auto",
        activeTab === 'event_template' ? "p-0 sm:p-2 md:p-4" : "p-2 sm:p-4 md:p-8"
      )}
      style={{ background: settings.bg_gradient_tab_section || settings.tab_section_bg_color || 'transparent' }}
    >
      <BackgroundParticles variant="light" />
        <div className={cn(
        "mx-auto relative z-10 w-full", 
        (activeTab === 'event_template' || activeTab === 'content' || activeTab === 'starwars_section') ? "max-w-7xl px-4 sm:px-6 lg:px-8" : 
        "max-w-6xl px-4 sm:px-4"
      )}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <Link 
              to="/" 
              className="p-1.5 sm:p-2 hover:bg-background rounded-full transition-colors flex-shrink-0"
              title="Back to Main Page"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <h1 className="text-[11px] sm:text-xs font-bold font-heading truncate text-white">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {currentUserProfile && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-muted rounded-full text-[11px] sm:text-xs font-bold text-muted-foreground border whitespace-nowrap">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                {currentUserProfile.role}
              </div>
            )}
            <Button variant="secondary" size="sm" onClick={handleLogout} className="gap-1.5 sm:gap-2 text-[11px] sm:text-xs border-black shadow-sm h-8 sm:h-10">
              <LogOut className="w-3.5 h-3.5 sm:w-4 h-4" /> 
              <span>Logout</span>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setEditingItem(null); setImageFile(null); }} className="space-y-4 sm:space-y-8">
          <TabsList className="flex flex-wrap h-auto gap-1 sm:gap-2 bg-transparent p-0">
            {(canView('hero_slides') || canView('experiences') || canView('services') || canView('features') || canView('videos') || canView('settings')) && (
              <Accordion type="single" collapsible className="w-full md:w-auto border border-black/20 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm bg-white overflow-hidden">
                <AccordionItem value="main_content" className="border-none">
                  <AccordionTrigger className={cn(
                      "flex gap-2 px-6 py-2 h-12 hover:no-underline transition-all text-[11px] sm:text-xs font-black uppercase tracking-widest rounded-[2.5rem]",
                      isMainContentActive && "bg-primary text-white shadow-sm",
                      activeTab === 'section_backgrounds' && "bg-primary text-white shadow-sm"
                    )}>
                      <Layout className="w-4 h-4" /> <span className="font-black">Content Management</span>
                    </AccordionTrigger>
                  <AccordionContent 
                     className="flex flex-wrap gap-2 p-2 transition-colors duration-300 bg-slate-50/80 backdrop-blur-sm"
                   >
                    {canView('hero_slides') && (
                      <TabsTrigger value="hero_slides" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-background data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 h-11 rounded-xl font-black uppercase tracking-widest">
                        <Image className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="font-black">Hero</span>
                      </TabsTrigger>
                    )}
                    {canView('settings') && (
                      <TabsTrigger value="booking_wizard" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-background data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 h-11 rounded-xl font-black uppercase tracking-widest">
                        <img src={eventHero} className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm object-cover grayscale" alt="" /> <span className="font-black">Booking Wizard</span>
                      </TabsTrigger>
                    )}
                    {canView('experiences') && (
                      <TabsTrigger value="experiences" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-background data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 h-11 rounded-xl font-black uppercase tracking-widest">
                        <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="font-black">Experiences</span>
                      </TabsTrigger>
                    )}
                    {canView('services') && (
                      <TabsTrigger value="services" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-background data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 h-11 rounded-xl font-black uppercase tracking-widest">
                        <Layout className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="font-black">Services</span>
                      </TabsTrigger>
                    )}
                    {canView('features') && (
                      <TabsTrigger value="features" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-background data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 h-11 rounded-xl font-black uppercase tracking-widest">
                        <Layout className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="font-black">Features</span>
                      </TabsTrigger>
                    )}
                    {canView('videos') && (
                      <TabsTrigger value="videos" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-background data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 h-11 rounded-xl shadow-sm transition-all font-black uppercase tracking-widest">
                        <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="font-black">Videos</span>
                      </TabsTrigger>
                    )}
                    {canView('settings') && (
                      <TabsTrigger value="content" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-background data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 h-11 rounded-xl shadow-sm transition-all font-black uppercase tracking-widest">
                        <Layout className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="font-black">Content</span>
                      </TabsTrigger>
                    )}
                    {canView('settings') && (
                      <TabsTrigger value="starwars_section" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-background data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 h-11 rounded-xl shadow-sm transition-all font-black uppercase tracking-widest">
                        <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="font-black">Star Wars Section</span>
                      </TabsTrigger>
                    )}
                    {canView('settings') && (
                      <TabsTrigger value="section_backgrounds" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-3 sm:px-4 py-2 h-11 rounded-xl shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                        <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="font-black">Section Backgrounds</span>
                      </TabsTrigger>
                    )}
                    {canView('settings') && (
                      <TabsTrigger value="about" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-3 sm:px-4 py-2 h-11 rounded-xl shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                        <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="font-black">About Page</span>
                      </TabsTrigger>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {(canView('settings') || canView('content')) && (
              <Accordion type="single" collapsible className="w-full md:w-auto border border-black/20 rounded-xl shadow-sm bg-white overflow-hidden transition-all">
                <AccordionItem value="policies" className="border-none">
                  <AccordionTrigger className={cn(
                    "flex gap-2 px-4 py-1.5 h-10 hover:no-underline transition-all text-[11px] sm:text-xs font-black uppercase tracking-widest rounded-xl",
                    isPoliciesActive && "bg-primary text-white shadow-sm",
                  )}>
                    <Scale className="w-4 h-4" /> <span className="font-black">Legal & Policies</span>
                  </AccordionTrigger>
                  <AccordionContent 
                     className="flex flex-wrap gap-2 p-3 transition-colors duration-300 bg-slate-50/50"
                   >
                    <TabsTrigger value="policy_terms" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all">
                      <FileText className="w-3.5 h-3.5" /> <span className="font-black">Terms & Conditions</span>
                    </TabsTrigger>
                    <TabsTrigger value="policy_privacy" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all">
                      <ShieldCheck className="w-3.5 h-3.5" /> <span className="font-black">Privacy Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="policy_refund" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all">
                      <CreditCard className="w-3.5 h-3.5" /> <span className="font-black">Refund Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="policy_cancellation" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all">
                      <XCircle className="w-3.5 h-3.5" /> <span className="font-black">Cancellation Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="policy_rules" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all">
                      <CheckCircle2 className="w-3.5 h-3.5" /> <span className="font-black">Booking Rules</span>
                    </TabsTrigger>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {canView('categories') && (
              <TabsTrigger value="categories" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                <Tag className="w-3.5 h-3.5" /> <span className="font-black">Categories</span>
              </TabsTrigger>
            )}
            {canView('packages') && (
              <TabsTrigger value="packages" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                <ShoppingBagIcon className="w-3.5 h-3.5" /> <span className="font-black">Pricing</span>
              </TabsTrigger>
            )}
            {canView('reviews') && (
              <TabsTrigger value="reviews" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                <MessageCircle className="w-3.5 h-3.5" /> <span className="font-black">Reviews</span>
              </TabsTrigger>
            )}
            {canView('bookings') && (
              <TabsTrigger value="bookings" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                <img src={eventHero} className="w-3.5 h-3.5 rounded-sm object-cover grayscale" alt="" /> <span className="font-black">Bookings</span>
              </TabsTrigger>
            )}
            {canView('registrations') && (
              <Accordion type="single" collapsible className="w-full md:w-auto border border-black/20 rounded-xl shadow-sm bg-white overflow-hidden transition-all duration-300">
                <AccordionItem value="event_mgmt" className="border-none">
                  <AccordionTrigger className={cn(
                    "flex gap-2 px-4 py-1.5 h-10 hover:no-underline transition-all text-[11px] sm:text-xs font-black uppercase tracking-widest rounded-xl",
                    isEventActive && "bg-primary text-white shadow-sm",
                  )}>
                    <QrCode className="w-4 h-4" /> <span className="font-black">Event Management</span>
                  </AccordionTrigger>
                  <AccordionContent 
                     className="flex flex-wrap gap-2 p-3 transition-colors duration-300 bg-slate-50/50"
                   >
                    <TabsTrigger value="registrations" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/10 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                      <QrCode className="w-3.5 h-3.5" /> <span className="font-black">Events & Registrations</span>
                    </TabsTrigger>
                    {canView('event_template') && (
                      <TabsTrigger value="event_template" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/10 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                        <FileText className="w-3.5 h-3.5" /> <span className="font-black">Event Config</span>
                      </TabsTrigger>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {canView('analytics') && (
              <TabsTrigger value="analytics" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                <BarChart3 className="w-3.5 h-3.5" /> <span className="font-black">Analytics</span>
              </TabsTrigger>
            )}
            {canView('safety') && (
              <TabsTrigger value="safety" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                <ShieldCheck className="w-3.5 h-3.5" /> <span className="font-black">Safety</span>
              </TabsTrigger>
            )}

            {(canView('settings') || canView('logs')) && (
              <Accordion type="single" collapsible className="w-full md:w-auto border border-black/20 rounded-xl shadow-sm bg-white overflow-hidden transition-all duration-300">
                <AccordionItem value="config" className="border-none">
                  <AccordionTrigger className={cn(
                    "flex gap-2 px-4 py-1.5 h-10 hover:no-underline transition-all text-[11px] sm:text-xs font-black uppercase tracking-widest rounded-xl",
                    isConfigActive && "bg-primary text-white shadow-sm",
                  )}>
                    <Settings className="w-4 h-4" /> <span className="font-black">Configuration</span>
                  </AccordionTrigger>
                  <AccordionContent 
                     className="flex flex-wrap gap-2 p-3 transition-colors duration-300 bg-slate-50/50"
                   >
                    {canView('settings') && (
                      <TabsTrigger value="email_config" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                        <Mail className="w-3.5 h-3.5" /> <span className="font-black">Email Config</span>
                      </TabsTrigger>
                    )}
                    {canView('settings') && (
                      <TabsTrigger value="whatsapp_config" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                        <MessageSquare className="w-3.5 h-3.5" /> <span className="font-black">WhatsApp Config</span>
                      </TabsTrigger>
                    )}
                    {canView('settings') && (
                      <TabsTrigger value="payments" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                        <CreditCard className="w-3.5 h-3.5" /> <span className="font-black">Payment config</span>
                      </TabsTrigger>
                    )}
                    {canView('settings') && (
                      <TabsTrigger value="hours_config" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                        <Clock className="w-3.5 h-3.5" /> <span className="font-black">Business Hours</span>
                      </TabsTrigger>
                    )}
                    {canView('settings') && (
                      <TabsTrigger value="doc_templates" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                        <FileCheck className="w-3.5 h-3.5" /> <span className="font-black">Templates doc</span>
                      </TabsTrigger>
                    )}
                    {canView('settings') && (
                      <TabsTrigger value="logs" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                        <FileText className="w-3.5 h-3.5" /> <span className="font-black">Logs Whatsapp&Email</span>
                      </TabsTrigger>
                    )}
                    {canView('settings') && (
                      <TabsTrigger value="watermark_config" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                        <Camera className="w-3.5 h-3.5" /> <span className="font-black">Camera Watermark</span>
                      </TabsTrigger>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {isAdmin() && (
              <TabsTrigger value="activity_logs" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                <Activity className="w-3.5 h-3.5" /> <span className="font-black">Activity Logs</span>
              </TabsTrigger>
            )}

            {isAdmin() && (
              <TabsTrigger value="users" className="flex-grow md:flex-none gap-1.5 sm:gap-2 border border-black/20 bg-white data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 h-9 rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95">
                <UserPlus className="w-3.5 h-3.5" /> <span className="font-black">Users</span>
              </TabsTrigger>
            )}
          </TabsList>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* List Section */}
            <div className={activeTab === 'analytics' || activeTab === 'bookings' || activeTab === 'users' || activeTab === 'registrations' || activeTab === 'safety' || activeTab === 'payments' || activeTab === 'doc_templates' || activeTab === 'email_config' || activeTab === 'whatsapp_config' || activeTab === 'logs' || activeTab === 'activity_logs' || activeTab === 'policy_terms' || activeTab === 'policy_privacy' || activeTab === 'policy_refund' || activeTab === 'policy_cancellation' || activeTab === 'policy_rules' || activeTab === 'hours_config' || activeTab === 'watermark_config' || activeTab === 'about' || activeTab === 'section_backgrounds' || activeTab === 'booking_wizard' || activeTab === 'event_template' || activeTab === 'starwars_section' ? "lg:col-span-3" : "lg:col-span-2"}>
              <Card className={cn(
                "border-black/5 shadow-xl shadow-slate-200/50 overflow-hidden bg-white/50 backdrop-blur-sm",
                activeTab === 'event_template' ? "rounded-none sm:rounded-xl" : "rounded-[2.5rem]"
              )}>
                <CardHeader className={cn(
                  "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-black/5 bg-slate-50/50",
                  activeTab === 'event_template' ? "p-3 sm:p-5" : "p-3 sm:p-4"
                )}>
                  <CardTitle className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-primary rounded-full" />
                    {activeTab === 'registrations' ? 'Registrations' : 
                     activeTab === 'event_template' ? 'Event Settings' : 
                     activeTab === 'email_config' ? 'Email Settings' :
                     activeTab === 'whatsapp_config' ? 'WhatsApp Settings' :
                     activeTab === 'doc_templates' ? 'Document Templates' :
                     activeTab === 'payments' ? 'Payment Settings' :
                     activeTab === 'logs' ? 'Notification Logs' :
                     activeTab === 'activity_logs' ? 'Activity History' :
                     activeTab.replace('_', ' ')}
                  </CardTitle>
                  {activeTab !== 'settings' && activeTab !== 'content' && activeTab !== 'safety' && activeTab !== 'reviews' && activeTab !== 'bookings' && activeTab !== 'analytics' && activeTab !== 'users' && activeTab !== 'registrations' && activeTab !== 'categories' && activeTab !== 'event_template' && activeTab !== 'payments' && activeTab !== 'doc_templates' && activeTab !== 'email_config' && activeTab !== 'whatsapp_config' && activeTab !== 'logs' && activeTab !== 'activity_logs' && activeTab !== 'policy_terms' && activeTab !== 'policy_privacy' && activeTab !== 'policy_refund' && activeTab !== 'policy_cancellation' && activeTab !== 'policy_rules' && activeTab !== 'hours_config' && activeTab !== 'watermark_config' && activeTab !== 'about' && activeTab !== 'section_backgrounds' && activeTab !== 'booking_wizard' && activeTab !== 'hero_slides' && activeTab !== 'services' && activeTab !== 'experiences' && activeTab !== 'features' && activeTab !== 'videos' && activeTab !== 'starwars_section' && canEdit(activeTab) && (
                    <Button 
                      size="lg" 
                      onClick={() => {
                        handleAddItemForTab(activeTab);
                      }} 
                      className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all font-black uppercase tracking-widest text-[11px] sm:text-xs h-11 px-6 sm:px-8 active:scale-[0.98] rounded-xl w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add New
                    </Button>
                  )}
                </CardHeader>
                <CardContent className={cn(
                  activeTab === 'event_template' ? "p-2 sm:p-6" : "p-3 sm:p-4"
                )}>
                  {(() => { if (activeTab === 'policy_terms') { return (
                    <PolicyEditor
                      title="Terms & Conditions"
                      initialContent={settings['policy_terms'] || ''}
                      onSave={(content) => handlePolicySave('policy_terms', content)}
                    />
                  );
                }
                else if (activeTab === 'policy_privacy') { return (
                    <PolicyEditor
                      title="Privacy Policy"
                      initialContent={settings['policy_privacy'] || ''}
                      onSave={(content) => handlePolicySave('policy_privacy', content)}
                    />
                  );
                }
                else if (activeTab === 'policy_refund') { return (
                    <PolicyEditor
                      title="Refund Policy"
                      initialContent={settings['policy_refund'] || ''}
                      onSave={(content) => handlePolicySave('policy_refund', content)}
                    />
                  );
                }
                else if (activeTab === 'policy_cancellation') { return (
                    <PolicyEditor
                      title="Cancellation Policy"
                      initialContent={settings['policy_cancellation'] || ''}
                      onSave={(content) => handlePolicySave('policy_cancellation', content)}
                    />
                  );
                }
                else if (activeTab === 'policy_rules') { return (
                    <PolicyEditor
                      title="Booking Rules"
                      initialContent={settings['policy_rules'] || ''}
                      onSave={(content) => handlePolicySave('policy_rules', content)}
                    />
                  );
                }
                else if (activeTab === 'doc_templates') { return (
                    <DocumentTemplates />
                  );
                }
                else if (activeTab === 'email_config') { return (
                    <EmailConfig onUpdate={fetchAllData} />
                  );
                }
                else if (activeTab === 'whatsapp_config') { return (
                    <div className="space-y-4">
                      <div className="space-y-3 border-b border-black/5 pb-4">
                        <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Bot Connection</h3>
                        <div className="space-y-1">
                          <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">WhatsApp Bot API URL</label>
                          <Input 
                            value={localSettings.whatsapp_api_url ?? settings.whatsapp_api_url ?? import.meta.env.VITE_WHATSAPP_API_URL ?? ""} 
                            onChange={(e) => handleLocalSettingChange('whatsapp_api_url', e.target.value)} 
                            placeholder="https://your-bot.fly.dev" 
                            className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                          />
                          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">The URL where your WhatsApp bot is hosted. Do not include trailing slash.</p>
                        </div>
                        <div className="space-y-2">
                          <WhatsAppConnector apiUrl={localSettings.whatsapp_api_url ?? settings.whatsapp_api_url} />
                        </div>
                      </div>
                      <WhatsAppConfig />
                    </div>
                  );
                }
                else if (activeTab === 'hours_config') { return (
                    <BusinessHoursConfig />
                  );
                }
                else if (activeTab === 'logs') { return (
                    <NotificationLogs />
                  );
                }
                else if (activeTab === 'watermark_config') { return (
                    <WatermarkConfig />
                  );
                }
                else if (activeTab === 'activity_logs') { return (
                    <ActivityLogs />
                  );
                }
                else if (activeTab === 'analytics') { return (
                    <Tabs defaultValue="visitor" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-5 border border-black/20 p-1 h-10 sm:h-11 bg-white/50 backdrop-blur-md rounded-[1.25rem] sm:rounded-[2rem] shadow-xl shadow-primary/80/5">
                        <TabsTrigger 
                          value="visitor" 
                          className="border border-black/20 data-[state=active]:bg-primary data-[state=active]:text-white rounded-[1.25rem] sm:rounded-[1.75rem] flex items-center justify-center gap-2 sm:gap-3 font-black uppercase tracking-widest h-full text-[11px] sm:text-xs transition-all duration-300 data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20"
                        >
                          <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="truncate">Visitor Data</span>
                        </TabsTrigger>
                        <TabsTrigger 
                          value="financial" 
                          className="border border-black/20 data-[state=active]:bg-primary data-[state=active]:text-white rounded-[1.25rem] sm:rounded-[1.75rem] flex items-center justify-center gap-2 sm:gap-3 font-black uppercase tracking-widest h-full text-[11px] sm:text-xs transition-all duration-300 data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20"
                        >
                          <Plane className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="truncate">Financials</span>
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="visitor" className="space-y-4 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white/70 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-black/5 shadow-xl shadow-primary/80/5 mb-2">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                              <BarChart3 className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <h2 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight leading-tight">Visitor Analytics</h2>
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Behavior, devices, and traffic patterns</p>
                            </div>
                          </div>
                        </div>
                        <AnalyticsDashboard settings={settings} />
                      </TabsContent>

                      <TabsContent value="financial" className="space-y-4 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white/70 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-black/5 shadow-xl shadow-primary/80/5 mb-2">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                              <Plane className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <h2 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight leading-tight">Financial Analytics</h2>
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Revenue, bookings, and growth metrics</p>
                            </div>
                          </div>
                        </div>
                        <FinancialAnalytics 
                          currentUser={currentUserProfile} 
                          refreshTrigger={analyticsRefreshTrigger}
                        />
                      </TabsContent>
                    </Tabs>
                  );
                }
                else if (activeTab === 'registrations') { return (
                    <div className="space-y-1 animate-in fade-in slide-in-from-bottom-6 duration-700">
                      {/* Calendar Section */}
                      <div className="flex justify-center">
                        <Card className="w-full max-w-lg border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/80/5 rounded-xl overflow-hidden group hover:shadow-2xl transition-all duration-500">
                          <CardHeader className="p-3 pb-2 border-b border-black/5 bg-white/50 backdrop-blur-md">
                            <CardTitle className="text-[11px] sm:text-xs flex items-center gap-1.5 font-black text-slate-900 uppercase tracking-tight">
                              <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500 overflow-hidden">
                                <img src={eventHero} className="w-3 h-3 sm:w-3.5 sm:h-3.5 object-cover grayscale brightness-200" alt="" />
                              </div>
                              Event Calendar
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-1 sm:p-2">
                            <div className="bg-slate-50/50 rounded-xl p-1.5 sm:p-2 border border-black/5 shadow-inner">
                              <Calendar
                                mode="single"
                                selected={selectedCalendarDate}
                                onSelect={(date) => {
                                  setSelectedCalendarDate(date);
                                  if (date) {
                                    const event = events.find(e => {
                                      const eDate = new Date(e.event_date + 'T00:00:00');
                                      return eDate.toDateString() === date.toDateString();
                                    });
                                    setSelectedCalendarEvent(event || null);
                                    if (event) {
                                      setFilterEventId(event.id);
                                      setIsEventDetailsOpen(true);
                                    } else {
                                      setFilterEventId('all');
                                      setFilterDate(date);
                                    }
                                  } else {
                                    setFilterEventId('all');
                                    setFilterDate(undefined);
                                  }
                                }}
                                className="rounded-xl border-none shadow-none mx-auto p-0"
                                modifiers={{
                                  event: (date) => events.some(e => new Date(e.event_date + 'T00:00:00').toDateString() === date.toDateString()),
                                  upcoming: (date) => events.some(e => {
                                    const eDate = new Date(`${e.event_date}T${e.event_time}`);
                                    return eDate.toDateString() === date.toDateString() && eDate > new Date();
                                  }),
                                  expired: (date) => events.some(e => {
                                    const eDate = new Date(`${e.event_date}T${e.event_time}`);
                                    return eDate.toDateString() === date.toDateString() && eDate <= new Date();
                                  })
                                }}
                                modifiersClassNames={{
                                  event: "font-black underline text-primary ring-2 ring-primary/10 rounded-lg",
                                  upcoming: "bg-primary text-white hover:bg-primary/90 rounded-lg font-black shadow-lg shadow-primary/20",
                                  expired: "bg-slate-400 text-white hover:bg-slate-500 rounded-lg font-black opacity-60 shadow-sm"
                                }}
                              />
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1 px-1">
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/5/50 rounded-full border border-primary/10 shadow-sm transition-all hover:bg-primary/5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-lg shadow-primary/20 ring-2 ring-primary/10"></span>
                                <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary/90">Upcoming</span>
                              </div>
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100/50 rounded-full border border-slate-200 shadow-sm transition-all hover:bg-slate-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shadow-md ring-2 ring-slate-100"></span>
                                <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Expired</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Event Details Popout */}
                      <Dialog open={isEventDetailsOpen} onOpenChange={setIsEventDetailsOpen}>
                        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 overflow-hidden rounded-xl border-black/5 shadow-2xl backdrop-blur-2xl bg-white/95 animate-in fade-in zoom-in-95 duration-500">
                          {selectedCalendarEvent && (
                            <>
                              <DialogHeader className="p-3 pb-2 border-b border-black/5 bg-white/50 backdrop-blur-md">
                                <div className="flex items-center justify-between pr-14">
                                  <DialogTitle className="text-[11px] sm:text-xs flex items-center gap-2 font-black text-slate-900 uppercase tracking-tight">
                                    <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                                      <FileText className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    Event Details
                                  </DialogTitle>
                                  {canEdit('registrations') && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-lg transition-all active:scale-95"
                                      onClick={() => {
                                        handleDeleteEvent(selectedCalendarEvent.id);
                                        setIsEventDetailsOpen(false);
                                      }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </DialogHeader>
                              <div className="p-2.5 sm:p-3 space-y-2.5 sm:space-y-3 overflow-y-auto max-h-[70vh]">
                                <div className="space-y-2">
                                  <h4 className="text-[11px] sm:text-xs font-black text-primary line-clamp-2 tracking-tighter uppercase leading-[1.1] drop-shadow-sm animate-in fade-in slide-in-from-left-4 duration-500">{selectedCalendarEvent.name}</h4>
                                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 animate-in fade-in slide-in-from-left-6 duration-700 delay-100">
                                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-slate-900 bg-white/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-black/5 shadow-sm uppercase tracking-widest hover:bg-white transition-all overflow-hidden">
                                      {(() => {
                                        let imgUrl = selectedCalendarEvent.event_image_url;
                                        if (selectedCalendarEvent.event_profile_id) {
                                          const profile = eventProfiles.find(p => p.id === selectedCalendarEvent.event_profile_id);
                                          if (profile?.event_hero_image) {
                                            imgUrl = profile.event_hero_image;
                                          }
                                        }
                                        return imgUrl ? (
                                          <img src={imgUrl} className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full object-cover" alt="" />
                                        ) : (
                                          <img src={eventHero} className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full object-cover" alt="" />
                                        );
                                      })()}
                                      {format(new Date(selectedCalendarEvent.event_date + 'T00:00:00'), "EEEE d MMM yyyy")}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-slate-900 bg-white/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-black/5 shadow-sm uppercase tracking-widest hover:bg-white transition-all">
                                      <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
                                      {selectedCalendarEvent.event_time}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-slate-900 bg-white/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-black/5 shadow-sm uppercase tracking-widest hover:bg-white transition-all">
                                      <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
                                      <span className="max-w-[100px] sm:max-w-[150px] truncate">
                                        {selectedCalendarEvent.location || settings[`event_location_${selectedCalendarEvent.id}`] || settings['event_location'] || 'Location TBA'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                                  <div className="p-2.5 sm:p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-black/5 shadow-sm group/status hover:shadow-md transition-all active:scale-[0.98]">
                                    <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-[0.2em] mb-2 leading-none">Status</p>
                                    <div className="flex items-center gap-2">
                                      {new Date(`${selectedCalendarEvent.event_date}T${selectedCalendarEvent.event_time}`) > new Date() ? (
                                        <>
                                          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500 animate-pulse ring-2 ring-green-100 border border-white shadow-sm"></div>
                                          <span className="font-black text-[11px] sm:text-xs text-green-600 uppercase tracking-widest">Active</span>
                                        </>
                                      ) : (
                                        <>
                                          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-slate-400 ring-2 ring-slate-100 border border-white shadow-sm"></div>
                                          <span className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-widest">Expired</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="p-2.5 sm:p-3 bg-primary rounded-xl border border-primary/80 shadow-xl shadow-primary/10 group/reg hover:shadow-2xl transition-all active:scale-[0.98]">
                                    <p className="text-[11px] sm:text-xs text-white/60 uppercase font-black tracking-[0.2em] mb-2 leading-none">Total Registrations</p>
                                    <div className="flex items-end gap-1.5">
                                      <p className="font-black text-2xl sm:text-3xl text-white leading-none">
                                        {registrations.filter(r => r.event_id === selectedCalendarEvent.id).length}
                                      </p>
                                      <span className="text-white/60 text-[11px] sm:text-xs font-black uppercase tracking-widest mb-0.5">Attendees</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="p-2.5 sm:p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-black/5 shadow-sm group/price hover:shadow-md transition-all active:scale-[0.98] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Current Pricing</p>
                                      <div className="flex items-center gap-2">
                                        <div className="flex flex-col">
                                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base</span>
                                          <span className={`font-black text-sm ${(selectedCalendarEvent.promotion_price || settings.event_promotion_price) ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-900'}`}>
                                            MYR {selectedCalendarEvent.price || settings.event_price || '0.00'}
                                          </span>
                                        </div>
                                        {(selectedCalendarEvent.promotion_price || settings.event_promotion_price) && (
                                          <>
                                            <div className="h-6 w-px bg-black/5 mx-1" />
                                            <div className="flex flex-col">
                                              <span className="text-[9px] font-black text-primary/80 uppercase tracking-widest flex items-center gap-1">
                                                <Tag className="w-2 h-2" /> Promo
                                              </span>
                                              <span className="font-black text-sm text-primary bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                                                MYR {selectedCalendarEvent.promotion_price || settings.event_promotion_price}
                                              </span>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {(selectedCalendarEvent.promotion_price || settings.event_promotion_price) && (
                                      <div className="bg-primary text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full shadow-lg shadow-primary/10 animate-pulse">
                                        Sale Live
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 pb-1.5">
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="secondary" className="w-full sm:flex-1 gap-2 border-black/5 shadow-lg shadow-slate-200/50 h-9 rounded-xl font-black uppercase tracking-widest text-[11px] sm:text-xs hover:bg-white active:scale-95 transition-all">
                                          <QrCode className="w-3.5 h-3.5 text-primary" /> EVENT QR
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[85vw] sm:w-auto p-4 sm:p-6 flex flex-col items-center gap-4 rounded-xl border-black/5 shadow-2xl backdrop-blur-2xl bg-white/95" align="center">
                                        <div className="bg-white p-3 sm:p-5 rounded-lg border border-black/5 shadow-2xl shadow-primary/10/50">
                                          <QRCode value={`${window.location.origin}/event?eid=${selectedCalendarEvent.id}`} size={window.innerWidth < 640 ? 150 : 200} />
                                        </div>
                                        <div className="text-center space-y-1.5">
                                          <p className="text-[11px] sm:text-xs font-black text-primary uppercase tracking-tight leading-none px-2">{selectedCalendarEvent.name}</p>
                                          <p className="text-[11px] sm:text-xs text-slate-900 font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                                            Scan for registration
                                          </p>
                                        </div>
                                      </PopoverContent>
                                    </Popover>

                                    <Button 
                                      className="w-full sm:flex-1 gap-2 bg-primary hover:bg-primary/90 h-9 shadow-xl shadow-primary/20 rounded-xl font-black uppercase tracking-widest text-[11px] sm:text-xs text-white active:scale-95 transition-all"
                                      onClick={() => window.open(`/event?eid=${selectedCalendarEvent.id}`, '_blank')}
                                    >
                                      {(() => {
                                        let imgUrl = selectedCalendarEvent.event_image_url;
                                        if (selectedCalendarEvent.event_profile_id) {
                                          const profile = eventProfiles.find(p => p.id === selectedCalendarEvent.event_profile_id);
                                          if (profile?.event_hero_image) imgUrl = profile.event_hero_image;
                                        }
                                        return (
                                          <img src={imgUrl || eventHero} className={`w-3.5 h-3.5 rounded-full object-cover border border-white/20 ${!imgUrl ? 'grayscale brightness-200' : ''}`} alt="" />
                                        );
                                      })()} VIEW LIVE PAGE
                                    </Button>
                                  </div>

                                  <Button 
                                    variant="outline"
                                    className="w-full gap-2 border-black/5 hover:border-primary/20 hover:bg-primary/5/50 shadow-sm h-9 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 transition-all active:scale-[0.98]"
                                    onClick={() => {
                                      const expiresAt = Date.now() + 5 * 60 * 1000;
                                      const link = `${window.location.origin}/event?eid=${selectedCalendarEvent.id}&test=true&expires=${expiresAt}`;
                                      window.open(link, '_blank');
                                    }}
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                                    TEST LINK (5M)
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </DialogContent>
                      </Dialog>

                      {/* Events Management Section */}
                      <div className="space-y-2 pt-2 border-t border-black/5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-1.5 px-2">
                          <div className="space-y-0.5">
                            <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight leading-tight animate-in fade-in slide-in-from-left-4 duration-700">Upcoming Events</h3>
                            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-6 duration-700 delay-100">
                              <span className="h-0.5 w-6 bg-primary rounded-full" />
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary/80">Manage next scheduled events</p>
                            </div>
                          </div>
                          <Dialog open={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
                            <DialogTrigger asChild>
                              <Button onClick={() => setCurrentEvent({})} className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs h-8 px-4 rounded-xl shadow-2xl shadow-primary/20 active:scale-95 transition-all w-full md:w-auto group animate-in fade-in slide-in-from-right-4 duration-700">
                                <Plus className="w-3 h-3 mr-1.5 group-hover:rotate-90 transition-transform duration-500" /> Create Event
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-[95vw] sm:max-w-[600px] p-0 overflow-hidden rounded-xl border-black/5 shadow-2xl backdrop-blur-2xl bg-white/95 animate-in fade-in zoom-in-95 duration-500">
                              <DialogHeader className="p-3 sm:p-4 pb-2 sm:pb-3 border-b border-black/5 bg-slate-50/50">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
                                    <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  </div>
                                  <div>
                                    <DialogTitle className="text-[11px] sm:text-xs font-black text-slate-950 uppercase tracking-tight leading-none">{currentEvent.id ? 'Edit Event' : 'Create New Event'}</DialogTitle>
                                    <DialogDescription className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mt-1.5 flex items-center gap-1.5">
                                      <span className="h-0.5 w-3 bg-slate-300 rounded-full" />
                                      {currentEvent.id ? 'Modify existing event parameters' : 'Configure a new scheduled event instance'}
                                    </DialogDescription>
                                  </div>
                                </div>
                              </DialogHeader>
                              <div className="space-y-4 sm:space-y-5 p-4 sm:p-6 max-h-[70vh] overflow-y-auto scrollbar-none">
                                <div className="space-y-3">
                                  <label className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest ml-1">Event Profile (Auto-fill)</label>
                                  <Select
                                    value={currentEvent.event_profile_id || "none"}
                                    onValueChange={(val) => {
                                      if (val === "none") {
                                        setCurrentEvent({ ...currentEvent, event_profile_id: null });
                                      } else {
                                        const profile = eventProfiles.find(p => p.id === val);
                                        if (profile) {
                                          const eventDate = currentEvent.event_date || format(new Date(), "yyyy-MM-dd");
                                          
                                          // Combine date with profile default times
                                          let startTime = currentEvent.start_time;
                                          let endTime = currentEvent.end_time;
                                          
                                          if (profile.default_start_time) {
                                            startTime = `${eventDate}T${profile.default_start_time.substring(0, 5)}`;
                                          }
                                          if (profile.default_end_time) {
                                            endTime = `${eventDate}T${profile.default_end_time.substring(0, 5)}`;
                                          }

                                          // Parse prices from profile (remove non-numeric chars like 'MYR')
                                          let price = currentEvent.price;
                                          if (profile.event_price) {
                                            const num = parseFloat(profile.event_price.replace(/[^0-9.]/g, ''));
                                            if (!isNaN(num)) price = num.toString();
                                          }
                                          
                                          let promoPrice = currentEvent.promotion_price;
                                          if (profile.event_promotion_price) {
                                            const num = parseFloat(profile.event_promotion_price.replace(/[^0-9.]/g, ''));
                                            if (!isNaN(num)) promoPrice = num.toString();
                                          }

                                          setCurrentEvent({
                                            ...currentEvent,
                                            event_profile_id: profile.id,
                                            name: profile.event_title || currentEvent.name,
                                            location: profile.event_location || currentEvent.location,
                                            event_description: profile.event_description || currentEvent.event_description,
                                            event_image_url: profile.event_hero_image || currentEvent.event_image_url,
                                            price: price,
                                            promotion_price: promoPrice,
                                            event_date: eventDate,
                                            start_time: startTime,
                                            end_time: endTime,
                                          });
                                        }
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="w-full h-10 rounded-xl border-black/10 bg-slate-50/50 shadow-sm text-[11px] sm:text-xs font-bold px-4">
                                      <SelectValue placeholder="Select a profile" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">None (Custom Event)</SelectItem>
                                      {eventProfiles.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-3">
                                  <label className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest ml-1">Event Name</label>
                                  <Input 
                                      value={currentEvent.name || ''} 
                                      onChange={e => setCurrentEvent({...currentEvent, name: e.target.value})}
                                      placeholder="e.g. Summer Skydiving Festival"
                                      className="border-black/10 bg-slate-50/50 shadow-sm focus:ring-primary/80/20 focus:ring-4 h-10 rounded-xl text-[11px] sm:text-xs font-bold px-4 transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  <div className="space-y-3">
                                    <label className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest ml-1">Event ID (Manual)</label>
                                    <Input 
                                      value={currentEvent.event_id || ''} 
                                      onChange={e => setCurrentEvent({...currentEvent, event_id: e.target.value})}
                                      placeholder="e.g. summer-2024"
                                      className="border-black/10 bg-slate-50/50 shadow-sm h-10 rounded-xl text-[11px] sm:text-xs font-bold px-4 focus:ring-primary/80/20 focus:ring-4 transition-all"
                                    />
                                  </div>
                                  <div className="space-y-3">
                                    <label className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest ml-1">Location</label>
                                    <Input 
                                      value={currentEvent.location || ''} 
                                      onChange={e => setCurrentEvent({...currentEvent, location: e.target.value})}
                                      placeholder="e.g. Subang Airport"
                                      className="border-black/10 bg-slate-50/50 shadow-sm h-10 rounded-xl text-[11px] sm:text-xs font-bold px-4 focus:ring-primary/80/20 focus:ring-4 transition-all"
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  <div className="space-y-3">
                                    <label className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                      <DollarSign className="w-3 h-3 text-primary" />
                                      Base Price (MYR)
                                    </label>
                                    <Input 
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={currentEvent.price || ''} 
                                      onChange={e => setCurrentEvent({...currentEvent, price: e.target.value})}
                                      placeholder="e.g. 150.00"
                                      className="border-black/10 bg-slate-50/50 shadow-sm h-10 rounded-xl text-[11px] sm:text-xs font-bold px-4 focus:ring-primary/80/20 focus:ring-4 transition-all"
                                    />
                                  </div>
                                  <div className="space-y-3">
                                    <label className="text-[11px] sm:text-xs font-black text-primary uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                      <Tag className="w-3 h-3" />
                                      Promotion Price (MYR)
                                    </label>
                                    <Input 
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={currentEvent.promotion_price || ''} 
                                      onChange={e => setCurrentEvent({...currentEvent, promotion_price: e.target.value})}
                                      placeholder="e.g. 120.00 (Optional)"
                                      className="border-primary/10 bg-primary/5/30 shadow-sm h-10 rounded-xl text-[11px] sm:text-xs font-bold px-4 focus:ring-primary/80/20 focus:ring-4 transition-all"
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 gap-5 mt-4 mb-4">
                                  <div className="space-y-3">
                                    <label className="text-[11px] sm:text-xs font-black text-primary uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                      <Clock className="w-3 h-3" />
                                      Promotion Start
                                    </label>
                                    <Input 
                                      type="datetime-local"
                                      value={currentEvent.promotion_start_at ? format(new Date(currentEvent.promotion_start_at), "yyyy-MM-dd'T'HH:mm") : ''}
                                      className="border-primary/10 bg-primary/5/30 shadow-sm h-10 rounded-xl text-[11px] sm:text-xs font-bold px-4 focus:ring-primary/80/20 focus:ring-4 transition-all"
                                      onChange={e => {
                                        const val = e.target.value;
                                        setCurrentEvent({
                                          ...currentEvent, 
                                          promotion_start_at: val ? new Date(val).toISOString() : null
                                        });
                                      }}
                                      onClick={(e) => (e.currentTarget as any).showPicker()}
                                    />
                                  </div>
                                  <div className="space-y-3">
                                    <label className="text-[11px] sm:text-xs font-black text-primary uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                      <Clock className="w-3 h-3" />
                                      Promotion End
                                    </label>
                                    <Input 
                                      type="datetime-local"
                                      value={currentEvent.promotion_end_at ? format(new Date(currentEvent.promotion_end_at), "yyyy-MM-dd'T'HH:mm") : ''}
                                      className="border-primary/10 bg-primary/5/30 shadow-sm h-10 rounded-xl text-[11px] sm:text-xs font-bold px-4 focus:ring-primary/80/20 focus:ring-4 transition-all"
                                      onChange={e => {
                                        const val = e.target.value;
                                        setCurrentEvent({
                                          ...currentEvent, 
                                          promotion_end_at: val ? new Date(val).toISOString() : null
                                        });
                                      }}
                                      onClick={(e) => (e.currentTarget as any).showPicker()}
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  <div className="space-y-3">
                                    <label className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                      <CalendarIcon className="w-3 h-3 text-primary" />
                                      Event Date
                                    </label>
                                    <Input 
                                      type="date"
                                      value={currentEvent.event_date || ''}
                                      className="border-black/10 bg-slate-50/50 shadow-sm h-10 rounded-xl text-[11px] sm:text-xs font-bold px-4 focus:ring-primary/80/20 focus:ring-4 transition-all w-full"
                                      onChange={e => {
                                        const newDate = e.target.value;
                                        if (!newDate) {
                                          setCurrentEvent({...currentEvent, event_date: undefined, start_time: undefined, end_time: undefined});
                                          return;
                                        }

                                        // If date changes, update the date part of start/end times if they exist
                                        let newStartTime = currentEvent.start_time;
                                        let newEndTime = currentEvent.end_time;
                                        
                                        if (currentEvent.start_time && currentEvent.start_time.includes('T')) {
                                          newStartTime = `${newDate}T${currentEvent.start_time.split('T')[1]}`;
                                        } else if (currentEvent.start_time) {
                                          // It might be just a time string
                                          newStartTime = `${newDate}T${currentEvent.start_time}`;
                                        }
                                        
                                        if (currentEvent.end_time && currentEvent.end_time.includes('T')) {
                                          newEndTime = `${newDate}T${currentEvent.end_time.split('T')[1]}`;
                                        } else if (currentEvent.end_time) {
                                          newEndTime = `${newDate}T${currentEvent.end_time}`;
                                        }

                                        setCurrentEvent({
                                          ...currentEvent, 
                                          event_date: newDate,
                                          start_time: newStartTime,
                                          end_time: newEndTime,
                                          event_time: newStartTime ? newStartTime.split('T')[1] : currentEvent.event_time
                                        });
                                      }}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                      <label className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest ml-1">Start Time</label>
                                      <Input 
                                        type="time"
                                        value={currentEvent.start_time ? (currentEvent.start_time.includes('T') ? currentEvent.start_time.split('T')[1].substring(0, 5) : currentEvent.start_time.substring(0, 5)) : ''}
                                        onClick={(e) => (e.currentTarget as any).showPicker()}
                                        className="border-black/10 bg-slate-50/50 shadow-sm h-10 rounded-xl text-[11px] sm:text-xs font-bold px-4 focus:ring-primary/80/20 focus:ring-4 transition-all w-full"
                                        onChange={e => {
                                          const time = e.target.value;
                                          const date = currentEvent.event_date || format(new Date(), "yyyy-MM-dd");
                                          setCurrentEvent({
                                            ...currentEvent,
                                            start_time: `${date}T${time}`,
                                            event_time: time
                                          });
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-3">
                                      <label className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest ml-1">End Time</label>
                                      <Input 
                                        type="time"
                                        value={currentEvent.end_time ? (currentEvent.end_time.includes('T') ? currentEvent.end_time.split('T')[1].substring(0, 5) : currentEvent.end_time.substring(0, 5)) : ''}
                                        onClick={(e) => (e.currentTarget as any).showPicker()}
                                        className="border-black/10 bg-slate-50/50 shadow-sm h-10 rounded-xl text-[11px] sm:text-xs font-bold px-4 focus:ring-primary/80/20 focus:ring-4 transition-all w-full"
                                        onChange={e => {
                                          const time = e.target.value;
                                          const date = currentEvent.event_date || format(new Date(), "yyyy-MM-dd");
                                          setCurrentEvent({
                                            ...currentEvent,
                                            end_time: `${date}T${time}`
                                          });
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <DialogFooter className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-6 sm:p-10 border-t border-black/5 bg-slate-50/50">
                                <Button variant="secondary" className="w-full sm:w-auto h-11 rounded-xl font-black uppercase tracking-widest text-[11px] sm:text-xs border-black/10 shadow-sm order-2 sm:order-1 px-8 hover:bg-white transition-all active:scale-95" onClick={() => setIsEventModalOpen(false)}>Cancel</Button>
                                <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs h-11 rounded-xl shadow-xl shadow-primary/20 order-1 sm:order-2 px-10 active:scale-95 transition-all" onClick={async () => {
                                  if (!currentEvent.name || !currentEvent.event_date) {
                                    toast.error("Please fill in Event Name and Date");
                                    return;
                                  }

                                  // Final check/fallback for start/end times if they weren't set by profile/change
                                  let finalStartTime = currentEvent.start_time;
                                  let finalEndTime = currentEvent.end_time;

                                  if (!finalStartTime || !finalEndTime) {
                                    if (currentEvent.event_profile_id) {
                                      const profile = eventProfiles.find(p => p.id === currentEvent.event_profile_id);
                                      if (profile) {
                                        finalStartTime = finalStartTime || (profile.default_start_time ? `${currentEvent.event_date}T${profile.default_start_time.substring(0, 5)}` : null);
                                        finalEndTime = finalEndTime || (profile.default_end_time ? `${currentEvent.event_date}T${profile.default_end_time.substring(0, 5)}` : null);
                                      }
                                    }
                                  }
                                  
                                  if (!finalStartTime || !finalEndTime) {
                                    toast.error("Please ensure Start Time and End Time are set");
                                    return;
                                  }

                                  if (new Date(finalStartTime).toString() === 'Invalid Date' || new Date(finalEndTime).toString() === 'Invalid Date') {
                                    toast.error("Invalid Start or End Time format");
                                    return;
                                  }

                                  if (new Date(finalStartTime) >= new Date(finalEndTime)) {
                                    toast.error("Start time must be before end time");
                                    return;
                                  }

                                  const { data: { user } } = await supabase.auth.getUser();
                                  
                                  let creatorId = null;
                                  if (user) {
                                    const { data: adminUser } = await supabase
                                      .from('admin_users')
                                      .select('id')
                                      .eq('id', user.id)
                                      .maybeSingle();
                                    if (adminUser) {
                                      creatorId = adminUser.id;
                                    }
                                  }
                                  
                                  let profileSnapshots = {
                                    event_registration_template: settings.event_registration_template || null as string | null,
                                    event_time_slots: settings.event_time_slots || null as string | null,
                                    event_schedule: settings.event_schedule || null as string | null
                                  };
                                  
                                  if (currentEvent.event_profile_id) {
                                    const profile = eventProfiles.find(p => p.id === currentEvent.event_profile_id);
                                    if (profile) {
                                      profileSnapshots.event_registration_template = profile.event_registration_template || null;
                                      profileSnapshots.event_time_slots = profile.event_time_slots || null;
                                      profileSnapshots.event_schedule = profile.event_schedule || null;
                                    }
                                  }

                                  // Sync event specific prices into the template JSON
                                  if (profileSnapshots.event_registration_template) {
                                    try {
                                      const template = JSON.parse(profileSnapshots.event_registration_template);
                                      const pReq = template.fieldsConfig?.payment_required;
                                      
                                      const eventPrice = currentEvent.price !== null && currentEvent.price !== undefined ? Number(currentEvent.price) : 0;
                                      const promoPrice = currentEvent.promotion_price !== null && currentEvent.promotion_price !== undefined ? Number(currentEvent.promotion_price) : 0;
                                      const linkedAmount = (promoPrice > 0) ? promoPrice : eventPrice;

                                      if (pReq) {
                                        pReq.payment_amount = linkedAmount;
                                        profileSnapshots.event_registration_template = JSON.stringify(template);
                                      }
                                    } catch (e) {
                                      console.error("Failed to sync event prices to template", e);
                                    }
                                  }

                                  // Extract payment fields from template for top-level columns
                                  let paymentFields = {
                                    payment_required: false,
                                    payment_amount: 0,
                                    payment_description: '',
                                    enable_chip_payment: false,
                                    enable_deposit: false,
                                    deposit_amount: 0
                                  };

                                  if (profileSnapshots.event_registration_template) {
                                    try {
                                      const template = JSON.parse(profileSnapshots.event_registration_template);
                                      const pReq = template.fieldsConfig?.payment_required;
                                      if (pReq) {
                                        paymentFields.payment_required = !!pReq.required;
                                        paymentFields.payment_amount = pReq.payment_amount || 0;
                                        paymentFields.payment_description = pReq.payment_description || '';
                                        paymentFields.deposit_amount = pReq.deposit_amount || 0;
                                      }
                                      const chip = template.fieldsConfig?.enable_chip_payment;
                                      if (chip) {
                                        paymentFields.enable_chip_payment = !!chip.required;
                                      }
                                      const dep = template.fieldsConfig?.enable_deposit;
                                      if (dep) {
                                        paymentFields.enable_deposit = !!dep.required;
                                      }
                                    } catch (e) {
                                      console.error("Failed to parse template for payment fields", e);
                                    }
                                  }

                                  const basePayload = {
                                    name: currentEvent.name,
                                    event_date: currentEvent.event_date,
                                    event_time: finalStartTime ? finalStartTime.split('T')[1] : (currentEvent.event_time || null),
                                    event_id: currentEvent.event_id?.trim() || null,
                                    start_time: finalStartTime,
                                    end_time: finalEndTime,
                                    location: currentEvent.location || null,
                                    is_active: true,
                                    event_description: currentEvent.event_description || null,
                                    event_program: currentEvent.event_program || null,
                                    event_image_url: currentEvent.event_image_url || null,
                                    price: currentEvent.price !== null && currentEvent.price !== undefined ? Number(currentEvent.price) : 0,
                                    promotion_price: currentEvent.promotion_price !== null && currentEvent.promotion_price !== undefined ? Number(currentEvent.promotion_price) : null,
                                    promotion_start_at: currentEvent.promotion_start_at || null,
                                    promotion_end_at: currentEvent.promotion_end_at || null,
                                    event_profile_id: currentEvent.event_profile_id || null,
                                    ...profileSnapshots,
                                    ...paymentFields
                                  };
                                  
                                  if (currentEvent.id) {
                                     const { error } = await supabase.from('events').update(basePayload).eq('id', currentEvent.id);
                                     if (error) {
                                       if (error.code === '23505') toast.error("Event ID already exists. Please use a unique ID.");
                                       else toast.error("Failed to update event: " + error.message);
                                     }
                                     else {
                                       toast.success("Event updated");
                                       logActivity('update', 'events', currentEvent.id, basePayload);
                                     }
                                  } else {
                                     const payload = { ...basePayload, created_by: creatorId };
                                     const { data: newEvent, error } = await supabase.from('events').insert(payload).select().single();
                                     if (error) {
                                       if (error.code === '23505') toast.error("Event ID already exists. Please use a unique ID.");
                                       else toast.error("Failed to create event: " + error.message);
                                     }
                                     else {
                                       toast.success("Event created");
                                       logActivity('insert', 'events', newEvent?.id || 'new', payload);
                                     }
                                  }
                                  setIsEventModalOpen(false);
                                  fetchAllData();
                                }}>Save Event</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 px-4 sm:px-6">
                          {events
                            .filter(event => {
                              const eventDateTime = new Date(`${event.event_date}T${event.event_time}`);
                              return eventDateTime > new Date();
                            })
                            .map(event => {
                            const eventDateTime = new Date(`${event.event_date}T${event.event_time}`);
                            const isExpired = new Date() > eventDateTime;
                            const timeLeft = eventDateTime.getTime() - new Date().getTime();
                            const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                            const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

                            return (
                              <Card key={event.id} className="relative overflow-hidden group border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/80/5 rounded-2xl hover:shadow-2xl transition-all duration-500 flex flex-col h-full animate-in fade-in zoom-in-95 duration-500 active:scale-[0.98]">
                                 <div className="aspect-video relative overflow-hidden bg-slate-100 border-b border-black/5">
                                   {(() => {
                                     let imgUrl = event.event_image_url;
                                     if (event.event_profile_id) {
                                       const profile = eventProfiles.find(p => p.id === event.event_profile_id);
                                       if (profile?.event_hero_image) {
                                         imgUrl = profile.event_hero_image;
                                       }
                                     }
                                     return (
                                       <img 
                                         src={imgUrl || eventHero} 
                                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                         alt={event.name}
                                       />
                                     );
                                   })()}
                                   <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                 </div>
                                 <CardHeader className="pb-4 px-4 sm:px-6 pt-4 sm:pt-6 border-b border-black/5 bg-white/50 backdrop-blur-sm">
                                   <div className="flex justify-between items-start gap-4">
                                     <CardTitle className="text-[11px] sm:text-xs line-clamp-2 flex-1 font-black text-slate-900 uppercase tracking-tight leading-tight group-hover:text-primary transition-colors">{event.name}</CardTitle>
                                     <div className="flex flex-col items-end gap-2">
                                       <span className="text-[11px] sm:text-xs bg-primary/5 text-primary/90 px-3 py-1.5 rounded-full font-black uppercase tracking-widest whitespace-nowrap border border-primary/20/50 shadow-sm shadow-primary/10/50">
                                         {daysLeft}D {hoursLeft}H
                                       </span>
                                       {canEdit('registrations') && (
                                         <Button 
                                           variant="ghost" 
                                           size="icon"
                                           className="h-10 w-10 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95 shadow-sm bg-white/50 backdrop-blur-sm border border-black/5"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleDeleteEvent(event.id);
                                           }}
                                         >
                                           <Trash2 className="w-4 h-4" />
                                         </Button>
                                       )}
                                     </div>
                                   </div>
                                   <div className="space-y-2 mt-4">
                                     <div className="flex items-center gap-3 text-[11px] sm:text-xs font-black text-slate-900 bg-white/80 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-black/5 shadow-sm group-hover:border-primary/10/50 transition-all uppercase tracking-widest">
                                      {(() => {
                                       let imgUrl = event.event_image_url;
                                       if (event.event_profile_id) {
                                         const profile = eventProfiles.find(p => p.id === event.event_profile_id);
                                         if (profile?.event_hero_image) {
                                           imgUrl = profile.event_hero_image;
                                         }
                                       }
                                       return (
                                         <img 
                                           src={imgUrl || eventHero} 
                                           className="w-4 h-4 rounded-full object-cover group-hover:scale-110 transition-transform" 
                                           alt="" 
                                         />
                                       );
                                     })()}
                                       <span className="truncate">
                                          {`${format(new Date(event.event_date + 'T00:00:00'), "EEEE d MMM yyyy")} @ ${event.event_time}`}
                                        </span>
                                     </div>
                                     <div className="flex items-center gap-3 text-[11px] sm:text-xs font-black text-slate-900 bg-white/80 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-black/5 shadow-sm group-hover:border-primary/10/50 transition-all uppercase tracking-widest">
                                       <MapPin className="w-4 h-4 text-primary/80 group-hover:scale-110 transition-transform" />
                                       <span className="truncate">
                                         {event.location || settings[`event_location_${event.id}`] || settings['event_location'] || 'Location TBA'}
                                       </span>
                                     </div>
                                     <div className="flex items-center gap-3 text-[11px] sm:text-xs font-black text-slate-900 bg-white/80 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-black/5 shadow-sm group-hover:border-primary/10/50 transition-all uppercase tracking-widest">
                                       <DollarSign className="w-4 h-4 text-primary/80 group-hover:scale-110 transition-transform" />
                                       <div className="flex items-center gap-2">
                                         {event.promotion_price ? (
                                           <>
                                             <span className="text-primary">MYR {event.promotion_price}</span>
                                             <span className="text-slate-400 line-through decoration-primary/30/50">MYR {event.price || settings.event_price || '0.00'}</span>
                                             <Badge className="bg-primary text-white border-none text-[8px] px-1.5 h-4 font-black">PROMO</Badge>
                                           </>
                                         ) : (
                                           <span>MYR {event.price || settings.event_price || '0.00'}</span>
                                         )}
                                       </div>
                                     </div>
                                     <div className="flex flex-wrap gap-2 pt-1">
                                       {event.event_id && <span className="font-mono bg-primary/5/50 text-primary/90 px-3 py-1 rounded-lg text-[11px] sm:text-xs border border-primary/10/50 font-black uppercase tracking-widest shadow-sm">ID: {event.event_id}</span>}
                                       {event.created_by && <span className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-widest bg-slate-50/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-200/50 shadow-sm">BY: {event.created_by.split('-')[0]}...</span>}
                                     </div>
                                   </div>
                                 </CardHeader>
                                 <CardContent className="space-y-4 mt-auto px-6 sm:px-8 pb-6 sm:pb-8 pt-6 sm:pt-8">
                                   <div className="flex items-center gap-4">
                                     <Popover>
                                       <PopoverTrigger asChild>
                                         <Button variant="secondary" className="flex-1 gap-3 h-11 text-[11px] sm:text-xs border-black/5 shadow-lg shadow-slate-200/50 font-black uppercase tracking-widest rounded-xl hover:bg-white active:scale-95 transition-all">
                                           <QrCode className="w-5 h-5 text-primary" /> QR
                                         </Button>
                                       </PopoverTrigger>
                                       <PopoverContent className="w-[90vw] sm:w-auto p-8 flex flex-col items-center gap-8 rounded-[3rem] border-black/5 shadow-2xl backdrop-blur-2xl bg-white/95" align="center">
                                         <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-black/5 shadow-2xl shadow-primary/10/50">
                                           <QRCode value={`${window.location.origin}/event?eid=${event.id}`} size={window.innerWidth < 640 ? 200 : 240} />
                                         </div>
                                         <div className="text-center space-y-3">
                                           <p className="text-[11px] sm:text-xs font-black text-primary uppercase tracking-tight leading-tight px-4">{event.name}</p>
                                           <p className="text-[11px] sm:text-xs text-slate-900 font-black uppercase tracking-widest">Scan to register for this event</p>
                                         </div>
                                       </PopoverContent>
                                     </Popover>
                                     
                                     <Button 
                                      className="flex-1 gap-3 h-11 text-[11px] sm:text-xs bg-primary hover:bg-primary/90 font-black uppercase tracking-widest shadow-lg shadow-primary/20 rounded-xl text-white active:scale-95 transition-all"
                                      onClick={() => window.open(`/event?eid=${event.id}`, '_blank')}
                                    >
                                      {(() => {
                                        let imgUrl = event.event_image_url;
                                        if (event.event_profile_id) {
                                          const profile = eventProfiles.find(p => p.id === event.event_profile_id);
                                          if (profile?.event_hero_image) imgUrl = profile.event_hero_image;
                                        }
                                        return (
                                          <img 
                                            src={imgUrl || eventHero} 
                                            className="w-5 h-5 rounded-lg object-cover border border-white/20 shadow-sm"
                                            alt=""
                                          />
                                        );
                                      })()} LIVE
                                    </Button>
                                   </div>
                                   
                                  <div className="flex gap-4">
                                    <Button 
                                       variant="outline" 
                                       className="flex-1 text-[11px] sm:text-xs h-11 gap-3 border-black/5 hover:border-primary/20 hover:bg-primary/5/50 font-black uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] shadow-sm"
                                      onClick={() => {
                                        const expiresAt = Date.now() + 5 * 60 * 1000;
                                        const link = `${window.location.origin}/event?eid=${event.id}&test=true&expires=${expiresAt}`;
                                        window.open(link, '_blank');
                                      }}
                                    >
                                      <ShieldCheck className="w-5 h-5 text-primary" /> TEST (5M)
                                    </Button>

                                    {canEdit('registrations') && (
                                      <Button 
                                        variant="outline"
                                        className="w-11 h-11 border-black/5 hover:border-primary/20 hover:bg-primary/5/50 rounded-xl transition-all active:scale-[0.98] shadow-sm flex items-center justify-center p-0"
                                        onClick={() => {
                                          setCurrentEvent(event);
                                          setIsEventModalOpen(true);
                                        }}
                                      >
                                        <Settings2 className="w-5 h-5 text-primary" />
                                      </Button>
                                    )}
                                  </div>

                                  <div className="flex flex-col gap-2 pt-4 border-t border-black/5">
                                    <div className="flex items-center gap-2">
                                      <Button 
                                        className="flex-1 h-11 gap-3 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                                        onClick={() => handlePrintEventManifest(event, false)}
                                      >
                                        <Printer className="w-5 h-5" /> MANIFEST
                                      </Button>
                                    </div>
                                  </div>
                                 </CardContent>
                              </Card>
                            );
                          })}
                          {events.length === 0 && (
                            <div className="col-span-full py-20 text-center text-slate-900 border-4 border-black/5 border-dashed rounded-[3rem] bg-slate-50/50 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-700">
                              <img src={eventHero} className="w-12 h-12 rounded-2xl object-cover opacity-20 grayscale" alt="" />
                              <div className="space-y-1">
                                <p className="font-black text-[11px] sm:text-xs uppercase tracking-widest text-slate-900">No events scheduled</p>
                                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Create your first event to get started.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Registrations List Section */}
                      <div className="space-y-3 pt-6 border-t border-black/5">
                        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between bg-white/70 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-black/5 shadow-xl shadow-primary/80/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="space-y-1">
                            <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight leading-none">Registration Database</h3>
                            <div className="flex items-center gap-2">
                              <span className="h-1 w-6 bg-primary rounded-full" />
                              <p className="text-[11px] sm:text-xs text-primary font-black flex items-center gap-1.5 uppercase tracking-widest bg-primary/5/50 px-2 py-0.5 rounded-full border border-primary/10/50 shadow-sm">
                                <Users className="w-2.5 h-2.5" /> {registrations.length} Total Entries
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row flex-wrap justify-end gap-2 w-full lg:w-auto">
                            {!selectedRegistration ? (
                              <>
                                <div className="relative w-full sm:w-64 group order-1 sm:order-none">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-900 group-focus-within:text-primary transition-all z-10" />
                                  <Input 
                                    placeholder="SEARCH NAME, EMAIL, PHONE..." 
                                    className="pl-9 border-black/10 shadow-sm h-9 bg-white/50 backdrop-blur-sm focus:bg-white focus:ring-4 focus:ring-primary/80/10 transition-all rounded-lg font-black text-[11px] sm:text-xs placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-black placeholder:tracking-widest uppercase"
                                    value={registrationFilterKeyword}
                                    onChange={e => setRegistrationFilterKeyword(e.target.value)}
                                  />
                                </div>
                                
                                <div className="relative w-full sm:w-auto order-2 sm:order-none">
                                  <Input 
                                    type="date" 
                                    className="w-full sm:w-auto border-black/10 shadow-sm h-9 bg-white/50 backdrop-blur-sm px-4 rounded-lg font-black text-[11px] sm:text-xs uppercase tracking-widest appearance-none focus:bg-white transition-all"
                                    onChange={e => setFilterDate(e.target.value ? new Date(e.target.value) : undefined)}
                                  />
                                </div>

                                <Select value={filterEventId} onValueChange={setFilterEventId}>
                                  <SelectTrigger className="w-full sm:w-[160px] border-black/10 shadow-sm h-9 bg-white/50 backdrop-blur-sm rounded-lg font-black text-[11px] sm:text-xs uppercase tracking-widest hover:bg-white transition-all px-4 order-3 sm:order-none">
                                    <SelectValue placeholder="FILTER BY EVENT" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-black/10 shadow-2xl backdrop-blur-xl bg-white/95">
                                    <SelectItem value="all" className="font-black text-[11px] sm:text-xs uppercase tracking-widest py-2 rounded-lg">ALL EVENTS</SelectItem>
                                    {events.map(e => (
                                      <SelectItem key={e.id} value={e.id} className="font-black text-[11px] sm:text-xs uppercase tracking-widest py-2 rounded-lg">{e.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Select value={selectedFlightCertificateTemplate} onValueChange={setSelectedFlightCertificateTemplate}>
                                  <SelectTrigger className="w-full sm:w-[180px] border-black/10 shadow-sm h-9 bg-white/50 backdrop-blur-sm rounded-lg font-black text-[11px] sm:text-xs uppercase tracking-widest hover:bg-white transition-all px-4 order-4 sm:order-none">
                                    <SelectValue placeholder="FLIGHT CERTIFICATE" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-black/10 shadow-2xl backdrop-blur-xl bg-white/95">
                                    <SelectItem value="default" className="font-black text-[11px] sm:text-xs uppercase tracking-widest py-2 rounded-lg">DEFAULT TEMPLATE</SelectItem>
                                    {flightCertificateTemplates.map(t => (
                                      <SelectItem key={t.id} value={t.id} className="font-black text-[11px] sm:text-xs uppercase tracking-widest py-2 rounded-lg">{t.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {selectedRegIds.length > 0 && (
                                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300 order-6 sm:order-none">
                                    <Button
                                      size="sm"
                                      className="h-9 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-lg px-4 flex items-center gap-2 shadow-lg shadow-primary/20"
                                      onClick={() => handlePrintCertificates(false)}
                                    >
                                      <Printer className="w-3.5 h-3.5" /> PRINT ({selectedRegIds.length})
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-9 border-red-100 bg-red-50/30 text-red-600 hover:bg-red-50 font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-lg px-4 flex items-center gap-2 shadow-sm"
                                      onClick={handleBulkDeleteRegistrations}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> DELETE ({selectedRegIds.length})
                                    </Button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="w-full sm:w-auto border-black/5 shadow-lg shadow-slate-200/50 h-9 font-black uppercase tracking-widest text-[11px] sm:text-xs bg-white hover:bg-slate-50 rounded-lg px-6 transition-all active:scale-95" 
                                onClick={() => setSelectedRegistration(null)}
                              >
                                <ArrowLeft className="w-4 h-4 mr-2" /> BACK TO LIST
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="hidden md:block rounded-xl border border-black/5 overflow-hidden bg-white/50 backdrop-blur-sm shadow-xl shadow-primary/80/5 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent border-black/5">
                                  <TableHead className="w-[100px] py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <Checkbox 
                                        checked={selectedRegIds.length === registrations.length && registrations.length > 0}
                                        onCheckedChange={(checked) => {
                                          if (checked) setSelectedRegIds(registrations.map(r => r.id));
                                          else setSelectedRegIds([]);
                                        }}
                                        className="h-4 w-4 rounded-md border-black data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                      />
                                      {selectedRegIds.length > 0 && (
                                        <Button 
                                          variant="destructive" 
                                          size="sm" 
                                          className="h-7 px-2 text-[10px] font-black uppercase tracking-widest animate-in fade-in zoom-in-95 flex items-center gap-1 shadow-lg shadow-red-200"
                                          onClick={handleBulkDeleteRegistrations}
                                        >
                                          <Trash2 className="w-3 h-3" /> DELETE ({selectedRegIds.length})
                                        </Button>
                                      )}
                                    </div>
                                  </TableHead>
                                  <TableHead className="font-black uppercase tracking-widest text-[11px] sm:text-xs text-slate-900 py-3 px-4">Client Name</TableHead>
                                  <TableHead className="font-black uppercase tracking-widest text-[11px] sm:text-xs text-slate-900 py-3">ID / Passport</TableHead>
                                  <TableHead className="font-black uppercase tracking-widest text-[11px] sm:text-xs text-slate-900 py-3">Contact Info</TableHead>
                                  <TableHead className="font-black uppercase tracking-widest text-[11px] sm:text-xs text-slate-900 py-3">Payment</TableHead>
                                  <TableHead className="font-black uppercase tracking-widest text-[11px] sm:text-xs text-slate-900 py-3">Event Date</TableHead>
                                  <TableHead className="font-black uppercase tracking-widest text-[11px] sm:text-xs text-slate-900 py-3">Location</TableHead>
                                  <TableHead className="font-black uppercase tracking-widest text-[11px] sm:text-xs text-slate-900 py-3">Target Event</TableHead>
                                  <TableHead className="font-black uppercase tracking-widest text-[11px] sm:text-xs text-slate-900 py-3 text-right px-4">
                                    {selectedRegIds.length > 0 ? (
                                      <div className="flex items-center justify-end">
                                        <Button 
                                          variant="destructive" 
                                          size="sm" 
                                          className="h-7 px-3 text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-right-2 flex items-center gap-1 shadow-lg shadow-red-200"
                                          onClick={handleBulkDeleteRegistrations}
                                        >
                                          <Trash2 className="w-3 h-3" /> DELETE ({selectedRegIds.length})
                                        </Button>
                                      </div>
                                    ) : (
                                      "Actions"
                                    )}
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {registrations.filter(reg => {
                                    const searchStr = registrationFilterKeyword.toLowerCase();
                                    const matchesKeyword = !registrationFilterKeyword || 
                                      reg.name?.toLowerCase().includes(searchStr) || 
                                      reg.email?.toLowerCase().includes(searchStr) ||
                                      reg.phone?.toLowerCase().includes(searchStr);
                                    const matchesEvent = filterEventId === 'all' || reg.event_id === filterEventId;
                                    const matchesDate = !filterDate || (reg.selected_date && new Date(reg.selected_date).toDateString() === filterDate.toDateString());
                                    return matchesKeyword && matchesEvent && matchesDate;
                                }).map((reg) => (
                                  <TableRow key={reg.id} className="hover:bg-white/80 transition-all border-black/5 group">
                                    <TableCell className="py-2 px-4">
                                      <Checkbox 
                                        checked={selectedRegIds.includes(reg.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) setSelectedRegIds(prev => [...prev, reg.id]);
                                          else setSelectedRegIds(prev => prev.filter(id => id !== reg.id));
                                        }}
                                        className="h-4 w-4 rounded-md border-black data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                      />
                                    </TableCell>
                                    <TableCell className="py-2 px-4">
                                      <div className="flex items-center gap-3">
                                        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-white font-black text-[11px] sm:text-xs shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                                          {reg.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-black text-slate-900 uppercase tracking-tight text-[11px] sm:text-xs">{reg.name}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <div className="space-y-0.5">
                                        <p className="font-black text-slate-900 text-[11px] sm:text-xs uppercase tracking-tight">{reg.nric_number || '-'}</p>
                                        <div className="flex items-center gap-2">
                                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{reg.nric_confirmed ? 'VERIFIED' : 'UNVERIFIED'}</p>
                                          {reg.document_url && (
                                            <a 
                                              href={reg.document_url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="text-[10px] text-primary font-black uppercase tracking-widest hover:underline flex items-center gap-0.5"
                                            >
                                              <ExternalLink className="w-2.5 h-2.5" />
                                              VIEW DOC
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <div className="space-y-0.5">
                                        <p className="font-bold text-slate-900 text-[11px] sm:text-xs lowercase leading-none">{reg.email}</p>
                                        <p className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-widest">{reg.phone}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <div className="space-y-1">
                                        <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                                          reg.payment_status === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : 
                                          reg.payment_status === 'pending_verification' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                          'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}>
                                          {reg.payment_status === 'paid' ? <Check className="w-3 h-3 mr-1" /> : 
                                           reg.payment_status === 'pending_verification' ? <Clock className="w-3 h-3 mr-1" /> : 
                                           <XCircle className="w-3 h-3 mr-1" />}
                                          {reg.payment_status || 'UNPAID'}
                                        </div>
                                        {reg.paid_amount > 0 && (
                                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                                            MYR {reg.paid_amount.toFixed(2)}
                                          </p>
                                        )}
                                        {reg.payment_method && (
                                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                            VIA {reg.payment_method}
                                          </p>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-slate-900 bg-white/50 px-2 py-1 rounded-lg border border-black/5 w-fit shadow-sm overflow-hidden">
                                        {(() => {
                                        const event = events.find(e => e.id === reg.event_id);
                                        let imgUrl = event?.event_image_url;
                                        if (event?.event_profile_id) {
                                          const profile = eventProfiles.find(p => p.id === event.event_profile_id);
                                          if (profile?.event_hero_image) imgUrl = profile.event_hero_image;
                                        }
                                        return (
                                          <img 
                                            src={imgUrl || eventHero} 
                                            className="w-4 h-4 rounded-full object-cover border border-black/10"
                                            alt=""
                                          />
                                        );
                                      })()}
                                        {reg.selected_date ? format(new Date(reg.selected_date), "EEEE d MMM yyyy").toUpperCase() : (reg.created_at ? format(new Date(reg.created_at), "EEEE d MMM yyyy").toUpperCase() : '-')}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-slate-900 truncate max-w-[150px]">
                                        <MapPin className="w-3 h-3 text-slate-900 flex-shrink-0" />
                                        {(() => {
                                          const event = events.find(e => e.id === reg.event_id);
                                          return event?.location || settings[`event_location_${reg.event_id}`] || settings['event_location'] || 'Location TBA';
                                        })()}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <span className="inline-flex items-center px-2 py-1 rounded-lg bg-primary/5 text-primary/90 text-[11px] sm:text-xs font-black uppercase tracking-widest border border-primary/10 shadow-sm">
                                        {events.find(e => e.id === reg.event_id)?.name || 'Deleted Event'}
                                      </span>
                                    </TableCell>
                                    <TableCell className="py-2 px-4 text-right">
                                      {canEdit('registrations') && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDeleteRegistration(reg.id)}
                                          className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-lg transition-all active:scale-95 border border-transparent hover:border-red-100 shadow-sm"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {registrations.filter(reg => {
                                    const searchStr = registrationFilterKeyword.toLowerCase();
                                    const matchesKeyword = !registrationFilterKeyword || 
                                      reg.name?.toLowerCase().includes(searchStr) || 
                                      reg.email?.toLowerCase().includes(searchStr) ||
                                      reg.phone?.toLowerCase().includes(searchStr);
                                    const matchesEvent = filterEventId === 'all' || reg.event_id === filterEventId;
                                    const matchesDate = !filterDate || (reg.selected_date && new Date(reg.selected_date).toDateString() === filterDate.toDateString());
                                    return matchesKeyword && matchesEvent && matchesDate;
                                }).length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-slate-900">
                                      <div className="flex flex-col items-center gap-4">
                                        <Users className="w-10 h-10 opacity-20" />
                                        <p className="font-black uppercase tracking-widest text-[11px] sm:text-xs">
                                          {registrationFilterKeyword || filterEventId !== 'all' || filterDate ? "No registrations match your search." : "No registrations found."}
                                        </p>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* Mobile Registration Cards */}
                        <div className="md:hidden space-y-4">
                          {registrations.filter(reg => {
                              const searchStr = registrationFilterKeyword.toLowerCase();
                              const matchesKeyword = !registrationFilterKeyword || 
                                reg.name?.toLowerCase().includes(searchStr) || 
                                reg.email?.toLowerCase().includes(searchStr) ||
                                reg.phone?.toLowerCase().includes(searchStr);
                              const matchesEvent = filterEventId === 'all' || reg.event_id === filterEventId;
                              const matchesDate = !filterDate || (reg.selected_date && new Date(reg.selected_date).toDateString() === filterDate.toDateString());
                              return matchesKeyword && matchesEvent && matchesDate;
                          }).length === 0 ? (
                            <div className="text-center py-20 text-slate-900 border-4 border-black/5 border-dashed rounded-[2rem] bg-slate-50/50 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-700">
                              <Users className="w-12 h-12 text-slate-900" />
                              <div className="space-y-1">
                                <p className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-widest">No matches found</p>
                                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest">Adjust your filters or search keywords</p>
                              </div>
                            </div>
                          ) : (
                            registrations.filter(reg => {
                                const searchStr = registrationFilterKeyword.toLowerCase();
                                const matchesKeyword = !registrationFilterKeyword || 
                                  reg.name?.toLowerCase().includes(searchStr) || 
                                  reg.email?.toLowerCase().includes(searchStr) ||
                                  reg.phone?.toLowerCase().includes(searchStr);
                                const matchesEvent = filterEventId === 'all' || reg.event_id === filterEventId;
                                const matchesDate = !filterDate || (reg.selected_date && new Date(reg.selected_date).toDateString() === filterDate.toDateString());
                                return matchesKeyword && matchesEvent && matchesDate;
                            }).map((reg) => (
                              <Card key={reg.id} className="border-black/5 shadow-xl shadow-primary/80/5 overflow-hidden flex flex-col rounded-[2.5rem] bg-white/70 backdrop-blur-md active:scale-[0.98] transition-all animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <CardContent className="p-6 space-y-6">
                                  <div className="flex justify-between items-start gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                      <Checkbox 
                                        checked={selectedRegIds.includes(reg.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) setSelectedRegIds(prev => [...prev, reg.id]);
                                          else setSelectedRegIds(prev => prev.filter(id => id !== reg.id));
                                        }}
                                        className="mt-1 h-5 w-5 rounded-md border-black data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-3">
                                        <span className="text-[11px] sm:text-xs font-black bg-primary text-white px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-primary/10/50">Client</span>
                                        <span className="text-[11px] sm:text-xs font-black bg-white/80 text-slate-900 px-3 py-1 rounded-full border border-black/5 uppercase tracking-widest shadow-sm flex items-center gap-2 overflow-hidden">
                                          {(() => {
                                          const event = events.find(e => e.id === reg.event_id);
                                          let imgUrl = event?.event_image_url;
                                          if (event?.event_profile_id) {
                                            const profile = eventProfiles.find(p => p.id === event.event_profile_id);
                                            if (profile?.event_hero_image) imgUrl = profile.event_hero_image;
                                          }
                                          return (
                                            <img 
                                              src={imgUrl || eventHero} 
                                              className="w-4 h-4 rounded-full object-cover border border-black/10"
                                              alt=""
                                            />
                                          );
                                        })()}
                                          {reg.selected_date ? format(new Date(reg.selected_date), "EEEE d MMM yyyy").toUpperCase() : (reg.created_at ? format(new Date(reg.created_at), "EEEE d MMM yyyy").toUpperCase() : '-')}
                                        </span>
                                      </div>
                                      <p className="font-black text-slate-900 truncate text-[11px] sm:text-xs uppercase tracking-tight leading-none">{reg.name}</p>
                                      <p className="text-[11px] sm:text-xs text-slate-900 truncate flex items-center gap-2 mt-2.5 font-black uppercase tracking-widest">
                                        <Mail className="w-3.5 h-3.5 text-primary/40" />
                                        {reg.email}
                                      </p>
                                    </div>
                                  </div>
                                    {canEdit('registrations') && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteRegistration(reg.id)}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-12 w-12 sm:h-14 sm:w-14 -mr-2 rounded-xl sm:rounded-2xl border border-transparent active:border-red-100 transition-all shadow-sm active:scale-95"
                                      >
                                        <Trash2 className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                                      </Button>
                                    )}
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-6 border-t border-black/5">
                                    <div className="space-y-1.5 sm:space-y-2">
                                      <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest ml-1">Phone Number</p>
                                      <p className="text-[11px] sm:text-xs font-black truncate flex items-center gap-2 text-slate-700 bg-white/50 px-3 py-2 sm:py-2.5 rounded-xl border border-black/5 shadow-sm">
                                        <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary/80" />
                                        {reg.phone}
                                      </p>
                                    </div>
                                    <div className="space-y-1.5 sm:space-y-2">
                                      <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest ml-1">Target Event</p>
                                      <p className="text-[11px] sm:text-xs font-black truncate flex items-center gap-2 text-slate-700 bg-white/50 px-3 py-2 sm:py-2.5 rounded-xl border border-black/5 shadow-sm">
                                        {(() => {
                                          const event = events.find(e => e.id === reg.event_id);
                                          let imgUrl = event?.event_image_url;
                                          if (event?.event_profile_id) {
                                            const profile = eventProfiles.find(p => p.id === event.event_profile_id);
                                            if (profile?.event_hero_image) imgUrl = profile.event_hero_image;
                                          }
                                          return (
                                            <img 
                                              src={imgUrl || eventHero} 
                                              className="w-4 h-4 rounded-full object-cover border border-black/10"
                                              alt=""
                                            />
                                          );
                                        })()}
                                        {events.find(e => e.id === reg.event_id)?.name || 'Deleted Event'}
                                      </p>
                                    </div>
                                    <div className="space-y-1.5 sm:space-y-2 col-span-2">
                                      <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest ml-1">ID / Passport</p>
                                      <div className="flex items-center justify-between text-[11px] sm:text-xs font-black text-slate-700 bg-white/50 px-3 py-2 sm:py-2.5 rounded-xl border border-black/5 shadow-sm">
                                        <div className="flex items-center gap-2">
                                          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary/80" />
                                          <span>{reg.nric_number || "-"}</span>
                                          <span className="text-[9px] opacity-50">({reg.nric_confirmed ? "VERIFIED" : "UNVERIFIED"})</span>
                                        </div>
                                        {reg.document_url && (
                                          <a 
                                            href={reg.document_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline flex items-center gap-1"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            VIEW DOC
                                          </a>
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-1.5 sm:space-y-2 col-span-2">
                                      <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest ml-1">Payment Status</p>
                                      <div className="flex items-center justify-between text-[11px] sm:text-xs font-black text-slate-700 bg-white/50 px-3 py-2 sm:py-2.5 rounded-xl border border-black/5 shadow-sm">
                                        <div className="flex items-center gap-2">
                                          <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                                            reg.payment_status === "paid" ? "bg-green-100 text-green-700 border-green-200" : 
                                            reg.payment_status === "pending_verification" ? "bg-orange-100 text-orange-700 border-orange-200" :
                                            "bg-slate-100 text-slate-700 border-slate-200"
                                          }`}>
                                            {reg.payment_status === "paid" ? <Check className="w-3 h-3 mr-1" /> : 
                                             reg.payment_status === "pending_verification" ? <Clock className="w-3 h-3 mr-1" /> : 
                                             <XCircle className="w-3 h-3 mr-1" />}
                                            {reg.payment_status || "UNPAID"}
                                          </div>
                                          {(reg.paid_amount ?? 0) > 0 && (
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                                              MYR {Number(reg.paid_amount).toFixed(2)}
                                            </span>
                                          )}
                                        </div>
                                        {reg.payment_method && (
                                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                            VIA {reg.payment_method}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
                else if (activeTab === 'reviews') {
                  return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between text-center sm:text-left gap-3 bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-black/5 shadow-xl shadow-primary/80/5">
                        <div className="space-y-0.5">
                          <h3 className="font-black text-[11px] sm:text-xs uppercase tracking-tight">Reviews Management</h3>
                          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">
                            Showing {filteredReviews.length} of {reviews.length} total reviews
                          </p>
                        </div>
                        <div className="w-full sm:w-auto flex flex-col items-center sm:items-end">
                          <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mb-2 block text-center sm:text-right w-full">Filter by service</label>
                          <div className="flex flex-wrap gap-2 w-full justify-center sm:justify-end">
                            <Select value={reviewServiceFilter} onValueChange={setReviewServiceFilter}>
                              <SelectTrigger className="w-full sm:w-[240px] border-black/10 shadow-sm h-10 bg-white/50 backdrop-blur-sm rounded-xl font-black text-[11px] sm:text-xs uppercase tracking-widest hover:bg-white transition-all px-4">
                                <SelectValue placeholder="FILTER BY SERVICE" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-black/10 shadow-2xl backdrop-blur-xl bg-white/95">
                                <SelectItem value="all" className="font-black text-[11px] sm:text-xs uppercase tracking-widest py-2 rounded-lg">ALL SERVICES</SelectItem>
                                {services.map(service => (
                                  <SelectItem key={service.id} value={service.id} className="font-black text-[11px] sm:text-xs uppercase tracking-widest py-2 rounded-lg">{service.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      {reviews.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white/30 backdrop-blur-sm rounded-[2.5rem] border border-black/5 shadow-sm">
                          <MessageSquare className="w-12 h-12 text-slate-900 mb-4 animate-pulse" />
                          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">No reviews found</p>
                          <p className="text-[11px] sm:text-xs text-slate-900 mt-1 font-black uppercase tracking-widest">New reviews will appear here for approval.</p>
                        </div>
                      ) : filteredReviews.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white/30 backdrop-blur-sm rounded-[2.5rem] border border-black/5 shadow-sm">
                          <Filter className="w-12 h-12 text-slate-900 mb-4" />
                          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">No reviews for this service</p>
                          <p className="text-[11px] sm:text-xs text-slate-900 mt-1 font-black uppercase tracking-widest">Try a different service filter.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 sm:gap-6">
                          {filteredReviews.map(review => (
                            <Card key={review.id} className="border-black/5 shadow-xl shadow-primary/80/5 rounded-3xl sm:rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-md group hover:shadow-2xl transition-all duration-500">
                              <CardContent className="p-4 sm:p-8">
                                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                                  <div className="flex-1 min-w-0 w-full">
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-4">
                                      <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/20 uppercase">
                                        {review.customer_name?.[0] || 'U'}
                                      </div>
                                      <div className="flex-1 text-center sm:text-left">
                                        <div className="flex flex-col sm:flex-row items-center gap-2">
                                          <span className="font-black text-slate-900 uppercase tracking-tight text-[11px] sm:text-xs">{review.customer_name}</span>
                                          {review.phone_number && (
                                            <span className="flex items-center gap-1.5 text-[11px] sm:text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200 font-black uppercase tracking-widest" title="Verified WhatsApp Number">
                                              <MessageCircle className="w-3.5 h-3.5" />
                                              {review.phone_number}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1">
                                          <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">on {review.service?.title}</span>
                                          <span className="flex items-center text-yellow-500 text-[11px] sm:text-xs font-black bg-yellow-50 px-2.5 py-1 rounded-full border border-yellow-200 uppercase tracking-widest">
                                            <Star className="w-3 h-3 fill-current mr-1.5" /> {review.rating}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="relative text-center sm:text-left">
                                      <Quote className="absolute -left-2 -top-2 w-8 h-8 text-primary/80/10 -z-10 hidden sm:block" />
                                      <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed font-medium italic border-l-0 sm:border-l-4 border-primary/10 pl-0 sm:pl-4 py-2 mb-4 bg-primary/5/30 rounded-2xl sm:rounded-l-none sm:rounded-r-2xl">
                                        "{review.comment}"
                                      </p>
                                    </div>
                                    
                                    {review.image_urls && review.image_urls.length > 0 && (
                                      <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-3 mb-4">
                                        {review.image_urls.map((url, idx) => (
                                          <div key={idx} className="relative group/img w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-black/5 shadow-sm bg-slate-100 flex-shrink-0">
                                            <img 
                                              src={url} 
                                              alt={`Attached ${idx + 1}`} 
                                              className="w-full h-full object-cover cursor-pointer group-hover/img:scale-110 transition-transform duration-500"
                                              onClick={() => window.open(url, '_blank')}
                                            />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                              <Eye className="w-6 h-6 text-white" />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-4">
                                      <img src={eventHero} className="w-3.5 h-3.5 rounded-full object-cover grayscale" alt="" />
                                      <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest">
                                        {format(new Date(review.created_at), "EEEE d MMM yyyy")}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-row md:flex-col gap-3 w-full md:w-48 pt-6 md:pt-0 border-t md:border-t-0 border-black/5">
                                    {!review.is_approved && canEdit('reviews') && (
                                      <Button 
                                        size="lg" 
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200 h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] sm:text-xs active:scale-95 transition-all" 
                                        onClick={() => handleReviewAction(review.id, true)}
                                      >
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                                      </Button>
                                    )}
                                    {canEdit('reviews') && (
                                      <Button 
                                        size="lg" 
                                        variant="outline" 
                                        className="flex-1 text-red-600 border-red-100 bg-red-50/50 hover:bg-red-50 h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] sm:text-xs active:scale-95 transition-all" 
                                        onClick={() => handleReviewAction(review.id, false)}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                } else if (activeTab === 'bookings') {
                  return (
                    <div className="space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="hidden md:flex flex-col gap-0.5 mb-0.5 bg-white/40 backdrop-blur-md p-0.5 rounded-xl border border-black/5 shadow-xl shadow-primary/80/5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-0.5">
                          <div className="space-y-0">
                            <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tighter flex items-center gap-1">
                              <div className="w-4 h-4 rounded-lg bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                <Plane className="w-2 h-2" />
                              </div>
                              Flight Schedule
                            </h3>
                            <p className="text-[11px] sm:text-xs text-slate-900 font-black uppercase tracking-widest ml-5">Visualizing upcoming flights & availability</p>
                          </div>
                          <span className="text-[11px] sm:text-xs text-primary md:hidden font-black uppercase tracking-widest bg-primary/5 px-1.5 py-1 rounded-full border border-primary/10 shadow-sm animate-pulse flex items-center gap-1">
                            <ArrowRightLeft className="w-2 h-2" /> Swipe to scroll
                          </span>
                        </div>
                        
                        <div className="relative group">
                          <div className="w-full border border-black/5 shadow-2xl rounded-xl overflow-hidden bg-white/80 backdrop-blur-sm relative">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary/80 via-purple-500 to-pink-500 opacity-50" />
                            
                            {/* Scrollable Chart Area */}
                            <div className="overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent -mx-0.5 px-0.5">
                              <div className="min-w-[640px] sm:min-w-[900px] p-0.5">
                                <div className="space-y-0.5">
                                  <TooltipProvider>
                                    {[...bookings]
                                      .sort((a, b) => {
                                        // Sort by date first
                                        const dateA = a.flight_date ? new Date(a.flight_date).getTime() : 0;
                                        const dateB = b.flight_date ? new Date(b.flight_date).getTime() : 0;
                                        if (dateA !== dateB) return dateA - dateB;
                                        
                                        // Then sort by time
                                        const timeA = a.flight_time || "";
                                        const timeB = b.flight_time || "";
                                        return timeA.localeCompare(timeB);
                                      })
                                      .map((booking, i) => (
                                        <div key={booking.booking_id} className="flex items-center gap-1 text-sm group/row">
                                        <div className="w-20 truncate font-black text-slate-700 uppercase text-[11px] sm:text-xs tracking-tight flex items-center gap-0.5">
                                          <div className="w-1 h-1 rounded-full bg-primary/40 group-hover/row:scale-125 transition-transform" />
                                          {booking.customer?.name || 'Guest'}
                                        </div>
                                        <div className="flex-1 bg-slate-50/50 h-6 rounded-lg overflow-hidden border border-black/5 group-hover/row:border-primary/20 group-hover/row:bg-white transition-all duration-300 px-0.5">
                                          <div className="grid grid-cols-12 gap-0.5 items-center h-full">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <div 
                                                  className="h-4 bg-primary rounded-md flex items-center px-1.5 text-[11px] sm:text-xs text-white whitespace-nowrap shadow-md shadow-primary/20 font-black uppercase tracking-widest backdrop-blur-sm border border-white/20 group-hover/row:scale-[1.01] transition-transform cursor-pointer"
                                                  style={{ gridColumn: `${Math.min(9, 2 + i * 2)} / span 3` }}
                                                  onClick={() => {
                                                    setSelectedBooking(booking);
                                                    setEditBookingData({
                                                      flight_date: booking.flight_date,
                                                      flight_time: booking.flight_time,
                                                      status: booking.status,
                                                      payment_type: booking.payment_type || 'full',
                                                      deposit_amount: booking.deposit_amount || 0,
                                                      total_amount: booking.total_amount,
                                                      outstanding_balance: booking.outstanding_balance || 0,
                                                      customer: {
                                                        name: booking.customer?.name || "",
                                                        email: booking.customer?.email || "",
                                                        phone: booking.customer?.phone || ""
                                                      }
                                                    });
                                                    setIsEditingBooking(false);
                                                  }}
                                                >
                                                  <div className="flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                                    Flight {booking.booking_reference}
                                                  </div>
                                                </div>
                                              </TooltipTrigger>
                                              <TooltipContent className="bg-slate-900 text-white border-slate-800 p-3 rounded-xl shadow-2xl">
                                                <div className="space-y-1.5">
                                                  <div className="flex items-center gap-2 border-b border-white/10 pb-1.5 mb-1.5">
                                                    <Plane className="w-3 h-3 text-primary" />
                                                    <span className="font-black uppercase tracking-widest text-xs">Flight Details</span>
                                                  </div>
                                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                                                    <div className="text-slate-400 uppercase font-bold">Reference:</div>
                                                    <div className="font-black text-primary uppercase">{booking.booking_reference}</div>
                                                    
                                                    <div className="text-slate-400 uppercase font-bold">Date:</div>
                                                    <div className="font-black uppercase">
                                                      {(() => {
                                                        try {
                                                          if (!booking.flight_date) return 'Not set';
                                                          const date = new Date(booking.flight_date);
                                                          return (
                                                            <>
                                                              <span className="text-slate-500">{format(date, "EEE").toUpperCase()}</span>
                                                              <span className="text-white ml-1">{format(date, "d MMM yyyy")}</span>
                                                            </>
                                                          );
                                                        } catch (e) {
                                                          return booking.flight_date || 'Not set';
                                                        }
                                                      })()}
                                                    </div>
                                                    
                                                    <div className="text-slate-400 uppercase font-bold">Time:</div>
                                                    <div className="font-black uppercase text-green-400">{booking.flight_time || booking.flight_slot || 'Not set'}</div>

                                                    <div className="text-slate-400 uppercase font-bold">Customer:</div>
                                                    <div className="font-black uppercase">{booking.customer?.name || 'Guest'}</div>
                                                  </div>
                                                </div>
                                              </TooltipContent>
                                            </Tooltip>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </TooltipProvider>
                                </div>
                              </div>
                            </div>
                            
                            {/* Pagination - Fixed outside scroll area */}
                            {bookingTotalPages > 1 && (
                              <div className="mt-0 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-black/5 pt-3 px-3 pb-3 bg-slate-50/50 rounded-b-xl overflow-hidden relative z-10">
                                <div className="text-[10px] sm:text-xs font-black text-slate-900 uppercase tracking-widest bg-white px-3 py-1.5 rounded-full border border-black/5 shadow-sm order-2 sm:order-1 whitespace-nowrap">
                                  Page <span className="text-primary">{bookingPage}</span> OF <span className="text-slate-900">{bookingTotalPages}</span>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBookingPage(p => Math.max(1, p - 1))}
                                    disabled={bookingPage === 1}
                                    className="flex-1 sm:flex-none h-9 px-3 sm:px-4 rounded-xl border-black/5 bg-white shadow-sm transition-all active:scale-95 font-black uppercase tracking-widest text-[10px] sm:text-xs flex items-center justify-center hover:bg-slate-50 hover:border-primary/20"
                                  >
                                    <ChevronLeft className="h-4 w-4 sm:mr-1 text-primary shrink-0" />
                                    <span className="hidden sm:inline">Prev</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBookingPage(p => Math.min(bookingTotalPages, p + 1))}
                                    disabled={bookingPage === bookingTotalPages}
                                    className="flex-1 sm:flex-none h-9 px-3 sm:px-4 rounded-xl border-black/5 bg-white shadow-sm transition-all active:scale-95 font-black uppercase tracking-widest text-[10px] sm:text-xs flex items-center justify-center hover:bg-slate-50 hover:border-primary/20"
                                  >
                                    <span className="hidden sm:inline">Next</span>
                                    <ChevronRight className="h-4 w-4 sm:ml-1 text-primary shrink-0" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-0 pt-0 border-t border-dashed border-black/10">
                        <div className="flex flex-col lg:flex-row flex-wrap gap-2 items-start lg:items-center justify-between bg-white/40 backdrop-blur-md p-1.5 rounded-xl border border-black/5 shadow-xl shadow-primary/80/5">
                          <div className="space-y-0">
                          <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tighter">Booking List</h3>
                            <div className="flex items-center gap-0.5">
                              <p className="text-[11px] sm:text-xs text-primary font-black flex items-center gap-1 uppercase tracking-widest bg-primary/5 px-2 py-1 rounded-full border border-primary/10 w-fit shadow-sm">
                              <Plane className="w-2 h-2" /> {bookingTotalCount} Total
                            </p>
                              <p className="text-[11px] sm:text-xs text-green-600 font-black flex items-center gap-1 uppercase tracking-widest bg-green-50 px-2 py-1 rounded-full border border-green-100 w-fit shadow-sm">
                                <CheckCircle2 className="w-2 h-2" /> {bookings.filter(b => b.status === 'confirmed').length} OK
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row flex-wrap gap-1.5 w-full lg:w-auto items-center">
                            {!selectedBooking ? (
                              <div className="flex flex-col sm:flex-row flex-wrap gap-4 w-full lg:w-auto items-center">
                                <div className="relative w-full sm:w-48 group">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-900 group-focus-within:text-primary transition-colors z-10" />
                                  <Input
                                    placeholder="SEARCH PASSENGERS..."
                                    className="pl-9 border-black/5 shadow-lg shadow-primary/80/5 h-10 bg-white/80 focus:bg-white focus:ring-4 focus:ring-primary/80/10 transition-all rounded-xl font-black text-[11px] sm:text-xs placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-black placeholder:tracking-widest uppercase"
                                    value={bookingFilterKeyword}
                                    onChange={(e) => setBookingFilterKeyword(e.target.value)}
                                  />
                                </div>
                                <div className="flex gap-1 w-full sm:w-auto">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant={"outline"}
                                        className={cn(
                                          "flex-1 sm:w-[150px] justify-start text-left font-black text-[11px] sm:text-xs uppercase tracking-widest border-black/5 shadow-lg shadow-primary/80/5 h-10 bg-white/80 hover:bg-white rounded-xl px-3 transition-all active:scale-95",
                                          !bookingFilterDate && "text-slate-900"
                                        )}
                                      >
                                        <img src={eventHero} className="mr-2 h-4 w-4 rounded-full object-cover grayscale brightness-110" alt="" />
                                        {bookingFilterDate ? format(bookingFilterDate, "EEEE d MMM yyyy").toUpperCase() : <span>FILTER BY DATE</span>}
                                      </Button>
                                    </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0 rounded-xl border-black/5 shadow-2xl overflow-hidden" align="end">
                                    <Calendar
                                      mode="single"
                                      selected={bookingFilterDate}
                                      onSelect={setBookingFilterDate}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                {bookingFilterDate && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setBookingFilterDate(undefined)} 
                                    className="h-10 w-10 text-slate-900 hover:text-red-600 hover:bg-red-50 rounded-xl border border-black/5 shrink-0 transition-all active:scale-90 shadow-sm"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>

                              {/* Excel Export Section */}
                              <div className="flex flex-col sm:flex-row flex-wrap gap-1.5 w-full lg:w-auto items-center">
                                <div className="flex flex-col gap-1 w-full sm:w-auto bg-slate-50/80 border border-black rounded-[1.25rem] p-1.5 sm:p-2 shadow-sm">
                                  <div className="flex items-center justify-between sm:justify-start gap-2 ml-1">
                                    <span className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">Excel Export Report</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            "flex-1 sm:w-[180px] justify-start text-left font-black text-[11px] sm:text-xs uppercase tracking-widest border-black shadow-lg shadow-primary/80/5 h-10 bg-white hover:bg-slate-50 rounded-2xl px-3 transition-all active:scale-95",
                                            !exportDateRange.from && "text-slate-900"
                                          )}
                                        >
                                          <img src={eventHero} className="mr-2 h-4 w-4 rounded-full object-cover grayscale brightness-110" alt="" />
                                          {exportDateRange.from ? (
                                            exportDateRange.to ? (
                                              <span className="truncate">
                                                {format(exportDateRange.from, "EEEE d MMM")} - {format(exportDateRange.to, "EEEE d MMM yyyy")}
                                              </span>
                                            ) : (
                                              format(exportDateRange.from, "EEEE d MMM yyyy")
                                            )
                                          ) : (
                                            <span>Select range</span>
                                          )}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0 rounded-xl border-black/5 shadow-2xl overflow-hidden" align="end">
                                        <Calendar
                                          initialFocus
                                          mode="range"
                                          defaultMonth={exportDateRange.from}
                                          selected={{
                                            from: exportDateRange.from,
                                            to: exportDateRange.to,
                                          }}
                                          onSelect={(range: any) => {
                                            setExportDateRange({
                                              from: range?.from,
                                              to: range?.to,
                                            });
                                          }}
                                          numberOfMonths={2}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                    <Button
                                      onClick={handleExportBookings}
                                      disabled={isExporting || !exportDateRange.from || !exportDateRange.to}
                                      className="h-10 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-2xl border border-black shadow-xl shadow-emerald-200/50 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-1.5"
                                    >
                                      {isExporting ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <FileSpreadsheet className="w-4 h-4" />
                                      )}
                                      <span className="hidden sm:inline">{isExporting ? 'EXPORTING...' : 'EXPORT EXCEL'}</span>
                                      <span className="sm:hidden">{isExporting ? '...' : 'EXPORT'}</span>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                            ) : (
                              <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  onClick={() => setSelectedBooking(null)} 
                                  className="w-full sm:w-auto border-black/5 shadow-lg shadow-primary/80/5 h-10 font-black uppercase tracking-widest bg-white hover:bg-slate-50 rounded-xl px-4 transition-all active:scale-95 text-[11px] sm:text-xs"
                                >
                                <ArrowLeft className="w-4 h-4 mr-2" /> BACK TO LIST
                              </Button>
                            )}
                          </div>
                        </div>

                        {selectedBooking ? (
                          <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Mobile Action Bar */}
                            <div className="flex gap-2 md:hidden mb-2.5">
                              {selectedBooking?.status !== 'confirmed' && (
                                <Button 
                                  className="flex-1 bg-green-600 hover:bg-green-700 h-10 text-[11px] sm:text-xs font-black uppercase tracking-widest shadow-lg rounded-xl active:scale-95 transition-all"
                                  onClick={() => handleApproveBooking(selectedBooking?.booking_id || "")}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve
                                </Button>
                              )}
                              <Button 
                                variant="secondary" 
                                className="flex-1 h-10 text-[11px] sm:text-xs font-black uppercase tracking-widest text-red-600 border-red-100 bg-red-50/50 shadow-sm rounded-xl active:scale-95 transition-all"
                                onClick={() => {
                                  if (selectedBooking?.booking_id) {
                                    handleDeleteBooking(selectedBooking.booking_id);
                                    setSelectedBooking(null);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                              </Button>
                            </div>

                            <Card className="border-black shadow-xl rounded-xl overflow-hidden bg-white relative">
                              <CardHeader className="bg-slate-50/80 pb-1 border-b border-black/5 p-1.5 sm:p-2">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-1.5">
                                  <div className="space-y-0">
                                    <p className="text-[11px] sm:text-xs text-muted-foreground uppercase font-black bg-white px-1.5 py-0.5 rounded-full border border-black/5 w-fit shadow-sm">Booking Reference</p>
                                    <CardTitle className="text-[11px] sm:text-xs font-black text-primary tracking-tighter uppercase">{selectedBooking?.booking_reference}</CardTitle>
                                  </div>
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded-lg text-[11px] sm:text-xs font-black shadow-sm uppercase tracking-widest border",
                                    selectedBooking?.status === 'confirmed' ? 'bg-green-100 text-green-700 border-green-200' :
                                    selectedBooking?.status === 'pending_verification' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                    selectedBooking?.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                    'bg-slate-100 text-slate-700 border-slate-200'
                                  )}>
                                    {selectedBooking?.status === 'pending_verification' ? 'Verifying Pay' : selectedBooking?.status}
                                  </span>
                                </div>
                              </CardHeader>
                              <CardContent className="p-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-b border-black/5">
                                  <div className="p-2 sm:p-3 space-y-2">
                                    <h4 className="font-black flex items-center gap-1.5 text-primary uppercase text-[11px] sm:text-xs tracking-widest">
                                      <UserPlus className="w-3.5 h-3.5" /> Customer Information
                                    </h4>
                                    <div className="space-y-1.5">
                                      <div className="grid grid-cols-1 gap-1.5">
                                        <div className="bg-slate-50 p-2 rounded-lg border border-black/5">
                                          <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest mb-1">Full Name</p>
                                          <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight">{selectedBooking?.customer?.name || 'N/A'}</p>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded-lg border border-black/5">
                                          <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest mb-1">Email Address</p>
                                          <p className="text-[11px] sm:text-xs font-black text-slate-900 lowercase">{selectedBooking?.customer?.email || 'N/A'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-2 sm:p-3 space-y-2 bg-slate-50/30">
                                    <h4 className="font-black flex items-center gap-1.5 text-primary uppercase text-[11px] sm:text-xs tracking-widest">
                                      <img src={eventHero} className="w-3.5 h-3.5 rounded-full object-cover grayscale" alt="" /> Booking Details
                                    </h4>
                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-black/5 shadow-sm">
                                        <p className="text-[11px] sm:text-xs text-muted-foreground uppercase font-black tracking-widest">Booking Date</p>
                                        <p className="text-xs font-black uppercase">
                                          {selectedBooking?.created_at ? (
                                            <>
                                              <span className="text-slate-500">{format(new Date(selectedBooking.created_at), "EEE").toUpperCase()}</span>
                                              <span className="text-slate-900 ml-1">{format(new Date(selectedBooking.created_at), "d MMM yyyy")}</span>
                                            </>
                                          ) : 'N/A'}
                                        </p>
                                      </div>
                                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-black/5 shadow-sm">
                                        <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest">Total Amount</p>
                                        <p className="text-[11px] sm:text-xs font-black text-primary uppercase tracking-tighter">RM {selectedBooking?.total_amount}</p>
                                      </div>
                                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-black/5 shadow-sm mt-1">
                                        <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest">Payment Option</p>
                                        <div className="flex items-center gap-2">
                                          <Badge 
                                            variant="secondary" 
                                            className={cn(
                                              "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border shadow-sm",
                                              selectedBooking?.payment_type === 'deposit' 
                                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                                : 'bg-primary/5 text-primary/90 border-primary/20'
                                            )}
                                          >
                                            {selectedBooking?.payment_type === 'deposit' ? 'Deposit Only' : 'Full Payment'}
                                          </Badge>
                                          <Button 
                                             size="icon" 
                                             variant="ghost" 
                                             className="h-5 w-5 text-slate-400 hover:text-primary hover:bg-primary/5" 
                                             onClick={handleTogglePaymentType}
                                           >
                                             <RefreshCw className="w-3 h-3" />
                                           </Button>
                                         </div>
                                       </div>
                                       {selectedBooking?.payment_type === 'deposit' && (
                                         <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-black/5 shadow-sm mt-1">
                                           <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest">Deposit Amount</p>
                                           {editingDepositAmount ? (
                                             <div className="flex items-center gap-1">
                                               <Input
                                                 value={tempDepositAmount}
                                                 onChange={(e) => setTempDepositAmount(e.target.value)}
                                                 className="h-6 w-20 text-[11px] font-black text-right px-1 py-0"
                                                 type="number"
                                                 step="0.01"
                                               />
                                               <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={handleUpdateDepositAmount}>
                                                 <Check className="w-3.5 h-3.5" />
                                               </Button>
                                               <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setEditingDepositAmount(false)}>
                                                 <XCircle className="w-3.5 h-3.5" />
                                               </Button>
                                             </div>
                                           ) : (
                                             <div className="flex items-center gap-2">
                                               <p className="text-[11px] sm:text-xs font-black text-amber-600 uppercase tracking-tighter">RM {selectedBooking?.deposit_amount || 0}</p>
                                               <Button 
                                                 size="icon" 
                                                 variant="ghost" 
                                                 className="h-5 w-5 text-slate-400 hover:text-primary hover:bg-primary/5" 
                                                 onClick={() => {
                                                   setTempDepositAmount((selectedBooking?.deposit_amount || 0).toString());
                                                   setEditingDepositAmount(true);
                                                 }}
                                               >
                                                 <Pencil className="w-3 h-3" />
                                               </Button>
                                             </div>
                                           )}
                                         </div>
                                       )}
                                       <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-black/5 shadow-sm mt-1">
                                        <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest">Paid Amount</p>
                                        {editingPaidAmount ? (
                                          <div className="flex items-center gap-1">
                                            <Input
                                              value={tempPaidAmount}
                                              onChange={(e) => setTempPaidAmount(e.target.value)}
                                              className="h-6 w-20 text-[11px] font-black text-right px-1 py-0"
                                              type="number"
                                              step="0.01"
                                            />
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={handleUpdatePaidAmount}>
                                              <Check className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setEditingPaidAmount(false)}>
                                              <XCircle className="w-3.5 h-3.5" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <p className="text-[11px] sm:text-xs font-black text-emerald-600 uppercase tracking-tighter">RM {selectedBooking?.paid_amount || 0}</p>
                                            <Button 
                                              size="icon" 
                                              variant="ghost" 
                                              className="h-5 w-5 text-slate-400 hover:text-primary hover:bg-primary/5" 
                                              onClick={() => {
                                                setTempPaidAmount((selectedBooking?.paid_amount || 0).toString());
                                                setEditingPaidAmount(true);
                                              }}
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                      {selectedBooking?.payment_method === 'qr_transfer' ? (
                                        <div className="pt-1.5 border-t border-black/5 mt-1">
                                          <div className="flex justify-between items-center mb-1">
                                            <p className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest">Payment Method</p>
                                            <p className="text-[11px] sm:text-xs font-black flex items-center gap-1.5 text-primary/90 bg-primary/5 px-2 py-1 rounded-full border border-primary/10 uppercase tracking-widest">
                                              <QrCode className="w-3 h-3" /> QR Pay
                                            </p>
                                          </div>
                                          {selectedBooking?.payment_proof_url ? (
                                             <a 
                                              href={selectedBooking.payment_proof_url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="text-[11px] sm:text-xs text-primary hover:text-primary/90 flex items-center gap-1.5 justify-end font-black uppercase tracking-widest bg-white p-2 rounded-lg border border-black/5 shadow-sm active:scale-95 transition-all"
                                            >
                                              <Eye className="w-3 h-3" /> View Receipt
                                            </a>
                                          ) : (
                                            <div className="bg-red-50 p-1.5 rounded-lg border border-red-100 flex items-center justify-center gap-1.5">
                                              <XCircle className="w-3 h-3 text-red-500" />
                                              <p className="text-xs text-red-500 font-black uppercase tracking-widest">Receipt Not Uploaded</p>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="pt-1.5 border-t border-black/5 mt-1">
                                          <div className="flex justify-between items-center">
                                            <p className="text-[11px] sm:text-xs text-muted-foreground uppercase font-black tracking-widest">Payment Method</p>
                                            <p className="text-[11px] sm:text-xs font-black flex items-center gap-1.5 text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-100 uppercase tracking-widest">
                                              <CreditCard className="w-3 h-3" /> Payment Gateway
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="p-2 sm:p-3 space-y-2">
                                  <h4 className="font-black flex items-center gap-1.5 text-primary uppercase text-[11px] sm:text-xs tracking-widest">
                                    <ShoppingBagIcon className="w-3.5 h-3.5" /> Package Information
                                  </h4>
                                  {selectedBooking?.package_details ? (
                                    <div className="rounded-lg border border-black/5 bg-slate-50/50 p-2 sm:p-3 space-y-2 shadow-inner">
                                      <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1">
                                          <p className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">{(selectedBooking.package_details as any).name}</p>
                                          <p className="text-[11px] sm:text-xs text-muted-foreground font-bold mt-1 leading-relaxed">{(selectedBooking.package_details as any).description}</p>
                                        </div>
                                        <p className="font-black text-[11px] sm:text-xs whitespace-nowrap text-primary bg-white px-2 py-1 rounded-lg border border-black/5 shadow-sm">RM {(selectedBooking.package_details as any).price}</p>
                                      </div>
                                      
                                      {(selectedBooking.package_details as any).addons && (selectedBooking.package_details as any).addons.length > 0 && (
                                        <div className="pt-1.5 border-t border-black/5">
                                          <p className="text-[11px] sm:text-xs font-black uppercase text-slate-900 mb-1 tracking-widest">Add-ons</p>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                            {(selectedBooking.package_details as any).addons.map((addon: any, idx: number) => (
                                              <div key={idx} className="flex justify-between items-center text-[11px] sm:text-xs bg-white p-1.5 rounded-lg border border-black/5 shadow-sm group hover:border-primary/20 transition-colors">
                                                <span className="text-slate-900 font-black uppercase tracking-tight">{addon.name}</span>
                                                <span className="font-black text-primary bg-primary/5 px-1.5 py-0.5 rounded-md">+ RM {addon.price}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="bg-slate-50 p-2 rounded-lg border border-dashed border-black/10 flex items-center justify-center gap-2">
                                      <ShoppingBagIcon className="w-3.5 h-3.5 text-slate-900" />
                                      <p className="text-[11px] sm:text-xs text-slate-900 font-black uppercase tracking-widest">No package details available</p>
                                    </div>
                                  )}
                                </div>

                                <div className="p-2 sm:p-3 space-y-2 border-t border-black/5">
                                  <h4 className="font-black flex items-center gap-1.5 text-primary uppercase text-[11px] sm:text-xs tracking-widest">
                                    <Users className="w-3.5 h-3.5" /> Passenger Information
                                  </h4>
                                  {selectedBooking.booking_passengers && selectedBooking.booking_passengers.length > 0 ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                      {selectedBooking.booking_passengers.map((pax, idx) => (
                                        <div key={pax.id} className="rounded-lg border border-black/5 bg-slate-50/50 p-2 sm:p-3 space-y-2 group hover:border-primary/10 transition-colors shadow-sm">
                                          <div className="flex justify-between items-center border-b border-black/5 pb-1.5">
                                            <div className="flex items-center gap-2">
                                              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[11px] sm:text-xs font-black">
                                                {idx + 1}
                                              </span>
                                              <p className="font-black text-[11px] sm:text-xs uppercase tracking-tight text-slate-900">Passenger {idx + 1}</p>
                                            </div>
                                            <span className="text-[11px] sm:text-xs font-black text-muted-foreground uppercase tracking-widest bg-white px-1.5 py-0.5 rounded-full border border-black/5">
                                              {pax.type}
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] sm:text-xs">
                                            <div className="col-span-2">
                                              <p className="text-[11px] sm:text-xs uppercase text-slate-900 font-black tracking-widest mb-1">Full Name</p>
                                              <p className="font-black text-slate-900 uppercase tracking-tight bg-white p-1.5 rounded-lg border border-black/5">{pax.name || '-'}</p>
                                            </div>
                                            <div>
                                              <p className="text-[11px] sm:text-xs uppercase text-muted-foreground font-black tracking-widest mb-1">IC / Passport</p>
                                              <p className="font-black text-slate-900 uppercase tracking-tight bg-white p-1.5 rounded-lg border border-black/5">{pax.ic_passport_number || '-'}</p>
                                            </div>
                                            <div>
                                              <p className="text-[11px] sm:text-xs uppercase text-slate-900 font-black tracking-widest mb-1">Country</p>
                                              <p className="font-black text-slate-900 uppercase tracking-tight bg-white p-2 rounded-lg border border-black/5">{pax.country_of_origin || '-'}</p>
                                            </div>
                                            <div>
                                              <p className="text-[11px] sm:text-xs uppercase text-muted-foreground font-black tracking-widest mb-1">Gender</p>
                                              <p className="font-black text-slate-900 uppercase tracking-tight bg-white p-2 rounded-lg border border-black/5">{pax.gender || '-'}</p>
                                            </div>
                                            <div className="flex gap-2">
                                              <div className="flex-1">
                                                <p className="text-[11px] sm:text-xs uppercase text-muted-foreground font-black tracking-widest mb-1">Weight</p>
                                                <p className="font-black text-slate-900 uppercase tracking-tight bg-white p-2 rounded-lg border border-black/5">{pax.weight} kg</p>
                                              </div>
                                              <div className="flex-1">
                                                <p className="text-[11px] sm:text-xs uppercase text-slate-900 font-black tracking-widest mb-1">Height</p>
                                                <p className="font-black text-slate-900 text-[11px] sm:text-xs uppercase tracking-tight bg-white p-1.5 rounded-lg border border-black/5">{pax.height} cm</p>
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {(pax.id_front_url || pax.id_back_url) && (
                                            <div className="pt-3 border-t border-black/5 mt-1">
                                              <p className="text-[11px] sm:text-xs uppercase text-muted-foreground font-black tracking-widest mb-2">ID Documents</p>
                                              <div className="flex flex-wrap gap-2">
                                                {pax.id_front_url && (
                                                  <a href={pax.id_front_url} target="_blank" rel="noreferrer" className="block w-16 h-12 bg-white rounded-lg overflow-hidden border border-black/10 hover:border-primary/40 transition-all shadow-sm active:scale-95">
                                                     {pax.id_front_url.startsWith('blob:') ? (
                                                       <div className="flex flex-col items-center justify-center text-red-500 p-1 text-center h-full">
                                                         <XCircle className="w-2.5 h-2.5 mb-0.5" />
                                                         <span className="text-[11px] sm:text-xs font-black leading-none uppercase tracking-tighter">Broken</span>
                                                       </div>
                                                     ) : (
                                                       <img src={pax.id_front_url} alt="ID Front" className="w-full h-full object-cover" />
                                                     )}
                                                  </a>
                                                )}
                                                {pax.id_back_url && (
                                                  <a href={pax.id_back_url} target="_blank" rel="noreferrer" className="block w-16 h-12 bg-white rounded-lg overflow-hidden border border-black/10 hover:border-primary/40 transition-all shadow-sm active:scale-95">
                                                     {pax.id_back_url.startsWith('blob:') ? (
                                                       <div className="flex flex-col items-center justify-center text-red-500 p-1 text-center h-full">
                                                         <XCircle className="w-2.5 h-2.5 mb-0.5" />
                                                         <span className="text-[11px] sm:text-xs font-black leading-none uppercase tracking-tighter">Broken</span>
                                                       </div>
                                                     ) : (
                                                       <img src={pax.id_back_url} alt="ID Back" className="w-full h-full object-cover" />
                                                     )}
                                                  </a>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-black/10 flex items-center justify-center gap-2">
                                      <Users className="w-4 h-4 text-slate-900" />
                                      <p className="text-[11px] sm:text-xs text-slate-900 font-black uppercase tracking-widest">No passenger details available</p>
                                    </div>
                                  )}
                                </div>

                                {/* Desktop Actions */}
                                <div className="hidden md:flex p-3 md:p-4 bg-slate-50 border-t border-black/5 justify-end gap-2">
                                  {selectedBooking.status !== 'confirmed' && (
                                    <Button 
                                      className="bg-green-600 hover:bg-green-700 shadow-lg font-black uppercase tracking-widest rounded-xl h-9 px-6 active:scale-95 transition-all text-[11px] sm:text-xs"
                                      onClick={() => handleApproveBooking(selectedBooking.booking_id)}
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Approve Booking
                                    </Button>
                                  )}
                                  <Button 
                                    variant="destructive" 
                                    className="shadow-sm font-black uppercase tracking-widest rounded-xl h-9 px-6 active:scale-95 transition-all text-[11px] sm:text-xs"
                                    onClick={() => {
                                      handleDeleteBooking(selectedBooking.booking_id);
                                      setSelectedBooking(null);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Record
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-1 gap-2.5">
                              {bookings.length === 0 ? (
                                <div className="text-center py-10 px-4 border-2 border-dashed border-black/10 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
                                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2 border border-black/5 shadow-inner">
                                    <Search className="w-6 h-6 text-slate-900" />
                                  </div>
                                        <h3 className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mb-0.5">No Bookings Found</h3>
                                        <p className="text-[11px] sm:text-xs text-slate-900/60 font-medium italic">
                                    {bookingFilterKeyword || bookingFilterDate ? "No match for current filters" : "Start by creating a booking record"}
                                  </p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
                                  {bookings.map(booking => (
                                    <Card 
                                      key={booking.booking_id} 
                                      className="border-black/10 shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer rounded-xl overflow-hidden group bg-white" 
                                      onClick={() => {
                                        setSelectedBooking(booking);
                                        setEditBookingData({
                                          flight_date: booking.flight_date,
                                          flight_time: booking.flight_time,
                                          status: booking.status,
                                          payment_type: booking.payment_type || 'full',
                                          deposit_amount: booking.deposit_amount || 0,
                                          total_amount: booking.total_amount,
                                          outstanding_balance: booking.outstanding_balance || 0,
                                          customer: {
                                            name: booking.customer?.name || "",
                                            email: booking.customer?.email || "",
                                            phone: booking.customer?.phone || ""
                                          }
                                        });
                                        setIsEditingBooking(false);
                                      }}
                                    >
                                      <CardContent className="p-0">
                                        <div className="p-1.5 sm:p-2">
                                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-1.5">
                                            <div className="flex-1 w-full">
                                              <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-1.5 mb-1">
                                                <div className="flex items-center gap-1.5">
                                                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center border border-black/5 group-hover:bg-primary/5 transition-colors">
                                                    <User className="w-3.5 h-3.5 text-slate-900 group-hover:text-primary/80" />
                                                  </div>
                                                  <div>
                                                    <span className="font-black text-[11px] sm:text-xs text-slate-800 group-hover:text-primary transition-colors block leading-tight">{booking.customer?.name || 'Guest'}</span>
                                                    <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-900 uppercase tracking-tighter">REF: {booking.booking_reference}</span>
                                                  </div>
                                                </div>
                                                <span className={`text-[11px] sm:text-xs px-2 py-0.5 rounded-full font-black uppercase tracking-widest shadow-sm w-fit border ${
                                                  booking.status === 'confirmed' ? 'bg-green-100 text-green-700 border-green-200' :
                                                  booking.status === 'pending_verification' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                  booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                                  'bg-slate-100 text-slate-700 border-slate-200'
                                                }`}>
                                                  {booking.status === 'pending_verification' ? 'Verifying' : booking.status}
                                                </span>
                                              </div>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                <div className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground font-medium">
                                                  <Mail className="w-1.5 h-1.5 text-slate-900" />
                                                  <span className="truncate">{booking.customer?.email}</span>
                                                </div>
                                                {booking.customer?.phone && (
                                                  <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-900 font-medium">
                                                    <Phone className="w-1.5 h-1.5 text-slate-900" />
                                                    <span>{booking.customer?.phone}</span>
                                                  </div>
                                                )}
                                              </div>
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {booking.booking_passengers && booking.booking_passengers.length > 0 && (
                                                  <div className="flex items-center gap-1 text-[11px] sm:text-xs text-primary/90 bg-primary/5 px-1.5 py-0.5 rounded-lg border border-primary/10 font-black uppercase tracking-wider">
                                                    <Users className="w-1.5 h-1.5" />
                                                    <span>{booking.booking_passengers.length} PAX</span>
                                                  </div>
                                                )}
                                                <div className={`flex items-center gap-1 text-[11px] sm:text-xs px-1.5 py-0.5 rounded-lg border font-black uppercase tracking-wider ${
                                                  booking.payment_method === 'qr_transfer' 
                                                    ? 'bg-purple-50 text-purple-700 border-purple-100' 
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                }`}>
                                                  {booking.payment_method === 'qr_transfer' ? <QrCode className="w-1.5 h-1.5" /> : <CreditCard className="w-1.5 h-1.5" />}
                                                  <span>{booking.payment_method === 'qr_transfer' ? 'QR Pay' : 'Gateway'}</span>
                                                </div>
                                                <div className={`flex items-center gap-1 text-[11px] sm:text-xs px-1.5 py-0.5 rounded-lg border font-black uppercase tracking-wider ${
                                                  booking.payment_type === 'deposit' 
                                                    ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                                    : 'bg-blue-50 text-blue-700 border-blue-100'
                                                }`}>
                                                  <span>{booking.payment_type === 'deposit' ? 'Deposit' : 'Full'}</span>
                                                  <span className="ml-1">RM {booking.payment_type === 'deposit' ? booking.deposit_amount : booking.total_amount}</span>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="w-full sm:w-auto flex flex-col items-start sm:items-end gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-black/5">
                                              <div className="grid grid-cols-2 sm:flex sm:flex-col gap-1.5 w-full sm:w-auto">
                                                <div className="bg-slate-50/80 p-1.5 rounded-lg border border-black/5 min-w-[100px]">
                                                  <p className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-black tracking-tighter leading-none mb-1">Flight Date</p>
                                                  <p className="text-xs sm:text-sm font-black uppercase tracking-tight">
                                                    {booking.flight_date ? (
                                                      <>
                                                        <span className="text-slate-500">{format(new Date(booking.flight_date), "EEE").toUpperCase()}</span>
                                                        <span className="text-slate-900 ml-1">{format(new Date(booking.flight_date), "d MMM yyyy")}</span>
                                                      </>
                                                    ) : <span className="text-slate-900">N/A</span>}
                                                  </p>
                                                </div>
                                                <div className="bg-slate-50/80 p-1.5 rounded-lg border border-black/5 min-w-[100px]">
                                                  <p className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-black tracking-tighter leading-none mb-1">Flight Time</p>
                                                  <p className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">{booking.flight_time || 'N/A'}</p>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="px-1.5 pb-1.5 sm:px-2 sm:pb-2">
                                          <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-black/5">
                                            <Button 
                                              variant="outline" 
                                              size="sm" 
                                              className="h-7 sm:h-8 flex-1 sm:flex-none text-[11px] sm:text-xs font-black uppercase tracking-widest border-black text-primary bg-white hover:bg-primary hover:text-white shadow-sm rounded-xl active:scale-95 transition-all" 
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setSelectedBooking(booking);
                                                setEditBookingData({
                                                  flight_date: booking.flight_date,
                                                  flight_time: booking.flight_time,
                                                  status: booking.status,
                                                  payment_type: booking.payment_type || 'full',
                                                  deposit_amount: booking.deposit_amount || 0,
                                                  total_amount: booking.total_amount,
                                                  outstanding_balance: booking.outstanding_balance || 0,
                                                  customer: {
                                                    name: booking.customer?.name || "",
                                                    email: booking.customer?.email || "",
                                                    phone: booking.customer?.phone || ""
                                                  }
                                                });
                                                setIsEditingBooking(false);
                                              }}
                                            >
                                              <Eye className="w-3.5 h-3.5 mr-1" /> View Details
                                            </Button>
                                            {canEdit('bookings') && booking.status === 'confirmed' && (
                                              <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-7 sm:h-8 flex-1 sm:flex-none text-[11px] sm:text-xs font-black uppercase tracking-widest text-orange-600 border-black hover:bg-orange-50 shadow-sm rounded-xl active:scale-95 transition-all" 
                                                onClick={(e) => { e.stopPropagation(); handlePendingBooking(booking.booking_id); }}
                                              >
                                                <Clock className="w-3.5 h-3.5 mr-1" /> Revert
                                              </Button>
                                            )}
                                            {canEdit('bookings') && booking.status !== 'confirmed' && (
                                              <Button 
                                                size="sm" 
                                                className="h-7 sm:h-8 flex-1 sm:flex-none text-[11px] sm:text-xs font-black uppercase tracking-widest bg-green-600 hover:bg-green-700 text-white shadow-md rounded-xl active:scale-95 transition-all border border-black" 
                                                onClick={(e) => { e.stopPropagation(); handleApproveBooking(booking.booking_id); }}
                                              >
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                                              </Button>
                                            )}
                                            {canEdit('bookings') && (booking.payment_status === 'paid' || booking.status === 'confirmed') && (
                                              <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-7 sm:h-8 flex-1 sm:flex-none text-[11px] sm:text-xs font-black uppercase tracking-widest text-red-600 border-black hover:bg-red-50 shadow-sm rounded-xl active:scale-95 transition-all" 
                                                onClick={(e) => { e.stopPropagation(); handleRefundBooking(booking.booking_id); }}
                                              >
                                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refund
                                              </Button>
                                            )}
                                            {canEdit('bookings') && (
                                              <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="h-7 w-7 sm:h-8 sm:w-8 text-red-400 hover:text-red-600 hover:bg-red-50 ml-auto rounded-xl active:scale-90 transition-all" 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteBooking(booking.booking_id); }}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            )}
                                          </div>
                                          <div className="flex justify-end px-1.5 pb-1">
                                            <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-widest font-bold italic">
                                              Created: {format(new Date(booking.created_at), "dd MMM yyyy HH:mm")}
                                            </span>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              )}
            </div>
            {bookingTotalPages > 1 && (
              <div className="mt-0.5 flex flex-col sm:flex-row items-center justify-between gap-0.5 bg-slate-50/50 p-0.5 rounded-xl border border-black/5 animate-in slide-in-from-bottom-2 duration-500">
                <div className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 order-2 sm:order-1 ml-1">
                  Page {bookingPage} <span className="mx-1 text-slate-900">/</span> {bookingTotalPages}
                </div>
                <Pagination className="w-auto mx-0 order-1 sm:order-2">
                  <PaginationContent className="gap-0.5">
                    <PaginationItem>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setBookingPage(prev => Math.max(prev - 1, 1))}
                        disabled={bookingPage === 1}
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border-black/5 bg-white shadow-sm active:scale-90 transition-all disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </PaginationItem>
                    
                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: Math.min(3, bookingTotalPages) }).map((_, i) => {
                        let p;
                        if (bookingTotalPages <= 3) p = i + 1;
                        else if (bookingPage === 1) p = i + 1;
                        else if (bookingPage === bookingTotalPages) p = bookingTotalPages - 2 + i;
                        else p = bookingPage - 1 + i;
                        
                        if (p < 1 || p > bookingTotalPages) return null;
                        
                        return (
                          <PaginationItem key={p}>
                            <Button
                              variant={p === bookingPage ? "default" : "outline"}
                              onClick={() => setBookingPage(p)}
                        className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg text-[11px] sm:text-xs font-black active:scale-90 transition-all ${
                                p === bookingPage 
                                  ? "bg-primary hover:bg-primary/90 text-white border-0 shadow-md" 
                                  : "bg-white hover:bg-slate-50 border-black/5 text-slate-900"
                              }`}
                            >
                              {p}
                            </Button>
                          </PaginationItem>
                        );
                      })}
                    </div>

                    <PaginationItem>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setBookingPage(prev => Math.min(prev + 1, bookingTotalPages))}
                        disabled={bookingPage === bookingTotalPages}
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border-black/5 bg-white shadow-sm active:scale-90 transition-all disabled:opacity-30"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                else if (activeTab === 'categories') {
                  return (
                    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      {categories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 bg-white/30 backdrop-blur-sm rounded-xl border border-black/5 shadow-sm">
                          <Tag className="w-6 h-6 text-slate-900 mb-2 animate-pulse" />
                          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">No categories found</p>
                          <p className="text-[11px] sm:text-xs text-slate-900 mt-0.5">Categories from the database will appear here.</p>
                        </div>
                      ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                          <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2.5">
                              {categories.map(category => (
                                <SortableCategoryItem 
                                  key={category.id} 
                                  category={category} 
                                  canEdit={canEdit('categories')} 
                                  onToggleMainPage={handleToggleMainPage} 
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}
                    </div>
                  );
                }
                else if (activeTab === "packages") { return (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <div className="space-y-2">
                        {/* Group by category (already sorted by sort_order) */}
                        {categories.map(category => {
                          const catPackages = packages.filter(p => p.category_id === category.id);
                          return (
                            <div key={category.id} className="mb-2">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="font-black text-[11px] sm:text-xs uppercase tracking-tight flex items-center gap-2 text-slate-900">
                                  <Tag className="w-4 h-4 text-primary" /> {category.name}
                                </h3>
                                {canEdit('packages') && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={async () => {
                                      if (!confirm(`Are you sure you want to delete the category "${category.name}" and all its packages?`)) return;
                                      // 1. Delete all packages in this category first
                                      for (const pkg of catPackages) {
                                        const { error: pkgError } = await supabase.from('packages').delete().eq('id', pkg.id);
                                        if (pkgError) {
                                          toast.error(`Failed to delete package ${pkg.name}: ${pkgError.message}`);
                                          return;
                                        }
                                      }
                                      // 2. Delete the category itself
                                      const { error: catError } = await supabase.from('categories').delete().eq('id', category.id);
                                      if (catError) {
                                        if (catError.code === '23503') {
                                          toast.error(`Cannot delete category "${category.name}": It is being used by other records.`);
                                        } else {
                                          toast.error(`Failed to delete category: ${catError.message}`);
                                        }
                                        return;
                                      }
                                      toast.success(`Deleted category "${category.name}"`);
                                      logActivity('delete', 'categories', category.id, { name: category.name, deleted_packages_count: catPackages.length });
                                      fetchAllData();
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                              <SortableContext 
                                items={catPackages.map(i => i.id)} 
                                strategy={verticalListSortingStrategy}
                              >
                                  {catPackages.map((item) => {
                                    const now = new Date();
                                    const start = item.promotion_start_at ? new Date(item.promotion_start_at) : null;
                                    const end = item.promotion_end_at ? new Date(item.promotion_end_at) : null;
                                    const isPromoActive = item.promotion_price && (!start || start <= now) && (!end || end > now);
                                    
                                    return (
                                      <SortableItem
                                        key={item.id}
                                        id={item.id}
                                        title={item.name}
                                        subtitle={`RM ${item.price} | Order: ${item.sort_order}`}
                                        canEdit={canEdit('packages')}
                                        onEdit={() => setEditingItem(item)}
                                        onDelete={() => handleDeleteItem(item)}
                                        badge={isPromoActive ? (
                                          <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-sm animate-pulse">
                                            <Tag className="w-2 h-2" /> RM {item.promotion_price}
                                          </div>
                                        ) : null}
                                      />
                                    );
                                  })}
                              </SortableContext>
                              {catPackages.length === 0 && (
                                <div className="text-[11px] sm:text-xs text-slate-900 italic p-1 px-4">No packages in this category</div>
                              )}
                            </div>
                          );
                        })}
                        {/* Uncategorized Packages */}
                        {(() => {
                          const categorizedIds = categories.map(c => c.id);
                          const uncategorizedPackages = packages.filter(p => !p.category_id || !categorizedIds.includes(p.category_id));
                          if (uncategorizedPackages.length === 0) return null;
                          return (
                            <div className="mb-6 border-t pt-6">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="font-black text-[11px] sm:text-xs uppercase tracking-tight flex items-center gap-2 text-slate-900">
                                  <Tag className="w-4 h-4 text-primary" /> Uncategorized
                                </h3>
                              </div>
                              <SortableContext 
                                items={uncategorizedPackages.map(i => i.id)} 
                                strategy={verticalListSortingStrategy}
                              >
                                {uncategorizedPackages.map((item) => {
                                  const now = new Date();
                                  const start = item.promotion_start_at ? new Date(item.promotion_start_at) : null;
                                  const end = item.promotion_end_at ? new Date(item.promotion_end_at) : null;
                                  const isPromoActive = item.promotion_price && (!start || start <= now) && (!end || end > now);
                                  
                                  return (
                                    <SortableItem
                                      key={item.id}
                                      id={item.id}
                                      title={item.name}
                                      subtitle={`RM ${item.price} | Order: ${item.sort_order}`}
                                      canEdit={canEdit('packages')}
                                      onEdit={() => setEditingItem(item)}
                                      onDelete={() => handleDeleteItem(item)}
                                      badge={isPromoActive ? (
                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-sm animate-pulse">
                                          <Tag className="w-2 h-2" /> RM {item.promotion_price}
                                        </div>
                                      ) : null}
                                    />
                                  );
                                })}
                              </SortableContext>
                            </div>
                          );
                        })()}
                      </div>
                    </DndContext>
                  );
                }
                else if (activeTab === 'users' && isAdmin()) { return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 px-1">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary p-2.5 rounded-[1.25rem] border border-primary/40/20 shadow-xl shadow-primary/80/20">
                              <Users className="w-6 h-6 text-white" />
                            </div>
                            <div className="space-y-0.5">
                              <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight leading-none">Users</h3>
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                                <span className="h-px w-3 bg-slate-200" />
                                System Access Control
                              </p>
                            </div>
                          </div>
                          <Dialog open={isRolePermsOpen} onOpenChange={setIsRolePermsOpen}>
                            <DialogTrigger asChild>
                              <Button variant="default" className="gap-2.5 bg-white hover:bg-slate-50 text-primary border border-black/5 shadow-xl shadow-primary/80/5 h-10 px-5 rounded-xl font-black uppercase tracking-widest text-[11px] sm:text-xs active:scale-95 transition-all">
                                <ShieldCheck className="w-4.5 h-4.5" /> PERMISSIONS
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-none shadow-2xl w-[95vw] sm:w-full rounded-[2.5rem] animate-in zoom-in-95 duration-300">
                              <DialogHeader className="px-6 pt-6 sm:px-8 sm:pt-8 pb-1.5 bg-white/80 backdrop-blur-xl border-b border-black sticky top-0 z-10 relative">
                                <DialogTitle className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight">Access Rules</DialogTitle>
                                <DialogDescription className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary/80 bg-primary/5/50 px-3.5 py-1.25 rounded-full border border-primary/10/50 inline-block mt-1.5">
                                  Define granular permissions for each system role
                                </DialogDescription>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setIsRolePermsOpen(false)}
                                  className="absolute right-3 top-3 sm:right-5 sm:top-5 h-9 w-9 rounded-full border border-black/5 bg-white/70 hover:bg-white text-slate-700 shadow-sm"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </DialogHeader>
                              <div className="p-0 sm:px-8 sm:pb-8">
                                <div className="rounded-[1.5rem] border border-black bg-white/60 backdrop-blur-sm shadow-sm overflow-hidden">
                                  <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50/80 border-b border-black">
                                          <th className="sticky left-0 z-20 bg-slate-50/80 p-5 text-left min-w-[130px] border-r border-black">
                                            <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Role</span>
                                          </th>
                                          {['hero_slides', 'experiences', 'services', 'features', 'videos', 'categories', 'packages', 'reviews', 'bookings', 'analytics', 'settings', 'safety', 'registrations', 'payments'].map(module => (
                                            <th key={module} className="p-5 text-center min-w-[160px] border-r border-black last:border-r-0">
                                              <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 block mb-1.5">{module.replace('_', ' ')}</span>
                                              <div className="flex justify-center gap-6 px-3">
                                                <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary/80/70">View</span>
                                                <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-rose-500/70">Edit</span>
                                              </div>
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {AVAILABLE_ROLES.filter(r => r !== 'Administrator').map(role => (
                                          <tr key={role} className="border-b border-black last:border-b-0 hover:bg-slate-50/30 transition-colors">
                                            <td className="sticky left-0 z-20 bg-white/80 backdrop-blur-md p-5 border-r border-black">
                                              <span className="font-black uppercase tracking-widest text-primary text-[11px] sm:text-xs">{role}</span>
                                            </td>
                                            {['hero_slides', 'experiences', 'services', 'features', 'videos', 'categories', 'packages', 'reviews', 'bookings', 'analytics', 'settings', 'safety', 'registrations', 'payments'].map(module => {
                                              const perm = rolePermissions.find(p => p.role === role && p.module === module);
                                              return (
                                                <td key={module} className="p-5 border-r border-black last:border-r-0">
                                                  <div className="flex justify-center gap-6">
                                                    <Checkbox
                                                      checked={perm?.can_view || false}
                                                      onCheckedChange={(v) => handleRolePermissionChange(role, module, 'view', v as boolean)}
                                                      className="h-6 w-6 rounded-md border-black data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-sm active:scale-90 transition-transform"
                                                    />
                                                    <Checkbox
                                                      checked={perm?.can_edit || false}
                                                      onCheckedChange={(v) => handleRolePermissionChange(role, module, 'edit', v as boolean)}
                                                      className="h-6 w-6 rounded-md border-black data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600 shadow-sm active:scale-90 transition-transform"
                                                    />
                                                  </div>
                                                </td>
                                              );
                                            })}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                        <div className="relative w-full xl:w-96 group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-900 group-focus-within:text-primary transition-colors" />
                          <Input
                            placeholder="Find user by email or role..."
                            className="pl-12 border-black/5 h-12 shadow-xl shadow-primary/80/5 rounded-[2.5rem] focus-visible:ring-primary bg-white/70 backdrop-blur-sm focus:bg-white transition-all text-[11px] sm:text-xs font-bold placeholder:text-slate-900 placeholder:font-black placeholder:uppercase placeholder:tracking-widest placeholder:text-[11px] sm:placeholder:text-xs"
                            value={userFilterKeyword}
                            onChange={(e) => setUserFilterKeyword(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="hidden md:block rounded-[2.5rem] border border-black/5 overflow-hidden shadow-2xl bg-white/70 backdrop-blur-md">
                        <Table>
                          <TableHeader className="bg-slate-50/80 border-b border-black/5">
                            <TableRow className="hover:bg-transparent h-14">
                              <TableHead className="font-black text-slate-900 uppercase tracking-widest text-[11px] sm:text-xs px-8">User Information</TableHead>
                              <TableHead className="font-black text-slate-900 uppercase tracking-widest text-[11px] sm:text-xs">Access Role</TableHead>
                              <TableHead className="font-black text-slate-900 uppercase tracking-widest text-[11px] sm:text-xs">Approval Status</TableHead>
                              <TableHead className="font-black text-slate-900 uppercase tracking-widest text-[11px] sm:text-xs text-right px-8">Administrative Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {adminUsers.filter(user => {
                              const searchStr = userFilterKeyword.toLowerCase();
                              return (
                                user.email.toLowerCase().includes(searchStr) ||
                                user.role.toLowerCase().includes(searchStr)
                              );
                            }).length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-16">
                                  <div className="flex flex-col items-center gap-4 opacity-20">
                                    <div className="bg-slate-100 p-4 rounded-full border border-black/5 shadow-inner">
                                      <Users className="w-10 h-10 text-slate-900" />
                                    </div>
                                    <p className="font-black uppercase tracking-widest text-[11px] sm:text-xs text-slate-900">
                                      {userFilterKeyword ? "No matching users found" : "No registered users"}
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : (
                              adminUsers.filter(user => {
                                const searchStr = userFilterKeyword.toLowerCase();
                                return (
                                  user.email.toLowerCase().includes(searchStr) ||
                                  user.role.toLowerCase().includes(searchStr)
                                );
                              }).map(user => (
                                <TableRow key={user.id} className="hover:bg-primary/5/30 transition-colors border-b border-black/5 last:border-0 h-16">
                                  <TableCell className="px-8">
                                    <div className="flex items-center gap-4">
                                      <div className="h-10 w-10 rounded-xl bg-white border border-black/5 shadow-sm flex items-center justify-center text-primary font-black text-[11px] sm:text-xs">
                                        {user.email.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="font-black text-slate-900 lowercase tracking-tight text-[11px] sm:text-xs">{user.email}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Select 
                                      value={user.role} 
                                      onValueChange={async (newRole) => {
                                        if (!supabase) return;
                                        const { error } = await supabase.from('admin_users').update({ role: newRole }).eq('id', user.id);
                                        if (error) toast.error("Failed to update role");
                                        else {
                                          toast.success("Role updated");
                                          logActivity('update', 'admin_users', user.id, { role: newRole, email: user.email });
                                          fetchAdminData();
                                        }
                                      }}
                                      disabled={user.email === 'admin@oneday.com'}
                                    >
                                      <SelectTrigger className="w-40 h-10 text-[11px] sm:text-xs font-black uppercase tracking-widest border-black/5 rounded-[2.5rem] bg-white/50 shadow-sm focus:ring-primary hover:bg-white transition-all">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-[2.5rem] border-black/5 shadow-2xl">
                                        {AVAILABLE_ROLES.map(role => (
                                          <SelectItem key={role} value={role} className="text-[11px] sm:text-xs font-black uppercase tracking-widest py-3 rounded-xl mx-2 my-1">{role}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <span className={cn(
                                      "px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-widest border shadow-sm inline-flex items-center gap-2",
                                      user.is_approved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                    )}>
                                      <span className={cn("w-1.5 h-1.5 rounded-full", user.is_approved ? "bg-green-500" : "bg-amber-500")} />
                                      {user.is_approved ? 'Approved Access' : 'Awaiting Approval'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="px-8">
                                    <div className="flex justify-end gap-3">
                                      <Button 
                                        size="sm" 
                                        variant={user.is_approved ? "outline" : "default"} 
                                        onClick={() => handleToggleApproval(user.id, user.is_approved)}
                                        disabled={user.email === 'admin@oneday.com'}
                                        className={cn(
                                          "h-10 px-6 font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-[2.5rem] shadow-lg active:scale-95 transition-all",
                                          user.is_approved ? "border-red-100 text-red-600 bg-red-50/50 hover:bg-red-100 hover:text-red-700" : "bg-primary hover:bg-primary/90 text-white"
                                        )}
                                      >
                                        {user.is_approved ? "Revoke" : "Approve"}
                                      </Button>
                                      {user.email !== 'admin@oneday.com' && (
                                        <Button 
                                          size="icon" 
                                          variant="secondary"
                                          className="h-10 w-10 text-red-600 border-red-50 bg-red-50/50 hover:bg-red-100 rounded-[2.5rem] active:scale-90 transition-all shadow-lg"
                                          onClick={() => handleDeleteUser(user.id, user.email)}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile User List */}
                      <div className="md:hidden space-y-4">
                        {adminUsers.filter(user => {
                          const searchStr = userFilterKeyword.toLowerCase();
                          return (
                            user.email.toLowerCase().includes(searchStr) ||
                            user.role.toLowerCase().includes(searchStr)
                          );
                        }).length === 0 ? (
                          <div className="text-center py-16 border-2 border-dashed border-black/5 rounded-[3rem] bg-slate-50/30 flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-white p-4 rounded-[2rem] shadow-xl border border-black/5">
                              <Users className="w-10 h-10 text-slate-900" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-black uppercase tracking-widest text-[11px] sm:text-xs text-slate-900">No users found</p>
                              <p className="text-[11px] sm:text-xs text-slate-900 font-medium tracking-tight">Try adjusting your search filter</p>
                            </div>
                          </div>
                        ) : (
                          adminUsers.filter(user => {
                            const searchStr = userFilterKeyword.toLowerCase();
                            return (
                              user.email.toLowerCase().includes(searchStr) ||
                              user.role.toLowerCase().includes(searchStr)
                            );
                          }).map(user => (
                            <Card key={user.id} className="border-black/5 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-md group animate-in fade-in slide-in-from-bottom-6 duration-500 hover:shadow-primary/80/10 transition-all active:scale-[0.98]">
                              <CardContent className="p-0">
                                <div className="p-4 bg-white/50 border-b border-black/5 flex justify-between items-center gap-3">
                                  <div className="space-y-2 min-w-0 flex-1">
                                    <div className="flex items-center gap-3">
                                      <div className="h-10 w-10 rounded-[1rem] bg-primary border border-primary/40/20 flex items-center justify-center text-white font-black text-[11px] sm:text-xs shadow-lg shadow-primary/80/20">
                                        {user.email.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="space-y-0.5 min-w-0">
                                        <p className="font-black text-slate-900 lowercase tracking-tight truncate text-[11px] sm:text-xs leading-none">{user.email}</p>
                                        <div className="flex items-center gap-2">
                                          <span className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-widest border shadow-sm",
                                            user.is_approved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                                          )}>
                                            {user.is_approved ? 'Approved' : 'Pending'}
                                          </span>
                                          <span className="text-[11px] sm:text-xs text-slate-900 font-black uppercase tracking-widest bg-white/80 px-2 py-0.5 rounded-full border border-black/5 shadow-sm">{user.role}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  {user.email !== 'admin@oneday.com' && (
                                    <Button 
                                      size="icon" 
                                      variant="secondary"
                                      className="h-10 w-10 text-red-600 border-red-50 bg-red-50/50 hover:bg-red-100 rounded-[2.5rem] active:scale-90 transition-all shadow-lg flex-shrink-0"
                                      onClick={() => handleDeleteUser(user.id, user.email)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                                
                                <div className="p-4 space-y-4">
                                  <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                      <label className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest flex items-center gap-2 ml-2">
                                        <ShieldCheck className="w-3.5 h-3.5 text-primary/80" /> Access Control
                                      </label>
                                      <Button 
                                        size="lg" 
                                        variant={user.is_approved ? "outline" : "default"} 
                                        onClick={() => handleToggleApproval(user.id, user.is_approved)}
                                        disabled={user.email === 'admin@oneday.com'}
                                        className={cn(
                                          "w-full h-12 font-black text-[11px] sm:text-xs uppercase tracking-widest shadow-xl rounded-[2.5rem] active:scale-95 transition-all border-2",
                                          user.is_approved ? "border-red-100 text-red-600 bg-red-50/50 hover:bg-red-100" : "bg-primary hover:bg-primary/90 text-white border-transparent"
                                        )}
                                      >
                                        {user.is_approved ? "Revoke System Access" : "Grant System Access"}
                                      </Button>
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[11px] sm:text-xs text-slate-900 uppercase font-black tracking-widest flex items-center gap-2 ml-2">
                                        <UserPlus className="w-3.5 h-3.5 text-primary/80" /> Permission Role
                                      </label>
                                      <Select 
                                        value={user.role} 
                                        onValueChange={async (newRole) => {
                                            if (!supabase) return;
                                            const { error } = await supabase.from('admin_users').update({ role: newRole }).eq('id', user.id);
                                            if (error) toast.error("Failed to update role");
                                            else {
                                              toast.success("Role updated");
                                              logActivity('update', 'admin_users', user.id, { role: newRole, email: user.email });
                                              fetchAdminData();
                                            }
                                          }}
                                        disabled={user.email === 'admin@oneday.com'}
                                      >
                                        <SelectTrigger className="w-full h-12 text-[11px] sm:text-xs font-black uppercase tracking-widest border-black/5 bg-slate-50/50 rounded-[2.5rem] shadow-inner focus:ring-2 focus:ring-primary/80/20">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-[2.5rem] border-black/5 shadow-2xl backdrop-blur-xl">
                                          {AVAILABLE_ROLES.map(role => (
                                            <SelectItem key={role} value={role} className="text-[11px] font-black uppercase tracking-widest py-4 rounded-xl mx-2 my-1 focus:bg-primary/5">{role}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </div>
                  );
                }
                else if (activeTab === 'safety') { return (
                    <fieldset disabled={!canEdit('safety')} className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-1">
                        <div className="space-y-3 bg-white/70 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-black/5 shadow-xl shadow-primary/80/5 group hover:shadow-2xl transition-all duration-500">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="bg-primary/5 p-2 rounded-xl border border-primary/10 group-hover:scale-110 transition-transform duration-500 shadow-sm">
                              <Scale className="w-5 h-5 text-primary" />
                            </div>
                            <div className="space-y-0.5">
                              <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight leading-tight">Weight Limits</h3>
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary/80 bg-primary/5/50 px-2 py-0.5 rounded-full border border-primary/10/50 inline-block">Specify maximum weight thresholds in kilograms</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1.5">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Max Weight per Pax</label>
                              <div className="relative group/input">
                                  <Input 
                                  type="number"
                                  value={localSettings.safety_max_weight_per_pax ?? settings.safety_max_weight_per_pax ?? '120'} 
                                  onChange={(e) => handleLocalSettingChange('safety_max_weight_per_pax', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-sm focus:ring-2 focus:ring-primary/80/20" 
                                  placeholder="e.g. 120"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">KG</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Combined (2 Pax)</label>
                              <div className="relative group/input">
                                <Input 
                                  type="number"
                                  value={localSettings.safety_combined_weight_2pax ?? settings.safety_combined_weight_2pax ?? '160'} 
                                  onChange={(e) => handleLocalSettingChange('safety_combined_weight_2pax', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-sm focus:ring-2 focus:ring-primary/80/20" 
                                  placeholder="e.g. 160"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">KG</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Combined (3 Pax)</label>
                              <div className="relative group/input">
                                <Input 
                                  type="number"
                                  value={localSettings.safety_combined_weight_3pax ?? settings.safety_combined_weight_3pax ?? '200'} 
                                  onChange={(e) => handleLocalSettingChange('safety_combined_weight_3pax', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-sm focus:ring-2 focus:ring-primary/80/20" 
                                  placeholder="e.g. 200"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">KG</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Total Limit (Excl. Pilot)</label>
                              <div className="relative group/input">
                                <Input 
                                  type="number"
                                  value={localSettings.safety_total_weight_limit ?? settings.safety_total_weight_limit ?? '200'} 
                                  onChange={(e) => handleLocalSettingChange('safety_total_weight_limit', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-sm focus:ring-2 focus:ring-primary/80/20" 
                                  placeholder="e.g. 200"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">KG</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3 bg-white/70 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-black/5 shadow-xl shadow-primary/80/5 group hover:shadow-2xl transition-all duration-500">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="bg-primary/5 p-2 rounded-xl border border-primary/10 group-hover:scale-110 transition-transform duration-500 shadow-sm">
                              <Layout className="w-5 h-5 text-primary" />
                            </div>
                            <div className="space-y-0.5">
                              <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight leading-tight">Height Requirements</h3>
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary/80 bg-primary/5/50 px-2 py-0.5 rounded-full border border-primary/10/50 inline-block">Specify height constraints in centimeters</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1.5">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Minimum Height</label>
                              <div className="relative group/input">
                                <Input 
                                  type="number"
                                  value={localSettings.safety_min_height ?? settings.safety_min_height ?? '150'} 
                                  onChange={(e) => handleLocalSettingChange('safety_min_height', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-sm focus:ring-2 focus:ring-primary/80/20" 
                                  placeholder="e.g. 150"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">CM</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Maximum Height</label>
                              <div className="relative group/input">
                                <Input 
                                  type="number"
                                  value={localSettings.safety_max_height ?? settings.safety_max_height ?? '180'} 
                                  onChange={(e) => handleLocalSettingChange('safety_max_height', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-sm focus:ring-2 focus:ring-primary/80/20" 
                                  placeholder="e.g. 180"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">CM</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="pt-3 sticky bottom-0 bg-white/80 backdrop-blur-xl -mx-4 sm:mx-0 px-6 sm:px-0 py-3 border-t border-black/5 z-20 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-none flex justify-center sm:justify-start">
                        <Button 
                          size="lg"
                          className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all font-black uppercase tracking-widest text-[11px] sm:text-xs w-full sm:w-auto h-10 px-8 active:scale-[0.98] rounded-xl"
                          disabled={Object.keys(localSettings).filter(k => k.startsWith('safety_')).length === 0}
                          onClick={() => {
                            const safetyUpdates: Record<string, string> = {};
                            Object.keys(localSettings).forEach(key => {
                              if (key.startsWith('safety_')) {
                                safetyUpdates[key] = localSettings[key];
                              }
                            });
                            handleUpdateSettings(safetyUpdates);
                          }}
                        >
                          Save Safety Settings
                        </Button>
                      </div>
                    </fieldset>
                  );
                }
                else if (activeTab === 'event_template') { return (
                    <fieldset disabled={!canEdit('settings')} className="space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-full overflow-hidden">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-8 items-start">
                        {/* Left Column: Profile & Global Settings */}
                        <div className="space-y-4 sm:space-y-6">
                          {/* Event Profiles Section */}
                          <div className="space-y-3 bg-white p-1.5 sm:p-5 rounded-none sm:rounded-xl border border-black/5 shadow-xl shadow-slate-200/50">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                                    <Layout className="w-5 h-5 text-primary" />
                                  </div>
                                  <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Event Profiles</h3>
                                </div>
                                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-2">Manage event configuration profiles</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Select 
                                  value={selectedProfileId || "new"} 
                                  onValueChange={(val) => {
                                    if (val === "new") {
                                      setSelectedProfileId(null);
                                      setCurrentProfileName("");
                                      
                                      // Clear all event-related local settings
                                      setLocalSettings(prev => {
                                        const next = { ...prev };
                                        const keys = ['default_start_time', 'default_end_time', 'event_description', 'event_hero_image', 'event_registration_template', 'event_time_slots', 'event_schedule', 'event_title', 'event_location', 'event_price', 'event_promotion_price'];
                                        keys.forEach(k => delete next[k]);
                                        return next;
                                      });
                                    } else {
                                      setSelectedProfileId(val);
                                      const profile = eventProfiles.find(p => p.id === val);
                                      if (profile) {
                                        setCurrentProfileName(profile.name);
                                        
                                        // Clear existing event settings first to ensure we only have the new profile's data
                                        setLocalSettings(prev => {
                                          const next = { ...prev };
                                          const keys = ['default_start_time', 'default_end_time', 'event_description', 'event_hero_image', 'event_registration_template', 'event_time_slots', 'event_schedule', 'event_title', 'event_location', 'event_price', 'event_promotion_price'];
                                          keys.forEach(k => delete next[k]);
                                          
                                          // Then apply new profile's data
                                          Object.keys(profile).forEach(k => {
                                            if (k.startsWith('event_') || k.startsWith('default_')) {
                                              next[k] = profile[k];
                                            }
                                          });
                                          return next;
                                        });
                                      }
                                    }
                                  }}
                                >
                                  <SelectTrigger className={`w-full sm:w-[180px] h-9 text-[11px] sm:text-xs font-black uppercase tracking-widest border-none transition-all duration-300 ${!selectedProfileId ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90' : 'bg-slate-100 text-slate-900 border-black/10'}`}>
                                    <SelectValue placeholder="Select Profile" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="new" className="font-bold">+ Create New Profile</SelectItem>
                                    {eventProfiles.map(p => (
                                      <SelectItem key={p.id} value={p.id} className="font-medium">{p.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1.5 pt-2 border-t border-black/5 mb-4">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Profile Name</label>
                                <div className="flex items-center gap-2">
                                  <Input 
                                    value={currentProfileName} 
                                    onChange={(e) => setCurrentProfileName(e.target.value)} 
                                    className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner flex-grow" 
                                    placeholder="Enter a name for this profile (e.g. Weekend Standard)"
                                  />
                                  {selectedProfileId && (
                                    <Button 
                                      variant="destructive" 
                                      size="icon" 
                                      className="h-10 w-10 rounded-xl shadow-sm shrink-0"
                                      onClick={async () => {
                                        if (!confirm("Delete this profile?")) return;
                                        const { error } = await supabase.from('event_profiles').delete().eq('id', selectedProfileId);
                                        if (error) toast.error("Failed to delete profile");
                                        else {
                                          toast.success("Profile deleted");
                                          setEventProfiles(prev => prev.filter(p => p.id !== selectedProfileId));
                                          setSelectedProfileId(null);
                                          setCurrentProfileName("");
                                          fetchAllData();
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Start Time</label>
                                <Input 
                                  type="time"
                                  value={localSettings.default_start_time ?? (selectedProfileId ? settings.default_start_time : '') ?? ''} 
                                  onChange={(e) => handleLocalSettingChange('default_start_time', e.target.value)} 
                                  onClick={(e) => (e.currentTarget as any).showPicker()}
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">End Time</label>
                                <Input 
                                  type="time"
                                  value={localSettings.default_end_time ?? (selectedProfileId ? settings.default_end_time : '') ?? ''} 
                                  onChange={(e) => handleLocalSettingChange('default_end_time', e.target.value)} 
                                  onClick={(e) => (e.currentTarget as any).showPicker()}
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Description</label>
                              <Textarea 
                                value={localSettings.event_description ?? (selectedProfileId ? settings.event_description : '') ?? ''} 
                                onChange={(e) => handleLocalSettingChange('event_description', e.target.value)} 
                                className="border-black/10 min-h-[100px] rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold p-4 shadow-inner" 
                                placeholder="Describe the event..."
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 px-1">
                                <div className="w-1 h-3 bg-primary rounded-full shadow-sm" />
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-700">Hero Image</label>
                              </div>
                              <div className="rounded-xl border border-black/5 overflow-hidden bg-slate-50/30 p-1 shadow-inner">
                                <ImageUploader 
                                  currentImageUrl={localSettings.event_hero_image ?? (selectedProfileId ? settings.event_hero_image : '')} 
                                  onImageUploaded={(url) => handleLocalSettingChange('event_hero_image', url)}
                                  bucketName="media"
                                  folderPath="event-settings"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Global Event Defaults Section */}
                          <div className="space-y-4 bg-white p-1.5 sm:p-5 rounded-none sm:rounded-xl border border-black/5 shadow-xl shadow-slate-200/50">
                            <div className="space-y-1 mb-4">
                              <div className="flex items-center gap-2">
                                <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                                  <Globe className="w-5 h-5 text-primary" />
                                </div>
                                <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Global Event Defaults</h3>
                              </div>
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-2">Configure default settings for the main event page</p>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Event Title</label>
                                <Input 
                                  value={localSettings.event_title ?? settings.event_title ?? ''} 
                                  onChange={(e) => handleLocalSettingChange('event_title', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                                  placeholder="e.g. One Day Mission"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Location</label>
                                <Input 
                                  value={localSettings.event_location ?? settings.event_location ?? ''} 
                                  onChange={(e) => handleLocalSettingChange('event_location', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                                  placeholder="e.g. Kuala Lumpur"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Event Date</label>
                                <Input 
                                  type="date"
                                  value={localSettings.event_date ?? settings.event_date ?? ''} 
                                  onChange={(e) => handleLocalSettingChange('event_date', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Event Time</label>
                                <Input 
                                  type="time"
                                  value={localSettings.event_time ?? settings.event_time ?? ''} 
                                  onChange={(e) => handleLocalSettingChange('event_time', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Base Price (MYR)</label>
                                <Input 
                                  type="number"
                                  value={localSettings.event_price ?? settings.event_price ?? ''} 
                                  onChange={(e) => handleLocalSettingChange('event_price', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Promo Price (MYR)</label>
                                <Input 
                                  type="number"
                                  value={localSettings.event_promotion_price ?? settings.event_promotion_price ?? ''} 
                                  onChange={(e) => handleLocalSettingChange('event_promotion_price', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                                  placeholder="0.00 (Optional)"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Builders */}
                        <div className="space-y-4 sm:space-y-6">
                          {/* Registration Form Builder */}
                          <div className="space-y-3 bg-white p-1.5 sm:p-5 rounded-none sm:rounded-xl border border-black/5 shadow-xl shadow-slate-200/50">
                            <div className="space-y-0.5 mb-1">
                              <div className="flex items-center gap-2">
                                <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                                  <ClipboardList className="w-5 h-5 text-primary" />
                                </div>
                                <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Registration Form</h3>
                              </div>
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-2">Configure attendee registration fields</p>
                            </div>
                            <div className="overflow-x-auto -mx-1 px-1 custom-scrollbar">
                              <div className="min-w-[600px] md:min-w-full pb-3">
                                <EventTemplateBuilder 
                                  initialData={localSettings.event_registration_template ?? ''} 
                                  onSave={(data) => handleLocalSettingChange('event_registration_template', data)} 
                                  basePrice={Number(localSettings.event_price ?? settings.event_price ?? 0)}
                                  promoPrice={Number(localSettings.event_promotion_price ?? settings.event_promotion_price ?? 0)}
                                />
                              </div>
                            </div>
                            <div className="md:hidden flex items-center justify-center gap-2 text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 bg-slate-50 py-2 rounded-xl border border-black/5">
                              <ArrowRightLeft className="w-3 h-3" />
                              Swipe to build form
                            </div>
                          </div>

                          {/* Event Schedule Builder */}
                          <div className="space-y-4 bg-white p-0 sm:p-5 rounded-none sm:rounded-xl border border-black/5 shadow-xl shadow-slate-200/50">
                            <div className="space-y-1 mb-1 p-1.5 sm:p-0">
                              <div className="flex items-center gap-2">
                                <div className="bg-primary/5 w-9 h-9 rounded-xl border border-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                                  <img src={eventHero} className="w-full h-full object-cover" alt="" />
                                </div>
                                <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Event Schedule</h3>
                              </div>
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-2">Edit the daily event timeline</p>
                            </div>
                            <div className="overflow-x-auto -mx-1 px-1 custom-scrollbar">
                              <div className="w-full pb-4">
                                <ScheduleBuilder 
                                initialData={localSettings.event_schedule ?? ''} 
                                onSave={(data) => handleLocalSettingChange('event_schedule', data)} 
                              />
                              </div>
                            </div>
                            <div className="md:hidden flex items-center justify-center gap-2 text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 bg-slate-50 py-2 rounded-xl border border-black/5 mx-1.5 mb-1.5">
                              <ArrowRightLeft className="w-3 h-3" />
                              Swipe to edit schedule
                            </div>
                          </div>

                          {/* Time Slots Builder */}
                          <div className="space-y-3 bg-white p-0 sm:p-5 rounded-none sm:rounded-xl border border-black/5 shadow-xl shadow-slate-200/50">
                            <div className="space-y-0.5 mb-1 p-1.5 sm:p-0">
                              <div className="flex items-center gap-2">
                                <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                                  <Clock className="w-5 h-5 text-primary" />
                                </div>
                                <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Time Slots</h3>
                              </div>
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-2">Manage available booking slots</p>
                            </div>
                            <div className="overflow-x-auto -mx-1 px-1 custom-scrollbar">
                              <div className="w-full pb-4">
                                <TimeSlotBuilder 
                                  initialData={localSettings.event_time_slots ?? ''} 
                                  onSave={(data) => handleLocalSettingChange('event_time_slots', data)} 
                                />
                              </div>
                            </div>
                            <div className="md:hidden flex items-center justify-center gap-2 text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 bg-slate-50 py-2 rounded-xl border border-black/5 mx-1.5 mb-1.5">
                              <ArrowRightLeft className="w-3 h-3" />
                              Swipe to manage slots
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sticky Save Bar */}
                      <div className="pt-2 sm:pt-4 sticky bottom-0 bg-white/80 backdrop-blur-md -mx-1 sm:-mx-4 px-2 sm:px-6 py-2 sm:py-4 border-t border-black/5 z-10 sm:static sm:bg-transparent sm:backdrop-blur-none sm:px-1 sm:border-none flex flex-col sm:flex-row gap-3 justify-center sm:justify-start">
                        <Button 
                          size="lg"
                          className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all font-black uppercase tracking-widest text-[11px] sm:text-xs w-full sm:w-auto h-12 px-8 active:scale-[0.98] rounded-xl"
                          onClick={async () => {
                            if (!currentProfileName) {
                              toast.error("Please enter a profile name");
                              return;
                            }

                            // 1. Update Global Settings
                            const eventUpdates: Record<string, string> = {};
                            const keys = [
                              'event_title', 'event_location', 'event_date', 'event_time', 
                              'event_price', 'event_promotion_price', 'event_description', 
                              'event_hero_image', 'event_registration_template', 'event_time_slots', 
                              'event_schedule', 'default_start_time', 'default_end_time'
                            ];
                            keys.forEach(k => {
                              if (localSettings[k] !== undefined) {
                                eventUpdates[k] = localSettings[k];
                              }
                            });
                            
                            // Prepare profile payload
                            const payload = {
                                name: currentProfileName,
                                event_title: localSettings.event_title ?? (selectedProfileId ? settings.event_title : ''),
                                event_location: localSettings.event_location ?? (selectedProfileId ? settings.event_location : ''),
                                event_price: localSettings.event_price ?? (selectedProfileId ? settings.event_price : ''),
                                event_promotion_price: localSettings.event_promotion_price ?? (selectedProfileId ? settings.event_promotion_price : ''),
                                default_start_time: localSettings.default_start_time ?? (selectedProfileId ? settings.default_start_time : ''),
                                default_end_time: localSettings.default_end_time ?? (selectedProfileId ? settings.default_end_time : ''),
                                event_description: localSettings.event_description ?? (selectedProfileId ? settings.event_description : ''),
                                event_hero_image: localSettings.event_hero_image ?? (selectedProfileId ? settings.event_hero_image : ''),
                                event_registration_template: localSettings.event_registration_template ?? (selectedProfileId ? settings.event_registration_template : ''),
                                event_time_slots: localSettings.event_time_slots ?? (selectedProfileId ? settings.event_time_slots : ''),
                                event_schedule: localSettings.event_schedule ?? (selectedProfileId ? settings.event_schedule : ''),
                            };

                            // Save everything
                            try {
                              // Update global settings first
                              await handleUpdateSettings(eventUpdates);

                              // Then update/create profile
                              if (selectedProfileId) {
                                  const { error } = await supabase.from('event_profiles').update(payload).eq('id', selectedProfileId);
                                  if (error) toast.error("Failed to update profile: " + error.message);
                                  else {
                                    toast.success("Event profile updated");
                                    fetchAllData();
                                  }
                              } else {
                                  const { data: { user } } = await supabase.auth.getUser();
                                  let creatorId = null;
                                  if (user) {
                                      const { data: adminUser } = await supabase.from('admin_users').select('id').eq('id', user.id).maybeSingle();
                                      if (adminUser) creatorId = adminUser.id;
                                  }
                                  
                                  const { error } = await supabase.from('event_profiles').insert({ ...payload, created_by: creatorId });
                                  if (error) {
                                       if (error.code === '23505') toast.error("Profile name already exists");
                                       else toast.error("Failed to create profile: " + error.message);
                                  } else {
                                       toast.success("Event profile created");
                                       fetchAllData();
                                  }
                              }
                            } catch (err) {
                              toast.error("An unexpected error occurred");
                              console.error(err);
                            }
                          }}
                        >
                          Save Event Profile
                        </Button>
                      </div>
                    </fieldset>
                  );
                }
                else if (activeTab === 'payments') { return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-black/5 shadow-xl shadow-slate-200/50">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                              <QrCode className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">QR Code Payment</h3>
                          </div>
                          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-4">Enable manual bank transfer via QR code at checkout</p>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-black/5 self-stretch sm:self-center justify-between sm:justify-start">
                          <label htmlFor="qr-enable" className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-700 cursor-pointer">Enable Payment Method</label>
                          <Checkbox 
                            id="qr-enable"
                            checked={(localSettings.payment_qr_enabled ?? settings.payment_qr_enabled) === 'true'}
                            onCheckedChange={(checked) => handleLocalSettingChange('payment_qr_enabled', checked ? 'true' : 'false')}
                            className="w-8 h-8 rounded-lg border-black data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4 bg-white/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-black/5 shadow-xl shadow-slate-200/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Bank Account Name</label>
                              <Input 
                                placeholder="e.g. COMPANY NAME SDN BHD"
                                value={localSettings.payment_account_name ?? settings.payment_account_name ?? ''}
                                onChange={(e) => handleLocalSettingChange('payment_account_name', e.target.value)}
                                className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Account Number</label>
                              <Input 
                                placeholder="e.g. 1234567890"
                                value={localSettings.payment_account_number ?? settings.payment_account_number ?? ''}
                                onChange={(e) => handleLocalSettingChange('payment_account_number', e.target.value)}
                                className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Bank Name</label>
                              <Input 
                                placeholder="e.g. Maybank"
                                value={localSettings.payment_bank_name ?? settings.payment_bank_name ?? ''}
                                onChange={(e) => handleLocalSettingChange('payment_bank_name', e.target.value)}
                                className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner"
                              />
                            </div>
                          </div>
                        </div>

                          <div className="space-y-4 bg-white/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-black/5 shadow-xl shadow-slate-200/50 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                            <div className="space-y-2">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Payment QR Code</label>
                              <div className="flex flex-col gap-4">
                                {(localSettings.payment_qr_code_url ?? settings.payment_qr_code_url) ? (
                                  <div className="relative w-full max-w-[200px] aspect-square border-2 border-dashed border-black/5 rounded-2xl overflow-hidden bg-slate-50/50 flex items-center justify-center p-4 group mx-auto lg:mx-0 shadow-inner">
                                    <img src={localSettings.payment_qr_code_url ?? settings.payment_qr_code_url} alt="QR Code" className="w-full h-full object-contain drop-shadow-xl transition-transform duration-500 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[3px]">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-10 px-6 font-black uppercase tracking-widest text-[11px] sm:text-xs shadow-2xl rounded-xl active:scale-95 transition-all"
                                        onClick={() => handleLocalSettingChange('payment_qr_code_url', '')}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" /> Remove
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-full max-w-[200px] aspect-square border-2 border-dashed border-black/5 rounded-2xl bg-slate-50/30 flex flex-col items-center justify-center p-4 text-center mx-auto lg:mx-0 shadow-inner group transition-colors hover:border-primary/20">
                                    <div className="bg-white p-4 rounded-full shadow-sm border border-black/5 mb-2 group-hover:scale-110 transition-transform duration-500">
                                      <QrCode className="w-10 h-10 text-slate-900" />
                                    </div>
                                    <p className="text-[11px] sm:text-xs text-slate-900 font-black uppercase tracking-widest">No QR code</p>
                                  </div>
                                )}
                                <div className="space-y-2">
                                  <div className="relative group">
                                    <Input 
                                      type="file" 
                                      accept="image/*"
                                      className="border-black/10 h-10 text-[11px] sm:text-xs file:bg-slate-900 file:text-white file:border-0 file:px-4 file:py-1 file:h-8 file:rounded-lg file:text-[11px] sm:text-xs file:font-black file:uppercase file:tracking-widest file:mr-3 file:cursor-pointer hover:file:bg-black file:transition-all rounded-xl bg-white shadow-sm cursor-pointer"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      
                                      if (file.size > 1 * 1024 * 1024) {
                                        toast.error("File is too large. Max 1MB allowed.");
                                        e.target.value = ''; // Reset input
                                        return;
                                      }

                                      try {
                                        const compressedFile = await compressFile(file);
                                        const fileExt = compressedFile.name.split('.').pop();
                                        const fileName = `qr-codes/${Math.random()}.${fileExt}`;
                                        const { error: uploadError } = await supabase.storage
                                          .from(bucketName)
                                          .upload(fileName, compressedFile);

                                        if (uploadError) throw uploadError;

                                        const { data: { publicUrl } } = supabase.storage
                                          .from(bucketName)
                                          .getPublicUrl(fileName);

                                        handleLocalSettingChange('payment_qr_code_url', publicUrl);
                                        toast.success("QR Code uploaded successfully");
                                      } catch (error: any) {
                                        toast.error("Upload failed: " + error.message);
                                      }
                                    }}
                                  />
                                </div>
                                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1 italic flex items-center gap-2">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  JPG, PNG, WEBP • MAX 1MB
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 bg-white/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-black/5 shadow-xl shadow-slate-200/50 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                                <BellRing className="w-5 h-5 text-white" />
                              </div>
                              <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Success Actions</h3>
                            </div>
                            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-4">Configure post-payment notifications and documents</p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">


                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                            <div className={cn(
                              "space-y-6 p-8 rounded-[2.5rem] border transition-all shadow-sm hover:shadow-md",
                              (localSettings.payment_success_email_enabled ?? settings.payment_success_email_enabled) === 'true' 
                              ? "bg-blue-50/30 border-blue-100 ring-2 ring-blue-600/5" 
                              : "bg-slate-50/30 border-black/5"
                            )}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "p-3 rounded-2xl transition-all shadow-lg",
                                    (localSettings.payment_success_email_enabled ?? settings.payment_success_email_enabled) === 'true' 
                                    ? "bg-blue-600 text-white shadow-blue-200" 
                                    : "bg-white text-slate-900 border border-black/5"
                                  )}>
                                    <Mail className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <label htmlFor="email-enabled" className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 cursor-pointer">Email Notifications</label>
                                    <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Send receipt via email</p>
                                  </div>
                                </div>
                                <Checkbox 
                                  id="email-enabled"
                                  checked={(localSettings.payment_success_email_enabled ?? settings.payment_success_email_enabled) === 'true'}
                                  onCheckedChange={(checked) => handleLocalSettingChange('payment_success_email_enabled', checked ? 'true' : 'false')}
                                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border-black data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 shadow-sm"
                                />
                              </div>

                              {((localSettings.payment_success_email_enabled ?? settings.payment_success_email_enabled) === 'true') && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                  <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Email Template</label>
                                  <Select
                                    value={localSettings.payment_success_email_template ?? settings.payment_success_email_template ?? 'none'}
                                    onValueChange={(value) => handleLocalSettingChange('payment_success_email_template', value)}
                                  >
                                    <SelectTrigger className="w-full h-16 border-black/10 bg-white rounded-[2.5rem] font-black uppercase tracking-widest text-[11px] sm:text-xs shadow-sm focus:ring-blue-600">
                                      <SelectValue placeholder="Select Template" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-black/10 shadow-2xl">
                                      <SelectItem value="none" className="text-[11px] sm:text-xs font-black uppercase tracking-widest py-4 text-slate-900">Do not send email</SelectItem>
                                      {emailTemplates.map((template) => (
                                        <SelectItem key={template.id} value={template.id} className="text-[11px] sm:text-xs font-black uppercase tracking-widest py-4 text-slate-900">
                                          {template.template_name || template.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>

                            <div className={cn(
                              "space-y-6 p-8 rounded-[2.5rem] border transition-all shadow-sm hover:shadow-md",
                              (localSettings.payment_success_whatsapp_enabled ?? settings.payment_success_whatsapp_enabled) === 'enabled' 
                              ? "bg-green-50/30 border-green-100 ring-2 ring-green-600/5" 
                              : "bg-slate-50/30 border-black/5"
                            )}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "p-3 rounded-2xl transition-all shadow-lg",
                                    (localSettings.payment_success_whatsapp_enabled ?? settings.payment_success_whatsapp_enabled) === 'enabled' 
                                    ? "bg-green-600 text-white shadow-green-200" 
                                    : "bg-white text-slate-900 border border-black/5"
                                  )}>
                                    <MessageSquare className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <label htmlFor="whatsapp-enabled" className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 cursor-pointer">WhatsApp Alerts</label>
                                    <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Send confirmation via WA</p>
                                  </div>
                                </div>
                                <Checkbox 
                                  id="whatsapp-enabled"
                                  checked={(localSettings.payment_success_whatsapp_enabled ?? settings.payment_success_whatsapp_enabled) === 'enabled'}
                                  onCheckedChange={(checked) => handleLocalSettingChange('payment_success_whatsapp_enabled', checked ? 'enabled' : 'none')}
                                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border-black data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 shadow-sm"
                                />
                              </div>
                              <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed italic font-black uppercase tracking-widest ml-1 opacity-60 text-slate-900">
                                Message content is configured in the <span className="text-green-600">WhatsApp Config</span> tab.
                              </p>
                            </div>

                            <div className="space-y-6 p-8 rounded-[2.5rem] border border-black/5 bg-slate-50/30 transition-all shadow-sm hover:shadow-md sm:col-span-2">
                              <div className="flex items-center gap-3 mb-1">
                                <div className="bg-primary/5 p-3 rounded-2xl border border-primary/10 shadow-lg shadow-primary/10/50">
                                  <FileText className="w-6 h-6 text-primary" />
                                </div>
                                <div className="space-y-0.5">
                                  <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight leading-tight">Generated Documents</h3>
                                  <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Select documents to generate on success</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                                {DOCUMENT_TYPES.map((type) => {
                                  const isChecked = (() => {
                                    const rawValue = localSettings.payment_success_document_type ?? settings.payment_success_document_type;
                                    if (!rawValue || rawValue === 'none') return false;
                                    try {
                                      if (rawValue.startsWith('[')) {
                                        const parsed = JSON.parse(rawValue);
                                        return Array.isArray(parsed) && parsed.includes(type.value);
                                      }
                                      return rawValue === type.value;
                                    } catch (e) {
                                      return false;
                                    }
                                  })();

                                  return (
                                    <div key={type.value} className="flex items-center space-x-3 p-3 rounded-xl border border-black/5 bg-white/50 hover:bg-white transition-colors">
                                      <Checkbox 
                                        id={`doc-type-${type.value}`}
                                        checked={isChecked}
                                        onCheckedChange={(checked) => {
                                          const rawValue = localSettings.payment_success_document_type ?? settings.payment_success_document_type;
                                          let currentTypes: string[] = [];
                                          try {
                                            if (rawValue && rawValue !== 'none') {
                                              if (rawValue.startsWith('[')) {
                                                currentTypes = JSON.parse(rawValue);
                                              } else {
                                                currentTypes = [rawValue];
                                              }
                                            }
                                          } catch (e) {
                                            currentTypes = [];
                                          }

                                          let nextTypes: string[];
                                          if (checked) {
                                            nextTypes = Array.from(new Set([...currentTypes, type.value]));
                                          } else {
                                            nextTypes = currentTypes.filter(t => t !== type.value);
                                          }

                                          const nextValue = nextTypes.length === 0 ? 'none' : JSON.stringify(nextTypes);
                                          handleLocalSettingChange('payment_success_document_type', nextValue);
                                        }}
                                        className="w-5 h-5 rounded border-black/20"
                                      />
                                      <label htmlFor={`doc-type-${type.value}`} className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-900 cursor-pointer flex-1 truncate">
                                        {type.label}
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-6 p-8 rounded-[2.5rem] border border-black/5 bg-slate-50/30 transition-all shadow-sm hover:shadow-md">
                              <div className="flex items-center gap-3 mb-1">
                                <div className="bg-primary/5 p-3 rounded-2xl border border-primary/10 shadow-lg shadow-primary/10/50">
                                  <Banknote className="w-6 h-6 text-primary" />
                                </div>
                                <div className="space-y-0.5">
                                  <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight leading-tight">Deposit Settings</h3>
                                  <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Configure partial payment options</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-4 pt-2">
                                <div className="space-y-1.5">
                                  <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Deposit Amount (MYR)</label>
                                  <div className="relative group/input">
                                    <Input 
                                      type="number"
                                      value={localSettings.payment_deposit_amount ?? settings.payment_deposit_amount ?? '0'} 
                                      onChange={(e) => handleLocalSettingChange('payment_deposit_amount', e.target.value)} 
                                      className="border-black/10 h-12 rounded-2xl bg-white focus:bg-white transition-all text-sm font-bold px-4 shadow-sm focus:ring-2 focus:ring-primary/80/20" 
                                      placeholder="e.g. 50"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">MYR</span>
                                  </div>
                                  <p className="text-[10px] text-slate-900 font-medium ml-1 italic">Set to 0 to disable deposit option.</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 bg-white/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-black/5 shadow-xl shadow-slate-200/50 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="bg-slate-900 p-2 rounded-xl shadow-lg shadow-slate-200">
                                  <BellRing className="w-5 h-5 text-white" />
                                </div>
                                <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Notification Tests</h3>
                              </div>
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-4">Send booking notifications without changing payment settings</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2 space-y-2">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Select Booking</label>
                              <Select value={testBookingId} onValueChange={setTestBookingId}>
                                <SelectTrigger className="border-black/10 h-11 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner">
                                  <SelectValue placeholder="Select a booking" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-black/10 shadow-2xl backdrop-blur-xl bg-white/95 max-h-[300px]">
                                  {testBookings.length === 0 && !testBookingId && (
                                    <div className="p-4 text-center text-[11px] uppercase tracking-widest font-black text-slate-400">
                                      No bookings found
                                    </div>
                                  )}
                                  {testBookingId && !testBookings.some(b => b.booking_id === testBookingId) && (
                                    <SelectItem 
                                      value={testBookingId}
                                      className="font-black text-[11px] sm:text-xs uppercase tracking-widest py-2 rounded-lg text-primary"
                                    >
                                      {testBookingId} (Selected)
                                    </SelectItem>
                                  )}

                                  {testBookings.map(booking => (
                                    <SelectItem 
                                      key={booking.booking_id} 
                                      value={booking.booking_id}
                                      className="font-black text-[11px] sm:text-xs uppercase tracking-widest py-2 rounded-lg"
                                    >
                                      {booking.booking_reference} - {booking.customer?.name || 'Guest'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-900/60 leading-relaxed">
                                Use selected booking from the table or filter below to find one
                              </div>
                            </div>
                          </div>



                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <Button
                              size="sm"
                              className="bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs h-11 px-4 shadow-lg rounded-xl"
                              onClick={handleTestPendingNotification}
                              disabled={isTestingNotifications}
                            >
                              Test Pending
                            </Button>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs h-11 px-4 shadow-lg rounded-xl"
                              onClick={() => handleTestApprovalNotification('vercel')}
                              disabled={isTestingNotifications}
                            >
                              Test Approval (Vercel)
                            </Button>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs h-11 px-4 shadow-lg rounded-xl"
                              onClick={() => handleTestApprovalNotification('flyio')}
                              disabled={isTestingNotifications}
                            >
                              Test Approval (Fly.io)
                            </Button>
                            <Button
                              size="sm"
                              className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs h-11 px-4 shadow-lg rounded-xl"
                              onClick={handleTestReminderNotification}
                              disabled={isTestingNotifications}
                            >
                              Test Reminder
                            </Button>
                          </div>
                        </div>

                        <div className="pt-8 sticky bottom-0 bg-white/90 backdrop-blur-md -mx-6 px-6 py-6 border-t border-black/5 z-10 sm:static sm:bg-transparent sm:backdrop-blur-none sm:px-0 sm:border-none">
                            <Button 
                                className="bg-slate-900 text-white hover:bg-black font-black uppercase tracking-[0.2em] text-[11px] sm:text-xs w-full sm:w-auto h-16 px-10 shadow-2xl shadow-slate-200 transition-all active:scale-[0.98] rounded-[2.5rem] gap-3"
                                disabled={Object.keys(localSettings).filter(k => k.startsWith('payment_')).length === 0}
                                onClick={() => {
                                  const paymentUpdates: Record<string, string> = {};
                                  Object.keys(localSettings).forEach(key => {
                                    if (key.startsWith('payment_')) {
                                      paymentUpdates[key] = localSettings[key];
                                    }
                                  });
                                  handleUpdateSettings(paymentUpdates);
                                }}
                            >
                                <Save className="w-5 h-5" />
                                Save Payment Settings
                            </Button>
                        </div>
                    </div>
                  </div>
                  );
                }
                else if (activeTab === 'starwars_section') { return (
                    <fieldset disabled={!canEdit('settings')} className="space-y-6 max-w-full overflow-hidden pb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="space-y-4 border-b border-black/10 pb-6 px-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-6 bg-primary rounded-full" />
                              <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Star Wars Section</h3>
                            </div>
                            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-3">Manage content for the Star Wars cinematic scroll section</p>
                          </div>
                          <Button 
                            size="sm"
                            className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs h-10 px-6 shadow-xl shadow-primary/10 transition-all active:scale-95 sm:self-center rounded-xl"
                            onClick={() => handleUpdateSettings({ 
                              starwars_title: localSettings.starwars_title,
                              starwars_text: localSettings.starwars_text,
                              starwars_title_color: localSettings.starwars_title_color,
                              starwars_text_color: localSettings.starwars_text_color,
                              starwars_title_size: localSettings.starwars_title_size,
                              starwars_text_size: localSettings.starwars_text_size,
                            })}
                          >
                            Save Star Wars Settings
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          <div className="space-y-2 lg:col-span-1">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Title</label>
                            <Input 
                              value={localSettings.starwars_title ?? settings.starwars_title ?? 'What is One Day Pilot?'} 
                              onChange={(e) => handleLocalSettingChange('starwars_title', e.target.value)} 
                              className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                            />
                          </div>

                          <div className="lg:col-span-2 space-y-4">
                            <div className="space-y-2">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Scrolling Text</label>
                              <Textarea 
                                value={localSettings.starwars_text ?? settings.starwars_text ?? 'One Day Pilot program is special design...'} 
                                onChange={(e) => handleLocalSettingChange('starwars_text', e.target.value)} 
                                className="border-black/10 min-h-[150px] rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 py-3 shadow-inner" 
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Title Color</label>
                              <div className="flex gap-2">
                                <Input 
                                  type="color"
                                  value={localSettings.starwars_title_color ?? settings.starwars_title_color ?? '#ef4444'} 
                                  onChange={(e) => handleLocalSettingChange('starwars_title_color', e.target.value)} 
                                  className="w-12 h-10 p-1 rounded-xl cursor-pointer" 
                                />
                                <Input 
                                  value={localSettings.starwars_title_color ?? settings.starwars_title_color ?? '#ef4444'} 
                                  onChange={(e) => handleLocalSettingChange('starwars_title_color', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner flex-1" 
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Text Color</label>
                              <div className="flex gap-2">
                                <Input 
                                  type="color"
                                  value={localSettings.starwars_text_color ?? settings.starwars_text_color ?? '#f1f5f9'} 
                                  onChange={(e) => handleLocalSettingChange('starwars_text_color', e.target.value)} 
                                  className="w-12 h-10 p-1 rounded-xl cursor-pointer" 
                                />
                                <Input 
                                  value={localSettings.starwars_text_color ?? settings.starwars_text_color ?? '#f1f5f9'} 
                                  onChange={(e) => handleLocalSettingChange('starwars_text_color', e.target.value)} 
                                  className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner flex-1" 
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Title Font Size</label>
                              <Select 
                                value={localSettings.starwars_title_size ?? settings.starwars_title_size ?? 'text-2xl md:text-3xl'} 
                                onValueChange={(val) => handleLocalSettingChange('starwars_title_size', val)}
                              >
                                <SelectTrigger className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner">
                                  <SelectValue placeholder="Select Title Size" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-black/10">
                                  <SelectItem value="text-xl md:text-2xl" className="text-[11px] sm:text-xs font-bold">Small</SelectItem>
                                  <SelectItem value="text-2xl md:text-3xl" className="text-[11px] sm:text-xs font-bold">Medium</SelectItem>
                                  <SelectItem value="text-3xl md:text-4xl" className="text-[11px] sm:text-xs font-bold">Large</SelectItem>
                                  <SelectItem value="text-4xl md:text-5xl" className="text-[11px] sm:text-xs font-bold">Extra Large</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Text Font Size</label>
                              <Select 
                                value={localSettings.starwars_text_size ?? settings.starwars_text_size ?? 'text-[13px] md:text-base'} 
                                onValueChange={(val) => handleLocalSettingChange('starwars_text_size', val)}
                              >
                                <SelectTrigger className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner">
                                  <SelectValue placeholder="Select Text Size" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-black/10">
                                  <SelectItem value="text-[11px] md:text-sm" className="text-[11px] sm:text-xs font-bold">Extra Small</SelectItem>
                                  <SelectItem value="text-[13px] md:text-base" className="text-[11px] sm:text-xs font-bold">Small</SelectItem>
                                  <SelectItem value="text-base md:text-lg" className="text-[11px] sm:text-xs font-bold">Medium</SelectItem>
                                  <SelectItem value="text-lg md:text-xl" className="text-[11px] sm:text-xs font-bold">Large</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </fieldset>
                ); }
                else if (activeTab === 'content') { return (
                    <fieldset disabled={!canEdit('settings')} className="space-y-6 max-w-full overflow-hidden pb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="space-y-4 border-b border-black/10 pb-6 px-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-6 bg-primary rounded-full" />
                              <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Branding & Logos</h3>
                            </div>
                            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-3">Manage your site identity and visual assets</p>
                          </div>
                          <Button 
                            size="sm"
                            className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs h-10 px-6 shadow-xl shadow-primary/10 transition-all active:scale-95 sm:self-center rounded-xl"
                            onClick={() => handleUpdateSettings({ 
                              site_title: localSettings.site_title
                            })}
                            disabled={localSettings.site_title === settings.site_title || !localSettings.site_title}
                          >
                            Save Site Branding
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          <div className="space-y-2 lg:col-span-1">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Site Title</label>
                            <Input 
                              value={localSettings.site_title ?? settings.site_title ?? 'OneDayPilot'} 
                              onChange={(e) => handleLocalSettingChange('site_title', e.target.value)} 
                              className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                              placeholder="Enter site title"
                            />
                            <p className="text-[11px] sm:text-xs text-slate-900 font-medium ml-1 italic">Shown in browser tabs and social media previews.</p>
                          </div>
                          
                          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div className="space-y-2">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Main Page Logo</label>
                              <div className="space-y-2">
                                <div className="relative aspect-[3/1] border-2 border-dashed border-black/5 rounded-2xl overflow-hidden bg-slate-50/50 flex items-center justify-center p-4 group shadow-inner">
                                  {settings.site_logo_main ? (
                                    <img src={settings.site_logo_main} alt="Main Logo" className="max-w-full max-h-full object-contain drop-shadow-md transition-transform group-hover:scale-110 duration-500" />
                                  ) : (
                                    <div className="flex flex-col items-center gap-1 text-slate-900">
                                      <ImageIcon className="w-6 h-6" />
                                      <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest">No logo</span>
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <Input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        if (file.size > 1 * 1024 * 1024) {
                                          toast.error("File is too large. Max 1MB allowed.");
                                          e.target.value = '';
                                          return;
                                        }
                                        handleSettingFileUpload('site_logo_main', file);
                                      }
                                    }}
                                    className="border-black/10 text-[11px] sm:text-xs file:bg-slate-900 file:text-white file:border-0 file:px-3 file:py-1 file:rounded-lg file:text-[11px] sm:text-xs file:font-black file:uppercase file:tracking-widest file:mr-2 file:cursor-pointer hover:file:bg-black transition-all rounded-xl h-10 flex items-center"
                                  />
                                  <p className="text-[11px] sm:text-xs text-slate-900 font-black uppercase tracking-widest italic leading-tight ml-1">Max 1MB • Best: Transparent BG, Red/White colors.</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Login Page Logo</label>
                              <div className="space-y-2">
                                <div className="relative aspect-[3/1] border-2 border-dashed border-black/5 rounded-2xl overflow-hidden bg-slate-50/50 flex items-center justify-center p-4 group shadow-inner">
                                  {settings.site_logo_login ? (
                                    <img src={settings.site_logo_login} alt="Login Logo" className="max-w-full max-h-full object-contain drop-shadow-md transition-transform group-hover:scale-110 duration-500" />
                                  ) : (
                                    <div className="flex flex-col items-center gap-1 text-slate-900">
                                      <ImageIcon className="w-6 h-6" />
                                      <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest">No logo</span>
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <Input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        if (file.size > 1 * 1024 * 1024) {
                                          toast.error("File is too large. Max 1MB allowed.");
                                          e.target.value = '';
                                          return;
                                        }
                                        handleSettingFileUpload('site_logo_login', file);
                                      }
                                    }}
                                    className="border-black/10 text-[11px] sm:text-xs file:bg-slate-900 file:text-white file:border-0 file:px-3 file:py-1 file:rounded-lg file:text-[11px] sm:text-xs file:font-black file:uppercase file:tracking-widest file:mr-2 file:cursor-pointer hover:file:bg-black transition-all rounded-xl h-10 flex items-center"
                                  />
                                  <p className="text-[11px] sm:text-xs text-slate-900 font-black uppercase tracking-widest italic leading-tight ml-1">Max 1MB • Used on admin/staff login screens.</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 border-b border-black/10 pb-6 px-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-6 bg-red-600 rounded-full" />
                              <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Promotion Assets</h3>
                            </div>
                            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-3">Manage promotional images for the site</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                          <div className="space-y-4">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Promotion Stamp (Header)</label>
                            <div className="flex flex-col md:flex-row items-center gap-6">
                              <div className="relative aspect-[1/1] w-40 h-40 border-2 border-dashed border-black/5 rounded-2xl overflow-hidden bg-slate-50/50 flex items-center justify-center p-4 group shadow-inner flex-shrink-0">
                                {settings.promotion_image_stamp ? (
                                  <img 
                                    src={settings.promotion_image_stamp} 
                                    alt="Promotion Stamp" 
                                    className="max-w-full max-h-full object-contain drop-shadow-md transition-transform group-hover:scale-110 duration-500" 
                                    style={{ filter: "url(#remove-black-bg)" }}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center gap-1 text-slate-900">
                                    <ImageIcon className="w-6 h-6" />
                                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-center">No image</span>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-3 flex-1">
                                <Input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      if (file.size > 1 * 1024 * 1024) {
                                        toast.error("File is too large. Max 1MB allowed.");
                                        e.target.value = '';
                                        return;
                                      }
                                      handleSettingFileUpload('promotion_image_stamp', file);
                                    }
                                  }}
                                  className="border-black/10 text-[11px] sm:text-xs file:bg-slate-900 file:text-white file:border-0 file:px-3 file:py-1 file:rounded-lg file:text-[11px] sm:text-xs file:font-black file:uppercase file:tracking-widest file:mr-2 file:cursor-pointer hover:file:bg-black transition-all rounded-xl h-10 flex items-center"
                                />
                                <p className="text-[11px] sm:text-xs text-slate-900 font-black uppercase tracking-widest italic leading-tight ml-1">Max 1MB • Best: Transparent BG, Red color. Shown in Header.</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Promotion Banner (Packages)</label>
                            <div className="flex flex-col md:flex-row items-center gap-6">
                              <div className="relative aspect-[1/1] w-40 h-40 border-2 border-dashed border-black/5 rounded-2xl overflow-hidden bg-slate-50/50 flex items-center justify-center p-4 group shadow-inner flex-shrink-0">
                                {settings.promotion_image_banner ? (
                                  <img 
                                    src={settings.promotion_image_banner} 
                                    alt="Promotion Banner" 
                                    className="max-w-full max-h-full object-contain drop-shadow-md transition-transform group-hover:scale-110 duration-500" 
                                    style={{ filter: "url(#remove-black-bg)" }}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center gap-1 text-slate-900">
                                    <ImageIcon className="w-6 h-6" />
                                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-center">No image</span>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-3 flex-1">
                                <Input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      if (file.size > 1 * 1024 * 1024) {
                                        toast.error("File is too large. Max 1MB allowed.");
                                        e.target.value = '';
                                        return;
                                      }
                                      handleSettingFileUpload('promotion_image_banner', file);
                                    }
                                  }}
                                  className="border-black/10 text-[11px] sm:text-xs file:bg-slate-900 file:text-white file:border-0 file:px-3 file:py-1 file:rounded-lg file:text-[11px] sm:text-xs file:font-black file:uppercase file:tracking-widest file:mr-2 file:cursor-pointer hover:file:bg-black transition-all rounded-xl h-10 flex items-center"
                                />
                                <p className="text-[11px] sm:text-xs text-slate-900 font-black uppercase tracking-widest italic leading-tight ml-1">Max 1MB • Shown on package cards during active promotions.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 border-b border-black/10 pb-6 px-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1 h-6 bg-primary rounded-full" />
                          <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">General Settings</h3>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Guideline PDF URL</label>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Input 
                              value={localSettings.guideline_pdf_url ?? settings.guideline_pdf_url ?? ''} 
                              onChange={(e) => handleLocalSettingChange('guideline_pdf_url', e.target.value)} 
                              placeholder="https://..." 
                              className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner flex-1" 
                            />
                            <div className="relative">
                              <Input
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                id="pdf-upload"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.size > 5 * 1024 * 1024) {
                                      toast.error("File is too large. Max 5MB allowed.");
                                      e.target.value = '';
                                      return;
                                    }
                                    handleSettingFileUpload('guideline_pdf_url', file);
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => document.getElementById('pdf-upload')?.click()}
                                className="w-full sm:w-auto flex gap-2 items-center h-10 px-6 border-black/10 font-black text-[11px] sm:text-xs uppercase tracking-widest text-slate-700 hover:text-primary transition-all shadow-sm rounded-xl bg-white hover:bg-slate-50 active:scale-95"
                              >
                                <Upload className="w-4 h-4" />
                                Upload PDF
                              </Button>
                            </div>
                          </div>
                          <p className="text-[11px] sm:text-xs text-slate-900 font-black uppercase tracking-widest ml-1 italic leading-tight">Max 5MB • The PDF to display in the Guideline Viewer for registered users.</p>
                        </div>
                      </div>

                      <div className="space-y-4 border-b border-black/10 pb-6 px-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1 h-6 bg-primary rounded-full" />
                          <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Contact Info</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Physical Address</label>
                            <Input 
                              value={localSettings.contact_address ?? settings.contact_address ?? ''} 
                              onChange={(e) => handleLocalSettingChange('contact_address', e.target.value)} 
                              className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                              placeholder="Enter business address"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Phone Number</label>
                            <Input 
                              value={localSettings.contact_phone ?? settings.contact_phone ?? ''} 
                              onChange={(e) => handleLocalSettingChange('contact_phone', e.target.value)} 
                              placeholder="e.g. 60123456789"
                              className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                            />
                            <p className="text-[11px] sm:text-xs text-slate-900 font-medium ml-1 italic">Include country code. Used for WhatsApp buttons.</p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">WhatsApp (Display)</label>
                            <Input 
                              value={localSettings.contact_whatsapp ?? settings.contact_whatsapp ?? ''} 
                              onChange={(e) => handleLocalSettingChange('contact_whatsapp', e.target.value)} 
                              className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                              placeholder="e.g. +60 12-345 6789"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Email Address</label>
                            <Input 
                              value={localSettings.contact_email ?? settings.contact_email ?? ''} 
                              onChange={(e) => handleLocalSettingChange('contact_email', e.target.value)} 
                              placeholder="email@example.com"
                              className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Google Maps Embed URL</label>
                          <Input 
                            value={localSettings.google_maps_link ?? settings.google_maps_link ?? ''} 
                            onChange={(e) => handleLocalSettingChange('google_maps_link', e.target.value)} 
                            className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                            placeholder="https://www.google.com/maps/embed?pb=..." 
                          />
                          <p className="text-[11px] sm:text-xs text-slate-900 font-medium ml-1 italic">Use the "Embed a map" URL from Google Maps sharing options.</p>
                        </div>
                      </div>

                      <div className="space-y-4 px-4 pb-6">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1 h-6 bg-primary rounded-full" />
                          <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Social Links</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Facebook URL</label>
                            <Input 
                              value={localSettings.social_facebook ?? settings.social_facebook ?? ''} 
                              onChange={(e) => handleLocalSettingChange('social_facebook', e.target.value)} 
                              className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                              placeholder="https://facebook.com/..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Instagram URL</label>
                            <Input 
                              value={localSettings.social_instagram ?? settings.social_instagram ?? ''} 
                              onChange={(e) => handleLocalSettingChange('social_instagram', e.target.value)} 
                              className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                              placeholder="https://instagram.com/..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">YouTube URL</label>
                            <Input 
                              value={localSettings.social_youtube ?? settings.social_youtube ?? ''} 
                              onChange={(e) => handleLocalSettingChange('social_youtube', e.target.value)} 
                              className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                              placeholder="https://youtube.com/..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">TikTok URL</label>
                            <Input 
                              value={localSettings.social_tiktok ?? settings.social_tiktok ?? ''} 
                              onChange={(e) => handleLocalSettingChange('social_tiktok', e.target.value)} 
                              className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                              placeholder="https://tiktok.com/..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Red URL (Xiaohongshu)</label>
                            <Input 
                              value={localSettings.social_red ?? settings.social_red ?? ''} 
                              onChange={(e) => handleLocalSettingChange('social_red', e.target.value)} 
                              className="border-black/10 h-10 rounded-xl bg-slate-50/50 focus:bg-white transition-all text-[11px] sm:text-xs font-bold px-4 shadow-inner" 
                              placeholder="Enter Red URL"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 sticky bottom-0 bg-white/80 backdrop-blur-md -mx-4 px-6 py-4 border-t border-black/5 z-10 sm:static sm:bg-transparent sm:backdrop-blur-none sm:px-1 sm:border-none flex justify-center sm:justify-start">
                        <Button 
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all font-black uppercase tracking-widest text-[11px] sm:text-xs w-full sm:w-auto h-12 px-8 active:scale-[0.98] rounded-xl"
                          disabled={Object.keys(localSettings).filter(k => 
                            !k.startsWith('payment_') && 
                            !k.startsWith('safety_') && 
                            !k.startsWith('event_template_')
                          ).length === 0}
                          onClick={() => {
                            const generalUpdates: Record<string, string> = {};
                            Object.keys(localSettings).forEach(key => {
                              if (!key.startsWith('payment_') && !key.startsWith('safety_') && !key.startsWith('event_template_')) {
                                generalUpdates[key] = localSettings[key];
                              }
                            });
                            handleUpdateSettings(generalUpdates);
                          }}
                        >
                          Save All General Settings
                        </Button>
                      </div>
                    </fieldset>
                  );
                }
                else if (activeTab === 'section_backgrounds' || activeTab === 'about' || activeTab === 'hero_slides' || activeTab === 'booking_wizard' || activeTab === 'features' || activeTab === 'services' || activeTab === 'videos' || activeTab === 'experiences') { return (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                      {activeTab === 'section_backgrounds' && (
                        <div className="space-y-8">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-xl shadow-slate-200/50">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <div className="bg-primary/5 p-2 rounded-xl">
                                  <Layout className="w-5 h-5 text-primary" />
                                </div>
                                <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Section Backgrounds</h3>
                              </div>
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-10">Manage gradients for main page sections</p>
                            </div>
                            <Button 
                              size="lg"
                              className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all font-black uppercase tracking-widest text-[11px] sm:text-xs h-16 px-10 active:scale-[0.98] rounded-[2.5rem] w-full sm:w-auto"
                              onClick={() => {
                                const backgroundUpdates: Record<string, string> = {};
                                bgSections.forEach(section => {
                                  const c1 = localSettings[`bg_gradient_${section.id}_color1`] ?? settings[`bg_gradient_${section.id}_color1`] ?? section.defaultC1;
                                  const c2 = localSettings[`bg_gradient_${section.id}_color2`] ?? settings[`bg_gradient_${section.id}_color2`] ?? section.defaultC2;
                                  const dir = localSettings[`bg_gradient_${section.id}_direction`] ?? settings[`bg_gradient_${section.id}_direction`] ?? 'vertical';
                                  
                                  let css = '';
                                  if (dir === 'vertical') css = `linear-gradient(to bottom, ${c1}, ${c2})`;
                                  else if (dir === 'vertical-reverse') css = `linear-gradient(to top, ${c1}, ${c2})`;
                                  else if (dir === 'horizontal') css = `linear-gradient(to right, ${c1}, ${c2})`;
                                  else if (dir === 'horizontal-reverse') css = `linear-gradient(to left, ${c1}, ${c2})`;
                                  else css = `radial-gradient(circle, ${c1}, ${c2})`;
                                  
                                  backgroundUpdates[`bg_gradient_${section.id}_color1`] = c1;
                                  backgroundUpdates[`bg_gradient_${section.id}_color2`] = c2;
                                  backgroundUpdates[`bg_gradient_${section.id}_direction`] = dir;
                                  
                                  // For backward compatibility
                                  const legacyKey = section.id === 'booking' ? 'bg_gradient_booking_wizard' : `bg_gradient_${section.id}`;
                                  backgroundUpdates[legacyKey] = css;
                                });

                                // Save the order too
                                backgroundUpdates['bg_sections_order'] = JSON.stringify(bgSections.map(s => s.id));
                                
                                handleUpdateSettings(backgroundUpdates);
                              }}
                              disabled={!Object.keys(localSettings).some(k => k.startsWith('bg_gradient_')) && bgSections.map(s => s.id).join(',') === (settings.bg_sections_order ? JSON.parse(settings.bg_sections_order).join(',') : '')}
                            >
                              Save All Backgrounds
                            </Button>
                          </div>

                          <DndContext 
                            sensors={bgSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleBgDragEnd}
                          >
                            <SortableContext 
                              items={bgSections.map(s => s.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {bgSections.map((section) => (
                                  <SortableBackgroundCard 
                                    key={section.id}
                                    section={section}
                                    localSettings={localSettings}
                                    settings={settings}
                                    handleLocalSettingChange={handleLocalSettingChange}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        </div>
                      )}


                      {activeTab === 'about' && (
                        <AboutPageEditor />
                      )}

                      {activeTab === 'hero_slides' && (
                        <div className="space-y-12">
                          <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-xl shadow-slate-200/50 space-y-8">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/5 p-2.5 rounded-2xl border border-primary/10">
                                <Layout className="w-6 h-6 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Hero Configuration</h3>
                                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Configure main call-to-action button</p>
                              </div>
                            </div>

                            <div className="space-y-4 max-w-xl">
                              <div className="space-y-3">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Book Now Button Text</label>
                                <div className="flex flex-col sm:flex-row gap-4">
                                  <Input 
                                     disabled={!canEdit('settings')}
                                     value={localSettings.hero_button_text ?? settings.hero_button_text ?? 'BOOK NOW'} 
                                     onChange={(e) => handleLocalSettingChange('hero_button_text', e.target.value)} 
                                     className="border-black/10 h-16 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-primary/80 rounded-[2.5rem] bg-white/50 focus:bg-white transition-all shadow-sm flex-1 px-8" 
                                     placeholder="e.g. BOOK NOW"
                                   />
                                   <Button 
                                      size="lg"
                                      className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all font-black uppercase tracking-widest text-[11px] sm:text-xs h-16 px-8 active:scale-[0.98] rounded-[2.5rem]"
                                      onClick={() => handleUpdateSettings({ hero_button_text: localSettings.hero_button_text })}
                                      disabled={!localSettings.hero_button_text || localSettings.hero_button_text === settings.hero_button_text}
                                   >
                                     Save Changes
                                   </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                          <ContentList
                            title="Hero Slides"
                            subtitle="Manage carousel slides"
                            icon={<Image className="w-6 h-6 text-primary" />}
                            items={heroSlides}
                            onAdd={() => handleAddItemForTab('hero_slides')}
                            onEdit={handleEditItemForTab}
                            onDelete={(id) => handleDeleteById('hero_slides', heroSlides, id)}
                            onReorder={(items) => applyReorder('hero_slides', items as HeroSlide[])}
                            renderItem={(item) => (
                              <div className="space-y-1">
                                <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight">{item.title || 'Untitled Slide'}</p>
                                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">{item.subtitle || 'No subtitle'}</p>
                              </div>
                            )}
                          />
                        </div>
                       )}
 
                      {activeTab === 'booking_wizard' && (
                        <div className="space-y-12">
                          <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-xl shadow-slate-200/50 space-y-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                              <div className="flex items-center gap-3">
                                <div className="bg-primary/5 p-2.5 rounded-2xl border border-primary/10">
                                  <Star className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                  <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Booking Wizard</h3>
                                  <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Configure booking experience header</p>
                                </div>
                              </div>
                              <Button 
                                 size="lg"
                                 className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all font-black uppercase tracking-widest text-[11px] sm:text-xs h-16 px-10 active:scale-[0.98] rounded-[2.5rem] w-full sm:w-auto"
                                 onClick={() => handleUpdateSettings({ 
                                   booking_title: localSettings.booking_title 
                                 }, {
                                   booking_title: localStyles.booking_title
                                 })}
                                 disabled={
                                   (localSettings.booking_title === settings.booking_title || !localSettings.booking_title) &&
                                   (!localStyles.booking_title || localStyles.booking_title === settingsStyles.booking_title)
                                 }
                              >
                                Save Changes
                              </Button>
                            </div>

                            <div className="space-y-8 max-w-2xl">
                              <div className="space-y-3">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Booking Title</label>
                                <Input 
                                   value={localSettings.booking_title ?? settings.booking_title ?? 'Book Your Flight Experience'} 
                                   onChange={(e) => handleLocalSettingChange('booking_title', e.target.value)} 
                                   className="border-black/10 h-16 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-primary/80 rounded-[2.5rem] bg-white/50 focus:bg-white transition-all shadow-sm px-8" 
                                   placeholder="Enter booking title"
                                 />
                                 <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-black/5">
                                   <TextStyleEditor 
                                     label="Title Style" 
                                     style={localStyles.booking_title || settingsStyles.booking_title || {}} 
                                     onChange={(style) => handleLocalStyleChange('booking_title', style)} 
                                   />
                                 </div>
                              </div>
                            </div>
                          </div>
                        </div>
                       )}

                        {activeTab === 'features' && (
                         <div className="space-y-12">
                           <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-xl shadow-slate-200/50 space-y-8">
                             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                               <div className="flex items-center gap-3">
                                 <div className="bg-primary/5 p-2.5 rounded-2xl border border-primary/10">
                                   <ShieldCheck className="w-6 h-6 text-primary" />
                                 </div>
                                 <div>
                                   <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Features Configuration</h3>
                                   <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Manage site features and experience highlights</p>
                                 </div>
                               </div>
                               <Button 
                                 size="lg"
                                 className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all font-black uppercase tracking-widest text-[11px] sm:text-xs h-16 px-10 active:scale-[0.98] rounded-[2.5rem] w-full sm:w-auto"
                                 onClick={() => handleUpdateSettings({ 
                                   features_title: localSettings.features_title,
                                   experience_start_year: localSettings.experience_start_year
                                 }, {
                                   features_title: localStyles.features_title
                                 })}
                                 disabled={
                                   (localSettings.features_title === settings.features_title || !localSettings.features_title) &&
                                   (localSettings.experience_start_year === settings.experience_start_year) &&
                                   (!localStyles.features_title || localStyles.features_title === settingsStyles.features_title)
                                 }
                               >
                                 Save Changes
                               </Button>
                             </div>

                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl">
                               <div className="space-y-8">
                                 <div className="space-y-3">
                                   <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Features Title</label>
                                   <Input 
                                      value={localSettings.features_title ?? settings.features_title ?? 'Learn More About Our One Day Pilot Experience Program'} 
                                      onChange={(e) => handleLocalSettingChange('features_title', e.target.value)} 
                                      className="border-black/10 h-16 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-primary/80 rounded-[2.5rem] bg-white/50 focus:bg-white transition-all shadow-sm px-8" 
                                      placeholder="Enter features title"
                                    />
                                    <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-black/5">
                                      <TextStyleEditor 
                                        label="Title Style" 
                                        style={localStyles.features_title || settingsStyles.features_title || {}} 
                                        onChange={(style) => handleLocalStyleChange('features_title', style)} 
                                      />
                                    </div>
                                 </div>

                                 <div className="space-y-3">
                                    <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Starting Year of Experience</label>
                                    <div className="flex items-center gap-4">
                                      <Input 
                                         type="number"
                                         value={localSettings.experience_start_year ?? settings.experience_start_year ?? '2014'} 
                                         onChange={(e) => handleLocalSettingChange('experience_start_year', e.target.value)} 
                                         className="border-black/10 h-16 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-primary/80 rounded-[2.5rem] bg-white/50 focus:bg-white transition-all shadow-sm flex-1 px-8" 
                                         placeholder="e.g. 2014"
                                       />
                                       <div className="bg-primary/5 px-6 h-16 flex items-center justify-center rounded-[2.5rem] border border-primary/10 min-w-[140px] shadow-sm">
                                         <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary">{new Date().getFullYear() - parseInt(localSettings.experience_start_year ?? settings.experience_start_year ?? '2014')}+ Years</p>
                                       </div>
                                    </div>
                                    <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-4">System calculates years based on current year</p>
                                  </div>
                               </div>

                               <div className="space-y-8">
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                   <div className="space-y-3">
                                     <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Section Image 1 (Top-Left)</label>
                                     <div className="relative group/upload h-48 rounded-[2.5rem] border border-dashed border-black/10 bg-slate-50/50 flex flex-col items-center justify-center gap-2 overflow-hidden hover:bg-slate-50 transition-all">
                                       {settings.features_image_1 ? (
                                         <>
                                           <img src={settings.features_image_1} alt="Preview 1" className="absolute inset-0 w-full h-full object-cover" />
                                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/upload:opacity-100 transition-opacity flex items-center justify-center">
                                             <Button size="sm" variant="secondary" className="font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-xl">Replace Image</Button>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="w-6 h-6 text-slate-900" />
                                          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Click to upload</p>
                                        </>
                                      )}
                                       <Input 
                                         type="file" 
                                         accept="image/*" 
                                         onChange={(e) => {
                                           const file = e.target.files?.[0];
                                           if (file) {
                                             if (file.size > 1 * 1024 * 1024) {
                                               toast.error("File is too large. Max 1MB allowed.");
                                               e.target.value = '';
                                               return;
                                             }
                                             handleSettingFileUpload('features_image_1', file);
                                           }
                                         }}
                                         className="absolute inset-0 opacity-0 cursor-pointer"
                                       />
                                     </div>
                                     <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 ml-1 mt-1">Max 1MB</p>
                                   </div>
                                   <div className="space-y-3">
                                     <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Section Image 2 (Right-Large)</label>
                                     <div className="relative group/upload h-48 rounded-[2.5rem] border border-dashed border-black/10 bg-slate-50/50 flex flex-col items-center justify-center gap-2 overflow-hidden hover:bg-slate-50 transition-all">
                                       {settings.features_image_2 ? (
                                         <>
                                           <img src={settings.features_image_2} alt="Preview 2" className="absolute inset-0 w-full h-full object-cover" />
                                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/upload:opacity-100 transition-opacity flex items-center justify-center">
                                             <Button size="sm" variant="secondary" className="font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-xl">Replace Image</Button>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="w-6 h-6 text-slate-900" />
                                          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Click to upload</p>
                                        </>
                                      )}
                                       <Input 
                                         type="file" 
                                         accept="image/*" 
                                         onChange={(e) => {
                                           const file = e.target.files?.[0];
                                           if (file) {
                                             if (file.size > 1 * 1024 * 1024) {
                                               toast.error("File is too large. Max 1MB allowed.");
                                               e.target.value = '';
                                               return;
                                             }
                                             handleSettingFileUpload('features_image_2', file);
                                           }
                                         }}
                                         className="absolute inset-0 opacity-0 cursor-pointer"
                                       />
                                     </div>
                                     <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 ml-1 mt-1">Max 1MB</p>
                                   </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <ContentList
                            title="Features"
                            subtitle="Manage feature highlights"
                            icon={<ShieldCheck className="w-6 h-6 text-primary" />}
                            items={features}
                            onAdd={() => handleAddItemForTab('features')}
                            onEdit={handleEditItemForTab}
                            onDelete={(id) => handleDeleteById('features', features, id)}
                            onReorder={(items) => applyReorder('features', items as Feature[])}
                            renderItem={(item) => (
                              <div className="space-y-1">
                                <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight">{item.title || 'Untitled Feature'}</p>
                                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 line-clamp-1">{item.description || 'No description'}</p>
                              </div>
                            )}
                          />
                        </div>
                      )}

                      {activeTab === 'services' && (
                         <div className="space-y-12">
                           <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-xl shadow-slate-200/50 space-y-8">
                             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                               <div className="flex items-center gap-3">
                                 <div className="bg-primary/5 p-2.5 rounded-2xl border border-primary/10">
                                   <ShoppingBagIcon className="w-6 h-6 text-primary" />
                                 </div>
                                 <div>
                                   <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Services Configuration</h3>
                                   <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Configure services section headers</p>
                                 </div>
                               </div>
                               <Button 
                                  size="lg"
                                  className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all font-black uppercase tracking-widest text-xs h-16 sm:h-14 px-10 active:scale-[0.98] rounded-[2.5rem] w-full sm:w-auto"
                                  onClick={() => handleUpdateSettings({ 
                                    services_title: localSettings.services_title,
                                    services_subtitle: localSettings.services_subtitle
                                  }, {
                                    services_title: localStyles.services_title,
                                    services_subtitle: localStyles.services_subtitle
                                  })}
                                  disabled={
                                    (localSettings.services_title === settings.services_title || !localSettings.services_title) &&
                                    (localSettings.services_subtitle === settings.services_subtitle) &&
                                    (!localStyles.services_title || localStyles.services_title === settingsStyles.services_title) &&
                                    (!localStyles.services_subtitle || localStyles.services_subtitle === settingsStyles.services_subtitle)
                                  }
                               >
                                 Save Changes
                               </Button>
                             </div>

                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl">
                               <div className="space-y-8">
                                 <div className="space-y-3">
                                   <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Services Title</label>
                                   <Input 
                                      value={localSettings.services_title ?? settings.services_title ?? 'Our Services'} 
                                      onChange={(e) => handleLocalSettingChange('services_title', e.target.value)} 
                                      className="border-black/10 h-16 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-primary/80 rounded-[2.5rem] bg-white/50 focus:bg-white transition-all shadow-sm px-8" 
                                      placeholder="Enter services title"
                                    />
                                    <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-black/5">
                                      <TextStyleEditor 
                                        label="Title Style" 
                                        style={localStyles.services_title || settingsStyles.services_title || {}} 
                                        onChange={(style) => handleLocalStyleChange('services_title', style)} 
                                      />
                                    </div>
                                 </div>
                               </div>

                               <div className="space-y-8">
                                 <div className="space-y-3">
                                   <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Services Subtitle</label>
                                   <Input 
                                      value={localSettings.services_subtitle ?? settings.services_subtitle ?? ''} 
                                      onChange={(e) => handleLocalSettingChange('services_subtitle', e.target.value)} 
                                      className="border-black/10 h-16 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-primary/80 rounded-[2.5rem] bg-white/50 focus:bg-white transition-all shadow-sm px-8" 
                                      placeholder="Enter services subtitle"
                                    />
                                    <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-black/5">
                                      <TextStyleEditor 
                                        label="Subtitle Style" 
                                        style={localStyles.services_subtitle || settingsStyles.services_subtitle || {}} 
                                        onChange={(style) => handleLocalStyleChange('services_subtitle', style)} 
                                      />
                                    </div>
                                 </div>
                               </div>
                             </div>
                           </div>
                          <ContentList
                            title="Services"
                            subtitle="Manage service cards"
                            icon={<ShoppingBagIcon className="w-6 h-6 text-primary" />}
                            items={services}
                            onAdd={() => handleAddItemForTab('services')}
                            onEdit={handleEditItemForTab}
                            onDelete={(id) => handleDeleteById('services', services, id)}
                            onReorder={(items) => applyReorder('services', items as Service[])}
                            renderItem={(item) => (
                              <div className="space-y-1">
                                <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight">{item.title || 'Untitled Service'}</p>
                                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 line-clamp-1">{item.label || item.description || 'No description'}</p>
                              </div>
                            )}
                          />
                         </div>
                       )}
                      {activeTab === 'videos' && (
                        <div className="space-y-12">
                          <div className="mb-10 p-6 sm:p-8 bg-white/50 backdrop-blur-sm rounded-[2.5rem] border border-black/5 shadow-xl shadow-primary/80/5 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="flex items-center gap-4 mb-2">
                              <div className="bg-primary p-3 rounded-[1.25rem] shadow-lg shadow-primary/10">
                                <Video className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Videos Section Header</h3>
                                <p className="text-[11px] sm:text-xs text-slate-900 font-bold uppercase tracking-tighter">Customize the video section title and description</p>
                              </div>
                            </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-4">
                               <div className="space-y-2">
                                 <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Section Title</label>
                                 <Input 
                                    value={localSettings.adventure_title ?? settings.adventure_title ?? 'The Sky is Calling'} 
                                    onChange={(e) => handleLocalSettingChange('adventure_title', e.target.value)} 
                                    className="border-black/10 h-16 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-primary/80 rounded-[2.5rem] bg-white focus:bg-white transition-all shadow-sm px-8" 
                                  />
                                 <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-black/5 mt-4">
                                   <TextStyleEditor 
                                     label="Title Style" 
                                     style={localStyles.adventure_title || settingsStyles.adventure_title || {}} 
                                     onChange={(newStyle) => handleLocalStyleChange('adventure_title', newStyle)} 
                                   />
                                 </div>
                               </div>
                             </div>

                             <div className="space-y-4">
                               <div className="space-y-2">
                                 <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Section Description</label>
                                 <Textarea 
                                    value={localSettings.adventure_desc ?? settings.adventure_desc ?? ''} 
                                    onChange={(e) => handleLocalSettingChange('adventure_desc', e.target.value)} 
                                    className="border-black/10 min-h-[120px] text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-primary/80 rounded-[2.5rem] bg-white focus:bg-white transition-all shadow-sm p-8" 
                                  />
                                 <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-black/5 mt-4">
                                   <TextStyleEditor 
                                     label="Description Style" 
                                     style={localStyles.adventure_desc || settingsStyles.adventure_desc || {}} 
                                     onChange={(newStyle) => handleLocalStyleChange('adventure_desc', newStyle)} 
                                   />
                                 </div>
                               </div>
                             </div>
                           </div>

                          <div className="flex justify-end pt-2">
                              <Button 
                                 size="lg"
                                 className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all font-black uppercase tracking-widest text-xs h-16 sm:h-14 px-10 active:scale-[0.98] rounded-2xl w-full sm:w-auto"
                                 onClick={() => handleUpdateSettings({ 
                                   adventure_title: localSettings.adventure_title,
                                   adventure_desc: localSettings.adventure_desc
                                 }, {
                                   adventure_title: localStyles.adventure_title,
                                   adventure_desc: localStyles.adventure_desc
                                 })}
                                 disabled={
                                   (localSettings.adventure_title === settings.adventure_title || localSettings.adventure_title === undefined) &&
                                   (localSettings.adventure_desc === settings.adventure_desc || localSettings.adventure_desc === undefined) &&
                                   (localStyles.adventure_title === undefined) &&
                                   (localStyles.adventure_desc === undefined)
                                 }
                              >
                                Save Header Settings
                              </Button>
                           </div>
                         </div>
                        <ContentList
                          title="Videos"
                          subtitle="Manage video carousel"
                          icon={<Video className="w-6 h-6 text-primary" />}
                          items={videos}
                          onAdd={() => handleAddItemForTab('videos')}
                          onEdit={handleEditItemForTab}
                          onDelete={(id) => handleDeleteById('videos', videos, id)}
                          onReorder={(items) => applyReorder('videos', items as Video[])}
                          renderItem={(item) => (
                              <div className="space-y-1">
                                <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight">{item.title || 'Untitled Video'}</p>
                                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 line-clamp-1">{item.vimeo_url || 'No URL'}</p>
                              </div>
                            )}
                        />
                        </div>
                       )}

                      {activeTab === 'experiences' && (
                        <div className="space-y-12">
                          <div className="mb-10 p-6 sm:p-8 bg-white/50 backdrop-blur-sm rounded-[2.5rem] border border-black/5 shadow-xl shadow-primary/80/5 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="flex items-center gap-4 mb-2">
                              <div className="bg-primary p-2.5 rounded-2xl shadow-lg shadow-primary/10">
                                <Layout className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h3 className="font-black text-[11px] sm:text-xs text-slate-900 uppercase tracking-tight">Experiences Section Header</h3>
                                <p className="text-[11px] sm:text-xs text-slate-900 font-bold uppercase tracking-tighter">Customize the section title and subtitle</p>
                              </div>
                            </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-4">
                               <div className="space-y-2">
                                 <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Section Title</label>
                                 <Input 
                                    value={localSettings.experiences_title ?? settings.experiences_title ?? 'Be One Day Pilot'} 
                                    onChange={(e) => handleLocalSettingChange('experiences_title', e.target.value)} 
                                    className="border-black/10 h-16 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-primary/80 rounded-[2.5rem] bg-white focus:bg-white transition-all shadow-sm px-8" 
                                  />
                                 <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-black/5 mt-4">
                                   <TextStyleEditor 
                                     label="Title Style" 
                                     style={localStyles.experiences_title || settingsStyles.experiences_title || {}} 
                                     onChange={(newStyle) => handleLocalStyleChange('experiences_title', newStyle)} 
                                   />
                                 </div>
                               </div>
                             </div>

                             <div className="space-y-4">
                               <div className="space-y-2">
                                 <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Section Subtitle</label>
                                 <Input 
                                    value={localSettings.experiences_subtitle ?? settings.experiences_subtitle ?? 'Unique and Amazing Experience'} 
                                    onChange={(e) => handleLocalSettingChange('experiences_subtitle', e.target.value)} 
                                    className="border-black/10 h-16 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-primary/80 rounded-[2.5rem] bg-white focus:bg-white transition-all shadow-sm px-8" 
                                  />
                                 <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-black/5 mt-4">
                                   <TextStyleEditor 
                                     label="Subtitle Style" 
                                     style={localStyles.experiences_subtitle || settingsStyles.experiences_subtitle || {}} 
                                     onChange={(newStyle) => handleLocalStyleChange('experiences_subtitle', newStyle)} 
                                   />
                                 </div>
                               </div>
                             </div>
                           </div>

                          <div className="flex justify-end pt-2">
                              <Button 
                                 size="lg"
                                 className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all font-black uppercase tracking-widest text-xs h-16 sm:h-14 px-10 active:scale-[0.98] rounded-2xl w-full sm:w-auto"
                                 onClick={() => handleUpdateSettings({ 
                                   experiences_title: localSettings.experiences_title,
                                   experiences_subtitle: localSettings.experiences_subtitle
                                 }, {
                                   experiences_title: localStyles.experiences_title,
                                   experiences_subtitle: localStyles.experiences_subtitle
                                 })}
                                 disabled={
                                   (localSettings.experiences_title === settings.experiences_title || localSettings.experiences_title === undefined) &&
                                   (localSettings.experiences_subtitle === settings.experiences_subtitle || localSettings.experiences_subtitle === undefined) &&
                                   (localStyles.experiences_title === undefined) &&
                                   (localStyles.experiences_subtitle === undefined)
                                 }
                              >
                                Save Header Settings
                              </Button>
                           </div>
                        </div>
                        <ContentList
                          title="Experiences"
                          subtitle="Manage experience cards"
                          icon={<Layout className="w-6 h-6 text-primary" />}
                          items={experiences}
                          onAdd={() => handleAddItemForTab('experiences')}
                          onEdit={handleEditItemForTab}
                          onDelete={(id) => handleDeleteById('experiences', experiences, id)}
                          onReorder={(items) => applyReorder('experiences', items as Experience[])}
                          renderItem={(item) => (
                            <div className="space-y-1">
                              <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight">{item.title || 'Untitled Experience'}</p>
                              <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 line-clamp-1">{item.description || 'No description'}</p>
                            </div>
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </CardContent>
        </Card>
      </div>

       {/* Form Section */}
{activeTab !== 'settings' && activeTab !== 'content' && activeTab !== 'about' && activeTab !== 'safety' && activeTab !== 'reviews' && activeTab !== 'bookings' && activeTab !== 'analytics' && activeTab !== 'users' && activeTab !== 'registrations' && activeTab !== 'categories' && activeTab !== 'event_template' && activeTab !== 'payments' && activeTab !== 'doc_templates' && activeTab !== 'email_config' && activeTab !== 'whatsapp_config' && activeTab !== 'logs' && activeTab !== 'activity_logs' && activeTab !== 'policy_terms' && activeTab !== 'policy_privacy' && activeTab !== 'policy_refund' && activeTab !== 'hours_config' && activeTab !== 'section_backgrounds' && activeTab !== 'booking_wizard' && activeTab !== 'watermark_config' && activeTab !== 'starwars_section' && (
  <div className="lg:col-span-1">
    <Card className="lg:sticky lg:top-8 border-black/10 shadow-2xl bg-white/70 backdrop-blur-md rounded-[2.5rem] overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
      <CardHeader className="bg-primary/5 border-b border-black/5 p-8">
        <CardTitle className="text-[11px] sm:text-xs font-black uppercase tracking-tight text-slate-900">
          {editingItem?.id ? `Edit ${activeTab.replace('_', ' ')}` : (activeTab === 'categories' ? 'Category Info' : `Add New ${activeTab.replace('_', ' ')}`)}
        </CardTitle>
        <p className="text-[11px] sm:text-xs font-black text-primary uppercase tracking-[0.2em] mt-1">Manage content details and visibility</p>
      </CardHeader>
      <CardContent className="p-8">
        {editingItem ? (
          <form onSubmit={handleSaveItem} className="space-y-4">
            <fieldset disabled={!canEdit(activeTab)} className="space-y-4">
              {activeTab === 'packages' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="space-y-2">
                    <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Category</label>
                    <div className="relative group">
                      <Input
                        list="category-list"
                        className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 px-8"
                        placeholder="Select or type category..."
                        value={(() => {
                          const cat = categories.find(c => c.id === editingItem.category_id);
                          return cat ? cat.name : (editingItem.category_id || '');
                        })()}
                        onChange={(e) => {
                          const val = e.target.value;
                          const existingCat = categories.find(c => c.name === val);
                          setEditingItem({ 
                            ...editingItem, 
                            category_id: existingCat ? existingCat.id : val 
                          });
                        }}
                        required
                      />
                      <datalist id="category-list">
                        {Array.from(new Set(categories.map(c => c.name))).filter(Boolean).map(name => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-900 italic ml-4 leading-tight">Select 'Main Flight Packages' for the main pricing cards.</p>
                  </div>
                </div>
              )}

              {activeTab === 'services' && (
                <div className="space-y-2">
                  <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Label (Optional)</label>
                  <Input 
                    value={editingItem.label || ''} 
                    onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })} 
                    placeholder="New, Promo..." 
                    className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 px-8" 
                  />
                </div>
              )}
              
              {activeTab === 'categories' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Category Name</label>
                      <Input 
                        value={editingItem.name || ''} 
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} 
                        required 
                        className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 text-[11px] sm:text-xs px-8" 
                        placeholder="Enter category name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Icon Name (Lucide React)</label>
                      <Input 
                        value={editingItem.icon || ''} 
                        onChange={(e) => setEditingItem({ ...editingItem, icon: e.target.value })} 
                        placeholder="e.g. plane, car, video, gift"
                        className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 text-[11px] sm:text-xs px-8" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <div 
                      className="flex items-center p-8 rounded-[2.5rem] bg-white/50 border border-black/5 shadow-sm hover:shadow-xl hover:bg-white transition-all group cursor-pointer active:scale-[0.98]"
                      onClick={() => setEditingItem({ ...editingItem, is_active: editingItem.is_active === false })}
                    >
                      <div className="flex items-center space-x-6 w-full">
                        <div className={cn(
                          "w-16 h-16 rounded-[2.5rem] border-2 flex items-center justify-center transition-all duration-300",
                          editingItem.is_active !== false ? "bg-primary border-primary shadow-lg shadow-primary/20" : "border-slate-300 bg-white"
                        )}>
                          {editingItem.is_active !== false && <Check className="w-10 h-10 text-white stroke-[4px]" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-primary uppercase tracking-[0.2em] leading-none mb-2">Status</span>
                          <span className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">Active / Visible</span>
                        </div>
                      </div>
                    </div>

                    <div 
                      className="flex items-center p-8 rounded-[2.5rem] bg-white/50 border border-black/5 shadow-sm hover:shadow-xl hover:bg-white transition-all group cursor-pointer active:scale-[0.98]"
                      onClick={() => setEditingItem({ ...editingItem, is_main_page: !editingItem.is_main_page })}
                    >
                      <div className="flex items-center space-x-6 w-full">
                        <div className={cn(
                          "w-16 h-16 rounded-[2.5rem] border-2 flex items-center justify-center transition-all duration-300",
                          editingItem.is_main_page ? "bg-primary border-primary shadow-lg shadow-primary/20" : "border-slate-300 bg-white"
                        )}>
                          {editingItem.is_main_page && <Check className="w-10 h-10 text-white stroke-[4px]" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-primary uppercase tracking-[0.2em] leading-none mb-2">Placement</span>
                          <span className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">Show on Main Page</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Offer Percentage</label>
                        <Input 
                          value={editingItem.offer_percentage ?? ''} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setEditingItem({ ...editingItem, offer_percentage: val });
                            }
                          }} 
                          placeholder="e.g. 10"
                          className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 text-[11px] sm:text-xs px-8" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Offer Image</label>
                        <div className="rounded-2xl border border-black/5 bg-slate-50/50 p-3">
                          <ImageUploader
                            currentImageUrl={editingItem.offer_image_url || ''}
                            onImageUploaded={(url) => setEditingItem({ ...editingItem, offer_image_url: url })}
                            folderPath="offers"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Offer Start</label>
                        <Input
                          type="datetime-local"
                          value={editingItem.offer_start ? format(new Date(editingItem.offer_start), "yyyy-MM-dd'T'HH:mm") : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingItem({ 
                              ...editingItem, 
                              offer_start: val ? new Date(val).toISOString() : null 
                            });
                          }}
                          className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 text-[11px] sm:text-xs px-6"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Offer End</label>
                        <Input
                          type="datetime-local"
                          value={editingItem.offer_end ? format(new Date(editingItem.offer_end), "yyyy-MM-dd'T'HH:mm") : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingItem({ 
                              ...editingItem, 
                              offer_end: val ? new Date(val).toISOString() : null 
                            });
                          }}
                          className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 text-[11px] sm:text-xs px-6"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Duration (Hours)</label>
                        <Input
                          value={editingItem.offer_start && editingItem.offer_end 
                            ? String(Math.max(0, (new Date(editingItem.offer_end).getTime() - new Date(editingItem.offer_start).getTime()) / 3600000).toFixed(2)).replace(/\.00$/, '')
                            : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              if (val === '') {
                                setEditingItem({ ...editingItem, offer_end: null });
                                return;
                              }
                              const baseStart = editingItem.offer_start ? new Date(editingItem.offer_start) : new Date();
                              const hours = parseFloat(val);
                              const nextEnd = new Date(baseStart.getTime() + hours * 3600000);
                              setEditingItem({ 
                                ...editingItem, 
                                offer_start: editingItem.offer_start ?? baseStart.toISOString(),
                                offer_end: nextEnd.toISOString()
                              });
                            }
                          }}
                          placeholder="e.g. 48"
                          className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 text-[11px] sm:text-xs px-6"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div 
                        className="flex items-center p-8 rounded-[2.5rem] bg-white/50 border border-black/5 shadow-sm hover:shadow-xl hover:bg-white transition-all group cursor-pointer active:scale-[0.98]"
                        onClick={() => setEditingItem({ ...editingItem, offer_is_active: !editingItem.offer_is_active })}
                      >
                        <div className="flex items-center space-x-6 w-full">
                          <div className={cn(
                            "w-16 h-16 rounded-[2.5rem] border-2 flex items-center justify-center transition-all duration-300",
                            editingItem.offer_is_active ? "bg-primary border-primary shadow-lg shadow-primary/20" : "border-slate-300 bg-white"
                          )}>
                            {editingItem.offer_is_active && <Check className="w-10 h-10 text-white stroke-[4px]" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-primary uppercase tracking-[0.2em] leading-none mb-2">Offer</span>
                            <span className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">Enable Offer</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {(activeTab === 'services' || activeTab === 'hero_slides' || activeTab === 'experiences' || activeTab === 'features') && (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Title</label>
                  <Input 
                    value={editingItem.title || ''} 
                    onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })} 
                    required 
                    className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 font-bold text-[11px] sm:text-xs px-8" 
                    placeholder="Enter title"
                  />
                </div>
              )}

              {activeTab === 'videos' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="space-y-2">
                    <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Title (optional)</label>
                    <Input 
                      value={editingItem.title || ''} 
                      onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })} 
                      className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 font-bold text-[11px] sm:text-xs px-8" 
                      placeholder="Enter video title"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary ml-1">Vimeo URL</label>
                    <Input 
                      value={editingItem.vimeo_url || ''} 
                      onChange={(e) => setEditingItem({ ...editingItem, vimeo_url: e.target.value })} 
                      placeholder="https://vimeo.com/123456789" 
                      required 
                      className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 font-bold text-[11px] sm:text-xs px-8" 
                    />
                  </div>
                </div>
              )}
              
              {activeTab === 'packages' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="space-y-2">
                    <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Package Name</label>
                    <Input 
                      value={editingItem.name || ''} 
                      onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} 
                      required 
                      className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 px-8 text-[11px] sm:text-xs" 
                      placeholder="Enter package name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Package Image</label>
                    <div className="group relative">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 1 * 1024 * 1024) {
                              toast.error("File is too large. Max 1MB allowed.");
                              e.target.value = ''; // Reset input
                              return;
                            }
                            setImageFile(file);
                          } else {
                            setImageFile(null);
                          }
                        }} 
                        className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[11px] sm:text-xs file:font-black file:uppercase file:tracking-widest file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer pt-3.5 px-8" 
                      />
                    </div>
                    <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 ml-1 mt-1">
                      Max 1MB
                    </p>
                    {(editingItem.image_url || imageFile) && (
                      <div className="mt-4 relative group">
                        <div className="absolute inset-0 bg-primary/10 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <img 
                          src={imageFile ? URL.createObjectURL(imageFile) : editingItem.image_url} 
                          alt="Preview" 
                          className="w-full h-48 object-cover rounded-[2.5rem] border-2 border-white shadow-xl relative z-10" 
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Price (RM)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-900 font-bold text-[11px] sm:text-xs">RM</span>
                        <Input 
                          type="text"
                          value={editingItem.price ?? ''} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setEditingItem({ ...editingItem, price: val });
                            }
                          }} 
                          required 
                          className="h-16 pl-16 pr-8 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 font-bold text-[11px] sm:text-xs"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Promotion Price (RM)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-900 font-bold text-[11px] sm:text-xs">RM</span>
                        <Input 
                          type="text"
                          value={editingItem.promotion_price ?? ''} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setEditingItem({ ...editingItem, promotion_price: val });
                            }
                          }} 
                          className="h-16 pl-16 pr-8 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 font-bold text-[11px] sm:text-xs"
                          placeholder="0.00 (Optional)"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 mt-4 mb-4">
                    <div className="space-y-3">
                      <label className="text-[11px] sm:text-xs font-black text-primary uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Promotion Start
                      </label>
                      <Input 
                        type="datetime-local"
                        value={editingItem.promotion_start_at ? format(new Date(editingItem.promotion_start_at), "yyyy-MM-dd'T'HH:mm") : ''}
                        className="border-primary/10 bg-primary/5/30 shadow-sm h-10 rounded-xl text-[11px] sm:text-xs font-bold px-4 focus:ring-primary/80/20 focus:ring-4 transition-all"
                        onChange={e => {
                          const val = e.target.value;
                          setEditingItem({
                            ...editingItem, 
                            promotion_start_at: val ? new Date(val).toISOString() : null
                          });
                        }}
                        onClick={(e) => (e.currentTarget as any).showPicker()}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] sm:text-xs font-black text-primary uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Promotion End
                      </label>
                      <Input 
                        type="datetime-local"
                        value={editingItem.promotion_end_at ? format(new Date(editingItem.promotion_end_at), "yyyy-MM-dd'T'HH:mm") : ''}
                        className="border-primary/10 bg-primary/5/30 shadow-sm h-10 rounded-xl text-[11px] sm:text-xs font-bold px-4 focus:ring-primary/80/20 focus:ring-4 transition-all"
                        onChange={e => {
                          const val = e.target.value;
                          setEditingItem({
                            ...editingItem, 
                            promotion_end_at: val ? new Date(val).toISOString() : null
                          });
                        }}
                        onClick={(e) => (e.currentTarget as any).showPicker()}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary ml-1">Sort Order / Stage</label>
                    <Select 
                      value={(editingItem.sort_order ?? 0).toString()} 
                      onValueChange={(v) => setEditingItem({ ...editingItem, sort_order: parseInt(v) })}
                    >
                      <SelectTrigger className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 font-bold px-8 text-[11px] sm:text-xs">
                        <SelectValue placeholder="Select order" />
                      </SelectTrigger>
                      <SelectContent className="rounded-[2.5rem] border-black/10 shadow-2xl overflow-hidden">
                        <SelectItem value="0" className="rounded-xl focus:bg-primary/5 py-4 px-6 text-[11px] sm:text-xs">Stage 0: First Selection</SelectItem>
                        <SelectItem value="1" className="rounded-xl focus:bg-primary/5 py-4 px-6 text-[11px] sm:text-xs">Stage 1: Checkout Upsell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(editingItem.sort_order === 0 || editingItem.sort_order === undefined) && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Google Maps Link</label>
                      <Input 
                        value={editingItem.google_maps_link || ''} 
                        onChange={(e) => setEditingItem({ ...editingItem, google_maps_link: e.target.value })} 
                        className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 px-8 text-[11px] sm:text-xs" 
                        placeholder="https://maps.google.com/..."
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">
                      Description <span className="text-[11px] sm:text-xs opacity-100 font-normal">(Line 1: Subtitle, Rest: Features)</span>
                    </label>
                    <Textarea 
                      value={editingItem.description || ''} 
                      onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })} 
                      required 
                      className="min-h-[120px] rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 p-8 text-[11px] sm:text-xs" 
                      placeholder="Enter package features..."
                    />
                  </div>

                  <div 
                    className="flex items-center p-8 rounded-[2.5rem] bg-white/50 border border-black/5 shadow-sm hover:shadow-md transition-all group cursor-pointer active:scale-[0.98]"
                    onClick={() => setEditingItem({ ...editingItem, is_active: editingItem.is_active === false })}
                  >
                    <div className="flex items-center space-x-6 w-full">
                      <div className={cn(
                        "w-16 h-16 rounded-[2rem] border-2 flex items-center justify-center transition-all duration-300",
                        editingItem.is_active !== false ? "bg-primary border-primary shadow-lg shadow-primary/20" : "border-slate-300 bg-white"
                      )}>
                        {editingItem.is_active !== false && <Check className="w-10 h-10 text-white stroke-[3px]" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-primary uppercase tracking-[0.2em] leading-none mb-2">Status</span>
                        <span className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Active / Visible</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(activeTab === 'services' || activeTab === 'experiences' || activeTab === 'features') && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="space-y-2">
                    <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Description</label>
                    <Textarea 
                      value={editingItem.description || ''} 
                      onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })} 
                      required 
                      className="min-h-[120px] rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 p-6 text-[11px] sm:text-xs" 
                      placeholder="Enter details..."
                    />
                  </div>

                  {activeTab === 'features' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-[2.5rem] bg-primary/5/50 border border-primary/10/50 shadow-inner">
                      <div className="space-y-2">
                        <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary ml-1">Text Size</label>
                        <Select 
                          value={editingItem.text_size || 'text-lg'} 
                          onValueChange={(v) => setEditingItem({ ...editingItem, text_size: v })}
                        >
                          <SelectTrigger className="h-16 rounded-[2.5rem] border-black/5 bg-white shadow-sm px-8 text-[11px] sm:text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-black/10">
                            <SelectItem value="text-xs" className="py-4 text-[11px] sm:text-xs">Extra Small</SelectItem>
                            <SelectItem value="text-sm" className="py-4 text-[11px] sm:text-xs">Small</SelectItem>
                            <SelectItem value="text-base" className="py-4 text-[11px] sm:text-xs">Base</SelectItem>
                            <SelectItem value="text-lg" className="py-4 text-[11px] sm:text-xs">Large</SelectItem>
                            <SelectItem value="text-xl" className="py-4 text-[11px] sm:text-xs">Extra Large</SelectItem>
                            <SelectItem value="text-2xl" className="py-4 text-[11px] sm:text-xs">2XL</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary ml-1">Text Color</label>
                        <div className="flex items-center gap-3 bg-white p-2 rounded-[2.5rem] border border-black/5 shadow-sm">
                          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md ring-1 ring-black/5 shrink-0 ml-1">
                            <input 
                              type="color" 
                              value={editingItem.text_color || '#000000'} 
                              onChange={(e) => setEditingItem({ ...editingItem, text_color: e.target.value })}
                              className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer"
                            />
                          </div>
                          <Input 
                            value={editingItem.text_color || '#000000'} 
                            onChange={(e) => setEditingItem({ ...editingItem, text_color: e.target.value })}
                            className="h-12 border-none bg-transparent font-mono uppercase text-[11px] sm:text-xs px-2 focus-visible:ring-0 placeholder:text-slate-300 w-full font-bold text-slate-700"
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary ml-1">Icon Size</label>
                        <Select 
                          value={editingItem.icon_size || 'w-8 h-8'} 
                          onValueChange={(v) => setEditingItem({ ...editingItem, icon_size: v })}
                        >
                          <SelectTrigger className="h-16 rounded-[2.5rem] border-black/5 bg-white shadow-sm px-8 text-[11px] sm:text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-black/10">
                            <SelectItem value="w-4 h-4" className="py-4 text-[11px] sm:text-xs">Small (4x4)</SelectItem>
                            <SelectItem value="w-6 h-6" className="py-4 text-[11px] sm:text-xs">Medium (6x6)</SelectItem>
                            <SelectItem value="w-8 h-8" className="py-4 text-[11px] sm:text-xs">Large (8x8)</SelectItem>
                            <SelectItem value="w-10 h-10" className="py-4 text-[11px] sm:text-xs">Extra Large (10x10)</SelectItem>
                            <SelectItem value="w-12 h-12" className="py-4 text-[11px] sm:text-xs">Huge (12x12)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary ml-1">Icon Color</label>
                        <div className="flex items-center gap-3 bg-white p-2 rounded-[2.5rem] border border-black/5 shadow-sm">
                          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md ring-1 ring-black/5 shrink-0 ml-1">
                            <input 
                              type="color" 
                              value={editingItem.icon_color || '#3b82f6'} 
                              onChange={(e) => setEditingItem({ ...editingItem, icon_color: e.target.value })}
                              className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer"
                            />
                          </div>
                          <Input 
                            value={editingItem.icon_color || '#3b82f6'} 
                            onChange={(e) => setEditingItem({ ...editingItem, icon_color: e.target.value })}
                            className="h-12 border-none bg-transparent font-mono uppercase text-[11px] sm:text-xs px-2 focus-visible:ring-0 placeholder:text-slate-300 w-full font-bold text-slate-700"
                            placeholder="#3b82f6"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'hero_slides' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Subtitle</label>
                  <Input 
                    value={editingItem.subtitle || ''} 
                    onChange={(e) => setEditingItem({ ...editingItem, subtitle: e.target.value })} 
                    required 
                    className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 font-bold text-[11px] sm:text-xs px-8" 
                    placeholder="Enter subtitle"
                  />
                </div>
              )}

              {(activeTab !== 'packages' && activeTab !== 'videos') && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <div className="w-1.5 h-4 bg-primary rounded-full shadow-sm" />
                      <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-700">
                        {activeTab === 'experiences' ? 'Main Image' : 'Image Upload'}
                      </label>
                    </div>
                    <div className="group relative">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 1 * 1024 * 1024) {
                              toast.error("File is too large. Max 1MB allowed.");
                              e.target.value = ''; // Reset input
                              return;
                            }
                            setImageFile(file);
                          } else {
                            setImageFile(null);
                          }
                        }} 
                        className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[11px] sm:text-xs file:font-black file:uppercase file:tracking-widest file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer pt-3.5 px-8" 
                      />
                    </div>
                    <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 ml-1 mt-1">
                      Max 1MB
                    </p>
                    {(editingItem.image_url || imageFile) && (
                      <div className="mt-4 relative group">
                        <div className="absolute inset-0 bg-primary/10 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <img 
                          src={imageFile ? URL.createObjectURL(imageFile) : editingItem.image_url} 
                          alt="Current" 
                          className="w-full h-48 object-cover rounded-[2.5rem] border-2 border-white shadow-xl relative z-10" 
                        />
                      </div>
                    )}
                  </div>

                  {activeTab === 'experiences' && (
                    <div className="space-y-4 border-t border-black/5 pt-6">
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-1.5 h-4 bg-primary rounded-full shadow-sm" />
                        <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-700">Gallery Images (Multiple)</label>
                      </div>
                      <div className="group relative">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          multiple 
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            const validFiles = files.filter(file => {
                              if (file.size > 1 * 1024 * 1024) {
                                toast.error(`File ${file.name} is too large. Max 1MB allowed.`);
                                return false;
                              }
                              return true;
                            });
                            if (validFiles.length < files.length) {
                              e.target.value = ''; // Reset input if some files were rejected
                            }
                            setMultipleImageFiles(prev => [...prev, ...validFiles]);
                          }} 
                          className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[11px] sm:text-xs file:font-black file:uppercase file:tracking-widest file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer pt-3.5 px-8" 
                        />
                      </div>
                      <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 ml-1 mt-1">
                        Max 1MB per image
                      </p>
                      {multipleImageFiles.length > 0 && (
                        <div className="mt-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                              {multipleImageFiles.length} new files ready
                            </p>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setMultipleImageFiles([])}
                            >
                              Clear All
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {multipleImageFiles.map((file, idx) => (
                              <div key={idx} className="relative group aspect-square rounded-[2rem] overflow-hidden border-2 border-white shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
                                <img 
                                  src={URL.createObjectURL(file)} 
                                  alt="Preview" 
                                  className="w-full h-full object-cover" 
                                  onLoad={(e) => URL.revokeObjectURL((e.target as any).src)}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => setMultipleImageFiles(prev => prev.filter((_, i) => i !== idx))}
                                    className="h-14 w-14 rounded-2xl bg-white text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-xl"
                                  >
                                    <Trash2 className="w-6 h-6" />
                                  </Button>
                                </div>
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[11px] sm:text-xs font-bold text-white py-1.5 px-2 truncate backdrop-blur-md">
                                  {file.name}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {editingItem.images && editingItem.images.length > 0 && (
                        <div className="mt-4 space-y-4">
                          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Existing Gallery</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {editingItem.images.map((url: string, idx: number) => (
                              <div key={idx} className="relative group aspect-square rounded-[2rem] overflow-hidden border-2 border-white shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => {
                                      const newImages = [...(editingItem.images || [])];
                                      newImages.splice(idx, 1);
                                      setEditingItem({ ...editingItem, images: newImages });
                                    }}
                                    className="h-14 w-14 rounded-2xl bg-white text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-xl"
                                  >
                                    <Trash2 className="w-6 h-6" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'features' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Icon Name (Lucide)</label>
                  <Input 
                    value={editingItem.icon_name || ''} 
                    onChange={(e) => setEditingItem({ ...editingItem, icon_name: e.target.value })} 
                    placeholder="Heart, Plane, Shield..." 
                    className="h-16 rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/80/20 px-8" 
                  />
                </div>
              )}
            </fieldset>

            <div className="flex flex-col sm:flex-row gap-4 pt-8">
              {canEdit(activeTab) && (
                <Button 
                  type="submit" 
                  className="flex-1 h-12 sm:h-14 rounded-[2rem] sm:rounded-[2.5rem] bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all duration-300 font-black uppercase tracking-widest text-[11px] sm:text-xs active:scale-95"
                >
                  Save Changes
                </Button>
              )}
              <Button 
                type="button" 
                variant="secondary" 
                className={cn(
                  "h-12 sm:h-14 rounded-[2rem] sm:rounded-[2.5rem] border-primary/10 bg-primary/5/50 hover:bg-primary/10 text-primary transition-all font-black uppercase tracking-widest text-[11px] sm:text-xs active:scale-95 shadow-sm",
                  canEdit(activeTab) ? "flex-1 sm:flex-none sm:px-12" : "flex-1"
                )} 
                onClick={() => { 
                  setEditingItem(null); 
                  setImageFile(null); 
                  setMultipleImageFiles([]);
                }}
              >
                {canEdit(activeTab) ? "Cancel" : "Close"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-12 text-slate-900">
            {activeTab === 'categories' ? 'Select a category from the list to toggle its visibility.' : 'Select an item to edit or click Add.'}
          </div>
        )}
      </CardContent>
    </Card>
  </div>
)}
          </div>
        </Tabs>
      </div>

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-none shadow-2xl w-[95vw] sm:w-full rounded-[2rem] sm:rounded-[3rem] animate-in zoom-in-95 duration-300 bg-white/80 backdrop-blur-xl">
          <DialogHeader className="px-5 py-4 sm:px-8 sm:py-5 border-b border-black/5 sticky top-0 z-10 bg-white/50 backdrop-blur-xl flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight">Booking Details</DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary/80 bg-primary/5/50 px-3 py-1 rounded-full border border-primary/10/50 inline-block mt-1">
                {selectedBooking?.booking_reference}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedBooking(null)}
                className="rounded-xl h-10 w-10 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-900" />
              </Button>
            </div>
          </DialogHeader>
          {selectedBooking && (
            <div className="p-4 sm:p-6 pt-2 sm:pt-4">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100/50 p-1 h-11 rounded-xl border border-black/20">
                  <TabsTrigger 
                    value="overview" 
                    className="h-11 border border-black/20 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-xl active:scale-95"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="documents" 
                    className="h-11 border border-black/20 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-xl active:scale-95"
                  >
                    Documents
                  </TabsTrigger>
                </TabsList>
              
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border shadow-md">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">Customer Information</p>
                      {!isEditingBooking ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setIsEditingBooking(true)}
                          className="h-7 rounded-lg font-black uppercase tracking-widest text-[9px] border-black text-slate-900 bg-white hover:bg-slate-100 transition-all active:scale-95 px-3 shadow-none"
                        >
                          <Edit2 className="w-2.5 h-2.5 mr-1" /> Edit
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setIsEditingBooking(false)}
                            className="h-7 rounded-lg font-black uppercase tracking-widest text-[9px] text-slate-900 hover:bg-slate-100 px-3 border border-black"
                          >
                            Cancel
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={handleSaveBookingEdit}
                            className="h-7 rounded-lg font-black uppercase tracking-widest text-[9px] bg-green-600 hover:bg-green-700 text-white shadow-md px-3 active:scale-95 transition-all"
                          >
                            <Save className="w-2.5 h-2.5 mr-1" /> Save
                          </Button>
                        </div>
                      )}
                    </div>
                    {!isEditingBooking ? (
                      <div className="space-y-1">
                        <p className="font-black text-slate-900 uppercase tracking-tight text-[11px] sm:text-xs">{selectedBooking?.customer?.name}</p>
                        <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">{selectedBooking?.customer?.email}</p>
                        <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">{selectedBooking?.customer?.phone}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-900">Name</label>
                          <Input 
                            value={editBookingData.customer?.name || ""} 
                            onChange={(e) => setEditBookingData({
                              ...editBookingData, 
                              customer: { ...editBookingData.customer!, name: e.target.value }
                            })}
                            className="h-9 text-[11px] sm:text-xs rounded-xl border-black/10 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-900">Email</label>
                          <Input 
                            value={editBookingData.customer?.email || ""} 
                            onChange={(e) => setEditBookingData({
                              ...editBookingData, 
                              customer: { ...editBookingData.customer!, email: e.target.value }
                            })}
                            className="h-9 text-[11px] sm:text-xs rounded-xl border-black/10 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-900">Phone</label>
                          <Input 
                            value={editBookingData.customer?.phone || ""} 
                            onChange={(e) => setEditBookingData({
                              ...editBookingData, 
                              customer: { ...editBookingData.customer!, phone: e.target.value }
                            })}
                            className="h-9 text-[11px] sm:text-xs rounded-xl border-black/10 bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">Flight Details</p>
                    {!isEditingBooking ? (
                      <div className="space-y-1">
                        <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Date: <span className="font-black text-primary">{selectedBooking?.flight_date ? format(new Date(selectedBooking.flight_date), "EEEE d MMM yyyy").toUpperCase() : 'Not scheduled'}</span></p>
                        <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Time: <span className="font-black text-primary">{selectedBooking?.flight_time || 'Not scheduled'}</span></p>
                        <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Status: <span className="capitalize font-black text-primary">{selectedBooking?.status}</span></p>
                        <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Payment: <span className="capitalize font-black text-primary">{selectedBooking?.payment_type === 'deposit' ? `Deposit (RM ${selectedBooking.deposit_amount})` : 'Full Payment'}</span></p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-900">Flight Date</label>
                          <Input 
                            type="date"
                            value={editBookingData.flight_date ? format(new Date(editBookingData.flight_date), "yyyy-MM-dd") : ""} 
                            onChange={(e) => setEditBookingData({ ...editBookingData, flight_date: e.target.value })}
                            className="h-9 text-[11px] sm:text-xs rounded-xl border-black/10 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-900">Flight Time</label>
                          <Input 
                            type="time"
                            value={editBookingData.flight_time || ""} 
                            onChange={(e) => setEditBookingData({ ...editBookingData, flight_time: e.target.value })}
                            onClick={(e) => (e.currentTarget as any).showPicker()}
                            className="h-9 text-[11px] sm:text-xs rounded-xl border-black/10 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-900">Status</label>
                          <select 
                            value={editBookingData.status || ""} 
                            onChange={(e) => setEditBookingData({ ...editBookingData, status: e.target.value })}
                            className="flex h-9 w-full rounded-xl border border-black/10 bg-white px-3 py-1 text-[11px] sm:text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/80 disabled:cursor-not-allowed disabled:opacity-50 font-black uppercase tracking-widest"
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="rescheduled">Rescheduled</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-900">Payment Type</label>
                          <select 
                            value={editBookingData.payment_type || "full"} 
                            onChange={(e) => {
                              const newPaymentType = e.target.value as 'full' | 'deposit';
                              setEditBookingData({ 
                                ...editBookingData, 
                                payment_type: newPaymentType,
                                deposit_amount: newPaymentType === 'full' ? editBookingData.total_amount : editBookingData.deposit_amount,
                                outstanding_balance: newPaymentType === 'full' ? 0 : (editBookingData.total_amount || 0) - (editBookingData.deposit_amount || 0)
                              });
                            }}
                            className="flex h-9 w-full rounded-xl border border-black/10 bg-white px-3 py-1 text-[11px] sm:text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/80 disabled:cursor-not-allowed disabled:opacity-50 font-black uppercase tracking-widest"
                          >
                            <option value="full">Full Payment</option>
                            <option value="deposit">Deposit</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-900">Deposit Amount (RM)</label>
                          <div className="relative">
                            <Input 
                              type="number"
                              value={editBookingData.deposit_amount || ""} 
                              onChange={(e) => {
                                const newDeposit = e.target.value ? parseFloat(e.target.value) : 0;
                                setEditBookingData({ 
                                  ...editBookingData, 
                                  deposit_amount: newDeposit,
                                  outstanding_balance: editBookingData.payment_type === 'full' ? 0 : (editBookingData.total_amount || 0) - newDeposit
                                });
                              }}
                              className="h-9 text-[11px] sm:text-xs rounded-xl border-black/10 bg-white pr-24"
                              placeholder="Enter deposit amount"
                            />
                            {editBookingData.payment_type === 'full' && editBookingData.deposit_amount !== undefined && editBookingData.total_amount !== undefined && editBookingData.deposit_amount < editBookingData.total_amount && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-100 text-green-700 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase pointer-events-none">
                                Discount: RM {(editBookingData.total_amount - editBookingData.deposit_amount).toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Package Details from booking_items */}
                {selectedBooking?.booking_items && selectedBooking.booking_items.length > 0 ? (
                  <div className="bg-slate-50 p-4 rounded-lg border shadow-md">
                    <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest mb-3">Ordered Packages & Items</p>
                    <div className="space-y-3">
                      {selectedBooking.booking_items.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-start border-b pb-2 last:border-0 last:pb-0">
                          <div>
                            <p className="font-black text-slate-900 uppercase tracking-tight text-[11px] sm:text-xs">{item.package?.name || "Unknown Item"}</p>
                            {item.package?.description && <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 line-clamp-1">{item.package.description}</p>}
                            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mt-1">Quantity: <span className="font-black text-slate-900">{item.quantity}</span> × RM {item.unit_price}</p>
                          </div>
                          <p className="font-black text-slate-900 uppercase tracking-tight text-[11px] sm:text-xs">RM {item.total_price}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Fallback to legacy package_details if booking_items is empty */
                  selectedBooking?.package_details && (
                    <div className="bg-slate-50 p-4 rounded-lg border shadow-md">
                      <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest mb-2">Package Details (Legacy)</p>
                      <pre className="text-[11px] sm:text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap text-slate-900">
                        {JSON.stringify(selectedBooking.package_details, null, 2)}
                      </pre>
                    </div>
                  )
                )}

                {/* Additional Items Summary (if any) */}
                {selectedBooking?.add_items_summary && (
                   <div className="bg-slate-50 p-4 rounded-lg border shadow-md">
                    <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest mb-2">Additional Items Summary</p>
                    <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 whitespace-pre-wrap">{selectedBooking.add_items_summary}</p>
                  </div>
                )}

                {/* Payment Proof */}
                <div className="bg-slate-50 p-4 rounded-lg border shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">Payment Receipts</p>
                    <Button 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={isUploadingReceipt}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-2 text-[10px] font-black uppercase tracking-widest border-black"
                    >
                      {isUploadingReceipt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Add Receipt
                    </Button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*,.pdf" 
                      onChange={handleUploadReceipt} 
                    />
                  </div>

                  {(() => {
                    const urls = selectedBooking?.payment_proof_urls || [];
                    if (selectedBooking?.payment_proof_url && !urls.includes(selectedBooking.payment_proof_url)) {
                      urls.unshift(selectedBooking.payment_proof_url);
                    }

                    if (urls.length === 0) {
                      return <p className="text-xs text-slate-500 font-medium">No receipts uploaded yet.</p>;
                    }

                    return (
                      <div className="flex flex-col gap-2">
                        {urls.map((url, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100 transition-colors group">
                            <a 
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-primary hover:text-primary/90 font-black uppercase tracking-widest text-[11px] sm:text-xs"
                            >
                              <Eye className="w-4 h-4" /> View Receipt {urls.length > 1 ? `#${idx + 1}` : ''}
                            </a>
                            <Button
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this receipt?")) {
                                  handleDeleteReceipt(idx);
                                }
                              }}
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete Receipt"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </TabsContent>
              
              <TabsContent value="documents" className="space-y-4">
                <BookingPDFGenerator 
                  key={selectedBooking?.booking_id}
                  bookingId={selectedBooking?.booking_id || ""} 
                  passengers={selectedBooking?.booking_passengers || []}
                />
              </TabsContent>
            </Tabs>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Registration Document Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-[100vw] w-screen h-screen flex flex-row p-0 overflow-hidden bg-[#f3f3f3] border-none rounded-none shadow-none">
          {/* Left Sidebar - Print Settings */}
          <div className="w-[300px] bg-[#f3f3f3] border-r border-[#d9d9d9] flex flex-col overflow-y-auto shrink-0 p-6 space-y-8">
            <h2 className="text-2xl font-light text-[#333]">Print</h2>
            
            {/* Print Button Section */}
            <div className="flex items-start gap-4">
              <Button 
                onClick={handlePrintFromPreview}
                className="w-32 h-32 flex flex-col items-center justify-center gap-2 bg-white hover:bg-[#f9f9f9] text-[#333] border border-[#d9d9d9] rounded-sm shadow-sm transition-all active:bg-[#eee] shrink-0"
              >
                <Printer className="w-12 h-12 stroke-[1px]" />
                <span className="text-sm">Print</span>
              </Button>
              
              <div className="flex flex-col gap-2 pt-2">
                <span className="text-xs text-[#666]">Copies:</span>
                <Input 
                  type="number" 
                  defaultValue={1} 
                  className="w-16 h-8 bg-white border-[#d9d9d9] text-xs focus:ring-0 rounded-sm shadow-none" 
                />
              </div>
            </div>

            {/* Printer Selection (Mock) */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#333]">Printer</h3>
              <div className="relative">
                 <div className="flex items-center gap-3 p-2 bg-white border border-[#d9d9d9] rounded-sm cursor-pointer hover:bg-[#fafafa] group">
                    <div className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-sm shrink-0">
                      <Printer className="w-6 h-6 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">Microsoft Print to PDF</div>
                      <div className="text-[10px] text-green-600">Ready</div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                 </div>
                 <Button variant="link" className="text-[10px] p-0 h-auto text-blue-600 mt-1 hover:no-underline">Printer Properties</Button>
              </div>
            </div>

            {/* Settings Dropdowns */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#333]">Settings</h3>
              
              {/* Orientation */}
              <div className="space-y-1">
                <div className="relative group">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                     <Layout className={`w-4 h-4 transition-transform ${printOrientation === 'landscape' ? 'rotate-90' : ''}`} />
                   </div>
                   <Select value={printOrientation} onValueChange={(val: any) => setPrintOrientation(val)}>
                      <SelectTrigger className="w-full bg-white border-[#d9d9d9] rounded-sm pl-10 text-xs h-12 focus:ring-0 shadow-none hover:bg-[#fafafa]">
                        <div className="text-left">
                          <div className="font-medium">{printOrientation === 'landscape' ? 'Landscape' : 'Portrait'} Orientation</div>
                          <div className="text-[10px] text-slate-500">
                            {pageSize === 'A4' 
                              ? (printOrientation === 'landscape' ? '297 x 210 mm' : '210 x 297 mm')
                              : (printOrientation === 'landscape' ? '11 x 8.5 in' : '8.5 x 11 in')}
                          </div>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">
                          Portrait {pageSize === 'A4' ? '(210 x 297 mm)' : '(8.5 x 11 in)'}
                        </SelectItem>
                        <SelectItem value="landscape">
                          Landscape {pageSize === 'A4' ? '(297 x 210 mm)' : '(11 x 8.5 in)'}
                        </SelectItem>
                      </SelectContent>
                   </Select>
                </div>
              </div>

              {/* Page Size */}
              <div className="space-y-1">
                <div className="relative group">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                     <FileBox className="w-4 h-4" />
                   </div>
                   <Select value={pageSize} onValueChange={(val: any) => setPageSize(val)}>
                      <SelectTrigger className="w-full bg-white border-[#d9d9d9] rounded-sm pl-10 text-xs h-12 focus:ring-0 shadow-none hover:bg-[#fafafa]">
                        <div className="text-left">
                          <div className="font-medium">{pageSize}</div>
                          <div className="text-[10px] text-slate-500">
                            {pageSize === 'A4' ? '210 x 297 mm' : '216 x 279 mm'}
                          </div>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A4">A4 (210 x 297 mm)</SelectItem>
                        <SelectItem value="Letter">Letter (216 x 279 mm)</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
              </div>

              {/* Margins */}
              <div className="space-y-1">
                <div className="relative group">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                     <Grid className="w-4 h-4" />
                   </div>
                   <Select value={printPageMargins} onValueChange={(val: any) => setPrintPageMargins(val)}>
                      <SelectTrigger className="w-full bg-white border-[#d9d9d9] rounded-sm pl-10 text-xs h-12 focus:ring-0 shadow-none hover:bg-[#fafafa]">
                        <div className="text-left">
                          <div className="font-medium">{printPageMargins} Margins</div>
                          <div className="text-[10px] text-slate-500">
                            {printPageMargins === 'Normal' ? '20mm' : printPageMargins === 'Narrow' ? '10mm' : 'None'}
                          </div>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Normal">Normal Margins (20mm)</SelectItem>
                        <SelectItem value="Narrow">Narrow Margins (10mm)</SelectItem>
                        <SelectItem value="None">None</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 mt-4">
                <Button 
                  onClick={handleDownloadRegistrationPDF} 
                  disabled={isGeneratingCert}
                  className="w-full gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-none h-10 rounded-sm text-xs font-semibold"
                >
                  {isGeneratingCert ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download PDF
                </Button>
                <Button variant="link" className="text-[10px] p-0 h-auto text-blue-600 w-full text-right hover:no-underline">Page Setup</Button>
              </div>
            </div>
          </div>

          {/* Right Main Area - Document Preview */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#808080] relative">
            {/* Toolbar */}
            <div className="h-12 bg-[#474747] flex items-center justify-between px-4 shrink-0 text-white z-20">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Monitor className="w-4 h-4 text-slate-300" />
                  <span className="text-xs font-medium">Document Preview</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-[#333] rounded px-2 py-1 border border-[#555]">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-white hover:bg-[#444]"
                    onClick={() => setPreviewZoom(Math.max(0.3, previewZoom - 0.1))}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <span className="text-[11px] font-medium w-12 text-center">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-white hover:bg-[#444]"
                    onClick={() => setPreviewZoom(Math.min(1.5, previewZoom + 0.1))}
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white hover:bg-[#555] rounded-full"
                  onClick={() => setShowPreviewDialog(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 overflow-auto p-8 flex flex-col items-center scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
               <div 
                 className="origin-top transition-all duration-300"
                 style={{
                   width: printOrientation === 'landscape' ? (pageSize === 'A4' ? '297mm' : '11in') : (pageSize === 'A4' ? '210mm' : '8.5in'),
                   transform: `scale(${previewZoom})`,
                 }}
                 dangerouslySetInnerHTML={{ __html: previewHtml }} 
               />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
