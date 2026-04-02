import { useEffect, useState } from "react";
import { QrCode, Camera, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  const handleScan = () => {
    setIsScanning(true);
    // Simulate QR scan
    setTimeout(() => {
      setIsScanning(false);
      setScanComplete(true);
      setTimeout(() => {
        navigate("/event");
      }, 800);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center animate-fade-in">
        {/* Logo/Header */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl gradient-primary flex items-center justify-center shadow-elevated">
            <QrCode className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Event Scanner</h1>
          <p className="text-muted-foreground">Scan QR code to view event details</p>
        </div>

        {/* Scanner Area */}
        <div className="relative mb-8">
          <div 
            className={`w-64 h-64 mx-auto rounded-3xl border-4 transition-all duration-500 ${
              isScanning 
                ? "border-primary animate-pulse-soft" 
                : scanComplete 
                  ? "border-green-500" 
                  : "border-border"
            } bg-muted/50 flex items-center justify-center overflow-hidden`}
          >
            {isScanning ? (
              <div className="relative">
                <Camera className="w-16 h-16 text-primary animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-1 bg-primary/50 animate-scan-line" />
                </div>
              </div>
            ) : scanComplete ? (
              <div className="text-green-500 animate-scale-in">
                <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="text-center p-6">
                <QrCode className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Position QR code here</p>
              </div>
            )}
          </div>

          {/* Corner decorations */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-72">
            <div className="flex justify-between">
              <div className="w-8 h-8 border-l-4 border-t-4 border-primary rounded-tl-xl" />
              <div className="w-8 h-8 border-r-4 border-t-4 border-primary rounded-tr-xl" />
            </div>
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 w-72">
            <div className="flex justify-between">
              <div className="w-8 h-8 border-l-4 border-b-4 border-primary rounded-bl-xl" />
              <div className="w-8 h-8 border-r-4 border-b-4 border-primary rounded-br-xl" />
            </div>
          </div>
        </div>

        {/* Scan Button */}
        <Button
          onClick={handleScan}
          disabled={isScanning || scanComplete}
          className="w-full max-w-xs gradient-primary text-primary-foreground font-semibold py-6 rounded-xl shadow-soft hover:opacity-90 transition-opacity"
        >
          {isScanning ? (
            "Scanning..."
          ) : scanComplete ? (
            "Redirecting..."
          ) : (
            <>
              Scan QR Code
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>

        {/* Quick access link */}
        <button
          onClick={() => navigate("/event")}
          className="mt-6 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Or skip to event details →
        </button>
      </div>

      {/* Admin link */}
      <button
        onClick={() => navigate("/admin")}
        className="fixed bottom-6 right-6 text-xs text-muted-foreground hover:text-primary transition-colors underline"
      >
        Admin Panel
      </button>
    </div>
  );
};

export default Index;
