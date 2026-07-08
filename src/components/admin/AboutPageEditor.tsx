import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, ImageIcon, Save, Plus, GripVertical, Trash2, FileText } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { compressFile } from "@/utils/fileCompression";

interface AboutSection {
  id: string;
  section_key: string;
  title: string;
  content: string;
  image_url: string | null;
  images: string[] | null;
  bg_color: string | null;
  display_order: number;
  additional_data: any;
}

// Sortable Item Component
const SortableSection = ({ 
  section, 
  onChange, 
  onSave,
  onRemoveImage, 
  onUploadImage, 
  onUploadMultipleImages, 
  onDelete,
  saving,
  canEdit = true
}: { 
  section: AboutSection, 
  onChange: (s: AboutSection) => void,
  onSave: (s: AboutSection) => void,
  onRemoveImage: (id: string, url: string) => void,
  onUploadImage: (id: string, file: File) => void,
  onUploadMultipleImages: (id: string, files: FileList) => void,
  onDelete: (id: string) => void,
  saving: string | null,
  canEdit?: boolean
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ 
    id: section.id,
    disabled: !canEdit
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-8 group/sortable">
      <Card 
        style={{ backgroundColor: section.bg_color || '#ffffff' }} 
        className="border-none shadow-xl shadow-slate-100/50 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50"
      >
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-black/5 bg-slate-50/50 p-4 sm:px-8 sm:py-5">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div 
              {...attributes} 
              {...listeners} 
              className="p-2.5 bg-white rounded-2xl shadow-sm border border-black/5 cursor-grab active:cursor-grabbing hover:text-slate-600 hover:border-slate-200 transition-all group-hover/sortable:scale-110"
            >
              <GripVertical className="h-5 w-5 text-slate-900 group-hover/sortable:text-slate-600" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-base sm:text-lg font-bold font-sans text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <span className="capitalize">{section.title || section.section_key.replace(/_/g, ' ')}</span>
              </CardTitle>
              <p className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Section Configuration</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
             <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-2xl border border-black/5 shadow-sm">
              <label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">BG Color</label>
              <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-black/5 shadow-sm">
                <div className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-white shadow-md ring-1 ring-black/5 shrink-0 ml-1">
                  <input 
                    type="color" 
                    value={section.bg_color || '#ffffff'} 
                    onChange={(e) => onChange({ ...section, bg_color: e.target.value })}
                    className={cn(
                      "absolute inset-[-50%] w-[200%] h-[200%]",
                      canEdit ? "cursor-pointer" : "cursor-not-allowed"
                    )}
                    disabled={!canEdit}
                  />
                </div>
                <Input 
                  value={section.bg_color || '#ffffff'} 
                  onChange={(e) => onChange({ ...section, bg_color: e.target.value })}
                  className="h-8 border-none bg-transparent font-mono uppercase text-[10px] px-1 focus-visible:ring-0 placeholder:text-slate-300 w-20 font-bold text-slate-700"
                  placeholder="#ffffff"
                  disabled={!canEdit}
                />
              </div>
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-10 w-10 rounded-xl border-slate-50 bg-slate-50 text-slate-500 hover:bg-slate-700 hover:text-white hover:border-slate-600 transition-all duration-300 group/btn"
              onClick={() => onDelete(section.id)}
              disabled={!canEdit}
            >
              <Trash2 className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900 ml-1">Section Title</label>
                <Input
                  value={section.title || ''}
                  onChange={(e) => onChange({ ...section, title: e.target.value })}
                  className="border-black/10 h-16 text-sm font-bold font-sans focus:ring-4 focus:ring-indigo-100/10 focus:border-slate-700 rounded-[2.5rem] bg-white/50 focus:bg-white transition-all shadow-sm px-8"
                  placeholder="e.g. Our Mission"
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900 ml-1">Section Content</label>
                <Textarea
                  value={section.content || ''}
                  onChange={(e) => onChange({ ...section, content: e.target.value })}
                  className="min-h-[200px] border-black/10 text-sm font-bold font-sans focus:ring-4 focus:ring-indigo-100/10 focus:border-slate-700 rounded-[2.5rem] bg-white/50 focus:bg-white transition-all shadow-sm resize-none p-8"
                  placeholder="Describe your story or mission..."
                  disabled={!canEdit}
                />
              </div>


            </div>

            <div className="space-y-4 bg-white/40 p-6 rounded-[2.5rem] border border-black/5 shadow-inner">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-slate-700 rounded-full shadow-sm" />
                  <label className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900">Section Gallery</label>
                </div>
                <span className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                  {(section.images || []).length} Images
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {(section.images || []).map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-[2.5rem] overflow-hidden border border-black/5 bg-white group/img shadow-sm hover:shadow-md transition-all duration-300">
                    <img 
                      src={url} 
                      alt={`${section.title} ${idx}`} 
                      className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-16 w-16 rounded-[2.5rem] bg-white text-slate-600 hover:bg-slate-700 hover:text-white transition-all duration-300 transform scale-90 group-hover/img:scale-100"
                        onClick={() => onRemoveImage(section.id, url)}
                        disabled={!canEdit}
                      >
                        <Trash2 className="h-6 w-6" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div className={cn(
                  "aspect-square rounded-[2.5rem] border-2 border-dashed border-black/10 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-all duration-300 relative overflow-hidden group/add",
                  canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                )}>
                  <div className="p-3 bg-white rounded-[2.5rem] shadow-sm border border-black/5 mb-2 group-hover/add:scale-110 transition-transform">
                    <ImageIcon className="h-6 w-6 text-slate-900 group-hover/add:text-slate-600" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900 group-hover/add:text-slate-600">Add Media</span>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    className={cn(
                      "absolute inset-0 opacity-0 h-full",
                      canEdit ? "cursor-pointer" : "cursor-not-allowed"
                    )}
                    disabled={!canEdit}
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        const files = Array.from(e.target.files);
                        const hasInvalidFile = files.some(f => f.size > 1 * 1024 * 1024);
                        onUploadMultipleImages(section.id, e.target.files);
                        if (hasInvalidFile) {
                          e.target.value = ''; // Reset input if any files were rejected
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <p className="text-[11px] sm:text-xs font-bold font-sans uppercase tracking-tight text-slate-900 text-center mt-4">
                Max 1MB per file • JPG, PNG, WEBP
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-8 border-t border-black/5">
            <Button 
              onClick={() => onSave(section)}
              disabled={saving === section.id || !canEdit}
              className="bg-slate-700 hover:bg-slate-700/90 text-white shadow-xl shadow-slate-200/50 transition-all active:scale-[0.98] font-bold font-sans uppercase tracking-tight h-16 px-10 rounded-[2.5rem] w-full sm:w-auto disabled:opacity-50"
            >
              {saving === section.id ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  Save Section
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const AboutPageEditor = ({ canEdit = true }: { canEdit?: boolean }) => {
  const [sections, setSections] = useState<AboutSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [orderChanged, setOrderChanged] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      const { data, error } = await supabase
        .from('about_page')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      
      // Filter out specific sections as requested
      const filteredData = (data || []).filter(section => {
        const title = (section.title || '').toLowerCase();
        return !title.includes('safety is our top priority') && 
               !title.includes('expert flight instructor') && 
               !title.includes('flexible booking');
      });

      setSections(filteredData);
      setOrderChanged(false);
    } catch (error: any) {
      toast.error('Failed to load about page content');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (section: AboutSection) => {
    // Optimistic update
    setSections(sections.map(s => s.id === section.id ? section : s));
    
    setSaving(section.id);
    try {
      const { error } = await supabase
        .from('about_page')
        .update({
          title: section.title,
          content: section.content,
          image_url: section.image_url,
          images: section.images || [],
          bg_color: section.bg_color || '#ffffff',
          display_order: section.display_order // Include display order in case it changed
        })
        .eq('id', section.id);

      if (error) throw error;
      toast.success('Section updated successfully');
    } catch (error: any) {
      toast.error('Failed to update section');
      console.error(error);
      fetchSections(); // Revert on error
    } finally {
      setSaving(null);
    }
  };

  const handleSaveOrder = async () => {
    setLoading(true);
    try {
      const updates = sections.map((section, index) => ({
        id: section.id,
        display_order: index + 1
      }));

      await Promise.all(updates.map(update => 
        supabase.from('about_page').update({ display_order: update.display_order }).eq('id', update.id)
      ));

      toast.success('Order saved successfully');
      setOrderChanged(false);
    } catch (error) {
      console.error('Failed to save order:', error);
      toast.error('Failed to save new order');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      
      const newSections = arrayMove(sections, oldIndex, newIndex);
      
      // Update local state and mark order as changed
      setSections(newSections);
      setOrderChanged(true);
    }
  };

  const addNewSection = async () => {
    setLoading(true);
    try {
      const maxOrder = sections.length > 0 
        ? Math.max(...sections.map(s => s.display_order)) 
        : 0;

      const newSection = {
        section_key: `section_${Date.now()}`,
        title: 'New Section',
        content: 'Enter content here...',
        images: [],
        bg_color: '#ffffff',
        display_order: maxOrder + 1,
        additional_data: {}
      };

      const { data, error } = await supabase
        .from('about_page')
        .insert([newSection])
        .select()
        .single();

      if (error) throw error;
      
      setSections([...sections, data]);
      toast.success('New section added');
    } catch (error: any) {
      toast.error('Failed to add section');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this section?')) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('about_page')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setSections(sections.filter(s => s.id !== id));
      toast.success('Section deleted');
    } catch (error: any) {
      toast.error('Failed to delete section');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleMultipleImagesUpload = async (sectionId: string, files: FileList) => {
    try {
      // Check file sizes first
      const validFiles: File[] = [];
      Array.from(files).forEach(file => {
        if (file.size > 1 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large. Max 1MB allowed.`);
        } else {
          validFiles.push(file);
        }
      });

      if (validFiles.length === 0) return;

      const uploadPromises = validFiles.map(async (file) => {
        const compressedFile = await compressFile(file);
        const fileExt = compressedFile.name.split('.').pop();
        const fileName = `about-${sectionId}-${Math.random()}.${fileExt}`;
        const filePath = `about-page/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, compressedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        return publicUrl;
      });

      const newUrls = await Promise.all(uploadPromises);
      
      const updatedSections = sections.map(s => {
        if (s.id === sectionId) {
          const currentImages = s.images || [];
          return { ...s, images: [...currentImages, ...newUrls] };
        }
        return s;
      });
      
      setSections(updatedSections);
      
    } catch (error: any) {
      toast.error('Failed to upload images');
      console.error(error);
    }
  };

  const removeImage = (sectionId: string, imageUrl: string) => {
    const updatedSections = sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, images: (s.images || []).filter(url => url !== imageUrl) };
      }
      return s;
    });
    setSections(updatedSections);
  };

  // Keep compatibility with existing code calling handleImageUpload if any
  const handleImageUpload = async (sectionId: string, file: File) => {
    // Reuse logic or just forward to multiple upload
    // But since this is legacy or unused in new UI, we can keep it simple or remove it.
    // The new UI uses the multiple image uploader.
  };

  if (loading && sections.length === 0) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-900" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {orderChanged && (
            <Button 
              onClick={handleSaveOrder} 
              variant="secondary" 
              disabled={!canEdit}
              className="h-12 px-6 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-100 font-bold font-sans uppercase tracking-tight text-[11px] sm:text-xs rounded-2xl transition-all active:scale-95"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Order
            </Button>
          )}
          <Button 
            onClick={addNewSection} 
            disabled={!canEdit}
            className="h-12 px-6 bg-slate-700 hover:bg-slate-700/90 text-white shadow-xl shadow-slate-200/50 font-bold font-sans uppercase tracking-tight text-[11px] sm:text-xs rounded-2xl transition-all active:scale-95"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Section
          </Button>
          <Button 
            onClick={fetchSections} 
            variant="outline" 
            size="icon"
            className="h-12 w-12 rounded-2xl border-black/10 hover:bg-slate-50 transition-all active:scale-95 bg-white shadow-sm"
          >
            <Loader2 className={cn("h-5 w-5 text-slate-900", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="bg-slate-50/50 rounded-[2.5rem] p-4 sm:p-6 border border-black/5">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={sections.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-8">
              {sections.map((section) => (
                <SortableSection
                  key={section.id}
                  section={section}
                  onChange={(updated) => setSections(sections.map(s => s.id === updated.id ? updated : s))}
                  onSave={handleUpdate}
                  onRemoveImage={removeImage}
                  onUploadImage={handleImageUpload}
                  onUploadMultipleImages={handleMultipleImagesUpload}
                  onDelete={deleteSection}
                  saving={saving}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {sections.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="p-6 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-black/5">
              <FileText className="w-12 h-12 text-slate-900" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold font-sans uppercase tracking-tight text-slate-900">No sections found</p>
              <p className="text-xs text-slate-900 font-sans">Start by adding a new section to your about page.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
