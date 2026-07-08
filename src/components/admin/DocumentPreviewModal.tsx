import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Printer, Monitor, ChevronDown, ChevronUp } from 'lucide-react';

interface PreviewData {
  html: string;
  pageSize?: 'A4' | 'Letter';
  widthMm?: number;
  heightMm?: number;
}

interface DocumentPreviewModalProps {
  previewData: PreviewData | null;
  onClose: () => void;
  onPrint: () => void;
}

export function DocumentPreviewModal({ previewData, onClose, onPrint }: DocumentPreviewModalProps) {
  const [previewZoom, setPreviewZoom] = useState(0.8);

  return (
    <Dialog open={!!previewData} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[1200px] w-[95vw] h-[95vh] flex flex-col md:flex-row p-0 overflow-hidden bg-[#f3f3f3] border-none rounded-none shadow-2xl gap-0 z-[200]">
        <div className="relative w-full h-full flex flex-col md:flex-row">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[100] h-9 w-9 sm:h-10 sm:w-10 text-[#333] md:text-white hover:text-slate-500 hover:bg-slate-50/20 rounded-full border border-black/5 md:border-white/10 transition-all active:scale-90 shadow-lg bg-white md:bg-black/20"
            onClick={onClose}
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <DialogHeader className="sr-only">
            <DialogTitle>Print Preview</DialogTitle>
          </DialogHeader>
          
          {/* Sidebar */}
          <div className="w-full md:w-[300px] bg-[#f3f3f3] border-b md:border-b-0 md:border-r border-[#d9d9d9] flex flex-col shrink-0 p-5 md:p-6 space-y-5 md:space-y-8">
            {/* Buttons */}
            <div className="flex flex-row md:flex-col gap-4 md:gap-0 md:space-y-6">
              <Button 
                onClick={onPrint}
                className="flex-1 md:w-full h-20 md:h-32 flex flex-col items-center justify-center gap-2 md:gap-2 bg-white hover:bg-[#f9f9f9] text-[#333] border border-[#d9d9d9] rounded-lg md:rounded-sm shadow-md transition-all active:scale-95"
              >
                <Printer className="w-7 h-7 md:w-12 md:h-12 stroke-[1px]" />
                <span className="text-[11px] md:text-sm font-bold uppercase tracking-tight">Print</span>
              </Button>
            </div>
          </div>

          {/* Preview Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#808080] relative overflow-hidden">
             <div className="h-14 md:h-12 shrink-0 bg-[#474747] border-b border-[#555] flex items-center justify-between px-3 md:px-6 gap-3 text-white pr-14 md:pr-6">
                <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-300 font-bold uppercase tracking-tight">
                   <Monitor className="w-4 h-4" />
                   Preview
                   {previewData && (
                     <span className="ml-2 px-2 py-0.5 bg-slate-700 text-white rounded-sm font-semibold text-[10px]">
                       {previewData.pageSize || 'A4'} ({previewData.widthMm || 210}mm x {previewData.heightMm || 297}mm)
                     </span>
                   )}
                </div>
                
                <div className="flex items-center gap-3 bg-[#333] rounded-lg px-3 py-1.5 md:py-1 border border-[#555] shadow-lg">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 md:h-6 md:w-6 text-white hover:bg-[#444] active:scale-90"
                    onClick={() => setPreviewZoom(z => Math.max(0.3, z - 0.1))}
                  >
                    <ChevronDown className="w-4 h-4 md:w-3 md:h-3" />
                  </Button>
                  <span className="text-[11px] md:text-[11px] font-bold w-12 text-center text-white font-mono">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 md:h-6 md:w-6 text-white hover:bg-[#444] active:scale-90"
                    onClick={() => setPreviewZoom(z => Math.min(1.5, z + 0.1))}
                  >
                      <ChevronUp className="w-4 h-4 md:w-3 md:h-3" />
                  </Button>
                </div>
             </div>
             
             <div className="flex-1 overflow-auto p-0 flex justify-center items-start relative bg-[#525659] scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent w-full">
                <div 
                  className="origin-top transition-all duration-300 mx-auto"
                  style={{
                    zoom: previewZoom,
                    transformOrigin: 'top center',
                    width: previewData?.widthMm ? `${previewData.widthMm}mm` : '210mm',
                    minHeight: '100%',
                    backgroundColor: 'transparent',
                    padding: '5px 0' // Space for the top/bottom shadows and gap
                  }}
                >
                   {previewData && (
                     <iframe 
                       srcDoc={`
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <style>
                            body { margin: 0; padding: 0; background-color: #525659; display: flex; justify-content: center; }
                            /* Hide scrollbars inside iframe */
                            body::-webkit-scrollbar { display: none; }
                            body { -ms-overflow-style: none; scrollbar-width: none; }
                          </style>
                        </head>
                        <body>
                          ${previewData.html}
                        </body>
                        </html>
                       `}
                       title="Document Preview"
                       className="w-full border-none shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                       style={{ 
                         width: previewData?.widthMm ? `${previewData.widthMm}mm` : '210mm',
                         height: '100vh',
                         backgroundColor: 'white',
                       }}
                       onLoad={(e) => {
                         const iframe = e.currentTarget;
                         if (iframe.contentWindow) {
                           // Try to adjust height based on content
                           setTimeout(() => {
                             if (iframe.contentDocument?.body) {
                               const height = iframe.contentDocument.documentElement.scrollHeight;
                               iframe.style.height = `${height}px`;
                             }
                           }, 500);
                         }
                       }}
                     />
                   )}
                </div>
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}