import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Lock } from "lucide-react";

export default function GuidelineViewer() {
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGuideline = async () => {
      // 1. Check Auth (Registered Users Only)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Please login to view this document.");
        setLoading(false);
        return;
      }

      // 2. Fetch PDF URL from settings
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'guideline_pdf_url')
        .maybeSingle();

      if (error || !data?.value) {
        setError("Guideline document not found or not configured.");
      } else {
        setPdfUrl(data.value);
      }
      setLoading(false);
    };

    fetchGuideline();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full">
          <Lock className="w-16 h-16 text-slate-900 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-slate-800">Access Restricted</h1>
          <p className="text-slate-900 mb-6">{error}</p>
          <Button onClick={() => navigate('/')} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Passenger Guidelines
          </h1>
        </div>
        <div className="text-xs text-muted-foreground hidden sm:block">
          Confidential Document • Registered Users Only
        </div>
      </header>

      {/* PDF Viewer Container */}
      <div className="flex-1 p-4 md:p-8 flex justify-center">
        <div className="w-full max-w-5xl bg-white shadow-2xl rounded-xl overflow-hidden border h-[80vh]">
          {pdfUrl ? (
            <iframe 
              src={`${pdfUrl}#toolbar=0`} 
              className="w-full h-full"
              title="Guideline PDF"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Document URL invalid
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
