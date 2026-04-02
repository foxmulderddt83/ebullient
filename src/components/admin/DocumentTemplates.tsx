import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compressFile } from "@/utils/fileCompression";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table as TableUI,
  TableBody as TableBodyUI,
  TableCell as TableCellUI,
  TableHead as TableHeadUI,
  TableHeader as TableHeaderUI,
  TableRow as TableRowUI,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, FileJson, Info, Download, Trash2, FileText, RefreshCw, Search, Save, Maximize2, Minimize2, Table, Plus, Upload, Code, Eye, Calculator, MoreVertical, Printer, Bold, Italic, Underline, ChevronUp, ChevronDown, Layers, Layout, Grid, FileBox, Monitor, X } from "lucide-react";
import { format } from "date-fns";
import ReactQuill, { Quill } from 'react-quill';
import { getVariableValue, AVAILABLE_VARIABLES } from "@/lib/pdfGenerator";
import ImageResize from 'quill-image-resize-module-react';
import 'react-quill/dist/quill.snow.css';
import mammoth from 'mammoth';

// Custom Image Blot to preserve resize attributes (width, height, style)
const BaseImage = Quill.import('formats/image');
const ATTRIBUTES = ['alt', 'height', 'width', 'style'];

class CustomImage extends BaseImage {
  static blotName = 'image';
  static tagName = 'img';

  static formats(domNode: HTMLElement) {
    return ATTRIBUTES.reduce((formats: any, attribute) => {
      if (domNode.hasAttribute(attribute)) {
        formats[attribute] = domNode.getAttribute(attribute);
      }
      return formats;
    }, {});
  }

  static create(value: any) {
    const node = super.create(value);
    // If value is a string, it's the src. 
    // If we want to store attributes in the value, we'd need to change how the delta is constructed.
    // But standard Image blot expects value to be a string (url).
    // The attributes are stored separately in the Delta 'attributes' field.
    return node;
  }

  static value(domNode: HTMLElement) {
    return domNode.getAttribute('src');
  }

  format(name: string, value: any) {
    if (ATTRIBUTES.indexOf(name) > -1) {
      if (value) {
        this.domNode.setAttribute(name, value);
      } else {
        this.domNode.removeAttribute(name);
      }
    } else {
      super.format(name, value);
    }
  }
}

Quill.register(CustomImage, true);
Quill.register('modules/imageResize', ImageResize);

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

import html2pdf from 'html2pdf.js';
import { logActivity } from "@/lib/activityLogger";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

// High-fidelity Visual HTML Editor using an iframe to isolate styles and display full documents properly
const VisualHtmlEditor = ({ 
  content, 
  onChange, 
  className,
  pageMargins = { left: 0, right: 0 },
  selectedFont = 'Arial, sans-serif',
  selectedSize = '14px'
}: { 
  content: string, 
  onChange: (val: string) => void, 
  className?: string,
  pageMargins?: { left: number, right: number },
  selectedFont?: string,
  selectedSize?: string
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contentRef = useRef(content);
  const isUpdatingRef = useRef(false);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Function to apply style to selection
  const applyStyle = (command: string, value: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument || win?.document;
    if (!doc || !win) return;
    
    // Restore focus to the iframe/window to ensure execCommand works on the selection
    win.focus();

    if (command === 'fontSize') {
      // execCommand fontSize only supports 1-7. For pixel sizes, we use a trick:
      // apply a temporary font size then replace it with a span with inline style
      doc.execCommand('fontSize', false, '7');
      const fontElements = Array.from(doc.getElementsByTagName('font'));
      fontElements.forEach(font => {
        if (font.size === '7') {
          const span = doc.createElement('span');
          span.style.fontSize = value;
          span.innerHTML = font.innerHTML;
          font.parentNode?.replaceChild(span, font);
        }
      });
      // Trigger update
      const event = new Event('input', { bubbles: true });
      doc.body.dispatchEvent(event);
    } else {
      doc.execCommand(command, false, value);
      // Trigger input event to update state
      const event = new Event('input', { bubbles: true });
      doc.body.dispatchEvent(event);
    }
  };

  // Effect to handle font changes
  useEffect(() => {
    if (selectedFont) applyStyle('fontName', selectedFont);
  }, [selectedFont]);

  // Effect to handle size changes
  useEffect(() => {
    if (selectedSize) applyStyle('fontSize', selectedSize);
  }, [selectedSize]);

  // Function to generate the CSS based on margins and content
  const getStyles = (margins: { left: number, right: number }, htmlContent: string) => {
    const hasPageA4 = htmlContent.includes('class="page-a4"') || htmlContent.includes("class='page-a4'");
    
    return `
    @page {
      size: A4;
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #f0f2f5;
      ${hasPageA4 ? 'display: flex; flex-direction: column; align-items: center;' : ''}
      font-family: Arial, sans-serif;
    }
    .page-a4 {
      background: white;
      width: 210mm;
      min-height: 297mm;
      padding: 0mm ${margins.right}mm 0mm ${margins.left}mm;
      margin: 20px auto;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      box-sizing: border-box;
      position: relative;
      visibility: visible !important;
      opacity: 1 !important;
      display: block !important;
      /* Visual page break indicator every 297mm */
      background-image: linear-gradient(to bottom, transparent calc(297mm - 1px), #e5e7eb calc(297mm - 1px), #e5e7eb 297mm);
      background-size: 100% 297mm;
    }
    /* Add a visual "Page Break" label on hover/print */
    .page-a4::after {
      content: 'Page Break';
      position: absolute;
      right: -80px;
      top: 297mm;
      font-size: 10px;
      color: #9ca3af;
      pointer-events: none;
    }
    a { pointer-events: none !important; cursor: default !important; text-decoration: none !important; }
    [contenteditable]:focus { outline: none; }
    img { max-width: 100%; height: auto; cursor: pointer; }
    img:hover { border: 1px dashed #3b82f6 !important; }
    img.selected { border: 2px solid #3b82f6 !important; }
    /* Fix for potential invisible content due to body styles */
    body > * { visibility: visible !important; opacity: 1 !important; }
  `;
  };

  // Update styles when margins or content change
  useEffect(() => {
    if (styleRef.current) {
      styleRef.current.textContent = getStyles(pageMargins, content);
    }
  }, [pageMargins.left, pageMargins.right, content]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // Helper to setup doc
    const setupDoc = (html: string) => {
      doc.open();
      doc.write(html || "<!DOCTYPE html><html><head></head><body></body></html>");
      doc.close();
      
      if (doc.body) {
        doc.body.contentEditable = "true";
        doc.body.style.minHeight = "100vh";
        doc.body.style.cursor = "text";
        doc.body.style.margin = "0";
        doc.body.style.padding = "20px";
      }

      // Check if style already exists
      let style = doc.getElementById('editor-styles') as HTMLStyleElement;
      if (!style) {
        style = doc.createElement('style');
        style.id = 'editor-styles';
        doc.head.appendChild(style);
      }
      
      style.textContent = getStyles(pageMargins, html);
      styleRef.current = style;

      // Add image resizing and selection logic
      doc.addEventListener('mousedown', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'IMG') {
          // Select image
          doc.querySelectorAll('img').forEach(img => img.classList.remove('selected'));
          target.classList.add('selected');
          
          const startX = e.clientX;
          const startY = e.clientY;
          const startWidth = target.offsetWidth;
          const startHeight = target.offsetHeight;
          
          const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            
            // Maintain aspect ratio or allow free resizing
            // For now, let's just do free resizing if they drag near corners
            // Simplified: if dragging, update width
            target.style.width = `${startWidth + dx}px`;
            target.style.height = 'auto'; // Keep aspect ratio
            
            // Trigger input to update content
            const inputEvent = new Event('input', { bubbles: true });
            doc.body.dispatchEvent(inputEvent);
          };
          
          const handleMouseUp = () => {
            doc.removeEventListener('mousemove', handleMouseMove);
            doc.removeEventListener('mouseup', handleMouseUp);
          };
          
          doc.addEventListener('mousemove', handleMouseMove);
          doc.addEventListener('mouseup', handleMouseUp);
        } else {
          doc.querySelectorAll('img').forEach(img => img.classList.remove('selected'));
        }
      });
    };

    // Only write if the document is empty or if content changed externally
    // We check doc.body instead of comparing content to avoid re-writing on every keystroke
    const isDocEmpty = !doc.body || doc.body.innerHTML === "";
    const isExternalChange = content !== contentRef.current && !isUpdatingRef.current;

    if (isDocEmpty || isExternalChange) {
      setupDoc(content);
      contentRef.current = content;
    }

    const handleInput = () => {
      isUpdatingRef.current = true;
      const newContent = doc.documentElement.outerHTML;
      const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}${doc.doctype.publicId ? ` PUBLIC "${doc.doctype.publicId}"` : ''}${doc.doctype.systemId ? ` "${doc.doctype.systemId}"` : ''}>\n` : '';
      const fullHtml = doctype + newContent;
      
      contentRef.current = fullHtml;
      onChange(fullHtml);
      
      // Reset the updating flag after a short delay
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 10);
    };

    doc.addEventListener('input', handleInput);
    
    return () => {
      doc.removeEventListener('input', handleInput);
    };
  }, [content, onChange]); 

  return (
    <div className={className} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <iframe 
        ref={iframeRef} 
        title="Visual HTML Editor"
        style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }}
      />
    </div>
  );
};

import { DOCUMENT_TYPES } from "@/lib/constants";

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

interface DocumentTemplate {
  id: string;
  name: string;
  document_type: string;
  content: string;
  is_default: boolean;
  created_at: string;
}

export default function DocumentTemplates() {
  const pdfApiUrl = import.meta.env.VITE_PDF_API_URL || 'https://oneday-whatsapp-bot.fly.dev';
  const [selectedType, setSelectedType] = useState<string>("invoice_paid");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<string | null>(null);
  const [templates, setTemplates] = useState<{name: string, url: string}[]>([]);
  const [templateList, setTemplateList] = useState<DocumentTemplate[]>([]);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [history, setHistory] = useState<GeneratedDoc[]>([]);
  const [testBookingId, setTestBookingId] = useState("");
  const [latestBookings, setLatestBookings] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedBookingData, setSelectedBookingData] = useState<any>(null);
  const [isLoadingBookingData, setIsLoadingBookingData] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  
  // Preview State
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewBooking, setPreviewBooking] = useState<any>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(window.innerWidth < 768 ? 0.4 : 0.8); // Default zoom level for preview
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');

  // Background Image State
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(0.15); // Default 15% opacity
  const [backgroundStyle, setBackgroundStyle] = useState<string>("center"); // Default center (contain)
  
  // Page Settings
  const [printPageMargins, setPrintPageMargins] = useState<string>('Normal');
  const [pageSize, setPageSize] = useState<string>('A4');
  const [pageMargins, setPageMargins] = useState<{ left: number, right: number }>({ left: 0, right: 0 });

  // Editor State
  const [editorContent, setEditorContent] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [isPoppedOut, setIsPoppedOut] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [selectedFont, setSelectedFont] = useState("Arial");
  const [selectedSize, setSelectedSize] = useState("14px");

  const FONTS = [
    { label: "Arial", value: "Arial, sans-serif" },
    { label: "Times New Roman", value: "'Times New Roman', serif" },
    { label: "Courier New", value: "'Courier New', monospace" },
    { label: "Calibri", value: "Calibri, sans-serif" },
    { label: "Georgia", value: "Georgia, serif" },
    { label: "Verdana", value: "Verdana, sans-serif" },
  ];

  const FONT_SIZES = ["10px", "11px", "12px", "14px", "16px", "18px", "20px", "24px", "32px"];

  const applyVisualCommand = (command: string, value: string) => {
    // Find all visual editor iframes
    const iframes = document.querySelectorAll('iframe[title="Visual HTML Editor"]');
    if (iframes.length === 0) return;
    
    // If we have multiple, the one in the dialog (popped out) is usually the last one in DOM
    // or we can check visibility
    let iframe = iframes[0] as HTMLIFrameElement;
    if (iframes.length > 1) {
      // Find the one that's actually visible or inside a dialog
      const visibleIframe = Array.from(iframes).find(f => {
        const rect = f.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) as HTMLIFrameElement;
      if (visibleIframe) iframe = visibleIframe;
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.execCommand(command, false, value);
    // Trigger input event
    const event = new Event('input', { bubbles: true });
    doc.body.dispatchEvent(event);
  };

  const handleFontChange = (fontValue: string) => {
    setSelectedFont(fontValue);
  };

  const handleSizeChange = (sizeValue: string) => {
    setSelectedSize(sizeValue);
  };

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
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressedFile = await compressFile(file);
      const fileName = `template_img_${Date.now()}_${file.name}`;
      const filePath = `templates/images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // Check if we are in VisualHtmlEditor mode or ReactQuill mode
      const isVisualEditor = editorContent.toLowerCase().includes('<!doctype') || 
                             editorContent.toLowerCase().includes('<html') || 
                             editorContent.toLowerCase().includes('<body');

      if (isVisualEditor && !isHtmlMode) {
        // Handle VisualHtmlEditor image insertion
        const iframes = document.querySelectorAll('iframe[title="Visual HTML Editor"]');
        let iframe = iframes[0] as HTMLIFrameElement;
        if (iframes.length > 1) {
          const visibleIframe = Array.from(iframes).find(f => {
            const rect = f.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }) as HTMLIFrameElement;
          if (visibleIframe) iframe = visibleIframe;
        }

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          iframe.contentWindow?.focus();
          // Insert image with a class for resizing and inline display
          const imgHtml = `<img src="${publicUrl}" class="template-image" style="max-width: 100%; height: auto; display: inline-block; cursor: nwse-resize; border: 1px dashed transparent;" />`;
          doc.execCommand('insertHTML', false, imgHtml);
          
          // Trigger input event
          const event = new Event('input', { bubbles: true });
          doc.body.dispatchEvent(event);
        }
      } else if (isHtmlMode) {
        // Just insert the img tag at current cursor position in textarea
        const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const text = textarea.value;
          const before = text.substring(0, start);
          const after = text.substring(end, text.length);
          const imgTag = `<img src="${publicUrl}" style="max-width: 100%; height: auto;" />`;
          setEditorContent(before + imgTag + after);
        }
      } else {
        // Handle ReactQuill image insertion
        const ref = isPoppedOut ? quillRefPopped : quillRef;
        if (ref.current) {
          const editor = ref.current.getEditor();
          const range = editor.getSelection() || { index: editor.getLength(), length: 0 };
          
          // Insert as inline image
          editor.insertEmbed(range.index, 'image', publicUrl);
          // Move cursor after image
          editor.setSelection(range.index + 1, 0);
        }
      }
      
      toast.success("Image inserted");
    } catch (error: any) {
      toast.error(`Image upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      if (event.target) event.target.value = '';
    }
  };

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
    fetchLatestBookings();
  }, [selectedType]);

  // Load current template content if it's an HTML file
  useEffect(() => {
    const loadTemplateContent = async () => {
      if (!currentTemplate || !supabase) return;
      
      // Only try to load content if it looks like an HTML file we generated
      if (currentTemplate.endsWith('.html')) {
        try {
          // 1. Load HTML Content
          const trimmedTemplate = currentTemplate.trim();
          const { data, error } = await supabase.storage
            .from('media')
            .download(trimmedTemplate);
            
          // Helper to parse margins - more flexible regex
          const parseMargins = (html: string) => {
            // Match padding: 20mm [right]mm 20mm [left]mm with optional spaces
            const match = html.match(/padding\s*:\s*20mm\s+(\d+)\s*mm\s+20mm\s+(\d+)\s*mm/i);
            if (match) {
              return { right: parseInt(match[1]), left: parseInt(match[2]) };
            }
            // Fallback for different padding formats if any
            return null;
          };

          if (error) {
            // Check for API key errors or 400 errors that might be due to auth/encoding
            if (error.message.includes('No API key found') || (error as any).status === 400) {
              // Retry with manual fetch if API key is missing or we get a 400 (auth/encoding issue)
              const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(trimmedTemplate);
              
              const response = await fetch(publicUrl, {
                headers: {
                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                }
              });
              
              if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
              const text = await response.text();
              setEditorContent(text);
              const parsed = parseMargins(text);
              if (parsed) setPageMargins(parsed);
              setShowEditor(true);
            } else {
              throw error;
            }
          } else {
            const text = await data.text();
            setEditorContent(text);
            const parsed = parseMargins(text);
            if (parsed) setPageMargins(parsed);
            setShowEditor(true);
          }

          // 2. Load Associated Tables JSON
          const jsonPath = trimmedTemplate.replace('.html', '.json');
          
          try {
            const { data: jsonData, error: jsonError } = await supabase.storage
              .from('media')
              .download(jsonPath);

            if (!jsonError && jsonData) {
              const jsonText = await jsonData.text();
              const loadedTables = JSON.parse(jsonText);
              setTables(Array.isArray(loadedTables) ? loadedTables : []);
            } else if (jsonError && (jsonError as any).status === 400) {
              // Retry with manual fetch only if we get a 400 (auth/encoding issue)
              const { data: { publicUrl: jsonPublicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(jsonPath);
              
              const jsonResponse = await fetch(jsonPublicUrl, {
                headers: {
                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                }
              });
              
              if (jsonResponse.ok) {
                const jsonText = await jsonResponse.text();
                const loadedTables = JSON.parse(jsonText);
                setTables(Array.isArray(loadedTables) ? loadedTables : []);
              } else {
                setTables([]);
              }
            } else if (jsonError && (jsonError as any).status === 404) {
              // 404 is expected for legacy templates, just use empty tables
              setTables([]);
            } else {
              // Any other error (including unexpected ones), just use empty tables
              setTables([]);
            }
          } catch (e) {
            console.warn("JSON template not found or invalid (legacy template?):", e);
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
      let { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('document_type', selectedType)
        .order('created_at', { ascending: false });

      // Fallback for certificate -> flight certificate
      if (selectedType === 'certificate') {
        const { data: legacyData } = await supabase
          .from('document_templates')
          .select('*')
          .eq('document_type', 'flight certificate')
          .order('created_at', { ascending: false });
        if (legacyData && legacyData.length > 0) {
          data = [...(data || []), ...(legacyData || [])];
        }
      }

      if (error) throw error;
      setTemplateList(data || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      // Fallback to storage if table doesn't exist yet
      try {
        const { data, error: storageError } = await supabase.storage
          .from('media')
          .list('templates', {
            limit: 100,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
          });

        if (storageError) throw storageError;

        const templatesWithUrls = await Promise.all((data || []).map(async (file) => {
          const { data: { publicUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(`templates/${file.name}`);
          return { name: file.name, url: publicUrl };
        }));

        setTemplates(templatesWithUrls);
      } catch (e) {
        console.warn("Storage fallback failed too", e);
      }
    }
  };

  const fetchCurrentSetting = async () => {
    if (!supabase) return;

    // Reset editor state when switching document types to ensure a clean refresh
    setEditorContent("");
    setCurrentTemplate(null);
    setShowEditor(false);
    setBackgroundImage("");
    setTables([]);
    setIsLoadingTemplate(true);
    setShowPreview(false);
    setPreviewHtml("");

    try {
      // Fetch Background & Page Settings (always, for both modern and legacy)
      const settingsKey = `template_${selectedType}_settings`;

      const { data: settingsData, error: settingsError } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', settingsKey)
        .maybeSingle();

      if (!settingsError && settingsData) {
        try {
          const settings = JSON.parse(settingsData.value);
          setBackgroundImage(settings.url || "");
          setBackgroundOpacity(settings.opacity !== undefined ? settings.opacity : 0.15);
          setBackgroundStyle(settings.style || "center");
          if (settings.pageMargins) {
            setPageMargins(settings.pageMargins);
          }
        } catch (e) {
          console.error("Error parsing template settings:", e);
        }
      } else {
        // Fallback for legacy background settings
        const { data: bgData, error: bgError } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', `template_${selectedType}_bg`)
          .maybeSingle();

        if (!bgError && bgData) {
          try {
            const settings = JSON.parse(bgData.value);
            setBackgroundImage(settings.url || "");
            setBackgroundOpacity(settings.opacity !== undefined ? settings.opacity : 0.15);
            setBackgroundStyle(settings.style || "center");
          } catch (e) {
            console.error("Error parsing background settings:", e);
          }
        } else {
          // Reset to defaults if no settings found
          setBackgroundImage("");
          setBackgroundOpacity(0.15);
          setBackgroundStyle("center");
          setPageMargins({ left: 0, right: 0 });
        }
      }

    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoadingTemplate(false);
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

  const fetchLatestBookings = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('booking_reference, booking_id, created_at, flight_date, customer:customers(name)')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setLatestBookings(data || []);
    } catch (error) {
      console.error('Error fetching latest bookings:', error);
    }
  };

  useEffect(() => {
    const fetchBookingDetails = async () => {
      if (!testBookingId || !supabase) {
        setSelectedBookingData(null);
        return;
      }
      
      setIsLoadingBookingData(true);
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            customer:customers(*),
            booking_passengers(*),
            booking_items(
              *,
              package:packages(*)
            )
          `)
          .eq('booking_reference', testBookingId)
          .single();
          
        if (!error) {
          setSelectedBookingData(data);
        } else {
          console.error("Supabase error fetching booking details:", error);
          setSelectedBookingData(null);
        }
      } catch (e) {
        console.error("Error fetching booking details for variables:", e);
        setSelectedBookingData(null);
      } finally {
        setIsLoadingBookingData(false);
      }
    };
    
    fetchBookingDetails();
  }, [testBookingId]);

  const wrapInA4 = (content: string) => {
    // If it's a full HTML document, preserve it as is
    if (content.toLowerCase().includes('<html') || content.toLowerCase().includes('<!doctype')) {
      return content;
    }

    // Check if content already contains a page-a4 wrapper
    if (content.includes('class="page-a4"') || content.includes("class='page-a4'")) {
      // Wrap in full HTML to ensure VisualHtmlEditor is triggered
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body>
${content}
</body>
</html>`;
    }
    
    // Simple wrap for partial HTML or snippets
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body>
<div class="page-a4" style="padding: 0mm ${pageMargins.right}mm 0mm ${pageMargins.left}mm;">${content}</div>
</body>
</html>`;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt || '');
    const limit = isImage ? 1 * 1024 * 1024 : 5 * 1024 * 1024;
    const limitLabel = isImage ? "1MB" : "5MB";

    // Check file size (1MB images, 5MB documents)
    if (file.size > limit) {
      toast.error(`File is too large. Max ${limitLabel} allowed.`);
      event.target.value = ''; // Reset input
      return;
    }

    if (fileExt === 'docx' || fileExt === 'doc') {
      // Handle Word Document - Convert to HTML for editing
      setUploading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setEditorContent(wrapInA4(result.value));
        setShowEditor(true);
        toast.success("Word document converted to HTML. You can now edit and save it.");
      } catch (error: any) {
        console.error("Mammoth conversion error:", error);
        toast.error(`Conversion failed: ${error.message}`);
      } finally {
        setUploading(false);
      }
    } else if (fileExt === 'html') {
      // Handle HTML Document - Read exactly as it is for editing
      setUploading(true);
      const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            setEditorContent(wrapInA4(content));
            setShowEditor(true);
            setIsHtmlMode(false); // Default to visual editor for .html files so it displays rendered HTML
            setUploading(false);
            
            // Check if it's a full document or just a snippet to provide accurate feedback
            const isFullDoc = content.toLowerCase().includes('<html') || content.toLowerCase().includes('<!doctype');
            if (isFullDoc) {
              toast.success("Full HTML template loaded. Your original formatting and styles are preserved.");
            } else {
              toast.success("HTML snippet loaded with A4 styling. You can now edit it visually.");
            }
          };
      reader.onerror = () => {
        setUploading(false);
        toast.error("Failed to read HTML file");
      };
      reader.readAsText(file);
    } else {
      // Original upload logic for other files
      setUploading(true);
      try {
        const compressedFile = await compressFile(file);
        const fileName = `${selectedType}_${Date.now()}.${fileExt}`;
        const filePath = `templates/${fileName}`;

        const { error } = await supabase.storage
          .from('media')
          .upload(filePath, compressedFile);

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

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];

    // Check file size (1MB limit for background images)
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Background image size exceeds the 1MB limit.");
      event.target.value = ''; // Reset input
      return;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    setUploading(true);
    try {
      const compressedFile = await compressFile(file);
      const fileName = `bg_${selectedType}_${Date.now()}.${fileExt}`;
      const filePath = `backgrounds/${fileName}`;

      const { error } = await supabase.storage
        .from('media')
        .upload(filePath, compressedFile);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      setBackgroundImage(publicUrl);
      toast.success("Background image uploaded");
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveEditorContent = async () => {
    if (!editorContent) {
      toast.error("No content to save");
      return;
    }
    
    setSaving(true);
    try {
      // 1. Determine template name
      let templateName = "";
      
      // If we are editing an existing template from the list, suggest its name
      const existingTemplate = templateList.find(t => t.name === currentTemplate);
      
      const promptName = prompt(
        "Enter a name for this template:", 
        existingTemplate ? existingTemplate.name : (currentTemplate || `${selectedType}_template`)
      );
      
      if (promptName === null) {
        setSaving(false);
        return; // User cancelled
      }
      
      templateName = promptName.trim() || `${selectedType}_template_${Date.now()}`;

      // 2. Save to document_templates table
      // Find the template with this name to get its ID for overwrite
      const targetTemplate = templateList.find(t => t.name === templateName);
      const isFirst = templateList.length === 0;
      
      const { data: savedTemplate, error: dbError } = await supabase
        .from('document_templates')
        .upsert({
          id: targetTemplate?.id, // If template with this name exists, use its ID to overwrite
          name: templateName,
          document_type: selectedType,
          content: editorContent,
          is_default: targetTemplate ? targetTemplate.is_default : isFirst // Keep existing default status or set as default if first
        }, { onConflict: 'id' }) // Use 'id' for conflict resolution
        .select()
        .single();

      if (dbError) throw dbError;

      // 3. Save Background & Page Settings (keep legacy behavior)
      const settingsObj = { 
        url: backgroundImage, 
        opacity: backgroundOpacity,
        style: backgroundStyle,
        pageMargins: pageMargins
      };
      
      await supabase
        .from('site_settings')
        .upsert({ 
          key: `template_${selectedType}_settings`, 
          value: JSON.stringify(settingsObj),
          category: 'templates',
          description: `Settings for ${selectedType} (bg, margins)`
        });

      // 4. Update state
      setCurrentTemplate(templateName);
      fetchTemplates();
      toast.success(`Template "${templateName}" saved successfully`);
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(`Failed to save template: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTemplate = (template: any) => {
    // 1. First "click": Immediate display in editor
    setCurrentTemplate(template.name);
    const contentToEdit = wrapInA4(template.content);
    setEditorContent(contentToEdit);
    setShowEditor(true);
    
    // 2. Second "click" effect after 1 second: "auto-load" with visual feedback
    setTimeout(() => {
      setIsLoadingTemplate(true);
      
      // Triggering a "refresh" of the editor content after the delay
      // This ensures any iframe or external components are fully initialized
      setEditorContent(contentToEdit);
      
      // Keep loader visible for a brief moment for visual confirmation of "loading"
      setTimeout(() => {
        setIsLoadingTemplate(false);
      }, 800);
    }, 1000);
  };

  const handleSetDefaultTemplate = async (templateId: string) => {
    if (!supabase) return;
    
    setSaving(true);
    try {
      // 1. Reset all templates for this type to is_default = false
      const { error: resetError } = await supabase
        .from('document_templates')
        .update({ is_default: false })
        .eq('document_type', selectedType);

      if (resetError) throw resetError;

      // 2. Set selected template to is_default = true
      const { error: setError } = await supabase
        .from('document_templates')
        .update({ is_default: true })
        .eq('id', templateId);

      if (setError) throw setError;

      // 3. Update site_settings for legacy support
      const template = templateList.find(t => t.id === templateId);
      if (template) {
        await updateTemplateSetting(template.name);
      }

      toast.success("Default template updated");
      fetchTemplates();
    } catch (error: any) {
      toast.error(`Failed to set default: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!supabase || !confirm("Are you sure you want to delete this template?")) return;

    try {
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast.success("Template deleted");
      setSelectedTemplateIds(prev => prev.filter(id => id !== templateId));
      fetchTemplates();
    } catch (error: any) {
      toast.error(`Delete failed: ${error.message}`);
    }
  };

  const handleBulkDeleteTemplates = async () => {
    if (!supabase || selectedTemplateIds.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedTemplateIds.length} selected template(s)?`)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .in('id', selectedTemplateIds);

      if (error) throw error;

      toast.success(`${selectedTemplateIds.length} template(s) deleted`);
      setSelectedTemplateIds([]);
      fetchTemplates();
    } catch (error: any) {
      toast.error(`Bulk delete failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTemplateSelection = (id: string) => {
    setSelectedTemplateIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllTemplates = () => {
    if (selectedTemplateIds.length === templateList.length && templateList.length > 0) {
      setSelectedTemplateIds([]);
    } else {
      setSelectedTemplateIds(templateList.map(t => t.id));
    }
  };

  const handleRenameTemplate = async (templateId: string, newName: string) => {
    if (!supabase || !newName) return;

    try {
      const { error } = await supabase
        .from('document_templates')
        .update({ name: newName })
        .eq('id', templateId);

      if (error) throw error;

      toast.success("Template renamed");
      setIsRenaming(null);
      fetchTemplates();
    } catch (error: any) {
      toast.error(`Rename failed: ${error.message}`);
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
      logActivity(supabase, 'update', 'site_settings', `template_${selectedType}`, { value: path });
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
      
      if (error) {
        if (error.message.includes('No API key found') || (error as any).status === 400) {
          const { data: { publicUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(doc.file_path);
          
          const response = await fetch(publicUrl, {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
            }
          });
          
          if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${doc.document_type}_${doc.bookings?.booking_reference || doc.id}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          return;
        }
        throw error;
      }
      
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
      logActivity(supabase, 'delete', 'generated_documents', doc.id, { file_path: doc.file_path });
      fetchHistory();
    } catch (error: any) {
      toast.error(`Delete failed: ${error.message}`);
    }
  };

  const handleBulkDelete = async (duration: '1week' | '1month') => {
    if (!supabase) return;

    const thresholdDate = new Date();
    if (duration === '1week') {
      thresholdDate.setDate(thresholdDate.getDate() - 7);
    } else {
      thresholdDate.setMonth(thresholdDate.getMonth() - 1);
    }

    const durationText = duration === '1week' ? '1 week' : '1 month';

    if (!confirm(`Are you sure you want to delete all generated documents older than ${durationText}? This action cannot be undone.`)) return;

    setLoadingHistory(true);
    try {
      // 1. Fetch documents to delete
      const { data: docsToDelete, error: fetchError } = await supabase
        .from('generated_documents')
        .select('id, file_path')
        .lt('generated_at', thresholdDate.toISOString());

      if (fetchError) throw fetchError;

      if (!docsToDelete || docsToDelete.length === 0) {
        toast.info(`No documents older than ${durationText} found.`);
        return;
      }

      // 2. Delete files from storage
      const filePaths = docsToDelete.map(doc => doc.file_path).filter(Boolean);
      // Supabase storage remove accepts array of strings, max 1000 items usually, but let's assume it handles typical batch sizes or iterate if needed.
      // For safety, let's chunk if necessary, but for now simple call.
      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('media')
          .remove(filePaths);
        
        if (storageError) console.warn("Storage deletion warning:", storageError);
      }

      // 3. Delete records from database
      const ids = docsToDelete.map(doc => doc.id);
      const { error: deleteError } = await supabase
        .from('generated_documents')
        .delete()
        .in('id', ids);

      if (deleteError) throw deleteError;

      toast.success(`Successfully deleted ${docsToDelete.length} documents older than ${durationText}.`);
      fetchHistory();
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      toast.error(`Failed to delete documents: ${error.message}`);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleBulkDeleteSelectedDocs = async () => {
    if (!supabase || selectedDocIds.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedDocIds.length} selected documents? This will also remove the files from storage.`)) return;

    setLoadingHistory(true);
    try {
      // 1. Fetch documents to delete their file paths
      const { data: docsToDelete, error: fetchError } = await supabase
        .from('generated_documents')
        .select('id, file_path')
        .in('id', selectedDocIds);

      if (fetchError) throw fetchError;

      if (!docsToDelete || docsToDelete.length === 0) {
        toast.info(`No documents found for deletion.`);
        return;
      }

      // 2. Delete files from storage
      const filePaths = docsToDelete.map(doc => doc.file_path).filter(Boolean);
      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('media')
          .remove(filePaths);
        
        if (storageError) console.warn("Storage deletion warning:", storageError);
      }

      // 3. Delete records from database
      const { error: deleteError } = await supabase
        .from('generated_documents')
        .delete()
        .in('id', selectedDocIds);

      if (deleteError) throw deleteError;

      toast.success(`Successfully deleted ${selectedDocIds.length} documents.`);
      logActivity(supabase, 'bulk_delete', 'generated_documents', selectedDocIds.join(','), { count: selectedDocIds.length });
      setSelectedDocIds([]);
      fetchHistory();
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      toast.error(`Failed to delete documents: ${error.message}`);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllDocs = () => {
    if (selectedDocIds.length === history.length && history.length > 0) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(history.map(doc => doc.id));
    }
  };

  const handlePrint = () => {
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

  const handleDownloadPDF = async () => {
    if (!previewHtml || !previewBooking) return;
    
    setIsGenerating(true);
    try {
      const element = document.createElement('div');
      
      const isLandscape = printOrientation === 'landscape';
      const isA4 = pageSize === 'A4';
      
      const widthMm = isLandscape ? (isA4 ? 297 : 279.4) : (isA4 ? 210 : 215.9);
      const heightMm = isLandscape ? (isA4 ? 210 : 215.9) : (isA4 ? 297 : 279.4);
      const windowW = isLandscape ? (isA4 ? 1122.5 : 1056) : (isA4 ? 793.7 : 816);

      const marginVal = printPageMargins === 'Normal' ? '20mm' : printPageMargins === 'Narrow' ? '10mm' : '0';

      // Enforce standard styles for PDF generation
      const pdfStyles = `
        <style>
          .pdf-container {
            width: ${widthMm}mm;
            min-height: ${heightMm}mm;
            padding: ${marginVal};
            background: white;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            font-family: Arial, sans-serif;
            color: #333;
            line-height: 1.5;
            text-align: left;
          }
          .pdf-container * {
            box-sizing: border-box;
          }
          span[style*="background-color"] {
            padding-bottom: 3px;
            padding-top: 1px;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            line-height: 1.6;
          }
          /* Thin borders for tables */
          table, th, td {
            border: 0.2px solid #ddd !important;
            border-collapse: collapse;
          }
          th, td {
            padding: 8px;
          }
          
          /* Alignment Styles */
          .ql-align-center { text-align: center; }
          .ql-align-right { text-align: right; }
          .ql-align-justify { text-align: justify; }

          /* Image Alignment & Spacing */
          .ql-align-center img { display: block; margin: 0 auto; }
          .ql-align-right img { display: block; margin-left: auto; margin-right: 0; }
          img { max-width: 100%; height: auto; }
          
          /* Paragraph Spacing */
          p { margin-bottom: 0.5em; min-height: 1em; }
          
          /* Preserve Whitespace */
          .ql-editor { white-space: pre-wrap; }

          /* Visual page break indicator for PDF */
          .page-break {
            page-break-after: always;
            height: 0;
            margin: 0;
            padding: 0;
            border: none;
          }
        </style>
      `;
      
      // Extract content from previewHtml to avoid double padding/margins
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = previewHtml;
      const a4Container = tempDiv.querySelector('.a4-container');
      const contentToRender = a4Container ? a4Container.innerHTML : previewHtml;

      element.innerHTML = pdfStyles + `<div class="pdf-container">${contentToRender}</div>`;
      
      const fileName = `${selectedType}_${previewBooking.booking_reference}_${Date.now()}.pdf`;
      
      const opt = {
        margin:       0,
        filename:     fileName,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true,
          letterRendering: true,
          width: windowW,
        },
        jsPDF:        { unit: 'mm' as const, format: pageSize.toLowerCase() as any, orientation: printOrientation }
      };

      // Generate Blob for upload
      const worker = html2pdf().from(element).set(opt).toPdf();
      const pdfBlob = await worker.output('blob');

      // 5. Upload to Storage
      const storagePath = `generated_documents/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(storagePath, pdfBlob, {
          contentType: 'application/pdf'
        });

      if (uploadError) throw uploadError;

      // 6. Save to Database
      const { error: dbError } = await supabase
        .from('generated_documents')
        .insert({
          booking_id: previewBooking.booking_id,
          document_type: selectedType,
          file_path: storagePath,
          generated_at: new Date().toISOString()
        });

      if (dbError) throw dbError;

      // 7. Trigger Download for User
      worker.save();

      toast.success("PDF Generated, Saved & Downloaded");
      fetchHistory();
      setShowPreview(false);

    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error(`Generation failed: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
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
          booking_passengers(*),
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
          
        if (error) {
          if (error.message.includes('No API key found') || (error as any).status === 400) {
            const { data: { publicUrl } } = supabase.storage
              .from('media')
              .getPublicUrl(currentTemplate);
            
            const response = await fetch(publicUrl, {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
              }
            });
            
            if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
            templateHtml = await response.text();
          } else {
            throw error;
          }
        } else {
          templateHtml = await data.text();
        }
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

      // 3.5 Process Formulas (sum(...))
      // Supports: sum({total.paid} - {deposit})
      // Supports Time Arithmetic: sum({booking.flight_time} - {minus_1hours})
      processedHtml = processedHtml.replace(/sum\((.*?)\)/g, (match, expression) => {
        try {
          // 1. Strip HTML tags from the expression and replace variables
          let evalExpr = expression.replace(/<[^>]*>?/gm, '').trim();
          let isTimeCalc = false;
          let hasCurrency = false;

          // Find all {variable} patterns
          evalExpr = evalExpr.replace(/\{[^}]+\}/g, (varMatch) => {
             // Use getVariableValue to match pdfGenerator behavior (which may return "RM 123")
             const val = getVariableValue(varMatch, booking);
             
             // Handle potential non-numeric returns from default case or time strings
             if (val === undefined || val === null) return "0";
             const valStr = val.toString().trim();
             
             if (/^RM\s*/i.test(valStr)) {
               hasCurrency = true;
             }
             
             let cleanVal = valStr.replace(/^RM\s*/i, '').trim();
             if (cleanVal === "") cleanVal = "0";
             
             // Check if it's a time string (HH:mm, HH:mmam/pm) or a relative time (1h)
             if (cleanVal.includes(':') || /^\d+h$/.test(cleanVal)) {
               isTimeCalc = true;
               // Convert to minutes
               if (cleanVal.includes(':')) {
                  // Handle HH:mm and HH:mmAM/PM
                  const timeMatch = cleanVal.match(/(\d+):(\d+)\s*(am|pm)?/i);
                  if (timeMatch) {
                    let h = parseInt(timeMatch[1]);
                    const m = parseInt(timeMatch[2]);
                    const period = timeMatch[3]?.toLowerCase();
                    if (period === 'pm' && h < 12) h += 12;
                    if (period === 'am' && h === 12) h = 0;
                    return (h * 60 + m).toString();
                  }
               } else if (/^\d+h$/.test(cleanVal)) {
                  // Handle 1h, 2h, etc.
                  return (parseInt(cleanVal) * 60).toString();
               }
             }
             return cleanVal;
          });
          
          // 2. Sanitize: allow digits, ., +, -, *, /, (, ), and spaces
          // We must be strict to avoid injection
          if (!/^[\d+\-*/().\s]+$/.test(evalExpr)) {
            console.warn("Invalid characters in formula:", evalExpr);
            return match; // Return original if unsafe
          }
          
          // 3. Evaluate safely
          const result = new Function(`return ${evalExpr}`)();
          
          // 4. Return formatted result
          if (isTimeCalc && typeof result === 'number') {
             // Convert back to time (HH:mm)
             // Handle overflow/underflow (e.g. 00:00 - 1h -> 23:00)
             let mins = Math.round(result) % 1440;
             if (mins < 0) mins += 1440;
             const h = Math.floor(mins / 60);
             const m = mins % 60;
             
             // Return in standard AM/PM format
             const period = h >= 12 ? 'pm' : 'am';
             const displayH = h % 12 === 0 ? 12 : h % 12;
             return `${displayH}:${m.toString().padStart(2, '0')}${period}`;
          }

          if (typeof result === 'number') {
             // Check if it has decimals
             const formatted = result % 1 !== 0 ? result.toFixed(2) : result.toString();
             return hasCurrency ? `RM ${formatted}` : formatted;
          }
          return result;
        } catch (e) {
          console.error("Formula error:", e);
          return match;
        }
      });

      // 4. Replace Variables
      AVAILABLE_VARIABLES.forEach(category => {
        category.vars.forEach(variable => {
          const value = getVariableValue(variable, booking);
          // Global replace with proper regex escaping
          const escapedVar = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          processedHtml = processedHtml.replace(new RegExp(escapedVar, 'g'), value);
        });
      });

      // 4. Set Preview
      // Wrap content with background image if set
      let finalHtml = processedHtml;
      
      // Enforce A4 standard styles for preview
      const a4Styles = `
        <style>
          .a4-container {
            width: 210mm;
            min-height: 297mm;
            padding: 0mm ${pageMargins.right}mm 0mm ${pageMargins.left}mm;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            font-family: Arial, sans-serif;
            color: #333;
            line-height: 1.5;
            text-align: left;
            transform-origin: top center;
          }
          @media screen and (max-width: 768px) {
            .a4-container {
              width: 100%;
              min-height: auto;
              padding: 10mm 10mm 10mm 5mm;
              transform: none !important;
              box-shadow: none;
            }
          }
          .a4-container * {
            box-sizing: border-box;
          }
          .ql-align-center { text-align: center; }
          .ql-align-right { text-align: right; }
          .ql-align-justify { text-align: justify; }
          img { max-width: 100%; height: auto; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          p { margin-bottom: 0.5em; min-height: 1em; }
          @media print {
            body { margin: 0; padding: 0; }
            .a4-container { box-shadow: none; margin: 0; width: 100%; height: 100%; }
          }
        </style>
      `;

      if (backgroundImage) {
        let bgStyleCss = "";
        
        switch (backgroundStyle) {
          case "stretch":
            bgStyleCss = `
              background-size: 100% 100%;
              background-position: center;
              background-repeat: no-repeat;
            `;
            break;
          case "tile":
            bgStyleCss = `
              background-size: auto;
              background-position: top left;
              background-repeat: repeat;
            `;
            break;
          case "center": // Center (Contain)
          default:
            bgStyleCss = `
              background-size: contain;
              background-position: center;
              background-repeat: no-repeat;
            `;
            break;
        }

        finalHtml = `
          ${a4Styles}
          <div class="a4-container">
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-image: url('${backgroundImage}');
              opacity: ${backgroundOpacity};
              z-index: 0;
              pointer-events: none;
              ${bgStyleCss}
            "></div>
            <div style="position: relative; z-index: 1;">
              ${processedHtml}
            </div>
          </div>
        `;
      } else {
        finalHtml = `
          ${a4Styles}
          <div class="a4-container">
            ${processedHtml}
          </div>
        `;
      }

      setPreviewHtml(finalHtml);
      setPreviewBooking(booking);
      setShowPreview(true);
      toast.success("Preview generated");

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
        [{ 'align': [] }],
        [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
        ['link', 'image'],
        ['clean']
      ],
      clipboard: {
        matchVisual: false,
        matchers: [
          ['img', (node: HTMLElement, delta: any) => {
            const style = node.getAttribute('style');
            const width = node.getAttribute('width');
            const height = node.getAttribute('height');
            
            if (delta.ops && delta.ops.length > 0) {
              delta.ops.forEach((op: any) => {
                if (op.insert && op.insert.image) {
                  op.attributes = op.attributes || {};
                  if (style) op.attributes.style = style;
                  if (width) op.attributes.width = width;
                  if (height) op.attributes.height = height;
                }
              });
            }
            return delta;
          }]
        ]
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
    'link', 'image',
    'width', 'height', 'style', 'alt',
    'table-container', 'table-head', 'table-body', 'table-row', 'table-header-cell', 'table-cell',
    'background', 'color', 'align'
  ];

  const [variableSearch, setVariableSearch] = useState("");

  const filteredVariables = useMemo(() => {
    if (!variableSearch) return AVAILABLE_VARIABLES;
    const search = variableSearch.toLowerCase();
    return AVAILABLE_VARIABLES.map(category => ({
      ...category,
      vars: category.vars.filter(v => v.toLowerCase().includes(search))
    })).filter(category => category.vars.length > 0);
  }, [variableSearch]);

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 p-2 sm:p-4 overflow-x-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="lg:col-span-2 space-y-6 min-w-0">
        <Card className="overflow-hidden border-none bg-white/50 backdrop-blur-sm shadow-xl shadow-primary/10 rounded-[2.5rem] transition-all duration-500 hover:shadow-2xl hover:shadow-primary/20">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-8 border-b border-black/5">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg text-slate-900 font-black tracking-tight uppercase">Template Management</CardTitle>
                  <CardDescription className="text-[11px] sm:text-xs font-medium text-slate-900 mt-1">
                    Upload and manage templates for generated PDF documents.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-8 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <Label className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-primary">Document Type</Label>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{DOCUMENT_TYPES.length} Types</span>
                </div>
                
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-full h-14 border-black rounded-2xl bg-slate-50/50 focus:ring-2 focus:ring-primary transition-all text-[11px] sm:text-xs font-black uppercase tracking-widest">
                    <SelectValue placeholder="Select Document Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-black shadow-2xl">
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem 
                        key={type.value} 
                        value={type.value}
                        className="px-6 py-3 font-black uppercase tracking-widest text-[10px] cursor-pointer focus:bg-primary focus:text-white"
                      >
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-primary ml-1">Upload New Template</Label>
                <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 ml-1 mt-1">Support DOCX, DOC, HTML, PDF (Max 5MB), JPG, PNG (Max 1MB)</p>
                <div className="relative group">
                  <Input 
                    type="file" 
                    accept=".docx,.doc,.html,.pdf"
                    onChange={handleUpload}
                    disabled={uploading}
                    className="w-full h-14 border-black rounded-2xl bg-slate-50/50 focus:ring-2 focus:ring-primary transition-all text-[11px] sm:text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[11px] sm:text-xs file:font-black file:uppercase file:tracking-widest file:bg-primary file:text-white file:hover:bg-primary/90 file:transition-all"
                  />
                  {uploading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Template List Section */}
            {templateList.length > 0 && (
              <div className="space-y-2.5 pt-4 border-t border-black/5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1">
                  <div className="flex flex-col gap-0.5">
                    <Label className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-primary leading-tight">Available Templates</Label>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{templateList.length} Templates</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {selectedTemplateIds.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkDeleteTemplates}
                        className="h-8 border-red-100 bg-red-50/30 text-red-600 hover:bg-red-50 font-black uppercase tracking-widest text-[9px] rounded-lg px-3 flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                      >
                        <Trash2 className="w-3 h-3" /> DELETE ({selectedTemplateIds.length})
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {templateList.map((template) => {
                    const isSelected = currentTemplate === template.name;
                    return (
                      <div 
                        key={template.id} 
                        onClick={() => handleSelectTemplate(template)}
                        className={`group relative flex flex-col p-2 bg-white border border-black rounded-lg hover:shadow-md transition-all duration-300 gap-1.5 cursor-pointer ${isSelected ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}
                      >
                        <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5">
                          <Checkbox 
                            checked={selectedTemplateIds.includes(template.id)}
                            onCheckedChange={() => toggleTemplateSelection(template.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-3 w-3 rounded border-black data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-4 w-4 p-0 rounded-md hover:bg-slate-100">
                                <MoreVertical className="w-2.5 h-2.5 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-black shadow-2xl">
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsRenaming(template.id);
                                  setNewName(template.name);
                                }}
                                className="gap-2 text-[9px] font-bold uppercase tracking-widest cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTemplate(template.id);
                                }}
                                className="gap-2 text-[9px] font-bold uppercase tracking-widest cursor-pointer text-red-500 focus:text-red-500"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className={`p-1.5 w-fit rounded-lg transition-all duration-500 ${
                            isSelected || template.is_default ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white'
                          }`}>
                            <FileText className="h-3 w-3" />
                          </div>
                          
                          <div className="flex flex-col min-w-0">
                            <div className="flex flex-col gap-0.5">
                              {isRenaming === template.id ? (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <Input
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="h-6 text-[9px] font-bold py-0.5 px-1 border-black focus:ring-1 bg-white min-w-[80px]"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenameTemplate(template.id, newName);
                                      if (e.key === 'Escape') setIsRenaming(null);
                                    }}
                                  />
                                  <Button 
                                    size="sm" 
                                    className="h-6 px-1 rounded-md bg-primary hover:bg-primary/90"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRenameTemplate(template.id, newName);
                                    }}
                                  >
                                    <Save className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              ) : (
                                <span 
                                  className={`text-[9px] sm:text-[10px] font-black truncate transition-colors leading-tight ${
                                    isSelected || template.is_default ? 'text-primary' : 'text-slate-700'
                                  }`}
                                >
                                  {template.name}
                                </span>
                              )}
                              <div className="flex flex-wrap items-center gap-1">
                                {template.is_default && (
                                  <span className="px-1.5 py-0.5 bg-primary text-white rounded-md text-[8px] font-black uppercase tracking-tighter shrink-0">
                                    Default
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200 text-[8px] font-black uppercase tracking-widest whitespace-nowrap">
                                  {template.document_type.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[9px] font-bold text-slate-400">
                                {format(new Date(template.created_at), 'MMM d, yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {!template.is_default && (
                          <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-black/5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetDefaultTemplate(template.id);
                              }}
                              className="h-7 px-1.5 rounded-md hover:bg-primary hover:text-white transition-all text-[8px] font-black uppercase tracking-tighter"
                            >
                              Set Default
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Editor Section */}
            {!showEditor ? (
              <div className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-300 rounded-[2rem] bg-slate-50/30 text-slate-400 gap-4 mt-8">
                <div className="p-4 bg-white rounded-full shadow-sm border border-slate-100">
                  <FileText className="w-8 h-8 opacity-20" />
                </div>
                <div className="text-center">
                  <p className="font-black uppercase tracking-widest text-[11px] sm:text-xs text-slate-500">No Template Selected</p>
                  <p className="text-[10px] font-bold mt-1">Please select an available template from the list above to start editing.</p>
                </div>
              </div>
            ) : (
              <>
                <div className={`space-y-6 border border-black rounded-[2rem] p-4 sm:p-8 bg-slate-50/50 backdrop-blur-md shadow-inner ${isPoppedOut ? 'hidden' : ''}`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-xl">
                          <Code className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="font-black text-slate-900 uppercase tracking-wider text-[11px] sm:text-xs">Template Editor</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 bg-white/50 p-2 rounded-[1.5rem] border border-black/20 shadow-sm">
                        {/* Font Settings Group */}
                        <div className="flex flex-wrap items-center gap-2 bg-white/60 p-1.5 rounded-xl border border-black/20 shadow-sm w-full sm:w-auto justify-between sm:justify-start">
                          <div className="flex items-center gap-2">
                          {/* Font Family Selector */}
                          <Select value={selectedFont} onValueChange={handleFontChange}>
                            <SelectTrigger className="h-9 w-[110px] sm:w-36 border-black rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-primary text-[10px] sm:text-xs font-bold">
                              <SelectValue placeholder="Font" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-black shadow-2xl max-h-[250px]">
                              {FONTS.map((font) => (
                                <SelectItem key={font.value} value={font.value} className="rounded-lg py-2.5 text-[10px] sm:text-xs" style={{ fontFamily: font.value }}>
                                  {font.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Font Size Selector */}
                          <Select value={selectedSize} onValueChange={handleSizeChange}>
                            <SelectTrigger className="h-9 w-[60px] sm:w-20 border-black rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-primary text-[10px] sm:text-xs font-bold">
                              <SelectValue placeholder="Size" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-black shadow-2xl max-h-[250px]">
                              {FONT_SIZES.map((size) => (
                                <SelectItem key={size} value={size} className="rounded-lg py-2.5 text-[10px] sm:text-xs">
                                  {size}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          </div>
                        </div>

                        {/* Formatting Group */}
                        <div className="flex items-center gap-1 bg-white/60 p-1 rounded-xl border border-black/20 shadow-sm">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => applyVisualCommand('bold', '')}
                            className="h-10 w-10 rounded-lg text-slate-900 hover:text-primary hover:bg-primary/5 transition-all border border-black/30"
                            title="Bold"
                          >
                            <Bold className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => applyVisualCommand('italic', '')}
                            className="h-10 w-10 rounded-lg text-slate-900 hover:text-primary hover:bg-primary/5 transition-all border border-black/30"
                            title="Italic"
                          >
                            <Italic className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => applyVisualCommand('underline', '')}
                            className="h-10 w-10 rounded-lg text-slate-900 hover:text-primary hover:bg-primary/5 transition-all border border-black/30"
                            title="Underline"
                          >
                            <Underline className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Editor Actions Group */}
                        <div className="flex items-center gap-1 bg-white/60 p-1 rounded-xl border border-black/20 shadow-sm">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => imageInputRef.current?.click()}
                            className="h-10 w-10 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all border border-black shadow-sm"
                            title="Insert Image"
                            disabled={uploading}
                          >
                            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                          </Button>
                          <input 
                            type="file" 
                            ref={imageInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleImageUpload} 
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleOpenTableDialog}
                            className="h-10 w-10 rounded-lg text-slate-900 hover:text-primary hover:bg-primary/5 transition-all text-[11px] sm:text-xs border border-black/30"
                            title="Insert Table"
                          >
                            <Table className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsPoppedOut(true)}
                            className="h-10 w-10 rounded-lg text-slate-900 hover:text-primary hover:bg-primary/5 transition-all text-[11px] sm:text-xs border border-black/30"
                            title="Open in Full Screen"
                          >
                            <Maximize2 className="h-5 w-5" />
                          </Button>
                          <Button
                            variant={isHtmlMode ? "secondary" : "ghost"}
                            size="icon"
                            onClick={() => setIsHtmlMode(!isHtmlMode)}
                            className={`h-10 w-10 rounded-lg transition-all text-[11px] sm:text-xs border border-black/30 ${isHtmlMode ? 'text-primary bg-white border-primary/20 shadow-sm' : 'text-slate-900 hover:text-primary hover:bg-primary/5'}`}
                            title={isHtmlMode ? "Switch to Visual Editor" : "Switch to HTML Editor"}
                          >
                            {isHtmlMode ? <Eye className="h-5 w-5" /> : <Code className="h-5 w-5" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="min-h-[400px] border border-black rounded-2xl overflow-hidden bg-white shadow-xl relative isolate">
                    {isLoadingTemplate && (
                      <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="font-black uppercase tracking-widest text-[10px] text-slate-500">Refreshing Content...</p>
                      </div>
                    )}
                    {backgroundImage && (
                      <div 
                        className="absolute inset-0 pointer-events-none"
                         style={{
                           backgroundImage: `url('${backgroundImage}')`,
                           backgroundSize: backgroundStyle === 'stretch' ? '100% 100%' : (backgroundStyle === 'center' ? 'contain' : 'auto'),
                           backgroundPosition: backgroundStyle === 'center' ? 'center' : 'top left',
                           backgroundRepeat: backgroundStyle === 'tile' ? 'repeat' : 'no-repeat',
                           opacity: backgroundOpacity,
                           zIndex: 0,
                           top: '42px', // Offset for toolbar height (approx)
                         }}
                       />
                    )}
                    <style>{`
                      .ql-container.ql-snow { border: none !important; }
                      .ql-editor { background-color: transparent !important; }
                    `}</style>
                    {isHtmlMode ? (
                      <Textarea
                        value={editorContent}
                        onChange={(e) => setEditorContent(e.target.value)}
                        className="h-[350px] font-mono text-[11px] sm:text-xs border-none bg-slate-900 text-slate-100 focus-visible:ring-0 resize-none p-4 relative z-10"
                        placeholder="Paste your HTML code here..."
                      />
                    ) : (
                      editorContent.toLowerCase().includes('<!doctype') || editorContent.toLowerCase().includes('<html') || editorContent.toLowerCase().includes('<body') || editorContent.toLowerCase().includes('<style') ? (
                        <div className="h-[350px] sm:h-[450px] mb-14 sm:mb-12 relative z-10 bg-white border border-slate-200 rounded-md overflow-hidden">
                          <VisualHtmlEditor 
                            content={editorContent} 
                            onChange={setEditorContent}
                            pageMargins={pageMargins}
                            selectedFont={selectedFont}
                            selectedSize={selectedSize}
                          />
                        </div>
                      ) : (
                        <ReactQuill 
                          ref={quillRef}
                          theme="snow"
                          value={editorContent}
                          onChange={setEditorContent}
                          modules={modules}
                          formats={formats}
                          className="h-[250px] sm:h-[350px] mb-14 sm:mb-12 relative z-10 text-[11px] sm:text-xs"
                        />
                      )
                    )}
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={handleSaveEditorContent} 
                      disabled={saving} 
                      className="w-full sm:w-auto gap-3 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] font-black uppercase tracking-widest h-14 px-12 rounded-[1.5rem] text-[11px] sm:text-xs"
                    >
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      Save Template
                    </Button>
                  </div>
                  
                  <div className="pt-8 border-t border-black/5 mt-8">
                    <Label className="mb-6 block font-black text-[11px] sm:text-xs uppercase tracking-[0.2em] text-primary ml-1">Page & Background Settings</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/50 p-4 sm:p-6 rounded-[2rem] border border-black/5">
                      
                      <div className="space-y-3 sm:col-span-2">
                        <Label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Background Image URL</Label>
                        <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 ml-1 mt-1">Max 1MB (Images only)</p>
                        <div className="flex gap-3">
                          <Input 
                            value={backgroundImage} 
                            onChange={(e) => setBackgroundImage(e.target.value)}
                            placeholder="https://example.com/image.png"
                            className="h-12 text-[11px] sm:text-xs border-black rounded-xl bg-white focus:ring-2 focus:ring-primary shadow-sm"
                          />
                          <div className="relative">
                            <Input 
                              type="file" 
                              accept="image/*"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              onChange={handleBackgroundUpload}
                              disabled={uploading}
                            />
                            <Button 
                              variant="default" 
                              size="icon" 
                              className="h-12 w-12 border-black rounded-xl bg-primary text-white hover:bg-primary/90 shadow-sm transition-all"
                              disabled={uploading}
                            >
                              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Background Style</Label>
                        <Select value={backgroundStyle} onValueChange={setBackgroundStyle}>
                          <SelectTrigger className="h-12 text-[11px] sm:text-xs border-black rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-primary">
                            <SelectValue placeholder="Select style" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-black shadow-2xl">
                            <SelectItem value="center" className="rounded-lg py-2.5 text-[11px] sm:text-xs">Center (Contain)</SelectItem>
                            <SelectItem value="stretch" className="rounded-lg py-2.5 text-[11px] sm:text-xs">Stretch</SelectItem>
                            <SelectItem value="tile" className="rounded-lg py-2.5 text-[11px] sm:text-xs">Tile</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Opacity ({Math.round(backgroundOpacity * 100)}%)</Label>
                        <div className="pt-3 px-1">
                          <Input 
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={backgroundOpacity}
                            onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))}
                            className="h-6 accent-primary cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Dialog open={isPoppedOut} onOpenChange={setIsPoppedOut}>
                  <DialogContent className="max-w-[98vw] w-full h-[98vh] flex flex-col p-0 gap-0 border-none bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl overflow-hidden">
                    <DialogHeader className="p-4 sm:p-8 border-b border-black/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/50">
                      <div className="flex flex-col gap-1.5">
                        <DialogTitle className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900">Template Editor</DialogTitle>
                        <DialogDescription className="text-[11px] sm:text-xs font-medium text-slate-900">Full screen editor for document templates</DialogDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pr-10">
                        <div className="flex flex-wrap items-center gap-2 bg-slate-100/50 p-2 rounded-[1.5rem] border border-black/5 shadow-inner">
                          {/* Font Settings Group */}
                          <div className="flex items-center gap-2 bg-white/60 p-1 rounded-xl border border-black shadow-sm">
                            {/* Font Family Selector */}
                            <Select value={selectedFont} onValueChange={handleFontChange}>
                              <SelectTrigger className="h-10 w-28 sm:w-36 border-black rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-primary text-[10px] sm:text-xs">
                                <SelectValue placeholder="Font" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-black shadow-2xl max-h-[250px]">
                                {FONTS.map((font) => (
                                  <SelectItem key={font.value} value={font.value} className="rounded-lg py-2.5 text-[10px] sm:text-xs" style={{ fontFamily: font.value }}>
                                    {font.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Font Size Selector */}
                            <Select value={selectedSize} onValueChange={handleSizeChange}>
                              <SelectTrigger className="h-10 w-16 sm:w-20 border-black rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-primary text-[10px] sm:text-xs">
                                <SelectValue placeholder="Size" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-black shadow-2xl max-h-[250px]">
                                {FONT_SIZES.map((size) => (
                                  <SelectItem key={size} value={size} className="rounded-lg py-2.5 text-[10px] sm:text-xs">
                                    {size}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Formatting Group */}
                          <div className="flex items-center gap-1 bg-white/60 p-1 rounded-xl border border-black/5 shadow-sm">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => applyVisualCommand('bold', '')}
                              className="h-10 w-10 rounded-lg text-slate-900 hover:text-primary hover:bg-primary/5 transition-all"
                              title="Bold"
                            >
                              <Bold className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => applyVisualCommand('italic', '')}
                              className="h-10 w-10 rounded-lg text-slate-900 hover:text-primary hover:bg-primary/5 transition-all"
                              title="Italic"
                            >
                              <Italic className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => applyVisualCommand('underline', '')}
                              className="h-10 w-10 rounded-lg text-slate-900 hover:text-primary hover:bg-primary/5 transition-all"
                              title="Underline"
                            >
                              <Underline className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Editor Actions Group */}
                          <div className="flex items-center gap-1 bg-white/60 p-1 rounded-xl border border-black/5 shadow-sm">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleOpenTableDialog}
                              className="h-12 w-12 rounded-xl text-slate-900 hover:text-primary hover:bg-white hover:shadow-sm transition-all text-[11px] sm:text-xs"
                              title="Insert Table"
                            >
                              <Table className="h-6 w-6" />
                            </Button>
                            <Button
                              variant={isHtmlMode ? "secondary" : "ghost"}
                              size="icon"
                              onClick={() => setIsHtmlMode(!isHtmlMode)}
                              className={`h-12 w-12 rounded-xl transition-all text-[11px] sm:text-xs ${isHtmlMode ? 'text-primary bg-white shadow-sm border border-primary/20' : 'text-slate-900 hover:text-primary hover:bg-white hover:shadow-sm'}`}
                              title={isHtmlMode ? "Switch to Visual Editor" : "Switch to HTML Editor"}
                            >
                              {isHtmlMode ? <Eye className="h-6 w-6" /> : <Code className="h-6 w-6" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DialogHeader>
                    <div className="flex-1 p-6 sm:p-8 bg-slate-50/30 overflow-hidden flex flex-col relative isolate">
                       {isHtmlMode ? (
                          <Textarea
                            value={editorContent}
                            onChange={(e) => setEditorContent(e.target.value)}
                            className="flex-1 font-mono text-[11px] sm:text-xs border-none bg-slate-900 text-slate-100 focus-visible:ring-0 resize-none p-8 rounded-3xl shadow-2xl"
                            placeholder="Paste your HTML code here..."
                          />
                        ) : (
                          editorContent.toLowerCase().includes('<!doctype') || editorContent.toLowerCase().includes('<html') || editorContent.toLowerCase().includes('<body') || editorContent.toLowerCase().includes('<style') ? (
                            <div className="flex-1 bg-white border border-black/5 rounded-3xl overflow-hidden shadow-2xl relative z-10">
                              <VisualHtmlEditor 
                                content={editorContent} 
                                onChange={setEditorContent}
                                pageMargins={pageMargins}
                                selectedFont={selectedFont}
                                selectedSize={selectedSize}
                              />
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col bg-white border border-black/5 rounded-3xl overflow-hidden shadow-2xl relative z-10">
                              <ReactQuill 
                                ref={quillRefPopped}
                                theme="snow"
                                value={editorContent}
                                onChange={setEditorContent}
                                modules={modules}
                                formats={formats}
                                className="flex-1 flex flex-col h-full [&>.ql-container]:flex-1 [&>.ql-container]:overflow-y-auto [&>.ql-toolbar]:border-none [&>.ql-toolbar]:bg-slate-50/80 [&>.ql-toolbar]:backdrop-blur-sm [&>.ql-container]:border-none text-[11px] sm:text-xs"
                              />
                            </div>
                          )
                        )}
                    </div>
                    <div className="p-4 sm:p-6 border-t border-black/5 bg-white/50 flex justify-end">
                      <Button 
                        onClick={handleSaveEditorContent} 
                        disabled={saving} 
                        className="w-full sm:w-auto gap-3 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] font-black uppercase tracking-widest h-14 px-12 rounded-2xl text-[11px] sm:text-xs"
                      >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Save Template
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}



            <div className="space-y-4 pt-4 border border-black rounded-[2rem] p-6 sm:p-8 bg-slate-50/50 backdrop-blur-md shadow-inner mt-8">
              <Label className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-primary ml-1">Preview Generation</Label>
              <div className="flex flex-row gap-2 bg-white/60 p-4 rounded-[1.5rem] border border-black/5 items-center backdrop-blur-sm">
                <Select value={testBookingId} onValueChange={setTestBookingId}>
                  <SelectTrigger className="flex-1 h-11 border-black rounded-xl bg-white focus:ring-2 focus:ring-primary shadow-sm font-bold text-slate-700 text-[11px] sm:text-xs">
                    <SelectValue placeholder="Select Booking" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-black shadow-2xl">
                    {latestBookings.length === 0 ? (
                      <SelectItem value="none" disabled className="text-[11px] sm:text-xs">No bookings found</SelectItem>
                    ) : (
                      latestBookings.map((booking) => (
                        <SelectItem key={booking.booking_id} value={booking.booking_reference} className="rounded-xl py-3 text-[11px] sm:text-xs">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-primary">{booking.booking_reference}</span>
                              <span className="font-medium text-slate-900">{booking.customer?.name || 'Unknown'}</span>
                            </div>
                            {booking.flight_date && (
                              <span className="text-[10px] font-black uppercase tracking-widest">
                                <span className="text-slate-500">{format(new Date(booking.flight_date), "EEE").toUpperCase()}</span>
                                <span className="text-slate-500 ml-1">{format(new Date(booking.flight_date), "d MMM yyyy")}</span>
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleTestGenerate} 
                  disabled={isGenerating || !testBookingId}
                  className="h-11 px-6 shrink-0 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all active:scale-[0.98] shadow-lg shadow-primary/20/50 text-[11px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 border-none"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  <span>Preview</span>
                </Button>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-900 ml-2 italic flex items-center gap-2">
                <Info className="w-3 h-3" />
                Select a booking to generate a sample PDF.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-none bg-white/50 backdrop-blur-sm shadow-xl shadow-primary/10/50 rounded-[2.5rem] transition-all duration-500 hover:shadow-2xl hover:shadow-primary/20/50">
          <CardHeader className="flex flex-row items-center justify-between p-4 sm:px-8 sm:py-5 border-b border-black/5">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary rounded-xl shadow-lg shadow-primary/20">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl sm:text-2xl text-slate-900 font-black tracking-tight uppercase flex items-center gap-2">
                    HISTORY
                    <span className="text-sm bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20 font-black shadow-sm">
                      {history.length}
                    </span>
                  </CardTitle>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedDocIds.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleBulkDeleteSelectedDocs}
                  className="h-11 border-red-100 bg-red-50/30 text-red-600 hover:bg-red-50 font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-xl px-4 flex items-center gap-2 shadow-sm animate-in fade-in zoom-in-95"
                >
                  <Trash2 className="w-3.5 h-3.5" /> DELETE ({selectedDocIds.length})
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl hover:bg-primary/5 hover:text-primary transition-all border border-black shadow-sm bg-white">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl border-black shadow-xl">
                  <DropdownMenuLabel className="text-[11px] font-black uppercase tracking-widest text-slate-500">Bulk Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleBulkDelete('1week')} className="text-red-600 focus:text-red-600 focus:bg-red-50 font-bold cursor-pointer text-xs py-2">
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete older than 1 week
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkDelete('1month')} className="text-red-600 focus:text-red-600 focus:bg-red-50 font-bold cursor-pointer text-xs py-2">
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete older than 1 month
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="icon" onClick={fetchHistory} disabled={loadingHistory} className="h-11 w-11 rounded-xl hover:bg-primary/5 hover:text-primary transition-all border border-black shadow-sm bg-white">
                <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <ScrollArea className="h-[500px] rounded-[2rem] border border-black/5 p-4 sm:p-6 bg-slate-50/30 shadow-inner">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center p-20 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-sm font-black uppercase tracking-widest text-primary animate-pulse">Loading history...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-12 w-12 text-slate-900" />
                  </div>
                  <p className="text-lg font-bold text-slate-900">No document history found</p>
                  <p className="text-sm text-slate-900 mt-2">Documents you generate will appear here.</p>
                </div>
              ) : (
                <div className="border border-black/5 rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-sm shadow-inner">
                  <div className="overflow-x-auto">
                    <TableUI>
                      <TableHeaderUI className="bg-slate-50/50 border-b border-black/5">
                        <TableRowUI className="hover:bg-transparent">
                          <TableHeadUI className="w-[50px] px-6">
                            <Checkbox 
                              checked={selectedDocIds.length === history.length && history.length > 0}
                              onCheckedChange={handleSelectAllDocs}
                              className="h-4 w-4 rounded-md border-black data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                          </TableHeadUI>
                          <TableHeadUI className="font-black uppercase tracking-widest text-[10px] text-slate-900 py-4">Document Type</TableHeadUI>
                          <TableHeadUI className="font-black uppercase tracking-widest text-[10px] text-slate-900">Booking Ref</TableHeadUI>
                          <TableHeadUI className="font-black uppercase tracking-widest text-[10px] text-slate-900">Customer</TableHeadUI>
                          <TableHeadUI className="font-black uppercase tracking-widest text-[10px] text-slate-900">Generated At</TableHeadUI>
                          <TableHeadUI className="text-right font-black uppercase tracking-widest text-[10px] text-slate-900 px-6">Actions</TableHeadUI>
                        </TableRowUI>
                      </TableHeaderUI>
                      <TableBodyUI>
                        {history.map((doc) => (
                          <TableRowUI key={doc.id} className="group hover:bg-primary/5 transition-all duration-300 border-b border-black/5 last:border-0">
                            <TableCellUI className="px-6">
                              <Checkbox 
                                checked={selectedDocIds.includes(doc.id)}
                                onCheckedChange={() => toggleDocSelection(doc.id)}
                                className="h-4 w-4 rounded-md border-black data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                            </TableCellUI>
                            <TableCellUI>
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/5 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-all duration-500">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <span className="font-black text-slate-900 capitalize text-[11px] sm:text-xs tracking-tight">
                                  {doc.document_type.replace('_', ' ')}
                                </span>
                              </div>
                            </TableCellUI>
                            <TableCellUI>
                              <span className="px-2 py-0.5 bg-primary/5 text-primary rounded-md border border-primary/10 text-[10px] font-black uppercase tracking-widest">
                                {doc.bookings?.booking_reference}
                              </span>
                            </TableCellUI>
                            <TableCellUI>
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                                <span className="text-[11px] sm:text-xs font-bold text-slate-700 truncate max-w-[120px]">
                                  {doc.bookings?.customers?.name}
                                </span>
                              </div>
                            </TableCellUI>
                            <TableCellUI>
                              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">
                                {format(new Date(doc.generated_at), 'MMM d, HH:mm')}
                              </span>
                            </TableCellUI>
                            <TableCellUI className="text-right px-6">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="icon" onClick={() => downloadDoc(doc)} className="h-8 w-8 rounded-lg border-black/5 shadow-sm hover:bg-primary hover:text-white hover:border-primary transition-all duration-300">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" onClick={() => deleteDoc(doc)} className="h-8 w-8 rounded-lg border-red-50 bg-red-50/30 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-300">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCellUI>
                          </TableRowUI>
                        ))}
                      </TableBodyUI>
                    </TableUI>
                  </div>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="h-fit border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="border-b border-black/5 bg-white/50 p-5 pb-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-primary shadow-inner group-hover:rotate-12 transition-transform duration-500">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    Variables
                  </CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 mt-0.5">
                    Personalize your templates
                  </CardDescription>
                  {isLoadingBookingData && (
                    <div className="flex items-center gap-1.5 mt-1 text-[9px] font-black uppercase tracking-widest text-primary animate-pulse">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Loading values...
                    </div>
                  )}
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-900" />
                <Input
                  placeholder="Search variables..."
                  value={variableSearch}
                  onChange={(e) => setVariableSearch(e.target.value)}
                  className="pl-11 h-11 text-sm font-bold border-black rounded-xl bg-white focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] lg:h-[750px] scrollbar-thin">
              <div className="px-4 sm:px-6 pt-3 pb-6 space-y-4">
                {/* Formulas Guide */}
                <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 text-xs sm:text-sm space-y-1">
                  <div className="flex items-center gap-2 font-black text-primary uppercase tracking-wide">
                    <Calculator className="w-4 h-4" />
                    <span>Formulas</span>
                  </div>
                  <p className="text-slate-900 font-bold leading-relaxed">
                    Use <span className="font-mono bg-white px-1 py-0.5 rounded border border-primary/10 text-primary">sum(...)</span> with <span className="text-primary font-black">+ - * /</span>
                  </p>
                  <div className="bg-white/50 p-2 rounded-lg border border-primary/10 font-mono text-[11px] sm:text-xs text-slate-900 font-bold">
                    Example: sum({'{total.paid}'} - {'{deposit}'})
                    <br/>
                    Result: 1000
                  </div>
                </div>

                {filteredVariables.length === 0 ? (
                  <div className="text-center py-12 animate-in fade-in duration-500">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                      <Search className="w-6 h-6 text-slate-900" />
                    </div>
                    <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">No variables found matching "{variableSearch}"</p>
                  </div>
                ) : (
                  filteredVariables.map((category) => (
                    <div key={category.category} className="space-y-3">
                      <h4 className="font-black text-[11px] sm:text-xs uppercase tracking-[0.2em] text-slate-900 px-1 flex items-center gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        {category.category}
                      </h4>
                      <div className="grid grid-cols-1 gap-1.5">
                        {category.vars.map((variable) => {
                            const firstPassenger = selectedBookingData?.booking_passengers?.[0];
                            const rawValue = selectedBookingData ? getVariableValue(variable, selectedBookingData, firstPassenger) : null;
                            // Strip HTML tags for preview display
                            const actualValue = typeof rawValue === 'string' ? rawValue.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim() : rawValue;
                           
                           return (
                             <button 
                               key={variable} 
                               className="w-full text-left bg-white/50 p-3 rounded-xl text-[11px] sm:text-xs font-bold border border-black/5 flex justify-between items-center group/var cursor-pointer hover:bg-primary hover:text-white hover:border-primary transition-all active:scale-[0.98] shadow-sm"
                               onClick={() => {
                                 navigator.clipboard.writeText(variable);
                                 toast.success(`Copied ${variable}`);
                               }}
                             >
                               <div className="flex flex-col min-w-0 flex-1">
                                 <span className="truncate mr-2 text-slate-900 group-hover/var:text-white transition-colors">{variable}</span>
                                 {actualValue && (
                                   <span className="text-[10px] text-primary group-hover/var:text-white/80 font-black truncate mt-0.5">
                                     = {actualValue}
                                   </span>
                                 )}
                               </div>
                               <span className="shrink-0 opacity-0 group-hover/var:opacity-100 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-primary bg-white px-2 py-1 rounded-lg shadow-sm transition-all duration-300">
                                 Copy
                               </span>
                             </button>
                           );
                         })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
        <DialogContent className="max-w-[900px] w-[95vw] sm:w-full max-h-[95vh] sm:max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-4 sm:p-6 border-b bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-primary rounded-full" />
              <DialogTitle className="text-xl font-bold text-slate-950">Table Manager</DialogTitle>
            </div>
            <DialogDescription className="text-[11px] sm:text-xs font-medium text-slate-900 ml-3">
              Create and manage independent data tables for your templates.
            </DialogDescription>
            <div className="mt-4 p-3 bg-primary/5/50 text-primary/90 rounded-xl text-[11px] sm:text-xs space-y-1 border border-primary/10 shadow-sm">
              <p className="font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px] sm:text-xs">
                <Info className="h-3.5 w-3.5" /> How to use:
              </p>
              <ul className="list-disc pl-5 space-y-1 opacity-90 text-[11px] sm:text-xs">
                <li>Create a <strong className="font-bold text-primary/80">New Table</strong> from the list.</li>
                <li>Configure <strong className="font-bold text-primary/80">Rows</strong> and <strong className="font-bold text-primary/80">Columns</strong>, then edit the content in the grid below.</li>
                <li>Click <strong className="font-bold text-primary/80">Insert Placeholder</strong> to add a reference (e.g., <code>{`{table.1}`}</code>) to your template.</li>
              </ul>
            </div>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row flex-1 overflow-hidden min-h-0">
            {/* Sidebar List */}
            <div className="w-full sm:w-1/3 border-b sm:border-b-0 sm:border-r bg-slate-50/30 p-4 flex flex-col gap-4 overflow-y-auto max-h-[200px] sm:max-h-full">
              <Button 
                onClick={handleAddTable} 
                className="w-full gap-2 bg-primary hover:bg-primary/90 text-white font-bold h-10 rounded-xl shadow-sm transition-all active:scale-[0.98] text-[11px] sm:text-xs"
              >
                <Plus className="h-4 w-4" /> New Table
              </Button>
              <div className="space-y-2">
                {tables.map(table => (
                  <div 
                    key={table.id} 
                    className={`p-3 rounded-xl border cursor-pointer hover:bg-primary/5/50 transition-all flex justify-between items-center group ${currentTableId === table.id ? 'bg-white border-primary shadow-md ring-1 ring-primary/20' : 'bg-white border-black/10'}`}
                    onClick={() => setCurrentTableId(table.id)}
                  >
                    <div className={`truncate font-bold text-[11px] sm:text-xs ${currentTableId === table.id ? 'text-primary/90' : 'text-slate-900'}`}>{table.name}</div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 p-0 text-slate-900 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-[11px] sm:text-xs"
                      onClick={(e) => { e.stopPropagation(); deleteTable(table.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {tables.length === 0 && (
                  <div className="text-center text-[11px] sm:text-xs text-slate-900 py-8 bg-white/50 rounded-xl border border-dashed border-slate-200">
                    No tables created yet.
                  </div>
                )}
              </div>
            </div>

            {/* Detail View */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-white min-h-0">
              {currentTableId ? (
                (() => {
                  const table = tables.find(t => t.id === currentTableId);
                  if (!table) return null;
                  return (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                        <div className="flex-1 space-y-2">
                          <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900 ml-1">Table Name</Label>
                          <Input 
                            value={table.name} 
                            onChange={(e) => handleUpdateTable(table.id, { name: e.target.value })} 
                            className="h-10 border-black rounded-xl focus:ring-2 focus:ring-primary text-[11px] sm:text-xs"
                          />
                        </div>
                        <div className="w-full sm:w-32 space-y-2">
                          <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900 ml-1">Border Color</Label>
                          <Select 
                            value={table.borderColor || 'black'} 
                            onValueChange={(value) => handleUpdateTable(table.id, { borderColor: value })}
                          >
                            <SelectTrigger className="h-10 border-black rounded-xl text-[11px] sm:text-xs">
                              <SelectValue placeholder="Color" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-black">
                              <SelectItem value="black" className="text-[11px] sm:text-xs">Black</SelectItem>
                              <SelectItem value="gray" className="text-[11px] sm:text-xs">Gray</SelectItem>
                              <SelectItem value="blue" className="text-[11px] sm:text-xs">Blue</SelectItem>
                              <SelectItem value="red" className="text-[11px] sm:text-xs">Red</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          onClick={() => insertTablePlaceholder(table.id)}
                          className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 rounded-xl shadow-md transition-all active:scale-[0.98] text-[11px] sm:text-xs"
                        >
                          <Plus className="h-4 w-4" /> Insert Placeholder
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900 ml-1">Rows</Label>
                          <Input 
                            type="number" 
                            min="1" 
                            max="50"
                            value={table.rows} 
                            onChange={(e) => handleUpdateTable(table.id, { rows: parseInt(e.target.value) || 1 })}
                            className="h-10 border-black rounded-xl text-[11px] sm:text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900 ml-1">Columns</Label>
                          <Input 
                            type="number" 
                            min="1" 
                            max="10"
                            value={table.cols} 
                            onChange={(e) => handleUpdateTable(table.id, { cols: parseInt(e.target.value) || 1 })}
                            className="h-10 border-black rounded-xl text-[11px] sm:text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900 ml-1">Table Data Grid</Label>
                        <ScrollArea className="border border-black rounded-2xl bg-slate-50/30">
                          <div className="p-4 overflow-x-auto min-w-full">
                            <table className="min-w-full border-collapse">
                              <thead>
                                <tr>
                                  {table.headers.map((header, colIndex) => (
                                    <th key={colIndex} className="p-1 min-w-[120px]">
                                      <Input 
                                        value={header} 
                                        onChange={(e) => handleUpdateHeader(table.id, colIndex, e.target.value)}
                                        className="h-9 text-[11px] sm:text-xs font-bold text-center bg-primary/5 border-black rounded-lg focus:ring-1 focus:ring-primary"
                                        placeholder={`Col ${colIndex + 1}`}
                                      />
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {table.data.map((row, rowIndex) => (
                                  <tr key={rowIndex}>
                                    {row.map((cell, colIndex) => (
                                      <td key={colIndex} className="p-1 min-w-[120px]">
                                        <Input 
                                          value={cell} 
                                          onChange={(e) => handleUpdateCell(table.id, rowIndex, colIndex, e.target.value)}
                                          className="h-9 text-[11px] sm:text-xs border-black bg-white rounded-lg focus:ring-1 focus:ring-primary"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-900 gap-3 py-12">
                  <div className="p-4 bg-slate-50 rounded-full">
                    <Table className="h-10 w-10 opacity-20" />
                  </div>
                  <p className="text-[11px] sm:text-xs font-medium">Select a table from the sidebar or create a new one</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
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
              
              <div className="flex flex-col gap-2 mt-4">
                <Button 
                  onClick={handleDownloadPDF} 
                  disabled={isGenerating}
                  className="w-full gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-none h-10 rounded-sm text-xs font-semibold"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download PDF
                </Button>
                <Button variant="link" className="text-[10px] p-0 h-auto text-blue-600 w-full text-right">Page Setup</Button>
              </div>
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
                  onClick={() => setShowPreview(false)}
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
                  dangerouslySetInnerHTML={{ __html: previewHtml }} 
                />
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
