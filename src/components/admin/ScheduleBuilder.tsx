import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  location: string;
}

interface ScheduleBuilderProps {
  initialData: string;
  onSave: (data: string) => void;
}

interface SortableItemProps {
  id: string;
  item: ScheduleItem;
  onUpdate: (field: keyof ScheduleItem, value: string) => void;
  onRemove: () => void;
}

const SortableItem = ({ id, item, onUpdate, onRemove }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50" : ""}>
      <Card className="relative overflow-hidden border-black/10 rounded-[2.5rem] shadow-sm hover:shadow-md transition-all duration-300">
        <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
          <div className="flex items-center justify-between w-full sm:w-auto sm:block">
            <div
              {...attributes}
              {...listeners}
              className="p-4 -m-4 text-slate-900 cursor-grab shrink-0 hover:text-slate-600 transition-colors touch-none flex items-center justify-center w-14 h-14"
              title="Drag to reorder"
            >
              <GripVertical className="h-6 w-6" />
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="sm:hidden h-14 w-14 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-2xl"
            >
              <Trash2 className="h-6 w-6" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 flex-1 w-full">
            <div className="space-y-1.5">
              <label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Time</label>
              <Input
                type="time"
                value={item.time}
                onChange={(e) => onUpdate("time", e.target.value)}
                onClick={(e) => (e.currentTarget as any).showPicker()}
                className="h-16 sm:h-14 text-sm border-black/20 rounded-2xl focus:ring-2 focus:ring-indigo-100 bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Session Title</label>
              <Input
                value={item.title}
                onChange={(e) => onUpdate("title", e.target.value)}
                placeholder="Opening Keynote"
                className="h-16 sm:h-14 text-sm border-black/20 rounded-2xl focus:ring-2 focus:ring-indigo-100 bg-white"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 md:col-span-1">
              <label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Location</label>
              <Input
                value={item.location}
                onChange={(e) => onUpdate("location", e.target.value)}
                placeholder="Room A"
                className="h-16 sm:h-14 text-sm border-black/20 rounded-2xl focus:ring-2 focus:ring-indigo-100 bg-white"
              />
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="hidden sm:flex mt-6 h-14 w-14 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-2xl shrink-0"
          >
            <Trash2 className="h-6 w-6" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export const ScheduleBuilder = ({ initialData, onSave }: ScheduleBuilderProps) => {
  const [items, setItems] = useState<ScheduleItem[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    try {
      if (initialData) {
        const parsed = JSON.parse(initialData);
        if (Array.isArray(parsed)) {
          // Ensure every item has an ID for dnd-kit
          const itemsWithIds = parsed.map((item: any) => ({
            ...item,
            id: item.id || Math.random().toString(36).substr(2, 9),
          }));
          setItems(itemsWithIds);
        }
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error("Failed to parse schedule JSON", e);
    }
  }, [initialData]);

  const addItem = () => {
    const newItem: ScheduleItem = {
      id: Math.random().toString(36).substr(2, 9),
      time: "09:00",
      title: "New Session",
      location: "Main Hall",
    };
    const newItems = [...items, newItem];
    setItems(newItems);
    onSave(JSON.stringify(newItems));
  };

  const removeItem = (id: string) => {
    const newItems = items.filter((item) => item.id !== id);
    setItems(newItems);
    onSave(JSON.stringify(newItems));
  };

  const updateItem = (id: string, field: keyof ScheduleItem, value: string) => {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    setItems(newItems);
    onSave(JSON.stringify(newItems));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      onSave(JSON.stringify(newItems));
    }
  };

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {items.map((item) => (
              <SortableItem
                key={item.id}
                id={item.id}
                item={item}
                onUpdate={(field, value) => updateItem(item.id, field, value)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-black/10 rounded-2xl bg-slate-50/50">
          <p className="text-[11px] sm:text-xs text-slate-900 font-medium">No sessions added yet. Click the button below to start building your schedule.</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <Button
          onClick={addItem}
          variant="outline"
          className="w-full sm:flex-1 border-dashed border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-700/10 hover:border-slate-700/30 h-16 sm:h-14 rounded-2xl font-bold transition-all shadow-sm"
        >
          <Plus className="mr-2 h-6 w-6" /> Add Session
        </Button>
      </div>
    </div>
  );
};
