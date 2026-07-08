
import React from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from "@/components/ui/button";
import { GripVertical, Pencil, Trash2, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ContentListProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  items: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onReorder: (items: any[]) => void;
  onAdd: () => void;
  renderItem: (item: any) => React.ReactNode;
  canEdit?: boolean;
}

interface SortableItemProps {
  id: string;
  item: any;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  renderItem: (item: any) => React.ReactNode;
  canEdit?: boolean;
}

function SortableItem({ id, item, onEdit, onDelete, renderItem, canEdit = true }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ 
    id,
    disabled: !canEdit
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <Card className="overflow-hidden border-black/5 hover:shadow-lg transition-all duration-300">
        <CardContent className="p-0 flex items-stretch">
          <div 
            {...attributes} 
            {...listeners} 
            className="w-10 sm:w-12 bg-slate-50 border-r border-black/5 flex items-center justify-center cursor-move hover:bg-slate-100 transition-colors"
          >
            <GripVertical className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900" />
          </div>
          <div className="flex-1 p-3 sm:p-4 flex items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              {renderItem(item)}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onEdit(item)}
                disabled={!canEdit}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-full border-black/10 hover:bg-slate-50 hover:text-slate-600 hover:border-slate-200 disabled:opacity-50"
              >
                <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onDelete(item.id)}
                disabled={!canEdit}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-full border-black/10 hover:bg-slate-50 hover:text-slate-600 hover:border-red-200 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ContentList({ 
  title, 
  subtitle, 
  icon, 
  items, 
  onEdit, 
  onDelete, 
  onReorder, 
  onAdd, 
  renderItem,
  canEdit = true
}: ContentListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canEdit) return;
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 sm:p-2.5 bg-slate-100 rounded-xl sm:rounded-2xl shadow-sm border border-black/5">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-base sm:text-lg font-bold font-sans text-slate-900 uppercase tracking-tight">{title}</h3>
            {subtitle && <p className="text-[10px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">{subtitle}</p>}
          </div>
        </div>
        <Button 
          size="lg"
          className="bg-slate-700 hover:bg-slate-700/90 text-white shadow-2xl shadow-slate-200/50 transition-all font-bold font-sans uppercase tracking-tight text-[11px] sm:text-xs h-12 sm:h-12 px-5 sm:px-8 active:scale-[0.98] rounded-[2.5rem] w-full sm:w-auto disabled:opacity-50"
          onClick={onAdd}
          disabled={!canEdit}
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" /> Add New Item
        </Button>
      </div>

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={items.map(item => item.id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {items.map((item) => (
              <SortableItem 
                key={item.id} 
                id={item.id} 
                item={item} 
                onEdit={onEdit} 
                onDelete={onDelete}
                renderItem={renderItem}
                canEdit={canEdit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      {items.length === 0 && (
        <div className="text-center py-10 sm:py-16 px-4 sm:px-6 border-2 border-dashed border-black/10 rounded-3xl bg-slate-50/50 flex flex-col items-center justify-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3 sm:mb-4 border border-black/5 shadow-inner">
            <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-slate-900" />
          </div>
          <h3 className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900 mb-1">No Items Yet</h3>
          <p className="text-[11px] sm:text-xs text-slate-900 font-bold font-sans italic uppercase tracking-tight">
            Start by adding your first item to this section
          </p>
        </div>
      )}
    </div>
  );
}
