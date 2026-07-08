import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, ImageIcon, Palette, Type, Settings2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLogger";

export default function WatermarkConfig({ canEdit = true }: { canEdit?: boolean }) {
  const [settings, setSettings] = useState({
    watermark_text: "FOR ONEDAYPILOT ONLY",
    watermark_color: "rgba(255, 0, 0, 0.5)",
    watermark_font_size: "30",
    watermark_line_thickness: "0.5",
    watermark_position: "corners"
  });
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
        .select('key, value')
        .filter('key', 'in', '("watermark_text","watermark_color","watermark_font_size","watermark_line_thickness","watermark_position")');

      if (error) throw error;
      if (data && data.length > 0) {
        const newSettings = { ...settings };
        data.forEach(item => {
          if (item.key in newSettings) {
            newSettings[item.key as keyof typeof settings] = item.value;
          }
        });
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Error fetching watermark settings:', error);
      toast.error("Failed to load watermark settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const upsertData = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        category: 'camera',
        description: `Camera watermark setting: ${key.replace('watermark_', '').replace(/_/g, ' ')}`
      }));

      const { error } = await supabase
        .from('site_settings')
        .upsert(upsertData);

      if (error) throw error;
      toast.success("Watermark settings saved successfully");
      logActivity(supabase, 'update', 'site_settings', 'camera_watermark', settings);
    } catch (error: any) {
      console.error('Error saving watermark settings:', error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof typeof settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-slate-900" /></div>;
  }

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 p-2 sm:p-0">
      <Card className="border-black/5 shadow-xl shadow-slate-200/50 rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardContent className="p-5 sm:p-12 space-y-6 sm:space-y-10 pt-10 sm:pt-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-10">
            {/* Text Setting */}
            <div className="space-y-3">
              <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1 flex items-center gap-2">
                <Type className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                Watermark Text
              </Label>
              <Input 
                value={settings.watermark_text}
                onChange={(e) => handleChange('watermark_text', e.target.value)}
                placeholder="e.g. FOR ONEDAYPILOT ONLY"
                disabled={!canEdit}
                className="h-12 sm:h-16 rounded-xl sm:rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm px-4 sm:px-8 font-bold text-[11px] sm:text-sm"
              />
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-2 sm:ml-4 opacity-60">The label displayed on the image</p>
            </div>

            {/* Color Setting */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1 flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                  Color (RGBA)
                </Label>
                <div className="relative w-6 h-6 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 border-white shadow-lg ring-1 ring-black/5">
                  <input 
                    type="color" 
                    value={settings.watermark_color.includes('#') ? settings.watermark_color : '#ff0000'} 
                    onChange={(e) => handleChange('watermark_color', e.target.value)}
                    disabled={!canEdit}
                    className="absolute inset-[-8px] w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer scale-150"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <Input 
                  value={settings.watermark_color}
                  onChange={(e) => handleChange('watermark_color', e.target.value)}
                  placeholder="e.g. rgba(255, 0, 0, 0.5)"
                  disabled={!canEdit}
                  className="h-12 sm:h-16 rounded-xl sm:rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm px-4 sm:px-8 font-bold text-[11px] sm:text-sm flex-1"
                />
              </div>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-2 sm:ml-4 opacity-60">CSS formats (rgba, hex, etc.)</p>
            </div>

            {/* Font Size Setting */}
            <div className="space-y-3">
              <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1 flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                Base Font Size
              </Label>
              <Input 
                type="number"
                value={settings.watermark_font_size}
                onChange={(e) => handleChange('watermark_font_size', e.target.value)}
                placeholder="e.g. 30"
                disabled={!canEdit}
                className="h-12 sm:h-16 rounded-xl sm:rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm px-4 sm:px-8 font-bold text-[11px] sm:text-sm"
              />
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-2 sm:ml-4 opacity-60">Size in pixels (scales with image)</p>
            </div>

            {/* Line Thickness Setting */}
            <div className="space-y-3">
              <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1 flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                Line Thickness
              </Label>
              <Input 
                type="number"
                step="0.1"
                value={settings.watermark_line_thickness}
                onChange={(e) => handleChange('watermark_line_thickness', e.target.value)}
                placeholder="e.g. 0.5"
                disabled={!canEdit}
                className="h-12 sm:h-16 rounded-xl sm:rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm px-4 sm:px-8 font-bold text-[11px] sm:text-sm"
              />
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-2 sm:ml-4 opacity-60">Thickness of accent lines</p>
            </div>

            {/* Position Setting */}
            <div className="space-y-3">
              <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1 flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                Watermark Position
              </Label>
              <Select 
                value={settings.watermark_position} 
                onValueChange={(value) => handleChange('watermark_position', value)}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-12 sm:h-16 rounded-xl sm:rounded-[2.5rem] border-black/10 bg-white/50 focus:bg-white transition-all shadow-sm px-4 sm:px-8 font-bold text-[11px] sm:text-sm">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl sm:rounded-[2.5rem] border-black/10 shadow-2xl overflow-hidden">
                  <SelectItem value="corners" className="rounded-xl text-[10px] sm:text-xs font-bold uppercase py-3 sm:py-4">Two Corners (Top-Left & Bottom-Right)</SelectItem>
                  <SelectItem value="center" className="rounded-xl text-[10px] sm:text-xs font-bold uppercase py-3 sm:py-4">Center Only</SelectItem>
                  <SelectItem value="tiled" className="rounded-xl text-[10px] sm:text-xs font-bold uppercase py-3 sm:py-4">Tiled (Repeating)</SelectItem>
                  <SelectItem value="bottom-right" className="rounded-xl text-[10px] sm:text-xs font-bold uppercase py-3 sm:py-4">Bottom-Right Only</SelectItem>
                  <SelectItem value="top-left" className="rounded-xl text-[10px] sm:text-xs font-bold uppercase py-3 sm:py-4">Top-Left Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-2 sm:ml-4 opacity-60">Placement on the image</p>
            </div>
          </div>

          {/* Preview Placeholder */}
          <div className="bg-slate-50/50 rounded-2xl sm:rounded-[3rem] p-4 sm:p-8 border border-black/5 shadow-inner">
             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
               <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-600 bg-white px-4 sm:px-6 py-2 rounded-full border border-black/5 shadow-sm">Live Preview (Simulated)</h4>
             </div>
             <div className="relative aspect-video bg-slate-200 rounded-xl sm:rounded-[2.5rem] overflow-hidden flex items-center justify-center border-2 sm:border-4 border-white shadow-2xl">
                <span className="text-slate-900 font-bold uppercase tracking-tight text-[8px] sm:text-xs opacity-40 text-center px-4">Capture Area Preview</span>
                
                {/* Simulated Watermark based on settings */}
                {settings.watermark_position === 'corners' && (
                  <>
                    <div className="absolute top-4 left-4" style={{ color: settings.watermark_color, fontSize: `${parseInt(settings.watermark_font_size) / 2}px`, borderTop: `${settings.watermark_line_thickness}px solid`, borderBottom: `${settings.watermark_line_thickness}px solid`, transform: 'rotate(-15deg)', padding: '2px 5px' }}>
                      {settings.watermark_text}
                    </div>
                    <div className="absolute bottom-4 right-4" style={{ color: settings.watermark_color, fontSize: `${parseInt(settings.watermark_font_size) / 2}px`, borderTop: `${settings.watermark_line_thickness}px solid`, borderBottom: `${settings.watermark_line_thickness}px solid`, transform: 'rotate(-15deg)', padding: '2px 5px' }}>
                      {settings.watermark_text}
                    </div>
                  </>
                )}
                {settings.watermark_position === 'center' && (
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div style={{ color: settings.watermark_color, fontSize: `${settings.watermark_font_size}px`, borderTop: `${settings.watermark_line_thickness}px solid`, borderBottom: `${settings.watermark_line_thickness}px solid`, transform: 'rotate(-15deg)', padding: '5px 10px' }}>
                        {settings.watermark_text}
                      </div>
                   </div>
                )}
                {settings.watermark_position === 'bottom-right' && (
                  <div className="absolute bottom-8 right-8" style={{ color: settings.watermark_color, fontSize: `${settings.watermark_font_size}px`, borderTop: `${settings.watermark_line_thickness}px solid`, borderBottom: `${settings.watermark_line_thickness}px solid`, transform: 'rotate(-15deg)', padding: '5px 10px' }}>
                    {settings.watermark_text}
                  </div>
                )}
                {settings.watermark_position === 'top-left' && (
                  <div className="absolute top-8 left-8" style={{ color: settings.watermark_color, fontSize: `${settings.watermark_font_size}px`, borderTop: `${settings.watermark_line_thickness}px solid`, borderBottom: `${settings.watermark_line_thickness}px solid`, transform: 'rotate(-15deg)', padding: '5px 10px' }}>
                    {settings.watermark_text}
                  </div>
                )}
                {settings.watermark_position === 'tiled' && (
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-center">
                        <div style={{ color: settings.watermark_color, fontSize: `${parseInt(settings.watermark_font_size) / 3}px`, borderTop: `${settings.watermark_line_thickness}px solid`, borderBottom: `${settings.watermark_line_thickness}px solid`, transform: 'rotate(-15deg)' }}>
                          {settings.watermark_text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end pt-6 sm:pt-8 border-t border-black/5">
            <Button 
              onClick={handleSave} 
              disabled={saving || !canEdit} 
              className="h-12 sm:h-16 px-6 sm:px-12 bg-slate-700 hover:bg-slate-700/90 text-white shadow-xl shadow-slate-200/50 transition-all active:scale-[0.98] font-bold uppercase tracking-tight text-[10px] sm:text-xs rounded-xl sm:rounded-[2.5rem] w-full sm:w-auto"
            >
              {saving ? <Loader2 className="mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <Save className="mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5" />}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
