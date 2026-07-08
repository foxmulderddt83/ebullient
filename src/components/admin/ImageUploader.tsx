import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { compressFile } from "@/utils/fileCompression";

interface ImageUploaderProps {
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  bucketName?: string;
  folderPath?: string;
}

export const ImageUploader = ({ 
  currentImageUrl, 
  onImageUploaded, 
  bucketName = "media",
  folderPath = "uploads"
}: ImageUploaderProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (1MB limit for all files)
    if (file.size > 1 * 1024 * 1024) {
      toast({ 
        title: "File too large", 
        description: "File size exceeds the 1MB limit.",
        variant: "destructive" 
      });
      e.target.value = ''; // Reset input
      return;
    }

    if (!supabase) {
      toast({ title: "Supabase not configured", variant: "destructive" });
      return;
    }

    try {
      setIsUploading(true);
      const compressedFile = await compressFile(file);
      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${folderPath}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, compressedFile, { upsert: true, cacheControl: '31536000' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      onImageUploaded(publicUrl);
      toast({ title: "Image uploaded successfully" });
    } catch (error: any) {
      toast({ 
        title: "Upload failed", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4 overflow-hidden">
      <div className="flex flex-col xs:flex-row items-start gap-4">
        {currentImageUrl && (
          <div className="relative w-full xs:w-32 h-32 rounded-lg overflow-hidden border bg-muted shrink-0">
            <img 
              src={currentImageUrl} 
              alt="Preview" 
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => onImageUploaded("")}
              className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        <div className="flex-1 w-full space-y-2 min-w-0">
          <div className="flex gap-2 w-full">
            <Input
              type="text"
              value={currentImageUrl || ""}
              onChange={(e) => onImageUploaded(e.target.value)}
              placeholder="https://..."
              className="flex-1 w-full text-[11px] sm:text-xs truncate"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="relative overflow-hidden bg-slate-700 hover:bg-slate-700/90 text-white font-bold border-none shadow-md transition-all active:scale-[0.98] h-9 px-4 text-[11px] sm:text-xs shrink-0"
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload Image
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleUpload}
                accept="image/*"
                disabled={isUploading}
              />
            </Button>
            <span className="text-[11px] sm:text-xs text-slate-900">
              Max 1MB. JPG, PNG, WebP.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
