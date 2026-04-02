import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLogger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface BusinessDay {
  day: string;
  isOpen: boolean;
  hours: string;
}

const DEFAULT_HOURS: BusinessDay[] = [
  { day: "Monday", isOpen: true, hours: "9am to 5pm" },
  { day: "Tuesday", isOpen: true, hours: "9am to 5pm" },
  { day: "Wednesday", isOpen: true, hours: "9am to 5pm" },
  { day: "Thursday", isOpen: true, hours: "9am to 5pm" },
  { day: "Friday", isOpen: true, hours: "9am to 5pm" },
  { day: "Saturday", isOpen: true, hours: "9am to 2pm" },
  { day: "Sunday", isOpen: false, hours: "Closed" },
];

export default function BusinessHoursConfig() {
  const [hours, setHours] = useState<BusinessDay[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'business_hours')
        .maybeSingle();

      if (error) throw error;
      
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed)) {
            // Merge with default to ensure all days exist if structure changes
            const merged = DEFAULT_HOURS.map(defaultDay => {
              const existing = parsed.find((p: any) => p.day === defaultDay.day);
              return existing ? { ...defaultDay, ...existing } : defaultDay;
            });
            setHours(merged);
          }
        } catch (e) {
          console.error("Failed to parse business hours JSON", e);
        }
      }
    } catch (error) {
      console.error('Error fetching business hours:', error);
      toast.error("Failed to load business hours");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          key: 'business_hours',
          value: JSON.stringify(hours),
          category: 'general',
          description: 'Business operating hours configuration'
        });

      if (error) throw error;
      toast.success("Business hours saved successfully");
      logActivity(supabase, 'update', 'site_settings', 'business_hours', { value: JSON.stringify(hours) });
    } catch (error: any) {
      console.error('Error saving business hours:', error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (index: number, field: keyof BusinessDay, value: any) => {
    const newHours = [...hours];
    newHours[index] = { ...newHours[index], [field]: value };
    setHours(newHours);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <Card className="overflow-hidden border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-primary/5 rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 sm:p-10 bg-white/50 border-b border-black/5">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">Business Hours</CardTitle>
              <CardDescription className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-900 mt-1">
                Configure your operating schedule
              </CardDescription>
            </div>
          </div>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving} 
          className="w-full sm:w-auto gap-3 bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/10 transition-all active:scale-[0.95] font-black uppercase tracking-widest text-[11px] sm:text-xs h-16 px-10 rounded-[1.5rem]"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Configuration
        </Button>
      </CardHeader>
      <CardContent className="p-6 sm:p-10 space-y-8">
        <div className="rounded-[2.5rem] border border-black/5 bg-white/70 shadow-sm divide-y divide-black/5 overflow-hidden">
          {hours.map((day, index) => (
            <div 
              key={day.day} 
              className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 transition-all duration-300 ${day.isOpen ? 'bg-white/80 hover:bg-white' : 'bg-slate-50/40 opacity-70'}`}
            >
              <div className="flex items-center gap-3 min-w-[150px]">
                <div className="flex items-center justify-center w-12 h-12 bg-white rounded-2xl border border-black/5 shadow-sm">
                  <Checkbox 
                    id={`day-${index}`}
                    checked={day.isOpen}
                    onCheckedChange={(checked) => updateDay(index, 'isOpen', checked)}
                    className="h-7 w-7 border-black data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded-lg transition-all"
                  />
                </div>
                <Label 
                  htmlFor={`day-${index}`} 
                  className={`cursor-pointer text-[11px] sm:text-xs font-black uppercase tracking-[0.15em] transition-colors ${day.isOpen ? 'text-slate-900' : 'text-red-600'}`}
                >
                  {day.day}
                </Label>
              </div>
              
              <div className="flex-1 relative group/input">
                <Input
                  value={day.hours}
                  onChange={(e) => updateDay(index, 'hours', e.target.value)}
                  placeholder={day.isOpen ? "e.g. 9am to 5pm" : "Closed"}
                  disabled={!day.isOpen}
                  className={`h-12 sm:h-14 text-[11px] sm:text-xs font-bold border-black/10 rounded-2xl bg-white/50 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all shadow-sm px-5 ${!day.isOpen && 'bg-red-50/40 text-red-600 border-dashed border-red-200'}`}
                />
                {!day.isOpen && (
                  <div className="absolute right-6 top-1/2 -translate-y-1/2">
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-red-600 bg-red-50 px-3 py-1.5 rounded-xl border border-red-200/60">
                      Closed
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
