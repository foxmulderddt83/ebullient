import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Home, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function EventSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [eventName, setEventName] = useState<string | null>(null);
  const registrationId = searchParams.get("id");

  useEffect(() => {
    if (registrationId) {
      const fetchRegistration = async () => {
        const { data, error } = await supabase
          .from('event_registrations')
          .select('event:events(name)')
          .eq('id', registrationId)
          .single();
        
        if (data && !error && data.event) {
          setEventName(data.event.name);
        }
      };
      fetchRegistration();
    }
  }, [registrationId]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center shadow-lg border-green-100">
        <CardHeader className="pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Registration Successful!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Thank you for registering. Your payment has been successfully processed.
          </p>
          
          {eventName && (
            <div className="bg-muted/50 p-4 rounded-lg border border-slate-200">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Event</p>
              <p className="text-lg font-bold text-primary">{eventName}</p>
            </div>
          )}

          <div className="space-y-3 pt-4">
            <Button 
              onClick={() => navigate('/events')} 
              className="w-full gap-2 font-bold py-6"
            >
              <Calendar className="w-4 h-4" /> View More Events
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
