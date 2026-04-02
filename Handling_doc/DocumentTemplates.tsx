import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, FileJson, Info, Download, Trash2, FileText, RefreshCw, Search, Save, Maximize2, Minimize2, Table, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import ReactQuill, { Quill } from 'react-quill';
import ImageResize from 'quill-image-resize-module-react';
import 'react-quill/dist/quill.snow.css';

// Register ImageResize module
Quill.register('modules/imageResize', ImageResize);

// Define Custom Table Blots

// Define Custom Table Blots
const Block = Quill.import('blots/block');
const Container = Quill.import('blots/container');

class TableCell extends Container {
  static blotName = 'table-cell';
  static tagName = 'td';
}

class TableHeaderCell extends Container {
  static blotName = 'table-header-cell';
  static tagName = 'th';
}

class TableRow extends Container {
  static blotName = 'table-row';
  static tagName = 'tr';
}

class TableBody extends Container {
  static blotName = 'table-body';
  static tagName = 'tbody';
}

class TableHead extends Container {
  static blotName = 'table-head';
  static tagName = 'thead';
}

class TableContainer extends Container {
  static blotName = 'table-container';
  static tagName = 'table';
}

// Nesting rules
TableContainer.allowedChildren = [TableHead, TableBody];
TableHead.allowedChildren = [TableRow];
TableBody.allowedChildren = [TableRow];
TableRow.allowedChildren = [TableHeaderCell, TableCell];
TableHeaderCell.allowedChildren = [Block, 'block', 'header', 'list', 'image'];
TableCell.allowedChildren = [Block, 'block', 'header', 'list', 'image'];

Quill.register(TableContainer);
Quill.register(TableHead);
Quill.register(TableBody);
Quill.register(TableRow);
Quill.register(TableHeaderCell);
Quill.register(TableCell);

import mammoth from 'mammoth';
import html2pdf from 'html2pdf.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

import { DOCUMENT_TYPES, AVAILABLE_VARIABLES } from "@/lib/constants";

interface GeneratedDoc {
  id: string;
  booking_id: string;
  document_type: string;
  file_path: string;
  generated_at: string;
  bookings?: {
    booking_reference: string;
    customers?: {
      name: string;
    }
  }
}

export default function DocumentTemplates() {
  const pdfApiUrl = import.meta.env.VITE_PDF_API_URL || 'https://oneday-whatsapp-bot.fly.dev';
  const [selectedType, setSelectedType] = useState<string>("invoice_paid");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<string | null>(null);
  const [templates, setTemplates] = useState<{name: string, url: string}[]>([]);
  const [history, setHistory] = useState<GeneratedDoc[]>([]);
  const [testBookingId, setTestBookingId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Editor State
  const [editorContent, setEditorContent] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [isPoppedOut, setIsPoppedOut] = useState(false);
  
  // Table Dialog State
  interface TableData {
    id: string;
    name: string;
    rows: number;
    cols: number;
    headers: string[];
    data: string[][];
    borderColor?: string;
  }

  const [tables, setTables] = useState<TableData[]>([]);
  const [currentTableId, setCurrentTableId] = useState<string | null>(null);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [selectionRange, setSelectionRange] = useState<{ index: number; length: number } | null>(null);
  const quillRef = useRef<ReactQuill>(null);
  const quillRefPopped = useRef<ReactQuill>(null);

  const handleOpenTableDialog = () => {
    const ref = isPoppedOut ? quillRefPopped : quillRef;
    if (ref.current) {
      const editor = ref.current.getEditor();
      const range = editor.getSelection();
      setSelectionRange(range || { index: editor.getLength(), length: 0 });
    }
    setShowTableDialog(true);
  };

  const handleAddTable = () => {
    const newId = (tables.length > 0 ? Math.max(...tables.map(t => parseInt(t.id))) + 1 : 1).toString();
    const newTable: TableData = {
      id: newId,
      name: `Table ${newId}`,
      rows: 2,
      cols: 2,
      headers: ['Header 1', 'Header 2'],
      data: [['', ''], ['', '']],
      borderColor: 'black'
    };
    setTables([...tables, newTable]);
    setCurrentTableId(newId);
  };

  const handleUpdateTable = (id: string, updates: Partial<TableData>) => {
    setTables(tables.map(t => {
      if (t.id !== id) return t;
      
      const updatedTable = { ...t, ...updates };
      
      // Resize headers if cols changed
      if (updates.cols !== undefined && updates.cols !== t.cols) {
        const newHeaders = [...t.headers];
        if (updates.cols > t.cols) {
          for (let i = t.cols; i < updates.cols; i++) newHeaders.push(`Header ${i + 1}`);
        } else {
          newHeaders.length = updates.cols;
        }
        updatedTable.headers = newHeaders;
        
        // Resize rows data
        updatedTable.data = t.data.map(row => {
          const newRow = [...row];
          if (updates.cols! > t.cols) {
            for (let i = t.cols; i < updates.cols!; i++) newRow.push('');
          } else {
            newRow.length = updates.cols!;
          }
          return newRow;
        });
      }

      // Resize rows count
      if (updates.rows !== undefined && updates.rows !== t.rows) {
        const newData = [...updatedTable.data];
        if (updates.rows > t.rows) {
          for (let i = t.rows; i < updates.rows; i++) {
             newData.push(new Array(updatedTable.cols).fill(''));
          }
        } else {
          newData.length = updates.rows;
        }
        updatedTable.data = newData;
      }

      return updatedTable;
    }));
  };

  const handleUpdateHeader = (tableId: string, colIndex: number, value: string) => {
    setTables(tables.map(t => {
      if (t.id !== tableId) return t;
      const newHeaders = [...t.headers];
      newHeaders[colIndex] = value;
      return { ...t, headers: newHeaders };
    }));
  };

  const handleUpdateCell = (tableId: string, rowIndex: number, colIndex: number, value: string) => {
    setTables(tables.map(t => {
      if (t.id !== tableId) return t;
      const newData = [...t.data];
      newData[rowIndex] = [...newData[rowIndex]];
      newData[rowIndex][colIndex] = value;
      return { ...t, data: newData };
    }));
  };

  const deleteTable = (id: string) => {
    setTables(tables.filter(t => t.id !== id));
    if (currentTableId === id) setCurrentTableId(null);
  };

  const insertTablePlaceholder = (id: string) => {
    const ref = isPoppedOut ? quillRefPopped : quillRef;
    if (ref.current) {
      const editor = ref.current.getEditor();
      const range = selectionRange || editor.getSelection() || { index: editor.getLength(), length: 0 };
      
      editor.insertText(range.index, `{table.${id}}`);
      setShowTableDialog(false);
    }
  };

  const generateTableHtml = (table: TableData) => {
    const borderColor = table.borderColor || 'black';
    // Use 0.2px for thinner borders as requested
    const borderWidth = '0.2px';
    
    let html = `<table class="w-full border-collapse mb-4" style="width: 100%; border-collapse: collapse; border: ${borderWidth} solid ${borderColor}; margin-bottom: 1rem;">`;
    
    // Header
    html += '<thead class="bg-gray-100" style="background-color: #f3f4f6;"><tr>';
    table.headers.forEach(header => {
      html += `<th class="px-2 py-2 text-center bg-gray-100 font-bold" style="border: ${borderWidth} solid ${borderColor}; padding: 8px; text-align: center; background-color: #f3f4f6; font-weight: bold;">${header}</th>`;
    });
    html += '</tr></thead>';
    
    // Body
    html += '<tbody>';
    table.data.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td class="px-2 py-2 text-center" style="border: ${borderWidth} solid ${borderColor}; padding: 8px; text-align: center;">${cell}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    
    return html;
  };

  useEffect(() => {
    fetchTemplates();
    fetchCurrentSetting();
    fetchHistory();
  }, [selectedType]);

  // Load current template content if it's an HTML file
  useEffect(() => {
    const loadTemplateContent = async () => {
      if (!currentTemplate || !supabase) return;
      
      // Only try to load content if it looks like an HTML file we generated
      if (currentTemplate.endsWith('.html')) {
        try {
          // 1. Load HTML Content
          const { data, error } = await supabase.storage
            .from('media')
            .download(currentTemplate);
            
          if (error) throw error;
          
          const text = await data.text();
          setEditorContent(text);
          setShowEditor(true);

          // 2. Load Associated Tables JSON
          const jsonPath = currentTemplate.replace('.html', '.json');
          const { data: jsonData, error: jsonError } = await supabase.storage
            .from('media')
            .download(jsonPath);

          if (!jsonError && jsonData) {
             const jsonText = await jsonData.text();
             try {
                const loadedTables = JSON.parse(jsonText);
                setTables(Array.isArray(loadedTables) ? loadedTables : []);
             } catch (e) {
                console.error("Error parsing tables JSON:", e);
                setTables([]);
             }
          } else {
             // If JSON doesn't exist (legacy templates), start with empty tables
             setTables([]);
          }

        } catch (error) {
          console.error("Error loading template content:", error);
          // Don't clear editor content here, as it might be a new upload
        }
      }
    };
    
    loadTemplateContent();
  }, [currentTemplate]);

  const fetchTemplates = async () => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase.storage
        .from('media')
        .list('templates', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) throw error;
      
      const templatesWithUrls = await Promise.all((data || []).map(async (file) => {
        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(`templates/${file.name}`);
        return { name: file.name, url: publicUrl };
      }));

      setTemplates(templatesWithUrls);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchCurrentSetting = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', `template_${selectedType}`)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setCurrentTemplate(data.value);
      } else {
        setCurrentTemplate(null);
        setEditorContent(""); // Clear editor if no template
        setShowEditor(false);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchHistory = async () => {
    if (!supabase) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('generated_documents')
        .select(`
          *,
          bookings (
            booking_reference,
            customers (
              name
            )
          )
        `)
        .order('generated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error("Failed to load history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExt === 'docx' || fileExt === 'doc') {
      // Handle Word Document - Convert to HTML for editing
      setUploading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Convert with improved options for better fidelity
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            styleMap: [
              // Preserve table styles
              "p[style-name='Table Text'] => p.table-text",
              "p[style-name='Table Heading'] => p.table-heading:fresh",
              // Preserve common styles
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "r[style-name='Strong'] => strong",
              "r[style-name='Emphasis'] => em",
            ],
            convertImage: mammoth.images.imgElement(async (image) => {
              try {
                // Read image buffer
                const imageBuffer = await image.read();
                
                // Convert to base64
                const base64 = btoa(
                  new Uint8Array(imageBuffer).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    ''
                  )
                );
                
                // Create data URL with correct content type
                const contentType = image.contentType || 'image/png';
                const dataUrl = `data:${contentType};base64,${base64}`;
                
                return {
                  src: dataUrl,
                  style: 'max-width: 100%; height: auto;'
                };
              } catch (error) {
                console.warn("Image conversion warning:", error);
                return { src: "" }; // Return empty image on failure
              }
            })
          }
        );

        // Enhanced HTML with better table styling injected
        const enhancedHtml = `
          <style>
            table { 
              border-collapse: collapse; 
              width: 100%; 
              margin: 15px 0;
              border: 1px solid #333;
            }
            td, th { 
              border: 1px solid #333; 
              padding: 8px 12px; 
              text-align: left;
              vertical-align: top;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .table-text { margin: 5px 0; }
            .table-heading { font-weight: bold; margin: 5px 0; }
            img { 
              max-width: 100%; 
              height: auto; 
              display: block; 
              margin: 10px 0; 
            }
          </style>
          ${result.value}
        `;

        setEditorContent(enhancedHtml);
        setShowEditor(true);
        toast.success("Word document converted with enhanced formatting. You can now edit and save it.");
      } catch (error: any) {
        console.error("Mammoth conversion error:", error);
        toast.error(`Conversion failed: ${error.message}`);
      } finally {
        setUploading(false);
      }
    } else {
      // Original upload logic for other files
      const fileName = `${selectedType}_${Date.now()}.${fileExt}`;
      const filePath = `templates/${fileName}`;

      setUploading(true);
      try {
        const { error } = await supabase.storage
          .from('media')
          .upload(filePath, file);

        if (error) throw error;

        toast.success("Template uploaded successfully");
        fetchTemplates();
        await updateTemplateSetting(filePath);
      } catch (error: any) {
        toast.error(`Upload failed: ${error.message}`);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSaveEditorContent = async () => {
    if (!editorContent) return;
    
    setSaving(true);
    try {
      // 1. Save HTML file to storage
      const timestamp = Date.now();
      const fileName = `${selectedType}_edited_${timestamp}.html`;
      const filePath = `templates/${fileName}`;
      
      const blob = new Blob([editorContent], { type: 'text/html' });
      const file = new File([blob], fileName, { type: 'text/html' });
      
      const { error } = await supabase.storage
        .from('media')
        .upload(filePath, file);
        
      if (error) throw error;
      
      // 2. Save Tables JSON to storage
      if (tables.length > 0) {
        const jsonFileName = `${selectedType}_edited_${timestamp}.json`;
        const jsonFilePath = `templates/${jsonFileName}`;
        const jsonBlob = new Blob([JSON.stringify(tables)], { type: 'application/json' });
        const jsonFile = new File([jsonBlob], jsonFileName, { type: 'application/json' });

        const { error: jsonError } = await supabase.storage
          .from('media')
          .upload(jsonFilePath, jsonFile);

        if (jsonError) console.warn("Error saving tables JSON:", jsonError);
      }

      await updateTemplateSetting(filePath);
      fetchTemplates();
      toast.success("Template and tables saved successfully");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(`Failed to save template: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateTemplateSetting = async (path: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ 
          key: `template_${selectedType}`, 
          value: path,
          category: 'templates',
          description: `Template for ${selectedType} documents`
        });

      if (error) throw error;
      
      setCurrentTemplate(path);
      toast.success("Active template updated");
    } catch (error: any) {
      toast.error(`Failed to update setting: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const downloadDoc = async (doc: GeneratedDoc) => {
    try {
      const { data, error } = await supabase.storage
        .from('media')
        .download(doc.file_path);
      
      if (error) throw error;
      
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.document_type}_${doc.bookings?.booking_reference || doc.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast.error(`Download failed: ${error.message}`);
    }
  };

  const deleteDoc = async (doc: GeneratedDoc) => {
    if (!confirm("Are you sure you want to delete this generated document? This will also remove the file from storage.")) return;

    try {
      // 1. Delete from storage
      const { error: storageError } = await supabase.storage
        .from('media')
        .remove([doc.file_path]);
      
      if (storageError) console.warn("Storage deletion error (might already be gone):", storageError);

      // 2. Delete from database
      const { error: dbError } = await supabase
        .from('generated_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      toast.success("Document deleted");
      fetchHistory();
    } catch (error: any) {
      toast.error(`Delete failed: ${error.message}`);
    }
  };

  const getVariableValue = (variable: string, data: any, passenger?: any) => {
    const booking = data;
    const customer = booking.customer || {};
    const items = booking.booking_items || [];
    const firstPackage = items.length > 0 && items[0].package ? items[0].package : (booking.package_details || {});
    
    // Fallback to first passenger if not explicitly provided
    const currentPassenger = passenger || (booking.booking_passengers && booking.booking_passengers.length > 0 ? booking.booking_passengers[0] : null);

    switch (variable) {
      case "{customer.name}": return (customer.name || "").toUpperCase();
      case "{customer.email}": return (customer.email || "").toUpperCase();
      case "{customer.phone}": return (customer.phone || "").toUpperCase();
      case "{customer.created_at}": return customer.created_at ? format(new Date(customer.created_at), 'dd MMM yyyy') : "";
      
      case "{booking.booking_reference}": return (booking.booking_reference || "").toUpperCase();
      case "{booking.reference}": return (booking.booking_reference || "").toUpperCase(); // Support both
      case "{booking.date}": return booking.created_at ? format(new Date(booking.created_at), 'EEEE d MMM yyyy') : "";
      case "{booking.time}": return booking.created_at ? format(new Date(booking.created_at), 'HH:mm') : "";
      case "{booking.status}": return (booking.status || "").toUpperCase();
      case "{booking.total_amount}": return booking.total_amount ? `RM ${booking.total_amount}` : "";
      case "{booking.paid_amount}": return booking.paid_amount ? `RM ${booking.paid_amount}` : "";
      case "{booking.payment_status}": return (booking.payment_status || "").toUpperCase();
      case "{booking.payment_method}": return (booking.payment_method || "").toUpperCase();
      case "{booking.payment_gateway}": return (booking.payment_gateway || "").toUpperCase();
      case "{booking.paid_at}": return booking.paid_at ? format(new Date(booking.paid_at), 'EEEE d MMM yyyy HH:mm') : "";
      case "{booking.payment_id}": return (booking.payment_id || "").toUpperCase();
      case "{booking.payment_proof_url}": return booking.payment_proof_url || "";
      case "{booking.add_items_summary}": 
        if (items && items.length > 0) {
          return items.map((item: any, idx: number) => `
            <div style="margin-bottom: 1px; border: 1px solid #6b7280; border-radius: 6px; padding: 2px; background-color: transparent;">
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 1px; color: #111827; padding-bottom: 1px; line-height: 1.1;">
                 Item ${idx + 1}: ${(item.package?.name || "").toUpperCase()}
              </div>
            </div>
          `).join('');
        } else if (booking.package_details) {
           const pd = booking.package_details;
           return `
            <div style="margin-bottom: 1px; border: 1px solid #6b7280; border-radius: 6px; padding: 2px; background-color: transparent;">
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 1px; color: #111827; padding-bottom: 1px; line-height: 1.1;">
                 Package: ${(pd.name || "").toUpperCase()}
              </div>
            </div>
           `;
        }
        return "";
      case "{booking.payment_type}": return (booking.payment_type || "").toUpperCase();
      case "{booking.deposit_amount}": {
        const dep = booking.deposit_amount;
        const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
        return val ? `RM ${val}` : "";
      }
      case "{booking.discount_amount}": return booking.discount_amount ? `RM ${booking.discount_amount}` : "RM 0.00";
      case "{deposit}": {
        const dep = booking.deposit_amount;
        const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
        return val ? `RM ${val}` : "";
      }
      case "{discount}": return booking.discount_amount ? `RM ${booking.discount_amount}` : "RM 0.00";
      case "{booking.amount_to_pay}": {
        const dep = booking.deposit_amount;
        const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
        const amount = booking.payment_type === 'deposit' ? val : booking.total_amount;
        return amount ? `RM ${amount}` : "";
      }
      case "{booking.flight_date}": return booking.flight_date ? format(new Date(booking.flight_date), 'EEEE d MMM yyyy') : "";
      case "{booking.flight_time}": return (booking.flight_time || "").toUpperCase();
      case "{booking.invoice_id}": return (booking.invoice_id || "").toUpperCase();
      case "{booking.pilot_name}": return (booking.pilot_name || "").toUpperCase();
      case "{booking.aircraft_registration}": return (booking.aircraft_registration || "").toUpperCase();
      case "{booking.notes}": return (booking.notes || "").toUpperCase();
      
      case "{package.name}": return (firstPackage?.name || (items.map((i:any) => i.package?.name).filter(Boolean).join(', ')) || "").toUpperCase();
      case "{package.description}": return (firstPackage?.description || "").toUpperCase();
      case "{package.price}": return firstPackage?.price ? `RM ${firstPackage.price}` : "";
      case "{package.quantity}": return items.length > 0 ? (items[0].quantity ?? "") : "";
      case "{package.image_url}": return firstPackage?.image_url || "";
      case "{package.max_quantity}": return firstPackage?.max_quantity || "";
      case "{package.promotion_price}": return firstPackage?.promotion_price ? `RM ${firstPackage.promotion_price}` : "";
      case "{package.promotion_start_at}": return firstPackage?.promotion_start_at ? format(new Date(firstPackage.promotion_start_at), 'dd MMM yyyy') : "";
      case "{package.promotion_end_at}": return firstPackage?.promotion_end_at ? format(new Date(firstPackage.promotion_end_at), 'dd MMM yyyy') : "";
      case "{package.created_at}": return firstPackage?.created_at ? format(new Date(firstPackage.created_at), 'dd MMM yyyy') : "";
      case "{package.google_maps_link}": {
        const link = firstPackage?.google_maps_link || "";
        if (!link) return "";
        // If the link is already an HTML anchor tag, return it as is
        if (link.startsWith('<a')) return link;
        // Otherwise, wrap it in an anchor tag for auto-linking
        return `<a href="${link}" target="_blank" style="color: #2563eb; text-decoration: underline;">${link}</a>`;
      }
      
      case "{booking.items_text}":
        if (items && items.length > 0) {
          return items.map((item: any) => `- ${(item.package?.name || "").toUpperCase()} (Qty: ${item.quantity || ""}) - ${item.total_price ? `RM ${item.total_price}` : ""}`).join('\n');
        } else if (booking.package_details) {
          const pd = booking.package_details;
          return `- ${(pd.name || "").toUpperCase()} (Qty: 1) - ${booking.total_amount ? `RM ${booking.total_amount}` : ""}`;
        }
        return "";
      
      case "{add_items_amount}":
        if (items && items.length > 0) {
          return items.map((item: any, idx: number) => `
            <div style="margin-bottom: 1px; border: 1px solid #6b7280; border-radius: 6px; padding: 2px; background-color: transparent;">
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 1px; color: #111827; border-bottom: 1px solid #9ca3af; padding-bottom: 1px; line-height: 1.1;">
                 Item ${idx + 1}: ${(item.package?.name || "").toUpperCase()}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1; padding-right: 10px;">
                  ${item.package?.description ? `<div style="font-size: 14px; color: #666; margin-bottom: 1px; line-height: 1.1;">${item.package.description}</div>` : ''}
                  <div style="font-size: 14px; color: #555; line-height: 1.1;">Quantity: <span style="font-weight: 600;">${item.quantity || ""}</span> ${item.unit_price ? `× RM ${item.unit_price}` : ""}</div>
                </div>
                <div style="font-weight: bold; font-size: 14px; white-space: nowrap; line-height: 1.1;">${item.total_price ? `RM ${item.total_price}` : ""}</div>
              </div>
            </div>
          `).join('');
        } else if (booking.package_details) {
           // Fallback for legacy package_details structure
           const pd = booking.package_details;
           let html = `
            <div style="margin-bottom: 1px; border: 1px solid #6b7280; border-radius: 6px; padding: 2px; background-color: transparent;">
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 1px; color: #111827; border-bottom: 1px solid #9ca3af; padding-bottom: 1px; line-height: 1.1;">
                 Package: ${(pd.name || "").toUpperCase()}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1; padding-right: 10px;">
                  ${pd.description ? `<div style="font-size: 14px; color: #666; margin-bottom: 1px; line-height: 1.1;">${pd.description}</div>` : ''}
                  <div style="font-size: 14px; color: #555; line-height: 1.1;">Quantity: 1 ${pd.price ? `× RM ${pd.price}` : ""}</div>
                </div>
                <div style="font-weight: bold; font-size: 14px; white-space: nowrap; line-height: 1.1;">${pd.price ? `RM ${pd.price}` : ""}</div>
              </div>
           `;
           if (pd.addons && pd.addons.length > 0) {
              html += `<div style="border-top: 1px solid #e5e7eb; padding-top: 1px; margin-top: 1px;">
                <div style="font-size: 14px; font-weight: bold; text-transform: uppercase; color: #888; margin-bottom: 1px; line-height: 1.1;">Add-ons</div>
                ${pd.addons.map((addon: any) => `
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1px; font-size: 14px; line-height: 1.1;">
                    <div style="color: #444;">${(addon.name || "").toUpperCase()}</div>
                    <div style="font-weight: bold;">${addon.price ? `+ RM ${addon.price}` : ""}</div>
                  </div>
                `).join('')}
              </div>`;
           }
           html += `</div>`;
           return html;
        }
        return "";
  
      case "{passenger.name}": 
        // If a specific passenger is provided (e.g. for a certificate), return just their name
        if (passenger) return (passenger.name || "").toUpperCase();
        
        // If no specific passenger is provided (e.g. for an invoice), return a list of all passengers with details
        if (booking.booking_passengers && booking.booking_passengers.length > 0) {
           return booking.booking_passengers.map((p: any, idx: number) => `
             <div style="margin-bottom: 4px; border: 1px solid #6b7280; border-radius: 6px; padding: 6px; background-color: transparent;">
               <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #111827; border-bottom: 1px solid #9ca3af; padding-bottom: 2px; line-height: 1.1;">
                 Passenger ${idx + 1}: ${(p.name || "").toUpperCase()} (${(p.status || 'Passenger').toUpperCase()})
               </div>
               <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 13px; color: #374151; line-height: 1.2;">
                 <div><span style="font-weight: 600; color: #6b7280;">Type:</span> <span style="text-transform: uppercase;">${(p.type || "").toUpperCase()}</span></div>
                 <div><span style="font-weight: 600; color: #6b7280;">IC/Passport:</span> ${(p.ic_passport_number || "").toUpperCase()}</div>
                 <div><span style="font-weight: 600; color: #6b7280;">Nationality:</span> ${(p.country_of_origin || "").toUpperCase()}</div>
                 <div><span style="font-weight: 600; color: #6b7280;">Gender:</span> <span style="text-transform: uppercase;">${(p.gender || "").toUpperCase()}</span></div>
                 <div><span style="font-weight: 600; color: #6b7280;">Weight:</span> ${p.weight ? p.weight + ' kg' : ""}</div>
                 <div><span style="font-weight: 600; color: #6b7280;">Height:</span> ${p.height ? p.height + ' cm' : ""}</div>
               </div>
               ${(p.id_front_url || p.id_back_url) ? `
                 <div style="margin-top: 6px; border-top: 1px solid #e5e7eb; padding-top: 6px;">
                   <div style="font-weight: 600; font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">ID Documents</div>
                   <div style="display: flex; gap: 8px;">
                     ${p.id_front_url ? `
                       <div style="width: 120px; height: 80px; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden;">
                         <img src="${p.id_front_url}" style="width: 100%; height: 100%; object-fit: cover;" />
                       </div>
                     ` : ''}
                     ${p.id_back_url ? `
                       <div style="width: 120px; height: 80px; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden;">
                         <img src="${p.id_back_url}" style="width: 100%; height: 100%; object-fit: cover;" />
                       </div>
                     ` : ''}
                   </div>
                 </div>
               ` : ''}
             </div>
           `).join('');
        }
        return "";
      case "{passenger.type}": return (currentPassenger?.type || "").toUpperCase();
      case "{passenger.ic}": return (currentPassenger?.ic_passport_number || currentPassenger?.nric_number || "").toUpperCase();
      case "{passenger.ic_passport_number}": return (currentPassenger?.ic_passport_number || currentPassenger?.nric_number || "").toUpperCase();
      case "{passenger.ic_passport}": return (currentPassenger?.ic_passport_number || currentPassenger?.nric_number || "").toUpperCase();
      case "{passenger.passport}": return (currentPassenger?.ic_passport_number || currentPassenger?.nric_number || "").toUpperCase();
      case "{passenger.country}": return (currentPassenger?.country_of_origin || "").toUpperCase();
      case "{passenger.country_of_origin}": return (currentPassenger?.country_of_origin || "").toUpperCase();
      case "{passenger.weight}": return currentPassenger?.weight ? `${currentPassenger.weight} kg` : "";
      case "{passenger.height}": return currentPassenger?.height ? `${currentPassenger.height} cm` : "";
      case "{passenger.gender}": return (currentPassenger?.gender || "").toUpperCase();
      case "{passenger.status}": return (currentPassenger?.status || "Passenger").toUpperCase();
      case "{passenger.id_front_url}": return currentPassenger?.id_front_url || "";
      case "{passenger.id_back_url}": return currentPassenger?.id_back_url || "";
      case "{passenger.created_at}": return currentPassenger?.created_at ? format(new Date(currentPassenger.created_at), 'dd MMM yyyy HH:mm') : "";
  
      case "{flight.date}": return booking.flight_date ? format(new Date(booking.flight_date), 'EEEE d MMM yyyy') : "";
      case "{flight.time}": return (booking.flight_time || "").toUpperCase();
      case "{pilot.name}": return (booking.pilot_name || "").toUpperCase();
      case "{aircraft.registration}": return (booking.aircraft_registration || "").toUpperCase();
  
      // Legacy/Shortcuts
      case "{customer_name}": return (customer.name || "").toUpperCase();
      case "{customer_email}": return (customer.email || "").toUpperCase();
      case "{customer_phone}": return (customer.phone || "").toUpperCase();
      case "{booking_id}": return (booking.booking_reference || "").toUpperCase();
      case "{booking_reference}": return (booking.booking_reference || "").toUpperCase();
      case "{invoice_id}": return (booking.invoice_id || "").toUpperCase();
      case "{flight_date}": return booking.flight_date ? format(new Date(booking.flight_date), 'EEEE d MMM yyyy') : "";
      case "{flight_time}": return (booking.flight_time || "").toUpperCase();
      case "{minus_1hours}": return "1H";
      case "{package_name}": return (firstPackage?.name || "").toUpperCase();
      case "{total_amount}": return booking.total_amount ? `RM ${booking.total_amount}` : "";
      case "{paid_amount}": return booking.paid_amount ? `RM ${booking.paid_amount}` : "";
      case "{status}": return (booking.status || "").toUpperCase();
      case "{payment_status}": return (booking.payment_status || "").toUpperCase();
      case "{payment_method}": return (booking.payment_method || "").toUpperCase();
      case "{payment_type}": return (booking.payment_type || "").toUpperCase();
      case "{deposit}": {
        const dep = booking.deposit_amount;
        const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
        return val ? `RM ${val}` : "";
      }
      case "{discount}": return booking.discount_amount ? `RM ${booking.discount_amount}` : "RM 0.00";
      case "{deposit_amount}": {
        const dep = booking.deposit_amount;
        const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
        return val ? `RM ${val}` : "";
      }
      case "{discount_amount}": return booking.discount_amount ? `RM ${booking.discount_amount}` : "RM 0.00";
      case "{amount_to_pay}": {
        const dep = booking.deposit_amount;
        const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
        const amount = booking.payment_type === 'deposit' ? val : booking.total_amount;
        return amount ? `RM ${amount}` : "";
      }
      case "{booking.outstanding_balance}": {
        // Prioritize the database field if it exists, otherwise calculate it
        if (booking.outstanding_balance !== undefined && booking.outstanding_balance !== null) {
          return `RM ${booking.outstanding_balance}`;
        }
        const isFullPayment = booking.payment_type === 'full payment' || booking.payment_type === 'full';
        const balance = isFullPayment ? 0 : (booking.total_amount || 0) - (booking.deposit_amount || 0);
        return `RM ${balance}`;
      }
      case "{pilot_name}": return (booking.pilot_name || "").toUpperCase();
      case "{aircraft_registration}": return (booking.aircraft_registration || "").toUpperCase();
  
      // Registration Specific Variables
      case "{registration.id}": return (booking.registration_id || booking.booking_reference || "").toUpperCase();
      case "{registration.gender}": return (currentPassenger?.gender || "").toUpperCase();
      case "{registration.age}": return currentPassenger?.age || "";
      case "{registration.nric}": return (currentPassenger?.nric_number || currentPassenger?.ic_passport_number || "").toUpperCase();
      case "{registration.nric_number}": return (currentPassenger?.nric_number || currentPassenger?.ic_passport_number || "").toUpperCase();
      case "{registration.nationality}": return (currentPassenger?.country_of_origin || "").toUpperCase();
      case "{registration.weight}": return currentPassenger?.weight || "";
      case "{registration.address}": return (booking.customer?.address || "").toUpperCase();
    }
    return "";
  };

  const handleTestGenerate = async () => {
    if (!testBookingId) {
      toast.error("Please enter a Booking Reference or ID");
      return;
    }

    if (!currentTemplate && !editorContent) {
      toast.error("No active template or editor content found");
      return;
    }

    setIsGenerating(true);
    try {
      // 1. Fetch Booking Data
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
        .eq('booking_reference', testBookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error("Booking not found");
      }

      // 2. Get Template Content
      let templateHtml = editorContent;
      
      // If editor is empty but we have a current template file, download it
      if (!templateHtml && currentTemplate) {
        const { data, error } = await supabase.storage
          .from('media')
          .download(currentTemplate);
          
        if (error) throw error;
        templateHtml = await data.text();
      }

      if (!templateHtml) {
        throw new Error("Could not retrieve template content");
      }

      // 3. Replace Table Placeholders
      let processedHtml = templateHtml;
      
      if (tables.length > 0) {
        tables.forEach(table => {
          const tableHtml = generateTableHtml(table);
          // Replace {table.ID} with the generated HTML
          processedHtml = processedHtml.replace(new RegExp(`{table.${table.id}}`, 'g'), tableHtml);
        });
      }

      // 4. Replace Variables
      AVAILABLE_VARIABLES.forEach(category => {
        category.vars.forEach(variable => {
          const value = getVariableValue(variable, booking);
          // Global replace
          processedHtml = processedHtml.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        });
      });

      // 4. Generate PDF
      const element = document.createElement('div');
      
      // Add custom styles for background color alignment and table borders
      const customStyles = `
        <style>
          span[style*="background-color"] {
            padding-bottom: 3px;
            padding-top: 1px;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            line-height: 1.6;
          }
          /* Ensure table borders are thin */
          table, th, td {
            border-width: 0.2px !important;
          }
        </style>
      `;
      
      element.innerHTML = customStyles + processedHtml;
      
      // Add some basic styles to ensure it looks okay
      element.style.padding = '20px';
      element.style.fontFamily = 'Arial, sans-serif';
      
      const fileName = `${selectedType}_${booking.booking_reference}_${Date.now()}.pdf`;
      
      const opt = {
        margin:       0.5,
        filename:     fileName,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      // Generate Blob for upload
      const worker = html2pdf().from(element).set(opt).toPdf();
      const pdfBlob = await worker.output('blob');

      // 6. Upload to Storage
      const storagePath = `generated_documents/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(storagePath, pdfBlob, {
          contentType: 'application/pdf'
        });

      if (uploadError) throw uploadError;

      // 7. Save to Database
      const { error: dbError } = await supabase
        .from('generated_documents')
        .insert({
          booking_id: booking.booking_id,
          document_type: selectedType,
          file_path: storagePath,
          generated_at: new Date().toISOString()
        });

      if (dbError) throw dbError;

      // 8. Trigger Download for User
      worker.save();

      toast.success("PDF Generated, Saved & Downloaded");
      fetchHistory();

    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error(`Generation failed: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const modules = useMemo(() => {
    return {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'color': [] }, { 'background': [] }],
        [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
        ['link', 'image'],
        ['clean']
      ],
      clipboard: {
        matchVisual: false
      },
      imageResize: {
        parchment: Quill.import('parchment'),
        modules: ['Resize', 'DisplaySize']
      }
    };
  }, []);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'align', 'color', 'background',
    'width', 'height', 'style', 'alt',
    'table-container', 'table-head', 'table-body', 'table-row', 'table-header-cell', 'table-cell'
  ];

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 p-2 sm:p-4 overflow-x-hidden">
      <div className="lg:col-span-2 space-y-6 min-w-0">
        <Card className="overflow-hidden">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl">Template Management</CardTitle>
            <CardDescription className="text-sm">
              Upload and manage templates for generated PDF documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Upload New Template (Word)</Label>
                <div className="flex gap-2 sm:gap-4 items-center">
                  <Input 
                    type="file" 
                    accept=".docx,.doc,.html,.pdf"
                    onChange={handleUpload}
                    disabled={uploading}
                    className="flex-1 text-xs sm:text-sm h-9 sm:h-10"
                  />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                </div>
              </div>
            </div>

            {/* Editor Section */}
            {showEditor && (
              <>
                <div className={`space-y-4 border rounded-lg p-3 sm:p-4 bg-white overflow-hidden ${isPoppedOut ? 'hidden' : ''}`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">Template Editor</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleOpenTableDialog}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title="Insert Table"
                      >
                        <Table className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsPoppedOut(true)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title="Open in Full Screen"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button 
                      onClick={handleSaveEditorContent} 
                      disabled={saving} 
                      className="w-full sm:w-auto gap-2 gradient-event text-white hover:opacity-90 transition-all active:scale-[0.98] shadow-md shadow-event-pink/10 h-9 sm:h-10"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Template
                    </Button>
                  </div>
                  <div className="min-h-[300px] border rounded-md overflow-hidden bg-slate-50">
                     <ReactQuill 
                      ref={quillRef}
                      theme="snow"
                      value={editorContent}
                      onChange={setEditorContent}
                      modules={modules}
                      formats={formats}
                      className="h-[250px] sm:h-[350px] mb-14 sm:mb-12"
                     />
                  </div>
                </div>

                <Dialog open={isPoppedOut} onOpenChange={setIsPoppedOut}>
                  <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
                      <DialogTitle>Template Editor</DialogTitle>
                      <div className="flex items-center gap-2 pr-8">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleOpenTableDialog}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="Insert Table"
                        >
                          <Table className="h-4 w-4" />
                        </Button>
                        <Button 
                          onClick={handleSaveEditorContent} 
                          disabled={saving} 
                          size="sm"
                          className="gap-2 gradient-event text-white hover:opacity-90 transition-all active:scale-[0.98] shadow-md shadow-event-pink/10"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Template
                        </Button>
                      </div>
                    </DialogHeader>
                    <div className="flex-1 p-4 bg-slate-50 overflow-hidden flex flex-col">
                       <ReactQuill 
                        ref={quillRefPopped}
                        theme="snow"
                        value={editorContent}
                        onChange={setEditorContent}
                        modules={modules}
                        formats={formats}
                        className="flex-1 flex flex-col h-full [&>.ql-container]:flex-1 [&>.ql-container]:overflow-y-auto"
                       />
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
                  <DialogContent className="max-w-[900px] w-full max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Table Manager</DialogTitle>
            <DialogDescription>Create and manage independent data tables for your templates.</DialogDescription>
            <div className="mt-2 p-3 bg-blue-50 text-blue-700 rounded-md text-xs space-y-1 border border-blue-100">
              <p className="font-semibold flex items-center gap-1">
                <Info className="h-3 w-3" /> How to use:
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Create a <strong>New Table</strong> from the sidebar.</li>
                <li>Configure <strong>Rows</strong> and <strong>Columns</strong>, then edit the content in the grid below.</li>
                <li>Click <strong>Insert Placeholder</strong> to add a reference (e.g., <code>{`{table.1}`}</code>) to your template.</li>
                <li>The placeholder will be replaced with the actual styled table when the PDF is generated.</li>
              </ul>
            </div>
          </DialogHeader>
                    <div className="flex flex-1 overflow-hidden h-[600px]">
                      {/* Sidebar List */}
                      <div className="w-1/3 border-r bg-slate-50 p-4 flex flex-col gap-4 overflow-y-auto">
                        <Button onClick={handleAddTable} className="w-full gap-2">
                          <Plus className="h-4 w-4" /> New Table
                        </Button>
                        <div className="space-y-2">
                          {tables.map(table => (
                            <div 
                              key={table.id} 
                              className={`p-3 rounded-lg border cursor-pointer hover:bg-slate-100 transition-colors flex justify-between items-center ${currentTableId === table.id ? 'bg-white border-primary shadow-sm' : 'bg-white border-slate-200'}`}
                              onClick={() => setCurrentTableId(table.id)}
                            >
                              <div className="truncate font-medium text-sm">{table.name}</div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                onClick={(e) => { e.stopPropagation(); deleteTable(table.id); }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          {tables.length === 0 && (
                            <div className="text-center text-xs text-muted-foreground py-8">
                              No tables created yet.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Detail View */}
                      <div className="flex-1 p-6 overflow-y-auto bg-white">
                        {currentTableId ? (
                          (() => {
                            const table = tables.find(t => t.id === currentTableId);
                            if (!table) return null;
                            return (
                              <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                  <div className="flex-1 space-y-1">
                                    <Label>Table Name</Label>
                                    <Input 
                                      value={table.name} 
                                      onChange={(e) => handleUpdateTable(table.id, { name: e.target.value })} 
                                      className="border-gray-600"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label>Border Color</Label>
                                    <Select 
                                      value={table.borderColor || 'black'} 
                                      onValueChange={(value) => handleUpdateTable(table.id, { borderColor: value })}
                                    >
                                      <SelectTrigger className="border-gray-600">
                                        <SelectValue placeholder="Select Color" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="black">Black</SelectItem>
                                        <SelectItem value="gray">Gray</SelectItem>
                                        <SelectItem value="blue">Blue</SelectItem>
                                        <SelectItem value="red">Red</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Button 
                                    onClick={() => insertTablePlaceholder(table.id)}
                                    className="mt-6 gap-2 bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    <Plus className="h-4 w-4" /> Insert Placeholder
                                  </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <Label>Rows</Label>
                                    <Input 
                                      type="number" 
                                      min="1" 
                                      max="50" 
                                      value={table.rows} 
                                      onChange={(e) => handleUpdateTable(table.id, { rows: parseInt(e.target.value) || 1 })} 
                                      className="border-gray-600"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label>Columns</Label>
                                    <Input 
                                      type="number" 
                                      min="1" 
                                      max="10" 
                                      value={table.cols} 
                                      onChange={(e) => handleUpdateTable(table.id, { cols: parseInt(e.target.value) || 1 })} 
                                      className="border-gray-600"
                                    />
                                  </div>
                                </div>

                                <div className="border rounded-lg overflow-hidden">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-slate-100">
                                        <tr>
                                          {table.headers.map((header, colIndex) => (
                                            <th key={colIndex} className="border p-2 min-w-[150px]">
                                              <Input 
                                                value={header} 
                                                onChange={(e) => handleUpdateHeader(table.id, colIndex, e.target.value)}
                                                className="h-8 text-xs font-bold bg-white"
                                                placeholder={`Header ${colIndex + 1}`}
                                              />
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {table.data.map((row, rowIndex) => (
                                          <tr key={rowIndex}>
                                            {row.map((cell, colIndex) => (
                                              <td key={colIndex} className="border p-2">
                                                <Input 
                                                  value={cell} 
                                                  onChange={(e) => handleUpdateCell(table.id, rowIndex, colIndex, e.target.value)}
                                                  className="h-8 text-xs border-gray-600"
                                                />
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <Table className="h-12 w-12 opacity-20" />
                            <p>Select a table to edit or create a new one.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}

            <div className="space-y-4 border rounded-lg p-3 sm:p-4 bg-slate-50">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 w-full">
                  <h3 className="font-medium text-sm sm:text-base">Active Template</h3>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    {currentTemplate ? currentTemplate.split('/').pop() : "Using System Default"}
                  </p>
                </div>
                {currentTemplate && (
                  <Button variant="secondary" size="sm" onClick={() => updateTemplateSetting("")} className="w-full sm:w-auto border-slate-200 shadow-sm text-xs h-8">
                    Reset to Default
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Test Generation</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input 
                  placeholder="Booking Ref (e.g. BK-12345)" 
                  value={testBookingId}
                  onChange={(e) => setTestBookingId(e.target.value)}
                  className="flex-1 h-9 sm:h-10"
                />
                <Button 
                  onClick={handleTestGenerate} 
                  disabled={isGenerating || !testBookingId}
                  className="w-full sm:w-auto gap-2 gradient-event text-white hover:opacity-90 transition-all active:scale-[0.98] shadow-md shadow-event-pink/10 h-9 sm:h-10"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Test Generate
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Enter a booking reference to generate a sample PDF using the active template.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl truncate">Generated Documents</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Recent history.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={loadingHistory} className="shrink-0">
              <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <ScrollArea className="h-[400px] rounded-md border p-2 sm:p-4">
              {loadingHistory ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : history.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">No history found</div>
              ) : (
                <div className="space-y-3">
                  {history.map((doc) => (
                    <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow gap-3">
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className="p-2 bg-primary/10 rounded-full shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          <p className="font-medium text-sm capitalize truncate">
                            {doc.document_type.replace('_', ' ')}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground mt-0.5">
                            <span className="font-semibold text-primary shrink-0">{doc.bookings?.booking_reference}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="truncate">{doc.bookings?.customers?.name}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="shrink-0">{format(new Date(doc.generated_at), 'MMM d, HH:mm')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1 sm:gap-2 border-t sm:border-t-0 pt-2 sm:pt-0">
                        <Button variant="ghost" size="sm" onClick={() => downloadDoc(doc)} title="Download" className="h-8 w-8 p-0">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteDoc(doc)} title="Delete" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="h-fit">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Info className="h-5 w-5 shrink-0" />
              Variables Cheat Sheet
            </CardTitle>
            <CardDescription className="text-xs">
              Click to copy variables for your templates.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <ScrollArea className="h-[300px] lg:h-[700px] pr-4">
              <div className="space-y-6">
                {AVAILABLE_VARIABLES.map((category) => (
                  <div key={category.category} className="space-y-2">
                    <h4 className="font-semibold text-xs sm:text-sm text-gray-900">{category.category}</h4>
                    <div className="grid grid-cols-1 gap-1.5">
                      {category.vars.map((variable) => (
                        <div key={variable} className="bg-slate-100 p-2 rounded text-[10px] sm:text-xs font-mono flex justify-between items-center group cursor-pointer hover:bg-slate-200 transition-colors"
                             onClick={() => {
                               navigator.clipboard.writeText(variable);
                               toast.success(`Copied ${variable}`);
                             }}>
                          <span className="truncate mr-2">{variable}</span>
                          <span className="shrink-0 opacity-0 lg:group-hover:opacity-100 text-[10px] text-gray-500 bg-white/50 px-1 rounded">Copy</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
