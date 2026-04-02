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
  MoreHorizontal
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

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [allLogsForKPI, setAllLogsForKPI] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingKPI, setLoadingKPI] = useState(false);
  const [filter, setFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

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
        // Delete logs created BEFORE 7 days ago
        query = query.lt('created_at', date.toISOString());
      } else if (range === '30d') {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        // Delete logs created BEFORE 30 days ago
        query = query.lt('created_at', date.toISOString());
      } else {
        // Delete all logs
        // Using a filter that is always true like id != '0' is safer to ensure we target rows
        query = query.neq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { error } = await query;
      if (error) throw error;

      toast.success("Logs deleted successfully");
      // Refresh
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

  const fetchLogs = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('activity_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filter) {
        query = query.or(`action_type.ilike.%${filter}%,entity_type.ilike.%${filter}%,admin_email.ilike.%${filter}%`);
      }
      
      if (dateFilter) {
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
           setTotalPages(1);
           return;
        }
        throw error;
      }
      setLogs(data || []);
      if (count !== null) {
        setTotalCount(count);
        setTotalPages(Math.ceil(count / pageSize));
      }
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      toast.error("Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

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
      const type = log.entity_type || 'other';
      stats[type] = (stats[type] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [deduplicatedLogs]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  useEffect(() => {
    setPage(1);
  }, [filter, dateFilter]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchLogs();
    }, 500);
    return () => clearTimeout(timer);
  }, [page, filter, dateFilter]);

  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
      case 'insert':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'update':
      case 'edit':
        return 'bg-primary/10 text-primary/80 hover:bg-primary/20';
      case 'delete':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'approve':
        return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200';
      case 'reject':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
      case 'refund':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
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
      return (
        <div key={key} className="text-xs">
          <span className="font-semibold text-slate-900">{formattedKey}:</span> {String(value)}
        </div>
      );
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-5 sm:px-8 sm:py-5 rounded-[2.5rem] border border-black/5 shadow-xl shadow-primary/5">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-3 text-slate-900 uppercase tracking-tight">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            Activity Logs & KPIs
          </h2>
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mt-1 ml-12">Monitor administrative actions and staff performance metrics.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11 px-6 rounded-xl border-black/10 text-red-600 font-black text-[11px] sm:text-xs uppercase tracking-widest gap-2 transition-all active:scale-95">
                <Trash2 className="w-4 h-4" />
                Clear
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl border-black/10 shadow-2xl p-2 min-w-[200px]">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-900 px-3 py-2">Select Range</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-black/5 mx-2" />
              <DropdownMenuItem onClick={() => handleDeleteLogs('7d')} className="text-red-600 cursor-pointer rounded-xl p-4 text-[11px] sm:text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-colors">
                Older than 1 Week
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDeleteLogs('30d')} className="text-red-600 cursor-pointer rounded-xl p-4 text-[11px] sm:text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-colors">
                Older than 1 Month
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-black/5 mx-2" />
              <DropdownMenuItem onClick={() => handleDeleteLogs('all')} className="text-red-600 font-black cursor-pointer rounded-xl p-4 text-[11px] sm:text-xs uppercase tracking-widest bg-red-50 hover:bg-red-100 transition-colors">
                Delete All Logs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="outline" 
            size="icon"
            onClick={() => {
              fetchLogs();
              fetchKPILogs();
            }} 
            disabled={loading || loadingKPI}
            className="h-11 w-11 rounded-xl border-black/10 hover:bg-slate-50 transition-all active:scale-95"
          >
            {loading || loadingKPI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5 text-slate-900" />}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 p-1 h-11 bg-white/50 backdrop-blur-md rounded-xl border border-black/5 shadow-xl shadow-primary/5">
          <TabsTrigger value="logs" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg rounded-xl flex items-center justify-center gap-3 font-black text-xs sm:text-sm uppercase tracking-widest transition-all h-11">
            <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
            Audit Trail
          </TabsTrigger>
          <TabsTrigger value="kpi" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg rounded-xl flex items-center justify-center gap-3 font-black text-xs sm:text-sm uppercase tracking-widest transition-all h-11">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
            KPI Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Card className="rounded-[2.5rem] border-black/5 shadow-xl shadow-primary/5 overflow-hidden bg-white/70 backdrop-blur-md">
            <CardHeader className="border-b border-black/5 bg-slate-50/30 p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-1">
                  <CardTitle className="text-base sm:text-lg font-black flex items-center gap-3 text-slate-900 uppercase tracking-tight">
                    <div className="p-2.5 bg-primary/5 rounded-xl">
                      <Filter className="w-5 h-5 text-primary" />
                    </div>
                    Activity Filters
                  </CardTitle>
                  <CardDescription className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mt-1 ml-12">
                    Search and filter through the administrative audit trail.
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                  <div className="relative flex-1 lg:w-[350px]">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-900" />
                    <Input
                      placeholder="Search admin, action, or module..."
                      className="pl-14 h-11 text-[11px] sm:text-xs font-black uppercase tracking-widest border-black/10 rounded-xl bg-white/50 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("h-11 justify-start text-left font-black text-[11px] sm:text-xs uppercase tracking-widest border-black/10 rounded-xl px-8 bg-white/50 flex-1 sm:flex-none hover:bg-white transition-all shadow-sm", !dateFilter && "text-slate-900")}>
                        <div className="mr-3 h-5 w-5 rounded-full overflow-hidden border border-primary/10 shrink-0">
                          <img src={eventHero} className="w-full h-full object-cover" alt="" />
                        </div>
                        {dateFilter ? format(dateFilter, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-[2rem] border-black/10 shadow-2xl overflow-hidden" align="end">
                      <CalendarComponent
                        mode="single"
                        selected={dateFilter}
                        onSelect={setDateFilter}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {(filter || dateFilter) && (
                    <Button 
                      variant="ghost" 
                      onClick={() => { setFilter(""); setDateFilter(undefined); }}
                      className="h-16 px-8 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-[2.5rem] font-black text-[11px] sm:text-xs uppercase tracking-widest transition-all"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-black/5 hover:bg-transparent">
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 h-12">Time</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 h-12">Admin</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 h-12">Action</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 h-12">Module</TableHead>
                      <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 h-12 min-w-[300px]">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-40 text-center">
                          {loading ? (
                            <div className="flex flex-col items-center justify-center gap-3">
                              <Loader2 className="h-10 w-10 animate-spin text-primary" />
                              <p className="text-xs font-bold uppercase tracking-widest text-slate-900">Syncing logs...</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-3 opacity-40">
                              <Activity className="h-12 w-12 text-slate-900" />
                              <p className="text-xs font-bold uppercase tracking-widest text-slate-900">No matching logs found</p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id} className="border-black/5 hover:bg-slate-50/50 transition-colors">
                          <TableCell className="whitespace-nowrap font-black text-slate-900 py-4 text-[11px] sm:text-xs uppercase tracking-widest">
                            {format(new Date(log.created_at), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell className="font-black text-slate-950 py-4 text-[11px] sm:text-xs uppercase tracking-widest">
                            {log.admin_email}
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge variant="secondary" className={cn("rounded-md px-2 py-0.5 text-[11px] sm:text-xs font-black uppercase tracking-widest border shadow-sm", getActionBadgeColor(log.action_type))}>
                              {log.action_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize font-black text-slate-900 py-4 text-[11px] sm:text-xs uppercase tracking-widest">
                            {log.entity_type.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-col gap-1.5 bg-slate-50 p-2 rounded-lg border border-black/5 max-w-xl">
                              {formatDetails(log.details)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-t border-black/5 bg-slate-50/30">
                <div className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">
                   Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))} <span className="mx-2 opacity-30">|</span> {totalCount} total entries
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="h-16 px-8 rounded-[2.5rem] border-black/10 hover:bg-white disabled:opacity-30 transition-all font-black text-[11px] sm:text-xs uppercase tracking-widest gap-3 shadow-sm active:scale-95"
                  >
                    <ChevronLeft className="h-5 w-5" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * pageSize >= totalCount || loading}
                    className="h-16 px-8 rounded-[2.5rem] border-black/10 hover:bg-white disabled:opacity-30 transition-all font-black text-[11px] sm:text-xs uppercase tracking-widest gap-3 shadow-sm active:scale-95"
                  >
                    Next
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpi" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="rounded-[2.5rem] border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">Total Actions</p>
                    <h3 className="text-3xl font-black text-slate-900 mt-2">{allLogsForKPI.length}</h3>
                  </div>
                  <div className="p-4 bg-primary rounded-2xl shadow-lg shadow-primary/20">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="mt-6 flex items-center text-[11px] sm:text-xs font-black text-primary uppercase tracking-widest bg-primary/5 w-fit px-3 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3 mr-2" />
                  Last 6 months
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">Active Staff</p>
                    <h3 className="text-3xl font-black text-slate-900 mt-2">{staffStats.length}</h3>
                  </div>
                  <div className="p-4 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200">
                    <UsersIcon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="mt-6 flex items-center text-[11px] sm:text-xs font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 w-fit px-3 py-1 rounded-full">
                  <UserCheck className="w-3 h-3 mr-2" />
                  Admin users
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">Top Performer</p>
                    <h3 className="text-xl font-black text-slate-900 mt-2 truncate max-w-[150px]">
                      {staffStats[0]?.name.split('@')[0] || 'N/A'}
                    </h3>
                  </div>
                  <div className="p-4 bg-amber-500 rounded-2xl shadow-lg shadow-amber-200">
                    <ArrowUpRight className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="mt-6 flex items-center text-[11px] sm:text-xs font-black text-amber-600 uppercase tracking-widest bg-amber-50 w-fit px-3 py-1 rounded-full">
                  {staffStats[0]?.value || 0} actions
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-widest">Avg/Month</p>
                    <h3 className="text-3xl font-black text-slate-900 mt-2">
                      {Math.round(allLogsForKPI.length / Math.max(1, monthlyStats.length))}
                    </h3>
                  </div>
                  <div className="p-4 bg-primary rounded-2xl shadow-lg shadow-primary/20">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="mt-6 flex items-center text-[11px] sm:text-xs font-black text-primary uppercase tracking-widest bg-primary/5 w-fit px-3 py-1 rounded-full">
                  <div className="w-3 h-3 rounded-full overflow-hidden border border-primary/20 mr-2 shrink-0">
                    <img src={eventHero} className="w-full h-full object-cover" alt="" />
                  </div>
                  Frequency
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-[2.5rem] border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-black/5 bg-slate-50/30 p-8">
                <CardTitle className="text-xl font-black flex items-center gap-3 text-slate-900 uppercase tracking-tight">
                  <div className="p-2.5 bg-primary/5 rounded-xl">
                    <UserCheck className="w-5 h-5 text-primary" />
                  </div>
                  Staff Contribution
                </CardTitle>
                <CardDescription className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mt-1 ml-12">Total actions performed by each staff member.</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={staffStats} layout="vertical" margin={{ left: 20, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#eee" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={120} 
                        tick={{ fontSize: 11, fontWeight: 800, fill: '#0f172a' }}
                        tickFormatter={(value: string) => value.split('@')[0].toUpperCase()}
                      />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)', padding: '16px' }}
                        labelStyle={{ fontWeight: '900', color: '#1e293b', marginBottom: '4px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.1em' }}
                      />
                      <Bar dataKey="value" fill="#4f46e5" radius={[0, 12, 12, 0]} barSize={32}>
                        {staffStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-black/5 bg-slate-50/30 p-8">
                <CardTitle className="text-xl font-black flex items-center gap-3 text-slate-900 uppercase tracking-tight">
                  <div className="p-2.5 bg-primary/5 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  Monthly Trend
                </CardTitle>
                <CardDescription className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mt-1 ml-12">System activity over the last 6 months.</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 800, fill: '#0f172a' }} />
                      <YAxis tick={{ fontSize: 11, fontWeight: 800, fill: '#0f172a' }} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)', padding: '16px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#4f46e5" 
                        strokeWidth={4} 
                        dot={{ r: 6, strokeWidth: 3, fill: 'white', stroke: '#4f46e5' }}
                        activeDot={{ r: 8, strokeWidth: 0, fill: '#4f46e5' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-black/5 bg-slate-50/30 p-8">
                <CardTitle className="text-xl font-black flex items-center gap-3 text-slate-900 uppercase tracking-tight">
                  <div className="p-2.5 bg-primary/5 rounded-xl">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  Weekly Breakdown
                </CardTitle>
                <CardDescription className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mt-1 ml-12">Activity patterns over the last 8 weeks.</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 800, fill: '#0f172a' }} />
                      <YAxis tick={{ fontSize: 11, fontWeight: 800, fill: '#0f172a' }} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)', padding: '16px' }}
                      />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[12, 12, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-black/5 bg-slate-50/30 p-8">
                <CardTitle className="text-xl font-black flex items-center gap-3 text-slate-900 uppercase tracking-tight">
                  <div className="p-2.5 bg-primary/5 rounded-xl">
                    <LayoutIcon className="w-5 h-5 text-primary" />
                  </div>
                  Module Breakdown
                </CardTitle>
                <CardDescription className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mt-1 ml-12">Most frequently modified system modules.</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={moduleStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {moduleStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)', padding: '16px' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={48} 
                        formatter={(value) => <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-2">{value.replace(/_/g, ' ')}</span>}
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
