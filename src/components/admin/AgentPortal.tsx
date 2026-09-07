import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Loader2, Plus, Trash2, Copy, Ticket, FileCode, BarChart3, RefreshCw,
  Save, Eye, Globe, MousePointerClick, ScrollText, ClipboardList,
  X, Percent, CheckCircle2, XCircle, Users, QrCode, MessageCircle, Code, Lock,
  Gamepad2, Timer, Trophy, Zap, RotateCcw, HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/activityLogger";
import { useIsMobile } from "@/hooks/use-mobile";
import { VisualHtmlEditor } from "./DocumentTemplates";
import { buildShareLinkUrl, buildLandingPageUrl } from "@/lib/agentTracking";

const CHART_COLORS = ['#CD5C5C', '#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e', '#334155'];

interface PackageRow {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  sort_order: number;
}

interface CategoryRow {
  id: string;
  name: string;
}

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  agent_name: string | null;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  max_discount: number | null;
  min_spend: number;
  package_ids: string[];
  category_ids: string[];
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number;
  used_count: number;
  once_per_customer: boolean;
  is_active: boolean;
  created_at: string;
}

interface ShareLink {
  id: string;
  token: string;
  starts_at: string | null;
  label: string | null;
  agent_name: string | null;
  whatsapp_number: string | null;
  whatsapp_message: string | null;
  destination: 'booking' | 'landing' | 'packages';
  package_id: string | null;
  category_id: string | null;
  coupon_id: string | null;
  landing_page_id: string | null;
  is_active: boolean;
  click_count: number;
  unique_visitors: number;
  expires_at: string | null;
  created_at: string;
}

interface LandingPage {
  id: string;
  slug: string;
  title: string;
  agent_name: string | null;
  html_content: string;
  meta_description: string | null;
  package_id: string | null;
  category_id: string | null;
  coupon_id: string | null;
  show_wizard: boolean;
  show_header: boolean;
  show_footer: boolean;
  is_published: boolean;
  /** The price-slash game this page hosts, if any. */
  slash_campaign_id: string | null;
  whatsapp_number: string | null;
  whatsapp_message: string | null;
  view_count: number;
  created_at: string;
}

/**
 * A gamified group discount. The campaign owns the terms and the price:
 * every completed round deepens the cut, and slash_state() is what the
 * storefront reads to price the package.
 *
 * Nothing here touches coupons: a challenge moves the price of the package
 * it targets, which the cards, the cart and checkout all read directly.
 */
interface SlashCampaign {
  id: string;
  title: string;
  goal_text: string | null;
  game_type: 'slash' | 'shoot' | 'spin' | 'match';
  coupon_id: string | null;
  package_id: string | null;
  base_price: number;
  reward_type: 'fixed' | 'percent';
  players_per_tier: number;
  reward_per_tier: number;
  reward_per_player: number;
  hits_target: number;
  max_reward: number;
  duration_hours: number;
  /** Blocks a second round from the same hardware on the same network. */
  strict_device_lock: boolean;
  /** Rounds one IP may bank. 0 = no cap. */
  max_plays_per_ip: number;
  starts_at: string;
  expires_at: string;
  player_count: number;
  tiers_unlocked: number;
  current_reward: number;
  is_active: boolean;
  created_at: string;
}

const SLASH_GAMES: { id: SlashCampaign['game_type']; name: string; blurb: string; icon: string }[] = [
  { id: 'slash', name: 'Sky Slash',   blurb: 'Swipe through aircraft flying past to cut the price.', icon: '✈️' },
  { id: 'shoot', name: 'Sky Shooter', blurb: 'Tap targets diving from the top of the screen.',       icon: '🎯' },
  { id: 'spin',  name: 'Lucky Spin',  blurb: 'One spin, stopped by hand. It cuts what it lands on.', icon: '🎡' },
  { id: 'match', name: "King's Escape", blurb: 'Match three to collapse the rubble before the dragon gets the king.', icon: '👑' },
];

interface ShareEvent {
  id: string;
  share_link_id: string | null;
  landing_page_id: string | null;
  session_id: string | null;
  event_type: string;
  package_id: string | null;
  package_name: string | null;
  scrolled: boolean;
  scroll_depth: number;
  read_seconds: number;
  country: string | null;
  region: string | null;
  city: string | null;
  device_type: string | null;
  created_at: string;
}

interface FormCapture {
  id: string;
  share_link_id: string | null;
  landing_page_id: string | null;
  session_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  selected_date: string | null;
  selected_time: string | null;
  coupon_code: string | null;
  cart_items: any[];
  cart_total: number;
  discount_amount: number;
  step_reached: string | null;
  furthest_step: number;
  completed: boolean;
  booking_id: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  updated_at: string;
}

interface Redemption {
  id: string;
  coupon_id: string;
  booking_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  discount_amount: number;
  order_total: number;
  status: string;
  redeemed_at: string;
}

const DEFAULT_PAGE_HTML = `<div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 48px 24px; color: #0f172a;">
  <p style="font-size: 11px; font-weight: 800; letter-spacing: 0.35em; text-transform: uppercase; color: #CD5C5C; margin: 0 0 12px;">Exclusive Offer</p>
  <h1 style="font-size: 44px; line-height: 1.05; margin: 0 0 20px; text-transform: uppercase;">Fly With Us</h1>
  <p style="font-size: 17px; line-height: 1.7; color: #475569; margin: 0 0 28px;">
    Write your pitch here. Use the toolbar to add images, tables and links &mdash; exactly like the
    document templates editor. The flight packages and the booking form are added automatically below.
  </p>
  <ul style="font-size: 16px; line-height: 2; color: #334155; padding-left: 20px;">
    <li>Certified pilots and full insurance cover</li>
    <li>Scenic routes over the Klang Valley</li>
    <li>Photo and video package included</li>
  </ul>
</div>`;

/** Local datetime-local input value <-> ISO. Kept in the browser's zone so the
 *  agent types the wall-clock time they mean. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (val: string) => (val ? new Date(val).toISOString() : null);

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const randomToken = (len = 8) => {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
};

const randomCouponCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return `ODP${out}`;
};

/**
 * When a share link runs. This is the campaign window: the coupon a link
 * carries is only redeemable while the link itself is live, which the database
 * enforces in validate_coupon().
 *
 * A closed window beats one that has not opened - once a link is past its end
 * date that is the fact worth showing, whatever its start date says.
 */
const linkStatus = (l: ShareLink): { label: string; tone: string } => {
  const now = Date.now();
  if (!l.is_active) return { label: 'Off', tone: 'bg-slate-100 text-slate-500 border-slate-200' };
  if (l.expires_at && new Date(l.expires_at).getTime() <= now) {
    return { label: 'Expired', tone: 'bg-red-50 text-red-600 border-red-200' };
  }
  if (l.starts_at && new Date(l.starts_at).getTime() > now) {
    return { label: 'Scheduled', tone: 'bg-blue-50 text-blue-600 border-blue-200' };
  }
  return { label: 'Live', tone: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
};

/**
 * A coupon no longer schedules itself; it borrows the window of the links that
 * carry it. With no link at all it simply cannot be reached by a customer yet.
 */
const couponStatus = (c: Coupon, links: ShareLink[]): { label: string; tone: string } => {
  if (!c.is_active) return { label: 'Disabled', tone: 'bg-slate-100 text-slate-500 border-slate-200' };
  if (c.max_uses > 0 && c.used_count >= c.max_uses) {
    return { label: 'Used up', tone: 'bg-amber-50 text-amber-700 border-amber-200' };
  }

  const carrying = links.filter(l => l.coupon_id === c.id);
  if (carrying.length === 0) {
    return { label: 'No link', tone: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  const states = carrying.map(l => linkStatus(l).label);
  if (states.includes('Live')) {
    return { label: 'Active', tone: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
  }
  if (states.includes('Scheduled')) {
    return { label: 'Scheduled', tone: 'bg-blue-50 text-blue-600 border-blue-200' };
  }
  if (states.includes('Expired')) {
    return { label: 'Expired', tone: 'bg-red-50 text-red-600 border-red-200' };
  }
  return { label: 'Off', tone: 'bg-slate-100 text-slate-500 border-slate-200' };
};

const getRemainingTime = (expiresAt: string | null): string => {
  if (!expiresAt) return '';
  const now = Date.now();
  const expiryTime = new Date(expiresAt).getTime();
  if (expiryTime <= now) return '';
  const diff = expiryTime - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ');
};

/**
 * Parts of a page an agent must not touch are marked in the HTML with a
 * `data-locked` attribute, e.g.
 *
 *   <div data-locked="true"> ...legal footer... </div>
 *
 * They stay visible and readable in the code editor, but a save that dropped
 * or altered one is rejected. Comparing serialised outerHTML is enough here:
 * any edit inside a locked block changes its markup, so it stops matching.
 */
const extractLockedBlocks = (html: string): string[] => {
  if (typeof window === 'undefined' || !html) return [];
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll('[data-locked]'))
      .map(el => el.outerHTML.replace(/\s+/g, ' ').trim());
  } catch {
    return [];
  }
};

/** Locked blocks present in `baseline` that no longer survive in `next`. */
const missingLockedBlocks = (baseline: string, next: string): number => {
  const before = extractLockedBlocks(baseline);
  if (before.length === 0) return 0;
  const after = new Set(extractLockedBlocks(next));
  return before.filter(b => !after.has(b)).length;
};

const copyToClipboard = async (text: string, what = 'Link') => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error('Unable to copy');
  }
};

const StatCard = ({ label, value, sub, icon: Icon }: {
  label: string; value: string | number; sub?: string; icon: any;
}) => (
  <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 pb-1.5 sm:pb-2 px-3.5 sm:px-5 pt-3.5 sm:pt-5">
      <CardTitle className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] sm:tracking-[0.2em] font-mono leading-tight">
        {label}
      </CardTitle>
      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#CD5C5C] shrink-0" />
    </CardHeader>
    <CardContent className="px-3.5 sm:px-5 pb-3.5 sm:pb-5">
      <div className="text-lg sm:text-2xl font-black text-slate-900">{value}</div>
      {sub && <p className="text-xs text-slate-500 font-medium mt-0.5 sm:mt-1 leading-snug">{sub}</p>}
    </CardContent>
  </Card>
);

/** Stacked key/value row used by the mobile card layouts. */
/**
 * How far back the analytics tab looks. "All time" stays the default: the
 * tab has always shown everything, and quietly hiding older rows behind a
 * new default would read as data loss.
 */
const ANALYTICS_RANGES = [
  { key: 'all', label: 'All time', hours: null },
  { key: '24h', label: '24 hours', hours: 24 },
  { key: '7d',  label: 'Weekly',   hours: 24 * 7 },
  { key: '30d', label: 'Monthly',  hours: 24 * 30 },
] as const;

type AnalyticsRange = typeof ANALYTICS_RANGES[number]['key'];

/** What clearing offers. days === null means everything, whatever its age. */
const CLEAR_OPTIONS = [
  { key: 'all', short: 'All',       title: 'Clear all analytics?',                   days: null },
  { key: '3d',  short: '3 days +',  title: 'Clear analytics older than 3 days?',     days: 3 },
  { key: '7d',  short: '7 days +',  title: 'Clear analytics older than 7 days?',     days: 7 },
  { key: '30d', short: '1 month +', title: 'Clear analytics older than a month?',    days: 30 },
] as const;

type ClearOption = typeof CLEAR_OPTIONS[number];

/**
 * A field label with the rule behind it one tap away.
 *
 * The numbers under "How the price falls" compound - a player's own round
 * and the group's drops both add into the same running total - so the label
 * alone leaves the agent guessing what raising one will actually do.
 *
 * The trigger is a real button so it takes focus, and focus is what opens a
 * Radix tooltip on a touch screen; hover alone would leave phones with no
 * way to read any of this.
 */
const HintLabel = ({ text, hint }: { text: string; hint: React.ReactNode }) => (
  <Label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">
    {text}
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`What "${text}" means`}
          className="text-slate-300 transition-colors hover:text-[#CD5C5C] focus:text-[#CD5C5C] focus:outline-none"
        >
          <HelpCircle className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs font-medium normal-case leading-snug tracking-normal">
        {hint}
      </TooltipContent>
    </Tooltip>
  </Label>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col items-start gap-0.5 py-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 shrink-0">{label}</span>
    <span className="text-xs text-slate-700 sm:text-right break-words">{children}</span>
  </div>
);

/**
 * Type and colour scale for this screen. It used to run from 8px to 16px in
 * five arbitrary steps, several of which were unreadable without zooming, so
 * everything now lands on three sizes and each colour has one job.
 *
 *   text-[11px]  an ALL-CAPS label. Never body text.
 *   text-xs      body and secondary text. The floor for anything read as prose.
 *   text-sm      a value, a title, the thing the row is actually about.
 *   text-base+   section headings only.
 *
 * On a white panel:
 *   text-slate-900  the value itself
 *   text-slate-700  a heading over it
 *   text-slate-600  supporting prose
 *   text-slate-500  labels and hints - the lightest that still passes AA
 *                   contrast. slate-400 sits at about 2.8:1 on white, under
 *                   the 4.5:1 floor, which is what made this hard to read.
 * On the dark shell slate-400 and lighter are correct, and slate-500 is not.
 *
 * Colours that carry meaning: #CD5C5C brand and game, emerald live/booked,
 * amber warning and enquiries, red destructive and expired, indigo scheduling.
 */

/**
 * The dark shell every tab sits on. The panels inside keep the colours they
 * have always had - white cards on near-black read as lit, which is the whole
 * point - so only the chrome around them is restyled for the dark ground.
 */
const TAB_SHELL =
  'mt-4 space-y-4 rounded-3xl bg-gradient-to-b from-[#0B0F19] via-[#111827] to-[#0B0F19] ' +
  'p-4 shadow-2xl ring-1 ring-white/10 sm:mt-5 sm:p-5';

/** Muted body text on the dark shell. */
const SHELL_MUTED = 'text-slate-400';
/** A note or sub-panel that is chrome rather than content. */
const SHELL_NOTE = 'rounded-xl border border-white/10 bg-white/5 p-3';
/** Outline buttons on the dark shell, which would otherwise be white blocks. */
const SHELL_BTN = 'border-white/20 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white';

/**
 * How many things sit behind a tab, shown on the tab itself.
 *
 * Hidden at zero: a badge reading 0 tells you less than no badge does, and
 * each of these tabs already explains its own empty state once opened.
 *
 * One colour serves both trigger states. The deep red is dark enough to hold
 * white text on the active tab's white pill and light enough to separate from
 * the near-black bar behind the inactive ones, so the badge needs no variant.
 */
const TabCount = ({ n }: { n: number }) =>
  n ? (
    <span className="ml-0.5 shrink-0 rounded-full bg-[#731C1C] px-1.5 py-px text-[11px] font-black leading-normal text-white">
      {n}
    </span>
  ) : null;

/** One figure in a page's results strip. Dimmed at zero so a busy page reads first. */
const Stat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div className="min-w-0">
    <p className={`text-sm font-black leading-none ${tone || 'text-slate-900'}`}>{value}</p>
    <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
  </div>
);

/** Seconds as the shortest thing a person would say out loud. */
const readableSeconds = (s: number) => {
  if (!s) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}m ${rest}s` : `${m}m`;
};

/**
 * Live "time left" for a challenge. Owns its own interval so a ticking
 * clock re-renders one badge per second rather than the whole portal.
 */
const SlashCountdown = ({ expiresAt }: { expiresAt: string }) => {
  const [left, setLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));

  useEffect(() => {
    const tick = () =>
      setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (left <= 0) {
    return <span className="font-black tabular-nums text-rose-500">Ended</span>;
  }
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return (
    <span className={`font-black tabular-nums ${h < 1 ? 'text-amber-600' : 'text-slate-900'}`}>
      {h > 0 ? `${h}h ` : ''}{String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s
    </span>
  );
};

export default function AgentPortal({ canEdit = true }: { canEdit?: boolean }) {
  const isMobile = useIsMobile();
  // Every account - administrators included - sees only what it created here.
  // The database enforces the same boundary; this keeps the UI honest about it.
  const [userId, setUserId] = useState<string | null>(null);
  // The account's own name and phone. Everything this agent creates is stamped
  // with these, so they are never typed into a coupon or a link by hand.
  const [profile, setProfile] = useState<{ name: string; phone: string }>({ name: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [events, setEvents] = useState<ShareEvent[]>([]);
  const [captures, setCaptures] = useState<FormCapture[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  const [campaigns, setCampaigns] = useState<SlashCampaign[]>([]);
  const [editingCampaign, setEditingCampaign] = useState<Partial<SlashCampaign> | null>(null);

  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon> | null>(null);
  const [editingLink, setEditingLink] = useState<Partial<ShareLink> | null>(null);
  const [editingPage, setEditingPage] = useState<Partial<LandingPage> | null>(null);
  const [qrLink, setQrLink] = useState<ShareLink | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ table: string; id: string; label: string } | null>(null);
  const [uploadingPageImage, setUploadingPageImage] = useState(false);
  const [pageEditorMode, setPageEditorMode] = useState<'visual' | 'code'>('visual');
  // The page's HTML as it was when the editor opened - the reference the
  // locked-block check compares against.
  const [pageBaselineHtml, setPageBaselineHtml] = useState('');

  const [analyticsScope, setAnalyticsScope] = useState<string>('all');
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('all');
  const [confirmClear, setConfirmClear] = useState<ClearOption | null>(null);
  const [confirmReset, setConfirmReset] = useState<SlashCampaign | null>(null);
  const [resetting, setResetting] = useState(false);
  const [clearing, setClearing] = useState(false);

  // How many protected blocks the page being edited carries.
  const lockedCount = useMemo(
    () => extractLockedBlocks(editingPage?.html_content || '').length,
    [editingPage?.html_content],
  );

  const selectedLandingPage = useMemo(
    () => pages.find(p => p.id === editingLink?.landing_page_id) ?? null,
    [pages, editingLink?.landing_page_id],
  );

  const packageName = useCallback(
    (id: string | null) => packages.find(p => p.id === id)?.name ?? '—',
    [packages],
  );

  // ------------------------------------------------------------------
  // Data
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!supabase) { setLoading(false); return; }
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id ?? null;
        if (cancelled) return;
        setUserId(uid);

        if (!uid) {
          toast.error('Could not identify your account — please sign in again.');
          setLoading(false);
          return;
        }

        const { data: me } = await supabase
          .from('admin_users')
          .select('name, phone')
          .eq('id', uid)
          .maybeSingle();
        if (!cancelled && me) {
          setProfile({ name: (me as any).name || '', phone: (me as any).phone || '' });
        }

        // Owned records first: everything else hangs off these ids.
        const [pkgRes, catRes, coupRes, linkRes, pageRes, campRes] = await Promise.all([
          supabase.from('packages').select('id, name, price, category_id, sort_order').eq('is_active', true).order('sort_order').order('name'),
          supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order'),
          supabase.from('agent_coupons').select('*').eq('created_by', uid).order('created_at', { ascending: false }),
          supabase.from('agent_share_links').select('*').eq('created_by', uid).order('created_at', { ascending: false }),
          supabase.from('agent_landing_pages').select('*').eq('created_by', uid).order('created_at', { ascending: false }),
          supabase.from('slash_campaigns').select('*').eq('created_by', uid).order('created_at', { ascending: false }),
        ]);

        if (cancelled) return;

        const myCoupons = (coupRes.data || []) as Coupon[];
        const myLinks = (linkRes.data || []) as ShareLink[];
        const myPages = (pageRes.data || []) as LandingPage[];

        if (pkgRes.data) setPackages(pkgRes.data as PackageRow[]);
        if (catRes.data) setCategories(catRes.data as CategoryRow[]);
        setCoupons(myCoupons);
        setShareLinks(myLinks);
        setPages(myPages);
        setCampaigns((campRes.data || []) as SlashCampaign[]);

        const linkIds = myLinks.map(l => l.id);
        const pageIds = myPages.map(p => p.id);
        const couponIds = myCoupons.map(c => c.id);

        // Telemetry and captures are attributed to a link OR a page, so each is
        // fetched on both keys and merged on id.
        const byLinkThenPage = async (table: string, orderCol: string, limit: number) => {
          const runs: any[] = [];
          if (linkIds.length) {
            runs.push(supabase.from(table).select('*').in('share_link_id', linkIds)
              .order(orderCol, { ascending: false }).limit(limit));
          }
          if (pageIds.length) {
            runs.push(supabase.from(table).select('*').in('landing_page_id', pageIds)
              .order(orderCol, { ascending: false }).limit(limit));
          }
          if (!runs.length) return { rows: [] as any[], error: null as any };

          const results = await Promise.all(runs);
          const error = results.find(r => r.error)?.error ?? null;
          const merged = new Map<string, any>();
          results.forEach(r => (r.data || []).forEach((row: any) => merged.set(row.id, row)));
          return { rows: Array.from(merged.values()), error };
        };

        const [evt, cap, redRes] = await Promise.all([
          byLinkThenPage('share_link_events', 'created_at', 3000),
          byLinkThenPage('share_link_form_captures', 'updated_at', 500),
          couponIds.length
            ? supabase.from('coupon_redemptions').select('*').in('coupon_id', couponIds)
                .order('redeemed_at', { ascending: false }).limit(500)
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        if (cancelled) return;

        setEvents(evt.rows as ShareEvent[]);
        setCaptures(cap.rows as FormCapture[]);
        setRedemptions((redRes.data || []) as Redemption[]);

        const firstError = [coupRes, linkRes, pageRes, campRes, evt, cap, redRes].find((r: any) => r.error)?.error;
        if (firstError) {
          console.error('[AgentPortal] load error', firstError);
          toast.error(`Failed to load agent data: ${firstError.message}`);
        }
      } catch (e: any) {
        console.error('[AgentPortal] load failed', e);
        toast.error(e?.message || 'Failed to load agent data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const reload = () => setRefreshKey(k => k + 1);

  // ------------------------------------------------------------------
  // Coupons
  // ------------------------------------------------------------------
  const newCoupon = (): Partial<Coupon> => ({
    code: randomCouponCode(),
    description: '',
    discount_type: 'fixed',
    discount_value: 50,
    max_discount: null,
    min_spend: 0,
    package_ids: [],
    category_ids: [],
    starts_at: null,
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    max_uses: 1,
    once_per_customer: true,
    is_active: true,
  });

  const saveCoupon = async () => {
    if (!editingCoupon || !supabase) return;
    const c = editingCoupon;

    if (!c.code?.trim()) { toast.error('Coupon code is required'); return; }
    if (!c.discount_value || Number(c.discount_value) <= 0) {
      toast.error('Discount value must be greater than zero'); return;
    }
    if (c.discount_type === 'percent' && Number(c.discount_value) > 100) {
      toast.error('A percentage discount cannot exceed 100%'); return;
    }
    if (c.starts_at && c.expires_at && new Date(c.starts_at) >= new Date(c.expires_at)) {
      toast.error('The coupon must expire after it starts'); return;
    }

    setSaving(true);
    try {
      const payload = {
        code: c.code.trim().toUpperCase(),
        description: c.description || null,
        // Stamped from the account, so the financial report always names a
        // real person rather than whatever was typed.
        agent_name: profile.name || null,
        discount_type: c.discount_type || 'fixed',
        discount_value: Number(c.discount_value),
        max_discount: c.discount_type === 'percent' && c.max_discount ? Number(c.max_discount) : null,
        min_spend: Number(c.min_spend || 0),
        package_ids: c.package_ids || [],
        category_ids: c.category_ids || [],
        starts_at: c.starts_at || null,
        expires_at: c.expires_at || null,
        max_uses: Number(c.max_uses ?? 1),
        once_per_customer: c.once_per_customer ?? true,
        is_active: c.is_active ?? true,
        created_by: userId,
        updated_at: new Date().toISOString(),
      };

      const { error } = c.id
        ? await supabase.from('agent_coupons').update(payload).eq('id', c.id)
        : await supabase.from('agent_coupons').insert(payload);

      if (error) throw error;

      logActivity(supabase, c.id ? 'update' : 'create', 'agent_coupons', c.id || payload.code, { code: payload.code });
      toast.success(c.id ? 'Coupon updated' : 'Coupon created');
      setEditingCoupon(null);
      if (c.id) {
        setCoupons(prev => prev.map(coupon => coupon.id === c.id ? { ...coupon, ...payload, used_count: coupon.used_count } as Coupon : coupon));
      } else {
        setCoupons(prev => [...prev, { ...payload, id: '', used_count: 0, created_at: new Date().toISOString() } as Coupon]);
      }
    } catch (e: any) {
      const msg = e?.message?.includes('agent_coupons_code_key')
        ? 'That coupon code already exists.'
        : e?.message || 'Failed to save coupon';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Price slash challenges
  // ------------------------------------------------------------------
  const newCampaign = (): Partial<SlashCampaign> => ({
    title: '',
    goal_text: '',
    game_type: 'slash',
    coupon_id: null,
    package_id: null,
    base_price: 0,
    reward_type: 'fixed',
    players_per_tier: 10,
    reward_per_tier: 50,
    reward_per_player: 10,
    hits_target: 20,
    max_reward: 300,
    duration_hours: 48,
    strict_device_lock: true,
    max_plays_per_ip: 3,
    is_active: true,
  });


  /**
   * Put a challenge back to how it started: nobody has played, no reward has
   * been unlocked, and the countdown runs again from now.
   *
   * The ledger goes first. If deleting the rows fails the counters are left
   * alone, so the campaign still agrees with the plays behind it - whereas
   * zeroing the counters first and then failing would show a fresh challenge
   * that every previous player is still locked out of, since slash_play
   * checks the ledger for their device.
   */
  const resetCampaign = async (c: SlashCampaign) => {
    if (!supabase) return;
    setResetting(true);
    try {
      const { error: ledgerError } = await supabase
        .from('slash_participants').delete().eq('campaign_id', c.id);
      if (ledgerError) throw ledgerError;

      const startedAt = new Date();
      const hours = Math.max(1, Number(c.duration_hours || 24));
      const patch = {
        player_count: 0,
        tiers_unlocked: 0,
        current_reward: 0,
        starts_at: startedAt.toISOString(),
        expires_at: new Date(startedAt.getTime() + hours * 3600_000).toISOString(),
        updated_at: startedAt.toISOString(),
      };

      const { error } = await supabase.from('slash_campaigns').update(patch).eq('id', c.id);
      if (error) throw error;

      setCampaigns(prev => prev.map(x => (x.id === c.id ? { ...x, ...patch } as SlashCampaign : x)));
      logActivity(supabase, 'reset', 'slash_campaigns', c.id, { title: c.title });
      toast.success(`"${c.title}" is back to the start`);
      setConfirmReset(null);
    } catch (e: any) {
      console.error('[AgentPortal] reset campaign failed', e);
      toast.error(e?.message || 'Failed to reset the challenge');
    } finally {
      setResetting(false);
    }
  };

  const saveCampaign = async () => {
    if (!editingCampaign || !supabase) return;
    const c = editingCampaign;

    if (!c.title?.trim()) { toast.error('Give the challenge a title'); return; }
    if (Number(c.reward_type === 'percent' ? c.max_reward : c.max_reward) <= 0) {
      toast.error('Set a maximum discount so the challenge has a ceiling'); return;
    }

    setSaving(true);
    try {
      // The clock is anchored to when the campaign started, so editing the
      // duration moves the deadline predictably instead of restarting it.
      const starts = c.starts_at || new Date().toISOString();
      const hours = Math.max(1, Number(c.duration_hours || 24));
      const expires = new Date(new Date(starts).getTime() + hours * 3600_000).toISOString();

      const payload = {
        title: c.title.trim(),
        goal_text: c.goal_text?.trim() || null,
        game_type: c.game_type || 'slash',
        // Challenges do not use coupons: the game moves the package price
        // itself, so there is no code for anything to be redeemed against.
        coupon_id: null,
        package_id: c.package_id || null,
        base_price: Number(c.base_price || 0),
        reward_type: c.reward_type || 'fixed',
        players_per_tier: Math.max(1, Number(c.players_per_tier || 10)),
        reward_per_tier: Number(c.reward_per_tier || 0),
        reward_per_player: Number(c.reward_per_player || 0),
        hits_target: Math.max(1, Number(c.hits_target || 20)),
        max_reward: Number(c.max_reward || 0),
        duration_hours: hours,
        strict_device_lock: c.strict_device_lock ?? true,
        max_plays_per_ip: Math.max(0, Number(c.max_plays_per_ip ?? 3)),
        starts_at: starts,
        expires_at: expires,
        is_active: c.is_active ?? true,
        created_by: userId,
        updated_at: new Date().toISOString(),
      };

      let savedId = c.id;
      if (c.id) {
        const { error } = await supabase.from('slash_campaigns').update(payload).eq('id', c.id);
        if (error) throw error;
        setCampaigns(prev => prev.map(x => (x.id === c.id ? { ...x, ...payload } as SlashCampaign : x)));
      } else {
        const { data, error } = await supabase.from('slash_campaigns').insert(payload).select('*').single();
        if (error) throw error;
        savedId = (data as SlashCampaign).id;
        setCampaigns(prev => [data as SlashCampaign, ...prev]);
      }

      // Push the terms onto the coupon straight away, so its expiry and
      // type match the challenge even before the first person plays.
      if (savedId) await supabase.rpc('slash_sync_coupon', { p_campaign_id: savedId });

      logActivity(supabase, c.id ? 'update' : 'create', 'slash_campaigns', c.id || payload.title, { title: payload.title });
      toast.success(c.id ? 'Challenge updated' : 'Challenge created');
      setEditingCampaign(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save challenge');
    } finally {
      setSaving(false);
    }
  };

  /** Flips a challenge on/off in place, the way the page cards do. */
  const toggleCampaign = async (c: SlashCampaign) => {
    if (!canEdit || !supabase) return;
    const next = !c.is_active;
    setCampaigns(prev => prev.map(x => (x.id === c.id ? { ...x, is_active: next } : x)));
    try {
      const { error } = await supabase.from('slash_campaigns').update({ is_active: next }).eq('id', c.id);
      if (error) throw error;
      // The coupon has to follow, or a stopped challenge keeps discounting.
      await supabase.rpc('slash_sync_coupon', { p_campaign_id: c.id });
      toast.success(next ? 'Challenge running' : 'Challenge stopped');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update challenge');
      setCampaigns(prev => prev.map(x => (x.id === c.id ? { ...x, is_active: c.is_active } : x)));
    }
  };

  // ------------------------------------------------------------------
  // Share links
  // ------------------------------------------------------------------
  /**
   * Everything a link inherits from the page it opens. The page decides the
   * coupon and the game; the agent name and number come from the account. So
   * the link asks for none of them, and its title is simply the page's.
   */
  const fromLandingPage = (page: LandingPage): Partial<ShareLink> => ({
    destination: 'landing',
    landing_page_id: page.id,
    label: page.title,
    package_id: null,
    category_id: null,
  });

  /**
   * Links are only ever created from a page's own card, which spreads
   * fromLandingPage() over this - so the destination is always a landing page
   * and the caller supplies which one. Nothing here has to be guessed.
   */
  const newShareLink = (): Partial<ShareLink> => ({
    token: randomToken(),
    label: '',
    destination: 'landing' as ShareLink['destination'],
    whatsapp_message: '',
    starts_at: null,
    package_id: null,
    category_id: null,
    coupon_id: null,
    landing_page_id: null,
    is_active: true,
    expires_at: null,
  });

  const saveShareLink = async () => {
    if (!editingLink || !supabase) return;
    const l = editingLink;

    if (!l.token?.trim()) { toast.error('A link token is required'); return; }
    if (l.starts_at && l.expires_at && new Date(l.starts_at) >= new Date(l.expires_at)) {
      toast.error('The campaign must expire after it starts'); return;
    }
    if (l.destination === 'landing' && !l.landing_page_id) {
      toast.error('Choose the landing page this link should open'); return;
    }
    if (l.destination === 'landing') {
      // A link to an unpublished page resolves to no slug and quietly drops the
      // visitor on the homepage, so it must not be handed out yet.
      const target = pages.find(pg => pg.id === l.landing_page_id);
      if (target && !target.is_published) {
        toast.error(`Publish "${target.title}" first — a link to a draft sends visitors to the homepage.`);
        return;
      }
    }
    if (l.destination === 'booking' && !l.package_id) {
      toast.error('Choose the package this link should open'); return;
    }

    setSaving(true);
    try {
      const payload = {
        token: l.token.trim().toLowerCase(),
        // No longer typed: the page it opens is the only sensible name, and
        // asking for one meant retyping the page title into a second box.
        label: l.label?.trim() || pages.find(p => p.id === l.landing_page_id)?.title || null,
        agent_name: profile.name || null,
        destination: l.destination || 'landing',
        package_id: l.package_id || null,
        category_id: l.category_id || null,
        // Always null: the page decides the coupon, so a link carrying one of
        // its own would be a second answer with no UI to see or change it.
        coupon_id: null,
        landing_page_id: l.landing_page_id || null,
        // Always the account's own number, so a link cannot advertise someone else's.
        whatsapp_number: profile.phone ? profile.phone.replace(/\D/g, '') : null,
        whatsapp_message: l.whatsapp_message || null,
        is_active: l.is_active ?? true,
        starts_at: l.starts_at || null,
        expires_at: l.expires_at || null,
        created_by: userId,
        updated_at: new Date().toISOString(),
      };

      const { error } = l.id
        ? await supabase.from('agent_share_links').update(payload).eq('id', l.id)
        : await supabase.from('agent_share_links').insert(payload);

      if (error) throw error;

      logActivity(supabase, l.id ? 'update' : 'create', 'agent_share_links', l.id || payload.token, { token: payload.token });
      toast.success(l.id ? 'Share link updated' : 'Share link created');
      setEditingLink(null);
      if (l.id) {
        setShareLinks(prev => prev.map(link => link.id === l.id ? { ...link, ...payload, click_count: link.click_count, unique_visitors: link.unique_visitors } as ShareLink : link));
      } else {
        setShareLinks(prev => [...prev, { ...payload, id: '', click_count: 0, unique_visitors: 0, created_at: new Date().toISOString(), starts_at: payload.starts_at } as ShareLink]);
      }
    } catch (e: any) {
      const msg = e?.message?.includes('agent_share_links_token_key')
        ? 'That link token is already in use.'
        : e?.message || 'Failed to save share link';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Landing pages
  // ------------------------------------------------------------------
  const newPage = (): Partial<LandingPage> => ({
    slug: '',
    title: '',
    html_content: DEFAULT_PAGE_HTML,
    meta_description: '',
    package_id: null,
    category_id: null,
    show_wizard: true,
    show_header: true,
    show_footer: true,
    // Live from the first save. A page was previously born a draft, which
    // meant every one had to be published by hand afterwards, and a link sent
    // out before that step landed the visitor on the homepage instead. The
    // Live badge on the card still toggles it back at any time.
    is_published: true,
    slash_campaign_id: null,
  });

  const openPage = (p: Partial<LandingPage>) => {
    setPageBaselineHtml(p.html_content || '');
    setPageEditorMode('visual');
    setEditingPage(p);
  };

  /**
   * What a coupon actually sells.
   *
   * Coupons scope by package, by category, or not at all. This flattens
   * those into the main packages a page running that coupon should offer -
   * an empty list meaning "no restriction", which the storefront reads as
   * "show everything".
   */
  const couponScope = (couponId: string | null) => {
    const c = coupons.find(x => x.id === couponId);
    if (!c) return { packageIds: [] as string[], categoryId: null as string | null };

    const byId = new Set(c.package_ids || []);
    if (c.category_ids?.length) {
      for (const pkg of packages) {
        if (pkg.sort_order === 0 && c.category_ids.includes(pkg.category_id)) byId.add(pkg.id);
      }
    }

    const packageIds = packages
      .filter(pkg => pkg.sort_order === 0 && byId.has(pkg.id))
      .map(pkg => pkg.id);

    // Only meaningful when the whole scope sits in one category - that is
    // what the wizard narrows to and what the cart is pruned against.
    const cats = new Set(packages.filter(pkg => byId.has(pkg.id)).map(pkg => pkg.category_id));
    return { packageIds, categoryId: cats.size === 1 ? [...cats][0] : null };
  };

  /**
   * The packages a page offers: its coupon's scope, or - when a game runs
   * instead - the single package that game is cutting.
   */
  const pageScope = (p: Partial<LandingPage>) => {
    if (p.coupon_id) return couponScope(p.coupon_id);

    const cm = campaigns.find(c => c.id === p.slash_campaign_id);
    if (cm?.package_id) {
      return {
        packageIds: [cm.package_id],
        categoryId: packages.find(x => x.id === cm.package_id)?.category_id ?? null,
      };
    }
    return { packageIds: [] as string[], categoryId: null as string | null };
  };

  const savePage = async () => {
    if (!editingPage || !supabase) return;
    const p = editingPage;

    if (!p.title?.trim()) { toast.error('Page title is required'); return; }
    const slug = slugify(p.slug || p.title);
    if (!slug) { toast.error('Could not build a URL from that title — set a slug manually'); return; }

    const broken = missingLockedBlocks(pageBaselineHtml, p.html_content || '');
    if (broken > 0) {
      toast.error(
        `${broken} locked block${broken === 1 ? ' was' : 's were'} changed or removed. ` +
        'Restore them before saving — those sections are fixed.',
      );
      return;
    }

    setSaving(true);
    try {
      const wasNew = !p.id;

      /**
       * A new page gets its own copy of the challenge it was built with.
       *
       * A campaign carries live progress - player_count, tiers_unlocked and
       * the reward those add up to - so two pages pointed at one campaign
       * share a scoreboard, and each page's visitors move a bar the other
       * page's visitors filled. Copying gives the new page a run of its own.
       *
       * Only on create. Saving an existing page is an edit, and an edit that
       * quietly spawned a second challenge would leave the agent collecting
       * duplicates every time they fixed a typo.
       */
      let campaignId = p.slash_campaign_id || null;
      let clonedCampaign: SlashCampaign | null = null;

      if (wasNew && campaignId) {
        const source = campaigns.find(c => c.id === campaignId);
        if (source) {
          const startedAt = new Date();
          const hours = Math.max(1, Number(source.duration_hours || 24));
          const { data, error } = await supabase
            .from('slash_campaigns')
            .insert({
              title: `${source.title} · ${p.title.trim()}`,
              goal_text: source.goal_text,
              game_type: source.game_type,
              // Challenges price the package directly; they carry no code.
              coupon_id: null,
              package_id: source.package_id,
              base_price: source.base_price,
              reward_type: source.reward_type,
              players_per_tier: source.players_per_tier,
              reward_per_tier: source.reward_per_tier,
              reward_per_player: source.reward_per_player,
              hits_target: source.hits_target,
              max_reward: source.max_reward,
              duration_hours: hours,
              strict_device_lock: source.strict_device_lock,
              max_plays_per_ip: source.max_plays_per_ip,
              // The clock starts with the page and the scoreboard at nothing:
              // the copy is a fresh run, not a continuation of the original.
              starts_at: startedAt.toISOString(),
              expires_at: new Date(startedAt.getTime() + hours * 3600_000).toISOString(),
              is_active: source.is_active,
              created_by: userId,
            })
            .select('*')
            .single();
          if (error) throw error;
          clonedCampaign = data as SlashCampaign;
          campaignId = clonedCampaign.id;
        }
      }

      const payload = {
        slug,
        title: p.title.trim(),

        html_content: p.html_content || '',
        meta_description: p.meta_description || null,
        package_id: p.package_id || null,
        category_id: p.category_id || null,
        coupon_id: p.coupon_id || null,
        // Visitors cannot read agent_coupons, so the packages the coupon
        // covers are resolved here and stored on the page, which is public.
        settings: { package_ids: pageScope(p).packageIds },
        show_wizard: p.show_wizard ?? true,
        show_header: p.show_header ?? true,
        show_footer: p.show_footer ?? true,
        is_published: p.is_published ?? false,
        slash_campaign_id: campaignId,
        // Digits only - the public page builds a wa.me link straight from this.
        created_by: userId,
        updated_at: new Date().toISOString(),
      };

      let savedId = p.id;

      if (p.id) {
        const { error } = await supabase
          .from('agent_landing_pages')
          .update(payload)
          .eq('id', p.id);
        if (error) throw error;
      } else {
        // Ask for the new row back so the editor can adopt its id - the dialog
        // stays open after saving, and every later click must be an update of
        // this page rather than another insert.
        const { data, error } = await supabase
          .from('agent_landing_pages')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        savedId = (data as { id: string }).id;
      }

      if (clonedCampaign) setCampaigns(prev => [...prev, clonedCampaign as SlashCampaign]);
      logActivity(supabase, wasNew ? 'create' : 'update', 'agent_landing_pages', savedId || slug, { slug });
      toast.success(wasNew ? 'Page created' : 'Page updated');
      setPageBaselineHtml(payload.html_content);
      if (wasNew) {
        setPages(prev => [...prev, { ...payload, id: savedId, created_at: new Date().toISOString(), view_count: 0 } as LandingPage]);
      } else {
        setPages(prev => prev.map(page => page.id === savedId ? { ...page, ...payload } : page));
      }
      setEditingPage(null);
    } catch (e: any) {
      const msg = e?.message?.includes('agent_landing_pages_slug_key')
        ? 'That page URL is already taken.'
        : e?.message || 'Failed to save page';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete || !supabase) return;
    try {
      if (confirmDelete.table === 'agent_coupons') {
        setCoupons(prev => prev.filter(c => c.id !== confirmDelete.id));
      } else if (confirmDelete.table === 'agent_share_links') {
        setShareLinks(prev => prev.filter(l => l.id !== confirmDelete.id));
      } else if (confirmDelete.table === 'agent_landing_pages') {
        // The page's links go with it. agent_share_links.landing_page_id is
        // ON DELETE SET NULL, so leaving them would strand a link that still
        // resolves but belongs to no page - and since links are only reachable
        // from a page's card, nothing could ever list or delete it again.
        const orphans = shareLinks.filter(l => l.landing_page_id === confirmDelete.id);
        if (orphans.length) {
          const { error: linkError } = await supabase
            .from('agent_share_links').delete().eq('landing_page_id', confirmDelete.id);
          if (linkError) throw linkError;
          setShareLinks(prev => prev.filter(l => l.landing_page_id !== confirmDelete.id));
        }
        setPages(prev => prev.filter(p => p.id !== confirmDelete.id));
      } else if (confirmDelete.table === 'slash_campaigns') {
        setCampaigns(prev => prev.filter(c => c.id !== confirmDelete.id));
      }
      const { error } = await supabase.from(confirmDelete.table).delete().eq('id', confirmDelete.id);
      if (error) throw error;
      logActivity(supabase, 'delete', confirmDelete.table, confirmDelete.id, { label: confirmDelete.label });
      toast.success('Deleted');
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
      reload();
    }
  };

  // ------------------------------------------------------------------
  // Analytics
  // ------------------------------------------------------------------
  /** Which link or page a row belongs to, per the Scope selector. */
  const inScope = useCallback((row: { share_link_id: string | null; landing_page_id: string | null }) => {
    if (analyticsScope.startsWith('link:')) return row.share_link_id === analyticsScope.slice(5);
    if (analyticsScope.startsWith('page:')) return row.landing_page_id === analyticsScope.slice(5);
    return true;
  }, [analyticsScope]);

  /**
   * Start of the window the tab is reading, or null for all time. A row
   * whose timestamp will not parse is kept rather than hidden: a filter
   * should narrow what you see, not drop rows without saying so.
   */
  const rangeStart = useMemo(() => {
    const hours = ANALYTICS_RANGES.find(r => r.key === analyticsRange)?.hours;
    return hours ? Date.now() - hours * 3600_000 : null;
  }, [analyticsRange]);

  const inRange = useCallback((ts: string | null) => {
    if (rangeStart === null) return true;
    const t = ts ? new Date(ts).getTime() : NaN;
    return Number.isNaN(t) ? true : t >= rangeStart;
  }, [rangeStart]);

  const scopedEvents = useMemo(
    () => events.filter(e => inScope(e) && inRange(e.created_at)),
    [events, inScope, inRange],
  );

  const scopedCaptures = useMemo(
    () => captures.filter(c => inScope(c) && inRange(c.updated_at)),
    [captures, inScope, inRange],
  );

  /** Names what a clear would take, for the confirm. */
  const clearScopeLabel = useMemo(() => {
    if (analyticsScope.startsWith('link:')) {
      const l = shareLinks.find(x => x.id === analyticsScope.slice(5));
      return l ? `the link "${l.label || l.token}"` : 'this link';
    }
    if (analyticsScope.startsWith('page:')) {
      const p = pages.find(x => x.id === analyticsScope.slice(5));
      return p ? `the page "${p.title}"` : 'this page';
    }
    return 'all your links and pages';
  }, [analyticsScope, shareLinks, pages]);

  /**
   * Roughly how much a clear would take. Counted from the rows already
   * loaded, which are capped, so the real delete can reach further back -
   * the confirm says as much rather than implying this is the total.
   */
  const clearPreview = useMemo(() => {
    if (!confirmClear) return { events: 0, captures: 0 };
    const cutoff = confirmClear.days === null ? null : Date.now() - confirmClear.days * 86_400_000;
    const older = (ts: string | null) => {
      if (cutoff === null) return true;
      const t = ts ? new Date(ts).getTime() : NaN;
      return !Number.isNaN(t) && t < cutoff;
    };
    return {
      events: events.filter(e => inScope(e) && older(e.created_at)).length,
      captures: captures.filter(c => inScope(c) && older(c.updated_at)).length,
    };
  }, [confirmClear, events, captures, inScope]);

  /**
   * Delete telemetry, scoped exactly the way the tab is reading it.
   *
   * The owning ids are named explicitly rather than left to RLS. The owner
   * policy on these tables also passes for is_admin(), so an admin pressing
   * "All" here would otherwise wipe every agent's rows instead of their own.
   */
  const clearAnalytics = async (opt: ClearOption) => {
    if (!supabase) return;
    setClearing(true);
    try {
      const cutoff = opt.days === null
        ? null
        : new Date(Date.now() - opt.days * 86_400_000).toISOString();

      const linkIds = shareLinks.map(l => l.id);
      const pageIds = pages.map(p => p.id);

      const wipe = async (table: string, tsCol: string) => {
        const build = () => {
          const q = supabase.from(table).delete();
          return cutoff ? q.lt(tsCol, cutoff) : q;
        };
        const runs: any[] = [];
        if (analyticsScope.startsWith('link:')) {
          runs.push(build().eq('share_link_id', analyticsScope.slice(5)));
        } else if (analyticsScope.startsWith('page:')) {
          runs.push(build().eq('landing_page_id', analyticsScope.slice(5)));
        } else {
          // A row hangs off a link OR a page, so both keys are swept - the
          // same shape the loader reads them back with.
          if (linkIds.length) runs.push(build().in('share_link_id', linkIds));
          if (pageIds.length) runs.push(build().in('landing_page_id', pageIds));
        }
        if (!runs.length) return;
        const results = await Promise.all(runs);
        const bad = results.find(r => r.error);
        if (bad) throw bad.error;
      };

      await wipe('share_link_events', 'created_at');
      await wipe('share_link_form_captures', 'updated_at');

      logActivity(supabase, 'delete', 'share_link_events', null, {
        scope: analyticsScope, older_than_days: opt.days,
      });
      toast.success(opt.days === null
        ? 'Analytics cleared'
        : `Cleared anything older than ${opt.days} days`);
      setConfirmClear(null);
      reload();
    } catch (e: any) {
      console.error('[AgentPortal] clear analytics failed', e);
      toast.error(e?.message || 'Failed to clear analytics');
    } finally {
      setClearing(false);
    }
  };

  const stats = useMemo(() => {
    const sessions = new Set(scopedEvents.map(e => e.session_id).filter(Boolean));
    const views = scopedEvents.filter(e => e.event_type === 'view').length;

    // "Did they read it?" — a session counts as read once any of its events
    // carries scrolled = true.
    const readSessions = new Set(
      scopedEvents.filter(e => e.scrolled).map(e => e.session_id).filter(Boolean),
    );

    const exits = scopedEvents.filter(e => e.event_type === 'exit');
    const avgSeconds = exits.length
      ? Math.round(exits.reduce((s, e) => s + (e.read_seconds || 0), 0) / exits.length)
      : 0;
    const avgDepth = exits.length
      ? Math.round(exits.reduce((s, e) => s + (e.scroll_depth || 0), 0) / exits.length)
      : 0;

    const paid = scopedCaptures.filter(c => c.completed).length;
    const abandoned = scopedCaptures.filter(c => !c.completed && (c.name || c.email || c.phone)).length;

    const totalClicks = analyticsScope === 'all'
      ? shareLinks.reduce((s, l) => s + (l.click_count || 0), 0)
      : analyticsScope.startsWith('link:')
        ? shareLinks.find(l => l.id === analyticsScope.slice(5))?.click_count ?? 0
        : views;

    return {
      totalClicks,
      sessions: sessions.size,
      views,
      readCount: readSessions.size,
      readRate: sessions.size ? Math.round((readSessions.size / sessions.size) * 100) : 0,
      avgSeconds,
      avgDepth,
      captures: scopedCaptures.length,
      paid,
      abandoned,
      revenue: redemptions.reduce((s, r) => s + Number(r.order_total || 0), 0),
      discountGiven: redemptions.reduce((s, r) => s + Number(r.discount_amount || 0), 0),
    };
  }, [scopedEvents, scopedCaptures, shareLinks, redemptions, analyticsScope]);

  /**
   * The same figures the Statistics tab reports, but cut per page so each one
   * can be read on its own card. A row reaches a page either by naming it, or
   * by naming a link that points at it, so both keys are folded in - counting
   * only landing_page_id would drop every visit that arrived through a link.
   */
  const pageStats = useMemo(() => {
    const linkToPage = new Map(shareLinks.map(l => [l.id, l.landing_page_id]));
    const pageOf = (row: { landing_page_id: string | null; share_link_id: string | null }) =>
      row.landing_page_id ?? (row.share_link_id ? linkToPage.get(row.share_link_id) ?? null : null);

    const blank = () => ({
      sessions: new Set<string>(), readSessions: new Set<string>(),
      views: 0, exits: 0, seconds: 0,
      leads: 0, booked: 0,
    });
    const acc = new Map<string, ReturnType<typeof blank>>();
    const bucket = (id: string) => {
      const existing = acc.get(id);
      if (existing) return existing;
      const fresh = blank();
      acc.set(id, fresh);
      return fresh;
    };

    events.forEach(e => {
      const id = pageOf(e);
      if (!id) return;
      const b = bucket(id);
      if (e.session_id) b.sessions.add(e.session_id);
      if (e.scrolled && e.session_id) b.readSessions.add(e.session_id);
      if (e.event_type === 'view') b.views += 1;
      if (e.event_type === 'exit') { b.exits += 1; b.seconds += e.read_seconds || 0; }
    });

    captures.forEach(c => {
      const id = pageOf(c);
      if (!id) return;
      const b = bucket(id);
      if (c.completed) b.booked += 1;
      else if (c.name || c.email || c.phone) b.leads += 1;
    });

    const out = new Map<string, {
      views: number; visitors: number; readRate: number;
      avgSeconds: number; leads: number; booked: number; clicks: number;
    }>();
    pages.forEach(p => {
      const b = acc.get(p.id) ?? blank();
      out.set(p.id, {
        views: b.views,
        visitors: b.sessions.size,
        readRate: b.sessions.size ? Math.round((b.readSessions.size / b.sessions.size) * 100) : 0,
        avgSeconds: b.exits ? Math.round(b.seconds / b.exits) : 0,
        leads: b.leads,
        booked: b.booked,
        clicks: shareLinks
          .filter(l => l.landing_page_id === p.id)
          .reduce((s, l) => s + (l.click_count || 0), 0),
      });
    });
    return out;
  }, [events, captures, shareLinks, pages]);

  /** Region breakdown from the IP lookup, most-visited first. */
  const regionData = useMemo(() => {
    const map = new Map<string, { name: string; sessions: Set<string>; hits: number }>();
    scopedEvents.forEach(e => {
      const parts = [e.city, e.region, e.country].filter(Boolean);
      const name = parts.length ? parts.join(', ') : 'Unknown';
      const entry = map.get(name) || { name, sessions: new Set<string>(), hits: 0 };
      entry.hits += 1;
      if (e.session_id) entry.sessions.add(e.session_id);
      map.set(name, entry);
    });
    return Array.from(map.values())
      .map(v => ({ name: v.name, visitors: v.sessions.size, hits: v.hits }))
      .sort((a, b) => b.visitors - a.visitors || b.hits - a.hits)
      .slice(0, 12);
  }, [scopedEvents]);

  const countryData = useMemo(() => {
    const map = new Map<string, number>();
    scopedEvents.forEach(e => {
      const name = e.country || 'Unknown';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [scopedEvents]);

  /** Which package the visitors clicked most. */
  const packageClickData = useMemo(() => {
    const map = new Map<string, number>();
    scopedEvents
      .filter(e => e.event_type === 'package_click')
      .forEach(e => {
        const name = e.package_name || packageName(e.package_id) || 'Unknown';
        map.set(name, (map.get(name) || 0) + 1);
      });

    // Fall back to what people actually put in the cart when nobody has
    // clicked a package card yet, so the chart is never empty for no reason.
    if (map.size === 0) {
      scopedCaptures.forEach(c => {
        (c.cart_items || []).forEach((item: any) => {
          const name = item?.name || 'Unknown';
          map.set(name, (map.get(name) || 0) + 1);
        });
      });
    }

    return Array.from(map.entries())
      .map(([name, clicks]) => ({ name, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);
  }, [scopedEvents, scopedCaptures, packageName]);

  const readData = useMemo(() => ([
    { name: 'Scrolled (read)', value: stats.readCount },
    { name: 'Did not scroll', value: Math.max(0, stats.sessions - stats.readCount) },
  ]), [stats]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#CD5C5C]" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Loading agent portal</p>
      </div>
    );
  }

  const packagesByCategory = categories
    .map(cat => ({ ...cat, items: packages.filter(p => p.category_id === cat.id) }))
    .filter(g => g.items.length > 0);

  const uncategorised = packages.filter(p => !p.category_id || !categories.some(c => c.id === p.category_id));

  return (
    <div className="space-y-3 sm:space-y-6 w-full min-w-0">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-lg font-black uppercase tracking-tight text-slate-900">Agent Portal</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Coupons, trackable share links, agent landing pages and their performance.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <p className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Your account only
            </p>
            <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {profile.name || '\u2014'}
            </div>
            <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              {profile.phone || '\u2014'}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="coupons" className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-1 rounded-2xl bg-[#0B0F19] p-1.5 h-auto ring-1 ring-white/10 shadow-lg sm:flex sm:w-auto sm:flex-wrap">
          <TabsTrigger value="coupons" className="rounded-xl text-xs font-bold gap-1 sm:gap-1.5 px-1.5 sm:px-4 py-1.5 sm:py-2 text-slate-400 hover:text-slate-200 data-[state=active]:text-slate-900">
            <Ticket className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> Coupons <TabCount n={coupons.length} />
          </TabsTrigger>
          <TabsTrigger value="redemptions" className="rounded-xl text-xs font-bold gap-1 sm:gap-1.5 px-1.5 sm:px-4 py-1.5 sm:py-2 text-slate-400 hover:text-slate-200 data-[state=active]:text-slate-900">
            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> <span className="truncate">Redemptions</span> <TabCount n={redemptions.length} />
          </TabsTrigger>
          <TabsTrigger value="slash" className="rounded-xl text-xs font-bold gap-1 sm:gap-1.5 px-1.5 sm:px-4 py-1.5 sm:py-2 text-slate-400 hover:text-slate-200 data-[state=active]:text-slate-900">
            <Gamepad2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> <span className="truncate">Price Slash</span> <TabCount n={campaigns.length} />
          </TabsTrigger>
          <TabsTrigger value="pages" className="rounded-xl text-xs font-bold gap-1 sm:gap-1.5 px-1.5 sm:px-4 py-1.5 sm:py-2 text-slate-400 hover:text-slate-200 data-[state=active]:text-slate-900">
            <FileCode className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> <span className="truncate">Landing Pages</span> <TabCount n={pages.length} />
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-xl text-xs font-bold gap-1 sm:gap-1.5 px-1.5 sm:px-4 py-1.5 sm:py-2 text-slate-400 hover:text-slate-200 data-[state=active]:text-slate-900">
            <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> Statistics
          </TabsTrigger>
        </TabsList>

        {/* ============================ COUPONS ============================ */}
        <TabsContent value="coupons" className={TAB_SHELL}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            <p className="text-xs text-slate-400 font-medium">
              {coupons.length} coupon{coupons.length === 1 ? '' : 's'} ·{' '}
              {coupons.filter(c => couponStatus(c, shareLinks).label === 'Active').length} active
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={reload} className={`gap-2 rounded-xl shrink-0 px-3 sm:px-4 ${SHELL_BTN}`}>
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              {canEdit && (
                <Button size="sm" onClick={() => setEditingCoupon(newCoupon())} className="gap-2 rounded-xl bg-[#CD5C5C] hover:bg-[#A14A4A] shrink-0 px-3 sm:px-4">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Coupon</span>
                  <span className="sm:hidden">New</span>
                </Button>
              )}
            </div>
          </div>

          {/* Phones get stacked cards - a seven-column table cannot be read on a
              360px screen, and horizontal scrolling hides the status badge. */}
          <div className="space-y-2.5 sm:hidden">
            {coupons.length === 0 && (
              <p className="text-center py-10 text-sm text-slate-400">
                No coupons yet. Create one to give an agent a discount code.
              </p>
            )}
            {coupons.map(c => {
              const st = couponStatus(c, shareLinks);
              const scope = c.package_ids?.length
                ? c.package_ids.map(id => packageName(id)).join(', ')
                : c.category_ids?.length
                  ? c.category_ids.map(id => categories.find(x => x.id === id)?.name ?? '—').join(', ')
                  : 'All packages';
              return (
                <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4 space-y-1.5 sm:space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(c.code, 'Code')}
                        className="font-mono font-black text-xs sm:text-sm text-slate-900 active:text-[#CD5C5C] truncate"
                      >
                        {c.code}
                      </button>
                      {c.agent_name && (
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider truncate">{c.agent_name}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[11px] font-bold uppercase tracking-wider shrink-0 ${st.tone}`}>
                      {st.label}
                    </Badge>
                  </div>

                  <div className="divide-y divide-slate-100 border-t border-slate-100 pt-1">
                    <Field label="Discount">
                      <span className="font-bold text-[#CD5C5C]">
                        {c.discount_type === 'percent'
                          ? `${c.discount_value}%${c.max_discount ? ` (max RM ${c.max_discount})` : ''}`
                          : `RM ${Number(c.discount_value).toFixed(2)}`}
                      </span>
                    </Field>
                    <Field label="Applies to">{scope}</Field>
                    <Field label="Expires">
                      {c.expires_at ? format(new Date(c.expires_at), 'dd MMM yyyy, h:mm a') : 'Never'}
                    </Field>
                    <Field label="Used">
                      <span className="font-bold">{c.used_count} / {c.max_uses > 0 ? c.max_uses : '∞'}</span>
                    </Field>
                  </div>

                  <div className="flex gap-1.5 sm:gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 h-8 sm:h-9 rounded-lg text-xs gap-1 sm:gap-1.5" onClick={() => setEditingCoupon(c)}>
                      <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {canEdit ? 'Edit' : 'View'}
                    </Button>
                    {canEdit && (
                      <Button
                        variant="outline" size="icon"
                        className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-lg text-red-500"
                        onClick={() => setConfirmDelete({ table: 'agent_coupons', id: c.id, label: c.code })}
                      >
                        <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden sm:block rounded-2xl border border-slate-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-[11px] uppercase tracking-widest font-bold">Code</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-widest font-bold">Discount</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-widest font-bold">Applies to</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-widest font-bold">Expires</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-widest font-bold">Used</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-widest font-bold">Status</TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-widest font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-sm text-slate-500">
                        No coupons yet. Create one to give an agent a discount code.
                      </TableCell>
                    </TableRow>
                  )}
                  {coupons.map(c => {
                    const st = couponStatus(c, shareLinks);
                    const scope = c.package_ids?.length
                      ? c.package_ids.map(id => packageName(id)).join(', ')
                      : c.category_ids?.length
                        ? c.category_ids.map(id => categories.find(x => x.id === id)?.name ?? '—').join(', ')
                        : 'All packages';
                    return (
                      <TableRow key={c.id} className="hover:bg-slate-50/60">
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(c.code, 'Code')}
                            className="font-mono font-black text-sm text-slate-900 hover:text-[#CD5C5C] transition-colors"
                            title="Copy code"
                          >
                            {c.code}
                          </button>
                          {c.agent_name && (
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{c.agent_name}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-bold text-[#CD5C5C] whitespace-nowrap">
                          {c.discount_type === 'percent'
                            ? `${c.discount_value}%${c.max_discount ? ` (max RM ${c.max_discount})` : ''}`
                            : `RM ${Number(c.discount_value).toFixed(2)}`}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 max-w-[220px] truncate" title={scope}>{scope}</TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {c.expires_at ? format(new Date(c.expires_at), 'dd MMM yyyy, h:mm a') : 'Never'}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-700 whitespace-nowrap">
                          {c.used_count} / {c.max_uses > 0 ? c.max_uses : '∞'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[11px] font-bold uppercase tracking-wider ${st.tone}`}>
                            {st.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingCoupon(c)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() => setConfirmDelete({ table: 'agent_coupons', id: c.id, label: c.code })}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ========================= REDEMPTIONS ========================= */}
        {/* Lifted out of the Coupons tab: the ledger is a different question
            - not "what am I offering?" but "what has already been spent?" -
            and it was pushing the coupon list off the screen. */}
        <TabsContent value="redemptions" className={TAB_SHELL}>
          {/* Redemption ledger — the proof a code was already used */}
          <Card className="border-slate-200 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#CD5C5C]" /> Redemptions
              </CardTitle>
              <CardDescription className="text-xs">
                Every time a coupon was accepted at payment. A code that appears here cannot be reused.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="sm:hidden max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
                {redemptions.length === 0 && (
                  <p className="text-center py-8 text-sm text-slate-500">No coupon has been redeemed yet.</p>
                )}
                {redemptions.map(r => (
                  <div key={r.id} className="p-4 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {coupons.find(c => c.id === r.coupon_id)?.code ?? '—'}
                      </span>
                      <span className="text-xs font-bold text-[#CD5C5C] shrink-0">
                        − RM {Number(r.discount_amount).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 truncate">{r.customer_name || '—'}</p>
                    <p className="text-xs text-slate-500 truncate">{r.customer_email || r.customer_phone || ''}</p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-xs text-slate-600">Order RM {Number(r.order_total).toFixed(2)}</span>
                      <span className="text-xs text-slate-500">
                        {format(new Date(r.redeemed_at), 'dd MMM yyyy, h:mm a')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block overflow-x-auto max-h-[70vh] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">Code</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">Customer</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">Discount</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">Order</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-sm text-slate-500">
                          No coupon has been redeemed yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {redemptions.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs font-bold">
                          {coupons.find(c => c.id === r.coupon_id)?.code ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-bold text-slate-800">{r.customer_name || '—'}</span>
                          <span className="block text-slate-500">{r.customer_email || r.customer_phone || ''}</span>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-[#CD5C5C]">
                          RM {Number(r.discount_amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs">RM {Number(r.order_total).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {format(new Date(r.redeemed_at), 'dd MMM yyyy, h:mm a')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================= PRICE SLASH ======================= */}
        {/* Dark shell so the white challenge panels read as lit cards against
            it. Only the chrome around them is restyled - the panels keep the
            colours they have everywhere else. */}
        <TabsContent value="slash" className={TAB_SHELL}>
          {/* ================= PRICE SLASH CHALLENGES ================= */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-white">
                  <Gamepad2 className="h-4 w-4 text-[#E88A8A]" />
                  Price Slash Challenges
                </h3>
                <p className="mt-0.5 text-xs font-medium text-slate-400">
                  {campaigns.length} challenge{campaigns.length === 1 ? '' : 's'} ·{' '}
                  {campaigns.filter(c => c.is_active && new Date(c.expires_at) > new Date()).length} running
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm" onClick={reload}
                  className="shrink-0 gap-2 rounded-xl border-white/20 bg-white/5 px-3 text-slate-200 hover:bg-white/10 hover:text-white sm:px-4"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                {canEdit && (
                  <Button
                    size="sm"
                    onClick={() => setEditingCampaign(newCampaign())}
                    className="shrink-0 gap-2 rounded-xl bg-[#CD5C5C] px-3 text-white hover:bg-[#B84F4F] sm:px-4"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">New Challenge</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                )}
              </div>
            </div>

            <p className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-slate-500">
              Set up the game and its terms here, then switch it on for a page in
              <strong className="font-bold text-slate-200"> Landing Pages → Edit → Price slash game</strong>.
              Visitors get one round each to cut the price, every set number of players unlocks a
              further drop for everyone, and the challenge rewrites its coupon's value as it runs.
            </p>

            {campaigns.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No challenges yet. Create one, then choose it on a landing page.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {campaigns.map(c => {
                  const game = SLASH_GAMES.find(g => g.id === c.game_type);
                  const live = c.is_active && new Date(c.expires_at) > new Date();
                  const done = c.player_count % c.players_per_tier;
                  const toNext = c.players_per_tier - done;
                  const coupon = coupons.find(x => x.id === c.coupon_id);
                  // The association lives on the page now, so this is a
                  // reverse lookup: which pages have chosen this game.
                  const hostPages = pages.filter(p => p.slash_campaign_id === c.id);
                  const unit = (v: number) =>
                    c.reward_type === 'percent' ? `${Number(v).toFixed(0)}%` : `RM ${Number(v).toFixed(2)}`;

                  return (
                    <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#CD5C5C]">
                            <span>{game?.icon}</span> {game?.name}
                          </p>
                          <p className="truncate text-sm font-black text-slate-900">{c.title}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCampaign(c)}
                          disabled={!canEdit}
                          className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                            canEdit ? 'cursor-pointer hover:shadow-md active:scale-95' : 'cursor-not-allowed'
                          } ${live
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                            : 'border-slate-200 bg-slate-100 text-slate-500'}`}
                        >
                          {live ? 'Running' : c.is_active ? 'Ended' : 'Stopped'}
                        </button>
                      </div>

                      {c.goal_text && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-slate-500">{c.goal_text}</p>
                      )}

                      <div className="mt-3 flex items-center gap-1.5 text-xs">
                        <Timer className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        <SlashCountdown expiresAt={c.expires_at} />
                        <span className="text-slate-500">left of {c.duration_hours}h</span>
                      </div>

                      {/* The window the run below belongs to, both ends of it. A
                          challenge starts its clock when it is created, editing one
                          leaves that alone, and a reset moves it to the moment of
                          the reset - so starts_at says which run the players and the
                          discount underneath were earned in, and expires_at says when
                          that run stops. The countdown above gives the same end as a
                          duration; this gives the date, which is what you need to
                          answer "is it still on tomorrow?". */}
                      <p className="mt-2 flex items-start gap-2 text-sm font-semibold leading-snug text-indigo-700">
                        <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          {new Date(c.starts_at) > new Date() ? 'Starts ' : 'Running since '}
                          {format(new Date(c.starts_at), 'dd MMM yyyy, h:mm a')}
                          {' until '}
                          {format(new Date(c.expires_at), 'dd MMM yyyy, h:mm a')}
                        </span>
                      </p>

                      <div className="mt-2.5">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <span>{toNext} more to next drop</span>
                          <span className="tabular-nums">{done}/{c.players_per_tier}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#CD5C5C] to-amber-400"
                            style={{ width: `${Math.max(3, (done / c.players_per_tier) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Players</p>
                          <p className="flex items-center gap-1 text-xs font-black text-slate-900">
                            <Users className="h-3 w-3" />{c.player_count}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Cut so far</p>
                          <p className="text-xs font-black text-[#CD5C5C]">{unit(c.current_reward)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Ceiling</p>
                          <p className="text-xs font-black text-slate-500">{unit(c.max_reward)}</p>
                        </div>
                      </div>

                      <div className="mt-2.5 space-y-0.5 border-t border-slate-100 pt-2 text-xs text-slate-500">
                        {coupon && (
                          <p className="truncate">
                            Feeds coupon <span className="font-mono font-bold text-slate-600">{coupon.code}</span>
                          </p>
                        )}
                        <p className="truncate">
                          {hostPages.length === 0
                            ? 'Not on any page yet — pick it in a landing page'
                            : `On ${hostPages.map(p => `/p/${p.slug}`).join(', ')}`}
                        </p>
                      </div>

                      {canEdit && (
                        <div className="mt-3 flex items-center gap-1">
                          <Button
                            variant="outline" size="sm"
                            className="h-8 flex-1 gap-1.5 rounded-lg border-amber-200 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                            onClick={() => setConfirmReset(c)}
                          >
                            <RotateCcw className="h-3 w-3" /> Reset
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            className="h-8 flex-1 gap-1.5 rounded-lg text-xs"
                            onClick={() => setEditingCampaign(c)}
                          >
                            <Code className="h-3 w-3" /> Edit
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => setConfirmDelete({ table: 'slash_campaigns', id: c.id, label: c.title })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========================= LANDING PAGES ========================= */}
        <TabsContent value="pages" className={TAB_SHELL}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            <p className="text-xs text-slate-400 font-medium">
              {pages.length} page{pages.length === 1 ? '' : 's'} ·{' '}
              {pages.filter(p => p.is_published).length} published
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={reload} className={`gap-2 rounded-xl shrink-0 px-3 sm:px-4 ${SHELL_BTN}`}>
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              {canEdit && (
                <Button size="sm" onClick={() => openPage(newPage())} className="gap-2 rounded-xl bg-[#CD5C5C] hover:bg-[#A14A4A] shrink-0 px-3 sm:px-4">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Page</span>
                  <span className="sm:hidden">New</span>
                </Button>
              )}
            </div>
          </div>

          {/* One page per row rather than a grid of tiles: each row carries its
              own results and its game's progress, which need the full width. */}
          <div className="space-y-3">
            {pages.length === 0 && (
              <p className="text-sm text-slate-400 col-span-full text-center py-10">
                No landing pages yet. Build one with the same editor used for document templates.
              </p>
            )}
            {pages.map(p => {
              const pageLinks = shareLinks.filter(l => l.landing_page_id === p.id);
              const s = pageStats.get(p.id);
              const campaign = campaigns.find(c => c.id === p.slash_campaign_id) || null;
              return (
                <Card key={p.id} className="border-slate-200 rounded-2xl hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-black text-slate-900 leading-tight">{p.title}</CardTitle>
                      {/* Publish state and delete sit together: both act on the
                          page as a whole, unlike the row of buttons below which
                          act on its content. */}
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!canEdit || !supabase) return;
                            setSaving(true);
                            try {
                              const newPublishedState = !p.is_published;
                              setPages(prev => prev.map(page =>
                                page.id === p.id ? { ...page, is_published: newPublishedState } : page
                              ));
                              const { error } = await supabase
                                .from('agent_landing_pages')
                                .update({ is_published: newPublishedState })
                                .eq('id', p.id);
                              if (error) throw error;
                              toast.success(newPublishedState ? 'Page published' : 'Page unpublished');
                              logActivity(supabase, 'update', 'agent_landing_pages', p.id, { is_published: newPublishedState });
                            } catch (e: any) {
                              toast.error(e?.message || 'Failed to update page');
                              setPages(prev => prev.map(page =>
                                page.id === p.id ? { ...page, is_published: p.is_published } : page
                              ));
                            } finally {
                              setSaving(false);
                            }
                          }}
                          disabled={!canEdit || saving}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase shrink-0 transition-all ${
                            canEdit ? 'cursor-pointer hover:shadow-md active:scale-95' : 'cursor-not-allowed'
                          } ${p.is_published
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'}`}
                        >
                          {p.is_published ? 'Live' : 'Draft'}
                        </button>
                        {canEdit && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600"
                            title="Delete this page"
                            onClick={() => setConfirmDelete({ table: 'agent_landing_pages', id: p.id, label: p.title })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-xs font-mono truncate">/p/{p.slug}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* The game and the link count used to be badges here. Both
                        now have a panel of their own below saying more, so the
                        badges only repeated them. */}
                    {p.show_wizard && (
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <Badge variant="secondary" className="text-xs">Packages</Badge>
                      </div>
                    )}

                    {/* What the page actually did. Same definitions as the
                        Statistics tab, so the two can never disagree. */}
                    <div className="grid grid-cols-4 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:grid-cols-7">
                      <Stat label="Views" value={s?.views ?? 0} />
                      <Stat label="Visitors" value={s?.visitors ?? 0} />
                      <Stat label="Read" value={s?.visitors ? `${s.readRate}%` : '—'} />
                      <Stat label="Avg time" value={readableSeconds(s?.avgSeconds ?? 0)} />
                      <Stat label="Enquiries" value={s?.leads ?? 0}
                        tone={s?.leads ? 'text-amber-600' : undefined} />
                      <Stat label="Booked" value={s?.booked ?? 0}
                        tone={s?.booked ? 'text-emerald-600' : undefined} />
                      <Stat label="Link clicks" value={s?.clicks ?? 0} />
                    </div>

                    {/* The challenge's own progress, for pages running one. The
                        numbers live on the campaign, so a page sharing a
                        campaign with another page shows the same figures. */}
                    {campaign && (() => {
                      const g = SLASH_GAMES.find(x => x.id === campaign.game_type);
                      const unit = (v: number) => campaign.reward_type === 'percent'
                        ? `${Number(v).toFixed(0)}%`
                        : `RM ${Number(v).toFixed(2)}`;
                      const running = campaign.is_active && new Date(campaign.expires_at) > new Date();
                      return (
                        <div className="rounded-xl border border-[#CD5C5C]/20 bg-[#CD5C5C]/5 px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#CD5C5C]">
                              <span>{g?.icon}</span> {g?.name}
                            </p>
                            <Badge variant="outline" className={`text-[11px] font-bold uppercase ${
                              running
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                                : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                              {running ? 'Running' : 'Stopped'}
                            </Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-4 gap-3">
                            <Stat label="Players" value={campaign.player_count} />
                            <Stat label="Drops" value={campaign.tiers_unlocked} />
                            <Stat label="Price cut" value={unit(campaign.current_reward)}
                              tone={campaign.current_reward ? 'text-[#CD5C5C]' : undefined} />
                            <Stat label="Ends" value={
                              <span className="text-xs">{format(new Date(campaign.expires_at), 'dd MMM, h:mm a')}</span>
                            } />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Share links now live here and nowhere else. A page is
                        reachable at its own /p/slug without one; a link is only
                        for attributing traffic to a particular agent or blast. */}
                    <div className="space-y-2 border-t border-slate-100 pt-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Share link</p>
                        {/* One is enough: the link exists to attribute this
                            page's traffic, and a second would only split the
                            same page's numbers across two rows. Any extras that
                            already exist are still listed and still deletable. */}
                        {canEdit && pageLinks.length === 0 && (
                          <button
                            type="button"
                            onClick={() => setEditingLink({ ...newShareLink(), ...fromLandingPage(p) })}
                            className="flex items-center gap-1 text-xs font-bold text-[#CD5C5C] hover:underline"
                          >
                            <Plus className="h-3 w-3" /> Create
                          </button>
                        )}
                      </div>

                      {pageLinks.length === 0 ? (
                        <p className="text-xs font-medium text-slate-500">
                          None yet. The page already works at /p/{p.slug} — a link only adds
                          tracking on top.
                        </p>
                      ) : pageLinks.map(l => {
                        const url = buildShareLinkUrl(l.token);
                        const left = getRemainingTime(l.expires_at);
                        return (
                          <div key={l.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => copyToClipboard(url)}
                                title="Copy this link"
                                className="min-w-0 flex-1 truncate text-left font-mono text-xs font-semibold text-slate-600 hover:text-[#CD5C5C]"
                              >
                                {url}
                              </button>
                              <Badge variant="outline" className={`shrink-0 text-[11px] font-bold uppercase ${linkStatus(l).tone}`}>
                                {linkStatus(l).label}
                              </Badge>
                            </div>

                            <div className="flex items-end justify-between gap-3">
                              {/* The link's own counters, which the page-level
                                  strip above cannot show: those count every
                                  visit, these only the ones through this link. */}
                              <div className="flex gap-5">
                                <Stat label="Clicks" value={l.click_count} />
                                <Stat label="Visitors" value={l.unique_visitors} />
                                <Stat
                                  label={left ? 'Time left' : 'Runs'}
                                  value={<span className="text-xs">{left || 'No end date'}</span>}
                                  tone={left ? 'text-indigo-700' : 'text-slate-500'}
                                />
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Copy link" onClick={() => copyToClipboard(url)}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="QR code" onClick={() => setQrLink(l)}>
                                  <QrCode className="h-3.5 w-3.5" />
                                </Button>
                                {canEdit && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit link" onClick={() => setEditingLink(l)}>
                                      <FileCode className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="icon"
                                      className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600"
                                      title="Delete this share link"
                                      onClick={() => setConfirmDelete({ table: 'agent_share_links', id: l.id, label: l.token })}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs rounded-lg gap-1.5" onClick={() => openPage(p)}>
                        <FileCode className="w-3 h-3" /> Edit
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview" asChild>
                        <a href={`${buildLandingPageUrl(p.slug)}?preview=1`} target="_blank" rel="noreferrer">
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* =========================== ANALYTICS =========================== */}
        <TabsContent value="analytics" className={TAB_SHELL}>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Scope</Label>
            <Select value={analyticsScope} onValueChange={setAnalyticsScope}>
              <SelectTrigger className="w-full sm:w-[280px] h-9 rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everything</SelectItem>
                {shareLinks.map(l => (
                  <SelectItem key={l.id} value={`link:${l.id}`}>Link · {l.label || l.token}</SelectItem>
                ))}
                {pages.map(p => (
                  <SelectItem key={p.id} value={`page:${p.id}`}>Page · {p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={reload} className={`gap-2 rounded-xl shrink-0 px-3 sm:px-4 sm:ml-auto ${SHELL_BTN}`}>
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>

          {/* Both rows act on the Scope above: a page picked there is the
              page being read and the page being cleared, and the confirm
              names it either way. */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <Label className="mr-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Show</Label>
              {ANALYTICS_RANGES.map(r => (
                <Button
                  key={r.key}
                  size="sm"
                  variant={analyticsRange === r.key ? 'default' : 'outline'}
                  onClick={() => setAnalyticsRange(r.key)}
                  className={`h-8 rounded-xl px-2.5 text-xs font-bold ${
                    analyticsRange === r.key ? '' : SHELL_BTN}`}
                >
                  {r.label}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Label className="mr-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Clear</Label>
              {CLEAR_OPTIONS.map(o => (
                <Button
                  key={o.key}
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmClear(o)}
                  className="h-8 gap-1 rounded-xl border-red-400/40 bg-red-500/10 px-2.5 text-xs font-bold text-red-300 hover:bg-red-500/20 hover:text-red-200"
                >
                  <Trash2 className="h-3 w-3" /> {o.short}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Link Clicks" value={stats.totalClicks} sub={`${stats.sessions} unique sessions`} icon={MousePointerClick} />
            <StatCard label="Read It" value={`${stats.readRate}%`} sub={`${stats.readCount} of ${stats.sessions} scrolled`} icon={ScrollText} />
            <StatCard label="Avg Dwell" value={`${stats.avgSeconds}s`} sub={`${stats.avgDepth}% average scroll depth`} icon={Eye} />
            <StatCard label="Form Fills" value={stats.captures} sub={`${stats.paid} paid · ${stats.abandoned} abandoned`} icon={ClipboardList} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-slate-200 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#CD5C5C]" /> Most-clicked packages
                </CardTitle>
                <CardDescription className="text-xs">Which package the visitors opened the most.</CardDescription>
              </CardHeader>
              <CardContent className="h-[260px] sm:h-[300px] px-2 sm:px-6">
                {packageClickData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500">No package clicks yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={packageClickData} layout="vertical" margin={{ left: 4, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: isMobile ? 9 : 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={isMobile ? 84 : 130}
                        tick={{ fontSize: isMobile ? 9 : 10 }}
                      />
                      <RTooltip />
                      <Bar dataKey="clicks" fill="#CD5C5C" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-[#CD5C5C]" /> Did they read it?
                </CardTitle>
                <CardDescription className="text-xs">
                  A session counts as read once the visitor scrolls past a quarter of the page.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[260px] sm:h-[300px] px-2 sm:px-6">
                {stats.sessions === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500">No visits yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      {/* Slice labels collide on a narrow screen, so the legend
                          carries the names there instead. */}
                      <Pie
                        data={readData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%"
                        outerRadius={isMobile ? 62 : 90}
                        label={!isMobile}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#e2e8f0" />
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 11 }} />
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-slate-200 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#CD5C5C]" /> Where they opened it
                </CardTitle>
                <CardDescription className="text-xs">Derived from the visitor's IP address.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[300px] overflow-y-auto overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        <TableHead className="text-[11px] uppercase tracking-widest font-bold">Location</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-widest font-bold text-right">Visitors</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-widest font-bold text-right">Events</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regionData.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-sm text-slate-500">No visits yet</TableCell></TableRow>
                      )}
                      {regionData.map(r => (
                        <TableRow key={r.name}>
                          <TableCell className="text-xs font-medium text-slate-700">{r.name}</TableCell>
                          <TableCell className="text-xs font-bold text-right">{r.visitors}</TableCell>
                          <TableCell className="text-xs text-slate-500 text-right">{r.hits}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#CD5C5C]" /> By country
                </CardTitle>
                <CardDescription className="text-xs">Share of traffic per country.</CardDescription>
              </CardHeader>
              <CardContent className="h-[260px] sm:h-[300px] px-2 sm:px-6">
                {countryData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500">No visits yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={countryData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%"
                        outerRadius={isMobile ? 62 : 90}
                        label={!isMobile}
                      >
                        {countryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 11 }} />
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Form captures — including the ones who never paid */}
          <Card className="border-slate-200 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#CD5C5C]" /> What visitors filled in
              </CardTitle>
              <CardDescription className="text-xs">
                Captured as they type, whether or not they went through with the payment.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="sm:hidden max-h-[460px] overflow-y-auto divide-y divide-slate-100">
                {scopedCaptures.length === 0 && (
                  <p className="text-center py-10 text-sm text-slate-500">Nothing captured yet.</p>
                )}
                {scopedCaptures.map(c => (
                  <div key={c.id} className={`p-4 space-y-1.5 ${c.completed ? '' : 'bg-amber-50/40'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate min-w-0">{c.name || 'Anonymous'}</p>
                      <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider">
                        {c.completed
                          ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> <span className="text-emerald-600">Paid</span></>
                          : <><XCircle className="w-3.5 h-3.5 text-slate-300" /> <span className="text-slate-500">Unpaid</span></>}
                      </span>
                    </div>

                    {(c.email || c.phone) && (
                      <p className="text-xs text-slate-500 truncate">
                        {[c.email, c.phone].filter(Boolean).join(' · ')}
                      </p>
                    )}

                    <div className="divide-y divide-slate-100 border-t border-slate-100 pt-1">
                      <Field label="Flight">
                        {c.selected_date ? format(new Date(c.selected_date), 'dd MMM yyyy') : '—'}
                        {c.selected_time ? ` · ${c.selected_time}` : ''}
                      </Field>
                      <Field label="Cart">
                        {(c.cart_items || []).map((i: any) => i?.name).filter(Boolean).join(', ') || '—'}
                      </Field>
                      {c.cart_total > 0 && (
                        <Field label="Total">
                          <span className="font-bold text-[#CD5C5C]">RM {Number(c.cart_total).toFixed(2)}</span>
                        </Field>
                      )}
                      {c.coupon_code && (
                        <Field label="Coupon"><span className="font-mono">{c.coupon_code}</span></Field>
                      )}
                      <Field label="Location">
                        {[c.city, c.region, c.country].filter(Boolean).join(', ') || '—'}
                      </Field>
                      <Field label="Reached">{c.step_reached || `Step ${c.furthest_step}`}</Field>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block overflow-x-auto max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">Name</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">Contact</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">Flight</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">Cart</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">Coupon</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">Location</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">Reached</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-bold">Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedCaptures.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-sm text-slate-500">
                          Nothing captured yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {scopedCaptures.map(c => (
                      <TableRow key={c.id} className={c.completed ? '' : 'bg-amber-50/40'}>
                        <TableCell className="text-xs font-bold text-slate-800">{c.name || '—'}</TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {c.email && <span className="block">{c.email}</span>}
                          {c.phone && <span className="block text-slate-500">{c.phone}</span>}
                          {!c.email && !c.phone && '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {c.selected_date ? format(new Date(c.selected_date), 'dd MMM yyyy') : '—'}
                          {c.selected_time ? ` · ${c.selected_time}` : ''}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 max-w-[200px]">
                          <span className="block truncate" title={(c.cart_items || []).map((i: any) => i?.name).join(', ')}>
                            {(c.cart_items || []).map((i: any) => i?.name).filter(Boolean).join(', ') || '—'}
                          </span>
                          {c.cart_total > 0 && (
                            <span className="text-xs font-bold text-[#CD5C5C]">RM {Number(c.cart_total).toFixed(2)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{c.coupon_code || '—'}</TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {[c.city, c.region, c.country].filter(Boolean).join(', ') || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {c.step_reached || `Step ${c.furthest_step}`}
                        </TableCell>
                        <TableCell>
                          {c.completed
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            : <XCircle className="w-4 h-4 text-slate-300" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ======================= COUPON EDITOR DIALOG ======================= */}
      <Dialog open={!!editingCoupon} onOpenChange={(o) => !o && setEditingCoupon(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-tight">
              {editingCoupon?.id ? 'Edit coupon' : 'New coupon'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              The discount is applied on the payment step and the code is burned once the booking is created.
            </DialogDescription>
          </DialogHeader>

          {editingCoupon && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editingCoupon.code || ''}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, code: e.target.value.toUpperCase() })}
                      className="font-mono font-bold rounded-xl"
                      disabled={!canEdit}
                    />
                    {canEdit && (
                      <Button
                        type="button" variant="outline" size="icon"
                        className="rounded-xl shrink-0"
                        title="Generate a code"
                        onClick={() => setEditingCoupon({ ...editingCoupon, code: randomCouponCode() })}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Description</Label>
                <Textarea
                  value={editingCoupon.description || ''}
                  onChange={(e) => setEditingCoupon({ ...editingCoupon, description: e.target.value })}
                  placeholder="Shown to staff only"
                  className="rounded-xl min-h-[60px]" disabled={!canEdit}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Type</Label>
                  <Select
                    value={editingCoupon.discount_type || 'fixed'}
                    onValueChange={(v) => setEditingCoupon({ ...editingCoupon, discount_type: v as 'fixed' | 'percent' })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed (RM)</SelectItem>
                      <SelectItem value="percent">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    {editingCoupon.discount_type === 'percent' ? 'Percent off' : 'Amount off (RM)'}
                  </Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={editingCoupon.discount_value ?? ''}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, discount_value: Number(e.target.value) })}
                    className="rounded-xl" disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    {editingCoupon.discount_type === 'percent' ? 'Max discount (RM)' : 'Min spend (RM)'}
                  </Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={(editingCoupon.discount_type === 'percent'
                      ? editingCoupon.max_discount
                      : editingCoupon.min_spend) ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      setEditingCoupon(editingCoupon.discount_type === 'percent'
                        ? { ...editingCoupon, max_discount: v }
                        : { ...editingCoupon, min_spend: v ?? 0 });
                    }}
                    placeholder="Optional"
                    className="rounded-xl" disabled={!canEdit}
                  />
                </div>
              </div>

              {/* The window lives on the coupon itself. It used to be borrowed
                  from whichever share link carried the code, which left a coupon
                  with no link unschedulable - and now that pages carry coupons
                  directly, there is nowhere else for these dates to live. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Starts <span className="normal-case tracking-normal font-medium text-slate-500">(blank = now)</span>
                  </Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInput(editingCoupon.starts_at ?? null)}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, starts_at: fromLocalInput(e.target.value) })}
                    className="rounded-xl" disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Expires <span className="normal-case tracking-normal font-medium text-slate-500">(blank = never)</span>
                  </Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInput(editingCoupon.expires_at ?? null)}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, expires_at: fromLocalInput(e.target.value) })}
                    className="rounded-xl" disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Max uses <span className="normal-case tracking-normal font-medium text-slate-500">(0 = unlimited)</span>
                  </Label>
                  <Input
                    type="number" min={0}
                    value={editingCoupon.max_uses ?? 1}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, max_uses: Number(e.target.value) })}
                    className="rounded-xl" disabled={!canEdit}
                  />
                  {typeof editingCoupon.used_count === 'number' && (
                    <p className="text-xs text-slate-500 font-medium">
                      Used {editingCoupon.used_count} time{editingCoupon.used_count === 1 ? '' : 's'} so far.
                    </p>
                  )}
                </div>
                <div className="space-y-3 pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                    <Label className="text-xs font-bold text-slate-700">One use per customer</Label>
                    <Switch
                      checked={editingCoupon.once_per_customer ?? true}
                      onCheckedChange={(v) => setEditingCoupon({ ...editingCoupon, once_per_customer: v })}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                    <Label className="text-xs font-bold text-slate-700">Active</Label>
                    <Switch
                      checked={editingCoupon.is_active ?? true}
                      onCheckedChange={(v) => setEditingCoupon({ ...editingCoupon, is_active: v })}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  Applies to these packages
                </Label>
                <p className="text-xs text-slate-500 font-medium">
                  Leave everything unticked to let the coupon work on any package.
                </p>
                <ScrollArea className="h-[200px] rounded-xl border border-slate-200 p-3">
                  <div className="space-y-3">
                    {packagesByCategory.map(group => (
                      <div key={group.id} className="space-y-1.5">
                        <p className="text-[11px] font-black uppercase tracking-widest text-[#CD5C5C]">{group.name}</p>
                        {group.items.map(p => (
                          <label key={p.id} className="flex items-center gap-2.5 pl-1 cursor-pointer">
                            <Checkbox
                              checked={(editingCoupon.package_ids || []).includes(p.id)}
                              disabled={!canEdit}
                              onCheckedChange={(checked) => {
                                const cur = editingCoupon.package_ids || [];
                                setEditingCoupon({
                                  ...editingCoupon,
                                  package_ids: checked ? [...cur, p.id] : cur.filter(x => x !== p.id),
                                });
                              }}
                            />
                            <span className="text-xs text-slate-700">
                              {p.name}
                              <span className="text-slate-500 ml-1.5">RM {Number(p.price).toFixed(0)}</span>
                              {p.sort_order > 0 && <span className="text-slate-300 ml-1.5">(add-on)</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    ))}
                    {uncategorised.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Uncategorised</p>
                        {uncategorised.map(p => (
                          <label key={p.id} className="flex items-center gap-2.5 pl-1 cursor-pointer">
                            <Checkbox
                              checked={(editingCoupon.package_ids || []).includes(p.id)}
                              disabled={!canEdit}
                              onCheckedChange={(checked) => {
                                const cur = editingCoupon.package_ids || [];
                                setEditingCoupon({
                                  ...editingCoupon,
                                  package_ids: checked ? [...cur, p.id] : cur.filter(x => x !== p.id),
                                });
                              }}
                            />
                            <span className="text-xs text-slate-700">{p.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {canEdit && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => setEditingCoupon(null)}>Cancel</Button>
                  <Button onClick={saveCoupon} disabled={saving} className="rounded-xl bg-[#CD5C5C] hover:bg-[#A14A4A] gap-2">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {editingCoupon.id ? 'Update coupon' : 'Save coupon'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== SLASH CHALLENGE EDITOR DIALOG ==================== */}
      <Dialog open={!!editingCampaign} onOpenChange={(o) => !o && setEditingCampaign(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl p-4 sm:rounded-3xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-tight">
              {editingCampaign?.id ? 'Edit challenge' : 'New challenge'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Every visitor gets one round. Their score plus the group's headcount decide how far
              the price falls, and the countdown ends the whole thing.
            </DialogDescription>
          </DialogHeader>

          {editingCampaign && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Title</Label>
                <Input
                  value={editingCampaign.title || ''}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, title: e.target.value })}
                  placeholder="Slash the Discovery Flight"
                  className="rounded-xl" disabled={!canEdit}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  The goal, in your words
                </Label>
                <Textarea
                  value={editingCampaign.goal_text || ''}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, goal_text: e.target.value })}
                  placeholder="Get 10 friends to play and we take RM 50 off for everyone. Ends in 48 hours."
                  className="min-h-[60px] rounded-xl" disabled={!canEdit}
                />
                <p className="text-xs font-medium text-slate-500">
                  Shown at the top of the game so nobody has to guess what the task is.
                </p>
              </div>

              {/* --- game picker --- */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Game</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {SLASH_GAMES.map(g => {
                    const active = (editingCampaign.game_type || 'slash') === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setEditingCampaign({ ...editingCampaign, game_type: g.id })}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          active
                            ? 'border-[#CD5C5C] bg-[#CD5C5C]/5 shadow-sm ring-1 ring-[#CD5C5C]/30'
                            : 'border-slate-200 hover:border-slate-300'
                        } ${canEdit ? '' : 'cursor-not-allowed opacity-60'}`}
                      >
                        <span className="text-lg">{g.icon}</span>
                        <p className={`mt-1 text-xs font-black uppercase tracking-tight ${active ? 'text-[#CD5C5C]' : 'text-slate-900'}`}>
                          {g.name}
                        </p>
                        <p className="mt-0.5 text-xs leading-snug text-slate-500">{g.blurb}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* --- where the price comes from --- */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  Discount
                </Label>
                <p className="rounded-lg bg-emerald-50 p-2 text-xs leading-snug text-emerald-700">
                  No coupon needed. The game sets the package price directly — the cards, the
                  cart and the amount charged all follow whatever price the players reach.
                </p>
              </div>

              {/* --- the price on show --- */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Package shown</Label>
                  <Select
                    value={editingCampaign.package_id || 'none'}
                    onValueChange={(v) => {
                      const pkg = packages.find(p => p.id === v);
                      setEditingCampaign({
                        ...editingCampaign,
                        package_id: v === 'none' ? null : v,
                        // The headline price follows the package unless it is typed over.
                        base_price: pkg ? Number(pkg.price) : editingCampaign.base_price,
                      });
                    }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {packagesByCategory.map(group => (
                        <div key={group.id}>
                          <p className="px-2 py-1.5 text-[11px] font-black uppercase tracking-widest text-[#CD5C5C]">{group.name}</p>
                          {group.items.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Headline price (RM)
                  </Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={editingCampaign.base_price ?? 0}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, base_price: Number(e.target.value) })}
                    className="rounded-xl" disabled={!canEdit}
                  />
                  <p className="text-xs font-medium text-slate-500">The number the game visibly slices.</p>
                </div>
              </div>

              {/* --- the terms --- */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-[#CD5C5C]" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">How the price falls</p>
                </div>

                <div className="space-y-1.5">
                  <HintLabel
                    text="Discount is measured in"
                    hint="The unit for every number below. Ringgit takes a flat amount off; percent takes a share of the package price, and is capped at 100% however high you set the ceiling."
                  />
                  <Select
                    value={editingCampaign.reward_type || 'fixed'}
                    onValueChange={(v) => setEditingCampaign({ ...editingCampaign, reward_type: v as 'fixed' | 'percent' })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Ringgit (RM)</SelectItem>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <HintLabel
                      text="Players per drop"
                      hint="How many finished rounds it takes to unlock one drop for everybody. Drops are counted off the running total, so a new one lands each time the player count passes another multiple of this. Set it to 1 and every single player unlocks a drop."
                    />
                    <Input
                      type="number" min={1}
                      value={editingCampaign.players_per_tier ?? 10}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, players_per_tier: Number(e.target.value) })}
                      className="rounded-xl" disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <HintLabel
                      text="Each drop is worth"
                      hint="What one unlocked drop takes off the price. This is the group half of the discount, and it adds on top of what players earn from their own rounds — the two stack."
                    />
                    <Input
                      type="number" min={0} step="0.01"
                      value={editingCampaign.reward_per_tier ?? 0}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, reward_per_tier: Number(e.target.value) })}
                      className="rounded-xl" disabled={!canEdit}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <HintLabel
                      text="A perfect round is worth"
                      hint="The most one player's own round can add. They only get the full amount for a perfect round; land half the hits and they add half of this. Every player's share is kept and counted, so this accumulates across everyone who plays."
                    />
                    <Input
                      type="number" min={0} step="0.01"
                      value={editingCampaign.reward_per_player ?? 0}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, reward_per_player: Number(e.target.value) })}
                      className="rounded-xl" disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <HintLabel
                      text="Hits for a perfect round"
                      hint="The score that counts as perfect. A player adds hits ÷ this share of the amount on the left, so raising it makes a full share harder to earn. Hits beyond it are ignored, never extra."
                    />
                    <Input
                      type="number" min={1}
                      value={editingCampaign.hits_target ?? 20}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, hits_target: Number(e.target.value) })}
                      className="rounded-xl" disabled={!canEdit}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <HintLabel
                    text="Never cut more than"
                    hint="The ceiling on the whole discount — every player's round and every group drop added together. Leave it at 0 for no ceiling at all, which lets the price keep falling as long as people keep playing."
                  />
                  <Input
                    type="number" min={0} step="0.01"
                    value={editingCampaign.max_reward ?? 0}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, max_reward: Number(e.target.value) })}
                    className="rounded-xl" disabled={!canEdit}
                  />
                  <p className="text-xs font-medium text-slate-500">
                    The hard ceiling. The campaign stops discounting here however many people play.
                  </p>
                </div>
              </div>

              {/* --- one turn per device --- */}
              <div className="space-y-4 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-[#CD5C5C]" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                    One turn per device
                  </p>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Label className="text-xs font-bold text-slate-700">Lock across browsers</Label>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">
                      Stops the same phone or laptop playing again in a different browser, by
                      matching its hardware profile against the network it is on.
                    </p>
                  </div>
                  <Switch
                    checked={editingCampaign.strict_device_lock ?? true}
                    onCheckedChange={(v) => setEditingCampaign({ ...editingCampaign, strict_device_lock: v })}
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Max turns from one network (0 = no limit)
                  </Label>
                  <Input
                    type="number" min={0}
                    value={editingCampaign.max_plays_per_ip ?? 3}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, max_plays_per_ip: Number(e.target.value) })}
                    className="rounded-xl" disabled={!canEdit}
                  />
                  <p className="text-xs font-medium leading-snug text-slate-500">
                    The last line of defence, for someone who clears everything and switches
                    browser. Keep it above 1: a household, an office or a mobile carrier can put
                    many genuine players behind one address.
                  </p>
                </div>

                <p className="rounded-lg bg-amber-50 p-2 text-xs leading-snug text-amber-700">
                  No website can read a real device id — these are strong signals, not proof.
                  Locking across browsers can occasionally catch two identical handsets on the
                  same wifi; switch it off if your audience shares connections heavily.
                </p>
              </div>

              {/* --- the clock --- */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    <Timer className="h-3 w-3" /> Runs for (hours)
                  </Label>
                  <Input
                    type="number" min={1}
                    value={editingCampaign.duration_hours ?? 48}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, duration_hours: Number(e.target.value) })}
                    className="rounded-xl" disabled={!canEdit}
                  />
                  <p className="text-xs font-medium text-slate-500">
                    {editingCampaign.id
                      ? 'Counted from when this challenge started, so editing this moves the deadline.'
                      : 'The countdown starts the moment you save.'}
                  </p>
                </div>
                <div className="space-y-3 pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                    <Label className="text-xs font-bold text-slate-700">Running</Label>
                    <Switch
                      checked={editingCampaign.is_active ?? true}
                      onCheckedChange={(v) => setEditingCampaign({ ...editingCampaign, is_active: v })}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </div>

              {/* --- what the agent is actually offering --- */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-600">
                  <Zap className="h-3 w-3 text-[#CD5C5C]" /> In plain words
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  Every <strong>{editingCampaign.players_per_tier || 10}</strong> people who play cut{' '}
                  <strong>
                    {editingCampaign.reward_type === 'percent'
                      ? `${Number(editingCampaign.reward_per_tier || 0).toFixed(0)}%`
                      : `RM ${Number(editingCampaign.reward_per_tier || 0).toFixed(2)}`}
                  </strong>{' '}
                  off for everyone, and each person's own round can shave up to{' '}
                  <strong>
                    {editingCampaign.reward_type === 'percent'
                      ? `${Number(editingCampaign.reward_per_player || 0).toFixed(0)}%`
                      : `RM ${Number(editingCampaign.reward_per_player || 0).toFixed(2)}`}
                  </strong>{' '}
                  more. It stops at{' '}
                  <strong>
                    {editingCampaign.reward_type === 'percent'
                      ? `${Number(editingCampaign.max_reward || 0).toFixed(0)}%`
                      : `RM ${Number(editingCampaign.max_reward || 0).toFixed(2)}`}
                  </strong>{' '}
                  or when the {editingCampaign.duration_hours || 48} hours run out, whichever comes first.
                </p>
              </div>

              {canEdit && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => setEditingCampaign(null)}>Cancel</Button>
                  <Button onClick={saveCampaign} disabled={saving} className="gap-2 rounded-xl bg-[#CD5C5C] hover:bg-[#A14A4A]">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {editingCampaign.id ? 'Update challenge' : 'Save challenge'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ====================== SHARE LINK EDITOR DIALOG ====================== */}
      <Dialog open={!!editingLink} onOpenChange={(o) => !o && setEditingLink(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-tight">
              {editingLink?.id ? 'Edit share link' : 'New share link'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Every open is counted, located by IP, and attributed to whichever package the visitor clicks.
            </DialogDescription>
          </DialogHeader>

          {editingLink && (
            <div className="space-y-4">
              {/* Everything the page already answers is shown, not asked. The
                  link is opened from a page's card, so the page is fixed; its
                  title names the link and the agent comes from the account. */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Links to</span>
                  <span className="min-w-0 truncate text-xs font-bold text-slate-800">
                    {selectedLandingPage?.title || 'A landing page'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Agent</span>
                  <span className="min-w-0 truncate text-xs font-bold text-slate-800">
                    {profile.name || 'Set your name under “My details”'}
                  </span>
                </div>
                {selectedLandingPage && !selectedLandingPage.is_published && (
                  <p className="text-xs font-medium text-amber-600">
                    This page is still a draft. Publish it before sharing the link, or visitors
                    land on the homepage instead.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Link address</Label>
                <div className="flex gap-2">
                  <Input
                    value={buildShareLinkUrl(editingLink.token || '…')}
                    readOnly
                    className="rounded-xl bg-slate-50 font-mono text-xs text-slate-500"
                  />
                  {canEdit && (
                    <Button
                      type="button" variant="outline" size="icon" className="rounded-xl shrink-0"
                      title="Generate a different address"
                      onClick={() => setEditingLink({ ...editingLink, token: randomToken() })}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-500">
                  Generated for you. Use the arrows to roll a different one.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <MessageCircle className="w-3 h-3 text-[#25D366]" /> Agent WhatsApp number
                </Label>
                <Input
                  value={profile.phone || 'No number on your account'}
                  readOnly
                  className="rounded-xl text-xs bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 font-medium leading-snug">
                  From your account. Visitors on this link see a WhatsApp button to this number.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">WhatsApp first message</Label>
                <Textarea
                  value={editingLink.whatsapp_message || ''}
                  onChange={(e) => setEditingLink({ ...editingLink, whatsapp_message: e.target.value })}
                  placeholder="Hi, I saw your Raya flight offer…"
                  className="rounded-xl min-h-[56px] text-xs" disabled={!canEdit}
                />
                <p className="text-xs text-slate-500 font-medium leading-snug">
                  Pre-filled in the visitor's WhatsApp. Left empty, one is written from the
                  agent name and the page title.
                </p>
              </div>

              {/* No coupon picker here. The page already decides whether it
                  runs a coupon or a slash game, and a second copy on the link
                  only created two answers to one question. */}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Campaign starts</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInput(editingLink.starts_at ?? null)}
                    onChange={(e) => setEditingLink({ ...editingLink, starts_at: fromLocalInput(e.target.value) })}
                    className="rounded-xl" disabled={!canEdit}
                  />
                  <p className="text-xs text-slate-500 font-medium">Leave empty to start immediately.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Campaign expires</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInput(editingLink.expires_at ?? null)}
                    onChange={(e) => setEditingLink({ ...editingLink, expires_at: fromLocalInput(e.target.value) })}
                    className="rounded-xl" disabled={!canEdit}
                  />
                  <p className="text-xs text-slate-500 font-medium">Leave empty to run forever.</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 pt-6">
                  <Label className="text-xs font-bold text-slate-700">Active</Label>
                  <Switch
                    checked={editingLink.is_active ?? true}
                    onCheckedChange={(v) => setEditingLink({ ...editingLink, is_active: v })}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              {canEdit && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => setEditingLink(null)}>Cancel</Button>
                  <Button onClick={saveShareLink} disabled={saving} className="rounded-xl bg-[#CD5C5C] hover:bg-[#A14A4A] gap-2">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {editingLink?.id ? 'Update link' : 'Save link'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ======================= PAGE EDITOR DIALOG ======================= */}
      <Dialog open={!!editingPage} onOpenChange={(o) => !o && setEditingPage(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[min(1200px,96vw)] h-[94vh] sm:h-[92vh] p-0 overflow-hidden rounded-2xl sm:rounded-3xl flex flex-col">
          <DialogHeader className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-100 shrink-0">
            <div className="pr-10">
              <DialogTitle className="text-base font-black uppercase tracking-tight">
                {editingPage?.id ? 'Edit landing page' : 'New landing page'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Write the page with the same editor as the document templates. The packages and the
                booking steps are appended below your content, so the flow ends at the same payment step.
              </DialogDescription>
            </div>
            {/* This project's DialogContent renders no built-in close control,
                so the editor supplies its own. */}
            <button
              type="button"
              onClick={() => setEditingPage(null)}
              aria-label="Close editor"
              className="absolute right-3 top-3 sm:right-4 sm:top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>

          {editingPage && (
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
              {/* Two panes side by side on a desktop; on a phone one column
                  that scrolls as a single surface. The rail used to keep its
                  own 42vh scrollbar on mobile, which put a second scroll area
                  inside the first and left every field in a letterbox.

                  Settings rail: */}
              <div className="w-full lg:w-[320px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 p-4 sm:p-5 space-y-4 lg:overflow-y-auto">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Title</Label>
                  <Input
                    value={editingPage.title || ''}
                    onChange={(e) => setEditingPage({
                      ...editingPage,
                      title: e.target.value,
                      slug: editingPage.id ? editingPage.slug : slugify(e.target.value),
                    })}
                    className="rounded-xl" disabled={!canEdit}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Page URL</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500 font-mono shrink-0">/p/</span>
                    <Input
                      value={editingPage.slug || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, slug: slugify(e.target.value) })}
                      className="rounded-xl font-mono text-xs" disabled={!canEdit}
                    />
                  </div>
                </div>

                {/* The coupon decides what this page sells: a page should
                    never offer a package its own discount will refuse. The
                    package and category are derived from it - they are what
                    narrow the wizard and scope the cart. */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Coupon this page runs</Label>
                  <Select
                    value={editingPage.coupon_id || 'none'}
                    onValueChange={(v) => {
                      const scope = couponScope(v === 'none' ? null : v);
                      setEditingPage({
                        ...editingPage,
                        coupon_id: v === 'none' ? null : v,
                        // One or the other: a coupon takes the game off the page.
                        slash_campaign_id: v === 'none' ? editingPage.slash_campaign_id ?? null : null,
                        // A single package in scope still narrows the wizard to
                        // it, exactly as picking it by hand used to.
                        package_id: scope.packageIds.length === 1 ? scope.packageIds[0] : null,
                        category_id: scope.categoryId,
                      });
                    }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="No coupon - all packages" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No coupon - all packages</SelectItem>
                      {coupons.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code}{c.discount_type === 'percent' ? ` · ${c.discount_value}% off` : ` · RM ${c.discount_value} off`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(() => {
                    if (!editingPage.coupon_id) {
                      return (
                        <p className="text-xs font-medium leading-snug text-slate-500">
                          Without a coupon the page shows every package and visitors pay the
                          normal price.
                        </p>
                      );
                    }
                    const scope = couponScope(editingPage.coupon_id);
                    if (!scope.packageIds.length) {
                      return (
                        <p className="rounded-lg bg-amber-50 p-2 text-xs leading-snug text-amber-700">
                          This coupon is not limited to any package, so the page will show all of
                          them. Set its packages or categories on the Coupons tab to narrow it.
                        </p>
                      );
                    }
                    return (
                      <div className="rounded-lg bg-emerald-50 p-2 text-xs leading-snug text-emerald-700">
                        <p className="font-bold uppercase tracking-wider">This page will show</p>
                        <ul className="mt-1 list-disc pl-4">
                          {scope.packageIds.map(id => <li key={id}>{packageName(id)}</li>)}
                        </ul>
                        {/* The code is never typed here: the page puts it on the
                            URL and the wizard applies it. Live is what makes it
                            count, though - validate_coupon only treats a
                            published page as carrying the coupon. */}
                        <p className="mt-1">
                          The code applies itself at checkout — visitors never type it.
                          {!editingPage.is_published && ' Set the page Live to switch that on for real visitors.'}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Either/or: a page is priced by a coupon or by a game,
                    never both. Two discounts on the same package would
                    compound, and a game whose price can still be undercut
                    by a code is not really setting the price. */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    <Gamepad2 className="w-3 h-3 text-[#CD5C5C]" /> Price slash game
                  </Label>
                  <Select
                    value={editingPage.slash_campaign_id || 'none'}
                    onValueChange={(v) => {
                      const cm = campaigns.find(c => c.id === v);
                      setEditingPage({
                        ...editingPage,
                        slash_campaign_id: v === 'none' ? null : v,
                        // Choosing a game drops the coupon, and the page
                        // follows the package that game is cutting.
                        ...(v === 'none' ? {} : {
                          coupon_id: null,
                          package_id: cm?.package_id ?? null,
                          category_id: cm?.package_id
                            ? packages.find(x => x.id === cm.package_id)?.category_id ?? null
                            : null,
                        }),
                      });
                    }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="No game" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No game</SelectItem>
                      {campaigns.map(c => {
                        const g = SLASH_GAMES.find(x => x.id === c.game_type);
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            {g?.icon} {c.title} · {g?.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {(() => {
                    const cm = campaigns.find(c => c.id === editingPage.slash_campaign_id);
                    if (!cm) return null;
                    // The page follows the campaign's package now, so the two
                    // can never disagree - the only thing left to warn about
                    // is a campaign that targets nothing at all.
                    if (!cm.package_id) {
                      return (
                        <p className="rounded-lg bg-amber-50 p-2 text-xs leading-snug text-amber-700">
                          This challenge has no package set, so it cannot move any price. Open it on
                          the Price Slash tab and choose the package it is cutting.
                        </p>
                      );
                    }
                    return (
                      <div className="rounded-lg bg-emerald-50 p-2 text-xs leading-snug text-emerald-700">
                        <p className="font-bold uppercase tracking-wider">This page will show</p>
                        <ul className="mt-1 list-disc pl-4">
                          <li>{packageName(cm.package_id)}</li>
                        </ul>
                        <p className="mt-1">Priced by the game, and checkout charges whatever it reaches.</p>
                      </div>
                    );
                  })()}
                  {campaigns.length === 0 ? (
                    <p className="text-xs font-medium leading-snug text-slate-500">
                      No challenges built yet. Make one on the{' '}
                      <span className="font-bold text-slate-600">Price Slash</span> tab first.
                    </p>
                  ) : (
                    <p className="text-xs font-medium leading-snug text-slate-500">
                      A page runs one or the other: choosing a game here clears the coupon above,
                      and choosing a coupon clears the game.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Meta description</Label>
                  <Textarea
                    value={editingPage.meta_description || ''}
                    onChange={(e) => setEditingPage({ ...editingPage, meta_description: e.target.value })}
                    className="rounded-xl min-h-[60px] text-xs" disabled={!canEdit}
                  />
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs text-slate-500 font-medium leading-snug">
                    <span className="font-bold uppercase tracking-wider text-slate-600">This page carries it.</span>{' '}
                    The coupon and the slash game are decided here, and here only. A share link
                    made for this page can still put a different agent's name and WhatsApp
                    number on it, so one design can serve several agents.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  {([
                    ['show_wizard', 'Show packages'],
                    ['show_header', 'Show site header'],
                    ['show_footer', 'Show site footer'],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                      <Label className="text-xs font-bold text-slate-700">{label}</Label>
                      <Switch
                        checked={(editingPage as any)[key] ?? true}
                        onCheckedChange={(v) => setEditingPage({ ...editingPage, [key]: v })}
                        disabled={!canEdit}
                      />
                    </div>
                  ))}

                  <p className="text-xs text-slate-500 font-medium leading-snug">
                    <span className="font-bold text-slate-600">Show packages</span> appends the package
                    carousel and the booking steps below your content, so the page ends at the same
                    payment step as the main site.
                  </p>
                </div>

                {editingPage.id && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    {/* Preview renders the real page - your content plus the
                        packages and the booking steps - and works on a draft.
                        It is for proofing the design; what you send a customer
                        is the published /p/slug itself. */}
                    <Button variant="outline" size="sm" className="w-full h-8 rounded-lg text-xs gap-1.5" asChild>
                      <a href={`${buildLandingPageUrl(editingPage.slug || '')}?preview=1`} target="_blank" rel="noreferrer">
                        <Eye className="w-3 h-3" /> Preview full page
                      </a>
                    </Button>
                    <p className="text-xs text-slate-500 font-medium leading-snug">
                      Save first — preview loads the stored version. Publish it and the page
                      is live at its own address; add a share link on the page's card only if
                      you need the visits attributed to a particular agent.
                    </p>
                  </div>
                )}

                {canEdit && (
                  <Button
                    onClick={savePage} disabled={saving}
                    className="w-full rounded-xl bg-[#CD5C5C] hover:bg-[#A14A4A] gap-2"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {editingPage.id ? 'Update page' : 'Save page'}
                  </Button>
                )}
              </div>

              {/* The editor itself — the very same component the document templates use */}
              {/* Below the form on a phone, so it needs a height of its own -
                  flex-1 alone collapses inside a scrolling column. */}
              <div className="flex-1 min-h-[65vh] lg:min-h-[280px] min-w-0 bg-slate-50 flex flex-col">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 shrink-0">
                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => setPageEditorMode('visual')}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors',
                        pageEditorMode === 'visual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                      )}
                    >
                      <Eye className="h-3 w-3" /> Visual
                    </button>
                    <button
                      type="button"
                      onClick={() => setPageEditorMode('code')}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors',
                        pageEditorMode === 'code' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                      )}
                    >
                      <Code className="h-3 w-3" /> HTML
                    </button>
                  </div>

                  {pageEditorMode === 'code' && (
                    <div className="flex items-center gap-2">
                      {lockedCount > 0 && (
                        <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                          <Lock className="h-3 w-3" /> {lockedCount} locked
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {pageEditorMode === 'visual' ? (
                  <div className="flex-1 min-h-0">
                    <VisualHtmlEditor
                      content={editingPage.html_content || ''}
                      onChange={(html) => setEditingPage(prev => (prev ? { ...prev, html_content: html } : prev))}
                      className="h-full"
                      uploading={uploadingPageImage}
                      setUploading={setUploadingPageImage}
                    />
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 flex flex-col p-3 gap-2">
                    <Textarea
                      value={editingPage.html_content || ''}
                      onChange={(e) => setEditingPage(prev => (prev ? { ...prev, html_content: e.target.value } : prev))}
                      spellCheck={false}
                      disabled={!canEdit}
                      className="flex-1 min-h-0 resize-none rounded-xl border-slate-200 bg-white font-mono text-xs leading-relaxed"
                      placeholder="<div>…</div>"
                    />
                    <p className="text-xs text-slate-500 font-medium leading-snug shrink-0">
                      {lockedCount > 0 ? (
                        <>
                          <Lock className="mr-1 inline h-3 w-3 text-amber-600" />
                          Blocks marked <code className="rounded bg-slate-100 px-1 font-mono">data-locked</code> are
                          fixed — edit anything else freely, but a save that changed or removed one is rejected.
                        </>
                      ) : (
                        <>
                          Edit the markup directly. Wrap anything that must stay put in a tag carrying{' '}
                          <code className="rounded bg-slate-100 px-1 font-mono">data-locked="true"</code> to protect it.
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================ QR DIALOG ============================ */}
      <Dialog open={!!qrLink} onOpenChange={(o) => !o && setQrLink(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-tight">
              {qrLink?.label || qrLink?.token}
            </DialogTitle>
            <DialogDescription className="text-xs font-mono break-all">
              {qrLink ? buildShareLinkUrl(qrLink.token) : ''}
            </DialogDescription>
          </DialogHeader>
          {qrLink && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 w-full max-w-[240px]">
                {/* Scales with the dialog rather than overflowing a small screen. */}
                <QRCode
                  value={buildShareLinkUrl(qrLink.token)}
                  size={256}
                  viewBox="0 0 256 256"
                  style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                />
              </div>
              <Button
                variant="outline" className="rounded-xl gap-2"
                onClick={() => copyToClipboard(buildShareLinkUrl(qrLink.token))}
              >
                <Copy className="w-3.5 h-3.5" /> Copy link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================== DELETE CONFIRM ========================== */}
      {/* A reset is visible to whoever is mid-game: the price they had
          unlocked goes back up, so the confirm says so plainly. */}
      <AlertDialog open={!!confirmReset} onOpenChange={(o) => !o && setConfirmReset(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl sm:rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset “{confirmReset?.title}”?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Puts the challenge back to its starting state: no players, no
                  tiers unlocked, no discount, and the countdown running again
                  from now. Everyone who has played may play again.
                </p>
                <p className="text-xs text-slate-500">
                  {confirmReset?.player_count ?? 0} player
                  {confirmReset?.player_count === 1 ? '' : 's'} and RM{' '}
                  {Number(confirmReset?.current_reward ?? 0).toFixed(2)} of unlocked discount
                  will be discarded. Anyone on the page will see the price go back up.
                  This cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl mt-0" disabled={resetting}>Leave it running</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetting}
              onClick={(e) => { e.preventDefault(); if (confirmReset) resetCampaign(confirmReset); }}
              className="rounded-xl bg-amber-600 hover:bg-amber-700"
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Captures hold customer names, emails and phone numbers, so the
          confirm says what goes and from where before anything is deleted. */}
      <AlertDialog open={!!confirmClear} onOpenChange={(o) => !o && setConfirmClear(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl sm:rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmClear?.title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Deletes visits and form captures for{' '}
                  <span className="font-bold text-slate-700">{clearScopeLabel}</span>.
                  Form captures hold customer names, emails and phone numbers.
                  This cannot be undone.
                </p>
                <p className="text-xs text-slate-500">
                  At least {clearPreview.events} visit{clearPreview.events === 1 ? '' : 's'} and{' '}
                  {clearPreview.captures} capture{clearPreview.captures === 1 ? '' : 's'} — counted from
                  what is loaded here, so anything older that has not been loaded goes too.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl mt-0" disabled={clearing}>Keep them</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearing}
              onClick={(e) => { e.preventDefault(); if (confirmClear) clearAnalytics(confirmClear); }}
              className="rounded-xl bg-red-600 hover:bg-red-700"
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl sm:rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirmDelete?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Any statistics already recorded against it are removed too.
              {confirmDelete?.table === 'agent_landing_pages' && (() => {
                const n = shareLinks.filter(l => l.landing_page_id === confirmDelete.id).length;
                return n ? ` Its share link${n === 1 ? '' : 's'} will be deleted as well, so
                  ${n === 1 ? 'it stops' : 'they stop'} working for anyone who still has the address.` : '';
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="rounded-xl bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
