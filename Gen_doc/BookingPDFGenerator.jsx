/**
 * React Component for PDF Generation with Supabase Integration
 * Automatically fetches booking data and replaces {variables}
 */

import React, { useState, useEffect } from 'react';

const BookingPDFGenerator = ({ bookingId }) => {
  const [loading, setLoading] = useState(false);
  const [bookingData, setBookingData] = useState(null);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [generatedDocs, setGeneratedDocs] = useState([]);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const documentTypes = [
    { id: 'invoice_paid', label: 'Paid Invoice', icon: '💰', color: '#4CAF50' },
    { id: 'invoice_deposit', label: 'Deposit Invoice', icon: '💵', color: '#2196F3' },
    { id: 'booking_confirmation', label: 'Booking Confirmation', icon: '✅', color: '#FF9800' },
    { id: 'gendec', label: 'General Declaration', icon: '📋', color: '#9C27B0' },
    { id: 'certificate', label: 'Flight Certificate', icon: '🎓', color: '#F44336' },
    { id: 'refund_voucher', label: 'Refund Voucher', icon: '↩️', color: '#607D8B' },
  ];

  // Fetch booking data on mount
  useEffect(() => {
    if (bookingId) {
      fetchBookingData();
      fetchGeneratedDocuments();
    }
  }, [bookingId]);

  const fetchBookingData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/booking-data/${bookingId}`);
      const result = await response.json();
      
      if (result.success) {
        setBookingData(result.data);
      }
    } catch (error) {
      console.error('Error fetching booking data:', error);
    }
  };

  const fetchGeneratedDocuments = async () => {
    try {
      const response = await fetch(`${API_URL}/api/generated-documents/${bookingId}`);
      const result = await response.json();
      
      if (result.success) {
        setGeneratedDocs(result.documents);
      }
    } catch (error) {
      console.error('Error fetching generated documents:', error);
    }
  };

  const toggleDocument = (docType) => {
    setSelectedDocuments(prev => 
      prev.includes(docType)
        ? prev.filter(d => d !== docType)
        : [...prev, docType]
    );
  };

  const generatePDFs = async () => {
    setLoading(true);
    
    try {
      for (const docType of selectedDocuments) {
        // Call API to generate PDF (it fetches data from Supabase automatically)
        const response = await fetch(
          `${API_URL}/api/generate-pdf/${bookingId}/${docType}`
        );

        if (!response.ok) {
          throw new Error(`Failed to generate ${docType}`);
        }

        // Download the PDF
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${docType}_${bookingId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      alert('All PDFs generated successfully!');
      
      // Refresh generated documents list
      fetchGeneratedDocuments();
      setSelectedDocuments([]);
      
    } catch (error) {
      console.error('Error generating PDFs:', error);
      alert('Error generating PDFs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateAllDocuments = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/api/generate-all-pdfs/${bookingId}`);
      const result = await response.json();
      
      if (result.success) {
        alert('All documents generated successfully!');
        fetchGeneratedDocuments();
      }
    } catch (error) {
      console.error('Error generating all PDFs:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadGeneratedDoc = async (docType) => {
    try {
      const response = await fetch(`${API_URL}/api/generate-pdf/${bookingId}/${docType}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docType}_${bookingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  if (!bookingId) {
    return <div>Please select a booking</div>;
  }

  return (
    <div className="pdf-generator-container">
      {/* Booking Info Summary */}
      {bookingData && (
        <div className="booking-summary">
          <h3>📋 Booking Details</h3>
          <div className="booking-grid">
            <div className="detail-item">
              <span className="label">Booking ID:</span>
              <span className="value">{bookingData.booking_id}</span>
            </div>
            <div className="detail-item">
              <span className="label">Customer:</span>
              <span className="value">{bookingData.customer_name}</span>
            </div>
            <div className="detail-item">
              <span className="label">Flight Date:</span>
              <span className="value">{bookingData.event_date}</span>
            </div>
            <div className="detail-item">
              <span className="label">Package:</span>
              <span className="value">{bookingData.package_name}</span>
            </div>
          </div>
        </div>
      )}

      <div className="pdf-generator">
        <div className="header">
          <h2>📄 Generate Documents</h2>
          <button
            onClick={generateAllDocuments}
            disabled={loading}
            className="btn-generate-all"
          >
            {loading ? 'Generating...' : '⚡ Generate All'}
          </button>
        </div>

        {/* Document Type Selector */}
        <div className="document-selector">
          {documentTypes.map(doc => (
            <label 
              key={doc.id} 
              className={`document-card ${selectedDocuments.includes(doc.id) ? 'selected' : ''}`}
              style={{ borderColor: selectedDocuments.includes(doc.id) ? doc.color : '#e0e0e0' }}
            >
              <input
                type="checkbox"
                checked={selectedDocuments.includes(doc.id)}
                onChange={() => toggleDocument(doc.id)}
                disabled={loading}
              />
              <div className="card-content">
                <span className="doc-icon" style={{ color: doc.color }}>
                  {doc.icon}
                </span>
                <span className="doc-label">{doc.label}</span>
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={generatePDFs}
          disabled={selectedDocuments.length === 0 || loading}
          className="btn-generate"
        >
          {loading 
            ? '⏳ Generating...' 
            : `📥 Generate ${selectedDocuments.length} Document${selectedDocuments.length !== 1 ? 's' : ''}`
          }
        </button>
      </div>

      {/* Previously Generated Documents */}
      {generatedDocs.length > 0 && (
        <div className="generated-docs">
          <h3>📂 Previously Generated Documents</h3>
          <div className="docs-list">
            {generatedDocs.map((doc, index) => (
              <div key={index} className="doc-item">
                <div className="doc-info">
                  <span className="doc-type">{doc.document_type}</span>
                  <span className="doc-date">
                    {new Date(doc.generated_at).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => downloadGeneratedDoc(doc.document_type)}
                  className="btn-download"
                >
                  ⬇️ Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .pdf-generator-container {
          max-width: 1000px;
          margin: 20px auto;
          padding: 20px;
        }

        .booking-summary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 25px;
          border-radius: 12px;
          margin-bottom: 30px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .booking-summary h3 {
          margin: 0 0 15px 0;
          font-size: 20px;
        }

        .booking-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .detail-item .label {
          font-size: 12px;
          opacity: 0.9;
        }

        .detail-item .value {
          font-size: 16px;
          font-weight: 600;
        }

        .pdf-generator {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .header h2 {
          margin: 0;
          color: #333;
        }

        .btn-generate-all {
          padding: 10px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .btn-generate-all:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-generate-all:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .document-selector {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 15px;
          margin-bottom: 25px;
        }

        .document-card {
          position: relative;
          padding: 20px;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s;
          background: white;
        }

        .document-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }

        .document-card.selected {
          background: #f5f5f5;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .document-card input[type="checkbox"] {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .card-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .doc-icon {
          font-size: 36px;
        }

        .doc-label {
          font-size: 14px;
          font-weight: 600;
          text-align: center;
          color: #333;
        }

        .btn-generate {
          width: 100%;
          padding: 18px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .btn-generate:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
        }

        .btn-generate:disabled {
          background: #ccc;
          cursor: not-allowed;
          box-shadow: none;
        }

        .generated-docs {
          background: white;
          border-radius: 12px;
          padding: 25px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .generated-docs h3 {
          margin: 0 0 20px 0;
          color: #333;
        }

        .docs-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .doc-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
        }

        .doc-info {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .doc-type {
          font-weight: 600;
          color: #333;
        }

        .doc-date {
          font-size: 12px;
          color: #666;
        }

        .btn-download {
          padding: 8px 16px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-download:hover {
          background: #45a049;
        }
      `}</style>
    </div>
  );
};

export default BookingPDFGenerator;


// ==================== USAGE EXAMPLE ====================

/*
// In your booking details page:

import BookingPDFGenerator from './components/BookingPDFGenerator';
import { useParams } from 'react-router-dom';

function BookingDetailsPage() {
  const { bookingId } = useParams();
  
  return (
    <div>
      <h1>Booking Management</h1>
      
      {/* Booking details, edit form, etc. *\/}
      
      {/* PDF Generator - automatically fetches data from Supabase *\/}
      <BookingPDFGenerator bookingId={bookingId} />
    </div>
  );
}

// That's it! The component will:
// 1. Fetch booking data from Supabase via your API
// 2. Replace all {variables} in templates with real data
// 3. Generate and download PDFs
// 4. Track generated documents

*/
