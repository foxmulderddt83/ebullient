import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Loader2, Users, MousePointer, Globe, Smartphone, Clock, ChevronLeft, ChevronRight, Trash2, Filter, Tag } from "lucide-react";
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

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

export const AnalyticsDashboard = ({ settings = {} }: { settings?: Record<string, any> }) => {
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
    data
      .filter(d => d.action_type === 'click')
      .forEach(d => {
        const name = d.entity_name || d.entity_id;
        contentCount[name] = (contentCount[name] || 0) + 1;
      });
    const contentData = Object.entries(contentCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 lg:gap-3 mb-1.5 sm:mb-2">
        <div className="space-y-0.5">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 uppercase tracking-tight">Analytics Overview</h2>
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Real-time user behavior and performance metrics.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="bg-primary/10 p-2.5 rounded-2xl sm:hidden">
              <Filter className="w-4.5 h-4.5 text-primary" />
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full sm:w-[200px] border-black/10 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 h-9 sm:h-10 rounded-2xl font-bold text-xs focus:ring-2 focus:ring-primary/20 transition-all">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-black/10 shadow-2xl">
                <SelectItem value="24h" className="py-2.5 font-bold uppercase tracking-widest text-[11px] sm:text-xs">Last 24 Hours</SelectItem>
                <SelectItem value="7d" className="py-2.5 font-bold uppercase tracking-widest text-[11px] sm:text-xs">Last 7 Days</SelectItem>
                <SelectItem value="30d" className="py-2.5 font-bold uppercase tracking-widest text-[11px] sm:text-xs">Last 30 Days</SelectItem>
                <SelectItem value="90d" className="py-2.5 font-bold uppercase tracking-widest text-[11px] sm:text-xs">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto border-rose-100 bg-rose-50/50 text-rose-600 h-9 sm:h-10 rounded-2xl font-black uppercase tracking-widest text-[11px] sm:text-xs gap-2 hover:bg-rose-100 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
                Cleanup Data
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-2xl border-black/10 shadow-2xl p-1.5 w-52">
              <DropdownMenuLabel className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 px-3 py-1.5">Select Range to Delete</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-black/5" />
              <DropdownMenuItem onClick={() => deleteInteractions('7d')} className="rounded-xl py-2.5 cursor-pointer focus:bg-rose-50 focus:text-rose-600">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest">Older than 7 days</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteInteractions('30d')} className="rounded-xl py-2.5 cursor-pointer focus:bg-rose-50 focus:text-rose-600">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest">Older than 30 days</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteInteractions('all')} className="rounded-xl py-2.5 cursor-pointer focus:bg-rose-600 focus:text-white">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest">Delete All Data</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-1.5">
        <Card className="border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 rounded-[1.5rem] group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-2 sm:px-2.5 sm:pt-2">
            <CardTitle className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-900">Sessions</CardTitle>
            <div className="bg-primary/10 p-1 rounded-xl group-hover:scale-110 transition-transform duration-500">
              <Users className="h-3 w-3 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-0.5 sm:px-2.5 sm:pb-1">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{stats.uniqueSessions}</div>
          </CardContent>
        </Card>
        <Card className="border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 rounded-[1.5rem] group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-2 sm:px-2.5 sm:pt-2">
            <CardTitle className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-900">Actions</CardTitle>
            <div className="bg-primary/10 p-1 rounded-xl group-hover:scale-110 transition-transform duration-500">
              <MousePointer className="h-3 w-3 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-0.5 sm:px-2.5 sm:pb-1">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{stats.totalEvents}</div>
          </CardContent>
        </Card>
        <Card className="border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 rounded-[1.5rem] group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-2 sm:px-2.5 sm:pt-2">
            <CardTitle className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-900">Clicks</CardTitle>
            <div className="bg-primary/10 p-1 rounded-xl group-hover:scale-110 transition-transform duration-500">
              <MousePointer className="h-3 w-3 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-0.5 sm:px-2.5 sm:pb-1">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{stats.clicks}</div>
          </CardContent>
        </Card>
        <Card className="border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 rounded-[1.5rem] group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-2 sm:px-2.5 sm:pt-2">
            <CardTitle className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-900">Avg Time</CardTitle>
            <div className="bg-primary/10 p-1 rounded-xl group-hover:scale-110 transition-transform duration-500">
              <Clock className="h-3 w-3 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-0.5 sm:px-2.5 sm:pb-1">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{stats.avgDuration}s</div>
          </CardContent>
        </Card>
        {settings.event_promotion_price && (
          <Card className="border-primary/20 bg-primary/5/30 backdrop-blur-md shadow-xl shadow-primary/10 rounded-[1.5rem] group hover:shadow-2xl transition-all duration-500 ring-2 ring-primary/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-2 sm:px-2.5 sm:pt-2">
              <CardTitle className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-primary">Active Promotion</CardTitle>
              <div className="bg-primary p-1 rounded-xl group-hover:-rotate-12 transition-transform duration-500 shadow-lg shadow-primary/20">
                <Tag className="h-3 w-3 text-white" />
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-0.5 sm:px-2.5 sm:pb-1">
              <div className="flex items-baseline gap-1.5">
                <div className="text-xl sm:text-2xl font-black text-primary tracking-tight">MYR {settings.event_promotion_price}</div>
                <div className="text-[8px] font-black text-primary/40 uppercase tracking-widest animate-pulse">Live</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-1.5 sm:gap-1.5 grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 rounded-[1.5rem] overflow-hidden group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="p-1 sm:p-1.5 pb-0.5">
            <CardTitle className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <div className="bg-primary p-1.5 rounded-xl shadow-lg shadow-primary/20">
                <MousePointer className="w-3.5 h-3.5 text-white" />
              </div>
              Interaction Flow
            </CardTitle>
            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mt-0.5">Timeline of user actions and clicks</p>
          </CardHeader>
          <CardContent className="p-1 sm:p-1.5 pt-0">
            <div className="h-[220px] sm:h-[260px] w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.contentData} layout="vertical" margin={{ left: -10, right: 30, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000010" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    tick={{fontSize: 11, fontWeight: 900, fill: '#0f172a'}} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '1rem', 
                      border: '1px solid rgba(0,0,0,0.05)', 
                      fontWeight: 900,
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '11px'
                    }}
                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                  />
                  <Bar dataKey="value" fill="#6366f1" name="Clicks" radius={[0, 8, 8, 0]} barSize={15} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3 border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 rounded-[1.5rem] overflow-hidden group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="p-1 sm:p-1.5 pb-0.5">
            <CardTitle className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <div className="bg-primary p-1.5 rounded-xl shadow-lg shadow-primary/20">
                <Smartphone className="w-3.5 h-3.5 text-white" />
              </div>
              Device Breakdown
            </CardTitle>
            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 mt-0.5">Platform usage distribution</p>
          </CardHeader>
          <CardContent className="p-1 sm:p-1.5 pt-0">
            <div className="h-[220px] sm:h-[280px] mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.deviceData}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    outerRadius={window.innerWidth < 640 ? 55 : 80}
                    innerRadius={window.innerWidth < 640 ? 35 : 45}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={3}
                  >
                    {stats.deviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '1rem', 
                      border: '1px solid rgba(0,0,0,0.05)', 
                      fontWeight: 900,
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      backdropFilter: 'blur(10px)',
                      fontSize: '11px'
                    }} 
                  />
                  <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-1.5 sm:gap-1.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 rounded-[1.5rem] overflow-hidden group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="p-1 sm:p-1.5 pb-0.5">
            <CardTitle className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-primary" />
              Geographic Focus
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1 sm:p-1.5 pt-0">
            <div className="h-[170px] sm:h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.countryData}
                    cx="50%"
                    cy="45%"
                    innerRadius={35}
                    outerRadius={window.innerWidth < 640 ? 50 : 60}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {stats.countryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '0.75rem', 
                      border: '1px solid rgba(0,0,0,0.05)', 
                      fontWeight: 900,
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      backdropFilter: 'blur(10px)',
                      fontSize: '8px'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 rounded-[1.5rem] overflow-hidden group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="p-1 sm:p-1.5 pb-0.5">
            <CardTitle className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-primary" />
              Browser Market
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1 sm:p-1.5 pt-0">
            <div className="h-[170px] sm:h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.browserData}
                    cx="50%"
                    cy="45%"
                    innerRadius={35}
                    outerRadius={window.innerWidth < 640 ? 50 : 60}
                    paddingAngle={5}
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
                      border: '1px solid rgba(0,0,0,0.05)', 
                      fontWeight: 900,
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      backdropFilter: 'blur(10px)',
                      fontSize: '8px'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 rounded-[1.5rem] overflow-hidden group hover:shadow-2xl transition-all duration-500 sm:col-span-2 lg:col-span-1">
          <CardHeader className="p-1 sm:p-1.5 pb-0.5">
            <CardTitle className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-primary" />
              Network Origin
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1 sm:p-1.5 pt-0">
            <div className="h-[170px] sm:h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.ispData}
                    cx="50%"
                    cy="45%"
                    innerRadius={35}
                    outerRadius={window.innerWidth < 640 ? 50 : 60}
                    paddingAngle={5}
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
                      border: '1px solid rgba(0,0,0,0.05)', 
                      fontWeight: 900,
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      backdropFilter: 'blur(10px)',
                      fontSize: '8px'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-1.5 sm:gap-1.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 rounded-[1.5rem] overflow-hidden group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="p-1 sm:p-1.5 pb-0.5">
            <CardTitle className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-primary" />
              Top IP Addresses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1 sm:p-1.5 pt-0">
            <div className="h-[170px] sm:h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.ipData} layout="vertical" margin={{ left: 5, right: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#00000008" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    tick={{fontSize: 8, fontWeight: 900, fill: '#0f172a'}} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '0.75rem', 
                      border: '1px solid rgba(0,0,0,0.05)', 
                      fontWeight: 900,
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      backdropFilter: 'blur(10px)',
                      fontSize: '8px'
                    }} 
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactions Table */}
      <Card className="border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 rounded-[1.5rem] overflow-hidden group hover:shadow-2xl transition-all duration-500">
        <CardHeader className="p-1 sm:p-1.5 border-b border-black/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <div className="bg-primary p-1.5 rounded-xl shadow-lg shadow-primary/20">
                  <Clock className="w-3.5 h-3.5 text-white" />
                </div>
                Recent Activity
              </CardTitle>
              <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-900 mt-0.5">Live stream of user interactions</p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-primary/5 rounded-full border border-primary/10">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-widest text-primary/90">Live Updates</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto relative">
            <div className="min-w-[900px]">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-b border-black/5 hover:bg-transparent">
                    <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 h-7 pl-4">Timestamp</TableHead>
                    <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 h-7">Action</TableHead>
                    <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 h-7">Target Content</TableHead>
                    <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 h-7">Location</TableHead>
                    <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 h-7">Device & OS</TableHead>
                    <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 h-8 text-right pr-6">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-slate-900 font-black uppercase tracking-widest text-[9px] italic">
                        No activity records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((interaction) => (
                      <TableRow key={interaction.id} className="hover:bg-primary/5/30 transition-colors border-b border-slate-100 last:border-0">
                        <TableCell className="whitespace-nowrap font-mono text-[9px] pl-4 py-1.5">
                          <span className="text-slate-900">{format(new Date(interaction.created_at), "MMM d, ")}</span>
                          <span className="font-bold text-slate-700">{format(new Date(interaction.created_at), "HH:mm:ss")}</span>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <span className={`px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                            interaction.action_type === 'click' ? 'bg-primary/5 text-primary/90 border-primary/10 shadow-sm shadow-primary/10/50' : 
                            interaction.action_type === 'page_view' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm shadow-emerald-100/50' :
                            'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {interaction.action_type?.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate py-1.5">
                          <div className="flex flex-col">
                            <span className="font-black text-[10px] text-slate-800 uppercase tracking-tight truncate">
                              {interaction.entity_name || interaction.entity_id || '-'}
                            </span>
                            <span className="text-[8px] text-slate-900 font-bold uppercase tracking-widest truncate opacity-60">
                              {interaction.entity_type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5 text-primary/40" />
                            <div className="flex flex-col">
                              <span className="font-black text-[9px] text-slate-700 uppercase">{interaction.country || 'Unknown'}</span>
                              <span className="text-[8px] text-slate-900 font-bold">{interaction.city}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="p-0.5 bg-slate-100 rounded-lg">
                              <Smartphone className="w-2.5 h-2.5 text-slate-900" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter">{interaction.device_type}</span>
                              <span className="text-[8px] text-slate-900 font-bold uppercase tracking-widest">{interaction.browser} • {interaction.os}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6 py-1.5 font-mono text-[9px] text-slate-900 font-bold">
                          {interaction.ip_address}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-4 py-1.5 bg-slate-50/50 border-t border-black/5">
            <div className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-[0.25em] order-2 sm:order-1 flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-white border border-black/5 rounded-md shadow-sm">Page {page} of {Math.max(1, totalPages)}</span>
              <span className="w-1 h-1 rounded-full bg-slate-200"></span>
              <span>{data.length} Total Logs</span>
            </div>
            <div className="flex items-center gap-1.5 order-1 sm:order-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none border-black/5 shadow-xl shadow-primary/5 h-8 px-3 rounded-xl font-black uppercase tracking-widest text-[11px] sm:text-xs bg-white/70 backdrop-blur-sm hover:bg-white active:scale-95 transition-all flex items-center justify-center"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-3 w-3 sm:mr-1 text-primary shrink-0" />
                <span className="hidden sm:inline">Prev</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none border-black/5 shadow-xl shadow-primary/5 h-8 px-3 rounded-xl font-black uppercase tracking-widest text-[11px] sm:text-xs bg-white/70 backdrop-blur-sm hover:bg-white active:scale-95 transition-all flex items-center justify-center"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-3 w-3 sm:ml-1 text-primary shrink-0" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
