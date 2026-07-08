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
  RefreshCw,
  RotateCcw,
  Edit2,
  Trash2,
  MoreVertical,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import eventHero from "@/assets/event-hero.jpg";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

// Interfaces
interface Booking {
  booking_id: string;
  booking_reference: string;
  total_amount: number;
  payment_type?: string;
  discount_amount?: number;
  outstanding_balance?: number;
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

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#64748b', '#8b5cf6'];

export default function FinancialAnalytics({ currentUser, refreshTrigger }: FinancialAnalyticsProps) {
  const [activeTab, setActiveTab] = useState("revenue");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vendorPayments, setVendorPayments] = useState<VendorPayment[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSlowLoading, setShowSlowLoading] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<VendorPayment | null>(null);
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        if (loading) setShowSlowLoading(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowSlowLoading(false);
    }
  }, [loading]);

  // ... rest of state
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
    return currentUser?.role === 'admin' || currentUser?.role === 'Administrator' || currentUser?.email === 'amirul.mustapha@yahoo.com';
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [currentUser, refreshTrigger]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Add a small delay on mobile to let session stabilize
      if (window.innerWidth < 768) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 1. Fetch Bookings (Revenue)
      const { data: rawBookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          booking_id, 
          booking_reference, 
          total_amount, 
          payment_type,
          discount_amount,
          outstanding_balance,
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
      const fromStr = format(exportDateRange.from, 'yyyy-MM-dd');
      const toStr = format(exportDateRange.to, 'yyyy-MM-dd');
      const fromIso = exportDateRange.from.toISOString();
      const toIso = exportDateRange.to.toISOString();

      // 1. Fetch Revenue (Bookings) - Filter by Flight Date OR Created Date fallback
      const { data: revenueData, error: revenueError } = await supabase
        .from('bookings')
        .select(`
          created_at,
          flight_date,
          booking_reference,
          total_amount,
          payment_type,
          discount_amount,
          outstanding_balance,
          status,
          payment_status,
          payment_method,
          customer:customers(name, email)
        `)
        .or(`flight_date.gte.${fromStr},and(flight_date.is.null,created_at.gte.${fromIso})`)
        .or(`flight_date.lte.${toStr},and(flight_date.is.null,created_at.lte.${toIso})`)
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
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false });
      if (expenseError) {
        console.warn("Error fetching vendor_payments for export:", expenseError);
      }
      // Create workbook
      const wb = XLSX.utils.book_new();
      if (revenueData && revenueData.length > 0) {
        const formattedRevenue = revenueData.map((b: any) => ({
          'Date (Created)': format(new Date(b.created_at), 'EEEE d MMM yyyy HH:mm'),
          'Flight Date': b.flight_date || '-',
          'Reference': b.booking_reference,
          'Customer': b.customer?.name || 'Guest',
          'Payment Type': b.payment_type || 'full',
          'Status': b.status,
          'Payment Status': b.payment_status,
          'Payment Method': b.payment_method,
          'Total Amount (RM)': b.total_amount,
          'Discount (RM)': b.discount_amount || 0,
          'Outstanding Balance (RM)': b.outstanding_balance || 0
        }));
        const wsRev = XLSX.utils.json_to_sheet(formattedRevenue);

        // Apply basic styling to headers and colors (using sheet properties)
        const range = XLSX.utils.decode_range(wsRev['!ref'] || 'A1');
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          const statusCell = wsRev[XLSX.utils.encode_cell({ r: R, c: 5 })]; // Status column
          if (statusCell && statusCell.v === 'cancelled') {
            // XLSX doesn't support complex CSS colors easily without extra libs, 
            // but we can add meta info or use common patterns if needed
          }
        }

        XLSX.utils.book_append_sheet(wb, wsRev, "Revenue Details");

        // 3. Add Monthly Summary Sheet (EXACT MATCH TO DASHBOARD TOP PANEL)
        const monthlySummary: Record<string, { 
          Month: string, 
          'Total Revenue (RM)': number, 
          'Bookings Count': number, 
          'Full Payments (RM)': number,
          'Deposits (RM)': number, 
          'Refunds (RM)': number,
          'Cancelled (Count)': number
        }> = {};
        
        // Use the SAME filtering logic as dashboard top panel
        revenueData.forEach((b: any) => {
          const amount = Number(b.total_amount || 0);
          const isCancelled = b.status === 'cancelled';
          const isEligible = b.status === 'completed' && b.payment_status === 'paid';

          if (isEligible || isCancelled) {
            // Grouping by Flight Date as requested
            const dateStr = b.flight_date || b.created_at;
            const date = new Date(dateStr);
            const key = format(date, 'MMM yyyy');
            
            if (!monthlySummary[key]) {
              monthlySummary[key] = { 
                Month: key, 
                'Total Revenue (RM)': 0, 
                'Bookings Count': 0, 
                'Full Payments (RM)': 0,
                'Deposits (RM)': 0, 
                'Refunds (RM)': 0,
                'Cancelled (Count)': 0
              };
            }

            if (isCancelled) {
              monthlySummary[key]['Cancelled (Count)'] += 1;
            } else if (isEligible) {
              monthlySummary[key]['Total Revenue (RM)'] += amount;
              monthlySummary[key]['Bookings Count'] += 1;
              
              if (b.payment_type === 'deposit') {
                monthlySummary[key]['Deposits (RM)'] += amount;
              } else {
                monthlySummary[key]['Full Payments (RM)'] += amount;
              }
            }
          }
        });

        const summaryData = Object.values(monthlySummary).sort((a, b) => {
          return new Date(a.Month).getTime() - new Date(b.Month).getTime();
        });

        // Add overall total row that matches RM 46,172.10 card
        const grandTotalRevenue = summaryData.reduce((sum, item) => sum + item['Total Revenue (RM)'], 0);
        const grandTotalBookings = summaryData.reduce((sum, item) => sum + item['Bookings Count'], 0);
        
        const finalSummaryData: any[] = [
          { Month: 'GRAND TOTAL (SELECTED RANGE)', 'Total Revenue (RM)': grandTotalRevenue, 'Bookings Count': grandTotalBookings },
          {}, // Empty row
          ...summaryData,
          {}, // Empty row
          { Month: 'CALCULATION LOGIC DETAILS:' },
          { Month: '- Total Revenue (RM)', 'Total Revenue (RM)': 'Sum of Total Amount' },
          { Month: '- Bookings Count', 'Total Revenue (RM)': 'Count of Completed + Paid bookings' },
          { Month: '- Filtering Criteria', 'Total Revenue (RM)': 'status = "completed" AND payment_status = "paid"' },
          { Month: '- Grouping Method', 'Total Revenue (RM)': 'Based on Flight Date (falls back to Created Date)' }
        ];

        const wsSum = XLSX.utils.json_to_sheet(finalSummaryData);
        XLSX.utils.book_append_sheet(wb, wsSum, "Monthly Summary");
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

  const handleUpdatePayment = async () => {
    if (!editingPayment || !editingPayment.recipient_id || !editingPayment.amount) {
      toast.error("Recipient and Amount are required");
      return;
    }

    try {
      const { error } = await supabase
        .from('vendor_payments')
        .update({
          recipient_id: editingPayment.recipient_id,
          amount: parseFloat(editingPayment.amount.toString()),
          payment_type: editingPayment.payment_type,
          status: editingPayment.status,
          notes: editingPayment.notes,
          booking_reference: editingPayment.booking_reference,
          paid_at: editingPayment.status === 'paid' ? (editingPayment.paid_at || new Date().toISOString()) : null
        })
        .eq('id', editingPayment.id);

      if (error) throw error;

      toast.success("Payment record updated successfully");
      setIsEditPaymentOpen(false);
      setEditingPayment(null);
      fetchData();
    } catch (error: any) {
      toast.error(`Error updating payment: ${error.message}`);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment record? This action cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from('vendor_payments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Payment record deleted successfully");
      fetchData();
    } catch (error: any) {
      toast.error(`Error deleting payment: ${error.message}`);
    }
  };

  // Calculations
  const totalRevenue = useMemo(() => {
    return bookings
      .filter(b => b.status === 'completed' && b.payment_status === 'paid')
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
      if (b.status === 'completed' && b.payment_status === 'paid') {
        const dateStr = b.flight_date || b.created_at;
        const date = new Date(dateStr);
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
      case 'paid': return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none text-[8px] font-bold font-sans uppercase tracking-tight px-1.5 py-0.5 rounded-lg shadow-sm">Paid</Badge>;
      case 'pending': return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[8px] font-bold font-sans uppercase tracking-tight px-1.5 py-0.5 rounded-lg">Pending</Badge>;
      case 'cancelled': return <Badge variant="destructive" className="bg-rose-500 hover:bg-rose-600 text-white border-none text-[8px] font-bold font-sans uppercase tracking-tight px-1.5 py-0.5 rounded-lg shadow-sm">Cancelled</Badge>;
      default: return <Badge variant="secondary" className="bg-slate-100 text-slate-900 border-none text-[8px] font-bold font-sans uppercase tracking-tight px-1.5 py-0.5 rounded-lg">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'full_payment': return <Badge variant="outline" className="bg-slate-50 text-slate-600/90 border-slate-200 text-[8px] font-bold font-sans uppercase tracking-tight px-1.5 py-0.5 rounded-lg">Full Payment</Badge>;
      case 'deposit': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-100 text-[8px] font-bold font-sans uppercase tracking-tight px-1.5 py-0.5 rounded-lg">Deposit</Badge>;
      case 'refund': return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-100 text-[8px] font-bold font-sans uppercase tracking-tight px-1.5 py-0.5 rounded-lg">Refund</Badge>;
      case 'penalty': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[8px] font-bold font-sans uppercase tracking-tight px-1.5 py-0.5 rounded-lg">Penalty</Badge>;
      default: return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-100 text-[8px] font-bold font-sans uppercase tracking-tight px-1.5 py-0.5 rounded-lg">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white/50 backdrop-blur-md rounded-2xl border border-black/5">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400 mb-4" />
        <p className="text-sm text-slate-500 font-medium uppercase tracking-tight">Loading Financial Data...</p>
        {showSlowLoading && (
          <div className="mt-6 animate-in fade-in duration-500 flex flex-col items-center">
            <p className="text-xs text-slate-400 mb-4 max-w-xs text-center uppercase tracking-tight">This is taking longer than usual on mobile networks.</p>
            <Button variant="outline" size="sm" onClick={() => fetchData()} className="gap-2 border-black/10">
              <RotateCcw className="h-3.5 w-3.5" />
              Retry Now
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-in fade-in duration-500">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-sans">
        <Card className="bg-white shadow-sm border border-black/5 rounded-xl overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="h-0.5 bg-emerald-500 w-full" />
          <CardHeader className="pb-0.5 pt-2 px-2.5 space-y-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-emerald-600">Total Revenue</span>
              <div className="p-1 bg-emerald-50 rounded-lg text-emerald-600">
                <TrendingUp className="w-3 h-3" />
              </div>
            </div>
            <CardTitle className="text-base sm:text-lg font-bold font-sans text-slate-900 mt-0.5">{formatCurrency(totalRevenue)}</CardTitle>
          </CardHeader>
          <CardContent className="pb-2 pt-0.5 px-2.5">
            <p className="text-[11px] sm:text-xs font-bold font-sans text-slate-900 flex items-center gap-1 uppercase tracking-tight">
              <Info className="w-2 h-2" />
              From completed & paid bookings
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-white shadow-sm border border-black/5 rounded-xl overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="h-0.5 bg-rose-500 w-full" />
          <CardHeader className="pb-0.5 pt-2 px-2.5 space-y-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-rose-600">Total Expenses</span>
              <div className="p-1 bg-rose-50 rounded-lg text-rose-600">
                <TrendingDown className="w-3 h-3" />
              </div>
            </div>
            <CardTitle className="text-base sm:text-lg font-bold font-sans text-slate-900 mt-0.5">{formatCurrency(totalExpenses)}</CardTitle>
          </CardHeader>
          <CardContent className="pb-2 pt-0.5 px-2.5">
            <p className="text-[11px] sm:text-xs font-bold font-sans text-slate-900 flex items-center gap-1 uppercase tracking-tight">
              <Info className="w-2 h-2" />
              Paid to vendors/partners
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border border-black/5 rounded-xl overflow-hidden group hover:shadow-md transition-all duration-300 sm:col-span-2 lg:col-span-1">
          <div className="h-0.5 bg-amber-500 w-full" />
          <CardHeader className="pb-0.5 pt-2 px-2.5 space-y-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-amber-600">Pending Payouts</span>
              <div className="p-1 bg-amber-50 rounded-lg text-amber-600">
                <CreditCard className="w-3 h-3" />
              </div>
            </div>
            <CardTitle className="text-base sm:text-lg font-bold font-sans text-slate-900 mt-0.5">{formatCurrency(pendingExpenses)}</CardTitle>
          </CardHeader>
          <CardContent className="pb-2 pt-0.5 px-2.5">
            <p className="text-[11px] sm:text-xs font-bold font-sans text-slate-900 flex items-center gap-1 uppercase tracking-tight">
              <Info className="w-2 h-2" />
              Scheduled for payment
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="space-y-4 sm:space-y-6 font-sans" onValueChange={setActiveTab}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-0 z-10 bg-white/80 backdrop-blur-md py-3 -mx-2 px-2 rounded-xl border-b border-black/5 sm:border-none">
          <TabsList className="grid grid-cols-2 w-full lg:w-[260px] p-1 h-12 sm:h-14 bg-white/50 backdrop-blur-md rounded-xl border border-black/5 shadow-xl shadow-slate-200/50">
            <TabsTrigger value="revenue" className="h-10 sm:h-12 px-3 rounded-lg text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight transition-all data-[state=active]:bg-slate-700 data-[state=active]:text-white data-[state=active]:shadow-lg flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5 sm:mr-2" /> Revenue
            </TabsTrigger>
            <TabsTrigger value="expenses" className="h-10 sm:h-12 px-3 rounded-lg text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight transition-all data-[state=active]:bg-slate-700 data-[state=active]:text-white data-[state=active]:shadow-lg flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5 mr-1.5 sm:mr-2" /> Expenses
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="flex flex-col gap-2 w-full sm:w-auto p-3 sm:p-4 border border-black/10 rounded-2xl bg-white/40 shadow-sm transition-all hover:bg-white/60">
              <div className="flex items-center justify-between sm:justify-start gap-2 px-1">
                <span className="text-[10px] sm:text-[11px] font-bold font-sans text-slate-900 uppercase tracking-tight">Financial Report</span>
                <Badge variant="outline" className="sm:hidden text-[8px] border-emerald-200 text-emerald-700 bg-emerald-50 font-bold uppercase">Excel</Badge>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full sm:w-[200px] justify-start text-left font-bold font-sans text-[11px] sm:text-xs uppercase tracking-tight border-black/5 shadow-lg shadow-slate-200/50 h-10 sm:h-12 bg-white/80 hover:bg-white rounded-xl px-3 transition-all active:scale-95",
                        !exportDateRange.from && "text-slate-900"
                      )}
                    >
                      <img src={eventHero} className="mr-2 h-4 w-4 sm:h-5 sm:w-5 rounded-full object-cover grayscale brightness-110" alt="" />
                      {exportDateRange.from ? (
                        exportDateRange.to ? (
                          <span className="truncate">
                            {format(exportDateRange.from, "d MMM")} - {format(exportDateRange.to, "d MMM yyyy")}
                          </span>
                        ) : (
                          <span className="truncate">{format(exportDateRange.from, "d MMM yyyy")}</span>
                        )
                      ) : (
                        <span>Select Range</span>
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
                      numberOfMonths={window.innerWidth < 640 ? 1 : 2}
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  onClick={handleExportFinancials}
                  disabled={isExporting || !exportDateRange.from || !exportDateRange.to}
                  className="w-full sm:w-auto h-10 sm:h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold font-sans uppercase tracking-tight text-[11px] sm:text-xs rounded-xl shadow-xl shadow-emerald-200/50 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isExporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                  <span>{isExporting ? 'EXPORTING...' : 'DOWNLOAD EXCEL'}</span>
                </Button>
              </div>
            </div>

            {activeTab === 'expenses' && isAdmin && (
              <Dialog open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full lg:w-auto bg-slate-700 hover:bg-slate-800 text-white rounded-xl h-10 sm:h-12 text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight shadow-lg shadow-slate-200/50 gap-2 px-6">
                    <Plus className="w-4 h-4" /> Record Payout
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl overflow-hidden p-0 font-sans">
                  <div className="bg-slate-700 p-6 text-white">
                    <DialogTitle className="text-base sm:text-lg font-bold font-sans flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Record New Payout
                    </DialogTitle>
                    <DialogDescription className="text-slate-600/10 text-[11px] sm:text-xs mt-1 font-bold font-sans uppercase tracking-tight">
                      Fill out the details to track a payment to a vendor or partner.
                    </DialogDescription>
                  </div>
                  
                  <div className="p-6 space-y-5 bg-white">
                    <div className="space-y-2">
                      <Label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Recipient (Vendor)</Label>
                      <Select 
                        value={newPayment.recipient_id} 
                        onValueChange={(val) => setNewPayment({...newPayment, recipient_id: val})}
                      >
                        <SelectTrigger className="rounded-xl border-black/10 py-6 font-bold font-sans">
                          <SelectValue placeholder="Select vendor..." className="text-[11px] sm:text-xs" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl font-sans">
                          {adminUsers.map(user => (
                            <SelectItem key={user.id} value={user.id} className="text-[11px] sm:text-xs py-3 font-bold">
                              {user.email} <span className="text-slate-900 ml-1 opacity-60">({user.role})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Amount (MYR)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900 font-bold text-[11px] sm:text-xs font-sans">RM</span>
                          <Input 
                            type="number" 
                            placeholder="0.00" 
                            className="pl-10 rounded-xl border-black/10 py-6 text-[11px] sm:text-xs font-bold font-sans"
                            value={newPayment.amount}
                            onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Type</Label>
                        <Select 
                          value={newPayment.payment_type} 
                          onValueChange={(val) => setNewPayment({...newPayment, payment_type: val})}
                        >
                          <SelectTrigger className="rounded-xl border-black/10 py-6 font-bold font-sans">
                            <SelectValue className="text-[11px] sm:text-xs" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl font-sans">
                            <SelectItem value="full_payment" className="text-[11px] sm:text-xs font-bold">Full Payment</SelectItem>
                            <SelectItem value="deposit" className="text-[11px] sm:text-xs font-bold">Deposit</SelectItem>
                            <SelectItem value="refund" className="text-[11px] sm:text-xs font-bold">Refund</SelectItem>
                            <SelectItem value="penalty" className="text-[11px] sm:text-xs font-bold">Penalty</SelectItem>
                            <SelectItem value="adjustment" className="text-[11px] sm:text-xs font-bold">Adjustment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Status</Label>
                        <Select 
                          value={newPayment.status} 
                          onValueChange={(val) => setNewPayment({...newPayment, status: val})}
                        >
                          <SelectTrigger className="rounded-xl border-black/10 py-6 font-bold font-sans">
                            <SelectValue className="text-[11px] sm:text-xs" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl font-sans">
                            <SelectItem value="pending" className="text-[11px] sm:text-xs font-bold">Pending</SelectItem>
                            <SelectItem value="paid" className="text-[11px] sm:text-xs font-bold">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Booking Ref</Label>
                        <Input 
                          placeholder="B-123456" 
                          className="rounded-xl border-black/10 py-6 text-[11px] sm:text-xs uppercase font-mono font-bold"
                          value={newPayment.booking_reference}
                          onChange={(e) => setNewPayment({...newPayment, booking_reference: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Internal Notes</Label>
                      <Input 
                        placeholder="Add payment description..." 
                        className="rounded-xl border-black/10 py-6 text-[11px] sm:text-xs font-bold font-sans"
                        value={newPayment.notes}
                        onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
                      />
                    </div>
                  </div>

                  <DialogFooter className="p-6 bg-slate-50 border-t border-black/5 sm:flex-row gap-3">
                    <Button variant="outline" onClick={() => setIsAddPaymentOpen(false)} className="rounded-xl h-11 flex-1 sm:flex-none border-black/10 text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight">
                      Cancel
                    </Button>
                    <Button onClick={handleAddPayment} className="rounded-xl h-11 flex-1 sm:flex-none bg-slate-700 hover:bg-slate-700/90 text-white text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight shadow-lg shadow-slate-100/50">
                      Save Record
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
        </div>
      </div>

      <TabsContent value="revenue" className="space-y-2 animate-in slide-in-from-bottom-4 duration-500 font-sans">
        <Card className="border border-black/5 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-black/5 pb-1.5 pt-2 px-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3.5 bg-emerald-500 rounded-full" />
              <CardTitle className="text-base sm:text-lg font-bold font-sans uppercase tracking-tight text-slate-800">Monthly Revenue Growth</CardTitle>
            </div>
            <CardDescription className="text-[11px] sm:text-xs text-slate-900 font-bold font-sans uppercase tracking-tight">Historical revenue data from the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 h-[200px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#0f172a', fontSize: 11, fontWeight: 700, fontFamily: 'Poppins, sans-serif' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(value) => `RM${value}`} 
                  tick={{ fill: '#0f172a', fontSize: 11, fontWeight: 700, fontFamily: 'Poppins, sans-serif' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    fontSize: '11px',
                    fontWeight: '800',
                    fontFamily: 'Poppins, sans-serif'
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
              <CardTitle className="text-base sm:text-lg font-bold font-sans uppercase tracking-tight text-slate-800">Recent Sales</CardTitle>
            </div>
            <CardDescription className="text-[11px] sm:text-xs text-slate-900 font-bold font-sans uppercase tracking-tight">Latest booking transactions.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden sm:block overflow-x-auto">
              <div className="min-w-[600px]">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-black/5 h-8">
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900 pl-4">Date</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Reference</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Customer</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Booking Status</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Payment Status</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900 text-right pr-4">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.slice(0, 10).map((booking) => (
                      <TableRow key={booking.booking_id} className="hover:bg-slate-50/50 transition-colors border-black/5 h-10">
                        <TableCell className="py-1.5 pl-4 text-[11px] sm:text-xs font-bold font-sans text-slate-900 whitespace-nowrap">
                          {format(new Date(booking.created_at), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <span className="font-mono text-[11px] sm:text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-900 font-bold uppercase">
                            {booking.booking_reference}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex flex-col">
                            <span className="text-[11px] sm:text-xs font-bold font-sans text-slate-800 leading-tight">{booking.customer?.name || 'Guest User'}</span>
                            <span className="text-[11px] sm:text-xs font-bold font-sans text-slate-900 truncate max-w-[120px]">{booking.customer?.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 border shadow-sm rounded-lg",
                              booking.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              booking.status === 'confirmed' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              booking.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-slate-100 text-slate-900 border-none'
                            )}
                          >
                            {booking.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 border shadow-sm rounded-lg",
                              booking.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              booking.payment_status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-100 text-slate-900 border-none'
                            )}
                          >
                            {booking.payment_status || 'unpaid'}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-right pr-4 font-bold font-sans text-slate-900 text-[11px] sm:text-xs whitespace-nowrap">
                          {formatCurrency(booking.total_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile Card View for Revenue */}
            <div className="sm:hidden divide-y divide-black/5">
              {bookings.length === 0 ? (
                <div className="p-8 text-center opacity-40">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">No revenue records</p>
                </div>
              ) : (
                bookings.slice(0, 10).map((booking) => (
                  <div key={booking.booking_id} className="p-4 space-y-3 bg-white/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-900">
                        {format(new Date(booking.created_at), 'dd MMM yyyy')}
                      </span>
                      <div className="flex gap-1">
                        <Badge 
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded-lg shadow-sm",
                            booking.status === 'completed' ? 'bg-emerald-500 text-white' :
                            booking.status === 'confirmed' ? 'bg-indigo-500 text-white' :
                            booking.status === 'cancelled' ? 'bg-rose-500 text-white' :
                            'bg-slate-100 text-slate-900'
                          )}
                        >
                          {booking.status}
                        </Badge>
                        <Badge 
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded-lg shadow-sm",
                            booking.payment_status === 'paid' ? 'bg-emerald-600 text-white' :
                            booking.payment_status === 'partial' ? 'bg-amber-500 text-white' :
                            'bg-slate-100 text-slate-900'
                          )}
                        >
                          {booking.payment_status || 'unpaid'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-800 leading-tight truncate">{booking.customer?.name || 'Guest User'}</p>
                        <p className="text-[10px] font-medium text-slate-500 truncate">{booking.customer?.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-900">{formatCurrency(booking.total_amount)}</p>
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">{booking.booking_reference}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="expenses" className="space-y-2 animate-in slide-in-from-bottom-4 duration-500 font-sans">
        {isAdmin && (
          <Card className="border border-black/5 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-black/5 py-2 px-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3.5 bg-rose-500 rounded-full" />
              <CardTitle className="text-base sm:text-lg font-bold font-sans uppercase tracking-tight text-slate-800">Partner Payout Summary</CardTitle>
            </div>
            <CardDescription className="text-[11px] sm:text-xs text-slate-900 font-bold font-sans uppercase tracking-tight">Accumulated earnings and pending payments by partner.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden sm:block overflow-x-auto">
              <div className="min-w-[500px]">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-black/5 h-8">
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900 pl-4">Partner</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Total Paid</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Pending</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900 text-right pr-4">Total Owed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expensesByVendor.map((vendor) => (
                      <TableRow key={vendor.id} className="hover:bg-slate-50/50 transition-colors border-black/5 h-10">
                        <TableCell className="py-1.5 pl-4">
                          <div className="flex flex-col">
                            <span className="text-[11px] sm:text-xs font-bold font-sans text-slate-800 leading-tight">{vendor.email}</span>
                            <span className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">{vendor.role}</span>
                          </div>
                        </TableCell>
                          <TableCell className="py-1.5 text-[11px] sm:text-xs font-bold font-sans text-emerald-600">
                            {formatCurrency(vendor.paid)}
                          </TableCell>
                          <TableCell className="py-1.5 text-[11px] sm:text-xs font-bold font-sans text-amber-600">
                            {formatCurrency(vendor.pending)}
                          </TableCell>
                          <TableCell className="py-1.5 text-right pr-4 font-bold font-sans text-slate-900 text-[11px] sm:text-xs">
                            {formatCurrency(vendor.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Mobile Card View for Partner Summary */}
              <div className="sm:hidden divide-y divide-black/5">
                {expensesByVendor.length === 0 ? (
                  <div className="p-8 text-center opacity-40">
                    <User className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs font-bold uppercase tracking-widest">No partner data</p>
                  </div>
                ) : (
                  expensesByVendor.map((vendor) => (
                    <div key={vendor.id} className="p-4 space-y-3 bg-white/50 backdrop-blur-sm">
                      <div className="flex flex-col space-y-1">
                        <p className="text-[11px] font-bold text-slate-800 leading-tight truncate">{vendor.email}</p>
                        <Badge variant="outline" className="w-fit text-[9px] font-bold uppercase border-slate-200 text-slate-500 py-0 h-4">
                          {vendor.role}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-black/5 mt-2">
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Paid</p>
                          <p className="text-[10px] font-bold text-emerald-600">{formatCurrency(vendor.paid)}</p>
                        </div>
                        <div className="space-y-0.5 text-center">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Pending</p>
                          <p className="text-[10px] font-bold text-amber-600">{formatCurrency(vendor.pending)}</p>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                          <p className="text-[10px] font-bold text-slate-900">{formatCurrency(vendor.total)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border border-black/5 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-black/5 py-2 px-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3.5 bg-rose-500 rounded-full" />
              <CardTitle className="text-base sm:text-lg font-bold font-sans uppercase tracking-tight text-slate-800">Recent Transactions</CardTitle>
            </div>
            <CardDescription className="text-[11px] sm:text-xs text-slate-900 font-bold font-sans uppercase tracking-tight">History of payouts and financial adjustments.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden sm:block overflow-x-auto">
              <div className="min-w-[700px]">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-black/5 h-8">
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900 pl-4">Date</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Recipient</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Type</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Status</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Booking Ref</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900 text-right">Amount</TableHead>
                      {isAdmin && <TableHead className="w-10 pr-4"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorPayments.length === 0 ? (
                      <TableRow className="h-20 hover:bg-transparent border-none">
                        <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8">
                          <div className="flex flex-col items-center justify-center opacity-40">
                            <History className="w-6 h-6 mb-1.5" />
                            <p className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight">No payment records found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      vendorPayments.slice(0, 10).map((payment) => (
                        <TableRow key={payment.id} className="hover:bg-slate-50/50 transition-colors border-black/5 h-10">
                          <TableCell className="py-1.5 pl-4 text-[11px] sm:text-xs font-bold font-sans text-slate-900 whitespace-nowrap">
                            {format(new Date(payment.created_at), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="py-1.5 text-[11px] sm:text-xs font-bold font-sans text-slate-800">
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
                          <TableCell className="py-1.5 text-right font-bold font-sans text-slate-900 text-[11px] sm:text-xs whitespace-nowrap">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="py-1.5 pr-4 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100">
                                    <MoreVertical className="h-4 w-4 text-slate-500" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl border-black/5 shadow-xl">
                                  <DropdownMenuItem 
                                    className="text-xs font-bold font-sans uppercase tracking-tight py-2.5 cursor-pointer flex items-center gap-2"
                                    onClick={() => {
                                      setEditingPayment(payment);
                                      setIsEditPaymentOpen(true);
                                    }}
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                    Edit Record
                                  </DropdownMenuItem>
                                  {payment.status === 'pending' && (
                                    <DropdownMenuItem 
                                      className="text-xs font-bold font-sans uppercase tracking-tight py-2.5 cursor-pointer flex items-center gap-2 text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50"
                                      onClick={async () => {
                                        try {
                                          const { error } = await supabase
                                            .from('vendor_payments')
                                            .update({ status: 'paid', paid_at: new Date().toISOString() })
                                            .eq('id', payment.id);
                                          if (error) throw error;
                                          toast.success("Payment marked as paid");
                                          fetchData();
                                        } catch (e: any) {
                                          toast.error("Failed to update: " + e.message);
                                        }
                                      }}
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      Mark as Paid
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem 
                                    className="text-xs font-bold font-sans uppercase tracking-tight py-2.5 cursor-pointer flex items-center gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                                    onClick={() => handleDeletePayment(payment.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete Record
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile Card View for Expenses */}
            <div className="sm:hidden divide-y divide-black/5">
              {vendorPayments.length === 0 ? (
                <div className="p-8 text-center opacity-40">
                  <TrendingDown className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">No payout records</p>
                </div>
              ) : (
                vendorPayments.slice(0, 10).map((payment) => (
                  <div key={payment.id} className="p-4 space-y-3 bg-white/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-900">
                          {format(new Date(payment.created_at), 'dd MMM yyyy')}
                        </span>
                        {getStatusBadge(payment.status)}
                      </div>
                      
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-slate-100 -mr-2">
                              <MoreVertical className="h-3.5 w-3.5 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl border-black/5 shadow-xl">
                            <DropdownMenuItem 
                              className="text-[11px] font-bold font-sans uppercase tracking-tight py-2.5 cursor-pointer flex items-center gap-2"
                              onClick={() => {
                                setEditingPayment(payment);
                                setIsEditPaymentOpen(true);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              Edit Record
                            </DropdownMenuItem>
                            {payment.status === 'pending' && (
                              <DropdownMenuItem 
                                className="text-[11px] font-bold font-sans uppercase tracking-tight py-2.5 cursor-pointer flex items-center gap-2 text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50"
                                onClick={async () => {
                                  try {
                                    const { error } = await supabase
                                      .from('vendor_payments')
                                      .update({ status: 'paid', paid_at: new Date().toISOString() })
                                      .eq('id', payment.id);
                                    if (error) throw error;
                                    toast.success("Payment marked as paid");
                                    fetchData();
                                  } catch (e: any) {
                                    toast.error("Failed to update: " + e.message);
                                  }
                                }}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Mark as Paid
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              className="text-[11px] font-bold font-sans uppercase tracking-tight py-2.5 cursor-pointer flex items-center gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                              onClick={() => handleDeletePayment(payment.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete Record
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-800 leading-tight truncate">{payment.recipient?.email || 'System'}</p>
                        <div className="flex items-center gap-2">
                          {getTypeBadge(payment.payment_type)}
                          {payment.booking_reference && (
                            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter truncate">{payment.booking_reference}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>

      {/* Edit Payment Dialog */}
      <Dialog open={isEditPaymentOpen} onOpenChange={setIsEditPaymentOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl overflow-hidden p-0 font-sans">
          <div className="bg-slate-700 p-6 text-white">
            <DialogTitle className="text-base sm:text-lg font-bold font-sans flex items-center gap-2">
              <Edit2 className="w-5 h-5" />
              Edit Payment Record
            </DialogTitle>
            <DialogDescription className="text-slate-600/10 text-[11px] sm:text-xs mt-1 font-bold font-sans uppercase tracking-tight">
              Update the details of this payout transaction.
            </DialogDescription>
          </div>
          
          {editingPayment && (
            <div className="p-6 space-y-5 bg-white">
              <div className="space-y-2">
                <Label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Recipient (Vendor)</Label>
                <Select 
                  value={editingPayment.recipient_id} 
                  onValueChange={(val) => setEditingPayment({...editingPayment, recipient_id: val})}
                >
                  <SelectTrigger className="rounded-xl border-black/10 py-6 font-bold font-sans">
                    <SelectValue placeholder="Select vendor..." className="text-[11px] sm:text-xs" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl font-sans">
                    {adminUsers.map(user => (
                      <SelectItem key={user.id} value={user.id} className="text-[11px] sm:text-xs py-3 font-bold">
                        {user.email} <span className="text-slate-900 ml-1 opacity-60">({user.role})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Amount (MYR)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900 font-bold text-[11px] sm:text-xs font-sans">RM</span>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      className="pl-10 rounded-xl border-black/10 py-6 text-[11px] sm:text-xs font-bold font-sans"
                      value={editingPayment.amount}
                      onChange={(e) => setEditingPayment({...editingPayment, amount: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Type</Label>
                  <Select 
                    value={editingPayment.payment_type} 
                    onValueChange={(val: any) => setEditingPayment({...editingPayment, payment_type: val})}
                  >
                    <SelectTrigger className="rounded-xl border-black/10 py-6 font-bold font-sans">
                      <SelectValue className="text-[11px] sm:text-xs" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl font-sans">
                      <SelectItem value="full_payment" className="text-[11px] sm:text-xs font-bold">Full Payment</SelectItem>
                      <SelectItem value="deposit" className="text-[11px] sm:text-xs font-bold">Deposit</SelectItem>
                      <SelectItem value="refund" className="text-[11px] sm:text-xs font-bold">Refund</SelectItem>
                      <SelectItem value="penalty" className="text-[11px] sm:text-xs font-bold">Penalty</SelectItem>
                      <SelectItem value="adjustment" className="text-[11px] sm:text-xs font-bold">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Status</Label>
                  <Select 
                    value={editingPayment.status} 
                    onValueChange={(val: any) => setEditingPayment({...editingPayment, status: val})}
                  >
                    <SelectTrigger className="rounded-xl border-black/10 py-6 font-bold font-sans">
                      <SelectValue className="text-[11px] sm:text-xs" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl font-sans">
                      <SelectItem value="pending" className="text-[11px] sm:text-xs font-bold">Pending</SelectItem>
                      <SelectItem value="paid" className="text-[11px] sm:text-xs font-bold">Paid</SelectItem>
                      <SelectItem value="cancelled" className="text-[11px] sm:text-xs font-bold text-rose-600">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Booking Ref</Label>
                  <Input 
                    placeholder="B-123456" 
                    className="rounded-xl border-black/10 py-6 text-[11px] sm:text-xs uppercase font-mono font-bold"
                    value={editingPayment.booking_reference || ""}
                    onChange={(e) => setEditingPayment({...editingPayment, booking_reference: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Internal Notes</Label>
                <Input 
                  placeholder="Add payment description..." 
                  className="rounded-xl border-black/10 py-6 text-[11px] sm:text-xs font-bold font-sans"
                  value={editingPayment.notes || ""}
                  onChange={(e) => setEditingPayment({...editingPayment, notes: e.target.value})}
                />
              </div>
            </div>
          )}

          <DialogFooter className="p-6 bg-slate-50 border-t border-black/5 sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setIsEditPaymentOpen(false)} className="rounded-xl h-11 flex-1 sm:flex-none border-black/10 text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight">
              Cancel
            </Button>
            <Button onClick={handleUpdatePayment} className="rounded-xl h-11 flex-1 sm:flex-none bg-slate-700 hover:bg-slate-700/90 text-white text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight shadow-lg shadow-slate-100/50">
              Update Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
