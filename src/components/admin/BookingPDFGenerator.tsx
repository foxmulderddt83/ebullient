import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  Layout,
  Maximize2,
  Minimize2,
  Grid,
  FileBox,
  Monitor
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { notificationService } from "@/lib/notificationService";
import { generateAndSavePDF, generateAndPreviewPDF } from "@/lib/pdfGenerator";
import { CameraCapture, applyWatermark } from "@/components/BookingWizard";
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
}

export const BookingPDFGenerator: React.FC<BookingPDFGeneratorProps> = ({ 
  bookingId, 
  apiUrl, // Kept for prop compatibility but not used for generation anymore
  passengers = []
}) => {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [selectedPassengers, setSelectedPassengers] = useState<string[]>(passengers.map(p => p.id));
  const [isGenerating, setIsGenerating] = useState(false);
  const [localPassengers, setLocalPassengers] = useState<any[]>(passengers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState<{ id: string, side: 'front' | 'back' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<{ id: string, side: 'front' | 'back' } | null>(null);
  const [previewData, setPreviewData] = useState<{ html: string, title: string } | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [pageSize, setPageSize] = useState<string>('A4');
  const [printPageMargins, setPrintPageMargins] = useState<string>('Normal');
  const [previewZoom, setPreviewZoom] = useState(0.85);

  // Update local passengers if props change
  React.useEffect(() => {
    setLocalPassengers(passengers);
  }, [passengers]);

  const documentTypes = [
    { id: 'invoice_paid', label: 'Paid Invoice', icon: <DollarSign className="w-5 h-5 text-green-600" />, color: 'border-green-200 bg-green-50' },
    { id: 'booking_confirmation', label: 'Booking Confirmation', icon: <FileCheck className="w-5 h-5 text-orange-500" />, color: 'border-orange-200 bg-orange-50' },
    { id: 'gendec', label: 'General Declaration', icon: <Plane className="w-5 h-5 text-purple-600" />, color: 'border-purple-200 bg-purple-50' },
    { id: 'certificate', label: 'Flight Certificate', icon: <ShieldCheck className="w-5 h-5 text-red-600" />, color: 'border-red-200 bg-red-50', perPassenger: true },
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
    if (selectedPassengers.length === passengers.length) {
      setSelectedPassengers([]);
    } else {
      setSelectedPassengers(passengers.map(p => p.id));
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
    // Enforce 1MB image limit for captured/uploaded IDs
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Image is too large (max 1MB). Please try again or use lower resolution.");
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
      if (file.size > 1 * 1024 * 1024) {
        toast.error("File is too large. Max 1MB allowed.");
        e.target.value = ''; // Reset input
        return;
      }
      if (uploadingFor) {
        handleImageUpdate(file, uploadingFor.id, uploadingFor.side);
      }
    }
  };

  const handlePreview = async (docType: string, passengerId?: string) => {
    setIsPreviewing(true);
    try {
      const docConfig = documentTypes.find(d => d.id === docType);
      
      // If it's a per-passenger document and no specific passenger provided, use the first selected one or first available
      let targetPassengerId = passengerId;
      if (docConfig?.perPassenger && !targetPassengerId) {
        targetPassengerId = selectedPassengers[0] || localPassengers[0]?.id;
        
        if (!targetPassengerId && localPassengers.length > 0) {
          toast.error("Please select a passenger to preview this document.");
          setIsPreviewing(false);
          return;
        }
      }

      const result = await generateAndPreviewPDF(bookingId, docType, targetPassengerId, printOrientation, pageSize as any, printPageMargins as any);
      if (result && result.html) {
        setPreviewData({ 
          html: result.html, 
          title: `${docConfig?.label || docType} Preview` 
        });
      } else {
        throw new Error("No preview HTML generated");
      }
    } catch (error: any) {
      console.error("Preview error:", error);
      toast.error(`Failed to generate preview: ${error.message}`);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSend = async () => {
    if (selectedDocuments.length === 0) {
      toast.error("Please select at least one document to generate and send.");
      return;
    }
    
    // Check if per-passenger documents are selected but no passengers selected
    const hasPerPassengerDoc = selectedDocuments.some(docId => documentTypes.find(d => d.id === docId)?.perPassenger);
    if (hasPerPassengerDoc && selectedPassengers.length === 0 && passengers.length > 0) {
      toast.error("Please select at least one passenger for passenger-specific documents (e.g. Flight Certificate).");
      return;
    }

    setIsGenerating(true);
    
    try {
      // 1. Fetch Booking Details
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:customers(*),
          booking_items(
            *,
            package:packages(*)
          )
        `)
        .eq('booking_id', bookingId)
        .single();
        
      if (bookingError || !booking) throw new Error("Could not fetch booking details");

      // 2. Fetch Settings for Templates
      const { data: settingsData, error: settingsError } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['payment_success_email_template', 'payment_success_email_enabled', 'whatsapp_template_payment_success']);
        
      if (settingsError) throw settingsError;
      
      const settings = settingsData?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {} as Record<string, string>) || {};
      
      // 3. Generate Selected PDFs
      const generatedDocs: { url: string, name: string }[] = [];
      const failedDocs: string[] = [];
      
      // Use toast promise for better UX during multi-step process
      toast.info("Generating documents...");

      for (const docType of selectedDocuments) {
        const docConfig = documentTypes.find(d => d.id === docType);
        
        try {
          // If document is per-passenger AND passengers are selected, generate for each selected passenger
          if (docConfig?.perPassenger && selectedPassengers.length > 0) {
            for (const passengerId of selectedPassengers) {
               const passenger = passengers.find(p => p.id === passengerId);
               const result = await generateAndSavePDF(bookingId, docType, passengerId, printOrientation, pageSize as any, printPageMargins as any);
               generatedDocs.push({
                 url: result.publicUrl,
                 name: `${docType.replace(/_/g, '-')}-${booking.booking_reference}-${passenger?.name || passengerId}.pdf`
               });
            }
          } else {
            // Standard generation (once per booking)
            const result = await generateAndSavePDF(bookingId, docType, undefined, printOrientation, pageSize as any, printPageMargins as any);
            generatedDocs.push({
              url: result.publicUrl,
              name: `${docType.replace(/_/g, '-')}-${booking.booking_reference}.pdf`
            });
          }
        } catch (e: any) {
          console.error(`Failed to generate ${docType}:`, e);
          failedDocs.push(docType);
          // Don't stop the whole process, just log failure
          toast.error(`Failed to generate ${docType.replace('_', ' ')}: ${e.message}`);
        }
      }

      if (generatedDocs.length === 0 && failedDocs.length > 0) {
        throw new Error("All selected documents failed to generate. Please check template configurations.");
      }
      
      let emailSent = false;
      let whatsappSent = false;

      // 4. Send Email
      const emailTemplateId = settings['payment_success_email_template'];
      const emailEnabled = settings['payment_success_email_enabled'] === 'true';
      let emailResult = { success: false, error: '' };
      
      if (emailEnabled && emailTemplateId && emailTemplateId !== 'none') {
        toast.info("Sending email...");
        // @ts-ignore
        emailResult = await notificationService.sendEmail(booking, emailTemplateId, generatedDocs);
        if (emailResult.success) {
           emailSent = true;
        } else {
           toast.error(`Email failed: ${emailResult.error}`);
        }
      } else {
        if (!emailEnabled) {
          console.warn("Email notification disabled (payment_success_email_enabled). Email not sent.");
        } else {
          console.warn("No email template configured (payment_success_email_template). Email not sent.");
        }
      }
      
      // 5. Send WhatsApp
      const whatsappTemplate = settings['whatsapp_template_payment_success'];
      let whatsappResult = { success: false, error: '' };

      if (whatsappTemplate) {
        toast.info("Sending WhatsApp message...");
        // @ts-ignore
        whatsappResult = await notificationService.sendWhatsApp(booking, whatsappTemplate, generatedDocs.map(d => d.url));
        if (whatsappResult.success) {
           whatsappSent = true;
        } else {
           toast.error(`WhatsApp failed: ${whatsappResult.error}`);
        }
      } else {
        console.warn("No WhatsApp template configured. Message not sent.");
      }

      if (emailSent && whatsappSent) {
        toast.success("Documents generated and sent via Email & WhatsApp!");
      } else if (emailSent) {
        toast.success("Documents generated and sent via Email!");
      } else if (whatsappSent) {
        toast.success("Documents generated and queued for WhatsApp!");
      } else {
        if (!emailSent && emailResult.error) {
            // Already toasted error
        } else if (!whatsappSent && whatsappResult.error) {
            // Already toasted error
        } else {
            toast.warning("Documents generated but no notifications were sent (check settings).");
        }
      }
      
      setSelectedDocuments([]);
      
    } catch (error: any) {
      console.error('Error in send flow:', error);
      toast.error(`Process failed: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!previewData) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const sizeStr = pageSize === 'A4' ? 'A4' : 'letter';
      const marginVal = printPageMargins === 'Normal' ? '20mm' : printPageMargins === 'Narrow' ? '10mm' : '0';
      const widthStr = printOrientation === 'landscape' ? (pageSize === 'A4' ? '297mm' : '11in') : (pageSize === 'A4' ? '210mm' : '8.5in');
      const heightStr = printOrientation === 'landscape' ? (pageSize === 'A4' ? '210mm' : '8.5in') : (pageSize === 'A4' ? '297mm' : '11in');

      printWindow.document.write(`
        <html>
          <head>
            <title>${previewData.title}</title>
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
              ${previewData.html}
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

  return (
    <div className="space-y-6 p-4 border rounded-xl bg-white shadow-sm">
      <div className="flex justify-between items-center">
        <h3 className="text-base sm:text-lg font-black uppercase tracking-tight flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Document Generation
        </h3>
        
        <div className="flex items-center gap-3 bg-slate-100 rounded-xl px-4 py-2 border border-slate-200 shadow-inner">
          <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Orientation</span>
          <Select value={printOrientation} onValueChange={(value: 'landscape' | 'portrait') => setPrintOrientation(value)}>
            <SelectTrigger className="w-[180px] h-8 bg-white border-slate-200 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="landscape" className="text-[11px] sm:text-xs font-bold">LANDSCAPE (297x210mm)</SelectItem>
              <SelectItem value="portrait" className="text-[11px] sm:text-xs font-bold">PORTRAIT (210x297mm)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {documentTypes.map(doc => (
          <div 
            key={doc.id}
            className={`
              relative flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
              ${selectedDocuments.includes(doc.id) ? 'border-primary ring-1 ring-primary/20' : 'border-transparent hover:bg-slate-50'}
              ${doc.color}
            `}
            onClick={() => toggleDocument(doc.id)}
          >
            <div className="mt-0.5">
              <Checkbox 
                checked={selectedDocuments.includes(doc.id)}
                onCheckedChange={() => toggleDocument(doc.id)}
                className="border-black data-[state=checked]:bg-primary data-[state=checked]:border-black"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {doc.icon}
                  <span className="font-semibold text-[11px] sm:text-xs">{doc.label}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 hover:bg-slate-200/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(doc.id);
                  }}
                  title="Preview"
                  disabled={isPreviewing}
                >
                  {isPreviewing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3 text-slate-500" />}
                </Button>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-900 leading-tight">
                Click to select for batch generation
              </p>
            </div>
          </div>
        ))}
      </div>

      {passengers.length > 0 && (
        <div className="border border-slate-500 rounded-lg p-4 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900">Select Passengers</h4>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleAllPassengers}
              className="h-6 text-[11px] sm:text-xs text-primary hover:text-primary/80 hover:bg-primary/10"
            >
              {selectedPassengers.length === passengers.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          
          <div className="border border-slate-400 rounded-md bg-white overflow-hidden text-[11px] sm:text-xs">
            <div className="grid grid-cols-[auto_2fr_1.5fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.5fr] gap-3 px-4 py-2 bg-slate-100 border-b border-slate-400 text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
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
            <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-300">
              {localPassengers.map((passenger) => (
                <div 
                  key={passenger.id}
                  className={`grid grid-cols-[auto_2fr_1.5fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.5fr] gap-3 px-4 py-2.5 items-center hover:bg-slate-50 transition-colors ${selectedPassengers.includes(passenger.id) ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-center" onClick={(e) => {
                    e.stopPropagation();
                    togglePassenger(passenger.id);
                  }}>
                    <Checkbox 
                      checked={selectedPassengers.includes(passenger.id)}
                      onCheckedChange={() => togglePassenger(passenger.id)}
                      className="mt-0.5 border-black data-[state=checked]:bg-primary data-[state=checked]:border-black"
                    />
                  </div>

                  {editingId === passenger.id ? (
                    <>
                      <div>
                        <Input 
                          value={editForm.name} 
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="h-8 text-[11px] sm:text-xs"
                        />
                      </div>
                      <div>
                        <Input 
                          value={editForm.ic_passport_number} 
                          onChange={(e) => handleInputChange('ic_passport_number', e.target.value)}
                          className="h-8 text-[11px] sm:text-xs"
                        />
                      </div>
                      <div>
                        <Input 
                          value={editForm.country_of_origin} 
                          onChange={(e) => handleInputChange('country_of_origin', e.target.value)}
                          className="h-8 text-[11px] sm:text-xs"
                        />
                      </div>
                      <div>
                        <Select 
                          value={editForm.gender} 
                          onValueChange={(v) => handleInputChange('gender', v)}
                        >
                          <SelectTrigger className="h-8 text-[11px] sm:text-xs">
                            <SelectValue placeholder="Gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male" className="text-[11px] sm:text-xs">Male</SelectItem>
                            <SelectItem value="Female" className="text-[11px] sm:text-xs">Female</SelectItem>
                            <SelectItem value="Other" className="text-[11px] sm:text-xs">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Input 
                          type="number"
                          value={editForm.weight} 
                          onChange={(e) => handleInputChange('weight', e.target.value)}
                          className="h-8 text-[11px] sm:text-xs"
                          placeholder="kg"
                        />
                      </div>
                      <div>
                        <Input 
                          type="number"
                          value={editForm.height} 
                          onChange={(e) => handleInputChange('height', e.target.value)}
                          className="h-8 text-[11px] sm:text-xs"
                          placeholder="cm"
                        />
                      </div>
                      <div>
                        <Select 
                          value={editForm.status || "Passenger"} 
                          onValueChange={(v) => handleInputChange('status', v)}
                        >
                          <SelectTrigger className="h-8 text-[11px] sm:text-xs">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Co-Pilot" className="text-[11px] sm:text-xs">Co-Pilot</SelectItem>
                            <SelectItem value="Passenger" className="text-[11px] sm:text-xs">Passenger</SelectItem>
                            <SelectItem value="Visitor" className="text-[11px] sm:text-xs">Visitor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={handleSavePassenger}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-black text-slate-900 truncate text-[11px] sm:text-xs" title={passenger.name}>{passenger.name}</div>
                      <div className="text-slate-900 truncate text-[11px] sm:text-xs" title={passenger.ic_passport_number}>{passenger.ic_passport_number}</div>
                      <div className="text-slate-900 truncate text-[11px] sm:text-xs" title={passenger.country_of_origin}>{passenger.country_of_origin}</div>
                      <div className="text-slate-900 truncate capitalize text-[11px] sm:text-xs" title={passenger.gender}>{passenger.gender || '-'}</div>
                      <div className="text-slate-900 truncate text-[11px] sm:text-xs" title={`${passenger.weight} kg`}>{passenger.weight ? `${passenger.weight} kg` : '-'}</div>
                      <div className="text-slate-900 truncate text-[11px] sm:text-xs" title={`${passenger.height} cm`}>{passenger.height ? `${passenger.height} cm` : '-'}</div>
                      <div className="text-slate-900 truncate text-[11px] sm:text-xs font-bold" title={passenger.status || 'Passenger'}>{passenger.status || 'Passenger'}</div>
                      <div className="flex justify-center gap-2">
                        <div className="flex gap-1 mr-2 border-r pr-2 border-slate-200">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-slate-500 hover:text-primary hover:bg-primary/5"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview('certificate', passenger.id);
                            }}
                            title="Preview Certificate"
                            disabled={isPreviewing}
                          >
                            {isPreviewing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative">
                                {passenger.id_front_url ? (
                                  <div className="relative">
                                    <img src={passenger.id_front_url} className="w-6 h-4 object-cover rounded-[2px] border border-slate-300" alt="Front" />
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-4 bg-slate-100 border border-dashed border-slate-300 rounded-[2px] flex items-center justify-center">
                                    <span className="text-[8px] text-slate-900">F</span>
                                  </div>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(passenger.id_front_url, '_blank')} disabled={!passenger.id_front_url}>
                                <Eye className="w-4 h-4 mr-2" /> View Front ID
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setCameraOpen({ id: passenger.id, side: 'front' })}>
                                <Camera className="w-4 h-4 mr-2" /> Use Camera
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setUploadingFor({ id: passenger.id, side: 'front' });
                                fileInputRef.current?.click();
                              }}>
                                <Upload className="w-4 h-4 mr-2" /> Upload File
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative">
                                {passenger.id_back_url ? (
                                  <div className="relative">
                                    <img src={passenger.id_back_url} className="w-6 h-4 object-cover rounded-[2px] border border-slate-300" alt="Back" />
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-4 bg-slate-100 border border-dashed border-slate-300 rounded-[2px] flex items-center justify-center">
                                    <span className="text-[8px] text-slate-900">B</span>
                                  </div>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(passenger.id_back_url, '_blank')} disabled={!passenger.id_back_url}>
                                <Eye className="w-4 h-4 mr-2" /> View Back ID
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setCameraOpen({ id: passenger.id, side: 'back' })}>
                                <Camera className="w-4 h-4 mr-2" /> Use Camera
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setUploadingFor({ id: passenger.id, side: 'back' });
                                fileInputRef.current?.click();
                              }}>
                                <Upload className="w-4 h-4 mr-2" /> Upload File
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0 text-primary hover:text-primary/90 hover:bg-primary/5"
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
          <p className="text-[11px] text-slate-900 mt-2 italic">
            * Selected passengers will be used for generating passenger-specific documents (e.g. Flight Certificate).
          </p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button 
          onClick={handleSend} 
          disabled={selectedDocuments.length === 0 || isGenerating}
          className="w-full sm:w-auto gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Processing...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> 
              Send to Email & WhatsApp {selectedDocuments.length > 0 ? `(${selectedDocuments.length})` : ''}
            </>
          )}
        </Button>
      </div>

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
      <Dialog open={!!previewData} onOpenChange={() => setPreviewData(null)}>
        <DialogContent className="max-w-[1200px] w-[95vw] h-[95vh] flex p-0 overflow-hidden bg-[#f3f3f3] border-none rounded-none shadow-2xl gap-0">
          {/* Sidebar */}
          <div className="w-[300px] bg-[#f3f3f3] border-r border-[#d9d9d9] flex flex-col overflow-y-auto shrink-0 p-6 space-y-8">
            <h2 className="text-2xl font-light text-[#333]">Print</h2>
            
            {/* Large Print Button */}
            <div className="flex items-start gap-4">
              <Button 
                onClick={handlePrint}
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
                  className="w-16 h-8 bg-white border-[#d9d9d9] text-xs focus:ring-0 rounded-sm" 
                />
              </div>
            </div>

            {/* Printer Section (Mock) */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#333]">Printer</h3>
              <div className="relative">
                 <div className="flex items-center gap-3 p-2 bg-white border border-[#d9d9d9] rounded-sm cursor-pointer hover:bg-[#fafafa]">
                    <div className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-sm shrink-0">
                      <Printer className="w-6 h-6 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">Microsoft Print to PDF</div>
                      <div className="text-[10px] text-green-600">Ready</div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                 </div>
                 <Button variant="link" className="text-[10px] p-0 h-auto text-blue-600 mt-1">Printer Properties</Button>
              </div>
            </div>

            {/* Settings Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#333]">Settings</h3>
              
              {/* Orientation Dropdown */}
              <div className="space-y-1">
                <div className="relative group">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                     <Layout className={`w-4 h-4 transition-transform ${printOrientation === 'landscape' ? 'rotate-90' : ''}`} />
                   </div>
                   <Select value={printOrientation} onValueChange={(val: any) => setPrintOrientation(val)}>
                      <SelectTrigger className="w-full bg-white border-[#d9d9d9] rounded-sm pl-10 text-xs h-12 focus:ring-0">
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

              {/* Page Size Dropdown */}
              <div className="space-y-1">
                <div className="relative group">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                     <FileBox className="w-4 h-4" />
                   </div>
                   <Select value={pageSize} onValueChange={setPageSize}>
                      <SelectTrigger className="w-full bg-white border-[#d9d9d9] rounded-sm pl-10 text-xs h-12 focus:ring-0">
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

              {/* Margins Dropdown */}
              <div className="space-y-1">
                <div className="relative group">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                     <Grid className="w-4 h-4" />
                   </div>
                   <Select value={printPageMargins} onValueChange={setPrintPageMargins}>
                      <SelectTrigger className="w-full bg-white border-[#d9d9d9] rounded-sm pl-10 text-xs h-12 focus:ring-0">
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
              
              <Button variant="link" className="text-[10px] p-0 h-auto text-blue-600 mt-1 w-full text-right">Page Setup</Button>
            </div>
          </div>

          {/* Preview Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#e6e6e6]">
             <div className="h-10 shrink-0 bg-[#f3f3f3] border-b border-[#d9d9d9] flex items-center justify-between px-4">
                <div className="flex items-center gap-2 text-xs text-[#666]">
                   <Monitor className="w-4 h-4" />
                   Preview
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setPreviewData(null)}
                  className="h-8 w-8 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </Button>
             </div>
             
             <div className="flex-1 overflow-auto p-8 flex justify-center items-start relative scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-1">
                   <Button variant="secondary" size="icon" className="h-8 w-8 bg-white border border-[#d9d9d9] shadow-sm rounded-sm" onClick={() => setPreviewZoom(z => Math.min(2, z + 0.1))}><ChevronUp className="w-4 h-4" /></Button>
                   <Button variant="secondary" size="icon" className="h-8 w-8 bg-white border border-[#d9d9d9] shadow-sm rounded-sm" onClick={() => setPreviewZoom(z => Math.max(0.1, z - 0.1))}><ChevronDown className="w-4 h-4" /></Button>
                </div>
                
                <div 
               className="bg-white shadow-[0_0_20px_rgba(0,0,0,0.2)] origin-top transition-all duration-300"
               style={{
                 width: printOrientation === 'landscape' ? (pageSize === 'A4' ? '297mm' : '11in') : (pageSize === 'A4' ? '210mm' : '8.5in'),
                 minHeight: printOrientation === 'landscape' ? (pageSize === 'A4' ? '210mm' : '8.5in') : (pageSize === 'A4' ? '297mm' : '11in'),
                 transform: `scale(${previewZoom})`,
                 borderRadius: '1px',
                 padding: printPageMargins === 'Normal' ? '20mm' : printPageMargins === 'Narrow' ? '10mm' : '0'
               }}
               dangerouslySetInnerHTML={{ __html: previewData?.html || '' }}
             />
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
