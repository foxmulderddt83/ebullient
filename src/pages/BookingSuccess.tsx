import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Home, CreditCard, Calendar, Clock, Plane, FileText, Smartphone, Mail, ChevronRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import { notificationService } from "@/lib/notificationService";
import { Separator } from "@/components/ui/separator";

export default function BookingSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const bookingId = searchParams.get("id");
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    // Clear cart on successful booking
    clearCart();

    // Fetch booking reference and details for display
    if (bookingId && !processed) {
      setProcessed(true);
      const fetchBooking = async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            customers (
              name,
              email,
              phone
            ),
            booking_items (
              id,
              quantity,
              total_price,
              packages (
                name
              )
            )
          `)
          .eq('booking_id', bookingId)
          .single();
        
        if (data && !error) {
          setBookingDetails(data);
          // Trigger notifications (Text-only for checkout as requested)
          await notificationService.sendPaymentSuccessNotifications(bookingId, true);
        }
        setLoading(false);
      };
      fetchBooking();
    }
  }, [bookingId, clearCart, processed]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-slate-200 rounded-full mb-4"></div>
          <div className="h-6 w-32 bg-slate-200 rounded mb-2"></div>
          <div className="h-4 w-48 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-2xl w-full shadow-xl border-green-100 bg-white">
        <CardHeader className="pb-6 bg-green-50/50 rounded-t-xl border-b border-green-100">
          <div className="flex flex-col items-center text-center">
            <div className="bg-green-100 p-4 rounded-full mb-5 shadow-sm">
              <CheckCircle2 className="w-16 h-16 text-green-600" />
            </div>
            <CardTitle className="text-3xl font-extrabold text-slate-900 mb-2">Payment Successful!</CardTitle>
            <p className="text-slate-600 text-lg">
              Thank you for choosing One Day Flying Club. Your booking is confirmed.
            </p>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {bookingDetails && (
            <div className="flex flex-col">
              {/* Payment Details Section */}
              <div className="p-6 sm:p-8 bg-white">
                <h3 className="text-lg font-bold text-slate-900 flex items-center mb-4">
                  <CreditCard className="w-5 h-5 mr-2 text-primary" />
                  Payment Details
                </h3>
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                  <div>
                    <p className="text-sm text-slate-500 mb-1 font-medium">Payment Gateway</p>
                    <p className="text-base font-semibold text-slate-800 flex items-center">
                      {bookingDetails.payment_gateway || 'CHIP'}
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Paid
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1 font-medium">Total Amount Paid</p>
                    <p className="text-base font-semibold text-slate-800">{formatCurrency(bookingDetails.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1 font-medium">Booking Reference</p>
                    <p className="text-base font-mono font-bold text-primary">{bookingDetails.booking_reference}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1 font-medium">Date & Time</p>
                    <p className="text-base font-semibold text-slate-800">
                      {new Date(bookingDetails.created_at).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Booking Details Section */}
              <div className="p-6 sm:p-8 bg-white">
                <h3 className="text-lg font-bold text-slate-900 flex items-center mb-4">
                  <Plane className="w-5 h-5 mr-2 text-primary" />
                  Booking Details
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="flex items-start">
                    <Calendar className="w-5 h-5 mr-3 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Flight Date</p>
                      <p className="text-base font-semibold text-slate-900">{formatDate(bookingDetails.flight_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Clock className="w-5 h-5 mr-3 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Flight Time</p>
                      <p className="text-base font-semibold text-slate-900">{bookingDetails.flight_time || "TBD"}</p>
                    </div>
                  </div>
                </div>

                {/* Items */}
                {bookingDetails.booking_items && bookingDetails.booking_items.length > 0 && (
                  <div className="mt-6">
                    <p className="text-sm text-slate-500 font-medium mb-3">Packages & Add-ons</p>
                    <ul className="space-y-3">
                      {bookingDetails.booking_items.map((item: any) => (
                        <li key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div className="flex items-center">
                            <span className="bg-primary/10 text-primary font-bold px-2 py-1 rounded text-xs mr-3">
                              {item.quantity}x
                            </span>
                            <span className="font-medium text-slate-800">{item.packages?.name || "Item"}</span>
                          </div>
                          <span className="font-semibold text-slate-700">{formatCurrency(item.total_price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <Separator />

              {/* Notification Section */}
              <div className="p-6 sm:p-8 bg-blue-50/50">
                <div className="flex flex-col items-center text-center max-w-lg mx-auto">
                  <h3 className="text-lg font-bold text-slate-900 mb-3">What's Next?</h3>
                  <p className="text-slate-600 mb-6">
                    We've sent your booking confirmation and receipt to your registered contact details.
                  </p>
                  
                  <div className="w-full flex flex-col sm:flex-row gap-4 justify-center">
                    {bookingDetails.customers?.email && (
                      <div className="flex items-center justify-center p-3 bg-white rounded-lg border border-blue-100 shadow-sm flex-1">
                        <Mail className="w-5 h-5 text-blue-500 mr-2" />
                        <span className="text-sm font-medium text-slate-700 truncate max-w-[150px]" title={bookingDetails.customers.email}>
                          {bookingDetails.customers.email}
                        </span>
                      </div>
                    )}
                    
                    {bookingDetails.customers?.phone && (
                      <div className="flex items-center justify-center p-3 bg-white rounded-lg border border-green-100 shadow-sm flex-1">
                        <Smartphone className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-sm font-medium text-slate-700">
                          {bookingDetails.customers.phone}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-500 mt-4">
                    Please keep these for your records and present them upon arrival.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 rounded-b-xl">
            <Button 
              onClick={() => navigate('/')} 
              size="lg"
              className="w-full sm:w-auto sm:min-w-[200px] mx-auto flex items-center justify-center gap-2 font-bold py-6 shadow-md hover:shadow-lg transition-all"
            >
              <Home className="w-5 h-5" /> 
              Back to Main Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
