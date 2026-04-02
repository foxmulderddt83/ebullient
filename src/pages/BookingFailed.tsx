import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, RefreshCcw, Home, MessageSquare } from "lucide-react";

export default function BookingFailed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("id");

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center shadow-lg border-red-100">
        <CardHeader className="pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 p-3 rounded-full">
              <XCircle className="w-12 h-12 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Payment Failed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            We're sorry, but your payment could not be processed at this time.
          </p>
          
          <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-sm text-red-700">
            Please check your payment details or contact your bank. You can try again or use a different payment method.
          </div>

          <div className="grid grid-cols-1 gap-3 pt-4">
            <Button 
              onClick={() => navigate('/checkout')} 
              variant="default"
              className="w-full gap-2 font-bold py-6"
            >
              <RefreshCcw className="w-4 h-4" /> Try Again
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={() => navigate('/')} 
                variant="secondary"
                className="gap-2 border-slate-200 shadow-sm"
              >
                <Home className="w-4 h-4" /> Home
              </Button>
              <Button 
                onClick={() => window.open('https://wa.me/60123456789', '_blank')} 
                variant="secondary"
                className="gap-2 border-slate-200 shadow-sm"
              >
                <MessageSquare className="w-4 h-4" /> Support
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
