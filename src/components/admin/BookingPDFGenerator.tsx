import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Loader2, 
  FileCheck, 
  DollarSign, 
  Plane, 
  ShieldCheck, 
  Undo2, 
  Send, 
  Eye, 
  Edit2, 
  Save, 
  X,
  Camera,
  Upload,
  MoreVertical,
  Printer,
  ChevronUp,
  ChevronDown,
  Layers,
  Monitor,
  Mail,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { notificationService } from "@/lib/notificationService";
import { generateAndSavePDF, generateAndPreviewPDF } from "@/lib/pdfGenerator";
import { CameraCapture, applyWatermark } from "@/components/BookingWizard";
import { DocumentPreviewModal } from './DocumentPreviewModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BookingPDFGeneratorProps {
  bookingId: string;
  apiUrl?: string;
  passengers?: any[];
  canEdit?: boolean;
}

export const BookingPDFGenerator: React.FC<BookingPDFGeneratorProps> = ({ 
  bookingId, 
  apiUrl, // Kept for prop compatibility but not used for generation anymore
  passengers = [],
  canEdit = true
}) => {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [selectedPassengers, setSelectedPassengers] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [localPassengers, setLocalPassengers] = useState<any[]>([]);
  const [isLoadingPassengers, setIsLoadingPassengers] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState<{ id: string, side: 'front' | 'back' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<{ id: string, side: 'front' | 'back' } | null>(null);
  const [previewData, setPreviewData] = useState<{ 
    html: string, 
    title: string, 
    docType: string, 
    passengerId?: string,
    orientation?: 'portrait' | 'landscape',
    pageSize?: 'A4' | 'Letter',
    widthMm?: number,
    heightMm?: number,
    windowW?: number,
    windowH?: number
  } | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(typeof window !== 'undefined' && window.innerWidth < 768 ? window.innerWidth / 900 : 0.85);

  useEffect(() => {
    if (isPreviewing) {
      const width = window.innerWidth;
      if (width < 768) {
        setPreviewZoom(width / 900);
      } else {
        setPreviewZoom(0.85);
      }
    }
  }, [isPreviewing]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [dynamicDocumentTypes, setDynamicDocumentTypes] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState<{ type: 'email' | 'whatsapp' } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [bookingData, setBookingData] = useState<any>(null);

  // Fetch booking data
  const fetchBookingData = async () => {
    if (!bookingId) return;
    try {
      const { data: bData, error } = await supabase
        .from('bookings')
        .select('*, customer:customers(name, phone), booking_items(*, package:packages(name))')
        .eq('booking_id', bookingId)
        .single();

      if (error) throw error;
      setBookingData(bData);
    } catch (error) {
      console.error('Error fetching booking data:', error);
    }
  };

  // Fetch passengers from database to ensure they are current
  const fetchPassengers = async () => {
    if (!bookingId) return;
    setIsLoadingPassengers(true);
    try {
      const { data, error } = await supabase
        .from('booking_passengers')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setLocalPassengers(data || []);
      setSelectedPassengers((data || []).map((p: any) => p.id));
    } catch (error: any) {
      console.error('Error fetching passengers:', error);
      toast.error("Failed to load current passenger list");
    } finally {
      setIsLoadingPassengers(false);
    }
  };

  // Fetch templates for email/whatsapp
  const fetchTemplates = async () => {
    try {
      // 1. Fetch Email templates
      const { data: emailData, error: emailError } = await supabase
        .from('message_settings')
        .select('*')
        .eq('is_active', true)
        .order('template_name', { ascending: true });

      if (emailError) throw emailError;
      setTemplates(emailData || []);
      
      // 2. Fetch WhatsApp templates from site_settings
      const { data: waData, error: waError } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', [
          'whatsapp_template_payment_success',
          'whatsapp_template_approval',
          'whatsapp_template_refund'
        ]);

      if (waError) throw waError;

      const mappedWaTemplates = [
        {
          id: 'blank_template',
          template_name: 'Blank Template',
          message_content: ''
        },
        ...(waData || []).map(item => {
          let label = 'WhatsApp Template';
          if (item.key === 'whatsapp_template_payment_success') label = 'Payment Success';
          if (item.key === 'whatsapp_template_approval') label = 'Manual Approval';
          if (item.key === 'whatsapp_template_refund') label = 'Manual Refund';
          
          return {
            id: item.key,
            template_name: label,
            message_content: item.value
          };
        })
      ];

      setWaTemplates(mappedWaTemplates);

      if (emailData && emailData.length > 0) {
        setSelectedTemplateId(emailData[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching templates:', error);
    }
  };

  useEffect(() => {
    if (sendDialogOpen?.type === 'whatsapp' && waTemplates.length > 0) {
      // Find blank template or default to first
      const blankTemplate = waTemplates.find(t => t.id === 'blank_template');
      setSelectedTemplateId(blankTemplate ? blankTemplate.id : waTemplates[0].id);
    } else if (sendDialogOpen?.type === 'email' && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [sendDialogOpen, waTemplates, templates]);

  const fetchDocumentTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('id, name, document_type, is_default, template_settings')
        .eq('is_default', true)
        .order('name', { ascending: true });

      if (error) throw error;

      const mappedDocs = (data || []).map(doc => {
        // Assign icons and colors based on document_type
        let icon = <FileText className="w-5 h-5 text-slate-600" />;
        let color = 'border-slate-200 bg-slate-50';
        let perPassenger = false;

        switch (doc.document_type) {
          case 'invoice_paid':
            icon = <DollarSign className="w-5 h-5 text-emerald-600" />;
            color = 'border-emerald-100 bg-emerald-50/50';
            break;
          case 'booking_confirmation':
            icon = <FileCheck className="w-5 h-5 text-amber-600" />;
            color = 'border-amber-100 bg-amber-50/50';
            break;
          case 'gendec':
            icon = <Plane className="w-5 h-5 text-indigo-600" />;
            color = 'border-indigo-100 bg-indigo-50/50';
            break;
          case 'certificate':
            icon = <ShieldCheck className="w-5 h-5 text-slate-700" />;
            color = 'border-slate-200 bg-slate-50';
            perPassenger = true;
            break;
          case 'refund_voucher':
            icon = <Undo2 className="w-5 h-5 text-slate-900" />;
            color = 'border-slate-200 bg-slate-50';
            break;
        }

        const hasDocx = doc.template_settings && typeof doc.template_settings === 'object' && !!(doc.template_settings as any).original_file_path;

        return {
          id: doc.id, // Use UUID for unique identification
          docType: doc.document_type,
          label: doc.name,
          icon,
          color,
          perPassenger,
          isDocx: hasDocx
        };
      });

      setDynamicDocumentTypes(mappedDocs);
    } catch (error: any) {
      console.error('Error fetching document templates:', error);
    }
  };

  // Fetch on mount and when bookingId changes
  React.useEffect(() => {
    fetchBookingData();
    fetchPassengers();
    fetchTemplates();
    fetchDocumentTemplates();
  }, [bookingId]);

  const documentTypes = dynamicDocumentTypes.length > 0 ? dynamicDocumentTypes : [
    { id: 'invoice_paid', label: 'Paid Invoice', icon: <DollarSign className="w-5 h-5 text-emerald-600" />, color: 'border-emerald-100 bg-emerald-50/50' },
    { id: 'booking_confirmation', label: 'Booking Confirmation', icon: <FileCheck className="w-5 h-5 text-amber-600" />, color: 'border-amber-100 bg-amber-50/50' },
    { id: 'gendec', label: 'General Declaration', icon: <Plane className="w-5 h-5 text-indigo-600" />, color: 'border-indigo-100 bg-indigo-50/50' },
    { id: 'certificate', label: 'Flight Certificate', icon: <ShieldCheck className="w-5 h-5 text-slate-700" />, color: 'border-slate-200 bg-slate-50', perPassenger: true },
    { id: 'refund_voucher', label: 'Refund Voucher', icon: <Undo2 className="w-5 h-5 text-slate-900" />, color: 'border-slate-200 bg-slate-50' },
  ];

  const toggleDocument = (docType: string) => {
    setSelectedDocuments(prev => 
      prev.includes(docType)
        ? prev.filter(d => d !== docType)
        : [...prev, docType]
    );
  };

  const togglePassenger = (passengerId: string) => {
    setSelectedPassengers(prev => 
      prev.includes(passengerId)
        ? prev.filter(id => id !== passengerId)
        : [...prev, passengerId]
    );
  };

  const toggleAllPassengers = () => {
    if (selectedPassengers.length === localPassengers.length) {
      setSelectedPassengers([]);
    } else {
      setSelectedPassengers(localPassengers.map(p => p.id));
    }
  };

  const handleEdit = (passenger: any) => {
    setEditingId(passenger.id);
    setEditForm({ ...passenger });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleInputChange = (field: string, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpdate = async (file: File, id: string, side: 'front' | 'back') => {
    // Enforce 3MB image limit for captured/uploaded IDs
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image is too large (max 3MB). Please try again or use lower resolution.");
      return;
    }

    try {
      setIsSaving(true);
      const { url, file: watermarkedFile } = await applyWatermark(file);
      
      const fileName = `id_${side}_${id}_${Date.now()}.jpg`;
      const filePath = `passenger-ids/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, watermarkedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const updateData = side === 'front' 
        ? { id_front_url: publicUrl } 
        : { id_back_url: publicUrl };

      const { error: updateError } = await supabase
        .from('booking_passengers')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      setLocalPassengers(prev => prev.map(p => 
        p.id === id ? { ...p, ...updateData } : p
      ));

      if (editingId === id) {
        setEditForm(prev => ({ ...prev, ...updateData }));
      }

      toast.success(`${side.charAt(0).toUpperCase() + side.slice(1)} ID updated successfully`);
    } catch (error: any) {
      console.error('Error updating image:', error);
      toast.error(`Failed to update image: ${error.message}`);
    } finally {
      setIsSaving(false);
      setCameraOpen(null);
      setUploadingFor(null);
    }
  };

  const handleSavePassenger = async () => {
    if (!editForm) return;
    if (!canEdit) {
      toast.error("Read-only mode: cannot save passenger details");
      return;
    }
    
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('booking_passengers')
        .update({
          name: editForm.name,
          ic_passport_number: editForm.ic_passport_number,
          country_of_origin: editForm.country_of_origin,
          gender: editForm.gender,
          weight: editForm.weight,
          height: editForm.height,
          status: editForm.status,
        })
        .eq('id', editingId);

      if (error) throw error;

      setLocalPassengers(prev => prev.map(p => 
        p.id === editingId ? { ...editForm } : p
      ));
      
      setEditingId(null);
      setEditForm(null);
      toast.success("Passenger details updated successfully");
    } catch (error: any) {
      console.error('Error saving passenger:', error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        toast.error("File is too large. Max 3MB allowed.");
        e.target.value = ''; // Reset input
        return;
      }
      if (uploadingFor) {
        handleImageUpdate(file, uploadingFor.id, uploadingFor.side);
      }
    }
  };

  const handlePrintPassengerIds = (passenger: any) => {
    const frontUrl = passenger?.id_front_url;
    const backUrl = passenger?.id_back_url;

    if (!frontUrl && !backUrl) {
      toast.error("No ID images found for this passenger.");
      return;
    }

    const safeName = (passenger?.name || 'Passenger').toString().replace(/[<>]/g, '');
    const safeIc = (passenger?.ic_passport_number || '').toString().replace(/[<>]/g, '');
    
    // Booking Details
    const safeBookingRef = (bookingData?.booking_reference || '').toString().replace(/[<>]/g, '');
    const safePhone = (bookingData?.customer?.phone || '').toString().replace(/[<>]/g, '');
    const safeDate = bookingData?.flight_date ? new Date(bookingData.flight_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() : '';
    const safeTime = bookingData?.flight_time || '';
    const safeLocation = (bookingData?.location || '').toString().replace(/[<>]/g, '');
    const safePackage = bookingData?.booking_items?.[0]?.package?.name || '';

    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) {
      toast.error("Popup blocked. Please allow popups to print.");
      return;
    }

    const frontBlock = frontUrl ? `
      <div class="card">
        <div class="label">FRONT ID</div>
        <div class="img-wrap"><img src="${frontUrl}" alt="Front ID" /></div>
      </div>
    ` : '';

    const backBlock = backUrl ? `
      <div class="card">
        <div class="label">BACK ID</div>
        <div class="img-wrap"><img src="${backUrl}" alt="Back ID" /></div>
      </div>
    ` : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>ID Print - ${safeBookingRef}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            html, body { margin: 0; padding: 0; background: white; }
            body { font-family: Arial, sans-serif; color: #111827; line-height: 1.4; }
            
            .booking-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6mm; padding-bottom: 6mm; border-bottom: 2px solid #f1f5f9; }
            .header-main { flex: 1; }
            .booking-id { font-weight: 900; font-size: 16px; color: #0f172a; margin-bottom: 1mm; }
            .customer-info { font-weight: 700; font-size: 12px; color: #475569; }
            
            .booking-details { text-align: right; }
            .detail-row { font-weight: 800; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.02em; }
            .detail-row span { color: #1e293b; margin-left: 2mm; }

            .meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8mm; margin-top: 2mm; }
            .meta .left { font-weight: 800; font-size: 13px; letter-spacing: 0.02em; color: #0f172a; }
            .meta .right { font-weight: 900; font-size: 11px; color: #64748b; text-align: right; letter-spacing: 0.1em; text-transform: uppercase; }
            
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; align-items: start; }
            .grid.one { grid-template-columns: 1fr; }
            .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 5mm; background: #fff; }
            .label { font-weight: 900; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: #94a3b8; margin-bottom: 4mm; border-bottom: 1px solid #f1f5f9; padding-bottom: 2mm; }
            .img-wrap { width: 100%; height: 85mm; border: 1px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #f8fafc; }
            img { width: 100%; height: 100%; object-fit: contain; }
          </style>
        </head>
        <body>
          <div class="booking-header">
            <div class="header-main">
              <div class="booking-id">REF: ${safeBookingRef}</div>
              <div class="customer-info">${bookingData?.customer?.name || 'N/A'} • ${safePhone}</div>
            </div>
            <div class="booking-details">
              <div class="detail-row">DATE: <span>${safeDate} @ ${safeTime}</span></div>
              <div class="detail-row">LOCATION: <span>${safeLocation}</span></div>
              <div class="detail-row">PACKAGE: <span>${safePackage}</span></div>
            </div>
          </div>

          <div class="meta">
            <div class="left">PASSENGER: ${safeName}${safeIc ? ` • ${safeIc}` : ''}</div>
            <div class="right">ID DOCUMENTS</div>
          </div>
          
          <div class="grid ${frontUrl && backUrl ? '' : 'one'}">
            ${frontBlock}
            ${backBlock}
          </div>
          
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 150);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDirectPrint = async (docId: string, passengerId?: string, isDirectPdf: boolean = false) => {
    setIsPreviewing(true);
    try {
      const docConfig = documentTypes.find(d => d.id === docId);
      if (!docConfig) {
        setIsPreviewing(false);
        return;
      }
      
      const docType = (docConfig as any).docType || docId;
      const templateId = (docConfig as any).docType ? docId : undefined;
      
      let targetPassengerId = passengerId;
      if (docConfig?.perPassenger && !targetPassengerId) {
        targetPassengerId = selectedPassengers[0] || localPassengers[0]?.id;
        
        if (!targetPassengerId && localPassengers.length > 0) {
          toast.error("Please select a passenger to print this document.");
          setIsPreviewing(false);
          return;
        }
      }

      if (isDirectPdf) {
        const loadingToast = toast.loading("Generating High-Fidelity PDF...");
        try {
          const result = await generateAndSavePDF(bookingId, docType, targetPassengerId, 'portrait', 'A4', 'Normal', templateId);
          if (result && result.publicUrl) {
            window.open(result.publicUrl, '_blank');
            toast.success("PDF generated successfully!", { id: loadingToast });
          } else {
            throw new Error("Failed to generate PDF URL");
          }
        } catch (err: any) {
          toast.error(`Generation failed: ${err.message}`, { id: loadingToast });
        } finally {
          setIsPreviewing(false);
        }
        return;
      }

      const result = await generateAndPreviewPDF(bookingId, docType, targetPassengerId, 'portrait', 'A4', 'Normal', templateId);
      if (result && result.html) {
        // Create an invisible iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (!doc) throw new Error("Could not access iframe document");

        const isLandscape = result.orientation === 'landscape';
        const paperSize = result.pageSize || 'A4';
        const orientationStr = isLandscape ? 'landscape' : 'portrait';
        const isSinglePage = !result.html.includes('class="page-break"');

        doc.write(`
          <html>
            <head>
              <title>Print Document</title>
              <style>
                @page {
                  size: ${paperSize} ${orientationStr};
                  margin: 0;
                }
                html, body { 
                  margin: 0; 
                  padding: 0;
                  background: white; 
                }
                .print-page {
                  width: 100%;
                  min-height: 100vh;
                  position: relative;
                  box-sizing: border-box;
                }
                ${isSinglePage ? `
                .print-page, .print-page > div, .print-page > .pdf-container {
                  min-height: 0 !important;
                  height: auto !important;
                }
                ` : ''}
                @media print {
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  .print-page { 
                    page-break-after: always;
                    page-break-inside: avoid;
                  }
                  .print-page:last-child {
                    page-break-after: auto;
                  }
                }
              </style>
            </head>
            <body>
              ${result.html.includes('class="print-page"') ? result.html : `<div class="print-page">${result.html}</div>`}
              <script>
                window.onload = () => {
                  window.print();
                  setTimeout(() => {
                    window.parent.document.body.removeChild(window.frameElement);
                  }, 1000);
                };
              </script>
            </body>
          </html>
        `);
        doc.close();
      } else {
        throw new Error("No print content generated");
      }
    } catch (error: any) {
      console.error("Print error:", error);
      toast.error(`Failed to generate document: ${error.message}`);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handlePrint = () => {
    if (!previewData?.html) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isLandscape = previewData.orientation === 'landscape';
    const paperSize = previewData.pageSize || 'A4';
    const orientationStr = isLandscape ? 'landscape' : 'portrait';

    // Check if it's a single page (no page-break class)
    const isSinglePage = !previewData.html.includes('class="page-break"');
    const marginVal = isSinglePage ? '0' : '0';

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Document</title>
          <style>
            @page {
              size: ${paperSize} ${orientationStr};
              margin: ${marginVal};
            }
            html, body { 
              margin: 0; 
              padding: 0;
              background: white; 
              height: auto;
              min-height: 100vh;
            }
            .print-page {
              width: 100%;
              min-height: 100vh;
              position: relative;
              box-sizing: border-box;
              page-break-after: always;
            }
            .print-page > div {
              width: 100% !important;
              min-height: 100vh !important;
              margin: 0 !important;
              box-sizing: border-box;
            }
            .print-page > .pdf-container {
              width: 100% !important;
              min-height: 100vh !important;
              margin: 0 auto !important;
              box-sizing: border-box;
              background-image: none !important;
            }
            /* For single page, remove min-height to avoid extra blank page */
            ${isSinglePage ? `
            .print-page {
              page-break-after: auto !important;
            }
            .print-page, .print-page > div, .print-page > .pdf-container {
              min-height: 0 !important;
              height: auto !important;
            }
            ` : ''}
            .print-page:last-child {
              page-break-after: auto !important;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .print-page { 
                page-break-after: always;
                page-break-inside: avoid;
                border: none !important;
              }
              .print-page:last-child {
                page-break-after: auto !important;
              }
              .pdf-container {
                height: auto !important;
                min-height: 100vh !important;
                width: 100% !important;
                max-width: 100% !important;
                overflow: visible !important;
                background-image: none !important;
              }
              /* For single page print, ensure it doesn't force extra height */
              ${isSinglePage ? `
              .pdf-container {
                min-height: 0 !important;
              }
              ` : ''}
              .page-break {
                page-break-after: always;
                break-after: page;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
              }
            }
          </style>
        </head>
        <body>
          ${previewData.html.includes('class="print-page"') ? previewData.html : `<div class="print-page">${previewData.html}</div>`}
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 100);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSend = async (type: 'email' | 'whatsapp') => {
    if (selectedDocuments.length === 0) {
      toast.error("Please select at least one document to send.");
      return;
    }

    if (!selectedTemplateId) {
      toast.error("Please select a template.");
      return;
    }

    setIsSending(true);
    const loadingToast = toast.loading(`Generating documents and sending ${type}...`);

    try {
      const booking = await notificationService.fetchBookingWithDetails(bookingId);
      if (!booking) throw new Error("Booking not found");

      const pdfUrls: { url: string, name: string }[] = [];

      for (const docId of selectedDocuments) {
        const docConfig = documentTypes.find(d => d.id === docId);
        const docType = (docConfig as any).docType || docId;
        const templateId = (docConfig as any).docType ? docId : undefined;
        
        try {
          const orientation = (docConfig as any).orientation || 'portrait';
          const pageSize = (docConfig as any).pageSize || 'A4';
          const margins = (docConfig as any).margins || 'Normal';

          if (docConfig?.perPassenger && selectedPassengers.length > 0) {
            for (const passengerId of selectedPassengers) {
              const passenger = localPassengers.find(p => p.id === passengerId);
              const result = await generateAndSavePDF(bookingId, docType, passengerId, orientation, pageSize, margins, templateId);
              if (result.publicUrl) {
                pdfUrls.push({
                  url: result.publicUrl,
                  name: `${docType.replace(/_/g, '-')}-${booking.booking_reference}-${passenger?.name || passengerId}.pdf`
                });
              }
            }
          } else {
            const result = await generateAndSavePDF(bookingId, docType, undefined, orientation, pageSize, margins, templateId);
            if (result.publicUrl) {
              pdfUrls.push({
                url: result.publicUrl,
                name: `${docType.replace(/_/g, '-')}-${booking.booking_reference}.pdf`
              });
            }
          }
        } catch (e: any) {
          console.error(`Failed to generate ${docType}:`, e);
        }
      }

      if (type === 'email') {
        const result = await notificationService.sendEmail(booking, selectedTemplateId, pdfUrls);
        if (result?.success) {
          toast.success("Email sent successfully", { id: loadingToast });
        } else {
          throw new Error(result?.error || "Failed to send email");
        }
      } else {
        const template = waTemplates.find(t => t.id === selectedTemplateId);
        let messageContent = template?.message_content || '';

        // If it's the blank template and message content is empty, send a single space to satisfy backend validation
        if (selectedTemplateId === 'blank_template' && messageContent === '') {
          messageContent = ' '; // Send a single space
        }

        const result = await notificationService.sendWhatsApp(booking, messageContent, pdfUrls.map(p => p.url));
        if (result?.success) {
          toast.success("WhatsApp sent successfully", { id: loadingToast });
        } else {
          throw new Error(result?.error || "Failed to send WhatsApp");
        }
      }
      setSendDialogOpen(null);
    } catch (error: any) {
      console.error(`Error sending ${type}:`, error);
      toast.error(`Failed to send ${type}: ${error.message}`, { id: loadingToast });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 p-3 sm:p-4 border rounded-xl bg-white shadow-sm w-full max-w-full overflow-x-hidden font-sans">
      <div className="flex justify-between items-center">
        <h3 className="text-base sm:text-lg font-bold font-sans uppercase tracking-tight flex items-center gap-2 text-slate-900">
          <FileText className="w-5 h-5 text-slate-700" />
          Document Generation
        </h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            fetchPassengers();
            fetchDocumentTemplates();
          }} 
          disabled={isLoadingPassengers}
          className="h-8 gap-2 text-[10px] font-bold font-sans uppercase tracking-tight border-slate-200 hover:bg-slate-50"
        >
          {isLoadingPassengers ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />}
          Refresh List
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {documentTypes.map(doc => (
          <div 
            key={doc.id}
            className={`
              relative flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
              ${selectedDocuments.includes(doc.id) ? 'border-slate-700 ring-1 ring-slate-200 shadow-md shadow-slate-100' : 'border-transparent hover:bg-slate-50'}
              ${doc.color}
            `}
            onClick={() => toggleDocument(doc.id)}
          >
            <div className="mt-0.5 shrink-0">
              <Checkbox 
                checked={selectedDocuments.includes(doc.id)}
                onCheckedChange={() => toggleDocument(doc.id)}
                className="border-slate-300 data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                  <div className="shrink-0">{doc.icon}</div>
                  <span className="font-bold font-sans text-[11px] sm:text-xs truncate text-slate-900" title={doc.label}>{doc.label}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {doc.isDocx && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 hover:bg-slate-200/50 text-indigo-700 bg-indigo-50/50 border border-indigo-100/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDirectPrint(doc.id, undefined, true);
                      }}
                      title="Direct PDF (DOCX)"
                      disabled={isPreviewing}
                    >
                      <FileText className="w-3 h-3" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 hover:bg-slate-200/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDirectPrint(doc.id);
                    }}
                    title="Direct Print"
                    disabled={isPreviewing}
                  >
                    {isPreviewing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3 text-slate-500" />}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 font-bold font-sans leading-tight">
                Click to select for batch generation
              </p>
            </div>
          </div>
        ))}
      </div>

      {isLoadingPassengers ? (
        <div className="border border-slate-200 rounded-lg p-12 bg-slate-50 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-700" />
          <p className="text-sm font-bold font-sans uppercase tracking-tight text-slate-500">Loading current passenger list...</p>
        </div>
      ) : localPassengers.length > 0 && (
        <div className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-slate-50/50 w-full overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base sm:text-lg font-bold font-sans uppercase tracking-tight text-slate-900">Select Passengers</h4>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleAllPassengers}
              disabled={!canEdit}
              className="h-6 text-[11px] sm:text-xs font-bold font-sans text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50"
            >
              {selectedPassengers.length === localPassengers.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          
          <div className="hidden sm:block border border-slate-200 rounded-md bg-white w-full overflow-x-auto text-[11px] sm:text-xs">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-[auto_2fr_1.5fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.5fr] gap-3 px-4 py-2 bg-slate-50/80 border-b border-slate-200 text-[11px] sm:text-xs font-bold font-sans text-slate-900 uppercase tracking-tight">
                <div className="w-4"></div>
                <div>Name</div>
                <div>IC/Passport</div>
                <div>Nationality</div>
                <div>Gender</div>
                <div>Weight</div>
                <div>Height</div>
                <div>Status</div>
                <div className="text-center">Actions</div>
              </div>
              <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
                {localPassengers.map((passenger) => (
                  <div 
                    key={passenger.id}
                    className={`grid grid-cols-[auto_2fr_1.5fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.5fr] gap-3 px-4 py-2.5 items-center hover:bg-slate-50 transition-colors ${selectedPassengers.includes(passenger.id) ? 'bg-slate-100/50' : ''}`}
                  >
                  <div className="flex items-center" onClick={(e) => {
                    e.stopPropagation();
                    if (canEdit) togglePassenger(passenger.id);
                  }}>
                    <Checkbox 
                      checked={selectedPassengers.includes(passenger.id)}
                      onCheckedChange={() => togglePassenger(passenger.id)}
                      disabled={!canEdit}
                      className="mt-0.5 border-slate-300 data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700 disabled:opacity-50"
                    />
                  </div>

                  {editingId === passenger.id ? (
                    <>
                      <div>
                        <Input 
                          value={editForm.name} 
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="h-8 text-[11px] sm:text-xs font-bold font-sans"
                        />
                      </div>
                      <div>
                        <Input 
                          value={editForm.ic_passport_number} 
                          onChange={(e) => handleInputChange('ic_passport_number', e.target.value)}
                          className="h-8 text-[11px] sm:text-xs font-bold font-sans"
                        />
                      </div>
                      <div>
                        <Input 
                          value={editForm.country_of_origin} 
                          onChange={(e) => handleInputChange('country_of_origin', e.target.value)}
                          className="h-8 text-[11px] sm:text-xs font-bold font-sans"
                        />
                      </div>
                      <div>
                        <Select 
                          value={editForm.gender} 
                          onValueChange={(v) => handleInputChange('gender', v)}
                        >
                          <SelectTrigger className="h-8 text-[11px] sm:text-xs font-bold font-sans">
                            <SelectValue placeholder="Gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male" className="text-[11px] sm:text-xs font-bold font-sans">Male</SelectItem>
                            <SelectItem value="Female" className="text-[11px] sm:text-xs font-bold font-sans">Female</SelectItem>
                            <SelectItem value="Other" className="text-[11px] sm:text-xs font-bold font-sans">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Input 
                          type="number"
                          value={editForm.weight} 
                          onChange={(e) => handleInputChange('weight', e.target.value)}
                          className="h-8 text-[11px] sm:text-xs font-bold font-sans"
                          placeholder="kg"
                        />
                      </div>
                      <div>
                        <Input 
                          type="number"
                          value={editForm.height} 
                          onChange={(e) => handleInputChange('height', e.target.value)}
                          className="h-8 text-[11px] sm:text-xs font-bold font-sans"
                          placeholder="cm"
                        />
                      </div>
                      <div>
                        <Select 
                          value={editForm.status || "Passenger"} 
                          onValueChange={(v) => handleInputChange('status', v)}
                        >
                          <SelectTrigger className="h-8 text-[11px] sm:text-xs font-bold font-sans">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Co-Pilot" className="text-[11px] sm:text-xs font-bold font-sans">Co-Pilot</SelectItem>
                            <SelectItem value="Passenger" className="text-[11px] sm:text-xs font-bold font-sans">Passenger</SelectItem>
                            <SelectItem value="Visitor" className="text-[11px] sm:text-xs font-bold font-sans">Visitor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={handleSavePassenger}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-bold font-sans text-slate-900 truncate text-[11px] sm:text-xs" title={passenger.name}>{passenger.name}</div>
                      <div className="text-slate-900 font-sans truncate text-[11px] sm:text-xs" title={passenger.ic_passport_number}>{passenger.ic_passport_number}</div>
                      <div className="text-slate-900 font-sans truncate text-[11px] sm:text-xs" title={passenger.country_of_origin}>{passenger.country_of_origin}</div>
                      <div className="text-slate-900 font-sans truncate capitalize text-[11px] sm:text-xs" title={passenger.gender}>{passenger.gender || '-'}</div>
                      <div className="text-slate-900 font-sans truncate text-[11px] sm:text-xs" title={`${passenger.weight} kg`}>{passenger.weight ? `${passenger.weight} kg` : '-'}</div>
                      <div className="text-slate-900 font-sans truncate text-[11px] sm:text-xs" title={`${passenger.height} cm`}>{passenger.height ? `${passenger.height} cm` : '-'}</div>
                      <div className="text-slate-900 font-sans truncate text-[11px] sm:text-xs font-bold" title={passenger.status || 'Passenger'}>{passenger.status || 'Passenger'}</div>
                      <div className="flex justify-center gap-2">
                        <div className="flex gap-1 mr-2 border-r pr-2 border-slate-200">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintPassengerIds(passenger);
                        }}
                        title="Print ID Images"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative" disabled={!canEdit}>
                                {passenger.id_front_url ? (
                                  <div className="relative">
                                    <img src={passenger.id_front_url} className="w-6 h-4 object-cover rounded-[2px] border border-slate-300" alt="Front" />
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-4 bg-slate-100 border border-dashed border-slate-300 rounded-[2px] flex items-center justify-center">
                                    <span className="text-[8px] text-slate-900 font-bold font-sans">F</span>
                                  </div>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-black/5 shadow-xl font-sans">
                              <DropdownMenuItem onClick={() => window.open(passenger.id_front_url, '_blank')} disabled={!passenger.id_front_url} className="text-[11px] font-bold uppercase tracking-tight">
                                <Eye className="w-4 h-4 mr-2" /> View Front ID
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setCameraOpen({ id: passenger.id, side: 'front' })} className="text-[11px] font-bold uppercase tracking-tight">
                                <Camera className="w-4 h-4 mr-2" /> Use Camera
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setUploadingFor({ id: passenger.id, side: 'front' });
                                fileInputRef.current?.click();
                              }} className="text-[11px] font-bold uppercase tracking-tight">
                                <Upload className="w-4 h-4 mr-2" /> Upload File
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative" disabled={!canEdit}>
                                {passenger.id_back_url ? (
                                  <div className="relative">
                                    <img src={passenger.id_back_url} className="w-6 h-4 object-cover rounded-[2px] border border-slate-300" alt="Back" />
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-4 bg-slate-100 border border-dashed border-slate-300 rounded-[2px] flex items-center justify-center">
                                    <span className="text-[8px] text-slate-900 font-bold font-sans">B</span>
                                  </div>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-black/5 shadow-xl font-sans">
                              <DropdownMenuItem onClick={() => window.open(passenger.id_back_url, '_blank')} disabled={!passenger.id_back_url} className="text-[11px] font-bold uppercase tracking-tight">
                                <Eye className="w-4 h-4 mr-2" /> View Back ID
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setCameraOpen({ id: passenger.id, side: 'back' })} className="text-[11px] font-bold uppercase tracking-tight">
                                <Camera className="w-4 h-4 mr-2" /> Use Camera
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setUploadingFor({ id: passenger.id, side: 'back' });
                                fileInputRef.current?.click();
                              }} className="text-[11px] font-bold uppercase tracking-tight">
                                <Upload className="w-4 h-4 mr-2" /> Upload File
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          disabled={!canEdit}
                          className="h-7 w-7 p-0 text-slate-700 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(passenger);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            </div>
          </div>

          {/* Mobile view (cards) */}
          <div className="block sm:hidden space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {localPassengers.map((passenger) => (
              <div 
                key={passenger.id} 
                className={`border-2 rounded-xl p-3 bg-white space-y-3 transition-all ${selectedPassengers.includes(passenger.id) ? 'border-slate-700 ring-1 ring-slate-100 bg-slate-50' : 'border-slate-200'} ${!canEdit ? 'pointer-events-none opacity-90' : ''}`}
                onClick={() => {
                  if (canEdit) togglePassenger(passenger.id);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      checked={selectedPassengers.includes(passenger.id)}
                      onCheckedChange={() => togglePassenger(passenger.id)}
                      disabled={!canEdit}
                      className="border-slate-300 data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700 h-5 w-5 disabled:opacity-50"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div>
                      <div className="font-bold font-sans text-slate-900 uppercase text-xs">{passenger.name}</div>
                      <div className="text-[10px] font-bold font-sans text-slate-500 uppercase tracking-tight">{passenger.status || 'Passenger'}</div>
                    </div>
                  </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      disabled={!canEdit}
                      className="h-8 w-8 p-0 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      onClick={() => handleEdit(passenger)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                      onClick={() => handlePrintPassengerIds(passenger)}
                      title="Print ID Images"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px]">
                  <div>
                    <span className="text-slate-500 uppercase font-bold font-sans text-[9px] block mb-0.5">IC/Passport</span>
                    <span className="font-bold font-sans text-slate-900">{passenger.ic_passport_number || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase font-bold font-sans text-[9px] block mb-0.5">Nationality</span>
                    <span className="font-bold font-sans text-slate-900">{passenger.country_of_origin || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase font-bold font-sans text-[9px] block mb-0.5">Gender</span>
                    <span className="font-bold font-sans text-slate-900 capitalize">{passenger.gender || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase font-bold font-sans text-[9px] block mb-0.5">Weight / Height</span>
                    <span className="font-bold font-sans text-slate-900">
                      {passenger.weight ? `${passenger.weight}kg` : '-'} / {passenger.height ? `${passenger.height}cm` : '-'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                   <div className="flex items-center gap-2 flex-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1 h-9 gap-2 text-[10px] font-bold font-sans border-slate-200">
                            {passenger.id_front_url ? (
                              <img src={passenger.id_front_url} className="w-6 h-4 object-cover rounded-[2px]" alt="Front" />
                            ) : (
                              <div className="w-6 h-4 bg-slate-100 border border-dashed border-slate-300 rounded-[2px] flex items-center justify-center">
                                <span className="text-[8px] font-bold font-sans">F</span>
                              </div>
                            )}
                            Front ID
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="rounded-xl border-black/5 shadow-xl font-sans">
                          <DropdownMenuItem onClick={() => window.open(passenger.id_front_url, '_blank')} disabled={!passenger.id_front_url} className="text-[11px] font-bold uppercase tracking-tight">
                            <Eye className="w-4 h-4 mr-2" /> View Front ID
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCameraOpen({ id: passenger.id, side: 'front' })} className="text-[11px] font-bold uppercase tracking-tight">
                            <Camera className="w-4 h-4 mr-2" /> Use Camera
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setUploadingFor({ id: passenger.id, side: 'front' });
                            fileInputRef.current?.click();
                          }} className="text-[11px] font-bold uppercase tracking-tight">
                            <Upload className="w-4 h-4 mr-2" /> Upload File
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1 h-9 gap-2 text-[10px] font-bold font-sans border-slate-200">
                            {passenger.id_back_url ? (
                              <img src={passenger.id_back_url} className="w-6 h-4 object-cover rounded-[2px]" alt="Back" />
                            ) : (
                              <div className="w-6 h-4 bg-slate-100 border border-dashed border-slate-300 rounded-[2px] flex items-center justify-center">
                                <span className="text-[8px] font-bold font-sans">B</span>
                              </div>
                            )}
                            Back ID
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="rounded-xl border-black/5 shadow-xl font-sans">
                          <DropdownMenuItem onClick={() => window.open(passenger.id_back_url, '_blank')} disabled={!passenger.id_back_url} className="text-[11px] font-bold uppercase tracking-tight">
                            <Eye className="w-4 h-4 mr-2" /> View Back ID
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCameraOpen({ id: passenger.id, side: 'back' })} className="text-[11px] font-bold uppercase tracking-tight">
                            <Camera className="w-4 h-4 mr-2" /> Use Camera
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setUploadingFor({ id: passenger.id, side: 'back' });
                            fileInputRef.current?.click();
                          }} className="text-[11px] font-bold uppercase tracking-tight">
                            <Upload className="w-4 h-4 mr-2" /> Upload File
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                   </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-600 font-bold font-sans mt-2 italic">
            * Selected passengers will be used for generating passenger-specific documents (e.g. Flight Certificate).
          </p>
        </div>
      )}

      <div className="flex flex-wrap justify-end pt-2 gap-3">
        <Button 
          variant="outline"
          onClick={() => setSendDialogOpen({ type: 'whatsapp' })} 
          disabled={selectedDocuments.length === 0 || isGenerating || isSending}
          className="w-full sm:w-auto gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-100 shadow-sm h-10 rounded-xl text-xs font-bold font-sans uppercase tracking-tight transition-all active:scale-95"
        >
          {isSending && sendDialogOpen?.type === 'whatsapp' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MessageSquare className="w-4 h-4" />
          )}
          Send WhatsApp
        </Button>

        <Button 
          variant="outline"
          onClick={() => setSendDialogOpen({ type: 'email' })} 
          disabled={selectedDocuments.length === 0 || isGenerating || isSending}
          className="w-full sm:w-auto gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100 shadow-sm h-10 rounded-xl text-xs font-bold font-sans uppercase tracking-tight transition-all active:scale-95"
        >
          {isSending && sendDialogOpen?.type === 'email' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          Send Email
        </Button>
      </div>

      {/* Send Notification Dialog */}
      <Dialog open={!!sendDialogOpen} onOpenChange={() => setSendDialogOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {sendDialogOpen?.type === 'email' ? <Mail className="w-5 h-5 text-indigo-600" /> : <MessageSquare className="w-5 h-5 text-emerald-600" />}
              Send {sendDialogOpen?.type === 'email' ? 'Email' : 'WhatsApp'} Notification
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-500">
              Select a template to send with the selected documents.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-tight text-slate-900">Template</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {sendDialogOpen?.type === 'email' ? (
                    templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.template_name}
                      </SelectItem>
                    ))
                  ) : (
                    waTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.template_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-2">
              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded border">
                <strong>Selected Documents:</strong> {selectedDocuments.map(id => documentTypes.find(d => d.id === id)?.label).join(', ')}
                {selectedPassengers.length > 0 && ` (${selectedPassengers.length} passengers)`}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setSendDialogOpen(null)} disabled={isSending}>
              Cancel
            </Button>
            <Button 
              onClick={() => sendDialogOpen && handleSend(sendDialogOpen.type)} 
              disabled={isSending || !selectedTemplateId}
              className={sendDialogOpen?.type === 'email' ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-emerald-500 hover:bg-emerald-600'}
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for uploads */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* Camera Capture Modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-lg">
            <CameraCapture
              isFront={cameraOpen.side === 'front'}
              onCapture={(file) => handleImageUpdate(file, cameraOpen.id, cameraOpen.side)}
              onClose={() => setCameraOpen(null)}
            />
          </div>
        </div>
      )}
      {/* Document Preview Dialog */}
      <DocumentPreviewModal 
        previewData={previewData}
        onClose={() => setPreviewData(null)}
        onPrint={handlePrint}
      />
    </div>
  );
};
