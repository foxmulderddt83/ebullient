// ============================================
// IMPROVED WORD DOCUMENT EDITOR
// Preserves tables, formatting, and images
// ============================================

import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { supabase } from '@/lib/supabase';

/**
 * Step 1: Upload and Convert DOCX to Editable Format
 */
const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const fileExt = file.name.split('.').pop()?.toLowerCase();
  
  if (fileExt === 'docx' || fileExt === 'doc') {
    setUploading(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Store original file for later use
      setOriginalDocxBuffer(arrayBuffer);
      setOriginalFileName(file.name);
      
      // Convert to HTML with enhanced options to preserve tables
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
            // Store images for later reconstruction
            const imageBuffer = await image.read();
            const base64 = btoa(
              new Uint8Array(imageBuffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ''
              )
            );
            return {
              src: `data:${image.contentType};base64,${base64}`
            };
          })
        }
      );
      
      // Enhanced HTML with better table styling
      const enhancedHtml = `
        <style>
          table { 
            border-collapse: collapse; 
            width: 100%; 
            margin: 10px 0;
            border: 1px solid #ddd;
          }
          td, th { 
            border: 1px solid #ddd; 
            padding: 8px 12px; 
            text-align: left;
          }
          th {
            background-color: #f4f4f4;
            font-weight: bold;
          }
          .table-text { margin: 5px 0; }
          .table-heading { font-weight: bold; margin: 5px 0; }
        </style>
        ${result.value}
      `;
      
      setEditorContent(enhancedHtml);
      setShowEditor(true);
      
      toast.success("Document loaded! Edit and save when done.");
      
    } catch (error: any) {
      console.error('DOCX conversion error:', error);
      toast.error(`Failed to load document: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }
};

/**
 * Step 2: ReactQuill Configuration with Table Support
 */
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'align': [] }],
    ['link', 'image'],
    ['clean'],
    // Add table support
    ['table']
  ],
  table: true,
  clipboard: {
    matchVisual: false  // Preserve formatting on paste
  }
};

const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet',
  'color', 'background',
  'align',
  'link', 'image',
  'table', 'th', 'td', 'tr'  // Table formats
];

<ReactQuill 
  theme="snow"
  value={editorContent}
  onChange={setEditorContent}
  modules={quillModules}
  formats={quillFormats}
  style={{ height: '500px', marginBottom: '50px' }}
/>

/**
 * Step 3: Save Options - Choose Format
 */
const [saveFormat, setSaveFormat] = useState<'html' | 'docx'>('docx');

const SaveFormatSelector = () => (
  <div className="flex gap-4 mb-4">
    <label className="flex items-center gap-2">
      <input 
        type="radio" 
        value="html" 
        checked={saveFormat === 'html'}
        onChange={(e) => setSaveFormat(e.target.value as 'html')}
      />
      Save as HTML (editable in browser)
    </label>
    <label className="flex items-center gap-2">
      <input 
        type="radio" 
        value="docx" 
        checked={saveFormat === 'docx'}
        onChange={(e) => setSaveFormat(e.target.value as 'docx')}
      />
      Save as Word Document (preserves format)
    </label>
  </div>
);

/**
 * Step 4: Smart Save Function
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
      // Option A: Save as HTML (easy to edit later)
      fileName = `${selectedType}_edited_${Date.now()}.html`;
      contentType = 'text/html';
      
      // Create complete HTML document
      const completeHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    body { 
      font-family: 'Calibri', Arial, sans-serif; 
      max-width: 800px; 
      margin: 40px auto; 
      padding: 20px;
      line-height: 1.6;
    }
    table { 
      border-collapse: collapse; 
      width: 100%; 
      margin: 20px 0;
      border: 1px solid #333;
    }
    td, th { 
      border: 1px solid #333; 
      padding: 10px 15px; 
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    img { max-width: 100%; height: auto; }
    h1, h2, h3 { color: #333; margin-top: 20px; }
  </style>
</head>
<body>
  ${editorContent}
</body>
</html>`;
      
      fileToUpload = new Blob([completeHtml], { type: contentType });
      
    } else {
      // Option B: Convert back to DOCX using docx library
      fileName = `${selectedType}_edited_${Date.now()}.docx`;
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      
      // Parse HTML and convert to docx structure
      const docxBlob = await convertHtmlToDocx(editorContent);
      fileToUpload = docxBlob;
    }

    // Upload to Supabase
    const filePath = `templates/${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, fileToUpload, {
        contentType,
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    // Save metadata to database
    const { error: dbError } = await supabase
      .from('templates')
      .insert({
        name: fileName,
        type: selectedType,
        file_path: filePath,
        file_url: urlData.publicUrl,
        file_type: saveFormat,
        created_at: new Date().toISOString()
      });

    if (dbError) throw dbError;

    toast.success(`Document saved as ${saveFormat.toUpperCase()}!`);
    setShowEditor(false);
    setEditorContent('');
    
    // Refresh templates list
    await loadTemplates();
    
  } catch (error: any) {
    console.error('Save error:', error);
    toast.error(`Failed to save: ${error.message}`);
  } finally {
    setSaving(false);
  }
};

/**
 * Step 5: HTML to DOCX Converter
 * This preserves tables and basic formatting
 */
const convertHtmlToDocx = async (htmlContent: string): Promise<Blob> => {
  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  const children: (Paragraph | Table)[] = [];
  
  // Process each element
  const processNode = (node: Node, parentStyle: any = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        return new TextRun({
          text,
          bold: parentStyle.bold,
          italics: parentStyle.italics,
          underline: parentStyle.underline ? {} : undefined,
          color: parentStyle.color,
          size: parentStyle.size || 24, // 12pt default
        });
      }
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      // Update style based on tag
      const currentStyle = { ...parentStyle };
      if (tagName === 'strong' || tagName === 'b') currentStyle.bold = true;
      if (tagName === 'em' || tagName === 'i') currentStyle.italics = true;
      if (tagName === 'u') currentStyle.underline = true;
      
      // Handle headings
      if (tagName.match(/^h[1-6]$/)) {
        const level = parseInt(tagName[1]);
        currentStyle.size = 48 - (level * 4); // Decrease size for lower headings
        currentStyle.bold = true;
      }
      
      // Process children
      const childRuns: TextRun[] = [];
      element.childNodes.forEach(child => {
        const result = processNode(child, currentStyle);
        if (result) {
          if (Array.isArray(result)) {
            childRuns.push(...result);
          } else {
            childRuns.push(result);
          }
        }
      });
      
      return childRuns;
    }
    
    return null;
  };
  
  // Process all body elements
  doc.body.childNodes.forEach((node) => {
    const element = node as Element;
    
    if (element.tagName?.toLowerCase() === 'table') {
      // Handle tables
      const tableRows: TableRow[] = [];
      
      element.querySelectorAll('tr').forEach((tr) => {
        const cells: TableCell[] = [];
        
        tr.querySelectorAll('td, th').forEach((cell) => {
          const cellRuns = processNode(cell);
          cells.push(
            new TableCell({
              children: [
                new Paragraph({
                  children: Array.isArray(cellRuns) ? cellRuns : [cellRuns]
                })
              ],
              shading: cell.tagName.toLowerCase() === 'th' ? {
                fill: 'D9D9D9',
                type: ShadingType.CLEAR
              } : undefined
            })
          );
        });
        
        tableRows.push(new TableRow({ children: cells }));
      });
      
      children.push(
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      );
      
    } else if (element.tagName?.toLowerCase() === 'p') {
      // Handle paragraphs
      const runs = processNode(element);
      if (runs) {
        children.push(
          new Paragraph({
            children: Array.isArray(runs) ? runs : [runs]
          })
        );
      }
      
    } else if (element.tagName?.toLowerCase().match(/^h[1-6]$/)) {
      // Handle headings
      const level = parseInt(element.tagName[1]) - 1;
      const runs = processNode(element);
      if (runs) {
        children.push(
          new Paragraph({
            heading: [
              HeadingLevel.HEADING_1,
              HeadingLevel.HEADING_2,
              HeadingLevel.HEADING_3,
              HeadingLevel.HEADING_4,
              HeadingLevel.HEADING_5,
              HeadingLevel.HEADING_6
            ][level],
            children: Array.isArray(runs) ? runs : [runs]
          })
        );
      }
    }
  });
  
  // Create the document
  const docxDoc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: 12240,   // US Letter width
            height: 15840   // US Letter height
          },
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440
          }
        }
      },
      children
    }]
  });
  
  // Generate and return blob
  const blob = await Packer.toBlob(docxDoc);
  return blob;
};

/**
 * Alternative: Use Python backend for better conversion
 * This requires a backend endpoint
 */
const convertHtmlToDocxViaBackend = async (htmlContent: string): Promise<Blob> => {
  const response = await fetch('/api/convert-html-to-docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: htmlContent })
  });
  
  if (!response.ok) {
    throw new Error('Conversion failed');
  }
  
  return await response.blob();
};

/**
 * Step 6: Download Function (Optional)
 */
const handleDownload = async (fileUrl: string, fileName: string) => {
  try {
    const response = await fetch(fileUrl);
    const blob = await response.blob();
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success('Download started');
  } catch (error: any) {
    toast.error(`Download failed: ${error.message}`);
  }
};

export {
  handleUpload,
  handleSaveEditorContent,
  convertHtmlToDocx,
  handleDownload,
  quillModules,
  quillFormats
};
