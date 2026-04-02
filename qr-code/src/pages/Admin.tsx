import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Download, 
  Users, 
  X, 
  QrCode, 
  ShieldCheck, 
  UserPlus, 
  LogOut, 
  Copy, 
  CheckCircle2,
  Trash2,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { mockRegistrations } from "@/data/mockData";
import AdminStats from "@/components/AdminStats";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Registration } from "@/types/registration";
import { useToast } from "@/hooks/use-toast";
import QRCode from "react-qr-code";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [timeSlotFilter, setTimeSlotFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>(mockRegistrations);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [roles] = useState<string[]>([
    'Administrator',
    'Account',
    'Agent',
    'Crew',
    'Pilot',
    'Co-pilot',
    'Ground Support',
    'Engineering'
  ]);
  const [activeTab, setActiveTab] = useState("registrations");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestPassword, setRequestPassword] = useState("");
  const [requestRole, setRequestRole] = useState("staff");
  const [authView, setAuthView] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showRequestPassword, setShowRequestPassword] = useState(false);
  const [eventId, setEventId] = useState("default");
  const [baseUrl, setBaseUrl] = useState("");
  const [scanEntryId, setScanEntryId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const adminTabs = useMemo(() => ([
    { id: "registrations", label: "Registrations", icon: Users },
    { id: "users", label: "Users", icon: UserPlus },
    { id: "qr", label: "QR Code", icon: QrCode },
  ]), []);

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      const matchesSearch = 
        reg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reg.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reg.phone.includes(searchQuery);
      
      const matchesGender = genderFilter === "all" || reg.gender === genderFilter;
      const matchesTimeSlot = timeSlotFilter === "all" || reg.selectedTimeSlot === timeSlotFilter;

      return matchesSearch && matchesGender && matchesTimeSlot;
    });
  }, [registrations, searchQuery, genderFilter, timeSlotFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setGenderFilter("all");
    setTimeSlotFilter("all");
  };

  const hasActiveFilters = searchQuery || genderFilter !== "all" || timeSlotFilter !== "all";

  const uniqueTimeSlots = [...new Set(registrations.map(r => r.selectedTimeSlot))];

  const eventUrl = useMemo(() => {
    if (!baseUrl) return "";
    return `${baseUrl}/event?eid=${encodeURIComponent(eventId)}`;
  }, [baseUrl, eventId]);

  const isAdmin = () => {
    // Check profile role or check if it's the superadmin email
    const profileRole = adminProfile?.role;
    const profileEmail = adminProfile?.email;
    const authEmail = session?.user?.email;

    return profileRole === 'admin' || 
           profileRole === 'Administrator' || 
           profileEmail === 'admin@oneday.com' || 
           authEmail === 'admin@oneday.com';
  };

  const allowedTabs = useMemo(() => {
    // If superadmin (email check), they get all tabs regardless of profile
    if (session?.user?.email === 'admin@oneday.com') {
      return adminTabs.map((tab) => tab.id);
    }

    if (!adminProfile) return [];
    
    // Superadmin or Administrator role gets all tabs
    if (adminProfile.role === 'admin' || adminProfile.role === 'Administrator') {
      return adminTabs.map((tab) => tab.id);
    }

    // Role-based check
    const userRole = adminProfile.role;
    const allowed = rolePermissions
      .filter((p) => p.role === userRole && p.can_view)
      .map((p) => p.module);
    
    // Non-admins cannot see users or permissions tabs even if granted by mistake
    return allowed.filter(tabId => tabId !== 'users' && tabId !== 'permissions');
  }, [adminProfile, rolePermissions, adminTabs, session]);

  useEffect(() => {
    if (!baseUrl) {
      setBaseUrl(window.location.origin);
    }
  }, [baseUrl]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchAdminProfile(session.user.email!),
        fetchPermissions(),
        fetchRegistrations(),
        fetchAdminUsers(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [session]);

  useEffect(() => {
    if (!allowedTabs.length) return;
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [allowedTabs, activeTab]);

  const fetchAdminProfile = async (email: string) => {
    const { data } = await supabase
      .from("admin_users")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    setAdminProfile(data as AdminUser | null);
  };

  const fetchRegistrations = async () => {
    const { data } = await supabase
      .from("event_registrations")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) {
      setRegistrations([]);
      return;
    }
    type RegistrationData = {
      name?: string;
      email?: string;
      phone?: string;
      gender?: "Male" | "Female" | "Other";
      age?: number;
      weight?: number;
      address?: string;
      date?: string;
      time_slot?: string;
      notes?: string;
      document_name?: string;
      document_type?: string;
      document_size?: number;
    };
    interface EventRegistrationRow {
      id: string;
      created_at?: string;
      registered_at?: string;
      name?: string;
      email?: string;
      phone?: string;
      gender?: "Male" | "Female" | "Other";
      age?: number;
      weight?: number;
      address?: string;
      date?: string;
      time_slot?: string;
      notes?: string;
      document_name?: string;
      document_type?: string;
      document_size?: number;
      checked_in_at?: string | null;
      qr_code_scanned?: boolean;
      registration_data?: RegistrationData | null;
    }
    const rows = data as EventRegistrationRow[];
    const mapped = rows.map((r) => {
      const d = r.registration_data || {};
      const selectedDate = d.date || r.date || "";
      const selectedTimeSlot = d.time_slot || r.time_slot || "";
      return {
        id: r.id,
        name: d.name ?? r.name ?? "",
        email: d.email ?? r.email ?? "",
        phone: d.phone ?? r.phone ?? "",
        gender: (d.gender ?? r.gender ?? "Other") as "Male" | "Female" | "Other",
        age: d.age ?? r.age ?? 0,
        weight: d.weight ?? r.weight ?? 0,
        address: d.address ?? r.address ?? "",
        selectedDate,
        selectedTimeSlot,
        notes: d.notes ?? r.notes ?? "",
        documentName: d.document_name ?? r.document_name,
        documentType: d.document_type ?? r.document_type,
        documentSize: d.document_size ?? r.document_size,
        registeredAt: r.created_at ?? r.registered_at ?? new Date().toISOString(),
        checkedInAt: r.checked_in_at ?? (r.qr_code_scanned ? new Date(0).toISOString() : null),
      } as Registration;
    });
    setRegistrations(mapped);
  };

  const fetchAdminUsers = async () => {
    const { data } = await supabase
      .from("admin_users")
      .select("*")
      .order("created_at", { ascending: false });
    setAdminUsers((data || []) as AdminUser[]);
  };

  const fetchPermissions = async () => {
    const { data } = await supabase.from("role_permissions").select("*");
    setRolePermissions(data || []);
  };

  const handleLogin = async () => {
    if (!supabase) return;

    // Security: Trim and normalize
    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPassword = loginPassword.trim();

    // SQL Injection protection
    const sqlPatterns = /['";]|--|(\b(OR|AND)\b.*\b(=|>|<)\b)/i;
    if (sqlPatterns.test(cleanEmail)) {
      toast({ title: "Login failed", description: "Invalid characters in email." });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast({ title: "Login failed", description: "Please enter a valid email address." });
      return;
    }

    if (cleanPassword.length < 6) {
      toast({ title: "Login failed", description: "Password must be at least 6 characters." });
      return;
    }

    // Security Note: We do NOT apply sqlPatterns to the password.
    // Passwords should allow all special characters. Parameterized queries handle safety.

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (error) {
      toast({ title: "Login failed", description: "Invalid email or password." });
      return;
    }
    toast({ title: "Welcome back", description: "Login successful." });
  };

  const handleRequestAccess = async () => {
    if (!supabase) return;

    // Security: Trim and normalize
    const cleanEmail = requestEmail.trim().toLowerCase();
    const cleanPassword = requestPassword.trim();

    // SQL Injection protection
    const sqlPatterns = /['";]|--|(\b(OR|AND)\b.*\b(=|>|<)\b)/i;
    if (sqlPatterns.test(cleanEmail)) {
      toast({ title: "Request failed", description: "Invalid characters in email." });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast({ title: "Request failed", description: "Please enter a valid email address." });
      return;
    }

    if (cleanPassword.length < 6) {
      toast({ title: "Request failed", description: "Password must be at least 6 characters." });
      return;
    }

    // Security Note: We do NOT apply sqlPatterns to the password.

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (error) {
      toast({ title: "Request failed", description: "Failed to create account. Please try again." });
      return;
    }
    const userId = data.user?.id;
    if (!userId) {
      toast({ title: "Request failed", description: "User not created." });
      return;
    }
    const { error: profileError } = await supabase.from("admin_users").insert({
      id: userId,
      email: cleanEmail,
      role: requestRole,
      is_approved: requestRole === 'Administrator' || cleanEmail === 'admin@oneday.com',
    });
    if (profileError) {
      if (profileError.code === '23505' || profileError.message?.includes("duplicate key")) {
        toast({ title: "Request failed", description: "This email is already registered." });
      } else {
        toast({ title: "Request failed", description: "Failed to create profile." });
      }
      return;
    }
    toast({ title: "Access requested", description: "Admin approval required." });
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setAdminProfile(null);
  };

  const handleApproveUser = async (userId: string, approved: boolean) => {
    if (!supabase) return;
    if (!isAdmin()) {
      toast({ title: "Permission denied", description: "Only administrators can approve users." });
      return;
    }
    const { error } = await supabase
      .from("admin_users")
      .update({ is_approved: approved })
      .eq("id", userId);
    if (error) {
      toast({ title: "Update failed", description: error.message });
      return;
    }
    fetchAdminUsers();
  };

  const handleRoleChange = async (userId: string, role: string) => {
    if (!supabase) return;
    if (!isAdmin()) {
      toast({ title: "Permission denied", description: "Only administrators can change roles." });
      return;
    }
    const { error } = await supabase.from("admin_users").update({ role }).eq("id", userId);
    if (error) {
      toast({ title: "Update failed", description: error.message });
      return;
    }
    fetchAdminUsers();
  };

  const handleCreateUser = async () => {
    if (!supabase) return;
    if (!isAdmin()) {
      toast({ title: "Permission denied", description: "Only administrators can create users." });
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: requestEmail,
      password: requestPassword,
    });
    if (error) {
      toast({ title: "Creation failed", description: error.message });
      return;
    }
    const userId = data.user?.id;
    if (!userId) {
      toast({ title: "Creation failed", description: "User not created." });
      return;
    }
    const { error: profileError } = await supabase.from("admin_users").insert({
      id: userId,
      email: requestEmail,
      role: requestRole,
      is_approved: false,
    });
    if (profileError) {
      if (profileError.code === '23505' || profileError.message?.includes("duplicate key")) {
        toast({ title: "Creation failed", description: "This email is already registered." });
      } else {
        toast({ title: "Creation failed", description: profileError.message });
      }
      return;
    }
    setRequestEmail("");
    setRequestPassword("");
    setRequestRole("staff");
    fetchAdminUsers();
  };

  const handleCheckIn = async (registrationId: string) => {
    if (!supabase) return;
    
    // Check if user has permission to view registrations (implied edit for check-in)
    const canCheckIn = isAdmin() || rolePermissions.some(p => p.role === adminProfile?.role && p.module === 'registrations' && p.can_view);
    
    if (!canCheckIn) {
      toast({ title: "Permission denied", description: "You don't have permission to perform check-ins." });
      return;
    }

    const { error } = await supabase
      .from("event_registrations")
      .update({ qr_code_scanned: true })
      .eq("id", registrationId);
    if (error) {
      toast({ title: "Check-in failed", description: error.message });
      return;
    }
    fetchRegistrations();
  };

  const handleScanCheckIn = async () => {
    if (!scanEntryId.trim()) return;
    await handleCheckIn(scanEntryId.trim());
    setScanEntryId("");
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredRegistrations.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (!supabase || selectedIds.length === 0) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("event_registrations")
        .delete()
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: "Deleted successfully",
        description: `Removed ${selectedIds.length} registration(s).`,
      });
      
      setSelectedIds([]);
      await fetchRegistrations();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {loading && (
        <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.length} selected registration(s).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!loading && !session && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-card border rounded-2xl p-6 shadow-card">
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold">Admin Access</h1>
              <p className="text-sm text-muted-foreground">Login or request access</p>
            </div>
            <Tabs value={authView} onValueChange={setAuthView}>
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="request">Request Access</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <div className="space-y-4">
                  <Input placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Password" 
                      value={loginPassword} 
                      onChange={(e) => setLoginPassword(e.target.value)} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button className="w-full" onClick={handleLogin}>Login</Button>
                </div>
              </TabsContent>
              <TabsContent value="request">
                <div className="space-y-4">
                  <Input placeholder="Email" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} />
                  <div className="relative">
                    <Input 
                      type={showRequestPassword ? "text" : "password"} 
                      placeholder="Password" 
                      value={requestPassword} 
                      onChange={(e) => setRequestPassword(e.target.value)} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowRequestPassword(!showRequestPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showRequestPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Select value={requestRole} onValueChange={setRequestRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button className="w-full" onClick={handleRequestAccess}>Request Access</Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      {!loading && session && !adminProfile && session.user?.email !== 'admin@oneday.com' && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-card border rounded-2xl p-6 shadow-card text-center">
            <h1 className="text-xl font-bold mb-2">Access Not Found</h1>
            <p className="text-sm text-muted-foreground mb-4">Request access to continue.</p>
            <Button variant="secondary" onClick={handleLogout} className="w-full border-slate-200 shadow-sm">Sign Out</Button>
          </div>
        </div>
      )}

      {!loading && session && (adminProfile || session.user?.email === 'admin@oneday.com') && 
       (adminProfile && !adminProfile.is_approved && session.user?.email !== 'admin@oneday.com') && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-card border rounded-2xl p-6 shadow-card text-center">
            <h1 className="text-xl font-bold mb-2">Awaiting Approval</h1>
            <p className="text-sm text-muted-foreground mb-4">Your role is {adminProfile.role}. Access is pending approval.</p>
            <Button variant="secondary" onClick={handleLogout} className="w-full border-slate-200 shadow-sm">Sign Out</Button>
          </div>
        </div>
      )}

      {!loading && session && (adminProfile || session.user?.email === 'admin@oneday.com') && 
       (session.user?.email === 'admin@oneday.com' || (adminProfile && adminProfile.is_approved)) && (
        <>
          <header className="sticky top-0 z-50 bg-background border-b border-border">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => navigate("/")}
                  className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="font-bold text-lg">Admin Dashboard</h1>
                  <p className="text-sm text-muted-foreground">
                    Role: {adminProfile?.role || (session?.user?.email === 'admin@oneday.com' ? 'Superadmin' : 'Unknown')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" className="gap-2 border-slate-200 shadow-sm">
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
                <Button variant="ghost" size="sm" className="gap-2" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 py-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="flex flex-wrap gap-2 bg-transparent p-0">
                {adminTabs
                  .filter((tab) => allowedTabs.includes(tab.id))
                  .map((tab) => (
                    <TabsTrigger key={tab.id} value={tab.id} className="gap-2 border bg-background">
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </TabsTrigger>
                  ))}
              </TabsList>

              <TabsContent value="registrations" className="space-y-6">
                <AdminStats registrations={registrations} />
                <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, email, or phone..."
                        className="pl-10 h-11"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant={showFilters ? "secondary" : "secondary"}
                        onClick={() => setShowFilters(!showFilters)}
                        className="gap-2 border-slate-200 shadow-sm"
                      >
                        <Filter className="w-4 h-4" />
                        Filters
                        {hasActiveFilters && (
                          <Badge variant="secondary" className="ml-1 bg-primary text-primary-foreground">
                            {[genderFilter !== "all", timeSlotFilter !== "all", searchQuery].filter(Boolean).length}
                          </Badge>
                        )}
                      </Button>
                      {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                          <X className="w-4 h-4" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {showFilters && (
                    <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-4">
                      <div className="w-48">
                        <label className="text-sm font-medium mb-1.5 block">Gender</label>
                        <Select value={genderFilter} onValueChange={setGenderFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Genders</SelectItem>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-48">
                        <label className="text-sm font-medium mb-1.5 block">Time Slot</label>
                        <Select value={timeSlotFilter} onValueChange={setTimeSlotFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Time Slots</SelectItem>
                            {uniqueTimeSlots.map((slot) => (
                              <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredRegistrations.length} of {registrations.length} registrations
                  </p>
                  {selectedIds.length > 0 && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Selected ({selectedIds.length})
                    </Button>
                  )}
                </div>

                <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox 
                              checked={filteredRegistrations.length > 0 && selectedIds.length === filteredRegistrations.length}
                              onCheckedChange={(checked) => handleSelectAll(!!checked)}
                            />
                          </TableHead>
                          <TableHead className="w-[200px]">Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Gender</TableHead>
                          <TableHead>Age</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>Time Slot</TableHead>
                          <TableHead>Registered</TableHead>
                          <TableHead>Entry</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRegistrations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                              No registrations found matching your filters
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRegistrations.map((reg) => (
                            <TableRow key={reg.id} className="hover:bg-muted/50">
                              <TableCell>
                                <Checkbox 
                                  checked={selectedIds.includes(reg.id)}
                                  onCheckedChange={(checked) => handleSelectOne(reg.id, !!checked)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                <div>
                                  <p>{reg.name}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                    {reg.address}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>{reg.email}</TableCell>
                              <TableCell>{reg.phone}</TableCell>
                              <TableCell>
                                <Badge variant={reg.gender === "Male" ? "secondary" : "outline"}>
                                  {reg.gender}
                                </Badge>
                              </TableCell>
                              <TableCell>{reg.age}</TableCell>
                              <TableCell>{reg.weight} kg</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-accent/50 border-0">
                                  {reg.selectedTimeSlot}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(reg.registeredAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {reg.checkedInAt ? (
                                  <Badge className="bg-emerald-500 text-white gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Checked In
                                  </Badge>
                                ) : (
                                  <Button size="sm" variant="secondary" className="border-slate-200 shadow-sm" onClick={() => handleCheckIn(reg.id)}>
                                    Check In
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="users" className="space-y-6">
                <div className="bg-card rounded-2xl border border-border p-4 shadow-card space-y-4">
                  <h2 className="font-semibold">Create User</h2>
                  <div className="grid gap-3 md:grid-cols-4">
                    <Input placeholder="Email" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} />
                    <Input type="password" placeholder="Password" value={requestPassword} onChange={(e) => setRequestPassword(e.target.value)} />
                    <Select value={requestRole} onValueChange={setRequestRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleCreateUser} className="gap-2">
                      <UserPlus className="w-4 h-4" />
                      Create
                    </Button>
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                              No users found
                            </TableCell>
                          </TableRow>
                        ) : (
                          adminUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell>{user.email}</TableCell>
                              <TableCell className="min-w-[180px]">
                                <Select value={user.role} onValueChange={(role) => handleRoleChange(user.id, role)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {roles.map((role) => (
                                      <SelectItem key={role} value={role}>{role}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {user.is_approved ? (
                                  <Badge className="bg-emerald-500 text-white">Approved</Badge>
                                ) : (
                                  <Badge variant="outline">Pending</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant={user.is_approved ? "secondary" : "default"}
                                  className={user.is_approved ? "border-slate-200 shadow-sm" : ""}
                                  onClick={() => handleApproveUser(user.id, !user.is_approved)}
                                >
                                  {user.is_approved ? "Revoke" : "Approve"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="qr" className="space-y-6">
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="bg-card rounded-2xl border border-border p-6 shadow-card space-y-4">
                    <h2 className="font-semibold">Event QR Generator</h2>
                    <div className="space-y-3">
                      <label className="text-sm font-medium">Event ID</label>
                      <Input value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="default" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-medium">Event URL</label>
                      <div className="flex gap-2">
                        <Input value={eventUrl} readOnly />
                        <Button
                          variant="secondary"
                          size="icon"
                          className="border-slate-200 shadow-sm"
                          onClick={() => {
                            navigator.clipboard.writeText(eventUrl);
                            toast({ title: "Copied", description: "Event URL copied to clipboard." });
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-medium">Scan Entry</label>
                      <div className="flex gap-2">
                        <Input value={scanEntryId} onChange={(e) => setScanEntryId(e.target.value)} placeholder="Paste registration ID" />
                        <Button onClick={handleScanCheckIn}>Check In</Button>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card rounded-2xl border border-border p-6 shadow-card flex items-center justify-center">
                    {eventUrl ? (
                      <div className="bg-white p-4 rounded-xl">
                        <QRCode value={eventUrl} size={220} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">QR code preview will appear here</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </>
      )}
    </div>
  );
};

interface AdminUser {
  id: string;
  email: string;
  role: string;
  is_approved: boolean;
  created_at?: string;
}

export default Admin;
