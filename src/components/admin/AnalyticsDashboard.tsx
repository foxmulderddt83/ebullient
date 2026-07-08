import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Loader2, Users, MousePointer, Globe, Smartphone, Clock, ChevronLeft, ChevronRight, Trash2, Filter, Tag, Activity } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#64748b', '#8b5cf6', '#06b6d4', '#f43f5e', '#334155'];

interface Interaction {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  ip_address: string;
  country: string;
  city: string;
  device_type: string;
  browser: string;
  os: string;
  isp: string;
  metadata: any;
  page_path: string;
  created_at: string;
  session_id: string;
}

export const AnalyticsDashboard = ({ settings = {}, canEdit = true }: { settings?: Record<string, any>, canEdit?: boolean }) => {
  const [data, setData] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d'); // 24h, 7d, 30d, 90d
  const [page, setPage] = useState(1);
  const pageSize = 10;
  // Calculate pagination from data
  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, page]);
  const totalPages = Math.ceil(data.length / pageSize);
  const deleteInteractions = async (range: '7d' | '30d' | 'all') => {
    const confirmMessage = range === 'all' 
      ? "Are you sure you want to delete ALL interaction data? This cannot be undone."
      : `Are you sure you want to delete data older than ${range === '7d' ? '1 week' : '1 month'}?`;
    if (!window.confirm(confirmMessage)) return;
    setLoading(true);
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
      toast.success("Interaction data deleted successfully");
      fetchData();
      setPage(1);
    } catch (error: any) {
      console.error('Error deleting interactions:', error);
      toast.error(`Failed to delete data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, [timeRange]);
  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from('user_interactions')
      .select('*')
      .order('created_at', { ascending: false });
    const now = new Date();
    const startTime = new Date();
    if (timeRange === '24h') startTime.setHours(now.getHours() - 24);
    if (timeRange === '7d') startTime.setDate(now.getDate() - 7);
    if (timeRange === '30d') startTime.setDate(now.getDate() - 30);
    if (timeRange === '90d') startTime.setDate(now.getDate() - 90);
    query = query.gte('created_at', startTime.toISOString());
    const { data: interactions, error } = await query;
    if (error) {
      console.error('Error fetching analytics:', error);
    } else {
      setData(interactions || []);
    }
    setLoading(false);
  };

  // Aggregations
  const stats = useMemo(() => {
    const totalEvents = data.length;
    const uniqueSessions = new Set(data.map(d => d.session_id)).size;
    const clicks = data.filter(d => d.action_type === 'click').length;
    
    // Country Data
    const countryCount: Record<string, number> = {};
    data.forEach(d => {
      const c = d.country || 'Unknown';
      countryCount[c] = (countryCount[c] || 0) + 1;
    });
    const countryData = Object.entries(countryCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    // Device Data
    const deviceCount: Record<string, number> = {};
    data.forEach(d => {
      const c = d.device_type || 'Unknown';
      deviceCount[c] = (deviceCount[c] || 0) + 1;
    });
    const deviceData = Object.entries(deviceCount)
      .map(([name, value]) => ({ name, value }));
    // Browser Data
    const browserCount: Record<string, number> = {};
    data.forEach(d => {
      const c = d.browser || 'Unknown';
      browserCount[c] = (browserCount[c] || 0) + 1;
    });
    const browserData = Object.entries(browserCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    // Content Interest (Clicks by Entity Name)
    const contentCount: Record<string, number> = {};
    const trackedComponents = ['BookingWizard', 'FlightPackagesSection', 'AddonsSelection', 'Checkout'];
    
    data
      .filter(d => d.action_type === 'click')
      .filter(d => {
        // Only include interactions from the specified 4 components/pages
        const component = d.metadata?.component || '';
        const page = d.page_path || '';
        
        return trackedComponents.some(tc => 
          component.toLowerCase().includes(tc.toLowerCase()) || 
          page.toLowerCase().includes(tc.toLowerCase())
        );
      })
      .forEach(d => {
        const name = d.entity_name || d.entity_id;
        contentCount[name] = (contentCount[name] || 0) + 1;
      });
    const contentData = Object.entries(contentCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15); // Show more items in the flow chart if needed
    // Telco/ISP Data
    const ispCount: Record<string, number> = {};
    data.forEach(d => {
      const c = d.isp || 'Unknown';
      ispCount[c] = (ispCount[c] || 0) + 1;
    });
    const ispData = Object.entries(ispCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    // IP Address Data
    const ipCount: Record<string, number> = {};
    data.forEach(d => {
      const c = d.ip_address || 'Unknown';
      ipCount[c] = (ipCount[c] || 0) + 1;
    });
    const ipData = Object.entries(ipCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    // Session Duration Estimate
    // Group by session_id, find min and max time
    const sessionTimes: Record<string, { start: number, end: number }> = {};
    data.forEach(d => {
      const time = new Date(d.created_at).getTime();
      if (!sessionTimes[d.session_id]) {
        sessionTimes[d.session_id] = { start: time, end: time };
      } else {
        sessionTimes[d.session_id].start = Math.min(sessionTimes[d.session_id].start, time);
        sessionTimes[d.session_id].end = Math.max(sessionTimes[d.session_id].end, time);
      }
    });
    let totalDuration = 0;
    let countedSessions = 0;
    Object.values(sessionTimes).forEach(s => {
      const duration = (s.end - s.start) / 1000; // seconds
      if (duration > 0) {
        totalDuration += duration;
        countedSessions++;
      }
    });
    const avgDuration = countedSessions > 0 ? Math.round(totalDuration / countedSessions) : 0;
    return {
      totalEvents,
      uniqueSessions,
      clicks,
      countryData,
      deviceData,
      browserData,
      contentData,
      ispData,
      ipData,
      avgDuration
    };
  }, [data]);

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6 mb-2">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-[0.05em] text-slate-900 flex items-center gap-3 uppercase font-sans">
            <div className="bg-[#8B0000] p-2 sm:p-2.5 rounded-xl shadow-lg shadow-red-100">
              <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            Analytics Overview
          </h2>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.1em] text-slate-400 ml-12 sm:ml-16">Real-time visitor behavior and interaction metrics</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl p-1 w-full sm:w-auto backdrop-blur-sm">
            {(['24h', '7d', '30d', '90d'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeRange(range)}
                className={`flex-1 sm:flex-none h-8 px-4 sm:px-5 rounded-lg text-[10px] font-bold tracking-widest transition-all duration-200 uppercase ${
                  timeRange === range 
                    ? "bg-[#121A32] text-white shadow-sm" 
                    : "text-slate-500 hover:bg-white hover:text-slate-900"
                }`}
              >
                {range.toUpperCase()}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button 
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={loading}
              className="h-10 w-10 rounded-xl border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-all active:scale-95"
            >
              <Activity className={`w-4 h-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline"
                  disabled={!canEdit}
                  className="flex-1 sm:flex-none h-10 px-4 sm:px-6 rounded-xl border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-all gap-3 active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">{canEdit ? 'Purge Data' : 'Read Only'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-200 shadow-xl p-1">
                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 px-3 py-2">Select Range</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem onClick={() => deleteInteractions('7d')} className="cursor-pointer py-2 rounded-lg text-slate-700 focus:bg-slate-50">
                  <span className="text-[11px] font-bold uppercase tracking-tight">Older than 1 week</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => deleteInteractions('30d')} className="cursor-pointer py-2 rounded-lg text-slate-700 focus:bg-slate-50">
                  <span className="text-[11px] font-bold uppercase tracking-tight">Older than 1 month</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem onClick={() => deleteInteractions('all')} className="cursor-pointer py-2 rounded-lg text-rose-600 focus:text-rose-700 focus:bg-rose-50 font-bold uppercase tracking-widest">
                  <span className="text-[11px]">Delete everything</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-slate-200 bg-white shadow-sm rounded-2xl group hover:border-slate-300 hover:shadow-md transition-all duration-300 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/10 group-hover:bg-indigo-500 transition-colors" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-6">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] font-mono">Volume / Sessions</CardTitle>
            <div className="bg-slate-50 p-2 rounded-lg group-hover:bg-indigo-50 transition-colors border border-slate-100">
              <Users className="h-4 w-4 text-slate-500 group-hover:text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-3xl font-bold text-slate-900 tracking-tighter font-mono">{stats.uniqueSessions.toLocaleString()}</div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5 font-mono">
              <span className="w-1 h-1 rounded-full bg-indigo-400" />
              Unique Visitors
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm rounded-2xl group hover:border-slate-300 hover:shadow-md transition-all duration-300 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/10 group-hover:bg-emerald-500 transition-colors" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-6">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] font-mono">Activity / Events</CardTitle>
            <div className="bg-slate-50 p-2 rounded-lg group-hover:bg-emerald-50 transition-colors border border-slate-100">
              <Activity className="h-4 w-4 text-slate-500 group-hover:text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-3xl font-bold text-slate-900 tracking-tighter font-mono">{stats.totalEvents.toLocaleString()}</div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5 font-mono">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              Log Count
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm rounded-2xl group hover:border-slate-300 hover:shadow-md transition-all duration-300 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/10 group-hover:bg-amber-500 transition-colors" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-6">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] font-mono">Engagement / Clicks</CardTitle>
            <div className="bg-slate-50 p-2 rounded-lg group-hover:bg-amber-50 transition-colors border border-slate-100">
              <MousePointer className="h-4 w-4 text-slate-500 group-hover:text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-3xl font-bold text-slate-900 tracking-tighter font-mono">{stats.clicks.toLocaleString()}</div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5 font-mono">
              <span className="w-1 h-1 rounded-full bg-amber-400" />
              Interactions
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm rounded-2xl group hover:border-slate-300 hover:shadow-md transition-all duration-300 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-slate-500/10 group-hover:bg-slate-500 transition-colors" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-6">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] font-mono">Efficiency / Time</CardTitle>
            <div className="bg-slate-50 p-2 rounded-lg group-hover:bg-slate-100 transition-colors border border-slate-100">
              <Clock className="h-4 w-4 text-slate-500 group-hover:text-slate-900" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-3xl font-bold text-slate-900 tracking-tighter font-mono">{stats.avgDuration}s</div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5 font-mono">
              <span className="w-1 h-1 rounded-full bg-slate-400" />
              Session Avg
            </p>
          </CardContent>
        </Card>
      </div>

      {settings.event_promotion_price && (
        <Card className="border-slate-200 bg-slate-900 shadow-2xl rounded-2xl group hover:shadow-indigo-500/10 transition-all duration-500 ring-1 ring-white/10 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-transparent" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-6 pt-5 relative z-10">
            <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">Yield Management / Active Promotion</CardTitle>
            <div className="bg-white/10 p-1.5 rounded-lg group-hover:rotate-12 transition-transform duration-500">
              <Tag className="h-3.5 w-3.5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-2 relative z-10">
            <div className="flex items-baseline gap-3">
              <div className="text-4xl font-bold text-white tracking-tighter font-mono">MYR {settings.event_promotion_price.toLocaleString()}</div>
              <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Live Rate</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden group hover:border-slate-300 transition-all duration-300">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 font-mono">
              <div className="bg-slate-900 p-1.5 rounded-lg">
                <MousePointer className="w-4 h-4 text-white" />
              </div>
              Traffic / Interaction Flow
            </CardTitle>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest ml-10 font-mono">Historical action logs across critical system components</p>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="h-[320px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.contentData} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={120} 
                    tick={{fontSize: 9, fontWeight: 700, fill: '#64748b', textAnchor: 'end', fontFamily: 'monospace'}} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '0.75rem', 
                      border: 'none', 
                      fontWeight: 700,
                      backgroundColor: '#0f172a',
                      color: '#fff',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '10px'
                    }}
                    itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="value" fill="#8B0000" name="Clicks" radius={[0, 4, 4, 0]} barSize={14} label={{ position: 'right', fontSize: 10, fontWeight: 800, fill: '#8B0000', fontFamily: 'monospace' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3 border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden group hover:border-slate-300 transition-all duration-300">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 font-mono">
              <div className="bg-slate-900 p-1.5 rounded-lg">
                <Smartphone className="w-4 h-4 text-white" />
              </div>
              Inventory / Device Share
            </CardTitle>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest ml-10 font-mono">Portfolio distribution by hardware architecture</p>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="h-[320px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.deviceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    outerRadius={90}
                    innerRadius={65}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={4}
                  >
                    {stats.deviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '0.75rem', 
                      border: 'none', 
                      fontWeight: 700,
                      backgroundColor: '#0f172a',
                      color: '#fff',
                      fontSize: '10px'
                    }} 
                    itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden group hover:border-slate-300 transition-all duration-300">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="bg-slate-100 p-1.5 rounded-lg">
                <Globe className="w-4 h-4 text-slate-600" />
              </div>
              Geographic Focus
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.countryData} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    tick={{fontSize: 9, fontWeight: 700, fill: '#64748b'}} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '0.75rem', 
                      border: 'none', 
                      fontWeight: 700,
                      backgroundColor: '#0f172a',
                      color: '#fff',
                      fontSize: '10px'
                    }} 
                    itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                  />
                  <Bar dataKey="value" fill="#4f46e5" name="Visitors" radius={[0, 4, 4, 0]} barSize={12} label={{ position: 'right', fontSize: 10, fontWeight: 800, fill: '#4f46e5', fontFamily: 'monospace' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden group hover:border-slate-300 transition-all duration-300">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="bg-slate-100 p-1.5 rounded-lg">
                <Smartphone className="w-4 h-4 text-slate-600" />
              </div>
              Browser Market
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.browserData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {stats.browserData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '0.75rem', 
                      border: 'none', 
                      fontWeight: 700,
                      backgroundColor: '#0f172a',
                      color: '#fff',
                      fontSize: '10px'
                    }} 
                    itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden group hover:border-slate-300 transition-all duration-300 sm:col-span-2 lg:col-span-1">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="bg-slate-100 p-1.5 rounded-lg">
                <Globe className="w-4 h-4 text-slate-600" />
              </div>
              Network Origin
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.ispData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {stats.ispData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '0.75rem', 
                      border: 'none', 
                      fontWeight: 700,
                      backgroundColor: '#0f172a',
                      color: '#fff',
                      fontSize: '10px'
                    }} 
                    itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden group hover:border-slate-300 transition-all duration-300">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="bg-slate-100 p-1.5 rounded-lg">
                <Globe className="w-4 h-4 text-slate-600" />
              </div>
              Top IP Addresses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.ipData} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    tick={{fontSize: 9, fontWeight: 700, fill: '#64748b'}} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '0.75rem', 
                      border: 'none', 
                      fontWeight: 700,
                      backgroundColor: '#0f172a',
                      color: '#fff',
                      fontSize: '10px'
                    }} 
                    itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                  />
                  <Bar dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={12} label={{ position: 'right', fontSize: 10, fontWeight: 800, fill: '#4f46e5', fontFamily: 'monospace' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactions Table */}
      <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <div className="bg-slate-900 p-1.5 rounded-lg">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                Real-Time Interaction Log
              </CardTitle>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest ml-10">Live stream of behavioral data and system interactions</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Live Updates</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-b border-slate-100 hover:bg-transparent">
                  <TableHead className="text-[9px] font-bold text-slate-500 uppercase tracking-widest h-10 pl-6">Timestamp</TableHead>
                  <TableHead className="text-[9px] font-bold text-slate-500 uppercase tracking-widest h-10">Action</TableHead>
                  <TableHead className="text-[9px] font-bold text-slate-500 uppercase tracking-widest h-10">Target Content</TableHead>
                  <TableHead className="text-[9px] font-bold text-slate-500 uppercase tracking-widest h-10">Location</TableHead>
                  <TableHead className="text-[9px] font-bold text-slate-500 uppercase tracking-widest h-10">Device & OS</TableHead>
                  <TableHead className="text-[9px] font-bold text-slate-500 uppercase tracking-widest h-10 text-right pr-6">IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                      No activity records found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((interaction) => (
                    <TableRow key={interaction.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                      <TableCell className="whitespace-nowrap pl-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{format(new Date(interaction.created_at), "MMM d, yyyy")}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{format(new Date(interaction.created_at), "HH:mm:ss")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border ${
                          interaction.action_type === 'click' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 
                          interaction.action_type === 'page_view' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {interaction.action_type?.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-[10px] text-slate-800 uppercase tracking-tight">
                            {interaction.entity_name || interaction.entity_id || '-'}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                            {interaction.entity_type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <Globe className="w-3 h-3 text-slate-300" />
                          <div className="flex flex-col">
                            <span className="font-bold text-[10px] text-slate-700 uppercase tracking-tight">{interaction.country || 'Unknown'}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{interaction.city}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-3 h-3 text-slate-300" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{interaction.device_type}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{interaction.browser} • {interaction.os}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6 py-4 font-mono text-[10px] text-slate-500 font-bold">
                        {interaction.ip_address}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden divide-y divide-slate-100">
            {paginatedData.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                No activity records found
              </div>
            ) : (
              paginatedData.map((interaction) => (
                <div key={interaction.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">
                      {format(new Date(interaction.created_at), "MMM d, HH:mm:ss")}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border ${
                      interaction.action_type === 'click' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 
                      interaction.action_type === 'page_view' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {interaction.action_type?.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-900 uppercase tracking-tight">
                      {interaction.entity_name || interaction.entity_id || '-'}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Type: {interaction.entity_type}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Location</p>
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3 h-3 text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{interaction.country || 'Unknown'}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest pl-4">{interaction.city}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Device</p>
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="w-3 h-3 text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight truncate">{interaction.browser}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest pl-4">{interaction.os} ({interaction.device_type})</p>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Network</p>
                      <p className="text-[10px] font-bold text-slate-600 font-mono">{interaction.ip_address}</p>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 truncate max-w-[120px] text-right uppercase tracking-widest">
                      {interaction.isp}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-t border-slate-100 bg-slate-50/20">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 order-2 sm:order-1">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              Dataset / {data.length} Total Interaction Nodes
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex-1 sm:flex-none h-9 px-5 rounded-xl border-slate-200 bg-white hover:bg-slate-50 transition-all font-bold text-[10px] uppercase tracking-widest gap-2 shadow-sm active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex-1 sm:flex-none h-9 px-5 rounded-xl border-slate-200 bg-white hover:bg-slate-50 transition-all font-bold text-[10px] uppercase tracking-widest gap-2 shadow-sm active:scale-95"
              >
                Next Node
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
