import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Loader2, 
  Search, 
  Activity, 
  ChevronLeft, 
  ChevronRight,
  BarChart3, 
  TrendingUp, 
  Users as UsersIcon, 
  Clock, 
  PieChart as PieChartIcon, 
  Layout as LayoutIcon,
  Filter,
  ArrowUpRight,
  UserCheck,
  ClipboardList,
  Trash2,
  MoreHorizontal,
  RefreshCw
} from "lucide-react";
import { format, startOfMonth, startOfWeek, subMonths, subWeeks, isSameMonth, isSameWeek, parseISO, eachDayOfInterval, eachMonthOfInterval, endOfMonth, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import eventHero from "@/assets/event-hero.jpg";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ActivityLog {
  id: string;
  admin_email: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  details: any;
  ip_address: string;
  created_at: string;
}

interface UserInteraction {
  id: string;
  session_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  ip_address: string;
  country: string;
  region: string;
  city: string;
  device_type: string;
  browser: string;
  os: string;
  isp: string;
  metadata: any;
  page_path: string;
  created_at: string;
}

export default function ActivityLogs({ canEdit = true }: { canEdit?: boolean }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [allLogsForKPI, setAllLogsForKPI] = useState<ActivityLog[]>([]);
  const [interactions, setInteractions] = useState<UserInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingKPI, setLoadingKPI] = useState(false);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [showSlowInteractions, setShowSlowInteractions] = useState(false);
  const [filter, setFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [auditTimeRange, setAuditTimeRange] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('all');
  const [interactionTimeRange, setInteractionTimeRange] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('all');
  const [page, setPage] = useState(1);
  const [interactionPage, setInteractionPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInteractionPages, setTotalInteractionPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalInteractionCount, setTotalInteractionCount] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (loadingInteractions) {
      const timer = setTimeout(() => {
        if (loadingInteractions) setShowSlowInteractions(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowSlowInteractions(false);
    }
  }, [loadingInteractions]);

  const fetchInteractions = async () => {
    if (!supabase) return;
    setLoadingInteractions(true);
    try {
      // Add a small delay on mobile to let session stabilize if just refreshed
      if (window.innerWidth < 768) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      let query = supabase
          .from('user_interactions')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(2000);

      if (filter) {
        query = query.or(`entity_name.ilike.%${filter}%,ip_address.ilike.%${filter}%,country.ilike.%${filter}%,region.ilike.%${filter}%,city.ilike.%${filter}%`);
      }

      if (interactionTimeRange !== 'all') {
        const now = new Date();
        let startDate: Date;
        if (interactionTimeRange === 'daily') {
          startDate = new Date(now.setHours(0, 0, 0, 0));
        } else if (interactionTimeRange === 'weekly') {
          startDate = startOfWeek(now);
        } else if (interactionTimeRange === 'monthly') {
          startDate = startOfMonth(now);
        } else {
          startDate = new Date(0); // Should not happen with 'all' handled
        }
        query = query.gte('created_at', startDate.toISOString());
      } else if (dateFilter) {
        const startOfDay = new Date(dateFilter);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateFilter);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString());
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setInteractions(data || []);
      if (count !== null) {
        setTotalInteractionCount(count);
      }
    } catch (error: any) {
      console.error('Error fetching interactions:', error);
      if (error.code !== '42P01') {
        toast.error("Failed to fetch visit analysis");
      }
    } finally {
      setLoadingInteractions(false);
    }
  };

  useEffect(() => {
    fetchInteractions();
  }, [filter, dateFilter, interactionTimeRange]);

  const handleDeleteLogs = async (range: '7d' | '30d' | 'all') => {
    const confirmMessage = range === 'all' 
      ? "Are you sure you want to delete ALL activity logs? This cannot be undone."
      : `Are you sure you want to delete logs older than ${range === '7d' ? '1 week' : '1 month'}?`;
      
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    try {
      let query = supabase.from('activity_logs').delete();
      
      if (range === '7d') {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        query = query.lt('created_at', date.toISOString());
      } else if (range === '30d') {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        query = query.lt('created_at', date.toISOString());
      } else {
        query = query.neq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { error } = await query;
      if (error) throw error;

      toast.success("Logs deleted successfully");
      setPage(1);
      fetchLogs();
      fetchKPILogs();
    } catch (error: any) {
      console.error('Error deleting logs:', error);
      toast.error(`Failed to delete logs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInteractions = async (range: '7d' | '30d' | 'all') => {
    const confirmMessage = range === 'all' 
      ? "Are you sure you want to delete ALL visit interactions? This cannot be undone."
      : `Are you sure you want to delete interactions older than ${range === '7d' ? '1 week' : '1 month'}?`;
      
    if (!window.confirm(confirmMessage)) return;

    setLoadingInteractions(true);
    try {
      let query = supabase.from('user_interactions').delete();
      
      if (range === '7d') {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        query = query.lt('created_at', date.toISOString());
      } else if (range === '30d') {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        query = query.lt('created_at', date.toISOString());
      } else {
        query = query.neq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { error } = await query;
      if (error) throw error;

      toast.success("Visit interactions deleted successfully");
      setInteractionPage(1);
      fetchInteractions();
    } catch (error: any) {
      console.error('Error deleting interactions:', error);
      toast.error(`Failed to delete interactions: ${error.message}`);
    } finally {
      setLoadingInteractions(false);
    }
  };

  const fetchLogs = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let query = supabase
        .from('activity_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(2000);

      if (filter) {
        query = query.or(`action_type.ilike.%${filter}%,entity_type.ilike.%${filter}%,admin_email.ilike.%${filter}%`);
      }
      
      if (auditTimeRange !== 'all') {
        const now = new Date();
        let startDate: Date;
        if (auditTimeRange === 'daily') {
          startDate = new Date(now.setHours(0, 0, 0, 0));
        } else if (auditTimeRange === 'weekly') {
          startDate = startOfWeek(now);
        } else if (auditTimeRange === 'monthly') {
          startDate = startOfMonth(now);
        } else {
          startDate = new Date(0);
        }
        query = query.gte('created_at', startDate.toISOString());
      } else if (dateFilter) {
        const startOfDay = new Date(dateFilter);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateFilter);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString());
      }

      const { data, error, count } = await query;

      if (error) {
        if (error.code === '42P01') {
           console.warn("activity_logs table does not exist yet");
           setLogs([]);
           setTotalCount(0);
           return;
        }
        throw error;
      }
      setLogs(data || []);
      if (count !== null) {
        setTotalCount(count);
      }
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      toast.error("Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filter, dateFilter, auditTimeRange]);

  const fetchKPILogs = async () => {
    if (!supabase) return;
    setLoadingKPI(true);
    try {
      // Fetch more logs for KPI (last 1000 logs or last 6 months)
      const sixMonthsAgo = subMonths(new Date(), 6).toISOString();
      
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .gte('created_at', sixMonthsAgo)
        .order('created_at', { ascending: false })
        .limit(2000); // Limit to 2000 logs to avoid heavy browser processing

      if (error) throw error;
      setAllLogsForKPI(data || []);
    } catch (error: any) {
      console.error('Error fetching KPI logs:', error);
    } finally {
      setLoadingKPI(false);
    }
  };

  useEffect(() => {
    fetchKPILogs();
  }, []);

  const deduplicatedLogs = useMemo(() => {
    const seen = new Set<string>();
    return allLogsForKPI.filter(log => {
      const dateStr = format(parseISO(log.created_at), 'yyyy-MM-dd');
      // A "task" is defined by user + action + entity type + entity id + date
      const key = `${log.admin_email}|${log.action_type}|${log.entity_type}|${log.entity_id || 'no-id'}|${dateStr}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allLogsForKPI]);

  const staffStats = useMemo(() => {
    const stats: Record<string, number> = {};
    deduplicatedLogs.forEach(log => {
      stats[log.admin_email] = (stats[log.admin_email] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [deduplicatedLogs]);

  const monthlyStats = useMemo(() => {
    const last6Months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    });

    return last6Months.map(month => {
      const monthStr = format(month, 'MMM yyyy');
      const count = deduplicatedLogs.filter(log => isSameMonth(parseISO(log.created_at), month)).length;
      return { name: monthStr, value: count };
    });
  }, [deduplicatedLogs]);

  const weeklyStats = useMemo(() => {
    const last8Weeks = Array.from({ length: 8 }).map((_, i) => subWeeks(new Date(), 7 - i));

    return last8Weeks.map(week => {
      const weekStr = `Week of ${format(startOfWeek(week), 'MMM d')}`;
      const count = deduplicatedLogs.filter(log => isSameWeek(parseISO(log.created_at), week)).length;
      return { name: weekStr, value: count };
    });
  }, [deduplicatedLogs]);

  const moduleStats = useMemo(() => {
    const stats: Record<string, number> = {};
    deduplicatedLogs.forEach(log => {
      const type = log.entity_type || 'Unknown';
      stats[type] = (stats[type] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [deduplicatedLogs]);

  const interactionStats = useMemo(() => {
    const stats: Record<string, number> = {};
    const trackedComponents = ['BookingWizard', 'FlightPackagesSection', 'AddonsSelection', 'Checkout'];
    
    interactions
      .filter(i => i.action_type === 'click')
      .filter(i => {
        const component = i.metadata?.component || '';
        const page = i.page_path || '';
        return trackedComponents.some(tc => 
          component.includes(tc) || 
          page.toLowerCase().includes(tc.toLowerCase())
        );
      })
      .forEach(i => {
        const name = i.entity_name || i.entity_id || 'Unknown';
        stats[name] = (stats[name] || 0) + 1;
      });
      
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [interactions]);

  const topCountries = useMemo(() => {
    const stats: Record<string, number> = {};
    interactions.forEach(i => {
      const name = i.country || 'Unknown';
      stats[name] = (stats[name] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 5);
  }, [interactions]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#64748b', '#8b5cf6', '#06b6d4'];

  const getActionColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'create':
      case 'confirm':
      case 'approve':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100';
      case 'delete':
      case 'cancel':
      case 'remove':
        return 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
      case 'update':
      case 'edit':
        return 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100';
      case 'login':
      case 'logout':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100';
    }
  };

  const formatFlightTime = (time: string | null | undefined) => {
    if (!time) return "N/A";
    if (time.toLowerCase().includes('am') || time.toLowerCase().includes('pm')) {
      return time.toUpperCase();
    }
    try {
      if (!time.includes(':')) return time.toUpperCase();
      const parts = time.split(':');
      const h = parseInt(parts[0], 10);
      const m = parts[1] || '00';
      if (isNaN(h)) return time.toUpperCase();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${m.padStart(2, '0')} ${ampm}`;
    } catch (error) {
      return time.toUpperCase();
    }
  };

  const formatDetails = (details: any) => {
    if (!details) return "-";
    // If details is just a string, return it
    if (typeof details === 'string') return details;
    
    // Filter out common fields we display elsewhere to keep details clean
    const { ...rest } = details;
    
    // Check if object is empty
    if (Object.keys(rest).length === 0) return "-";

    // Format as readable key-value pairs
    return Object.entries(rest).map(([key, value]) => {
      // Format key from snake_case to Title Case
      const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Format time if it's a time field
      let displayValue = String(value);
      if ((key === 'flight_time' || key === 'flight_slot' || key === 'event_time' || key === 'selected_time_slot') && value) {
        displayValue = formatFlightTime(String(value));
      }

      return (
        <div key={key} className="text-xs">
          <span className="font-semibold text-slate-900">{formattedKey}:</span> {displayValue}
        </div>
      );
    });
  };

  return (
    <div className="space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full max-w-[100vw] overflow-x-hidden px-0 sm:px-0 relative">
      <Tabs defaultValue="logs" className="w-full max-w-full overflow-hidden">
        <TabsList className="flex flex-col w-full mb-4 sm:mb-8 p-1 sm:p-2 h-auto bg-slate-100/80 backdrop-blur-md rounded-xl sm:rounded-3xl border border-slate-200 shadow-lg sm:shadow-xl shadow-slate-200/50 gap-1.5 sm:grid sm:grid-cols-3 sm:gap-0 overflow-hidden">
          <TabsTrigger value="logs" className="data-[state=active]:bg-[#121A32] data-[state=active]:text-white data-[state=active]:shadow-lg sm:data-[state=active]:scale-105 rounded-lg sm:rounded-2xl flex items-center justify-center gap-3 font-bold text-xs sm:text-sm uppercase tracking-widest transition-all duration-300 h-10 sm:h-11 w-full text-slate-500 hover:text-slate-900 border border-transparent data-[state=active]:border-slate-700 sm:border-none">
            <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-bold">Audit Trail</span>
          </TabsTrigger>
          <TabsTrigger value="visit_analysis" className="data-[state=active]:bg-[#121A32] data-[state=active]:text-white data-[state=active]:shadow-lg sm:data-[state=active]:scale-105 rounded-lg sm:rounded-2xl flex items-center justify-center gap-3 font-bold text-xs sm:text-sm uppercase tracking-widest transition-all duration-300 h-10 sm:h-11 w-full text-slate-500 hover:text-slate-900 border border-transparent data-[state=active]:border-slate-700 sm:border-none">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-bold">Visit Analysis</span>
          </TabsTrigger>
          <TabsTrigger value="kpi" className="data-[state=active]:bg-[#121A32] data-[state=active]:text-white data-[state=active]:shadow-lg sm:data-[state=active]:scale-105 rounded-lg sm:rounded-2xl flex items-center justify-center gap-3 font-bold text-xs sm:text-sm uppercase tracking-widest transition-all duration-300 h-10 sm:h-11 w-full text-slate-500 hover:text-slate-900 border border-transparent data-[state=active]:border-slate-700 sm:border-none">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-bold">KPI Metrics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-0 space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full max-w-full overflow-hidden">
          <Card className="rounded-xl sm:rounded-[2.5rem] border-black/5 shadow-xl shadow-slate-200/50 overflow-hidden bg-white/70 backdrop-blur-md w-full max-w-full">
            <CardHeader className="border-b border-black/5 bg-white/50 p-3 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-8">
                <div className="space-y-1">
                  <CardTitle className="text-sm sm:text-lg font-bold flex items-center gap-2 sm:gap-3 text-slate-900 uppercase tracking-tight font-sans">
                    <div className="p-1 sm:p-2.5 bg-[#121A32] rounded-lg sm:rounded-xl shadow-lg shadow-[#121A32]/20 shrink-0">
                      <ClipboardList className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <span className="truncate">Audit Trail Logs</span>
                  </CardTitle>
                  <CardDescription className="text-[8px] sm:text-xs font-bold uppercase tracking-tight text-slate-500 mt-1 ml-7 sm:ml-12 font-sans line-clamp-1">
                    Administrative audit trail of system changes.
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-10 sm:h-11 px-3 sm:px-6 rounded-lg sm:rounded-xl border-black/10 text-slate-600 font-bold text-[10px] sm:text-xs uppercase tracking-tight gap-2 transition-all active:scale-95 w-full sm:w-auto">
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Clear Logs
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl sm:rounded-2xl border-black/10 shadow-2xl p-2 min-w-[180px] sm:min-w-[200px]">
                      <DropdownMenuLabel className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight text-slate-900 px-3 py-2">Select Range</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-black/5 mx-2" />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteLogs('7d')} 
                        disabled={!canEdit}
                        className="text-slate-600 cursor-pointer rounded-lg sm:rounded-xl p-3 sm:p-4 text-[10px] sm:text-xs font-bold uppercase tracking-tight hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        Older than 1 Week
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteLogs('30d')} 
                        disabled={!canEdit}
                        className="text-slate-600 cursor-pointer rounded-lg sm:rounded-xl p-3 sm:p-4 text-[10px] sm:text-xs font-bold uppercase tracking-tight hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        Older than 1 Month
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-black/5 mx-2" />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteLogs('all')} 
                        disabled={!canEdit}
                        className="text-slate-600 font-bold cursor-pointer rounded-lg sm:rounded-xl p-3 sm:p-4 text-[10px] sm:text-xs uppercase tracking-tight bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        Delete All Logs
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button 
                    variant="outline" 
                    onClick={() => {
                      fetchLogs();
                      fetchKPILogs();
                    }} 
                    disabled={loading || loadingKPI}
                    className="h-10 sm:h-11 px-3 sm:px-6 rounded-lg sm:rounded-xl border-black/10 hover:bg-slate-50 transition-all active:scale-95 font-bold text-[10px] sm:text-xs uppercase tracking-tight gap-2 w-full"
                  >
                    {loading || loadingKPI ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900" />}
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-2 sm:p-8 bg-slate-50/50 border-b border-black/5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8 mb-4 sm:mb-8">
                  {/* Top Admins Chart */}
                  <Card className="rounded-xl border-black/5 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="p-3 sm:p-4 pb-0">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Admins</CardTitle>
                    </CardHeader>
                    <CardContent className="p-1 sm:p-2 pt-2">
                      <div className="h-[160px] sm:h-[200px] w-full overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={(() => {
                              const stats: Record<string, number> = {};
                              logs.forEach(l => {
                                const name = l.admin_email.split('@')[0];
                                stats[name] = (stats[name] || 0) + 1;
                              });
                              return Object.entries(stats).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
                            })()}
                            layout="vertical"
                            margin={{ left: -10, right: 25, top: 0, bottom: 0 }}
                          >
                            <XAxis type="number" hide />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={50} 
                              tick={{ fontSize: 7, fontWeight: 700, fill: '#64748b' }} 
                              axisLine={false}
                              tickLine={false}
                            />
                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                            <Bar 
                              dataKey="value" 
                              fill="#6366f1" 
                              radius={[0, 4, 4, 0]} 
                              barSize={10}
                              label={{ position: 'right', fontSize: 8, fontWeight: 800, fill: '#6366f1' }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Modules Chart */}
                  <Card className="rounded-xl border-black/5 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="p-3 sm:p-4 pb-0">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Modules</CardTitle>
                    </CardHeader>
                    <CardContent className="p-1 sm:p-2 pt-2">
                      <div className="h-[160px] sm:h-[200px] w-full overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={(() => {
                              const stats: Record<string, number> = {};
                              logs.forEach(l => stats[l.entity_type] = (stats[l.entity_type] || 0) + 1);
                              return Object.entries(stats).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })).sort((a,b) => b.value - a.value).slice(0, 5);
                            })()} 
                            layout="vertical"
                            margin={{ left: -10, right: 25, top: 0, bottom: 0 }}
                          >
                            <XAxis type="number" hide />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={50} 
                              tick={{ fontSize: 7, fontWeight: 700, fill: '#64748b' }} 
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(val) => val.length > 8 ? val.substring(0, 8) + '...' : val} 
                            />
                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                            <Bar 
                              dataKey="value" 
                              fill="#6366f1" 
                              radius={[0, 4, 4, 0]} 
                              barSize={10}
                              label={{ position: 'right', fontSize: 8, fontWeight: 800, fill: '#6366f1' }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Action Breakdown Chart */}
                  <Card className="rounded-xl border-black/5 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="p-3 sm:p-4 pb-0">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Action Types</CardTitle>
                    </CardHeader>
                    <CardContent className="p-1 sm:p-2 pt-2">
                      <div className="h-[160px] sm:h-[200px] w-full overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={(() => {
                              const stats: Record<string, number> = {};
                              logs.forEach(l => stats[l.action_type] = (stats[l.action_type] || 0) + 1);
                              return Object.entries(stats).map(([name, value]) => ({ name, value }));
                            })()}
                            layout="vertical"
                            margin={{ left: -10, right: 25, top: 0, bottom: 0 }}
                          >
                            <XAxis type="number" hide />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={50} 
                              tick={{ fontSize: 7, fontWeight: 700, fill: '#64748b' }} 
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(val) => val.toUpperCase()}
                            />
                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                            <Bar 
                              dataKey="value" 
                              fill="#f59e0b" 
                              radius={[0, 4, 4, 0]} 
                              barSize={10}
                              label={{ position: 'right', fontSize: 8, fontWeight: 800, fill: '#f59e0b' }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col gap-2 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center bg-white/50 border border-black/10 rounded-lg sm:rounded-xl p-1 gap-1 w-full sm:w-fit">
                    <Button
                      variant={auditTimeRange === 'daily' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setAuditTimeRange('daily')}
                      className={cn(
                        "h-8 sm:h-9 flex-1 sm:flex-none px-2 sm:px-4 text-[9px] sm:text-xs font-bold uppercase tracking-tight rounded-md sm:rounded-lg transition-all",
                        auditTimeRange === 'daily' ? "bg-indigo-500 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Daily
                    </Button>
                    <Button
                      variant={auditTimeRange === 'weekly' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setAuditTimeRange('weekly')}
                      className={cn(
                        "h-8 sm:h-9 flex-1 sm:flex-none px-2 sm:px-4 text-[9px] sm:text-xs font-bold uppercase tracking-tight rounded-md sm:rounded-lg transition-all",
                        auditTimeRange === 'weekly' ? "bg-indigo-500 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Weekly
                    </Button>
                    <Button
                      variant={auditTimeRange === 'monthly' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setAuditTimeRange('monthly')}
                      className={cn(
                        "h-8 sm:h-9 flex-1 sm:flex-none px-2 sm:px-4 text-[9px] sm:text-xs font-bold uppercase tracking-tight rounded-md sm:rounded-lg transition-all",
                        auditTimeRange === 'monthly' ? "bg-indigo-500 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Monthly
                    </Button>
                    <Button
                      variant={auditTimeRange === 'all' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setAuditTimeRange('all')}
                      className={cn(
                        "h-8 sm:h-9 flex-1 sm:flex-none px-2 sm:px-4 text-[9px] sm:text-xs font-bold uppercase tracking-tight rounded-md sm:rounded-lg transition-all",
                        auditTimeRange === 'all' ? "bg-indigo-500 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      All
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-900 z-10" />
                      <Input
                        placeholder="Search admin, action or module..."
                        className="pl-10 sm:pl-14 h-10 sm:h-11 text-[10px] sm:text-xs font-bold tracking-tight border-black/10 rounded-lg sm:rounded-xl bg-white/50 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm w-full"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      />
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("h-10 sm:h-11 justify-start text-left font-bold text-[10px] sm:text-xs tracking-tight border-black/10 rounded-lg sm:rounded-xl px-3 sm:px-8 bg-white/50 w-full sm:w-auto hover:bg-white transition-all shadow-sm", dateFilter ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "text-slate-900")}>
                          <Clock className="mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-indigo-500 shrink-0" />
                          {dateFilter ? format(dateFilter, "d MMM yyyy").toUpperCase() : <span>Filter Date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl sm:rounded-3xl border-black/5 shadow-2xl overflow-hidden" align="end">
                        <CalendarComponent
                          mode="single"
                          selected={dateFilter}
                          onSelect={setDateFilter}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {(filter || dateFilter || auditTimeRange !== 'all') && (
                      <Button 
                        variant="ghost" 
                        onClick={() => { setFilter(""); setDateFilter(undefined); setAuditTimeRange('all'); }}
                        className="h-10 sm:h-11 px-4 sm:px-8 text-slate-500 hover:text-slate-500 hover:bg-red-50 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs tracking-tight transition-all w-full sm:w-auto"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-indigo-100 scrollbar-track-transparent hidden sm:block max-h-[600px] w-full">
                <Table className="min-w-[800px] sm:min-w-[1000px]">
                  <TableHeader className="bg-slate-50/50 sticky top-0 z-20">
                    <TableRow className="border-black/5 hover:bg-transparent">
                      <TableHead className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900 h-9 sm:h-12 px-2 sm:px-4">Admin</TableHead>
                      <TableHead className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900 h-9 sm:h-12 px-2 sm:px-4">Action</TableHead>
                      <TableHead className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900 h-9 sm:h-12 px-2 sm:px-4">Module</TableHead>
                      <TableHead className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900 h-9 sm:h-12 px-2 sm:px-4">Details</TableHead>
                      <TableHead className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900 h-9 sm:h-12 px-2 sm:px-4">IP Address</TableHead>
                      <TableHead className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900 h-9 sm:h-12 px-2 sm:px-4">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 sm:h-40 text-center">
                          {loading ? (
                            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3">
                              <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-slate-600" />
                              <p className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900">Fetching logs...</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 opacity-40">
                              <ClipboardList className="h-10 w-10 sm:h-12 sm:w-12 text-slate-900" />
                              <p className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900">No activity logs found</p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id} className="border-black/5 hover:bg-slate-50/50 transition-colors">
                          <TableCell className="py-2 sm:py-4 px-2 sm:px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-slate-100 flex items-center justify-center text-[9px] sm:text-xs font-bold text-slate-600 border border-black/5 shrink-0">
                                {log.admin_email[0].toUpperCase()}
                              </div>
                              <span className="font-bold text-slate-900 text-[9px] sm:text-xs tracking-tight truncate max-w-[60px] sm:max-w-none">{log.admin_email.split('@')[0]}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 sm:py-4 px-2 sm:px-4">
                            <Badge className={cn(
                              "rounded-md px-1 sm:px-2 py-0.5 text-[7px] sm:text-[10px] font-bold tracking-tight border shadow-sm whitespace-nowrap",
                              getActionColor(log.action_type)
                            )}>
                              {log.action_type.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 sm:py-4 px-2 sm:px-4">
                            <span className="text-[8px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tighter opacity-70 whitespace-nowrap">
                              {log.entity_type.replace(/_/g, ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="py-2 sm:py-4 px-2 sm:px-4 min-w-[150px] sm:min-w-[400px]">
                            <div className="flex flex-col gap-1">
                              {formatDetails(log.details)}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 sm:py-4 px-2 sm:px-4">
                            <span className="text-[8px] sm:text-xs font-bold text-slate-600 font-mono tracking-tight whitespace-nowrap">{log.ip_address}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-bold text-slate-900 py-2 sm:py-4 px-2 sm:px-4 text-[8px] sm:text-xs tracking-tight">
                            {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View for Logs */}
              <div className="block sm:hidden divide-y divide-black/5 max-h-[500px] overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="p-8 text-center">
                    {loading ? (
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
                    ) : (
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No logs found</p>
                    )}
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-black/5">
                            {log.admin_email[0].toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-900 text-[10px] tracking-tight">{log.admin_email.split('@')[0]}</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-500">
                          {format(new Date(log.created_at), "MMM d, HH:mm")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn(
                          "rounded-md px-1.5 py-0.5 text-[8px] font-bold tracking-tight border shadow-sm",
                          getActionColor(log.action_type)
                        )}>
                          {log.action_type.toUpperCase()}
                        </Badge>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter opacity-70">
                          {log.entity_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-black/5 space-y-1">
                        {formatDetails(log.details)}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400 font-mono">
                        IP: {log.ip_address}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:p-6 border-t border-black/5 bg-slate-50/30">
                <div className="text-[9px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 text-center sm:text-left">
                   Total <span className="mx-1.5 sm:mx-2 opacity-30">|</span> {totalCount} logs
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visit_analysis" className="mt-0 space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full max-w-full overflow-hidden">
          <Card className="rounded-xl sm:rounded-[2.5rem] border-black/5 shadow-xl shadow-slate-200/50 overflow-hidden bg-white/70 backdrop-blur-md w-full max-w-full">
            <CardHeader className="border-b border-black/5 bg-white/50 p-3 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-8">
                <div className="space-y-1">
                  <CardTitle className="text-sm sm:text-lg font-bold flex items-center gap-2 sm:gap-3 text-slate-900 uppercase tracking-tight font-sans">
                    <div className="p-1 sm:p-2.5 bg-[#121A32] rounded-lg sm:rounded-xl shadow-lg shadow-[#121A32]/20 shrink-0">
                      <TrendingUp className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <span className="truncate">Visit Analysis</span>
                  </CardTitle>
                  <CardDescription className="text-[8px] sm:text-xs font-bold uppercase tracking-tight text-slate-500 mt-1 ml-7 sm:ml-12 font-sans line-clamp-1">
                    Detailed analysis of customer interactions and locations.
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-10 sm:h-11 px-3 sm:px-6 rounded-lg sm:rounded-xl border-black/10 text-slate-600 font-bold text-[10px] sm:text-xs uppercase tracking-tight gap-2 transition-all active:scale-95 w-full sm:w-auto">
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Clear Analysis
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl sm:rounded-2xl border-black/10 shadow-2xl p-2 min-w-[180px] sm:min-w-[200px]">
                      <DropdownMenuLabel className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight text-slate-900 px-3 py-2">Select Range</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-black/5 mx-2" />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteInteractions('7d')} 
                        disabled={!canEdit}
                        className="text-slate-600 cursor-pointer rounded-lg sm:rounded-xl p-3 sm:p-4 text-[10px] sm:text-xs font-bold uppercase tracking-tight hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        Older than 1 Week
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteInteractions('30d')} 
                        disabled={!canEdit}
                        className="text-slate-600 cursor-pointer rounded-lg sm:rounded-xl p-3 sm:p-4 text-[10px] sm:text-xs font-bold uppercase tracking-tight hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        Older than 1 Month
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-black/5 mx-2" />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteInteractions('all')} 
                        disabled={!canEdit}
                        className="text-slate-600 font-bold cursor-pointer rounded-lg sm:rounded-xl p-3 sm:p-4 text-[10px] sm:text-xs uppercase tracking-tight bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        Delete All Data
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button 
                    variant="outline" 
                    onClick={() => fetchInteractions()} 
                    disabled={loadingInteractions}
                    className="h-10 sm:h-11 px-3 sm:px-6 rounded-lg sm:rounded-xl border-black/10 hover:bg-slate-50 transition-all active:scale-95 font-bold text-[10px] sm:text-xs uppercase tracking-tight gap-2 w-full"
                  >
                    {loadingInteractions ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900" />}
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-2 sm:p-8 bg-slate-50/50 border-b border-black/5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8 mb-4 sm:mb-8">
                  {/* Top Locations Chart */}
                  <Card className="rounded-xl border-black/5 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="p-3 sm:p-4 pb-0">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Locations</CardTitle>
                    </CardHeader>
                    <CardContent className="p-1 sm:p-2 pt-2">
                      <div className="h-[160px] w-full overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={topCountries} 
                            layout="vertical"
                            margin={{ left: -10, right: 25, top: 0, bottom: 0 }}
                          >
                            <XAxis type="number" hide />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={50} 
                              tick={{ fontSize: 7, fontWeight: 700, fill: '#64748b' }} 
                              axisLine={false}
                              tickLine={false}
                            />
                            <RechartsTooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                            />
                            <Bar 
                              dataKey="value" 
                              fill="#6366f1" 
                              radius={[0, 4, 4, 0]} 
                              barSize={10}
                              label={{ position: 'right', fontSize: 8, fontWeight: 800, fill: '#6366f1' }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Interactions Chart */}
                  <Card className="rounded-xl border-black/5 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="p-3 sm:p-4 pb-0">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Interactions</CardTitle>
                    </CardHeader>
                    <CardContent className="p-1 sm:p-2 pt-2">
                      <div className="h-[160px] w-full overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={(() => {
                            const stats: Record<string, number> = {};
                            interactions.forEach(i => stats[i.entity_name] = (stats[i.entity_name] || 0) + 1);
                            return Object.entries(stats).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
                          })()} 
                          layout="vertical"
                          margin={{ left: -10, right: 25, top: 0, bottom: 0 }}
                          >
                            <XAxis type="number" hide />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={50} 
                              tick={{ fontSize: 7, fontWeight: 700, fill: '#64748b' }} 
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(val) => val.length > 8 ? val.substring(0, 8) + '...' : val} 
                            />
                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                            <Bar 
                              dataKey="value" 
                              fill="#6366f1" 
                              radius={[0, 4, 4, 0]} 
                              barSize={10}
                              label={{ position: 'right', fontSize: 8, fontWeight: 800, fill: '#6366f1' }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Device Breakdown Chart */}
                  <Card className="rounded-xl border-black/5 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="p-3 sm:p-4 pb-0">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Device Usage</CardTitle>
                    </CardHeader>
                    <CardContent className="p-1 sm:p-2 pt-2">
                      <div className="h-[160px] w-full overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={(() => {
                                const stats: Record<string, number> = {};
                                interactions.forEach(i => stats[i.device_type] = (stats[i.device_type] || 0) + 1);
                                return Object.entries(stats).map(([name, value]) => ({ name, value }));
                              })()}
                              cx="50%"
                              cy="50%"
                              outerRadius={window.innerWidth < 640 ? 40 : 60}
                              dataKey="value"
                            >
                              <Cell fill="#f59e0b" />
                              <Cell fill="#10b981" />
                              <Cell fill="#6366f1" />
                            </Pie>
                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                            <Legend wrapperStyle={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', paddingBottom: '5px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col gap-2 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center bg-white/50 border border-black/10 rounded-lg sm:rounded-xl p-1 gap-1 w-full sm:w-fit">
                    <Button
                      variant={interactionTimeRange === 'daily' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setInteractionTimeRange('daily')}
                      className={cn(
                        "h-8 sm:h-9 flex-1 sm:flex-none px-2 sm:px-4 text-[9px] sm:text-xs font-bold uppercase tracking-tight rounded-md sm:rounded-lg transition-all",
                        interactionTimeRange === 'daily' ? "bg-indigo-500 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Daily
                    </Button>
                    <Button
                      variant={interactionTimeRange === 'weekly' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setInteractionTimeRange('weekly')}
                      className={cn(
                        "h-8 sm:h-9 flex-1 sm:flex-none px-2 sm:px-4 text-[9px] sm:text-xs font-bold uppercase tracking-tight rounded-md sm:rounded-lg transition-all",
                        interactionTimeRange === 'weekly' ? "bg-indigo-500 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Weekly
                    </Button>
                    <Button
                      variant={interactionTimeRange === 'monthly' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setInteractionTimeRange('monthly')}
                      className={cn(
                        "h-8 sm:h-9 flex-1 sm:flex-none px-2 sm:px-4 text-[9px] sm:text-xs font-bold uppercase tracking-tight rounded-md sm:rounded-lg transition-all",
                        interactionTimeRange === 'monthly' ? "bg-indigo-500 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Monthly
                    </Button>
                    <Button
                      variant={interactionTimeRange === 'all' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setInteractionTimeRange('all')}
                      className={cn(
                        "h-8 sm:h-9 flex-1 sm:flex-none px-2 sm:px-4 text-[9px] sm:text-xs font-bold uppercase tracking-tight rounded-md sm:rounded-lg transition-all",
                        interactionTimeRange === 'all' ? "bg-indigo-500 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      All
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-900 z-10" />
                      <Input
                        placeholder="Search IP, Country, State or Entity..."
                        className="pl-10 sm:pl-14 h-10 sm:h-11 text-[10px] sm:text-xs font-bold tracking-tight border-black/10 rounded-lg sm:rounded-xl bg-white/50 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm w-full"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      />
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("h-10 sm:h-11 justify-start text-left font-bold text-[10px] sm:text-xs tracking-tight border-black/10 rounded-lg sm:rounded-xl px-3 sm:px-8 bg-white/50 w-full sm:w-auto hover:bg-white transition-all shadow-sm", dateFilter ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "text-slate-900")}>
                          <Clock className="mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-indigo-500 shrink-0" />
                          {dateFilter ? format(dateFilter, "d MMM yyyy").toUpperCase() : <span>Filter Date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl sm:rounded-3xl border-black/5 shadow-2xl overflow-hidden" align="end">
                        <CalendarComponent
                          mode="single"
                          selected={dateFilter}
                          onSelect={setDateFilter}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {(filter || dateFilter || interactionTimeRange !== 'all') && (
                      <Button 
                        variant="ghost" 
                        onClick={() => { setFilter(""); setDateFilter(undefined); setInteractionTimeRange('all'); }}
                        className="h-10 sm:h-11 px-4 sm:px-8 text-slate-500 hover:text-slate-500 hover:bg-red-50 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs tracking-tight transition-all w-full sm:w-auto"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-indigo-100 scrollbar-track-transparent hidden sm:block max-h-[600px] w-full">
                <Table className="min-w-[1000px] sm:min-w-[1200px]">
                  <TableHeader className="bg-slate-50/50 sticky top-0 z-20">
                    <TableRow className="border-black/5 hover:bg-transparent">
                      <TableHead className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900 h-9 sm:h-12 px-2 sm:px-4">Time</TableHead>
                      <TableHead className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900 h-9 sm:h-12 px-2 sm:px-4">Interaction</TableHead>
                      <TableHead className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900 h-9 sm:h-12 px-2 sm:px-4">Target Entity</TableHead>
                      <TableHead className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900 h-9 sm:h-12 px-2 sm:px-4">Location</TableHead>
                      <TableHead className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900 h-9 sm:h-12 px-2 sm:px-4">IP & ISP</TableHead>
                      <TableHead className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900 h-9 sm:h-12 px-2 sm:px-4">Device & Browser</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 sm:h-40 text-center">
                          {loadingInteractions ? (
                            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3">
                              <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-slate-600" />
                              <p className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900">Fetching analysis...</p>
                              {showSlowInteractions && (
                                <div className="mt-4 animate-in fade-in duration-500 flex flex-col items-center">
                                  <p className="text-[8px] sm:text-[10px] text-slate-400 mb-2 uppercase tracking-tight">Network is slow...</p>
                                  <Button variant="outline" size="sm" onClick={() => fetchInteractions()} className="h-7 text-[8px] sm:text-[9px] uppercase tracking-widest gap-2">
                                    <RefreshCw className="h-3 w-3" />
                                    Retry
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 opacity-40">
                              <TrendingUp className="h-10 w-10 sm:h-12 sm:w-12 text-slate-900" />
                              <p className="text-[9px] sm:text-xs font-bold tracking-tight text-slate-900">No interaction data available</p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      interactions.map((interaction) => (
                        <TableRow key={interaction.id} className="border-black/5 hover:bg-slate-50/50 transition-colors">
                          <TableCell className="whitespace-nowrap font-bold text-slate-900 py-2 sm:py-4 px-2 sm:px-4 text-[8px] sm:text-xs tracking-tight">
                            {format(new Date(interaction.created_at), "MMM d, HH:mm:ss")}
                          </TableCell>
                          <TableCell className="py-2 sm:py-4 px-2 sm:px-4">
                            <Badge className={cn(
                              "rounded-md px-1 sm:px-2 py-0.5 text-[7px] sm:text-[10px] font-bold tracking-tight border shadow-sm whitespace-nowrap",
                              interaction.action_type === 'click' ? "bg-blue-50 text-blue-700 border-blue-100" : 
                              interaction.action_type === 'view' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                              "bg-slate-50 text-slate-700 border-slate-100"
                            )}>
                              {interaction.action_type.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 sm:py-4 px-2 sm:px-4">
                            <div className="flex flex-col min-w-[120px]">
                              <span className="font-bold text-slate-900 text-[9px] sm:text-xs tracking-tight truncate">{interaction.entity_name}</span>
                              <span className="text-[7px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-tighter opacity-70 whitespace-nowrap">
                                {interaction.entity_type.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 sm:py-4 px-2 sm:px-4">
                            <div className="flex flex-col min-w-[100px]">
                              <span className="font-bold text-slate-900 text-[9px] sm:text-xs tracking-tight whitespace-nowrap">{interaction.country}</span>
                              <span className="text-[7px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-tighter opacity-70 whitespace-nowrap truncate max-w-[100px]">
                                {interaction.region}, {interaction.city}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 sm:py-4 px-2 sm:px-4">
                            <div className="flex flex-col min-w-[120px]">
                              <span className="font-bold text-slate-900 text-[9px] sm:text-xs tracking-tight font-mono whitespace-nowrap">{interaction.ip_address}</span>
                              <span className="text-[7px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-tighter opacity-70 truncate max-w-[120px]">
                                {interaction.isp}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 sm:py-4 px-2 sm:px-4">
                            <div className="flex flex-col min-w-[120px]">
                              <span className="font-bold text-slate-900 text-[9px] sm:text-xs tracking-tight whitespace-nowrap">{interaction.browser} on {interaction.os}</span>
                              <Badge variant="outline" className="w-fit text-[7px] sm:text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0 rounded-full mt-1 whitespace-nowrap">
                                {interaction.device_type}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View for Visit Analysis */}
              <div className="block sm:hidden divide-y divide-black/5 max-h-[500px] overflow-y-auto">
                {interactions.length === 0 ? (
                  <div className="p-8 text-center">
                    {loadingInteractions ? (
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
                    ) : (
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No analysis data available</p>
                    )}
                  </div>
                ) : (
                  interactions.map((interaction) => (
                    <div key={interaction.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-900">
                          {format(new Date(interaction.created_at), "MMM d, HH:mm:ss")}
                        </span>
                        <Badge className={cn(
                          "rounded-md px-1.5 py-0.5 text-[8px] font-bold tracking-tight border shadow-sm",
                          interaction.action_type === 'click' ? "bg-blue-50 text-blue-700 border-blue-100" : 
                          interaction.action_type === 'view' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                          "bg-slate-50 text-slate-700 border-slate-100"
                        )}>
                          {interaction.action_type.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-900">{interaction.entity_name}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter opacity-70">
                          {interaction.entity_type.replace(/_/g, ' ')}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Location</p>
                          <p className="text-[9px] font-bold text-slate-700">{interaction.country}</p>
                          <p className="text-[8px] font-bold text-slate-500">{interaction.region}, {interaction.city}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Device</p>
                          <p className="text-[9px] font-bold text-slate-700">{interaction.browser}</p>
                          <p className="text-[8px] font-bold text-slate-500">{interaction.os} ({interaction.device_type})</p>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2 rounded border border-black/5">
                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Network</p>
                        <p className="text-[9px] font-bold text-slate-600 font-mono">{interaction.ip_address}</p>
                        <p className="text-[8px] font-bold text-slate-500">{interaction.isp}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:p-6 border-t border-black/5 bg-slate-50/30">
                <div className="text-[9px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 text-center sm:text-left">
                   Total <span className="mx-1.5 sm:mx-2 opacity-30">|</span> {totalInteractionCount} interactions
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpi" className="mt-0 space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 w-full">
            <Card className="rounded-xl border-black/5 shadow-md sm:shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardContent className="p-4 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-900 uppercase tracking-tight opacity-70">Total Actions</p>
                    <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 sm:mt-2">{allLogsForKPI.length}</h3>
                  </div>
                  <div className="p-3 sm:p-4 bg-slate-700 rounded-xl sm:rounded-2xl shadow-lg shadow-slate-200/50 shrink-0">
                    <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                </div>
                <div className="mt-4 sm:mt-6 flex items-center text-[9px] sm:text-xs font-bold text-slate-600 uppercase tracking-tight bg-slate-50 w-fit px-3 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3 mr-2" />
                  Last 6 months
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-black/5 shadow-md sm:shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardContent className="p-4 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-900 uppercase tracking-tight opacity-70">Active Staff</p>
                    <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 sm:mt-2">{staffStats.length}</h3>
                  </div>
                  <div className="p-3 sm:p-4 bg-emerald-600 rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-200 shrink-0">
                    <UsersIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                </div>
                <div className="mt-4 sm:mt-6 flex items-center text-[9px] sm:text-xs font-bold text-emerald-600 uppercase tracking-tight bg-emerald-50 w-fit px-3 py-1 rounded-full">
                  <UserCheck className="w-3 h-3 mr-2" />
                  Admin users
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-black/5 shadow-md sm:shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardContent className="p-4 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-900 uppercase tracking-tight opacity-70">Top Performer</p>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1 sm:mt-2 truncate max-w-[120px] sm:max-w-[150px]">
                      {staffStats[0]?.name.split('@')[0] || 'N/A'}
                    </h3>
                  </div>
                  <div className="p-3 sm:p-4 bg-amber-500 rounded-xl sm:rounded-2xl shadow-lg shadow-amber-200 shrink-0">
                    <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                </div>
                <div className="mt-4 sm:mt-6 flex items-center text-[9px] sm:text-xs font-bold text-amber-600 uppercase tracking-tight bg-amber-50 w-fit px-3 py-1 rounded-full">
                  {staffStats[0]?.value || 0} actions
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-black/5 shadow-md sm:shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardContent className="p-4 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-900 uppercase tracking-tight opacity-70">Avg/Month</p>
                    <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 sm:mt-2">
                      {Math.round(allLogsForKPI.length / Math.max(1, monthlyStats.length))}
                    </h3>
                  </div>
                  <div className="p-3 sm:p-4 bg-slate-700 rounded-xl sm:rounded-2xl shadow-lg shadow-slate-200/50 shrink-0">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                </div>
                <div className="mt-4 sm:mt-6 flex items-center text-[9px] sm:text-xs font-bold text-slate-600 uppercase tracking-tight bg-slate-50 w-fit px-3 py-1 rounded-full">
                  <div className="w-3 h-3 rounded-full overflow-hidden border border-slate-200 mr-2 shrink-0">
                    <img src={eventHero} className="w-full h-full object-cover" alt="" />
                  </div>
                  Frequency
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
            <Card className="rounded-xl sm:rounded-[2.5rem] border-black/5 shadow-md sm:shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-black/5 bg-slate-50/30 p-4 sm:p-8">
                <CardTitle className="text-sm sm:text-xl font-bold flex items-center gap-2 sm:gap-3 text-slate-900 uppercase tracking-tight font-sans">
                  <div className="p-1.5 sm:p-2.5 bg-[#121A32] rounded-lg sm:rounded-xl shadow-lg shadow-[#121A32]/10">
                    <UserCheck className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                  </div>
                  Staff Contribution
                </CardTitle>
                <CardDescription className="text-[9px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 mt-1 ml-9 sm:ml-12 opacity-70 font-sans">Total actions performed by each staff member.</CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-8">
                <div className="h-[250px] sm:h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={staffStats} layout="vertical" margin={{ left: -20, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#eee" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={80} 
                        tick={{ fontSize: 8, fontWeight: 800, fill: '#0f172a' }}
                        tickFormatter={(value: string) => value.split('@')[0].toUpperCase()}
                      />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '8px' }}
                        labelStyle={{ fontWeight: '900', color: '#1e293b', marginBottom: '2px', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.05em' }}
                      />
                      <Bar dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={window.innerWidth < 640 ? 16 : 24}>
                        {staffStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl sm:rounded-[2.5rem] border-black/5 shadow-md sm:shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-black/5 bg-slate-50/30 p-4 sm:p-8">
                <CardTitle className="text-sm sm:text-xl font-bold flex items-center gap-2 sm:gap-3 text-slate-900 uppercase tracking-tight font-sans">
                  <div className="p-1.5 sm:p-2.5 bg-[#121A32] rounded-lg sm:rounded-xl shadow-lg shadow-[#121A32]/10">
                    <TrendingUp className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                  </div>
                  Monthly Trend
                </CardTitle>
                <CardDescription className="text-[9px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 mt-1 ml-9 sm:ml-12 opacity-70 font-sans">System activity over the last 6 months.</CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-8 overflow-x-auto scrollbar-thin scrollbar-thumb-indigo-100 scrollbar-track-transparent">
                <div className="h-[250px] sm:h-[350px] min-w-[300px] sm:min-w-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyStats} margin={{ left: -25, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 800, fill: '#0f172a' }} />
                      <YAxis tick={{ fontSize: 8, fontWeight: 800, fill: '#0f172a' }} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '8px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#4f46e5" 
                        strokeWidth={2} 
                        dot={{ r: 3, strokeWidth: 1.5, fill: 'white', stroke: '#4f46e5' }}
                        activeDot={{ r: 5, strokeWidth: 0, fill: '#4f46e5' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl sm:rounded-[2.5rem] border-black/5 shadow-md sm:shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-black/5 bg-slate-50/30 p-4 sm:p-8">
                <CardTitle className="text-sm sm:text-xl font-bold flex items-center gap-2 sm:gap-3 text-slate-900 uppercase tracking-tight font-sans">
                  <div className="p-1.5 sm:p-2.5 bg-[#121A32] rounded-lg sm:rounded-xl shadow-lg shadow-[#121A32]/10">
                    <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                  </div>
                  Weekly Breakdown
                </CardTitle>
                <CardDescription className="text-[9px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 mt-1 ml-9 sm:ml-12 opacity-70 font-sans">Activity patterns over the last 8 weeks.</CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-8 overflow-x-auto scrollbar-thin scrollbar-thumb-indigo-100 scrollbar-track-transparent">
                <div className="h-[250px] sm:h-[350px] min-w-[300px] sm:min-w-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyStats} margin={{ left: -25, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 800, fill: '#0f172a' }} />
                      <YAxis tick={{ fontSize: 8, fontWeight: 800, fill: '#0f172a' }} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '8px' }}
                      />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={window.innerWidth < 640 ? 20 : 32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl sm:rounded-[2.5rem] border-black/5 shadow-md sm:shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-black/5 bg-slate-50/30 p-4 sm:p-8">
                <CardTitle className="text-sm sm:text-xl font-bold flex items-center gap-2 sm:gap-3 text-slate-900 uppercase tracking-tight font-sans">
                  <div className="p-1.5 sm:p-2.5 bg-[#121A32] rounded-lg sm:rounded-xl shadow-lg shadow-[#121A32]/10">
                    <LayoutIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                  </div>
                  Module Breakdown
                </CardTitle>
                <CardDescription className="text-[9px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 mt-1 ml-9 sm:ml-12 opacity-70 font-sans">Most frequently modified system modules.</CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-8">
                <div className="h-[250px] sm:h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={moduleStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={window.innerWidth < 640 ? 50 : 80}
                        outerRadius={window.innerWidth < 640 ? 75 : 110}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {moduleStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '8px' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={48} 
                        formatter={(value) => <span className="text-[8px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-2">{value.replace(/_/g, ' ')}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
