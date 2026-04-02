// ============================================
// WORD DOCUMENT EDITOR WITH FULL IMAGE SUPPORT
// Preserves images, tables, and formatting
// ============================================

import React, { useState, useRef } from 'react';
import mammoth from 'mammoth';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  ImageRun, 
  WidthType, 
  ShadingType, 
  HeadingLevel 
} from 'docx';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

/**
 * STEP 1: ReactQuill Configuration
 */
const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet',
  'color', 'background',
  'align',
  'link', 'image',
  'table', 'th', 'td', 'tr'
];

/**
 * STEP 2: Main Component
 */
const WordDocumentEditorWithImages = () => {
  // State variables
  const [editorContent, setEditorContent] = useState('');
  const [imageMap, setImageMap] = useState<Map<string, string>>(new Map());
  const [saveFormat, setSaveFormat] = useState<'html' | 'docx'>('docx');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedType, setSelectedType] = useState('document');
  const quillRef = useRef<ReactQuill>(null);

  /**
   * STEP 3: Upload and Convert DOCX with Image Preservation
   */
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExt === 'docx' || fileExt === 'doc') {
      setUploading(true);
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Store images with unique IDs
        const images = new Map<string, string>();
        let imageCounter = 0;
        
        // Convert DOCX to HTML with image extraction
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            styleMap: [
              "p[style-name='Table Text'] => p.table-text",
              "p[style-name='Table Heading'] => p.table-heading:fresh",
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
            ],
            
            convertImage: mammoth.images.imgElement(async (image) => {
              try {
                const imageBuffer = await image.read();
                const base64 = btoa(
                  new Uint8Array(imageBuffer).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    ''
                  )
                );
                
                const contentType = image.contentType || 'image/png';
                const dataUrl = `data:${contentType};base64,${base64}`;
                const imageId = `image_${imageCounter++}`;
                
                images.set(imageId, dataUrl);
                
                return {
                  src: dataUrl,
                  'data-image-id': imageId,
                  style: 'max-width: 100%; height: auto;'
                };
              } catch (error) {
                console.error('Image conversion error:', error);
                return { src: '' };
              }
            })
          }
        );
        
        setImageMap(images);
        
        const enhancedHtml = `
          <style>
            table { border-collapse: collapse; width: 100%; margin: 15px 0; border: 1px solid #ddd; }
            td, th { border: 1px solid #ddd; padding: 8px 12px; text-align: left; vertical-align: top; }
            th { background-color: #f4f4f4; font-weight: bold; }
            img { max-width: 100%; height: auto; display: block; margin: 10px 0; }
            .table-text { margin: 5px 0; }
            .table-heading { font-weight: bold; margin: 5px 0; }
          </style>
          ${result.value}
        `;
        
        setEditorContent(enhancedHtml);
        setShowEditor(true);
        toast.success(`Document loaded with ${images.size} images!`);
        
      } catch (error: any) {
        console.error('DOCX conversion error:', error);
        toast.error(`Failed to load document: ${error.message}`);
      } finally {
        setUploading(false);
      }
    }
  };

  /**
   * STEP 4: Advanced HTML to DOCX Conversion
   */
  const convertHtmlToDocxWithImages = async (htmlContent: string): Promise<Blob> => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const docElements: any[] = [];
    
    for (const element of Array.from(doc.body.children)) {
      if (element.tagName.toLowerCase() === 'img') {
        try {
          const src = element.getAttribute('src') || '';
          if (src.startsWith('data:image')) {
            const base64Match = src.match(/^data:image\/(\w+);base64,(.+)$/);
            if (base64Match) {
              const [, format, base64Data] = base64Match;
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              docElements.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: bytes,
                      transformation: { width: 500, height: 400 },
                      // Satisfy TypeScript by providing common properties or casting
                      // @ts-ignore
                      type: format
                    })
                  ]
                })
              );
            }
          }
        } catch (error) {
          console.error('Image processing error:', error);
        }
      } else if (element.tagName.toLowerCase() === 'table') {
        const rows: TableRow[] = [];
        element.querySelectorAll('tr').forEach((tr) => {
          const cells: TableCell[] = [];
          tr.querySelectorAll('td, th').forEach((cell) => {
            const cellText = cell.textContent || '';
            const isHeader = cell.tagName.toLowerCase() === 'th';
            cells.push(
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: cellText, bold: isHeader })]
                })],
                shading: isHeader ? { fill: 'D9D9D9', type: ShadingType.CLEAR } : undefined,
                width: { size: 100 / tr.querySelectorAll('td, th').length, type: WidthType.PERCENTAGE }
              })
            );
          });
          if (cells.length > 0) rows.push(new TableRow({ children: cells }));
        });
        if (rows.length > 0) {
          docElements.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        }
      } else if (element.tagName.toLowerCase().match(/^h[1-6]$/)) {
        const level = parseInt(element.tagName[1]) - 1;
        const text = element.textContent || '';
        docElements.push(
          new Paragraph({
            heading: [
              HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
              HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6
            ][level],
            children: [new TextRun(text)]
          })
        );
      } else if (element.tagName.toLowerCase() === 'p') {
        const runs: TextRun[] = [];
        const processNode = (node: Node): void => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) runs.push(new TextRun(text));
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const elem = node as Element;
            const text = elem.textContent?.trim();
            if (text) {
              runs.push(new TextRun({
                text,
                bold: elem.tagName === 'STRONG' || elem.tagName === 'B',
                italics: elem.tagName === 'EM' || elem.tagName === 'I',
                underline: elem.tagName === 'U' ? {} : undefined
              }));
            }
            elem.childNodes.forEach(child => processNode(child));
          }
        };
        element.childNodes.forEach(node => processNode(node));
        if (runs.length > 0) docElements.push(new Paragraph({ children: runs }));
      }
    }
    
    const wordDoc = new Document({
      sections: [{
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
        },
        children: docElements
      }]
    });
    
    return await Packer.toBlob(wordDoc);
  };

  /**
   * STEP 5: Save Function
   */
  const handleSaveEditorContent = async () => {
    if (!editorContent) {
      toast.error('No content to save');
      return;
    }

    setSaving(true);
    try {
      let fileToUpload: Blob;
      let fileName: string;
      let contentType: string;

      if (saveFormat === 'html') {
        fileName = `document_${Date.now()}.html`;
        contentType = 'text/html';
        const completeHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body { font-family: Calibri, Arial; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; } table { border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid #333; } td, th { border: 1px solid #333; padding: 10px 15px; } img { max-width: 100%; height: auto; display: block; margin: 10px 0; }</style></head><body>${editorContent}</body></html>`;
        fileToUpload = new Blob([completeHtml], { type: contentType });
      } else {
        fileName = `document_${Date.now()}.docx`;
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        fileToUpload = await convertHtmlToDocxWithImages(editorContent);
      }

      const filePath = `templates/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, fileToUpload, { contentType, upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
      const { error: dbError } = await supabase.from('templates').insert({
        name: fileName,
        type: selectedType,
        file_path: filePath,
        file_url: urlData.publicUrl,
        file_type: saveFormat,
        has_images: imageMap.size > 0,
        created_at: new Date().toISOString()
      });

      if (dbError) throw dbError;
      toast.success(`✅ Document saved with ${imageMap.size} images!`);
      setShowEditor(false);
      setEditorContent('');
      setImageMap(new Map());
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  /**
   * STEP 6: Custom Image Handler
   */
  const imageHandler = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, 'image', base64);
          quill.setSelection(range.index + 1, 0);
          setImageMap(prev => new Map(prev).set(`uploaded_${Date.now()}`, base64));
          toast.success('Image added!');
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const quillModules = {
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image'],
        ['clean']
      ],
      handlers: { image: imageHandler }
    },
    clipboard: { matchVisual: false }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Word Document Editor</h2>
      <div className="mb-4">
        <input type="file" accept=".doc,.docx" onChange={handleUpload} className="file-input" disabled={uploading} />
        {uploading && <span className="ml-2">Uploading and converting...</span>}
      </div>
      
      {showEditor && (
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2">
              <input type="radio" value="html" checked={saveFormat === 'html'} onChange={(e) => setSaveFormat(e.target.value as 'html')} />
              Save as HTML
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" value="docx" checked={saveFormat === 'docx'} onChange={(e) => setSaveFormat(e.target.value as 'docx')} />
              Save as Word (with images)
            </label>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Document Type</label>
            <input type="text" value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="mt-1 block w-full border rounded-md p-2" />
          </div>

          <div className="mb-2 text-sm text-gray-600">📷 {imageMap.size} images loaded</div>
          <ReactQuill ref={quillRef} theme="snow" value={editorContent} onChange={setEditorContent} modules={quillModules} formats={quillFormats} style={{ height: '500px', marginBottom: '50px' }} />
          
          <div className="flex gap-4 mt-16">
            <button onClick={handleSaveEditorContent} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400">
              {saving ? 'Saving...' : `💾 Save as ${saveFormat.toUpperCase()}`}
            </button>
            <button onClick={() => { setShowEditor(false); setEditorContent(''); setImageMap(new Map()); }} className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordDocumentEditorWithImages;
