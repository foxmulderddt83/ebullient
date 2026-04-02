import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Clock } from "lucide-react";

interface TimeSlotBuilderProps {
  initialData: string;
  onSave: (data: string) => void;
}

export const TimeSlotBuilder = ({ initialData, onSave }: TimeSlotBuilderProps) => {
  const [slots, setSlots] = useState<string[]>([]);
  const [newSlot, setNewSlot] = useState("");

  useEffect(() => {
    try {
      if (initialData) {
        const parsed = JSON.parse(initialData);
        if (Array.isArray(parsed)) {
          setSlots(parsed);
        }
      } else {
        setSlots([]);
      }
    } catch (e) {
      console.error("Failed to parse time slots JSON", e);
    }
  }, [initialData]);

  const updateSlots = (newSlots: string[]) => {
    setSlots(newSlots);
    onSave(JSON.stringify(newSlots));
  };

  const formatTime = (time: string) => {
    if (!time) return "";
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const addSlot = () => {
    if (!newSlot.trim()) return;
    const formatted = formatTime(newSlot);
    if (slots.includes(formatted)) return;
    
    const newSlots = [...slots, formatted].sort();
    updateSlots(newSlots);
    setNewSlot("");
  };

  const removeSlot = (slotToRemove: string) => {
    const newSlots = slots.filter(slot => slot !== slotToRemove);
    updateSlots(newSlots);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSlot();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 min-h-[80px] p-6 border border-black/10 rounded-[2.5rem] bg-slate-50/50 shadow-inner">
        {slots.length === 0 && (
          <div className="w-full flex flex-col items-center justify-center py-6 text-slate-900">
            <Clock className="w-10 h-10 mb-3 opacity-20" />
            <span className="text-[11px] sm:text-xs font-medium italic">No time slots added yet...</span>
          </div>
        )}
        {slots.map((slot) => (
          <Badge 
            key={slot} 
            variant="outline" 
            className="pl-4 pr-2 py-2.5 gap-3 text-[11px] sm:text-xs bg-white border-black/10 shadow-sm text-slate-700 font-bold rounded-2xl transition-all hover:border-primary/30 hover:bg-primary/5/30"
          >
            <Clock className="w-4 h-4 text-primary" />
            {slot}
            <button
              onClick={() => removeSlot(slot)}
              className="ml-1 p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors flex items-center justify-center w-8 h-8"
              title={`Remove ${slot}`}
            >
              <X className="w-4 h-4" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none">
            <Clock className="w-6 h-6 text-slate-900" />
          </div>
          <Input
            type="time"
            value={newSlot}
            onChange={(e) => setNewSlot(e.target.value)}
            onKeyDown={handleKeyPress}
            onClick={(e) => (e.currentTarget as any).showPicker()}
            className="pl-14 h-16 sm:h-14 text-sm font-bold border-black/20 rounded-2xl focus:ring-2 focus:ring-primary bg-white transition-all shadow-sm"
            placeholder="Select time..."
          />
        </div>
        <Button 
          onClick={addSlot} 
          type="button" 
          variant="outline"
          className="w-full sm:w-auto border-dashed border-primary/20 bg-primary/5/50 text-primary hover:bg-primary/10 hover:border-primary/30 h-16 sm:h-14 px-8 rounded-2xl font-bold transition-all shadow-sm active:scale-[0.98]"
        >
          <Plus className="w-6 h-6 mr-2" /> Add Slot
        </Button>
      </div>
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-1 bg-primary/40 rounded-full" />
        <p className="text-[11px] sm:text-xs text-slate-900 font-medium italic">
          Tip: Click the clock icon or input to select a time.
        </p>
      </div>
    </div>
  );
};
