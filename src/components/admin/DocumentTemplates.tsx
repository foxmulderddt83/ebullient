import { useState, useEffect, useMemo, useRef, type RefObject } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compressFile } from "@/utils/fileCompression";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Loader2, FileJson, Info, Download, Trash2, FileText, RefreshCw, Search, Save, Maximize2, Minimize2, Table, Plus, Upload, Code, Eye, Calculator, MoreVertical, Printer, Bold, Italic, Underline, ChevronUp, ChevronDown, Layers, Monitor, X, Move, FileDown, Undo2, Redo2, Link, Copy } from "lucide-react";
import { format } from "date-fns";
import ReactQuill, { Quill } from 'react-quill';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { AVAILABLE_VARIABLES, getVariableValue, generateAndPreviewPDF, generateAndSavePDF } from "@/lib/pdfGenerator";
import "jspdf-autotable";
import ImageResize from 'quill-image-resize-module-react';
import 'quill/dist/quill.snow.css';

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

import { logActivity } from "@/lib/activityLogger";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

// Helper to trim transparent or white borders from an image
const trimImage = async (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let top: number | null = null, 
            left: number | null = null, 
            right: number | null = null, 
            bottom: number | null = null;

        // Find the bounding box of non-background pixels
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // Consider a pixel as "content" if it's not transparent AND not pure white
            const isContent = a > 10 && !(r > 253 && g > 253 && b > 253);

            if (isContent) {
              if (top === null || y < top) top = y;
              if (left === null || x < left) left = x;
              if (right === null || x > right) right = x;
              if (bottom === null || y > bottom) bottom = y;
            }
          }
        }

        if (top === null || left === null || right === null || bottom === null) {
          resolve(file);
          return;
        }

        // Add 2px padding
        const p = 2;
        top = Math.max(0, top - p);
        left = Math.max(0, left - p);
        bottom = Math.min(canvas.height - 1, bottom + p);
        right = Math.min(canvas.width - 1, right + p);

        const trimWidth = right - left + 1;
        const trimHeight = bottom - top + 1;

        if (trimWidth <= 0 || trimHeight <= 0) {
          resolve(file);
          return;
        }

        const trimmedCanvas = document.createElement('canvas');
        trimmedCanvas.width = trimWidth;
        trimmedCanvas.height = trimHeight;
        const trimmedCtx = trimmedCanvas.getContext('2d');
        if (!trimmedCtx) {
          resolve(file);
          return;
        }

        trimmedCtx.drawImage(canvas, left, top, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight);
        
        trimmedCanvas.toBlob((blob) => {
          if (blob) {
            const trimmedFile = new File([blob], file.name, { type: file.type });
            resolve(trimmedFile);
          } else {
            resolve(file);
          }
        }, file.type);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// High-fidelity Visual HTML Editor using an iframe to isolate styles and display full documents properly
const VisualHtmlEditor = ({ 
  content, 
  onChange, 
  className,
  uploading = false,
  setUploading = () => {},
  pageMargins = { left: 0, right: 0, top: 0, bottom: 0 },
  selectedFont = 'Arial, sans-serif',
  selectedSize = '14px',
  backgroundImage = '',
  backgroundOpacity = 0.15,
  backgroundStyle = 'center',
  backgroundPosition = { x: 50, y: 50 },
  backgroundSize = { width: 100, height: 100 },
  topBanner = '',
  topBannerOpacity = 1.0,
  bottomBanner = '',
  bottomBannerOpacity = 1.0,
  iframeRef
}: { 
  content: string, 
  onChange: (val: string) => void, 
  className?: string,
  uploading?: boolean,
  setUploading?: (uploading: boolean) => void,
  pageMargins?: { left: number, right: number, top: number, bottom: number },
  selectedFont?: string,
  selectedSize?: string,
  backgroundImage?: string,
  backgroundOpacity?: number,
  backgroundStyle?: string,
  backgroundPosition?: { x: number, y: number },
  backgroundSize?: { width: number, height: number },
  topBanner?: string,
  topBannerOpacity?: number,
  bottomBanner?: string,
  bottomBannerOpacity?: number,
  iframeRef?: RefObject<HTMLIFrameElement>
}) => {
  const localIframeRef = useRef<HTMLIFrameElement>(null);
  const iframeRefToUse = iframeRef || localIframeRef;
  const contentRef = useRef(content);
  const isUpdatingRef = useRef(false);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Function to apply style to selection
  const applyStyle = (command: string, value: string) => {
    const iframe = iframeRefToUse.current;
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
  const getStyles = (margins: { left: number, right: number, top: number, bottom: number }, htmlContent: string) => {
    const hasPageA4 = htmlContent.includes('class="page-a4"') || htmlContent.includes("class='page-a4'");
    
    let bgStyleCss = "";
    if (backgroundImage) {
      const posX = backgroundPosition?.x ?? 50;
      const posY = backgroundPosition?.y ?? 50;
      const sizeW = backgroundSize?.width ?? 100;
      const sizeH = backgroundSize?.height ?? 100;

      switch (backgroundStyle) {
        case "stretch":
          bgStyleCss = `background-size: 100% 100%; background-position: center; background-repeat: no-repeat;`;
          break;
        case "tile":
          bgStyleCss = `background-size: auto; background-position: top left; background-repeat: repeat;`;
          break;
        case "center":
        default:
          bgStyleCss = `background-size: ${sizeW}% ${sizeH}%; background-position: ${posX}% ${posY}%; background-repeat: no-repeat;`;
          break;
      }
    }

    const topBannerHtml = topBanner ? `
      .page-a4::before {
        content: '';
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
      }
      .page-a4-top-banner {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: auto;
        background-image: url('${topBanner}');
        background-size: 100% auto;
        background-position: top;
        background-repeat: no-repeat;
        opacity: ${topBannerOpacity};
        z-index: 0;
        pointer-events: none;
      }
    ` : '';

    return `
    @page {
      size: A4;
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #525659;
      ${hasPageA4 ? 'display: flex; flex-direction: column; align-items: center;' : ''}
      font-family: Arial, sans-serif;
    }
    .page-a4 {
      background: white;
      width: 210mm;
      min-height: 297mm;
      padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
      margin: 10px auto;
      box-shadow: 0 0 20px rgba(0,0,0,0.4);
      box-sizing: border-box;
      position: relative;
      visibility: visible !important;
      opacity: 1 !important;
      display: block !important;
      overflow: visible;
      overflow-wrap: break-word;
      word-wrap: break-word;
    }
    /* Visual page break indicator overlay */
    .page-a4::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: repeating-linear-gradient(
        to bottom,
        transparent 0,
        transparent calc(297mm - 25mm),
        #525659 calc(297mm - 25mm),
        #525659 calc(297mm - 25mm + 20px)
      );
      pointer-events: none;
      z-index: 9999;
    }
    /* Add visual "PAGE BREAK" labels in the gaps */
    .page-a4::after {
      content: 'PAGE BREAK';
      position: absolute;
      top: calc(297mm - 25mm);
      left: 50%;
      transform: translateX(-50%);
      height: 20px;
      display: flex;
      align-items: center;
      color: #fff;
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 3px;
      pointer-events: none;
      z-index: 10000;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }
    /* Background and Banner Styles applied via injected divs */
    .bg-layer, .top-banner-layer, .bottom-banner-layer {
      position: absolute;
      left: 0;
      width: 100%;
      pointer-events: none;
      z-index: 0;
    }
    .bg-layer {
      top: 0;
      height: 100%;
      background-image: url('${backgroundImage}');
      opacity: ${backgroundOpacity};
      ${bgStyleCss}
    }
    .top-banner-layer {
      top: 0;
      height: 100%; /* Cover full height but background is at top */
      background-image: url('${topBanner}');
      background-size: 100% auto;
      background-position: top;
      background-repeat: no-repeat;
      opacity: ${topBannerOpacity};
    }
    .bottom-banner-layer {
      top: 0;
      height: 100%; /* Cover full height but background is at bottom */
      background-image: url('${bottomBanner}');
      background-size: 100% auto;
      background-position: bottom;
      background-repeat: no-repeat;
      opacity: ${bottomBannerOpacity};
    }
    .page-a4 > *:not(.bg-layer):not(.top-banner-layer):not(.bottom-banner-layer) {
      position: relative;
      z-index: 1;
    }
    a { pointer-events: none !important; cursor: default !important; text-decoration: none !important; }
    [contenteditable]:focus { outline: none; }
    table { border-collapse: collapse; }
    table, table th, table td { border: 1px solid #9ca3af !important; }
    table th { background-color: rgba(243, 244, 246, 0.8); }
    img { max-width: 100%; height: auto; cursor: pointer; }
    /* img:hover { border: 1px dashed #3b82f6 !important; } */
    /* img.selected { border: 2px solid #3b82f6 !important; } */
    /* Drag and drop styling */
    [draggable=true] { cursor: move; }
    /* .drag-over-top { border-top: 2px solid #3b82f6 !important; } */
    /* .drag-over-bottom { border-bottom: 2px solid #3b82f6 !important; } */
    /* Fix for potential invisible content due to body styles */
    body > * { visibility: visible !important; opacity: 1 !important; }
  `;
  };

  // Update styles when margins or content change
  useEffect(() => {
    if (styleRef.current) {
      styleRef.current.textContent = getStyles(pageMargins, content);
    }
  }, [pageMargins.left, pageMargins.right, pageMargins.top, pageMargins.bottom, content, backgroundImage, backgroundOpacity, backgroundStyle, backgroundPosition, backgroundSize]);

  useEffect(() => {
    const iframe = iframeRefToUse.current;
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

      // Ensure background layers exist
      const pageA4 = doc.querySelector('.page-a4');
      if (pageA4) {
        if (!pageA4.querySelector('.bg-layer')) {
          const bg = doc.createElement('div');
          bg.className = 'bg-layer';
          pageA4.insertBefore(bg, pageA4.firstChild);
        }
        if (!pageA4.querySelector('.top-banner-layer')) {
          const topBannerDiv = doc.createElement('div');
          topBannerDiv.className = 'top-banner-layer';
          pageA4.insertBefore(topBannerDiv, pageA4.firstChild);
        }
        if (!pageA4.querySelector('.bottom-banner-layer')) {
          const bottomBannerDiv = doc.createElement('div');
          bottomBannerDiv.className = 'bottom-banner-layer';
          pageA4.insertBefore(bottomBannerDiv, pageA4.firstChild);
        }
      }

      // Add element dragging and image resizing logic
      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let initialLeft = 0;
      let initialTop = 0;
      let draggedAbsElement: HTMLElement | null = null;

      // ── Table column / row resize & table width resize ──────────────────────
      let tblColResizing = false;
      let tblRowResizing = false;
      let tblResizeCell: HTMLElement | null = null;
      let tblResizeStartX = 0;
      let tblResizeStartY = 0;
      let tblResizeStartSize = 0;

      // Table width resize
      let tblWidthResizing = false;
      let tblWidthResizeTable: HTMLElement | null = null;
      let tblWidthResizeStartX = 0;
      let tblWidthResizeStartWidth = 0;

      const RESIZE_THRESH = 6;
      const TABLE_EDGE_THRESH = 8;

      // ── Cell merge-selection ───────────────────────────────────────────────
      let tblMergeAnchor: HTMLElement | null = null;
      let tblMergeCells: HTMLElement[] = [];
      let tblCellDragging = false;
      let tblMergeBar: HTMLElement | null = null;

      const tblGetCellPos = (cell: HTMLElement, rows: HTMLTableRowElement[]): { ri: number; ci: number } | null => {
        for (let ri = 0; ri < rows.length; ri++) {
          const cells = Array.from(rows[ri].cells);
          for (let ci = 0; ci < cells.length; ci++) {
            if (cells[ci] === cell) return { ri, ci };
          }
        }
        return null;
      };

      const tblClearSelection = () => {
        tblMergeCells.forEach(c => {
          (c as HTMLElement).style.outline = '';
          (c as HTMLElement).style.outlineOffset = '';
          (c as HTMLElement).style.backgroundColor = '';
        });
        tblMergeCells = [];
        tblMergeAnchor = null;
        tblMergeBar?.remove();
        tblMergeBar = null;
      };

      const tblRefreshHighlight = (anchor: HTMLElement, hovered: HTMLElement) => {
        const table = anchor.closest('table') as HTMLTableElement;
        if (!table || !table.contains(hovered)) return;
        const rows = Array.from(table.rows) as HTMLTableRowElement[];
        const aPos = tblGetCellPos(anchor, rows);
        const hPos = tblGetCellPos(hovered as HTMLElement, rows);
        if (!aPos || !hPos) return;
        const minR = Math.min(aPos.ri, hPos.ri);
        const maxR = Math.max(aPos.ri, hPos.ri);
        const minC = Math.min(aPos.ci, hPos.ci);
        const maxC = Math.max(aPos.ci, hPos.ci);
        tblMergeCells.forEach(c => { (c as HTMLElement).style.outline = ''; (c as HTMLElement).style.backgroundColor = ''; });
        tblMergeCells = [];
        rows.forEach((row, ri) => {
          if (ri < minR || ri > maxR) return;
          Array.from(row.cells).forEach((cell, ci) => {
            if (ci >= minC && ci <= maxC) {
              tblMergeCells.push(cell as HTMLElement);
              (cell as HTMLElement).style.outline = '2px solid #6366f1';
              (cell as HTMLElement).style.outlineOffset = '-1px';
              (cell as HTMLElement).style.backgroundColor = 'rgba(99,102,241,0.08)';
            }
          });
        });
      };

      const tblPerformMerge = () => {
        if (tblMergeCells.length < 2) return;
        const firstCell = tblMergeCells[0] as HTMLElement;
        const table = firstCell.closest('table') as HTMLTableElement;
        if (!table) return;
        const rows = Array.from(table.rows) as HTMLTableRowElement[];
        const positions = tblMergeCells.map(c => tblGetCellPos(c as HTMLElement, rows)).filter(Boolean) as { ri: number; ci: number }[];
        const minR = Math.min(...positions.map(p => p.ri));
        const maxR = Math.max(...positions.map(p => p.ri));
        const minC = Math.min(...positions.map(p => p.ci));
        const maxC = Math.max(...positions.map(p => p.ci));
        const colspan = maxC - minC + 1;
        const rowspan = maxR - minR + 1;
        const content = tblMergeCells.map(c => (c as HTMLElement).innerHTML.trim()).filter(t => t && t !== '<br>').join(' ');
        firstCell.innerHTML = content || '<br>';
        if (colspan > 1) firstCell.setAttribute('colspan', String(colspan));
        if (rowspan > 1) firstCell.setAttribute('rowspan', String(rowspan));
        firstCell.style.outline = '';
        firstCell.style.outlineOffset = '';
        firstCell.style.backgroundColor = '';
        for (let i = tblMergeCells.length - 1; i >= 1; i--) (tblMergeCells[i] as HTMLElement).remove();
        tblMergeCells = [];
        tblMergeAnchor = null;
        tblMergeBar?.remove(); tblMergeBar = null;
        doc.body.dispatchEvent(new Event('input', { bubbles: true }));
      };

      const updateTableHighlights = (target: HTMLElement | null) => {
        const tblHover = target?.closest('table') as HTMLElement | null;
        // Reset all table highlights first
        doc.querySelectorAll('table[data-draggable="true"]').forEach((tbl: Element) => {
          const t = tbl as HTMLElement;
          if (t !== tblHover) {
            t.dataset.draggable = 'false';
            t.style.boxShadow = '';
            t.style.backgroundColor = '';
            t.style.cursor = '';
          }
        });
        // Highlight the hovered table
        if (tblHover) {
          tblHover.dataset.draggable = 'true';
          tblHover.style.cursor = 'grab';
          tblHover.style.boxShadow = '0 0 0 2px #6366f1, 0 4px 12px rgba(99,102,241,0.3)';
          tblHover.style.backgroundColor = 'rgba(99,102,241,0.04)';
          tblHover.title = 'Click and drag to move table';
        }
      };

      const tblShowMergeBar = () => {
        tblMergeBar?.remove(); tblMergeBar = null;
        if (tblMergeCells.length < 2) return;
        const rect = tblMergeCells[0].getBoundingClientRect();
        const bar = doc.createElement('div');
        bar.id = 'tbl-merge-bar';
        bar.contentEditable = 'false';
        bar.style.cssText = `position:fixed;top:${Math.max(4, rect.top - 48)}px;left:${rect.left}px;background:#1e293b;border-radius:8px;padding:5px 10px;display:flex;align-items:center;gap:8px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.45);font-family:system-ui,sans-serif;user-select:none;`;
        const lbl = doc.createElement('span');
        lbl.textContent = `${tblMergeCells.length} cells selected`;
        lbl.style.cssText = 'font-size:10px;color:#94a3b8;font-weight:700;white-space:nowrap;';
        bar.appendChild(lbl);
        const divider = doc.createElement('div');
        divider.style.cssText = 'width:1px;height:16px;background:#475569;';
        bar.appendChild(divider);
        const mBtn = doc.createElement('button');
        mBtn.textContent = 'Merge Cells';
        mBtn.style.cssText = 'padding:4px 12px;border-radius:5px;border:none;cursor:pointer;font-size:11px;font-weight:700;color:white;background:#6366f1;white-space:nowrap;';
        mBtn.onmousedown = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
        mBtn.onclick = (ev) => { ev.stopPropagation(); tblPerformMerge(); };
        bar.appendChild(mBtn);
        const xBtn = doc.createElement('button');
        xBtn.textContent = '✕';
        xBtn.style.cssText = 'padding:4px 8px;border-radius:5px;border:none;cursor:pointer;font-size:11px;font-weight:700;color:#94a3b8;background:transparent;';
        xBtn.onmousedown = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
        xBtn.onclick = (ev) => { ev.stopPropagation(); tblClearSelection(); };
        bar.appendChild(xBtn);
        doc.body.appendChild(bar);
        tblMergeBar = bar;
      };

      // Suppress the toolbar during document initialisation so that synthetic
      // click events fired by doc.write() don't pop it open automatically.
      let imgToolbarEnabled = false;
      setTimeout(() => { imgToolbarEnabled = true; }, 350);

      // Image Toolbar — appears on any click on an image
      doc.addEventListener('click', (e) => {
        if (!imgToolbarEnabled) return;

        const target = e.target as HTMLElement;

        // Close any open toolbar when clicking outside image+toolbar
        const existingToolbar = doc.getElementById('img-toolbar');
        if (existingToolbar) {
          if (!existingToolbar.contains(target) && target.tagName !== 'IMG') {
            existingToolbar.remove();
            doc.querySelectorAll('img').forEach(img => {
              (img as HTMLElement).style.outline = '';
              (img as HTMLElement).style.outlineOffset = '';
            });
          }
          if (target.tagName !== 'IMG') return;
        }

        if (target.tagName !== 'IMG') return;

        e.stopPropagation();

        // Remove any existing toolbar first
        doc.getElementById('img-toolbar')?.remove();

        // Highlight image
        doc.querySelectorAll('img').forEach(img => {
          (img as HTMLElement).style.outline = '';
          (img as HTMLElement).style.outlineOffset = '';
        });
        target.style.outline = '2px solid #3b82f6';
        target.style.outlineOffset = '2px';

        // Helpers
        const getRotation = (el: HTMLElement) => {
          const m = (el.style.transform || '').match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
          return m ? parseFloat(m[1]) : 0;
        };
        const setRotation = (el: HTMLElement, deg: number) => {
          const t = (el.style.transform || '').replace(/rotate\(-?\d+(?:\.\d+)?deg\)\s*/g, '').trim();
          el.style.transform = t ? `${t} rotate(${deg}deg)` : `rotate(${deg}deg)`;
        };

        // Trigger saves content but temporarily removes selection outline so it isn't persisted
        const triggerSave = () => {
          const savedOutline = target.style.outline;
          const savedOffset = target.style.outlineOffset;
          target.style.outline = '';
          target.style.outlineOffset = '';
          doc.body.dispatchEvent(new Event('input', { bubbles: true }));
          target.style.outline = savedOutline;
          target.style.outlineOffset = savedOffset;
        };

        const toolbar = doc.createElement('div');
        toolbar.id = 'img-toolbar';

        // Position toolbar above (or below if near top)
        const imgRect = target.getBoundingClientRect();
        const viewW = iframe.contentWindow?.innerWidth || 800;
        const tbTop = imgRect.top > 68 ? imgRect.top - 62 : imgRect.bottom + 8;
        const tbLeft = Math.max(4, Math.min(imgRect.left, viewW - 470));
        toolbar.style.cssText = `
          position: fixed;
          top: ${tbTop}px;
          left: ${tbLeft}px;
          background: #1e293b;
          border-radius: 10px;
          padding: 5px 8px;
          display: flex;
          align-items: center;
          gap: 3px;
          z-index: 99999;
          box-shadow: 0 8px 32px rgba(0,0,0,0.45);
          flex-wrap: wrap;
          max-width: 470px;
          user-select: none;
          font-family: system-ui, sans-serif;
        `;

        const makeLabel = (text: string) => {
          const el = doc.createElement('span');
          el.textContent = text;
          el.style.cssText = 'font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 0 2px; white-space: nowrap; flex-shrink: 0;';
          return el;
        };
        const makeSep = () => {
          const el = doc.createElement('div');
          el.style.cssText = 'width: 1px; height: 18px; background: #475569; margin: 0 3px; flex-shrink: 0;';
          return el;
        };
        const makeBtn = (label: string, title: string, onClick: () => void, variant: 'default' | 'danger' = 'default') => {
          const btn = doc.createElement('button');
          btn.textContent = label;
          btn.title = title;
          const bg = variant === 'danger' ? '#dc2626' : '#334155';
          const hoverBg = variant === 'danger' ? '#b91c1c' : '#475569';
          btn.style.cssText = `padding: 3px 8px; border-radius: 5px; border: none; cursor: pointer; font-size: 11px; font-weight: 700; color: white; background: ${bg}; white-space: nowrap; flex-shrink: 0;`;
          btn.onmouseover = () => { btn.style.background = hoverBg; };
          btn.onmouseout = () => { btn.style.background = bg; };
          btn.onclick = (ev) => { ev.stopPropagation(); ev.preventDefault(); onClick(); };
          return btn;
        };

        // Prevent the body's contenteditable from making toolbar children editable
        toolbar.contentEditable = 'false';

        // == Resize ==
        toolbar.appendChild(makeLabel('Resize:'));

        // Check if image is in a table cell
        const cellCheck = (target as HTMLElement).closest('td,th');
        if (cellCheck) {
          const cellIndicator = doc.createElement('span');
          cellIndicator.textContent = '(in cell)';
          cellIndicator.style.cssText = 'font-size: 10px; color: #f59e0b; margin-left: 4px; flex-shrink: 0;';
          toolbar.appendChild(cellIndicator);
        }

        toolbar.appendChild(makeBtn('reset%', 'Reset to natural size', () => {
          target.style.width = ''; target.style.height = '';
          target.removeAttribute('width'); target.removeAttribute('height');
          triggerSave();
        }));
        // Custom width input
        const customInput = doc.createElement('input');
        customInput.type = 'text';
        customInput.placeholder = '200px';
        customInput.title = 'Enter custom width (e.g. 200px or 40%), press Enter';
        customInput.contentEditable = 'false';
        customInput.style.cssText = 'width: 60px; height: 22px; border-radius: 5px; border: none; background: #334155; color: white; font-size: 11px; font-weight: 700; padding: 0 6px; text-align: center; flex-shrink: 0;';
        customInput.onclick = (ev) => ev.stopPropagation();
        customInput.onkeydown = (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter') {
            const val = customInput.value.trim();
            if (val) {
              // Check if image is inside a table cell
              const cell = (target as HTMLElement).closest('td,th');
              let finalWidth = val.includes('%') || val.endsWith('px') ? val : `${val}px`;

              // If in cell, constrain width to cell's width
              if (cell) {
                const cellWidth = (cell as HTMLElement).offsetWidth;
                let numVal = parseInt(val);

                if (val.includes('%')) {
                  // If percentage, ensure it doesn't exceed 100%
                  numVal = Math.min(numVal, 100);
                  finalWidth = `${numVal}%`;
                } else {
                  // If pixels, constrain to cell width minus padding (20px for margins)
                  const maxWidth = Math.max(cellWidth - 20, 50);
                  numVal = Math.min(numVal, maxWidth);
                  finalWidth = `${numVal}px`;
                }
              }

              target.style.width = finalWidth;
              target.style.height = 'auto';
              triggerSave();
            }
          }
        };
        toolbar.appendChild(customInput);

        toolbar.appendChild(makeSep());

        // == Align ==
        toolbar.appendChild(makeLabel('Align:'));
        // Hide float alignment options if image is in a cell
        if (!cellCheck) {
          toolbar.appendChild(makeBtn('◀ L', 'Float left', () => {
            target.style.float = 'left'; target.style.marginRight = '10px'; target.style.marginLeft = ''; target.style.display = ''; triggerSave();
          }));
        }
        toolbar.appendChild(makeBtn('■ C', 'Center', () => {
          target.style.float = ''; target.style.display = 'block'; target.style.marginLeft = 'auto'; target.style.marginRight = 'auto'; triggerSave();
        }));
        if (!cellCheck) {
          toolbar.appendChild(makeBtn('R ▶', 'Float right', () => {
            target.style.float = 'right'; target.style.marginLeft = '10px'; target.style.marginRight = ''; target.style.display = ''; triggerSave();
          }));
        }
        toolbar.appendChild(makeBtn('Inline', cellCheck ? 'Reset to inline' : 'Reset alignment (inline)', () => {
          target.style.float = ''; target.style.display = ''; target.style.marginLeft = ''; target.style.marginRight = ''; triggerSave();
        }));

        toolbar.appendChild(makeSep());

        // == Rotate (manual degree input) ==
        toolbar.appendChild(makeLabel('Rotate:'));
        const rotateInput = doc.createElement('input');
        rotateInput.type = 'number';
        rotateInput.value = String(getRotation(target));
        rotateInput.title = 'Enter rotation degrees, press Enter or click Apply';
        rotateInput.contentEditable = 'false';
        rotateInput.style.cssText = 'width: 52px; height: 22px; border-radius: 5px; border: none; background: #334155; color: white; font-size: 11px; font-weight: 700; padding: 0 4px; text-align: center; flex-shrink: 0;';
        rotateInput.onclick = (ev) => ev.stopPropagation();
        rotateInput.onkeydown = (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter') { setRotation(target, parseFloat(rotateInput.value) || 0); triggerSave(); }
        };
        toolbar.appendChild(rotateInput);
        const degLabel = doc.createElement('span');
        degLabel.textContent = '°';
        degLabel.style.cssText = 'font-size: 11px; color: #94a3b8; flex-shrink: 0; padding: 0 1px;';
        toolbar.appendChild(degLabel);
        toolbar.appendChild(makeBtn('Apply', 'Apply rotation', () => {
          setRotation(target, parseFloat(rotateInput.value) || 0); triggerSave();
        }));

        toolbar.appendChild(makeSep());

        // == Delete ==
        toolbar.appendChild(makeBtn('🗑 Delete', 'Delete image', () => {
          if (doc.defaultView?.confirm('Delete this image?')) {
            target.style.outline = ''; target.style.outlineOffset = '';
            toolbar.remove();
            target.remove();
            doc.body.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 'danger'));

        doc.body.appendChild(toolbar);
      });

      doc.addEventListener('mousedown', (e) => {
        const target = e.target as HTMLElement;

        // Images: direct click-drag to reposition (no ALT needed)
        if (target.tagName === 'IMG') {
          const startX = e.clientX;
          const startY = e.clientY;
          let didDrag = false;

          const computedStyle = iframe.contentWindow?.getComputedStyle(target);
          if (!computedStyle || computedStyle.position === 'static') {
            target.style.position = 'relative';
          }
          const imgLeft = parseFloat(target.style.left) || 0;
          const imgTop = parseFloat(target.style.top) || 0;

          // Capture-phase click suppressor — added only when drag detected
          const suppressClick = (ev: Event) => {
            ev.stopImmediatePropagation();
            doc.removeEventListener('click', suppressClick, true);
          };

          const handleImgMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            if (!didDrag && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
              didDrag = true;
              target.style.cursor = 'grabbing';
              target.style.zIndex = '1000';
              target.style.opacity = '0.7'; // Visual feedback for dragging
              // Suppress the click that fires on mouseup so toolbar doesn't re-open
              doc.addEventListener('click', suppressClick, true);
            }
            if (didDrag) {
              target.style.left = `${imgLeft + dx}px`;
              target.style.top = `${imgTop + dy}px`;
            }
          };

          const handleImgUp = () => {
            doc.removeEventListener('mousemove', handleImgMove);
            doc.removeEventListener('mouseup', handleImgUp);
            if (didDrag) {
              target.style.cursor = '';
              target.style.zIndex = '';
              target.style.opacity = '';
              doc.body.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              // No drag — clean up unused suppressor
              doc.removeEventListener('click', suppressClick, true);
            }
          };

          doc.addEventListener('mousemove', handleImgMove);
          doc.addEventListener('mouseup', handleImgUp);
          return;
        }

        // ── Table width resize (left/right edges) ────────────────────────────
        const potentialTableForResize = (target as HTMLElement).closest('table') as HTMLElement | null;
        if (potentialTableForResize && !e.altKey && !tblCellDragging) {
          const tblRect = potentialTableForResize.getBoundingClientRect();
          const isLeftEdge = Math.abs(e.clientX - tblRect.left) <= TABLE_EDGE_THRESH;
          const isRightEdge = Math.abs(e.clientX - tblRect.right) <= TABLE_EDGE_THRESH;
          if (isLeftEdge || isRightEdge) {
            e.preventDefault(); e.stopPropagation();
            tblWidthResizing = true;
            tblWidthResizeTable = potentialTableForResize;
            tblWidthResizeStartX = e.clientX;
            tblWidthResizeStartWidth = potentialTableForResize.offsetWidth;
            doc.body.style.cursor = 'ew-resize';
            return;
          }
        }

        // ── Table drag-move (entire table) ────────────────────────────────────
        const potentialTable = (target as HTMLElement).closest('table') as HTMLElement | null;
        const wholeTable = potentialTable && potentialTable.dataset.draggable === 'true' ? potentialTable : null;
        if (wholeTable && !tblWidthResizing) {
          e.preventDefault();
          isDragging = true;
          draggedAbsElement = wholeTable;
          const computedStyle = iframe.contentWindow?.getComputedStyle(wholeTable);
          if (!computedStyle || computedStyle.position === 'static') {
            wholeTable.style.position = 'relative';
          }
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          initialLeft = parseFloat(wholeTable.style.left) || 0;
          initialTop = parseFloat(wholeTable.style.top) || 0;
          wholeTable.style.cursor = 'grabbing';
          wholeTable.style.zIndex = '1000';
          wholeTable.style.opacity = '0.7';
          wholeTable.style.boxShadow = '0 0 0 3px #6366f1';
          return;
        }

        // ── Table column / row resize & cell merge-selection ─────────────────
        const tableCell = (target as HTMLElement).closest('td,th') as HTMLElement | null;
        if (tableCell) {
          const r = tableCell.getBoundingClientRect();
          // Right-border → col resize
          if (Math.abs(e.clientX - r.right) <= RESIZE_THRESH) {
            e.preventDefault(); e.stopPropagation();
            tblColResizing = true; tblResizeCell = tableCell;
            tblResizeStartX = e.clientX; tblResizeStartSize = tableCell.offsetWidth;
            doc.body.style.cursor = 'col-resize';
            return;
          }
          // Bottom-border → row resize
          if (Math.abs(e.clientY - r.bottom) <= RESIZE_THRESH) {
            e.preventDefault(); e.stopPropagation();
            tblRowResizing = true; tblResizeCell = tableCell;
            tblResizeStartY = e.clientY;
            tblResizeStartSize = (tableCell.closest('tr') as HTMLElement)?.offsetHeight ?? tableCell.offsetHeight;
            doc.body.style.cursor = 'row-resize';
            return;
          }
          // Normal click in cell → start merge-selection drag
          if (!e.altKey) {
            tblClearSelection();
            tblMergeAnchor = tableCell;
            tblCellDragging = true;
          }
        } else {
          // Click outside any table cell → clear selection
          tblClearSelection();
        }

        // Non-image elements: ALT+drag to reposition
        if (e.altKey && target && target !== doc.body && target !== doc.documentElement) {
          e.preventDefault();
          isDragging = true;
          draggedAbsElement = target;

          const computedStyle = iframe.contentWindow?.getComputedStyle(target);
          if (!computedStyle || computedStyle.position === 'static') {
            target.style.position = 'relative';
          }

          dragStartX = e.clientX;
          dragStartY = e.clientY;
          initialLeft = parseFloat(target.style.left) || 0;
          initialTop = parseFloat(target.style.top) || 0;

          target.style.cursor = 'move';
          target.style.zIndex = '1000';
        }
      });

      doc.addEventListener('mousemove', (e) => {
        // Table width resize
        if (tblWidthResizing && tblWidthResizeTable) {
          const dx = e.clientX - tblWidthResizeStartX;
          const newW = Math.max(50, tblWidthResizeStartWidth + dx);
          tblWidthResizeTable.style.width = `${newW}px`;
          return;
        }
        // Column resize
        if (tblColResizing && tblResizeCell) {
          const newW = Math.max(20, tblResizeStartSize + (e.clientX - tblResizeStartX));
          tblResizeCell.style.width = `${newW}px`;
          tblResizeCell.style.minWidth = `${newW}px`;
          return;
        }
        // Row resize
        if (tblRowResizing && tblResizeCell) {
          const newH = Math.max(10, tblResizeStartSize + (e.clientY - tblResizeStartY));
          const row = tblResizeCell.closest('tr') as HTMLElement;
          if (row) row.style.height = `${newH}px`;
          else tblResizeCell.style.height = `${newH}px`;
          return;
        }
        // Cell merge-selection drag
        if (tblCellDragging && tblMergeAnchor) {
          const hovered = (e.target as HTMLElement).closest('td,th') as HTMLElement | null;
          if (hovered && hovered !== tblMergeAnchor) {
            e.preventDefault();
            tblRefreshHighlight(tblMergeAnchor, hovered);
          }
          return;
        }
        // Cursor hints: cell borders, table move, table edge detection, table width resize
        if (!isDragging && !tblColResizing && !tblRowResizing && !tblWidthResizing) {
          const cellHover = (e.target as HTMLElement).closest('td,th') as HTMLElement | null;
          const tblHover = (e.target as HTMLElement).closest('table') as HTMLElement | null;

          // Check if mouse is near table left/right edge (for width resize)
          let isNearTableLeftRightEdge = false;
          if (tblHover && !cellHover) {
            const tblRect = tblHover.getBoundingClientRect();
            const isNearLeft = Math.abs(e.clientX - tblRect.left) <= TABLE_EDGE_THRESH;
            const isNearRight = Math.abs(e.clientX - tblRect.right) <= TABLE_EDGE_THRESH;
            isNearTableLeftRightEdge = isNearLeft || isNearRight;
            if (isNearTableLeftRightEdge) {
              tblHover.style.cursor = 'ew-resize';
              return;
            }
          }

          // Check if mouse is near table edge (easier drag target)
          let isNearTableEdge = false;
          if (tblHover) {
            const tblRect = tblHover.getBoundingClientRect();
            const EDGE_THRESHOLD = 20; // 20px from any edge makes it draggable
            const isNearLeft = e.clientX - tblRect.left < EDGE_THRESHOLD;
            const isNearRight = tblRect.right - e.clientX < EDGE_THRESHOLD;
            const isNearTop = e.clientY - tblRect.top < EDGE_THRESHOLD;
            const isNearBottom = tblRect.bottom - e.clientY < EDGE_THRESHOLD;
            isNearTableEdge = isNearLeft || isNearRight || isNearTop || isNearBottom;
          }

          if (cellHover && !isNearTableEdge) {
            // Normal cell resize detection (only if not near table edge)
            const r = cellHover.getBoundingClientRect();
            if (Math.abs(e.clientX - r.right) <= RESIZE_THRESH) {
              cellHover.style.cursor = 'col-resize';
            } else if (Math.abs(e.clientY - r.bottom) <= RESIZE_THRESH) {
              cellHover.style.cursor = 'row-resize';
            } else if (cellHover.style.cursor === 'col-resize' || cellHover.style.cursor === 'row-resize') {
              cellHover.style.cursor = '';
            }
            // Clear table highlights when hovering over cells (not near edge)
            doc.querySelectorAll('table[data-draggable="true"]').forEach((tbl: Element) => {
              const t = tbl as HTMLElement;
              t.dataset.draggable = 'false';
              t.style.boxShadow = '';
              t.style.backgroundColor = '';
              t.style.cursor = '';
            });
          } else if (tblHover && isNearTableEdge) {
            // Highlight table when near edge (easier to grab)
            updateTableHighlights(tblHover);
          } else if (!cellHover && tblHover) {
            // Also highlight if hovering table but no cells detected
            updateTableHighlights(tblHover);
          } else {
            // Clear all highlights
            doc.querySelectorAll('table[data-draggable="true"]').forEach((tbl: Element) => {
              const t = tbl as HTMLElement;
              t.dataset.draggable = 'false';
              t.style.boxShadow = '';
              t.style.backgroundColor = '';
              t.style.cursor = '';
            });
          }
        }
        // Alt-drag move
        if (isDragging && draggedAbsElement) {
          const dx = e.clientX - dragStartX;
          const dy = e.clientY - dragStartY;
          draggedAbsElement.style.left = `${initialLeft + dx}px`;
          draggedAbsElement.style.top = `${initialTop + dy}px`;
        }
      });

      doc.addEventListener('mouseup', (e) => {
        // End table width resize
        if (tblWidthResizing) {
          tblWidthResizing = false; tblWidthResizeTable = null;
          doc.body.style.cursor = '';
          doc.body.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
        // End column resize
        if (tblColResizing) {
          tblColResizing = false; tblResizeCell = null;
          doc.body.style.cursor = '';
          doc.body.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
        // End row resize
        if (tblRowResizing) {
          tblRowResizing = false; tblResizeCell = null;
          doc.body.style.cursor = '';
          doc.body.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
        // End cell merge-selection drag
        if (tblCellDragging) {
          tblCellDragging = false;
          if (tblMergeCells.length >= 2) {
            tblShowMergeBar();
          } else {
            tblMergeAnchor = null;
          }
        }
        // Alt-drag & table-drag cleanup
        if (isDragging && draggedAbsElement) {
          isDragging = false;
          const wasTable = draggedAbsElement.tagName === 'TABLE';
          if (wasTable) {
            draggedAbsElement.style.cursor = '';
            draggedAbsElement.style.zIndex = '';
            draggedAbsElement.style.opacity = '';
            draggedAbsElement.style.boxShadow = '';
            draggedAbsElement.style.backgroundColor = '';
            draggedAbsElement.dataset.draggable = 'false';
          } else {
            draggedAbsElement.style.cursor = '';
            draggedAbsElement.style.zIndex = '';
            draggedAbsElement.style.opacity = '';
          }
          const currentTarget = draggedAbsElement;
          draggedAbsElement = null;
          const inputEvent = new Event('input', { bubbles: true });
          doc.body.dispatchEvent(inputEvent);
          // Re-highlight table if mouse is still over it after drag ends
          if (wasTable) {
            updateTableHighlights(currentTarget);
          }
        }
      });

      // ── Right-click context menu on table cells ────────────────────────────
      doc.addEventListener('contextmenu', (e) => {
        const cell = (e.target as HTMLElement).closest('td,th') as HTMLElement | null;
        if (!cell) return;
        e.preventDefault();
        doc.getElementById('tbl-ctx-menu')?.remove();

        const menu = doc.createElement('div');
        menu.id = 'tbl-ctx-menu';
        menu.contentEditable = 'false';
        menu.style.cssText = `position:fixed;top:${e.clientY}px;left:${e.clientX}px;background:white;border:1px solid #e2e8f0;border-radius:8px;padding:4px 0;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.18);font-family:system-ui,sans-serif;min-width:170px;user-select:none;`;

        const makeItem = (icon: string, label: string, action: () => void, isDanger = false) => {
          const item = doc.createElement('div');
          item.style.cssText = `padding:7px 14px;font-size:11px;font-weight:700;cursor:pointer;color:${isDanger ? '#dc2626' : '#1e293b'};display:flex;align-items:center;gap:8px;`;
          item.innerHTML = `<span style="font-size:13px;width:16px;text-align:center">${icon}</span>${label}`;
          item.onmouseover = () => { item.style.background = '#f1f5f9'; };
          item.onmouseout = () => { item.style.background = ''; };
          item.onmousedown = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
          item.onclick = (ev) => { ev.stopPropagation(); menu.remove(); action(); };
          return item;
        };
        const makeSep = () => { const s = doc.createElement('div'); s.style.cssText = 'height:1px;background:#e2e8f0;margin:4px 0;'; return s; };

        // Merge selected cells (if multiple selected)
        if (tblMergeCells.length >= 2 && tblMergeCells.includes(cell)) {
          menu.appendChild(makeItem('⊞', `Merge ${tblMergeCells.length} Selected Cells`, tblPerformMerge));
          menu.appendChild(makeSep());
        }

        // Unmerge
        if (cell.hasAttribute('colspan') || cell.hasAttribute('rowspan')) {
          menu.appendChild(makeItem('⊟', 'Unmerge Cell', () => {
            const cs = parseInt(cell.getAttribute('colspan') || '1');
            const rs = parseInt(cell.getAttribute('rowspan') || '1');
            cell.removeAttribute('colspan'); cell.removeAttribute('rowspan');
            const row = cell.parentElement as HTMLTableRowElement;
            if (row) {
              for (let c = 1; c < cs; c++) {
                const nc = doc.createElement(cell.tagName); nc.innerHTML = '<br>';
                row.insertBefore(nc, cell.nextSibling);
              }
            }
            if (rs > 1) {
              const table = cell.closest('table') as HTMLTableElement;
              if (table) {
                const rows = Array.from(table.rows);
                const ri = rows.indexOf(cell.parentElement as HTMLTableRowElement);
                const ci = Array.from((cell.parentElement as HTMLTableRowElement).cells).indexOf(cell as HTMLTableCellElement);
                for (let r = 1; r < rs; r++) {
                  const tr = rows[ri + r];
                  if (tr) { const nc = doc.createElement(cell.tagName); nc.innerHTML = '<br>'; tr.insertBefore(nc, tr.cells[ci] || null); }
                }
              }
            }
            doc.body.dispatchEvent(new Event('input', { bubbles: true }));
          }));
          menu.appendChild(makeSep());
        }

        // Row operations
        menu.appendChild(makeItem('↑', 'Insert Row Above', () => {
          const row = cell.closest('tr') as HTMLTableRowElement;
          if (!row) return;
          const newRow = doc.createElement('tr');
          Array.from(row.cells).forEach(() => { const nc = doc.createElement('td'); nc.innerHTML = '<br>'; newRow.appendChild(nc); });
          row.parentElement?.insertBefore(newRow, row);
          doc.body.dispatchEvent(new Event('input', { bubbles: true }));
        }));
        menu.appendChild(makeItem('↓', 'Insert Row Below', () => {
          const row = cell.closest('tr') as HTMLTableRowElement;
          if (!row) return;
          const newRow = doc.createElement('tr');
          Array.from(row.cells).forEach(() => { const nc = doc.createElement('td'); nc.innerHTML = '<br>'; newRow.appendChild(nc); });
          row.parentElement?.insertBefore(newRow, row.nextSibling);
          doc.body.dispatchEvent(new Event('input', { bubbles: true }));
        }));
        menu.appendChild(makeSep());

        // Column operations
        menu.appendChild(makeItem('←', 'Insert Column Left', () => {
          const table = cell.closest('table') as HTMLTableElement;
          const row = cell.closest('tr') as HTMLTableRowElement;
          if (!table || !row) return;
          const ci = Array.from(row.cells).indexOf(cell as HTMLTableCellElement);
          Array.from(table.rows).forEach(tr => { const nc = doc.createElement(tr.cells[0]?.tagName || 'td'); nc.innerHTML = '<br>'; tr.insertBefore(nc, tr.cells[ci] || null); });
          doc.body.dispatchEvent(new Event('input', { bubbles: true }));
        }));
        menu.appendChild(makeItem('→', 'Insert Column Right', () => {
          const table = cell.closest('table') as HTMLTableElement;
          const row = cell.closest('tr') as HTMLTableRowElement;
          if (!table || !row) return;
          const ci = Array.from(row.cells).indexOf(cell as HTMLTableCellElement);
          Array.from(table.rows).forEach(tr => { const nc = doc.createElement(tr.cells[0]?.tagName || 'td'); nc.innerHTML = '<br>'; tr.insertBefore(nc, tr.cells[ci + 1] || null); });
          doc.body.dispatchEvent(new Event('input', { bubbles: true }));
        }));
        menu.appendChild(makeSep());

        // Delete operations
        menu.appendChild(makeItem('✕', 'Delete Row', () => {
          cell.closest('tr')?.remove();
          doc.body.dispatchEvent(new Event('input', { bubbles: true }));
        }, true));
        menu.appendChild(makeItem('✕', 'Delete Column', () => {
          const table = cell.closest('table') as HTMLTableElement;
          const row = cell.closest('tr') as HTMLTableRowElement;
          if (!table || !row) return;
          const ci = Array.from(row.cells).indexOf(cell as HTMLTableCellElement);
          Array.from(table.rows).forEach(tr => { if (tr.cells[ci]) tr.cells[ci].remove(); });
          doc.body.dispatchEvent(new Event('input', { bubbles: true }));
        }, true));

        doc.body.appendChild(menu);
        const closeCtx = (ev: MouseEvent) => {
          if (!menu.contains(ev.target as HTMLElement)) { menu.remove(); doc.removeEventListener('click', closeCtx, true); }
        };
        setTimeout(() => doc.addEventListener('click', closeCtx, true), 0);
      });

      // ── Drag & Drop Image Handler ──────────────────────────────────────────
      doc.body.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        doc.body.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
      });

      doc.body.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        doc.body.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
      });

      doc.body.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        doc.body.style.backgroundColor = '';
      });

      doc.body.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        doc.body.style.backgroundColor = '';

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (!file.type.startsWith('image/')) return;

          if (setUploading) setUploading(true);
          try {
            // Auto-trim image on drop
            const trimmedFile = await trimImage(file);
            const compressedFile = await compressFile(trimmedFile);
            
            const fileName = `template_img_${Date.now()}_${file.name}`;
            const filePath = `templates/images/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(filePath, compressedFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('media')
              .getPublicUrl(filePath);

            // Insert image at drop position
            const imgStyle = "max-width: 100%; height: auto; display: inline-block; cursor: nwse-resize;";
            const imgHtml = `<img src="${publicUrl}" class="template-image" style="${imgStyle}" />`;
            
            // Try to insert at cursor position
            const range = doc.caretRangeFromPoint(e.clientX, e.clientY);
            if (range) {
              const selection = doc.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
            doc.execCommand('insertHTML', false, imgHtml);
            doc.body.dispatchEvent(new Event('input', { bubbles: true }));
            toast.success("Image auto-trimmed and inserted");
          } catch (err: any) {
            console.error("Drop error:", err);
            toast.error("Failed to process dropped image");
          } finally {
            if (setUploading) setUploading(false);
          }
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

      // Clone the document to clean it before saving
      const cleanDoc = doc.cloneNode(true) as Document;

      // Remove editor-only classes and attributes
      cleanDoc.querySelectorAll('.selected, .drag-over-top, .drag-over-bottom').forEach(el => {
        el.classList.remove('selected', 'drag-over-top', 'drag-over-bottom');
        if (el.classList.length === 0) el.removeAttribute('class');
      });

      // Remove background layers before saving so they don't bloat the HTML
      cleanDoc.querySelectorAll('.bg-layer, .top-banner-layer, .bottom-banner-layer').forEach(el => {
        el.remove();
      });

      // Remove editor-only overlay elements
      cleanDoc.getElementById('img-toolbar')?.remove();
      cleanDoc.getElementById('tbl-merge-bar')?.remove();
      cleanDoc.getElementById('tbl-ctx-menu')?.remove();

      // Clean merge-selection highlights from cells
      cleanDoc.querySelectorAll('td, th').forEach(el => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style.outlineOffset === '-1px') {
          htmlEl.style.outline = '';
          htmlEl.style.outlineOffset = '';
          htmlEl.style.backgroundColor = '';
        }
      });

      cleanDoc.querySelectorAll('[draggable]').forEach(el => {
         el.removeAttribute('draggable');
       });

       // Clean up any remaining temporary styles
       cleanDoc.querySelectorAll('*').forEach(el => {
         const htmlEl = el as HTMLElement;
         if (htmlEl.style) {
           const styleAttr = htmlEl.getAttribute('style') || '';
           
           // Remove selection outlines and borders from images (#3b82f6)
           if (styleAttr.includes('#3b82f6') || styleAttr.includes('59, 130, 246')) {
             htmlEl.style.outline = '';
             htmlEl.style.outlineOffset = '';
             htmlEl.style.border = '';
           }

           // Remove table highlights (#6366f1)
           if (styleAttr.includes('#6366f1') || styleAttr.includes('99, 102, 241')) {
             htmlEl.style.boxShadow = '';
             htmlEl.style.backgroundColor = '';
             htmlEl.style.outline = '';
             htmlEl.style.outlineOffset = '';
           }

           if (htmlEl.style.opacity === '0.5' || htmlEl.style.opacity === '0.7') htmlEl.style.opacity = '';
           if (htmlEl.style.cursor === 'move' || htmlEl.style.cursor === 'grab' || htmlEl.style.cursor === 'grabbing' || htmlEl.style.cursor === 'nwse-resize') {
             htmlEl.style.cursor = '';
           }
           if (htmlEl.style.zIndex === '1000') htmlEl.style.zIndex = '';
           if (htmlEl.getAttribute('style') === '') htmlEl.removeAttribute('style');
         }
         el.removeAttribute('data-draggable');
       });

      // Remove the editor styles from the saved HTML
      const editorStyles = cleanDoc.getElementById('editor-styles');
      if (editorStyles) editorStyles.remove();

      // Ensure body is not marked as contenteditable in saved HTML
      if (cleanDoc.body) {
        cleanDoc.body.removeAttribute('contenteditable');
        cleanDoc.body.style.minHeight = '';
        cleanDoc.body.style.cursor = '';
      }

      const newContent = cleanDoc.documentElement.outerHTML;
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
        ref={iframeRefToUse} 
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

interface TemplateSettings {
  backgroundImage?: string;
  backgroundOpacity?: number;
  backgroundStyle?: string;
  backgroundPosition?: { x: number; y: number };
  backgroundSize?: { width: number; height: number };
  pageMargins?: { left: number; right: number; top: number; bottom: number };
  topBanner?: string;
  topBannerOpacity?: number;
  bottomBanner?: string;
  bottomBannerOpacity?: number;
  original_file_path?: string;
  public_url?: string;
}

interface DocumentTemplate {
  id: string;
  name: string;
  document_type: string;
  content: string;
  is_default: boolean;
  created_at: string;
  template_settings?: TemplateSettings;
}

interface DocumentType {
  id: string;
  value: string;
  label: string;
}

export default function DocumentTemplates({ canEdit = true }: { canEdit?: boolean }) {
  const pdfApiUrl = import.meta.env.VITE_PDF_API_URL || 'https://oneday-whatsapp-bot.fly.dev';
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedType, setSelectedType] = useState<string>("invoice_paid");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Editor State
  const [editorContent, setEditorContent] = useState("");
  const [undoHistory, setUndoHistory] = useState<string[]>([]);
  const [redoHistory, setRedoHistory] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const isUndoRedoRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeRefPopped = useRef<HTMLIFrameElement>(null);
  const [isPoppedOut, setIsPoppedOut] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  
  // Track history for undo (keep last 4 states to allow 3 undos)
  useEffect(() => {
    if (editorContent) {
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false;
        return;
      }
      setUndoHistory(prev => {
        // If the new content is the same as the last entry, don't add it
        if (prev.length > 0 && prev[prev.length - 1] === editorContent) return prev;
        const newHistory = [...prev, editorContent];
        // Keep only the last 4 states (current + 3 undo steps)
        if (newHistory.length > 4) return newHistory.slice(newHistory.length - 4);
        return newHistory;
      });
      // Clear redo history when user makes a new change
      setRedoHistory([]);
    }
  }, [editorContent]);

  const handleUndo = () => {
    if (undoHistory.length > 1) {
      const newHistory = [...undoHistory];
      const currentState = newHistory.pop(); // Remove current state
      if (currentState) {
        setRedoHistory(prev => [...prev, currentState]);
      }
      const prevState = newHistory[newHistory.length - 1];
      
      isUndoRedoRef.current = true;
      setUndoHistory(newHistory);
      setEditorContent(prevState);
      toast.success("Undo successful");
    } else {
      toast.error("No more steps to undo");
    }
  };

  const handleRedo = () => {
    if (redoHistory.length > 0) {
      const newRedo = [...redoHistory];
      const nextState = newRedo.pop();
      
      if (nextState) {
        isUndoRedoRef.current = true;
        setUndoHistory(prev => [...prev, nextState]);
        setRedoHistory(newRedo);
        setEditorContent(nextState);
        toast.success("Redo successful");
      }
    } else {
      toast.error("No more steps to redo");
    }
  };

  const [isReplaceConfirmOpen, setIsReplaceConfirmOpen] = useState(false);
  const [pendingReplaceData, setPendingReplaceData] = useState<{ matches: number } | null>(null);

  const handleSearchReplace = () => {
    if (!searchTerm) {
      toast.error("Please enter a search term");
      return;
    }

    if (!editorContent) {
      toast.error("Editor is empty");
      return;
    }

    // Escape regex special characters in search term
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedSearchTerm, 'g');
    
    // Check if there are matches
    const matches = editorContent.match(regex);
    if (!matches) {
      toast.error(`No matches found for "${searchTerm}"`);
      return;
    }

    // Trigger auto-scroll and highlight first
    handleSearchHighlight();
    
    // Set pending data and open confirmation
    setPendingReplaceData({ matches: matches.length });
    setIsReplaceConfirmOpen(true);
  };

  const confirmReplace = () => {
    if (!pendingReplaceData) return;
    
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedSearchTerm, 'g');
    const newContent = editorContent.replace(regex, replaceTerm);
    
    setEditorContent(newContent);
    toast.success(`Replaced ${pendingReplaceData.matches} occurrence(s) of "${searchTerm}"`);
    
    setIsReplaceConfirmOpen(false);
    setPendingReplaceData(null);
  };

  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const handleSearchHighlight = () => {
    if (!searchTerm) {
      toast.error("Please enter a search term");
      return;
    }

    if (isHtmlMode) {
      // Find Textarea - we need to query the DOM since there's no direct ref
      const textareas = document.querySelectorAll('textarea');
      // Look for the one that has our editor content
      let targetTextarea: HTMLTextAreaElement | null = null;
      for (const ta of Array.from(textareas)) {
        if (ta.value === editorContent) {
          targetTextarea = ta;
          break;
        }
      }

      if (targetTextarea) {
        const text = targetTextarea.value;
        const index = text.toLowerCase().indexOf(searchTerm.toLowerCase(), targetTextarea.selectionEnd);
        const finalIndex = index !== -1 ? index : text.toLowerCase().indexOf(searchTerm.toLowerCase());

        if (finalIndex !== -1) {
          targetTextarea.focus();
          targetTextarea.setSelectionRange(finalIndex, finalIndex + searchTerm.length);
          
          // Scroll to the selection
          const lineHeight = 15; // approximate
          const charsPerLine = 80; // approximate
          const line = Math.floor(finalIndex / charsPerLine);
          targetTextarea.scrollTop = line * lineHeight - 50;
          
          toast.success(`Found "${searchTerm}"`);
        } else {
          toast.error(`"${searchTerm}" not found`);
        }
      }
      return;
    }

    // Visual Mode Search
    const iframe = isPoppedOut ? iframeRefPopped.current : iframeRef.current;
    if (!iframe) {
      toast.error("Editor window not found");
      return;
    }

    const win = iframe.contentWindow;
    if (!win) {
      toast.error("Editor content not accessible");
      return;
    }

    // Use window.find if available (native browser search)
    if ((win as any).find) {
      const found = (win as any).find(searchTerm, false, false, true, false, true, true);
      if (!found) {
        // Try searching from top if not found at current position
        (win as any).find(searchTerm, false, false, true, false, true, false);
      }
    } else {
      toast.error("Search highlighting is not supported in this browser");
    }
  };
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<DocumentTemplate | null>(null);
  const [templates, setTemplates] = useState<{name: string, url: string}[]>([]);
  const [templateList, setTemplateList] = useState<DocumentTemplate[]>([]);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, currentFileName: "" });
  const [history, setHistory] = useState<GeneratedDoc[]>([]);
  const [testBookingId, setTestBookingId] = useState("");
  const [latestBookings, setLatestBookings] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedBookingData, setSelectedBookingData] = useState<any>(null);
  const [isLoadingBookingData, setIsLoadingBookingData] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  
  const fetchDocumentTypes = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('document_types')
      .select('*')
      .order('label', { ascending: true });
    
    if (error) {
      console.error('Error fetching document types:', error);
    } else if (data) {
      setDocumentTypes(data);
      if (data.length > 0 && !selectedType) {
        setSelectedType(data[0].value);
      }
    }
  };

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const handleAddDocumentType = async () => {
    if (!canEdit) {
      toast.error("Read-only mode: cannot add document types");
      return;
    }
    const label = prompt("Enter new Document Type name (e.g. Flight Certificate):");
    if (!label) return;
    
    const value = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    if (documentTypes.find(t => t.value === value)) {
      toast.error("A similar document type already exists");
      return;
    }

    const { error } = await supabase
      .from('document_types')
      .insert([{ value, label }]);

    if (error) {
      toast.error(`Failed to add: ${error.message}`);
    } else {
      toast.success("Document type added");
      fetchDocumentTypes();
      setSelectedType(value);
    }
  };

  const handleRenameDocumentType = async () => {
    if (!canEdit) {
      toast.error("Read-only mode: cannot rename document types");
      return;
    }
    if (!selectedType) return;
    const currentType = documentTypes.find(t => t.value === selectedType);
    if (!currentType) return;

    const newLabel = prompt("Enter new name for this Document Type:", currentType.label);
    if (!newLabel || newLabel === currentType.label) return;

    const { error } = await supabase
      .from('document_types')
      .update({ label: newLabel })
      .eq('value', selectedType);

    if (error) {
      toast.error(`Failed to rename: ${error.message}`);
    } else {
      toast.success("Document type renamed");
      fetchDocumentTypes();
    }
  };

  const handleDeleteDocumentType = async () => {
    if (!canEdit) {
      toast.error("Read-only mode: cannot delete document types");
      return;
    }
    if (!selectedType) return;
    const currentType = documentTypes.find(t => t.value === selectedType);
    if (!currentType) return;

    if (!confirm(`Are you sure you want to delete "${currentType.label}"? This will ALSO delete ALL templates associated with this type.`)) {
      return;
    }

    const { error } = await supabase
      .from('document_types')
      .delete()
      .eq('value', selectedType);

    if (error) {
      toast.error(`Failed to delete: ${error.message}`);
    } else {
      toast.success("Document type and its templates deleted");
      const remaining = documentTypes.filter(t => t.value !== selectedType);
      setDocumentTypes(remaining);
      setSelectedType(remaining.length > 0 ? remaining[0].value : "");
      fetchDocumentTypes();
    }
  };

  // Preview State
  const [previewData, setPreviewData] = useState<{
    html: string;
    title: string;
    docType: string;
    bookingId: string;
    bookingReference: string;
    passengerId?: string;
    orientation?: 'portrait' | 'landscape';
    pageSize?: 'A4' | 'Letter';
    widthMm?: number;
    heightMm?: number;
    windowW?: number;
    windowH?: number;
  } | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(typeof window !== 'undefined' && window.innerWidth < 768 ? window.innerWidth / 900 : 0.85);

  useEffect(() => {
    if (previewData) {
      const width = window.innerWidth;
      if (width < 768) {
        setPreviewZoom(width / 900);
      } else {
        setPreviewZoom(0.85);
      }
    }
  }, [previewData]);

  // Background Image State
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(0.15); // Default 15% opacity
  const [backgroundStyle, setBackgroundStyle] = useState<string>("center"); // Default center (contain)
  const [backgroundPosition, setBackgroundPosition] = useState<{ x: number, y: number }>({ x: 50, y: 50 }); // Default 50%, 50% (center)
  const [backgroundSize, setBackgroundSize] = useState<{ width: number, height: number }>({ width: 100, height: 100 }); // Default 100% width/height
  
  // Banner Images State
  const [topBanner, setTopBanner] = useState<string>("");
  const [topBannerOpacity, setTopBannerOpacity] = useState<number>(1.0);
  const [bottomBanner, setBottomBanner] = useState<string>("");
  const [bottomBannerOpacity, setBottomBannerOpacity] = useState<number>(1.0);

  // Page Settings
  const [printPageMargins, setPrintPageMargins] = useState<string>('Normal');
  const [pageSize, setPageSize] = useState<string>('A4');
  const [pageMargins, setPageMargins] = useState<{ left: number, right: number, top: number, bottom: number }>({ left: 0, right: 0, top: 0, bottom: 0 });
  const [showEditor, setShowEditor] = useState(false);
  const [selectedFont, setSelectedFont] = useState("Arial");
  const [selectedSize, setSelectedSize] = useState("14px");
  const [selectedLineSpacing, setSelectedLineSpacing] = useState<string>("1");
  const [customLineSpacing, setCustomLineSpacing] = useState<string>("");

  const FONTS = [
    { label: "Arial", value: "Arial, sans-serif" },
    { label: "Times New Roman", value: "'Times New Roman', serif" },
    { label: "Courier New", value: "'Courier New', monospace" },
    { label: "Calibri", value: "Calibri, sans-serif" },
    { label: "Georgia", value: "Georgia, serif" },
    { label: "Verdana", value: "Verdana, sans-serif" },
  ];

  const FONT_SIZES = ["10px", "11px", "12px", "14px", "16px", "18px", "20px", "24px", "32px"];

  const LINE_SPACING_PRESETS = [
    { label: "0.3", value: "0.3" },
    { label: "0.5", value: "0.5" },
    { label: "Single", value: "1" },
    { label: "1.15", value: "1.15" },
    { label: "1.5", value: "1.5" },
    { label: "Double", value: "2" },
    { label: "2.5", value: "2.5" },
    { label: "Triple", value: "3" },
  ];

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

  const applyLineSpacing = (spacing: string) => {
    const iframes = document.querySelectorAll('iframe[title="Visual HTML Editor"]');
    if (iframes.length === 0) return;

    let iframe = iframes[0] as HTMLIFrameElement;
    if (iframes.length > 1) {
      const visibleIframe = Array.from(iframes).find(f => {
        const rect = f.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) as HTMLIFrameElement;
      if (visibleIframe) iframe = visibleIframe;
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const selection = doc.getSelection();
    if (!selection || selection.toString().length === 0) {
      toast.error("Please select text or paragraphs to change line spacing");
      return;
    }

    const range = selection.getRangeAt(0);
    const blockElements = new Set<HTMLElement>();

    // Helper function to find closest block-level parent
    const getBlockParent = (node: Node): HTMLElement | null => {
      let element = node.nodeType === 3 ? (node.parentElement as HTMLElement) : (node as HTMLElement);

      while (element && element !== doc.body && !['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(element.tagName)) {
        element = element.parentElement as HTMLElement;
      }

      return element && element !== doc.body ? element : null;
    };

    // Get start block
    const startBlock = getBlockParent(range.startContainer);
    if (startBlock) blockElements.add(startBlock);

    // Get end block
    const endBlock = getBlockParent(range.endContainer);
    if (endBlock) blockElements.add(endBlock);

    // If selection spans multiple blocks, get all blocks in between
    if (range.startContainer !== range.endContainer && startBlock && endBlock && startBlock !== endBlock) {
      let current = startBlock.nextElementSibling as HTMLElement;

      while (current && current !== endBlock) {
        if (['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(current.tagName)) {
          blockElements.add(current);
        }
        current = current.nextElementSibling as HTMLElement;
      }
    }

    // Apply line spacing to all selected blocks
    if (blockElements.size === 0) {
      toast.error("Please select text or paragraphs to change line spacing");
      return;
    }

    blockElements.forEach(block => {
      (block as HTMLElement).style.lineHeight = spacing;
    });

    toast.success(`Line spacing applied to ${blockElements.size} paragraph${blockElements.size > 1 ? 's' : ''}`);

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

  const handleLineSpacingChange = (spacingValue: string) => {
    setSelectedLineSpacing(spacingValue);
    applyLineSpacing(spacingValue);
  };

  const handleCustomLineSpacing = () => {
    if (!customLineSpacing.trim()) {
      toast.error("Please enter a line spacing value");
      return;
    }

    const value = parseFloat(customLineSpacing);
    if (isNaN(value) || value <= 0) {
      toast.error("Please enter a valid number greater than 0");
      return;
    }

    applyLineSpacing(customLineSpacing);
    setSelectedLineSpacing(customLineSpacing);
    setCustomLineSpacing("");
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

  const insertVariable = (variable: string) => {
    // Check if we are in VisualHtmlEditor mode or ReactQuill mode
    const isVisualEditor = editorContent.toLowerCase().includes('<!doctype') || 
                           editorContent.toLowerCase().includes('<html') || 
                           editorContent.toLowerCase().includes('<body');

    if (isVisualEditor && !isHtmlMode) {
      // Handle VisualHtmlEditor variable insertion
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
        doc.execCommand('insertText', false, variable);
        
        // Trigger input event
        const event = new Event('input', { bubbles: true });
        doc.body.dispatchEvent(event);
      }
    } else if (isHtmlMode) {
      // Just insert the text at current cursor position in textarea
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end, text.length);
        setEditorContent(before + variable + after);
        
        // Update selection after state update
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + variable.length, start + variable.length);
        }, 10);
      }
    } else {
      // Handle ReactQuill variable insertion
      const ref = isPoppedOut ? quillRefPopped : quillRef;
      if (ref.current) {
        const editor = ref.current.getEditor();
        const range = editor.getSelection() || { index: editor.getLength(), length: 0 };
        editor.insertText(range.index, variable);
        editor.setSelection(range.index + variable.length, 0);
      }
    }
    
    navigator.clipboard.writeText(variable);
    toast.success(`Added ${variable}`);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Auto-trim image based on content color/transparency
      const trimmedFile = await trimImage(file);
      const compressedFile = await compressFile(trimmedFile);
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

          // Detect if cursor is inside a table cell
          let isInCell = false;
          const selection = doc.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const commonAncestor = range.commonAncestorContainer as HTMLElement;
            const cell = commonAncestor.nodeType === 3
              ? (commonAncestor.parentElement as HTMLElement)?.closest('td,th')
              : (commonAncestor as HTMLElement)?.closest('td,th');
            isInCell = !!cell;
          }

          // Insert image with appropriate styling (cell vs document)
          const imgStyle = isInCell
            ? "max-width: 100%; height: auto; max-height: 120px; display: block; margin: 4px 0; cursor: pointer; border: 1px solid #ddd; border-radius: 4px;"
            : "max-width: 100%; height: auto; display: inline-block; cursor: nwse-resize; border: 1px dashed transparent;";
          const imgHtml = `<img src="${publicUrl}" class="template-image" style="${imgStyle}" />`;
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
    const table = tables.find(t => t.id === id);
    if (!table) return;

    const isVisualEditorActive = !isHtmlMode && (
      editorContent.toLowerCase().includes('<!doctype') ||
      editorContent.toLowerCase().includes('<html') ||
      editorContent.toLowerCase().includes('<body') ||
      editorContent.toLowerCase().includes('<style')
    );

    if (isVisualEditorActive) {
      // Insert actual table HTML into VisualHtmlEditor iframe
      const tableHtml = generateTableHtml(table);
      const iframes = document.querySelectorAll('iframe[title="Visual HTML Editor"]');
      let targetIframe = iframes[0] as HTMLIFrameElement;
      if (iframes.length > 1) {
        const visible = Array.from(iframes).find(f => {
          const r = f.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }) as HTMLIFrameElement;
        if (visible) targetIframe = visible;
      }
      if (targetIframe) {
        const iframeDoc = targetIframe.contentDocument || targetIframe.contentWindow?.document;
        if (iframeDoc) {
          targetIframe.contentWindow?.focus();
          iframeDoc.execCommand('insertHTML', false, tableHtml);
          iframeDoc.body.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      setShowTableDialog(false);
    } else if (isHtmlMode) {
      // Insert HTML table into textarea at cursor
      const tableHtml = generateTableHtml(table);
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        setEditorContent(editorContent.substring(0, start) + tableHtml + editorContent.substring(end));
      } else {
        setEditorContent(editorContent + tableHtml);
      }
      setShowTableDialog(false);
    } else {
      // ReactQuill mode — insert placeholder text
      const ref = isPoppedOut ? quillRefPopped : quillRef;
      if (ref.current) {
        const editor = ref.current.getEditor();
        const range = selectionRange || editor.getSelection() || { index: editor.getLength(), length: 0 };
        editor.insertText(range.index, `{table.${id}}`);
        setShowTableDialog(false);
      }
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
            // Match padding: [top]mm [right]mm [bottom]mm [left]mm with optional spaces
            const match = html.match(/padding\s*:\s*(\d+)\s*mm\s+(\d+)\s*mm\s+(\d+)\s*mm\s+(\d+)\s*mm/i);
            if (match) {
              return { top: parseInt(match[1]), right: parseInt(match[2]), bottom: parseInt(match[3]), left: parseInt(match[4]) };
            }
            // Fallback for old format
            const matchOld = html.match(/padding\s*:\s*0mm\s+(\d+)\s*mm\s+0mm\s+(\d+)\s*mm/i) || html.match(/padding\s*:\s*20mm\s+(\d+)\s*mm\s+20mm\s+(\d+)\s*mm/i);
            if (matchOld) {
              return { top: 0, right: parseInt(matchOld[1]), bottom: 0, left: parseInt(matchOld[2]) };
            }
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
      const templates = data || [];
      setTemplateList(templates);
      
      // If no templates exist for this type, ensure editor is closed to show the drop zone
      if (templates.length === 0) {
        setShowEditor(false);
        setCurrentTemplate(null);
        setActiveTemplate(null);
        setEditorContent("");
      }
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
    setPreviewData(null);

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
          if (settings.position) {
            setBackgroundPosition(settings.position);
          } else {
            setBackgroundPosition({ x: 50, y: 50 });
          }
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
          setPageMargins({ left: 0, right: 0, top: 0, bottom: 0 });
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

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    const totalFiles = files.length;
    let successCount = 0;
    setUploadProgress({ current: 0, total: totalFiles, currentFileName: "" });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(prev => ({ ...prev, current: i + 1, currentFileName: file.name }));
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt || '');
      const limit = isImage ? 1 * 1024 * 1024 : 5 * 1024 * 1024;
      const limitLabel = isImage ? "1MB" : "5MB";

      // Check file size (1MB images, 5MB documents)
      if (file.size > limit) {
        toast.error(`"${file.name}" is too large. Max ${limitLabel} allowed.`);
        continue;
      }

      // Helper to auto-save and load content
      const autoSaveAndLoad = async (content: string, fileName: string, originalFilePath?: string) => {
        try {
          const baseName = fileName.replace(/\.[^/.]+$/, "");
          
          // 1. Check for duplicate names and handle running number
          let templateName = baseName;
          let counter = 1;
          
          const { data: existingTemplates } = await supabase
            .from('document_templates')
            .select('name')
            .ilike('name', `${baseName}%`);

          if (existingTemplates && existingTemplates.length > 0) {
            const names = existingTemplates.map(t => t.name.toLowerCase());
            while (names.includes(templateName.toLowerCase())) {
              templateName = `${baseName} (${counter})`;
              counter++;
            }
          }
          
          // Prepare template settings
          const settings: TemplateSettings = {
            pageMargins: pageMargins
          };
          
          if (originalFilePath) {
            settings.original_file_path = originalFilePath;
          }

          // 2. Save to database
          const { data: savedTemplate, error: dbError } = await supabase
            .from('document_templates')
            .insert({
              name: templateName,
              document_type: selectedType,
              content: content,
              is_default: templateList.length === 0 && i === 0, // Only set default if it's the first and list is empty
              template_settings: settings
            })
            .select()
            .single();

          if (dbError) throw dbError;

          // 3. Log activity
          logActivity(supabase, 'insert', 'document_templates', savedTemplate.id, { name: templateName, document_type: selectedType });

          // 4. Update state to show the new template immediately (only for the last file or if only one file)
          if (i === totalFiles - 1) {
            setEditorContent(content);
            setCurrentTemplate(templateName);
            setActiveTemplate(savedTemplate);
            setShowEditor(true);
            setIsHtmlMode(false);
          }
          
          successCount++;
        } catch (error: any) {
          console.error("Auto-save error:", error);
          toast.error(`Upload succeeded but auto-save failed for "${fileName}": ${error.message}`);
        }
      };

      try {
        if (fileExt === 'docx' || fileExt === 'doc') {
          const originalFileName = `original_${Date.now()}_${file.name}`;
          const originalFilePath = `templates/originals/${originalFileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(originalFilePath, file);
            
          if (uploadError) throw uploadError;

          const placeholderHtml = wrapInA4(`
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 500px; text-align: center; color: #64748b; font-family: Arial, sans-serif; padding: 40px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; margin: 40px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; color: #4f46e5;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
              <h2 style="font-size: 24px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">Word Document Template</h2>
              <p style="font-size: 16px; max-width: 400px; line-height: 1.5;">This template uses an original <b>${fileExt.toUpperCase()}</b> file to ensure 100% formatting fidelity.</p>
              <p style="font-size: 14px; margin-top: 24px; padding: 16px; background: #e0e7ff; color: #3730a3; border-radius: 8px; font-weight: 500;">Please use the <b>DIRECT PDF</b> button to generate documents. The HTML editor is disabled for this template to prevent layout shifting.</p>
            </div>
          `);

          await autoSaveAndLoad(placeholderHtml, file.name, originalFilePath);
        } else if (fileExt === 'html') {
          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });
          const htmlContent = wrapInA4(content);
          await autoSaveAndLoad(htmlContent, file.name);
        } else {
          // Other files
          const compressedFile = await compressFile(file);
          const fileName = `${selectedType}_${Date.now()}.${fileExt}`;
          const filePath = `templates/${fileName}`;

          const { error } = await supabase.storage
            .from('media')
            .upload(filePath, compressedFile);

          if (error) throw error;
          await updateTemplateSetting(filePath);
          successCount++;
        }
      } catch (error: any) {
        console.error(`Error processing "${file.name}":`, error);
        toast.error(`Failed to process "${file.name}": ${error.message}`);
      }
    }

    if (successCount > 0) {
      if (totalFiles > 1) {
        toast.success(`Successfully uploaded ${successCount} of ${totalFiles} files`);
      }
      await fetchTemplates();
    }
    setUploading(false);
    setUploadProgress({ current: 0, total: 0, currentFileName: "" });
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    await processFiles(event.target.files);
    event.target.value = ''; // Reset input for next document
  };

  const handleExistingDocxToPdf = async () => {
    if (!activeTemplate) {
      toast.error("Please select a template from the list first.");
      return;
    }

    if (!testBookingId) {
      toast.error("Please enter a Booking Reference first to provide variable data.");
      return;
    }

    const originalPath = activeTemplate.template_settings?.original_file_path;
    
    if (!originalPath) {
      toast.error("This template doesn't have an original Word file associated with it. Please upload it again as a .docx file.");
      return;
    }

    setUploading(true);
    const toastId = toast.loading(`Generating PDF from original Word template...`);

    try {
      // 1. Download the original file from Supabase Storage
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('media')
        .download(originalPath);

      if (downloadError) throw downloadError;

      // 2. Prepare variable data from the selected booking
      const variableData: Record<string, any> = {};
      if (selectedBookingData) {
        AVAILABLE_VARIABLES.forEach(cat => {
          cat.vars.forEach(v => {
            const cleanVar = v.replace(/[{}]/g, '');
            variableData[cleanVar] = getVariableValue(v, selectedBookingData);
          });
        });
      }

      // 3. Send to Fly.io for direct conversion
      const formData = new FormData();
      // Reconstruct the file object from the blob
      const fileName = originalPath.split('/').pop() || 'template.docx';
      const file = new File([fileBlob], fileName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      formData.append('file', file);
      formData.append('variables', JSON.stringify(variableData));

      const response = await fetch(`${pdfApiUrl}/api/direct-docx-to-pdf`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || `Server error ${response.status}`);
      }

      // 4. Download the resulting PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTemplate.name}_${testBookingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("PDF generated and downloaded successfully!", { id: toastId });
    } catch (error: any) {
      console.error("Direct PDF conversion error:", error);
      toast.error(`Direct PDF failed: ${error.message}`, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadOriginalWordTemplate = async (template: DocumentTemplate) => {
    const originalPath = template.template_settings?.original_file_path;

    if (!originalPath) {
      toast.error("No original Word file found for this template.");
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Downloading original Word file...");

    try {
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('media')
        .download(originalPath);

      if (downloadError) throw downloadError;

      const fileExt = originalPath.split('.').pop() || 'docx';
      const fileName = `${template.name}.${fileExt}`;

      const url = window.URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Downloaded successfully", { id: toastId });
    } catch (error: any) {
      console.error("Original file download error:", error);
      toast.error(`Download failed: ${error.message}`, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const buildTemplateShareUrl = (template: DocumentTemplate): string => {
    const name = template.name.toLowerCase();
    if (name.includes("flight-information")) {
      return `${window.location.origin}/flight-information.html`;
    }

    if (template.template_settings?.public_url) {
      return template.template_settings.public_url;
    }

    const params = new URLSearchParams({
      type: template.document_type,
      template: template.id,
      preview: 'true',
    });
    return `${window.location.origin}/pdf-render?${params.toString()}`;
  };

  const handleCopyUrl = (template: DocumentTemplate) => {
    const url = buildTemplateShareUrl(template);
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard!");
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
        .upload(filePath, compressedFile, { upsert: true, cacheControl: '31536000' });

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

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>, position: 'top' | 'bottom') => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Banner image size exceeds the 1MB limit.");
      event.target.value = '';
      return;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    setUploading(true);
    try {
      const compressedFile = await compressFile(file);
      const fileName = `banner_${position}_${selectedType}_${Date.now()}.${fileExt}`;
      const filePath = `backgrounds/${fileName}`;

      const { error } = await supabase.storage.from('media').upload(filePath, compressedFile, { upsert: true, cacheControl: '31536000' });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);

      if (position === 'top') {
        setTopBanner(publicUrl);
      } else {
        setBottomBanner(publicUrl);
      }
      toast.success(`${position === 'top' ? 'Top' : 'Bottom'} banner uploaded`);
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

      // 2. Sanitize content (strip editor-only artifacts like blue outlines)
      const sanitizeHtml = (html: string) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        doc.querySelectorAll('*').forEach(el => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style) {
            const styleAttr = htmlEl.getAttribute('style') || '';
            if (styleAttr.includes('#3b82f6') || styleAttr.includes('59, 130, 246')) {
              htmlEl.style.outline = '';
              htmlEl.style.outlineOffset = '';
              htmlEl.style.border = '';
            }
            if (styleAttr.includes('#6366f1') || styleAttr.includes('99, 102, 241')) {
              htmlEl.style.boxShadow = '';
              htmlEl.style.backgroundColor = '';
              htmlEl.style.outline = '';
              htmlEl.style.outlineOffset = '';
            }
            if (htmlEl.style.opacity === '0.5' || htmlEl.style.opacity === '0.7') htmlEl.style.opacity = '';
            if (htmlEl.style.cursor === 'move' || htmlEl.style.cursor === 'grab' || htmlEl.style.cursor === 'grabbing' || htmlEl.style.cursor === 'nwse-resize') {
              htmlEl.style.cursor = '';
            }
            if (htmlEl.style.zIndex === '1000') htmlEl.style.zIndex = '';
            if (htmlEl.getAttribute('style') === '') htmlEl.removeAttribute('style');
          }
          el.removeAttribute('data-draggable');
        });
        
        doc.getElementById('img-toolbar')?.remove();
        doc.getElementById('tbl-merge-bar')?.remove();
        doc.getElementById('tbl-ctx-menu')?.remove();
        doc.getElementById('editor-styles')?.remove();
        
        // Remove background layers before saving (they are re-injected by the editor/preview)
        doc.querySelectorAll('.bg-layer, .top-banner-layer, .bottom-banner-layer').forEach(el => el.remove());

        if (html.toLowerCase().includes('<html')) {
          return doc.documentElement.outerHTML;
        }
        return doc.body.innerHTML;
      };

      const finalContent = sanitizeHtml(editorContent);

      // 3. Save to document_templates table
      // Find the template with this name to get its ID for overwrite
      const targetTemplate = templateList.find(t => t.name === templateName);
      const isFirst = templateList.length === 0;
      
      const templateSettings: TemplateSettings = {
        backgroundImage,
        backgroundOpacity,
        backgroundStyle,
        backgroundPosition,
        backgroundSize,
        pageMargins,
        topBanner,
        topBannerOpacity,
        bottomBanner,
        bottomBannerOpacity
      };

      const { data: savedTemplate, error: dbError } = await supabase
        .from('document_templates')
        .upsert({
          id: targetTemplate?.id,
          name: templateName,
          document_type: selectedType,
          content: finalContent,
          is_default: targetTemplate ? targetTemplate.is_default : isFirst,
          template_settings: templateSettings,
        }, { onConflict: 'id' })
        .select()
        .single();

      if (dbError) throw dbError;

      // 4. Update state
      setCurrentTemplate(templateName);
      fetchTemplates();
      logActivity(supabase, targetTemplate ? 'update' : 'insert', 'document_templates', savedTemplate.id, { name: templateName, document_type: selectedType });
      toast.success(`Template "${templateName}" saved successfully`);
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(`Failed to save template: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTemplate = (template: DocumentTemplate) => {
    setCurrentTemplate(template.name);
    setActiveTemplate(template);
    const contentToEdit = wrapInA4(template.content);
    setEditorContent(contentToEdit);
    setShowEditor(true);

    // Apply this template's own background & page settings (falls back to current state if absent)
    const ts = template.template_settings;
    if (ts) {
      setBackgroundImage(ts.backgroundImage ?? '');
      setBackgroundOpacity(ts.backgroundOpacity ?? 0.15);
      setBackgroundStyle(ts.backgroundStyle ?? 'center');
      setBackgroundPosition(ts.backgroundPosition ?? { x: 50, y: 50 });
      setBackgroundSize(ts.backgroundSize ?? { width: 100, height: 100 });
      setPageMargins(ts.pageMargins ?? { left: 8, right: 8, top: 8, bottom: 8 });
      setTopBanner(ts.topBanner ?? '');
      setTopBannerOpacity(ts.topBannerOpacity ?? 1.0);
      setBottomBanner(ts.bottomBanner ?? '');
      setBottomBannerOpacity(ts.bottomBannerOpacity ?? 1.0);
    } else {
      // No per-template settings saved yet — reset to neutral defaults
      setBackgroundImage('');
      setBackgroundOpacity(0.15);
      setBackgroundStyle('center');
      setBackgroundPosition({ x: 50, y: 50 });
      setPageMargins({ left: 0, right: 0, top: 0, bottom: 0 });
      setTopBanner('');
      setTopBannerOpacity(1.0);
      setBottomBanner('');
      setBottomBannerOpacity(1.0);
    }

    // Brief loading overlay so the iframe re-renders with fresh content
    setTimeout(() => {
      setIsLoadingTemplate(true);
      setEditorContent(contentToEdit);
      setTimeout(() => setIsLoadingTemplate(false), 800);
    }, 1000);
  };

  const handleSetDefaultTemplate = async (templateId: string) => {
    if (!supabase) return;
    if (!canEdit) {
      toast.error("Read-only mode: cannot set default template");
      return;
    }
    
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
    if (!supabase) return;
    if (!canEdit) {
      toast.error("Read-only mode: cannot delete templates");
      return;
    }
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      logActivity(supabase, 'delete', 'document_templates', templateId);
      toast.success("Template deleted");
      setSelectedTemplateIds(prev => prev.filter(id => id !== templateId));
      
      // If the deleted template was the one being edited, close the editor
      if (activeTemplate?.id === templateId) {
        setShowEditor(false);
        setCurrentTemplate(null);
        setActiveTemplate(null);
        setEditorContent("");
      }

      await fetchTemplates();
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

      logActivity(supabase, 'bulk_delete', 'document_templates', selectedTemplateIds.join(','), { count: selectedTemplateIds.length });
      toast.success(`${selectedTemplateIds.length} template(s) deleted`);
      
      // If any of the deleted templates was the one being edited, close the editor
      if (activeTemplate && selectedTemplateIds.includes(activeTemplate.id)) {
        setShowEditor(false);
        setCurrentTemplate(null);
        setActiveTemplate(null);
        setEditorContent("");
      }

      setSelectedTemplateIds([]);
      await fetchTemplates();
    } catch (error: any) {
      toast.error(`Bulk delete failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDownloadTemplates = async () => {
    if (selectedTemplateIds.length === 0) return;

    const templatesToDownload = templateList.filter(t => selectedTemplateIds.includes(t.id));
    const toastId = toast.loading(`Preparing ${templatesToDownload.length} files for download...`);

    try {
      for (const template of templatesToDownload) {
        const originalPath = template.template_settings?.original_file_path;
        
        if (originalPath && (originalPath.toLowerCase().endsWith('.doc') || originalPath.toLowerCase().endsWith('.docx'))) {
          // Download Word file
          const { data: fileBlob, error: downloadError } = await supabase.storage
            .from('media')
            .download(originalPath);

          if (downloadError) throw downloadError;

          const fileExt = originalPath.split('.').pop() || 'docx';
          const fileName = `${template.name}.${fileExt}`;

          const url = window.URL.createObjectURL(fileBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          // Download HTML file
          const blob = new Blob([template.content], { type: 'text/html' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${template.name}.html`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
        // Small delay to prevent browser from blocking multiple downloads
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      toast.success("All selected templates downloaded!", { id: toastId });
    } catch (error: any) {
      console.error("Bulk download error:", error);
      toast.error(`Download failed: ${error.message}`, { id: toastId });
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
    if (!canEdit) {
      toast.error("Read-only mode: cannot rename templates");
      return;
    }

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

  const handleBulkPrintDocs = async () => {
    if (!supabase || selectedDocIds.length === 0) return;
    
    const loadingToast = toast.loading(`Preparing ${selectedDocIds.length} document(s) for printing...`);
    
    try {
      // 1. Fetch document details for the selected IDs
      const { data: docs, error: fetchError } = await supabase
        .from('generated_documents')
        .select(`
          *,
          bookings(
            booking_id,
            booking_reference
          )
        `)
        .in('id', selectedDocIds);

      if (fetchError) throw fetchError;
      if (!docs || docs.length === 0) throw new Error("No documents found");

      // 2. Generate HTML for each document
      const htmlResults = [];
      let firstOrientation: 'portrait' | 'landscape' = 'portrait';
      let firstPageSize: 'A4' | 'Letter' = 'A4';
      let firstWidthMm = 210;
      let firstHeightMm = 297;
      let firstWindowW = 793.7;
      let firstWindowH = 1122.5;

      for (const doc of docs) {
        try {
          const result = await generateAndPreviewPDF(
            doc.booking_id || doc.bookings?.booking_id,
            doc.document_type
          );
          htmlResults.push(result.html);
          
          if (htmlResults.length === 1) {
            if (result.orientation) firstOrientation = result.orientation as 'portrait' | 'landscape';
            if (result.pageSize) firstPageSize = result.pageSize as 'A4' | 'Letter';
            if (result.widthMm) firstWidthMm = result.widthMm;
            if (result.heightMm) firstHeightMm = result.heightMm;
            if (result.windowW) firstWindowW = result.windowW;
            if (result.windowH) firstWindowH = result.windowH;
          }
        } catch (docError: any) {
          console.error(`Error generating doc ${doc.id} for bulk print:`, docError);
        }
      }

      if (htmlResults.length === 0) throw new Error("Failed to generate any documents for printing");

      // 3. Show preview dialog instead of opening print window directly
      // This ensures consistency and allows the user to see the page breaks
      const firstDoc = docs[0];
      setPreviewData({
        html: htmlResults.map(html => {
          if (html.includes('class="print-page"')) return html;
          return `<div class="print-page">${html}</div>`;
        }).join('<div class="page-break"></div>'),
        title: `Bulk Print - ${htmlResults.length} Documents`,
        docType: "bulk",
        bookingId: firstDoc.booking_id || firstDoc.bookings?.booking_id,
        bookingReference: "BULK",
        orientation: firstOrientation,
        pageSize: firstPageSize,
        widthMm: firstWidthMm,
        heightMm: firstHeightMm,
        windowW: firstWindowW,
        windowH: firstWindowH
      });
      
      toast.success(`Successfully prepared ${htmlResults.length} documents for preview.`, { id: loadingToast });
    } catch (error: any) {
      console.error("Bulk print error:", error);
      toast.error(`Preparation failed: ${error.message}`, { id: loadingToast });
    }
  };

  const handleBulkDownloadSelectedDocs = async () => {
    if (!supabase || selectedDocIds.length === 0) return;
    
    const loadingToast = toast.loading(`Preparing ${selectedDocIds.length} document(s) for download...`);
    
    try {
      // 1. Fetch document details for the selected IDs
      const { data: docs, error: fetchError } = await supabase
        .from('generated_documents')
        .select(`
          *,
          bookings(
            booking_reference
          )
        `)
        .in('id', selectedDocIds);

      if (fetchError) throw fetchError;
      if (!docs || docs.length === 0) throw new Error("No documents found");

      // 2. Download each document
      for (const doc of docs) {
        try {
          const { data, error } = await supabase.storage
            .from('media')
            .download(doc.file_path);
          
          if (error) {
            // Fallback for No API key / 400 errors as in downloadDoc
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
            
            // Small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 500));
            
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          } else {
            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${doc.document_type}_${doc.bookings?.booking_reference || doc.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            
            // Small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 500));
            
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }
        } catch (docError: any) {
          console.error(`Error downloading doc ${doc.id}:`, docError);
          toast.error(`Failed to download ${doc.document_type}`);
        }
      }
      
      toast.success(`Successfully downloaded ${selectedDocIds.length} documents.`, { id: loadingToast });
    } catch (error: any) {
      console.error("Bulk download error:", error);
      toast.error(`Download failed: ${error.message}`, { id: loadingToast });
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
    if (!previewData) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const isLandscape = previewData.orientation === 'landscape';
      const paperSize = previewData.pageSize || 'A4';
      const orientationStr = isLandscape ? 'landscape' : 'portrait';

      // Check if it's a single page (no page-break class and fits in one windowH)
      const isSinglePage = !previewData.html.includes('class="page-break"');
      const marginVal = '0';
      
      printWindow.document.write(`
        <html>
          <head>
            <title>${previewData.title}</title>
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

  const handleTestGenerate = async () => {
    if (!testBookingId) {
      toast.error("Please enter a Booking Reference or ID");
      return;
    }

    setIsGenerating(true);
    try {
      const selectedBooking = latestBookings.find((booking) => booking.booking_reference === testBookingId);
      let bookingId = selectedBooking?.booking_id;
      let bookingReference = selectedBooking?.booking_reference || testBookingId;

      if (!bookingId) {
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select('booking_id, booking_reference')
          .eq('booking_reference', testBookingId)
          .single();

        if (bookingError || !booking) {
          throw new Error("Booking not found");
        }

        bookingId = booking.booking_id;
        bookingReference = booking.booking_reference || testBookingId;
      }

      const passengerId = selectedBookingData?.booking_passengers?.[0]?.id;
      const currentTemplateObj = templateList.find(t => t.name === currentTemplate);
      const result = await generateAndPreviewPDF(bookingId, selectedType, passengerId, 'portrait', 'A4', pageMargins, currentTemplateObj?.id);

      if (!result || !result.html) {
        throw new Error("No print content generated");
      }

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
      toast.success("Sending to printer...");
    } catch (error: any) {
      console.error("Print error:", error);
      toast.error(`Failed to generate document: ${error.message}`);
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
    <div className="flex flex-col lg:grid lg:grid-cols-8 gap-3 sm:gap-6 p-1.5 sm:p-4 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full min-w-0">
      <div className="lg:col-span-6 space-y-3 sm:space-y-6 min-w-0 w-full max-w-full">
        <Card className="overflow-hidden border-none bg-white/50 backdrop-blur-sm shadow-xl shadow-slate-100/50 rounded-[1.25rem] sm:rounded-[2.5rem] transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50 w-full max-w-full">
          <CardContent className="p-3.5 sm:p-8 space-y-5 sm:space-y-8 pt-6 sm:pt-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
              <div className="space-y-2.5 sm:space-y-4">
                <div className="flex items-center justify-between px-1">
                  <Label className="text-[9px] sm:text-xs font-bold uppercase tracking-tight text-slate-600">Document Type</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tight">{documentTypes.length} Types</span>
                    <div className="flex items-center gap-1.5 border-l border-slate-200 ml-2 pl-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 rounded-full hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 transition-all"
                        onClick={handleAddDocumentType}
                        title="Add Type"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 rounded-full hover:bg-amber-50 hover:text-amber-600 text-slate-400 transition-all"
                        onClick={handleRenameDocumentType}
                        disabled={!selectedType || !canEdit}
                        title="Rename Type"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 rounded-full hover:bg-red-50 hover:text-red-600 text-slate-400 transition-all"
                        onClick={handleDeleteDocumentType}
                        disabled={!selectedType || !canEdit}
                        title="Delete Type"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-full h-12 sm:h-14 border-black rounded-xl sm:rounded-2xl bg-slate-50/50 focus:ring-2 focus:ring-indigo-100 transition-all text-[11px] sm:text-xs font-bold uppercase tracking-tight shadow-sm">
                    <SelectValue placeholder="Select Document Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl sm:rounded-2xl border-black shadow-2xl">
                    {documentTypes.map((type) => (
                      <SelectItem 
                        key={type.value} 
                        value={type.value}
                        className="px-4 sm:px-6 py-3 sm:py-3 font-bold uppercase tracking-tight text-[10px] sm:text-[10px] cursor-pointer focus:bg-slate-700 focus:text-white"
                      >
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-600 ml-1">Upload or Create Template</Label>
                <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-tight text-slate-500 ml-1 mt-1 leading-tight">Support DOCX, DOC and HTML only</p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative group flex-1">
                    <Input 
                      type="file" 
                      accept=".docx,.doc,.html,.pdf"
                      multiple
                      onChange={handleUpload}
                      disabled={uploading || !canEdit}
                      className="w-full h-12 sm:h-14 border-none rounded-full bg-slate-50/50 border border-black/5 sm:bg-transparent sm:border-none focus:ring-0 transition-all text-transparent file:mr-3 sm:file:mr-4 file:h-full file:border-0 file:rounded-full file:text-[10px] sm:file:text-xs file:font-bold file:uppercase file:tracking-tight file:bg-slate-700 file:text-white file:hover:bg-slate-700/90 file:transition-all file:px-4 sm:file:px-6 shadow-none overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {uploading && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-5 h-5 sm:w-5 sm:h-5 animate-spin text-slate-600" />
                      </div>
                    )}
                  </div>
                  <Button 
                    className="h-12 sm:h-14 px-6 sm:px-8 font-bold uppercase tracking-tight text-[11px] sm:text-xs rounded-full shrink-0 shadow-lg sm:shadow-none" 
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => {
                      const blankA4 = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body>
<div class="page-a4" style="padding: 20mm 20mm 20mm 20mm;">
  <p><br></p>
</div>
</body>
</html>`;
                      setEditorContent(blankA4);
                      setCurrentTemplate(null);
                      setShowEditor(true);
                      setIsHtmlMode(false);
                      setBackgroundImage("");
                      setTopBanner("");
                      setBottomBanner("");
                      setPageMargins({ top: 8, right: 8, bottom: 8, left: 8 });
                    }}
                  >
                    <Plus className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">New</span>
                    <span className="sm:hidden">Blank Template</span>
                  </Button>
                </div>
              </div>
            </div>



            {/* Template List Section */}
            {templateList.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-black/5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-1">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-600 leading-tight">
                      Available Templates {currentTemplate && <span className="text-slate-500 lowercase font-bold hidden sm:inline">({currentTemplate})</span>}
                    </Label>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{templateList.length} Templates</span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="h-10 sm:h-9 border-black/10 bg-white text-slate-600 hover:bg-slate-50 font-bold uppercase tracking-tight text-[10px] sm:text-[9px] rounded-lg px-4 flex-1 sm:flex-initial items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={handleSelectAllTemplates}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectAllTemplates();
                          }
                        }}
                        className="inline-flex items-center justify-center gap-1.5"
                      >
                        <Checkbox
                          checked={selectedTemplateIds.length === templateList.length && templateList.length > 0}
                          onCheckedChange={handleSelectAllTemplates}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 border-black/20"
                        />
                        {selectedTemplateIds.length === templateList.length ? 'Deselect All' : 'Select All'}
                      </div>
                    </Button>

                    {selectedTemplateIds.length > 0 && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleBulkDownloadTemplates}
                          className="h-10 sm:h-9 border-black/10 bg-slate-700 text-white hover:bg-slate-800 font-bold uppercase tracking-tight text-[10px] sm:text-[9px] rounded-lg px-4 flex-1 sm:flex-initial items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                        >
                          <FileDown className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> DOWNLOAD ({selectedTemplateIds.length})
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleBulkDeleteTemplates}
                          className="h-10 sm:h-9 border-red-100 bg-red-50 text-red-600 hover:bg-red-100 font-bold uppercase tracking-tight text-[10px] sm:text-[9px] rounded-lg px-4 flex-1 sm:flex-initial items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                        >
                          <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> DELETE ({selectedTemplateIds.length})
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {templateList.map((template) => {
                    const isSelected = currentTemplate === template.name;
                    const originalPath = template.template_settings?.original_file_path;
                    const hasWordOriginal =
                      typeof originalPath === 'string' &&
                      (originalPath.toLowerCase().endsWith('.doc') || originalPath.toLowerCase().endsWith('.docx'));
                    return (
                      <div 
                        key={template.id} 
                        onClick={() => handleSelectTemplate(template)}
                        className={`group relative flex flex-col p-4 sm:p-5 bg-white border border-black rounded-xl sm:rounded-2xl hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 gap-3 cursor-pointer ${isSelected ? 'bg-slate-50 ring-2 ring-indigo-100' : ''}`}
                      >
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 flex items-center gap-2">
                          <Checkbox 
                            checked={selectedTemplateIds.includes(template.id)}
                            onCheckedChange={() => toggleTemplateSelection(template.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-5 w-5 sm:h-4 sm:w-4 rounded-md border-black data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700"
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8 p-0 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                                <MoreVertical className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-black shadow-2xl">
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!canEdit) return;
                                  setIsRenaming(template.id);
                                  setNewName(template.name);
                                }}
                                disabled={!canEdit}
                                className={`gap-2 py-3 sm:py-2 text-[11px] sm:text-[10px] font-bold uppercase tracking-tight cursor-pointer ${!canEdit ? 'opacity-50 cursor-not-allowed text-slate-400' : ''}`}
                              >
                                <RefreshCw className="w-3.5 h-3.5 sm:w-3 sm:h-3" /> Rename
                              </DropdownMenuItem>
                              {hasWordOriginal && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadOriginalWordTemplate(template);
                                  }}
                                  className="gap-2 py-3 sm:py-2 text-[11px] sm:text-[10px] font-bold uppercase tracking-tight cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5 sm:w-3 sm:h-3" /> Download Word
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyUrl(template);
                                }}
                                className="gap-2 py-3 sm:py-2 text-[11px] sm:text-[10px] font-bold uppercase tracking-tight cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5 sm:w-3 sm:h-3" /> Copy URL
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!canEdit) return;
                                  handleDeleteTemplate(template.id);
                                }}
                                disabled={!canEdit}
                                className={`gap-2 py-3 sm:py-2 text-[11px] sm:text-[10px] font-bold uppercase tracking-tight cursor-pointer ${!canEdit ? 'opacity-50 cursor-not-allowed text-slate-400' : 'text-slate-500 focus:text-slate-500'}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className={`p-2.5 sm:p-2.5 w-fit rounded-lg sm:rounded-xl transition-all duration-500 ${
                            isSelected || template.is_default ? 'bg-slate-700 text-white shadow-lg shadow-slate-200/50' : 'bg-slate-50 text-slate-600 group-hover:bg-slate-700 group-hover:text-white'
                          }`}>
                            <FileText className="h-4.5 w-4.5 sm:h-4 sm:w-4" />
                          </div>
                          
                          <div className="flex flex-col min-w-0">
                            <div className="flex flex-col gap-1.5">
                              {isRenaming === template.id ? (
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Input
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="h-10 sm:h-8 text-[11px] sm:text-[10px] font-bold py-1 px-3 border-black focus:ring-1 bg-white min-w-[120px]"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenameTemplate(template.id, newName);
                                      if (e.key === 'Escape') setIsRenaming(null);
                                    }}
                                  />
                                  <Button 
                                    size="sm" 
                                    className="h-10 w-10 sm:h-8 sm:w-8 p-0 rounded-lg bg-slate-700 hover:bg-slate-700/90 flex items-center justify-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRenameTemplate(template.id, newName);
                                    }}
                                  >
                                    <Save className="w-4 h-4 sm:w-3 sm:h-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span 
                                  className={`text-[11px] sm:text-xs font-bold truncate transition-colors leading-tight ${
                                    isSelected || template.is_default ? 'text-slate-600' : 'text-slate-700'
                                  }`}
                                >
                                  {template.name}
                                </span>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {template.is_default && (
                                  <span className="px-2 py-0.5 bg-slate-700 text-white rounded-md sm:rounded-lg text-[9px] sm:text-[9px] font-bold uppercase tracking-tight shrink-0">
                                    Default
                                  </span>
                                )}
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md sm:rounded-lg border border-slate-200 text-[9px] sm:text-[9px] font-bold uppercase tracking-tight whitespace-nowrap">
                                  {template.document_type.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] sm:text-[10px] font-bold text-slate-400">
                                {format(new Date(template.created_at), 'MMM d, yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {!template.is_default && (
                          <div className="flex items-center gap-1.5 mt-auto pt-3 border-t border-black/5">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!canEdit}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetDefaultTemplate(template.id);
                            }}
                            className="w-full h-10 sm:h-8 px-3 rounded-lg border border-black/10 hover:border-slate-700 hover:bg-slate-700 hover:text-white transition-all text-[9px] sm:text-[9px] font-bold uppercase tracking-tight disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div 
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    await processFiles(e.dataTransfer.files);
                  }
                }}
                className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-[2rem] transition-all duration-300 gap-4 mt-8 ${
                  isDraggingOver 
                    ? 'border-slate-700 bg-slate-100/80 scale-[1.01] shadow-xl shadow-slate-200/50' 
                    : 'border-slate-300 bg-slate-50/30 text-slate-400'
                }`}
              >
                <div className={`p-4 bg-white rounded-full shadow-sm border border-slate-100 transition-transform duration-500 ${isDraggingOver ? 'scale-110 rotate-12' : ''}`}>
                  <Upload className={`w-8 h-8 transition-colors ${isDraggingOver ? 'text-slate-700 opacity-100' : 'opacity-20'}`} />
                </div>
                <div className="text-center">
                  <p className={`font-bold uppercase tracking-tight text-[11px] sm:text-xs transition-colors ${isDraggingOver ? 'text-slate-700' : 'text-slate-500'}`}>
                    {isDraggingOver ? 'Drop files to upload' : 'No Template Selected'}
                  </p>
                  <p className="text-[10px] font-bold mt-1">
                    {isDraggingOver ? 'Support DOCX, DOC and HTML' : 'Please select a template above or drag and drop files here to upload.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className={`space-y-4 sm:space-y-6 border border-black rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-8 bg-slate-50/50 backdrop-blur-md shadow-inner w-full max-w-full overflow-hidden ${isPoppedOut ? 'hidden' : ''}`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 w-full">


                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                      <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="p-2 sm:p-2.5 bg-slate-700/10 rounded-lg sm:rounded-xl">
                            <Code className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                          </div>
                          <div className="flex flex-col">
                            <h3 className="font-bold text-slate-900 uppercase tracking-tight text-[10px] sm:text-xs">Template Editor</h3>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] sm:text-[9px] text-slate-500 font-medium italic">Hover table to highlight · click & drag to move · drag edges to resize width</span>
                              <span className="text-[8px] sm:text-[9px] text-slate-600 font-bold">Cells: insert image · drag to merge · right-click for options</span>
                              <span className="text-[8px] sm:text-[9px] text-slate-600 font-bold">Images: click toolbar to insert · inside cells or document · drag to move</span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="lg:hidden h-8 px-2.5 text-[8px] font-bold uppercase tracking-tight rounded-lg border-slate-200 bg-slate-50 text-slate-600 flex items-center gap-1"
                          onClick={() => document.getElementById('variables-section')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                          <Info className="w-3 h-3" /> Variables
                        </Button>
                      </div>
                      <div className="flex flex-col gap-2 sm:gap-3 bg-white/50 p-2 sm:p-3 rounded-xl sm:rounded-[1.5rem] border border-black/10 shadow-sm w-full">
                        {/* Row 1: Font, Size, Line Spacing */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full">
                          <div className="flex flex-1 items-center gap-1.5 sm:gap-2 bg-white/60 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-black/10 shadow-sm">
                            <Select value={selectedFont} onValueChange={handleFontChange}>
                              <SelectTrigger className="h-9 flex-1 min-w-[100px] border-black/20 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-100 text-[10px] sm:text-xs font-bold px-2 sm:px-3">
                                <SelectValue placeholder="Font" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-black shadow-2xl max-h-[250px]">
                                {FONTS.map((font) => (
                                  <SelectItem key={font.value} value={font.value} className="rounded-lg py-2 text-[10px] sm:text-xs" style={{ fontFamily: font.value }}>
                                    {font.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select value={selectedSize} onValueChange={handleSizeChange}>
                              <SelectTrigger className="h-9 w-14 sm:w-20 border-black/20 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-100 text-[10px] sm:text-xs font-bold px-2">
                                <SelectValue placeholder="Size" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-black shadow-2xl max-h-[250px]">
                                {FONT_SIZES.map((size) => (
                                  <SelectItem key={size} value={size} className="rounded-lg py-2 text-[10px] sm:text-xs">
                                    {size}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select value={selectedLineSpacing} onValueChange={handleLineSpacingChange}>
                              <SelectTrigger className="h-9 w-20 sm:w-24 border-black/20 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-100 text-[10px] sm:text-xs font-bold px-2">
                                <SelectValue placeholder="Spacing" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-black shadow-2xl max-h-[250px]">
                                {LINE_SPACING_PRESETS.map((preset) => (
                                  <SelectItem key={preset.value} value={preset.value} className="rounded-lg py-2 text-[10px] sm:text-xs">
                                    {preset.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Formatting Buttons */}
                          <div className="flex items-center justify-between sm:justify-start gap-1 bg-white/60 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-black/10 shadow-sm">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => applyVisualCommand('bold', '')}
                                className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-slate-50 transition-all border border-black/10 shadow-sm active:scale-95"
                                title="Bold"
                              >
                                <Bold className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => applyVisualCommand('italic', '')}
                                className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-slate-50 transition-all border border-black/10 shadow-sm active:scale-95"
                                title="Italic"
                              >
                                <Italic className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => applyVisualCommand('underline', '')}
                                className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-slate-50 transition-all border border-black/10 shadow-sm active:scale-95"
                                title="Underline"
                              >
                                <Underline className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-1 sm:ml-2 pl-2 border-l border-black/10">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleUndo}
                                disabled={undoHistory.length <= 1}
                                className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-slate-50 transition-all border border-black/10 shadow-sm active:scale-95 shrink-0 disabled:opacity-30"
                                title="Undo (Last 3 changes)"
                              >
                                <Undo2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleRedo}
                                disabled={redoHistory.length === 0}
                                className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-slate-50 transition-all border border-black/10 shadow-sm active:scale-95 shrink-0 disabled:opacity-30"
                                title="Redo"
                              >
                                <Redo2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Search, Replace, Media */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full">
                          {/* Search and Replace */}
                          <div className="flex flex-col sm:flex-row items-stretch gap-1.5 sm:gap-2 flex-1 bg-white/60 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-black/10 shadow-sm">
                            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-black/10 shadow-inner flex-1">
                              <Search className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                              <input
                                type="text"
                                placeholder="Search keyword..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSearchHighlight();
                                }}
                                className="h-8 flex-1 bg-transparent border-none focus:ring-0 text-[10px] sm:text-xs font-medium placeholder:text-slate-300"
                              />
                            </div>
                            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-black/10 shadow-inner flex-1">
                              <RefreshCw className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                              <input
                                type="text"
                                placeholder="Replace with..."
                                value={replaceTerm}
                                onChange={(e) => setReplaceTerm(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSearchReplace();
                                }}
                                className="h-8 flex-1 bg-transparent border-none focus:ring-0 text-[10px] sm:text-xs font-medium placeholder:text-slate-300"
                              />
                            </div>
                          </div>

                          {/* Media & View Buttons */}
                          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 bg-white/60 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-black/10 shadow-sm">
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => imageInputRef.current?.click()}
                                className="h-9 w-9 rounded-lg bg-slate-700 text-white hover:bg-slate-800 transition-all border border-black shadow-md active:scale-95 shrink-0"
                                title="Insert Image"
                                disabled={uploading}
                              >
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleOpenTableDialog}
                                className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-slate-50 transition-all border border-black/10 shadow-sm active:scale-95 shrink-0"
                                title="Insert Table"
                              >
                                <Table className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-1.5 sm:ml-2 pl-2 border-l border-black/10">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsPoppedOut(true)}
                                className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-slate-50 transition-all border border-black/10 shadow-sm active:scale-95 shrink-0"
                                title="Open in Full Screen"
                              >
                                <Maximize2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant={isHtmlMode ? "secondary" : "ghost"}
                                size="icon"
                                onClick={() => setIsHtmlMode(!isHtmlMode)}
                                className={`h-9 w-9 rounded-lg transition-all border border-black/10 shadow-sm active:scale-95 shrink-0 ${isHtmlMode ? 'text-slate-600 bg-white border-slate-200 shadow-md' : 'text-slate-900 hover:text-slate-600 hover:bg-slate-50'}`}
                                title={isHtmlMode ? "Switch to Visual Editor" : "Switch to HTML Editor"}
                              >
                                {isHtmlMode ? <Eye className="h-4 w-4" /> : <Code className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="min-h-[300px] sm:min-h-[400px] border border-black/10 rounded-xl sm:rounded-2xl overflow-hidden bg-white shadow-xl relative isolate">
                    {isLoadingTemplate && (
                      <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-slate-600 animate-spin" />
                        <p className="font-bold uppercase tracking-tight text-[9px] sm:text-[10px] text-slate-500">Refreshing Content...</p>
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
                        className="h-[300px] sm:h-[350px] font-mono text-[10px] sm:text-xs border-none bg-slate-900 text-slate-100 focus-visible:ring-0 resize-none p-3 sm:p-4 relative z-10"
                        placeholder="Paste your HTML code here..."
                      />
                    ) : (
                      editorContent.toLowerCase().includes('<!doctype') || editorContent.toLowerCase().includes('<html') || editorContent.toLowerCase().includes('<body') || editorContent.toLowerCase().includes('<style') ? (
                        <div className="h-[300px] sm:h-[450px] mb-12 sm:mb-12 relative z-10 bg-white border border-slate-200 rounded-md overflow-hidden">
                          <VisualHtmlEditor 
                            content={editorContent} 
                            onChange={setEditorContent}
                            pageMargins={pageMargins}
                            selectedFont={selectedFont}
                            selectedSize={selectedSize}
                            backgroundImage={backgroundImage}
                            backgroundOpacity={backgroundOpacity}
                            backgroundStyle={backgroundStyle}
                            backgroundPosition={backgroundPosition}
                            backgroundSize={backgroundSize}
                            iframeRef={iframeRef}
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
                          className="h-[200px] sm:h-[350px] mb-14 sm:mb-12 relative z-10 text-[10px] sm:text-xs"
                        />
                      )
                    )}
                  </div>

                  <div className="flex flex-col items-stretch gap-4 pt-6 sm:pt-6 border-t border-black/5 mt-8">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-slate-50/50 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-black/5 backdrop-blur-sm">
                      <div className="flex-1">
                        <Select value={testBookingId} onValueChange={setTestBookingId}>
                          <SelectTrigger className="w-full h-11 border-black/10 rounded-lg bg-white focus:ring-2 focus:ring-indigo-100 shadow-sm font-bold text-slate-700 text-[10px] sm:text-xs">
                            <SelectValue placeholder="Select Test Booking" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-black shadow-2xl">
                            {latestBookings.length === 0 ? (
                              <SelectItem value="none" disabled className="text-[10px] sm:text-xs">No bookings found</SelectItem>
                            ) : (
                              latestBookings.map((booking) => (
                                <SelectItem key={booking.booking_id} value={booking.booking_reference} className="rounded-xl py-2.5 text-[10px] sm:text-xs">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-600">{booking.booking_reference}</span>
                                      <span className="font-medium text-slate-900 truncate max-w-[150px]">{booking.customer?.name || 'Unknown'}</span>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleTestGenerate}
                          disabled={isGenerating || !testBookingId}
                          className="flex-1 sm:flex-none h-11 px-4 rounded-lg bg-slate-700 text-white hover:bg-slate-800 transition-all active:scale-[0.98] shadow-sm text-[10px] sm:text-[11px] font-bold uppercase tracking-tight flex items-center justify-center gap-2 border-none"
                          title="Preview Generation"
                        >
                          {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                          <span>PREVIEW</span>
                        </Button>

                        <Button
                          onClick={handleExistingDocxToPdf}
                          disabled={uploading || !testBookingId || !activeTemplate?.template_settings?.original_file_path}
                          className="flex-1 sm:flex-none h-11 px-4 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-sm text-[10px] sm:text-[11px] font-bold uppercase tracking-tight flex items-center justify-center gap-2 border-none disabled:opacity-50"
                          title="Direct PDF Generation"
                        >
                          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                          <span>DIRECT PDF</span>
                        </Button>
                      </div>
                    </div>

                    <Button 
                      onClick={handleSaveEditorContent} 
                      disabled={saving || !canEdit || (() => {
                        const originalPath = activeTemplate?.template_settings?.original_file_path;
                        return typeof originalPath === 'string' && (originalPath.toLowerCase().endsWith('.doc') || originalPath.toLowerCase().endsWith('.docx'));
                      })()} 
                      className="w-full gap-3 bg-slate-700 hover:bg-slate-800 text-white shadow-xl shadow-slate-200/50 transition-all active:scale-[0.98] font-bold uppercase tracking-tight h-14 px-8 rounded-xl sm:rounded-[1.5rem] text-[11px] sm:text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      Save Template Changes
                    </Button>
                  </div>
                  
                  <div className="pt-6 sm:pt-8 border-t border-black/5 mt-6 sm:mt-8">
                    <Label className="mb-4 sm:mb-6 block font-bold text-[11px] sm:text-xs uppercase tracking-tight text-slate-600 ml-1">Page & Background Settings</Label>
                    <Tabs defaultValue="background" className="w-full">
                      <TabsList className="grid grid-cols-3 gap-1.5 sm:gap-2 bg-white/50 p-1.5 sm:p-2 rounded-xl border border-black/5 mb-4 sm:mb-6 h-auto">
                        <TabsTrigger value="background" className="rounded-lg py-2.5 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-tight data-[state=active]:bg-slate-700 data-[state=active]:text-white">Background</TabsTrigger>
                        <TabsTrigger value="banners" className="rounded-lg py-2.5 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-tight data-[state=active]:bg-slate-700 data-[state=active]:text-white">Banners</TabsTrigger>
                        <TabsTrigger value="margins" className="rounded-lg py-2.5 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-tight data-[state=active]:bg-slate-700 data-[state=active]:text-white">Margins</TabsTrigger>
                      </TabsList>

                      <TabsContent value="background" className="mt-0 animate-in fade-in-50 duration-300">
                        <div className="space-y-4 sm:space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-slate-50/50 p-4 sm:p-6 rounded-xl sm:rounded-[2rem] border border-black/5 shadow-inner">
                            <div className="space-y-3 sm:col-span-2">
                              <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Background Image URL</Label>
                              <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-tight text-slate-500 ml-1 mt-0.5">Max 1MB (Images only)</p>
                              <div className="flex gap-2.5 sm:gap-3">
                                <Input 
                                  value={backgroundImage} 
                                  onChange={(e) => setBackgroundImage(e.target.value)}
                                  placeholder="https://example.com/image.png"
                                  className="h-11 sm:h-12 text-[11px] sm:text-xs border-black/20 rounded-lg sm:rounded-xl bg-white focus:ring-2 focus:ring-indigo-100 shadow-sm flex-1"
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
                                    className="h-11 w-11 sm:h-12 sm:w-12 border-black rounded-lg sm:rounded-xl bg-slate-700 text-white hover:bg-slate-800 shadow-md transition-all active:scale-95 shrink-0"
                                  >
                                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2.5">
                              <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Background Style</Label>
                              <Select value={backgroundStyle} onValueChange={setBackgroundStyle}>
                                <SelectTrigger className="h-11 sm:h-12 text-[11px] sm:text-xs border-black/20 rounded-lg sm:rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-indigo-100">
                                  <SelectValue placeholder="Select style" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-black shadow-2xl">
                                  <SelectItem value="center" className="rounded-lg py-3 sm:py-2.5 text-[11px] sm:text-xs font-bold">Center (Contain)</SelectItem>
                                  <SelectItem value="stretch" className="rounded-lg py-3 sm:py-2.5 text-[11px] sm:text-xs font-bold">Stretch</SelectItem>
                                  <SelectItem value="tile" className="rounded-lg py-3 sm:py-2.5 text-[11px] sm:text-xs font-bold">Tile</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2.5">
                              <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Opacity ({Math.round(backgroundOpacity * 100)}%)</Label>
                              <div className="pt-2 px-1">
                                <Input 
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={backgroundOpacity}
                                  onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))}
                                  className="h-6 accent-slate-700 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Sizing & Position Controls */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-slate-50/50 p-4 sm:p-6 rounded-xl sm:rounded-[2rem] border border-black/5 shadow-inner">
                            {backgroundStyle !== 'center' && (
                              <div className="sm:col-span-2 bg-white/50 p-4 rounded-xl border border-black/5 text-[10px] sm:text-xs font-bold text-slate-600 flex items-center gap-2">
                                <Maximize2 className="w-3.5 h-3.5" />
                                Set Background Style to Center (Contain) to enable sizing and location controls.
                              </div>
                            )}

                            {backgroundStyle === 'center' && (
                              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                {/* Background Sizing */}
                                <div className="space-y-4 bg-white/50 p-4 rounded-xl border border-black/5 shadow-sm">
                                  <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-600 flex items-center gap-2">
                                    <Maximize2 className="w-3 h-3" />
                                    Background Sizing
                                  </Label>
                                  <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center">
                                        <Label className="text-[9px] uppercase text-slate-500 font-bold">Width: {backgroundSize.width}%</Label>
                                        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[8px] uppercase font-bold hover:bg-slate-100" onClick={() => setBackgroundSize(prev => ({...prev, width: 100}))}>Reset</Button>
                                      </div>
                                      <Input 
                                        type="range" min="1" max="200" step="1" 
                                        value={backgroundSize.width} 
                                        onChange={(e) => setBackgroundSize(prev => ({...prev, width: parseInt(e.target.value)}))}
                                        className="h-6 accent-slate-700"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center">
                                        <Label className="text-[9px] uppercase text-slate-500 font-bold">Height: {backgroundSize.height}%</Label>
                                        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[8px] uppercase font-bold hover:bg-slate-100" onClick={() => setBackgroundSize(prev => ({...prev, height: 100}))}>Reset</Button>
                                      </div>
                                      <Input 
                                        type="range" min="1" max="200" step="1" 
                                        value={backgroundSize.height} 
                                        onChange={(e) => setBackgroundSize(prev => ({...prev, height: parseInt(e.target.value)}))}
                                        className="h-6 accent-slate-700"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Background Location */}
                                <div className="space-y-4 bg-white/50 p-4 rounded-xl border border-black/5 shadow-sm">
                                  <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-600 flex items-center gap-2">
                                    <Move className="w-3 h-3" />
                                    Background Location
                                  </Label>
                                  <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center">
                                        <Label className="text-[9px] uppercase text-slate-500 font-bold">Location X: {backgroundPosition.x}%</Label>
                                        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[8px] uppercase font-bold hover:bg-slate-100" onClick={() => setBackgroundPosition(prev => ({...prev, x: 50}))}>Reset</Button>
                                      </div>
                                      <Input 
                                        type="range" min="-100" max="200" step="1" 
                                        value={backgroundPosition.x} 
                                        onChange={(e) => setBackgroundPosition(prev => ({...prev, x: parseInt(e.target.value)}))}
                                        className="h-6 accent-slate-700"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center">
                                        <Label className="text-[9px] uppercase text-slate-500 font-bold">Location Y: {backgroundPosition.y}%</Label>
                                        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[8px] uppercase font-bold hover:bg-slate-100" onClick={() => setBackgroundPosition(prev => ({...prev, y: 50}))}>Reset</Button>
                                      </div>
                                      <Input 
                                        type="range" min="-100" max="200" step="1" 
                                        value={backgroundPosition.y} 
                                        onChange={(e) => setBackgroundPosition(prev => ({...prev, y: parseInt(e.target.value)}))}
                                        className="h-6 accent-slate-700"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="banners" className="mt-0 animate-in fade-in-50 duration-300">
                        <div className="bg-slate-50/50 p-4 sm:p-6 rounded-xl sm:rounded-[2rem] border border-black/5 shadow-inner">
                          <div className="space-y-4">
                            <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-600 flex items-center gap-2">
                              <Layers className="w-4 h-4" />
                              Banner Images
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                              {/* Top Banner */}
                              <div className="space-y-3 bg-white/50 p-4 rounded-xl border border-black/5 shadow-sm">
                                <Label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-slate-900 ml-1">Top Banner URL</Label>
                                <div className="flex gap-2">
                                  <Input 
                                    value={topBanner} 
                                    onChange={(e) => setTopBanner(e.target.value)}
                                    placeholder="Top banner URL"
                                    className="h-11 text-[11px] border-black/20 rounded-lg bg-white focus:ring-2 shadow-sm flex-1"
                                  />
                                  <div className="relative">
                                    <Input 
                                      type="file" accept="image/*"
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                      onChange={(e) => handleBannerUpload(e, 'top')} disabled={uploading}
                                    />
                                    <Button variant="default" size="icon" className="h-11 w-11 rounded-lg bg-slate-700 text-white shadow-md">
                                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-2 pt-1">
                                  <Label className="text-[9px] uppercase text-slate-500 font-bold">Opacity ({Math.round(topBannerOpacity * 100)}%)</Label>
                                  <Input 
                                    type="range" min="0" max="1" step="0.05" 
                                    value={topBannerOpacity} 
                                    onChange={(e) => setTopBannerOpacity(parseFloat(e.target.value))}
                                    className="h-6 accent-slate-700 cursor-pointer w-full"
                                  />
                                </div>
                              </div>

                              {/* Bottom Banner */}
                              <div className="space-y-3 bg-white/50 p-4 rounded-xl border border-black/5 shadow-sm">
                                <Label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-slate-900 ml-1">Bottom Banner URL</Label>
                                <div className="flex gap-2">
                                  <Input 
                                    value={bottomBanner} 
                                    onChange={(e) => setBottomBanner(e.target.value)}
                                    placeholder="Bottom banner URL"
                                    className="h-11 text-[11px] border-black/20 rounded-lg bg-white focus:ring-2 shadow-sm flex-1"
                                  />
                                  <div className="relative">
                                    <Input 
                                      type="file" accept="image/*"
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                      onChange={(e) => handleBannerUpload(e, 'bottom')} disabled={uploading}
                                    />
                                    <Button variant="default" size="icon" className="h-11 w-11 rounded-lg bg-slate-700 text-white shadow-md">
                                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-2 pt-1">
                                  <Label className="text-[9px] uppercase text-slate-500 font-bold">Opacity ({Math.round(bottomBannerOpacity * 100)}%)</Label>
                                  <Input 
                                    type="range" min="0" max="1" step="0.05" 
                                    value={bottomBannerOpacity} 
                                    onChange={(e) => setBottomBannerOpacity(parseFloat(e.target.value))}
                                    className="h-6 accent-slate-700 cursor-pointer w-full"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="margins" className="mt-0 animate-in fade-in-50 duration-300">
                        <div className="bg-slate-50/50 p-4 sm:p-6 rounded-xl sm:rounded-[2rem] border border-black/5 shadow-inner">
                          <div className="space-y-4">
                            <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Page Margins (mm)</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <div className="space-y-2">
                                <Label className="text-[9px] uppercase text-slate-500 block font-bold">Top</Label>
                                <Input type="number" min="0" max="100" value={pageMargins.top} onChange={(e) => setPageMargins({...pageMargins, top: parseInt(e.target.value) || 0})} className="h-11 text-[11px] font-bold rounded-lg border-black/10 shadow-sm" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[9px] uppercase text-slate-500 block font-bold">Bottom</Label>
                                <Input type="number" min="0" max="100" value={pageMargins.bottom} onChange={(e) => setPageMargins({...pageMargins, bottom: parseInt(e.target.value) || 0})} className="h-11 text-[11px] font-bold rounded-lg border-black/10 shadow-sm" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[9px] uppercase text-slate-500 block font-bold">Left</Label>
                                <Input type="number" min="0" max="100" value={pageMargins.left} onChange={(e) => setPageMargins({...pageMargins, left: parseInt(e.target.value) || 0})} className="h-11 text-[11px] font-bold rounded-lg border-black/10 shadow-sm" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[9px] uppercase text-slate-500 block font-bold">Right</Label>
                                <Input type="number" min="0" max="100" value={pageMargins.right} onChange={(e) => setPageMargins({...pageMargins, right: parseInt(e.target.value) || 0})} className="h-11 text-[11px] font-bold rounded-lg border-black/10 shadow-sm" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>

                <Dialog open={isPoppedOut} onOpenChange={setIsPoppedOut}>
                  <DialogContent className="max-w-full w-full h-[100dvh] flex flex-col p-0 gap-0 border-none bg-white/95 backdrop-blur-xl rounded-none shadow-none overflow-hidden">
                    <div className="relative w-full h-full flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsPoppedOut(false)}
                        className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[60] h-9 w-9 sm:h-10 sm:w-10 text-slate-900 hover:text-slate-600 hover:bg-slate-50 rounded-full border border-black/5 transition-all active:scale-90 shadow-md bg-white/90 backdrop-blur-sm"
                      >
                        <X className="w-4 h-4 sm:w-5 sm:h-5" />
                      </Button>
                      
                      <DialogHeader className="p-3 sm:p-4 border-b border-black/5 flex flex-col items-stretch gap-3 bg-white/80 backdrop-blur-md pr-12 sm:pr-20 shrink-0">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col gap-0.5">
                            <DialogTitle className="text-sm sm:text-base font-bold uppercase tracking-tight text-slate-900 flex items-center gap-2">
                              <Maximize2 className="w-4 h-4 text-slate-600" />
                              Template Editor
                            </DialogTitle>
                            <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-tight">
                              Full screen document template editor
                            </DialogDescription>
                          </div>
                          
                          <Button 
                            onClick={handleSaveEditorContent} 
                            disabled={saving} 
                            className="h-9 px-6 rounded-lg bg-slate-700 hover:bg-slate-800 text-white shadow-md font-bold uppercase tracking-tight text-[11px] flex items-center gap-2 active:scale-95 transition-all"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            SAVE
                          </Button>
                        </div>

                        <div className="flex flex-col gap-2 w-full">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 bg-slate-100/50 p-2 rounded-xl border border-black/5 shadow-inner">
                            {/* Row 1: Font, Size, Spacing */}
                            <div className="flex items-center gap-2 bg-white/70 p-1.5 rounded-lg border border-black/5 shadow-sm">
                              <Select value={selectedFont} onValueChange={handleFontChange}>
                                <SelectTrigger className="h-9 flex-1 min-w-[100px] border-black/20 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-100 text-[10px] font-bold px-2">
                                  <SelectValue placeholder="Font" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-black shadow-2xl max-h-[250px]">
                                  {FONTS.map((font) => (
                                    <SelectItem key={font.value} value={font.value} className="rounded-lg py-2 text-[10px] sm:text-xs" style={{ fontFamily: font.value }}>
                                      {font.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select value={selectedSize} onValueChange={handleSizeChange}>
                                <SelectTrigger className="h-9 w-16 border-black/20 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-100 text-[10px] font-bold px-1.5">
                                  <SelectValue placeholder="Size" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-black shadow-2xl max-h-[250px]">
                                  {FONT_SIZES.map((size) => (
                                    <SelectItem key={size} value={size} className="rounded-lg py-2 text-[10px] sm:text-xs">
                                      {size}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select value={selectedLineSpacing} onValueChange={handleLineSpacingChange}>
                                <SelectTrigger className="h-9 flex-1 min-w-[90px] border-black/20 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-100 text-[10px] font-bold px-1.5">
                                  <SelectValue placeholder="Spacing" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-black shadow-2xl max-h-[250px]">
                                  {LINE_SPACING_PRESETS.map((preset) => (
                                    <SelectItem key={preset.value} value={preset.value} className="rounded-lg py-2 text-[10px] sm:text-xs">
                                      {preset.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Row 2: Formatting & History */}
                            <div className="flex items-center gap-2 bg-white/70 p-1.5 rounded-lg border border-black/5 shadow-sm">
                              <div className="flex items-center gap-1 border-r border-black/10 pr-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => applyVisualCommand('bold', '')}
                                  className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95 border border-black/5"
                                  title="Bold"
                                >
                                  <Bold className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => applyVisualCommand('italic', '')}
                                  className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95 border border-black/5"
                                  title="Italic"
                                >
                                  <Italic className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => applyVisualCommand('underline', '')}
                                  className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95 border border-black/5"
                                  title="Underline"
                                >
                                  <Underline className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-1 border-r border-black/10 pr-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={handleUndo}
                                  disabled={undoHistory.length <= 1}
                                  className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-white hover:shadow-md transition-all active:scale-95 border border-black/5 shrink-0 disabled:opacity-30"
                                  title="Undo"
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={handleRedo}
                                  disabled={redoHistory.length === 0}
                                  className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-white hover:shadow-md transition-all active:scale-95 border border-black/5 shrink-0 disabled:opacity-30"
                                  title="Redo"
                                >
                                  <Redo2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Row 3: Media & Mode */}
                            <div className="flex items-center justify-between gap-2 bg-white/70 p-1.5 rounded-lg border border-black/5 shadow-sm">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => imageInputRef.current?.click()}
                                  className="h-9 w-9 rounded-lg bg-slate-700 text-white hover:bg-slate-800 transition-all border border-black shadow-md active:scale-95 shrink-0"
                                  title="Insert Image"
                                  disabled={uploading}
                                >
                                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={handleOpenTableDialog}
                                  className="h-9 w-9 rounded-lg text-slate-900 hover:text-slate-600 hover:bg-white hover:shadow-md transition-all active:scale-95 border border-black/5 shrink-0"
                                  title="Insert Table"
                                >
                                  <Table className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant={isHtmlMode ? "secondary" : "ghost"}
                                  size="icon"
                                  onClick={() => setIsHtmlMode(!isHtmlMode)}
                                  className={`h-9 w-9 rounded-lg transition-all active:scale-95 border border-black/5 shrink-0 ${isHtmlMode ? 'text-slate-600 bg-white shadow-md border-slate-200' : 'text-slate-900 hover:text-slate-600 hover:bg-white hover:shadow-md'}`}
                                  title={isHtmlMode ? "Visual Editor" : "HTML Editor"}
                                >
                                  {isHtmlMode ? <Eye className="h-4 w-4" /> : <Code className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>

                            {/* Search Input */}
                            <div className="flex items-center gap-1 bg-white/70 p-1.5 rounded-lg border border-black/5 shadow-sm">
                              <Search className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                              <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSearchHighlight();
                                }}
                                className="h-7 flex-1 bg-transparent border-none focus:ring-0 text-[10px] font-bold placeholder:text-slate-300"
                              />
                            </div>

                            {/* Replace Input */}
                            <div className="flex items-center gap-1 bg-white/70 p-1.5 rounded-lg border border-black/5 shadow-sm">
                              <RefreshCw className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                              <input
                                type="text"
                                placeholder="Replace..."
                                value={replaceTerm}
                                onChange={(e) => setReplaceTerm(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSearchReplace();
                                }}
                                className="h-7 flex-1 bg-transparent border-none focus:ring-0 text-[10px] font-bold placeholder:text-slate-300"
                              />
                            </div>
                          </div>
                        </div>
                      </DialogHeader>
                    <div className="flex-1 p-0 bg-slate-100 overflow-hidden flex flex-col relative isolate">
                       {isHtmlMode ? (
                          <Textarea
                            value={editorContent}
                            onChange={(e) => setEditorContent(e.target.value)}
                            className="flex-1 font-mono text-[10px] sm:text-[11px] border-none bg-slate-900 text-slate-100 focus-visible:ring-0 resize-none p-2 sm:p-4 rounded-none shadow-none"
                            placeholder="Paste your HTML code here..."
                          />
                        ) : (
                          editorContent.toLowerCase().includes('<!doctype') || editorContent.toLowerCase().includes('<html') || editorContent.toLowerCase().includes('<body') || editorContent.toLowerCase().includes('<style') ? (
                            <div className="flex-1 bg-white border-none rounded-none overflow-hidden shadow-none relative z-10">
                              <VisualHtmlEditor 
                            content={editorContent} 
                            onChange={setEditorContent}
                            uploading={uploading}
                            setUploading={setUploading}
                            pageMargins={pageMargins}
                            selectedFont={selectedFont}
                            selectedSize={selectedSize}
                            backgroundImage={backgroundImage}
                            backgroundOpacity={backgroundOpacity}
                            backgroundStyle={backgroundStyle}
                            backgroundPosition={backgroundPosition}
                            backgroundSize={backgroundSize}
                             iframeRef={iframeRefPopped}
                           />
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col bg-white border-none rounded-none overflow-hidden shadow-none relative z-10">
                              <ReactQuill 
                                ref={quillRefPopped}
                                theme="snow"
                                value={editorContent}
                                onChange={setEditorContent}
                                modules={modules}
                                formats={formats}
                                className="flex-1 flex flex-col h-full [&>.ql-container]:flex-1 [&>.ql-container]:overflow-y-auto [&>.ql-toolbar]:border-none [&>.ql-toolbar]:bg-slate-50/80 [&>.ql-toolbar]:backdrop-blur-sm [&>.ql-container]:border-none text-[10px] sm:text-[11px]"
                              />
                            </div>
                          )
                        )}
                    </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-none bg-white/50 backdrop-blur-sm shadow-xl shadow-slate-100/50 rounded-[1.5rem] sm:rounded-[2.5rem] transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:px-8 sm:py-5 border-b border-black/5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 bg-slate-700 rounded-lg sm:rounded-xl shadow-lg shadow-slate-200/50 shrink-0">
                  <Download className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm sm:text-2xl text-slate-900 font-bold tracking-tight uppercase flex items-center gap-2 truncate">
                    HISTORY
                    <span className="text-[10px] sm:text-sm bg-slate-700/10 text-slate-600 px-2 sm:px-2.5 py-0.5 rounded-full border border-slate-200 font-bold shadow-sm shrink-0">
                      {history.length}
                    </span>
                  </CardTitle>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {selectedDocIds.length > 0 && (
                <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleBulkPrintDocs}
                    className="h-9 sm:h-11 border-blue-100 bg-blue-50/30 text-indigo-600 hover:bg-blue-50 font-bold uppercase tracking-tight text-[8px] sm:text-xs rounded-lg sm:rounded-xl px-2.5 sm:px-4 flex-1 sm:flex-initial items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Printer className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden xs:inline">PRINT</span> ({selectedDocIds.length})
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleBulkDownloadSelectedDocs}
                    className="h-9 sm:h-11 border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-700/10 font-bold uppercase tracking-tight text-[8px] sm:text-xs rounded-lg sm:rounded-xl px-2.5 sm:px-4 flex-1 sm:flex-initial items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden xs:inline">DOWNLOAD</span> ({selectedDocIds.length})
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleBulkDeleteSelectedDocs}
                    className="h-9 sm:h-11 border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50 font-bold uppercase tracking-tight text-[8px] sm:text-xs rounded-lg sm:rounded-xl px-2.5 sm:px-4 flex-1 sm:flex-initial items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden xs:inline">DELETE</span> ({selectedDocIds.length})
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2 ml-auto sm:ml-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl hover:bg-slate-50 hover:text-slate-600 transition-all border border-black shadow-sm bg-white">
                      <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-black shadow-xl">
                    <DropdownMenuLabel className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-slate-500">Bulk Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleBulkDelete('1week')} className="text-slate-600 focus:text-slate-600 focus:bg-red-50 font-bold cursor-pointer text-[10px] sm:text-xs py-2">
                      <Trash2 className="mr-2 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Delete older than 1 week
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkDelete('1month')} className="text-slate-600 focus:text-slate-600 focus:bg-red-50 font-bold cursor-pointer text-[10px] sm:text-xs py-2">
                      <Trash2 className="mr-2 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Delete older than 1 month
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="icon" onClick={fetchHistory} disabled={loadingHistory} className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl hover:bg-slate-50 hover:text-slate-600 transition-all border border-black shadow-sm bg-white">
                  <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-8">
            <ScrollArea className="h-[400px] sm:h-[500px] rounded-[1.5rem] sm:rounded-[2rem] border border-black/5 p-3 sm:p-6 bg-slate-50/30 shadow-inner">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center p-10 sm:p-20 gap-4">
                  <Loader2 className="h-8 w-8 sm:h-12 sm:w-12 animate-spin text-slate-600" />
                  <p className="text-[10px] sm:text-sm font-bold uppercase tracking-tight text-slate-600 animate-pulse">Loading history...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10 sm:py-20">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                    <FileText className="h-8 w-8 sm:h-12 sm:w-12 text-slate-900" />
                  </div>
                  <p className="text-base sm:text-lg font-bold text-slate-900">No document history found</p>
                  <p className="text-[10px] sm:text-sm text-slate-900 mt-2">Documents you generate will appear here.</p>
                </div>
              ) : (
                <div className="border border-black/5 rounded-xl sm:rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-sm shadow-inner">
                  {/* Mobile View: Cards */}
                  <div className="sm:hidden space-y-3 p-3">
                    {history.map((doc) => (
                      <div key={doc.id} className="bg-white border border-black/5 rounded-xl p-3 shadow-sm flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              checked={selectedDocIds.includes(doc.id)}
                              onCheckedChange={() => toggleDocSelection(doc.id)}
                              className="h-4 w-4 rounded-md border-black data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700"
                            />
                            <div className="p-1.5 bg-slate-50 text-slate-600 rounded-lg">
                              <FileText className="h-3.5 w-3.5" />
                            </div>
                            <span className="font-bold text-slate-900 capitalize text-[10px] tracking-tight">
                              {doc.document_type.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="icon" onClick={() => downloadDoc(doc)} className="h-7 w-7 rounded-lg border-black/5 shadow-sm hover:bg-slate-700 hover:text-white hover:border-slate-700 transition-all">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => deleteDoc(doc)} className="h-7 w-7 rounded-lg border-black/5 shadow-sm hover:bg-slate-50 hover:text-slate-600 hover:border-slate-200 transition-all">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between px-1">
                          <span className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded-md border border-slate-200 text-[9px] font-bold uppercase tracking-tight">
                            {doc.bookings?.booking_reference}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500">
                            {format(new Date(doc.generated_at), 'MMM d, HH:mm')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-1 pb-1">
                          <div className="w-1 h-1 bg-slate-300 rounded-full" />
                          <span className="text-[10px] font-bold text-slate-700 truncate">
                            {doc.bookings?.customers?.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop View: Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <TableUI>
                      <TableHeaderUI className="bg-slate-50/50 border-b border-black/5">
                        <TableRowUI className="hover:bg-transparent">
                          <TableHeadUI className="w-[50px] px-6">
                            <Checkbox 
                              checked={selectedDocIds.length === history.length && history.length > 0}
                              onCheckedChange={handleSelectAllDocs}
                              className="h-4 w-4 rounded-md border-black data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700"
                            />
                          </TableHeadUI>
                          <TableHeadUI className="font-bold uppercase tracking-tight text-[10px] text-slate-900 py-4">Document Type</TableHeadUI>
                          <TableHeadUI className="font-bold uppercase tracking-tight text-[10px] text-slate-900">Booking Ref</TableHeadUI>
                          <TableHeadUI className="font-bold uppercase tracking-tight text-[10px] text-slate-900 hidden md:table-cell">Customer</TableHeadUI>
                          <TableHeadUI className="font-bold uppercase tracking-tight text-[10px] text-slate-900 hidden sm:table-cell">Generated At</TableHeadUI>
                          <TableHeadUI className="text-right font-bold uppercase tracking-tight text-[10px] text-slate-900 px-6">Actions</TableHeadUI>
                        </TableRowUI>
                      </TableHeaderUI>
                      <TableBodyUI>
                        {history.map((doc) => (
                          <TableRowUI key={doc.id} className="group hover:bg-slate-50 transition-all duration-300 border-b border-black/5 last:border-0">
                            <TableCellUI className="px-6">
                              <Checkbox 
                                checked={selectedDocIds.includes(doc.id)}
                                onCheckedChange={() => toggleDocSelection(doc.id)}
                                className="h-4 w-4 rounded-md border-black data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700"
                              />
                            </TableCellUI>
                            <TableCellUI>
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 text-slate-600 rounded-lg group-hover:bg-slate-700 group-hover:text-white transition-all duration-500">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-slate-900 capitalize text-[11px] sm:text-xs tracking-tight">
                                  {doc.document_type.replace('_', ' ')}
                                </span>
                              </div>
                            </TableCellUI>
                            <TableCellUI>
                              <span className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded-md border border-slate-200 text-[10px] font-bold uppercase tracking-tight">
                                {doc.bookings?.booking_reference}
                              </span>
                            </TableCellUI>
                            <TableCellUI className="hidden md:table-cell">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                                <span className="text-[11px] sm:text-xs font-bold text-slate-700 truncate max-w-[120px]">
                                  {doc.bookings?.customers?.name}
                                </span>
                              </div>
                            </TableCellUI>
                            <TableCellUI className="hidden sm:table-cell">
                              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">
                                {format(new Date(doc.generated_at), 'MMM d, HH:mm')}
                              </span>
                            </TableCellUI>
                            <TableCellUI className="text-right px-6">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="icon" onClick={() => downloadDoc(doc)} className="h-8 w-8 rounded-lg border-black/5 shadow-sm hover:bg-slate-700 hover:text-white hover:border-slate-700 transition-all duration-300">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" onClick={() => deleteDoc(doc)} className="h-8 w-8 rounded-lg border-black/5 shadow-sm hover:bg-slate-50 hover:text-slate-600 hover:border-slate-200 transition-all duration-300">
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

      <div id="variables-section" className="lg:col-span-2 space-y-6 lg:sticky lg:top-24 h-fit">
        <Card className="h-fit border-black/5 shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden rounded-2xl sm:rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500">

          <CardHeader className="border-b border-black/5 bg-white/50 p-5">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shadow-inner group-hover:rotate-12 transition-transform duration-500">
                  <Info className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 uppercase tracking-tight font-sans">
                    Variables
                  </CardTitle>
                  <CardDescription className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight text-slate-900 mt-0.5 opacity-60 font-sans">
                    Personalize your templates
                  </CardDescription>
                  {isLoadingBookingData && (
                    <div className="flex items-center gap-1.5 mt-1 text-[9px] font-bold uppercase tracking-tight text-slate-600 animate-pulse">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Loading values...
                    </div>
                  )}
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-900 opacity-50" />
                <Input
                  placeholder="Search variables..."
                  value={variableSearch}
                  onChange={(e) => setVariableSearch(e.target.value)}
                  className="pl-9 sm:pl-11 h-10 sm:h-11 text-xs sm:text-sm font-bold border-black/10 rounded-xl bg-white focus:ring-4 focus:ring-indigo-100/10 transition-all shadow-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px] lg:h-[750px] scrollbar-thin">
              <div className="px-4 sm:px-6 pt-3 pb-6 space-y-4">
                {/* Formulas Guide */}
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200/50 text-[11px] sm:text-sm space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-600 uppercase tracking-tight">
                    <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Formulas</span>
                  </div>
                  <p className="text-slate-900 font-bold leading-relaxed">
                    Use <span className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-600/90">sum(...)</span> with <span className="text-slate-600 font-bold">+ - * /</span>
                  </p>
                  <div className="bg-white/50 p-2 rounded-lg border border-slate-200 font-mono text-[11px] sm:text-xs text-slate-900 font-bold">
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
                    <p className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900">No variables found matching "{variableSearch}"</p>
                  </div>
                ) : (
                  filteredVariables.map((category) => {
                    const styles = (() => {
                      switch (category.category) {
                        case "Customer": return { bg: "bg-indigo-50/50", text: "text-indigo-700", border: "border-indigo-100", dot: "bg-indigo-500", button: "hover:bg-indigo-600 hover:border-indigo-600" };
                        case "Booking": return { bg: "bg-emerald-50/50", text: "text-emerald-700", border: "border-emerald-100", dot: "bg-emerald-500", button: "hover:bg-emerald-600 hover:border-emerald-600" };
                        case "Package": return { bg: "bg-amber-50/50", text: "text-amber-700", border: "border-amber-100", dot: "bg-amber-500", button: "hover:bg-amber-600 hover:border-amber-600" };
                        case "Booking Item (First)": return { bg: "bg-orange-50/50", text: "text-orange-700", border: "border-orange-100", dot: "bg-orange-500", button: "hover:bg-orange-600 hover:border-orange-600" };
                        case "Passenger": return { bg: "bg-rose-50/50", text: "text-rose-700", border: "border-rose-100", dot: "bg-rose-500", button: "hover:bg-rose-600 hover:border-rose-600" };
                        case "Flight Operation": return { bg: "bg-sky-50/50", text: "text-sky-700", border: "border-sky-100", dot: "bg-sky-500", button: "hover:bg-sky-600 hover:border-sky-600" };
                        default: return { bg: "bg-slate-50/50", text: "text-slate-700", border: "border-slate-100", dot: "bg-slate-500", button: "hover:bg-slate-700 hover:border-slate-700" };
                      }
                    })();

                    return (
                      <div key={category.category} className={`space-y-3 p-3 rounded-2xl border ${styles.bg} ${styles.border}`}>
                        <h4 className={`font-bold text-[9px] sm:text-[10px] uppercase tracking-tight ${styles.text} px-1 flex items-center gap-2`}>
                          <span className={`w-1 h-1 rounded-full ${styles.dot}`}></span>
                          {category.category}
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {category.vars.map((variable) => {
                              const firstPassenger = selectedBookingData?.booking_passengers?.[0];
                              const rawValue = selectedBookingData ? getVariableValue(variable, selectedBookingData, firstPassenger) : null;
                              // Strip HTML tags for preview display
                              const actualValue = typeof rawValue === 'string' ? rawValue.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim() : rawValue;
                             
                             return (
                               <button 
                                key={variable} 
                                draggable="true"
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', variable);
                                }}
                                className={`w-full text-left bg-white/90 p-3.5 sm:p-3 rounded-xl text-[11px] sm:text-[11px] font-bold border border-black/5 flex justify-between items-center group/var cursor-pointer transition-all active:scale-[0.98] shadow-sm ${styles.button} hover:text-white`}
                                 onClick={() => insertVariable(variable)}
                               >
                                 <div className="flex flex-col min-w-0 flex-1">
                                   <span className="truncate mr-2 text-slate-900 group-hover/var:text-white transition-colors">{variable}</span>
                                   {actualValue && (
                                     <span className={`text-[11px] ${styles.text} group-hover/var:text-white/80 font-bold truncate mt-1`}>
                                       = {actualValue}
                                     </span>
                                   )}
                                 </div>
                                 <span className="shrink-0 opacity-100 sm:opacity-0 group-hover/var:opacity-100 text-[9px] sm:text-[9px] font-bold uppercase tracking-tight text-slate-600 bg-white px-2 py-1 rounded shadow-sm transition-all duration-300">
                                   ADD
                                 </span>
                               </button>
                             );
                           })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
        <DialogContent className="max-w-[900px] w-[95vw] sm:w-full max-h-[95vh] sm:max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="relative w-full h-full flex flex-col">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTableDialog(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 h-9 w-9 sm:h-10 sm:w-10 text-slate-900 hover:text-slate-600 hover:bg-slate-50 rounded-full border border-black/5 shrink-0 transition-all active:scale-90 shadow-sm bg-white/50 backdrop-blur-sm"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <DialogHeader className="p-4 sm:p-6 border-b bg-slate-50/50 pr-14 sm:pr-16">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-slate-700 rounded-full" />
                  <DialogTitle className="text-xl font-bold text-slate-950 uppercase tracking-tight">Table Manager</DialogTitle>
                </div>
                <DialogDescription className="text-[11px] sm:text-xs font-bold text-slate-500 ml-3 mt-1 uppercase tracking-tight">
                  Create and manage independent data tables for your templates.
                </DialogDescription>
              </div>
            </div>
            <div className="mt-4 p-3.5 bg-slate-50/50 text-slate-600/90 rounded-xl text-[11px] sm:text-xs space-y-1.5 border border-slate-200 shadow-sm text-left">
              <p className="font-bold flex items-center gap-2 uppercase tracking-tight text-[10px] sm:text-xs">
                <Info className="h-4 w-4 sm:h-3.5 sm:h-3.5" /> How to use:
              </p>
              <ul className="list-disc pl-5 space-y-1 opacity-90 text-[11px] sm:text-xs font-bold">
                <li>Create a <strong className="font-bold text-slate-600">New Table</strong> from the list.</li>
                <li>Configure <strong className="font-bold text-slate-600">Rows</strong> and <strong className="font-bold text-slate-600">Columns</strong>, then fill in headers and cell data.</li>
                <li>
                  Click <strong className="font-bold text-slate-600">Insert Table</strong> (Visual/HTML mode) to embed the table directly,
                  or <strong className="font-bold text-slate-600">Insert Placeholder</strong> (Quill mode) to add a reference like <code>{`{table.1}`}</code>.
                </li>
              </ul>
            </div>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row flex-1 overflow-hidden min-h-0">
            {/* Sidebar List */}
            <div className="w-full sm:w-1/3 border-b sm:border-b-0 sm:border-r bg-slate-50/30 p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto max-h-[250px] sm:max-h-full">
              <Button 
                onClick={handleAddTable} 
                className="w-full gap-2.5 bg-slate-700 hover:bg-slate-700/90 text-white font-bold h-12 sm:h-11 rounded-xl shadow-lg shadow-slate-200/50 transition-all active:scale-[0.98] text-[11px] sm:text-xs uppercase tracking-tight"
              >
                <Plus className="h-4.5 w-4.5 sm:h-4 sm:w-4" /> New Table
              </Button>
              <div className="space-y-2.5">
                {tables.map(table => (
                  <div 
                    key={table.id} 
                    className={`p-3.5 sm:p-3 rounded-xl border cursor-pointer hover:bg-slate-50/50 transition-all flex justify-between items-center group ${currentTableId === table.id ? 'bg-white border-slate-700 shadow-md ring-1 ring-indigo-100' : 'bg-white border-black/10'}`}
                    onClick={() => setCurrentTableId(table.id)}
                  >
                    <div className={`truncate font-bold text-[11px] sm:text-xs uppercase tracking-tight ${currentTableId === table.id ? 'text-slate-600' : 'text-slate-700'}`}>{table.name}</div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 sm:h-8 sm:w-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                      onClick={(e) => { e.stopPropagation(); deleteTable(table.id); }}
                    >
                      <Trash2 className="h-4.5 w-4.5 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                ))}
                {tables.length === 0 && (
                  <div className="text-center text-[11px] sm:text-xs text-slate-400 py-10 bg-white/50 rounded-xl border border-dashed border-slate-200 font-bold uppercase tracking-tight">
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
                    <div className="space-y-6 sm:space-y-8">
                      <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
                        <div className="flex-1 space-y-2.5">
                          <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-500 ml-1">Table Name</Label>
                          <Input 
                            value={table.name} 
                            onChange={(e) => handleUpdateTable(table.id, { name: e.target.value })} 
                            className="h-12 sm:h-11 border-black/20 rounded-xl focus:ring-4 focus:ring-indigo-100/10 text-[11px] sm:text-xs font-bold transition-all shadow-sm"
                          />
                        </div>
                        <div className="w-full sm:w-32 space-y-2.5">
                          <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-500 ml-1">Border Color</Label>
                          <Select 
                            value={table.borderColor || 'black'} 
                            onValueChange={(value) => handleUpdateTable(table.id, { borderColor: value })}
                          >
                            <SelectTrigger className="h-12 sm:h-11 border-black/20 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-sm">
                              <SelectValue placeholder="Color" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-black shadow-2xl">
                              <SelectItem value="black" className="text-[11px] sm:text-xs font-bold py-2.5">Black</SelectItem>
                              <SelectItem value="gray" className="text-[11px] sm:text-xs font-bold py-2.5">Gray</SelectItem>
                              <SelectItem value="blue" className="text-[11px] sm:text-xs font-bold py-2.5">Blue</SelectItem>
                              <SelectItem value="red" className="text-[11px] sm:text-xs font-bold py-2.5">Red</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => insertTablePlaceholder(table.id)}
                          className="w-full sm:w-auto gap-2.5 bg-slate-700 hover:bg-slate-700/90 text-white font-bold h-12 sm:h-11 px-8 rounded-xl shadow-lg shadow-slate-200/50 transition-all active:scale-[0.98] text-[11px] sm:text-xs uppercase tracking-tight"
                        >
                          <Plus className="h-4.5 w-4.5 sm:h-4 sm:w-4" />
                          {(!isHtmlMode && (editorContent.toLowerCase().includes('<!doctype') || editorContent.toLowerCase().includes('<html') || editorContent.toLowerCase().includes('<body')))
                            ? 'Insert Table'
                            : isHtmlMode ? 'Insert HTML' : 'Insert Placeholder'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2.5">
                          <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-500 ml-1">Rows</Label>
                          <Input 
                            type="number" 
                            min="1" 
                            max="50"
                            value={table.rows} 
                            onChange={(e) => handleUpdateTable(table.id, { rows: parseInt(e.target.value) || 1 })}
                            className="h-12 sm:h-11 border-black/20 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-sm"
                          />
                        </div>
                        <div className="space-y-2.5">
                          <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-500 ml-1">Columns</Label>
                          <Input 
                            type="number" 
                            min="1" 
                            max="10"
                            value={table.cols} 
                            onChange={(e) => handleUpdateTable(table.id, { cols: parseInt(e.target.value) || 1 })}
                            className="h-12 sm:h-11 border-black/20 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-500 ml-1">Table Data Grid</Label>
                        <ScrollArea className="border border-black/10 rounded-2xl bg-slate-50/50 shadow-inner">
                          <div className="p-4 sm:p-6 overflow-x-auto min-w-full">
                            <table className="min-w-full border-separate border-spacing-2">
                              <thead>
                                <tr>
                                  {table.headers.map((header, colIndex) => (
                                    <th key={colIndex} className="p-0 min-w-[140px] sm:min-w-[160px]">
                                      <Input 
                                        value={header} 
                                        onChange={(e) => handleUpdateHeader(table.id, colIndex, e.target.value)}
                                        className="h-11 sm:h-10 text-[11px] sm:text-xs font-bold text-center bg-slate-700/10 border-slate-200 rounded-lg focus:ring-4 focus:ring-indigo-100/10 transition-all uppercase tracking-tight"
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
                                      <td key={colIndex} className="p-0 min-w-[140px] sm:min-w-[160px]">
                                        <Input 
                                          value={cell} 
                                          onChange={(e) => handleUpdateCell(table.id, rowIndex, colIndex, e.target.value)}
                                          className="h-11 sm:h-10 text-[11px] sm:text-xs border-black/10 bg-white rounded-lg focus:ring-4 focus:ring-indigo-100/10 transition-all font-bold shadow-sm"
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
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 py-16">
                    <div className="p-6 bg-slate-50 rounded-full border border-slate-100 shadow-inner">
                      <Table className="h-12 w-12 opacity-20" />
                    </div>
                    <p className="text-[11px] sm:text-xs font-bold uppercase tracking-tight">Select a table from the sidebar or create a new one</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

      {previewData && (
        <DocumentPreviewModal 
          previewData={previewData}
          onClose={() => setPreviewData(null)}
          onPrint={handlePrint}
        />
      )}

      <Dialog open={isReplaceConfirmOpen} onOpenChange={setIsReplaceConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
          <div className="p-8 flex flex-col items-center justify-center text-center gap-6">
            <div className="h-20 w-20 rounded-full border-4 border-slate-100 flex items-center justify-center bg-slate-50 shadow-inner">
              <RefreshCw className="h-10 w-10 text-slate-700" />
            </div>

            <div className="space-y-2">
              <DialogTitle className="text-lg font-bold text-slate-900 uppercase tracking-tight font-sans">
                Confirm Replace All
              </DialogTitle>
              <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-tight font-sans">
                Found {pendingReplaceData?.matches} occurrence(s) of "{searchTerm}". Do you want to replace them all with "{replaceTerm}"?
              </DialogDescription>
            </div>

            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsReplaceConfirmOpen(false);
                  setPendingReplaceData(null);
                }}
                className="flex-1 h-12 rounded-xl border-black/10 font-bold uppercase tracking-tight text-[11px]"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmReplace}
                className="flex-1 h-12 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-tight text-[11px] shadow-lg"
              >
                Replace All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Global Uploading Modal */}
      <Dialog open={uploading && uploadProgress.total > 0}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
          <div className="p-8 flex flex-col items-center justify-center text-center gap-6">
            <div className="relative">
              <div className="h-24 w-24 rounded-full border-4 border-slate-100 flex items-center justify-center bg-slate-50 shadow-inner">
                <Upload className="h-10 w-10 text-slate-700 animate-bounce" />
              </div>
              <div className="absolute inset-0 h-24 w-24 rounded-full border-4 border-t-slate-700 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            </div>

            <div className="space-y-2">
              <DialogTitle className="text-lg font-bold text-slate-900 uppercase tracking-tight font-sans">
                Uploading Templates
              </DialogTitle>
              <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-tight font-sans">
                Please wait while we process your files
              </DialogDescription>
            </div>

            <div className="w-full space-y-4">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight text-slate-600 px-1">
                <span className="truncate max-w-[200px]">{uploadProgress.currentFileName}</span>
                <span>{uploadProgress.current} / {uploadProgress.total}</span>
              </div>
              
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-slate-700 transition-all duration-500 ease-out shadow-lg"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>

              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight animate-pulse">
                Do not close this window
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
