import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, RefreshCw, Home } from "lucide-react";

export default function EventFailed() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const registrationId = searchParams.get("id");

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
            We couldn't process your payment. Your registration has been saved as unpaid.
          </p>

          <div className="space-y-3 pt-4">
            <Button 
              onClick={() => navigate('/events')} 
              className="w-full gap-2 font-bold py-6 bg-red-600 hover:bg-red-700 text-white"
            >
              <RefreshCw className="w-4 h-4" /> Try Again or View Events
            </Button>
            <Button 
              onClick={() => navigate('/')} 
              variant="outline"
              className="w-full gap-2 font-bold py-6"
            >
              <Home className="w-4 h-4" /> Return to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
