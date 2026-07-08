import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { generateAndPreviewPDF } from '@/lib/pdfGenerator';

const PdfRender = () => {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking');
  const docType = searchParams.get('type');
  const templateId = searchParams.get('template');
  const passengerId = searchParams.get('passenger');
  const orientation = searchParams.get('orientation') as 'portrait' | 'landscape' || 'portrait';
  const margins = searchParams.get('margins') as 'Normal' | 'Narrow' | 'None' || 'Normal';
  
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add('pdf-render-page');
    document.documentElement.style.overflowX = 'hidden';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.width = '100%';
    document.body.style.maxWidth = '100%';
    document.body.style.overflowX = 'hidden';

    const root = document.getElementById('root');
    if (root) {
      root.style.margin = '0';
      root.style.padding = '0';
      root.style.maxWidth = '100%';
      root.style.width = '100%';
      root.style.textAlign = 'left';
    }

    return () => {
      document.body.classList.remove('pdf-render-page');
      document.documentElement.style.overflowX = '';
      document.documentElement.style.margin = '';
      document.documentElement.style.padding = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.body.style.width = '';
      document.body.style.maxWidth = '';
      document.body.style.overflowX = '';

      if (root) {
        root.style.margin = '';
        root.style.padding = '';
        root.style.maxWidth = '';
        root.style.width = '';
        root.style.textAlign = '';
      }
    };
  }, []);

  useEffect(() => {
    const generatePreview = async () => {
      if (!docType && !templateId) {
        setError('Missing document type or template parameter');
        (window as any).pdfReady = true;
        return;
      }

      try {
        const result = await generateAndPreviewPDF(
          bookingId,
          docType || '', 
          passengerId || undefined,
          orientation,
          'A4',
          margins,
          templateId || undefined,
          false
        );
        
        setHtmlContent(result.html);
        
        setTimeout(() => {
          (window as any).pdfReady = true;
          document.dispatchEvent(new Event('pdf-ready'));
        }, 1000);
      } catch (err: any) {
        console.error('Error generating PDF render:', err);
        setError(err.message || 'Unknown error');
        (window as any).pdfReady = true; 
      }
    };

    generatePreview();
  }, [bookingId, docType, passengerId, orientation, margins, templateId]);

  if (error) {
    return <div id="pdf-error" style={{ color: 'red', padding: '20px' }}>Error: {error}</div>;
  }

  if (!htmlContent) {
    return <div id="pdf-loading">Loading...</div>;
  }

  return (
    <>
      <style>{`
        .pdf-render-page,
        .pdf-render-page html,
        .pdf-render-page body {
          margin: 0 !important;
          padding: 0 !important;
        }
        .pdf-render-page #root {
          max-width: 100% !important;
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow-x: hidden;
          text-align: left !important;
        }
        #pdf-content {
          margin: 0 !important;
          padding: 0 !important;
          width: 100%;
          max-width: 100%;
          min-height: auto;
          overflow-x: hidden;
          box-sizing: border-box;
        }
        #pdf-content .pdf-container {
          width: 100% !important;
          max-width: 100% !important;
          min-height: auto !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        #pdf-content .pdf-content {
          min-height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        @media (min-width: 768px) {
          .pdf-render-page #root,
          #pdf-content,
          #pdf-content .pdf-container,
          #pdf-content .pdf-content {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          #pdf-content .pdf-container {
            max-width: none !important;
          }
          #pdf-content .pdf-content > *:first-child {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          #pdf-content .page-a4 {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
        }
        @media (max-width: 767px) {
          #pdf-content .pdf-container {
            max-width: 100vw !important;
            min-height: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #pdf-content img,
          #pdf-content table {
            max-width: 100% !important;
          }
        }
      `}</style>
      <div 
        id="pdf-content"
        dangerouslySetInnerHTML={{ __html: htmlContent }} 
      />
    </>
  );
};

export default PdfRender;
