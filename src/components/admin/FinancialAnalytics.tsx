import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  CreditCard,
  User,
  History,
  Info,
  FileSpreadsheet,
  DownloadCloud,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import eventHero from "@/assets/event-hero.jpg";

// Interfaces
interface Booking {
  booking_id: string;
  booking_reference: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  flight_date?: string;
  customer?: { name: string; email: string };
}

interface VendorPayment {
  id: string;
  recipient_id: string;
  amount: number;
  payment_type: 'full_payment' | 'deposit' | 'refund' | 'penalty' | 'adjustment';
  status: 'pending' | 'paid' | 'cancelled';
  notes: string;
  booking_reference?: string;
  created_at: string;
  paid_at?: string;
  recipient?: { email: string; role: string };
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
}

interface FinancialAnalyticsProps {
  currentUser: AdminUser | null;
  refreshTrigger?: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function FinancialAnalytics({ currentUser, refreshTrigger }: FinancialAnalyticsProps) {
  const [activeTab, setActiveTab] = useState("revenue");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vendorPayments, setVendorPayments] = useState<VendorPayment[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [isExporting, setIsExporting] = useState(false);
  
  // New Payment Form State
  const [newPayment, setNewPayment] = useState({
    recipient_id: "",
    amount: "",
    payment_type: "full_payment",
    status: "pending",
    notes: "",
    booking_reference: ""
  });

  const isAdmin = useMemo(() => {
    return currentUser?.role === 'admin' || currentUser?.role === 'Administrator' || currentUser?.email === 'admin@oneday.com';
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [currentUser, refreshTrigger]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Bookings (Revenue)
      const { data: rawBookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          booking_id, 
          booking_reference, 
          total_amount, 
          status,
          payment_status, 
          created_at, 
          flight_date,
          customer:customers(name, email)
        `)
        .order('created_at', { ascending: false });
      if (bookingsError) throw bookingsError;
      // Transform raw data to handle customer object instead of array
      const transformedBookings = (rawBookingsData || []).map((b: any) => ({
        ...b,
        customer: Array.isArray(b.customer) ? b.customer[0] : b.customer
      }));
      setBookings(transformedBookings);
      // 2. Fetch Vendor Payments (Expenses)
      // Check if table exists first implicitly by try-catch or assume it exists based on user request
      let query = supabase
        .from('vendor_payments')
        .select(`
          *,
          recipient:admin_users!recipient_id(email, role)
        `)
        .order('created_at', { ascending: false });
      // If not admin, filter by recipient_id
      if (!isAdmin && currentUser) {
        query = query.eq('recipient_id', currentUser.id);
      }
      const { data: paymentsData, error: paymentsError } = await query;
      if (paymentsError) {
        // Handle case where table might not exist yet
        console.warn("Error fetching vendor_payments (table might not exist yet):", paymentsError);
        setVendorPayments([]);
      } else {
        setVendorPayments(paymentsData || []);
      }
      // 3. Fetch Admin Users (for dropdown) - Only if Admin
      if (isAdmin) {
        const { data: usersData, error: usersError } = await supabase
          .from('admin_users')
          .select('id, email, role')
          .eq('is_approved', true);
        if (usersError) throw usersError;
        setAdminUsers(usersData || []);
      }
    } catch (error) {
      console.error("Error fetching financial data:", error);
      // toast.error("Failed to load financial data");
    } finally {
      setLoading(false);
    }
  };
  const handleExportFinancials = async () => {
    if (!exportDateRange.from || !exportDateRange.to) {
      toast.error("Please select a date range first");
      return;
    }
    setIsExporting(true);
    try {
      // 1. Fetch Revenue (Bookings) within date range
      const { data: revenueData, error: revenueError } = await supabase
        .from('bookings')
        .select(`
          created_at,
          booking_reference,
          total_amount,
          status,
          payment_method,
          customer:customers(name, email)
        `)
        .gte('created_at', exportDateRange.from.toISOString())
        .lte('created_at', exportDateRange.to.toISOString())
        .order('created_at', { ascending: false });
      if (revenueError) throw revenueError;
      // 2. Fetch Expenses (Vendor Payments) within date range
      const { data: expenseData, error: expenseError } = await supabase
        .from('vendor_payments')
        .select(`
          created_at,
          amount,
          payment_type,
          status,
          notes,
          booking_reference,
          recipient:admin_users(email)
        `)
        .gte('created_at', exportDateRange.from.toISOString())
        .lte('created_at', exportDateRange.to.toISOString())
        .order('created_at', { ascending: false });
      if (expenseError) {
        console.warn("Error fetching vendor_payments for export:", expenseError);
      }
      // Create workbook
      const wb = XLSX.utils.book_new();
      // Format Revenue data
      if (revenueData && revenueData.length > 0) {
        const formattedRevenue = revenueData.map((b: any) => ({
          'Date': format(new Date(b.created_at), 'EEEE d MMM yyyy HH:mm'),
          'Reference': b.booking_reference,
          'Customer': b.customer?.name || 'Guest',
          'Amount (RM)': b.total_amount,
          'Status': b.status,
          'Payment Method': b.payment_method
        }));
        const wsRev = XLSX.utils.json_to_sheet(formattedRevenue);
        XLSX.utils.book_append_sheet(wb, wsRev, "Revenue");
      }
      // Format Expense data
      if (expenseData && expenseData.length > 0) {
        const formattedExpenses = expenseData.map((e: any) => ({
          'Date': format(new Date(e.created_at), 'EEEE d MMM yyyy HH:mm'),
          'Recipient': e.recipient?.email || '-',
          'Amount (RM)': e.amount,
          'Type': e.payment_type,
          'Status': e.status,
          'Booking Ref': e.booking_reference || '-',
          'Notes': e.notes || '-'
        }));
        const wsExp = XLSX.utils.json_to_sheet(formattedExpenses);
        XLSX.utils.book_append_sheet(wb, wsExp, "Expenses");
      }
      if ((!revenueData || revenueData.length === 0) && (!expenseData || expenseData.length === 0)) {
        toast.info("No financial data found in the selected date range");
        return;
      }
      // Generate filename
      const fileName = `Financials_${format(exportDateRange.from, 'ddMMM')}_to_${format(exportDateRange.to, 'ddMMM')}.xlsx`;
      // Download
      XLSX.writeFile(wb, fileName);
      toast.success("Financial report exported to Excel");
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error("Failed to export financials: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddPayment = async () => {
    if (!newPayment.recipient_id || !newPayment.amount) {
      toast.error("Recipient and Amount are required");
      return;
    }

    try {
      const { error } = await supabase
        .from('vendor_payments')
        .insert({
          recipient_id: newPayment.recipient_id,
          amount: parseFloat(newPayment.amount),
          payment_type: newPayment.payment_type,
          status: newPayment.status,
          notes: newPayment.notes,
          booking_reference: newPayment.booking_reference,
          created_by: currentUser?.id
        });

      if (error) throw error;

      toast.success("Payment record added successfully");
      setIsAddPaymentOpen(false);
      setNewPayment({
        recipient_id: "",
        amount: "",
        payment_type: "full_payment",
        status: "pending",
        notes: "",
        booking_reference: ""
      });
      fetchData();
    } catch (error: any) {
      toast.error(`Error adding payment: ${error.message}`);
    }
  };

  // Calculations
  const totalRevenue = useMemo(() => {
    return bookings
      .filter(b => b.payment_status === 'paid' || b.payment_status === 'completed' || b.status === 'confirmed')
      .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  }, [bookings]);

  const totalExpenses = useMemo(() => {
    return vendorPayments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [vendorPayments]);

  const pendingExpenses = useMemo(() => {
    return vendorPayments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [vendorPayments]);

  // Grouped Payments for Admin View
  const expensesByVendor = useMemo(() => {
    const grouped: Record<string, { email: string, role: string, paid: number, pending: number, total: number }> = {};
    
    vendorPayments.forEach(p => {
      const vendorId = p.recipient_id;
      const vendorEmail = p.recipient?.email || 'Unknown';
      const vendorRole = p.recipient?.role || 'Unknown';
      
      if (!grouped[vendorId]) {
        grouped[vendorId] = { email: vendorEmail, role: vendorRole, paid: 0, pending: 0, total: 0 };
      }
      
      const amount = Number(p.amount || 0);
      if (p.status === 'paid') grouped[vendorId].paid += amount;
      else if (p.status === 'pending') grouped[vendorId].pending += amount;
      
      grouped[vendorId].total += amount;
    });

    return Object.entries(grouped).map(([id, data]) => ({ id, ...data }));
  }, [vendorPayments]);

  // Chart Data: Revenue by Month (Last 6 months)
  const revenueChartData = useMemo(() => {
    const months: Record<string, number> = {};
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = format(d, 'MMM yyyy');
      months[key] = 0;
    }

    bookings.forEach(b => {
      if (b.payment_status === 'paid' || b.payment_status === 'completed' || b.status === 'confirmed') {
        const date = new Date(b.created_at);
        const key = format(date, 'MMM yyyy');
        if (months[key] !== undefined) {
          months[key] += Number(b.total_amount || 0);
        }
      }
    });

    return Object.entries(months).map(([name, value]) => ({ name, value }));
  }, [bookings]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-lg shadow-sm">Paid</Badge>;
      case 'pending': return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-lg">Pending</Badge>;
      case 'cancelled': return <Badge variant="destructive" className="bg-rose-500 hover:bg-rose-600 text-white border-none text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-lg shadow-sm">Cancelled</Badge>;
      default: return <Badge variant="secondary" className="bg-slate-100 text-slate-900 border-none text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-lg">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'full_payment': return <Badge variant="outline" className="bg-primary/5 text-primary/90 border-primary/10 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-lg">Full Payment</Badge>;
      case 'deposit': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-100 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-lg">Deposit</Badge>;
      case 'refund': return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-100 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-lg">Refund</Badge>;
      case 'penalty': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-lg">Penalty</Badge>;
      default: return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-100 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-lg">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-2 animate-in fade-in duration-500">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <Card className="bg-white shadow-sm border border-black/5 rounded-xl overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="h-0.5 bg-emerald-500 w-full" />
          <CardHeader className="pb-0.5 pt-2 px-2.5 space-y-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-emerald-600">Total Revenue</span>
              <div className="p-1 bg-emerald-50 rounded-lg text-emerald-600">
                <TrendingUp className="w-3 h-3" />
              </div>
            </div>
            <CardTitle className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{formatCurrency(totalRevenue)}</CardTitle>
          </CardHeader>
          <CardContent className="pb-2 pt-0.5 px-2.5">
            <p className="text-[11px] sm:text-xs font-medium text-slate-900 flex items-center gap-1 uppercase tracking-wide">
              <Info className="w-2 h-2" />
              From confirmed bookings
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-white shadow-sm border border-black/5 rounded-xl overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="h-0.5 bg-rose-500 w-full" />
          <CardHeader className="pb-0.5 pt-2 px-2.5 space-y-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-rose-600">Total Expenses</span>
              <div className="p-1 bg-rose-50 rounded-lg text-rose-600">
                <TrendingDown className="w-3 h-3" />
              </div>
            </div>
            <CardTitle className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{formatCurrency(totalExpenses)}</CardTitle>
          </CardHeader>
          <CardContent className="pb-2 pt-0.5 px-2.5">
            <p className="text-[11px] sm:text-xs font-medium text-slate-900 flex items-center gap-1 uppercase tracking-wide">
              <Info className="w-2 h-2" />
              Paid to vendors/partners
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border border-black/5 rounded-xl overflow-hidden group hover:shadow-md transition-all duration-300 sm:col-span-2 lg:col-span-1">
          <div className="h-0.5 bg-amber-500 w-full" />
          <CardHeader className="pb-0.5 pt-2 px-2.5 space-y-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-amber-600">Pending Payouts</span>
              <div className="p-1 bg-amber-50 rounded-lg text-amber-600">
                <CreditCard className="w-3 h-3" />
              </div>
            </div>
            <CardTitle className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{formatCurrency(pendingExpenses)}</CardTitle>
          </CardHeader>
          <CardContent className="pb-2 pt-0.5 px-2.5">
            <p className="text-[11px] sm:text-xs font-medium text-slate-900 flex items-center gap-1 uppercase tracking-wide">
              <Info className="w-2 h-2" />
              Scheduled for payment
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="space-y-2" onValueChange={setActiveTab}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 sticky top-0 z-10 bg-white/80 backdrop-blur-md py-1.5 -mx-1 px-1 rounded-xl">
          <TabsList className="grid grid-cols-2 w-full lg:w-[260px] p-1 h-11 bg-white/50 backdrop-blur-md rounded-xl border border-black/5 shadow-xl shadow-primary/5">
            <TabsTrigger value="revenue" className="h-9 px-3 rounded-lg text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg flex items-center justify-center">
              <TrendingUp className="w-3 h-3 mr-1.5" /> Revenue
            </TabsTrigger>
            <TabsTrigger value="expenses" className="h-9 px-3 rounded-lg text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg flex items-center justify-center">
              <TrendingDown className="w-3 h-3 mr-1.5" /> Expenses
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
            <div className="flex flex-col gap-1.5 w-full sm:w-auto p-2.5 border border-black rounded-2xl bg-white/40 shadow-sm transition-all hover:bg-white/60">
              <div className="flex items-center justify-between sm:justify-start gap-2 px-1">
                <span className="text-[10px] sm:text-[11px] font-black text-slate-900 uppercase tracking-widest">Excel Report</span>
             </div>
              <div className="flex gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 sm:w-[180px] justify-start text-left font-black text-[11px] sm:text-xs uppercase tracking-widest border-black/5 shadow-lg shadow-primary/5 h-10 bg-white/80 hover:bg-white rounded-xl px-3 transition-all active:scale-95",
                        !exportDateRange.from && "text-slate-900"
                      )}
                    >
                      <img src={eventHero} className="mr-2 h-4 w-4 rounded-full object-cover grayscale brightness-110" alt="" />
                      {exportDateRange.from ? (
                        exportDateRange.to ? (
                          <span className="truncate text-[11px] sm:text-xs">
                            {format(exportDateRange.from, "EEEE d MMM")} - {format(exportDateRange.to, "EEEE d MMM yyyy")}
                          </span>
                        ) : (
                          <span className="text-[11px] sm:text-xs">{format(exportDateRange.from, "EEEE d MMM yyyy")}</span>
                        )
                      ) : (
                        <span className="text-[11px] sm:text-xs">Select range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl border-black/5 shadow-2xl overflow-hidden" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={exportDateRange.from}
                      selected={{
                        from: exportDateRange.from,
                        to: exportDateRange.to,
                      }}
                      onSelect={(range: any) => {
                        setExportDateRange({
                          from: range?.from,
                          to: range?.to,
                        });
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  onClick={handleExportFinancials}
                  disabled={isExporting || !exportDateRange.from || !exportDateRange.to}
                  className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-xl shadow-xl shadow-emerald-200/50 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-1.5"
                >
                  {isExporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline text-[11px] sm:text-xs">{isExporting ? 'EXPORTING...' : 'EXPORT EXCEL'}</span>
                  <span className="sm:hidden text-[11px] sm:text-xs">{isExporting ? '...' : 'EXPORT'}</span>
                </Button>
              </div>
            </div>

            {activeTab === 'expenses' && isAdmin && (
              <Dialog open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full lg:w-auto bg-primary hover:bg-primary/90 text-white rounded-xl h-10 mt-auto text-[11px] sm:text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 gap-1.5 px-4">
                    <Plus className="w-4 h-4" /> Record Payout
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl overflow-hidden p-0">
                  <div className="bg-primary p-6 text-white">
                    <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Record New Payout
                    </DialogTitle>
                    <DialogDescription className="text-primary/10 text-[11px] sm:text-xs mt-1">
                      Fill out the details to track a payment to a vendor or partner.
                    </DialogDescription>
                  </div>
                  
                  <div className="p-6 space-y-5 bg-white">
                    <div className="space-y-2">
                      <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-900">Recipient (Vendor)</Label>
                      <Select 
                        value={newPayment.recipient_id} 
                        onValueChange={(val) => setNewPayment({...newPayment, recipient_id: val})}
                      >
                        <SelectTrigger className="rounded-xl border-black/10 py-6">
                          <SelectValue placeholder="Select vendor..." className="text-[11px] sm:text-xs" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {adminUsers.map(user => (
                            <SelectItem key={user.id} value={user.id} className="text-[11px] sm:text-xs py-3">
                              {user.email} <span className="text-slate-900 ml-1 opacity-60">({user.role})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-900">Amount (MYR)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900 font-bold text-[11px] sm:text-xs">RM</span>
                          <Input 
                            type="number" 
                            placeholder="0.00" 
                            className="pl-10 rounded-xl border-black/10 py-6 text-[11px] sm:text-xs font-bold"
                            value={newPayment.amount}
                            onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-900">Type</Label>
                        <Select 
                          value={newPayment.payment_type} 
                          onValueChange={(val) => setNewPayment({...newPayment, payment_type: val})}
                        >
                          <SelectTrigger className="rounded-xl border-black/10 py-6">
                            <SelectValue className="text-[11px] sm:text-xs" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="full_payment" className="text-[11px] sm:text-xs">Full Payment</SelectItem>
                            <SelectItem value="deposit" className="text-[11px] sm:text-xs">Deposit</SelectItem>
                            <SelectItem value="refund" className="text-[11px] sm:text-xs">Refund</SelectItem>
                            <SelectItem value="penalty" className="text-[11px] sm:text-xs">Penalty</SelectItem>
                            <SelectItem value="adjustment" className="text-[11px] sm:text-xs">Adjustment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-900">Status</Label>
                        <Select 
                          value={newPayment.status} 
                          onValueChange={(val) => setNewPayment({...newPayment, status: val})}
                        >
                          <SelectTrigger className="rounded-xl border-black/10 py-6">
                            <SelectValue className="text-[11px] sm:text-xs" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="pending" className="text-[11px] sm:text-xs">Pending</SelectItem>
                            <SelectItem value="paid" className="text-[11px] sm:text-xs">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-900">Booking Ref</Label>
                        <Input 
                          placeholder="B-123456" 
                          className="rounded-xl border-black/10 py-6 text-[11px] sm:text-xs uppercase font-mono"
                          value={newPayment.booking_reference}
                          onChange={(e) => setNewPayment({...newPayment, booking_reference: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-900">Internal Notes</Label>
                      <Input 
                        placeholder="Add payment description..." 
                        className="rounded-xl border-black/10 py-6 text-[11px] sm:text-xs"
                        value={newPayment.notes}
                        onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
                      />
                    </div>
                  </div>

                  <DialogFooter className="p-6 bg-slate-50 border-t border-black/5 sm:flex-row gap-3">
                    <Button variant="outline" onClick={() => setIsAddPaymentOpen(false)} className="rounded-xl h-11 flex-1 sm:flex-none border-black/10 text-[11px] sm:text-xs font-bold uppercase tracking-widest">
                      Cancel
                    </Button>
                    <Button onClick={handleAddPayment} className="rounded-xl h-11 flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-white text-[11px] sm:text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary/10">
                      Save Record
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
        </div>
      </div>

      <TabsContent value="revenue" className="space-y-2 animate-in slide-in-from-bottom-4 duration-500">
        <Card className="border border-black/5 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-black/5 pb-1.5 pt-2 px-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3.5 bg-emerald-500 rounded-full" />
              <CardTitle className="text-base sm:text-lg font-black uppercase tracking-widest text-slate-800">Monthly Revenue Growth</CardTitle>
            </div>
            <CardDescription className="text-[11px] sm:text-xs text-slate-900 font-medium">Historical revenue data from the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 h-[200px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#0f172a', fontSize: 11, fontWeight: 700 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(value) => `RM${value}`} 
                  tick={{ fill: '#0f172a', fontSize: 11, fontWeight: 700 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    fontSize: '11px',
                    fontWeight: '800'
                  }}
                  formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                />
                <Bar 
                  dataKey="value" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                  name="Revenue" 
                  barSize={window.innerWidth < 640 ? 20 : 30}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-black/5 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-black/5 py-2 px-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3.5 bg-emerald-500 rounded-full" />
              <CardTitle className="text-base sm:text-lg font-black uppercase tracking-widest text-slate-800">Recent Sales</CardTitle>
            </div>
            <CardDescription className="text-[11px] sm:text-xs text-slate-900 font-medium">Latest confirmed booking transactions.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-black/5 h-8">
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 pl-4">Date</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Reference</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Customer</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Status</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 text-right pr-4">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.slice(0, 10).map((booking) => (
                      <TableRow key={booking.booking_id} className="hover:bg-slate-50/50 transition-colors border-black/5 h-10">
                        <TableCell className="py-1.5 pl-4 text-[11px] sm:text-xs font-bold text-slate-900 whitespace-nowrap">
                          {format(new Date(booking.created_at), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <span className="font-mono text-[11px] sm:text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-900 font-bold uppercase">
                            {booking.booking_reference}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex flex-col">
                            <span className="text-[11px] sm:text-xs font-black text-slate-800 leading-tight">{booking.customer?.name || 'Guest User'}</span>
                            <span className="text-[11px] sm:text-xs font-medium text-slate-900 truncate max-w-[120px]">{booking.customer?.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge 
                            variant={(booking.payment_status === 'paid' || booking.status === 'confirmed') ? 'default' : 'secondary'} 
                            className={`text-[11px] sm:text-xs font-black uppercase tracking-widest px-1.5 py-0 rounded-md shadow-sm h-4 ${(booking.payment_status === 'paid' || booking.status === 'confirmed') ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-none' : 'bg-slate-100 text-slate-900 border-none'}`}
                          >
                            {booking.status === 'confirmed' ? 'paid' : (booking.payment_status || 'pending')}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-right pr-4 font-black text-slate-900 text-[11px] sm:text-xs whitespace-nowrap">
                          {formatCurrency(booking.total_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="expenses" className="space-y-2 animate-in slide-in-from-bottom-4 duration-500">
        {isAdmin && (
          <Card className="border border-black/5 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-black/5 py-2 px-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3.5 bg-rose-500 rounded-full" />
              <CardTitle className="text-base sm:text-lg font-black uppercase tracking-widest text-slate-800">Partner Payout Summary</CardTitle>
            </div>
            <CardDescription className="text-[11px] sm:text-xs text-slate-900 font-medium">Accumulated earnings and pending payments by partner.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-black/5 h-8">
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 pl-4">Partner</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Total Paid</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Pending</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 text-right pr-4">Total Owed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expensesByVendor.map((vendor) => (
                      <TableRow key={vendor.id} className="hover:bg-slate-50/50 transition-colors border-black/5 h-10">
                        <TableCell className="py-1.5 pl-4">
                          <div className="flex flex-col">
                            <span className="text-[11px] sm:text-xs font-black text-slate-800 leading-tight">{vendor.email}</span>
                            <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">{vendor.role}</span>
                          </div>
                        </TableCell>
                          <TableCell className="py-1.5 text-[11px] sm:text-xs font-bold text-emerald-600">
                            {formatCurrency(vendor.paid)}
                          </TableCell>
                          <TableCell className="py-1.5 text-[11px] sm:text-xs font-bold text-amber-600">
                            {formatCurrency(vendor.pending)}
                          </TableCell>
                          <TableCell className="py-1.5 text-right pr-4 font-black text-slate-900 text-[11px] sm:text-xs">
                            {formatCurrency(vendor.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border border-black/5 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-black/5 py-2 px-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3.5 bg-rose-500 rounded-full" />
              <CardTitle className="text-base sm:text-lg font-black uppercase tracking-widest text-slate-800">Recent Transactions</CardTitle>
            </div>
            <CardDescription className="text-[11px] sm:text-xs text-slate-900 font-medium">History of payouts and financial adjustments.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-black/5 h-8">
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 pl-4">Date</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Recipient</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Type</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Status</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Booking Ref</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 text-right pr-4">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorPayments.length === 0 ? (
                      <TableRow className="h-20 hover:bg-transparent border-none">
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="flex flex-col items-center justify-center opacity-40">
                            <History className="w-6 h-6 mb-1.5" />
                            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest">No payment records found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      vendorPayments.map((payment) => (
                        <TableRow key={payment.id} className="hover:bg-slate-50/50 transition-colors border-black/5 h-10">
                          <TableCell className="py-1.5 pl-4 text-[11px] sm:text-xs font-bold text-slate-900 whitespace-nowrap">
                            {format(new Date(payment.created_at), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="py-1.5 text-[11px] sm:text-xs font-black text-slate-800">
                            {payment.recipient?.email || 'System'}
                          </TableCell>
                          <TableCell className="py-1.5">
                            {getTypeBadge(payment.payment_type)}
                          </TableCell>
                          <TableCell className="py-1.5">
                            {getStatusBadge(payment.status)}
                          </TableCell>
                          <TableCell className="py-1.5">
                            {payment.booking_reference ? (
                              <span className="font-mono text-[11px] sm:text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-900 font-bold uppercase">
                                {payment.booking_reference}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="py-1.5 text-right pr-4 font-black text-slate-900 text-[11px] sm:text-xs whitespace-nowrap">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
    </div>
  );
}
