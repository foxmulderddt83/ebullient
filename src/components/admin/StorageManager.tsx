import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Folder,
  File,
  Trash2,
  Upload,
  Image as ImageIcon,
  FileText,
  Video,
  Download,
  Search,
  ChevronRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  PieChart,
  HardDrive,
  Files,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { compressFile } from "@/utils/fileCompression";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Progress } from "@/components/ui/progress";

interface StorageItem {
  name: string;
  id: string | null;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, any> | null;
}

export const StorageManager = ({ canEdit = true }: { canEdit?: boolean }) => {
  const bucketName = import.meta.env.VITE_SUPABASE_BUCKET || "media";
  const [currentPath, setCurrentPath] = useState<string>("");
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [folderDetails, setFolderDetails] = useState<Record<string, { size: number; count: number }>>({});
  const [totalBucketUsage, setTotalBucketUsage] = useState(0);
  const STORAGE_QUOTA = 1024 * 1024 * 1024; // 1GB default for Supabase Free Tier

  const fetchTotalUsage = async () => {
    try {
      const { data: rootItems } = await supabase.storage.from(bucketName).list("", { limit: 1000 });
      if (!rootItems) return;

      let total = 0;
      
      // Calculate files in root
      total += rootItems.filter(i => i.id).reduce((acc, curr) => acc + (curr.metadata?.size || 0), 0);

      // Get sizes for all folders
      const folders = rootItems.filter(i => !i.id);
      await Promise.all(folders.map(async (folder) => {
        const { data: contents } = await supabase.storage.from(bucketName).list(folder.name, { limit: 1000 });
        if (contents) {
          total += contents.reduce((acc, curr) => acc + (curr.metadata?.size || 0), 0);
        }
      }));

      setTotalBucketUsage(total);
    } catch (error) {
      console.error("Error calculating total usage:", error);
    }
  };

  const fetchItems = async (path: string = "") => {
    setLoading(true);
    setSelectedItems([]); // Reset selection on path change
    fetchTotalUsage(); // Refresh total usage when browsing
    try {
      const { data, error } = await supabase.storage.from(bucketName).list(path, {
        limit: 1000,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) throw error;
      const fetchedItems = data || [];
      setItems(fetchedItems);

      // Fetch folder stats for each folder in parallel
      const folders = fetchedItems.filter(item => !item.id);
      if (folders.length > 0) {
        const stats: Record<string, { size: number; count: number }> = {};
        await Promise.all(folders.map(async (folder) => {
          const folderPath = path ? `${path}/${folder.name}` : folder.name;
          const { data: contents } = await supabase.storage.from(bucketName).list(folderPath, { limit: 1000 });
          if (contents) {
            stats[folder.name] = {
              count: contents.length,
              size: contents.reduce((acc, curr) => acc + (curr.metadata?.size || 0), 0)
            };
          }
        }));
        setFolderDetails(stats);
      } else {
        setFolderDetails({});
      }
    } catch (error: any) {
      console.error("Error fetching storage items:", error);
      toast.error(error.message || "Failed to load storage items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(currentPath);
  }, [currentPath]);

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      toast.error("Failed to copy URL");
    }
  };

  const handleNavigate = (folderName: string) => {
    setCurrentPath((prev) => (prev ? `${prev}/${folderName}` : folderName));
  };

  const handleNavigateUp = () => {
    setCurrentPath((prev) => {
      const parts = prev.split("/");
      parts.pop();
      return parts.join("/");
    });
  };

  const handleDelete = async (itemName: string, isFolder: boolean = false) => {
    if (!window.confirm(`Are you sure you want to delete ${isFolder ? 'folder and all its contents' : itemName}?`)) return;

    const toastId = toast.loading(`Deleting ${isFolder ? 'folder' : 'file'}...`);
    try {
      const pathToDelete = currentPath ? `${currentPath}/${itemName}` : itemName;
      
      if (isFolder) {
        // To delete a folder in Supabase, we must list and delete all files within it recursively
        const { data: filesInFolder, error: listError } = await supabase.storage
          .from(bucketName)
          .list(pathToDelete, { limit: 1000 });
        
        if (listError) throw listError;

        if (filesInFolder && filesInFolder.length > 0) {
          const filePaths = filesInFolder.map(f => `${pathToDelete}/${f.name}`);
          const { error: deleteError } = await supabase.storage.from(bucketName).remove(filePaths);
          if (deleteError) throw deleteError;
        }
        // Note: Empty folders in Supabase are just prefixes, they "disappear" when files are gone
      } else {
        const { error } = await supabase.storage.from(bucketName).remove([pathToDelete]);
        if (error) throw error;
      }

      toast.success(`${isFolder ? 'Folder' : 'File'} deleted successfully`, { id: toastId });
      fetchItems(currentPath);
    } catch (error: any) {
      console.error("Error deleting item:", error);
      toast.error(error.message || "Failed to delete item", { id: toastId });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedItems.length} selected items? Folders will be emptied.`)) return;

    const toastId = toast.loading(`Deleting ${selectedItems.length} items...`);
    try {
      const pathsToDelete: string[] = [];
      
      for (const name of selectedItems) {
        const fullPath = currentPath ? `${currentPath}/${name}` : name;
        const item = items.find(i => i.name === name);
        
        if (item && !item.id) {
          // It's a folder, get its contents
          const { data: subFiles } = await supabase.storage.from(bucketName).list(fullPath, { limit: 1000 });
          if (subFiles) {
            subFiles.forEach(sf => pathsToDelete.push(`${fullPath}/${sf.name}`));
          }
        } else {
          pathsToDelete.push(fullPath);
        }
      }

      if (pathsToDelete.length > 0) {
        const { error } = await supabase.storage.from(bucketName).remove(pathsToDelete);
        if (error) throw error;
      }

      toast.success("Items deleted successfully", { id: toastId });
      fetchItems(currentPath);
    } catch (error: any) {
      console.error("Error bulk deleting files:", error);
      toast.error(error.message || "Failed to delete items", { id: toastId });
    }
  };

  const toggleSelectItem = (name: string) => {
    setSelectedItems(prev => 
      prev.includes(name) 
        ? prev.filter(item => item !== name) 
        : [...prev, name]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(filteredItems.map(item => item.name));
    } else {
      setSelectedItems([]);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const toastId = toast.loading("Uploading...");

    try {
      for (let i = 0; i < files.length; i++) {
        let file = files[i];
        
        // Compress images
        if (file.type.startsWith('image/')) {
          file = await compressFile(file);
        }

        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;

        const { error } = await supabase.storage.from(bucketName).upload(filePath, file);

        if (error) throw error;
      }

      toast.success("Files uploaded successfully", { id: toastId });
      fetchItems(currentPath);
    } catch (error: any) {
      console.error("Error uploading files:", error);
      toast.error(error.message || "Failed to upload files", { id: toastId });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const getFileIcon = (mimetype: string) => {
    if (!mimetype) return <File className="w-5 h-5 text-slate-400" />;
    if (mimetype.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (mimetype.startsWith("video/")) return <Video className="w-5 h-5 text-purple-500" />;
    if (mimetype.includes("pdf") || mimetype.includes("document")) return <FileText className="w-5 h-5 text-red-500" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const folders = filteredItems.filter((item) => !item.id);
  const files = filteredItems.filter((item) => item.id);

  // Group files by type
  const groupedFiles = files.reduce((acc: Record<string, StorageItem[]>, file) => {
    const mimetype = file.metadata?.mimetype || "";
    let group = "Others";
    if (mimetype.startsWith("image/")) group = "Images";
    else if (mimetype.startsWith("video/")) group = "Videos";
    else if (mimetype.includes("pdf") || mimetype.includes("document") || mimetype.includes("spreadsheet")) group = "Documents";
    
    if (!acc[group]) acc[group] = [];
    acc[group].push(file);
    return acc;
  }, {});

  const stats = {
    totalSize: files.reduce((acc, file) => acc + (file.metadata?.size || 0), 0),
    fileCount: files.length,
    folderCount: folders.length,
    types: files.reduce((acc: Record<string, { count: number, size: number }>, file) => {
      const type = file.metadata?.mimetype?.split('/')[0] || 'other';
      if (!acc[type]) acc[type] = { count: 0, size: 0 };
      acc[type].count++;
      acc[type].size += (file.metadata?.size || 0);
      return acc;
    }, {})
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          <div className="bg-slate-700 p-2.5 rounded-[1.25rem] border border-slate-200 shadow-xl shadow-slate-200/50">
            <Folder className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 uppercase tracking-tight leading-none">Storage</h3>
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 flex items-center gap-2">
              <span className="h-px w-3 bg-slate-200" />
              Manage bucket files
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => fetchItems(currentPath)}
            disabled={loading}
            className="h-10 px-4 rounded-xl border-black/5 bg-white shadow-sm font-bold text-[11px] uppercase tracking-tight"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <div className="relative">
            <input
              type="file"
              multiple
              onChange={handleUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              disabled={uploading || !canEdit}
            />
            <Button
              className="h-10 px-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 shadow-lg shadow-slate-900/20 font-bold text-[11px] uppercase tracking-tight"
              disabled={uploading || !canEdit}
            >
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-black/5 rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bucket Usage</p>
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-lg font-bold text-slate-900">{formatSize(totalBucketUsage)}</p>
              <p className="text-[10px] font-bold text-slate-400">/ {formatSize(STORAGE_QUOTA)}</p>
            </div>
            <Progress 
              value={(totalBucketUsage / STORAGE_QUOTA) * 100} 
              className="h-1.5 bg-slate-100"
              indicatorClassName={totalBucketUsage / STORAGE_QUOTA > 0.9 ? "bg-red-500" : "bg-blue-500"}
            />
          </div>
        </Card>
        <Card className="p-4 border-black/5 rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-500 shrink-0">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available Space</p>
            <p className="text-lg font-bold text-slate-900">{formatSize(Math.max(0, STORAGE_QUOTA - totalBucketUsage))}</p>
          </div>
        </Card>
        <Card className="p-4 border-black/5 rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 shrink-0">
            <Files className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current View</p>
            <p className="text-lg font-bold text-slate-900">{stats.fileCount} Files, {stats.folderCount} Folders</p>
          </div>
        </Card>
        <Card className="p-4 border-black/5 rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
            <PieChart className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Type Breakdown</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.types).map(([type, data]) => (
                <div key={type} className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-md border border-black/5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    type === 'image' ? 'bg-blue-400' : 
                    type === 'video' ? 'bg-purple-400' : 
                    type === 'application' ? 'bg-red-400' : 'bg-slate-400'
                  }`} />
                  <span className="text-[9px] font-bold text-slate-600 uppercase">{type[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card className="border border-black/5 rounded-[2rem] bg-white/50 backdrop-blur-sm shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        {/* Toolbar */}
        <div className="p-4 border-b border-black/5 bg-white/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNavigateUp}
                disabled={!currentPath}
                className="h-8 w-8 rounded-lg hover:bg-slate-100"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg border border-black/5">
                <span className="text-[11px] font-bold uppercase tracking-tight">{bucketName}</span>
                {currentPath && (
                  <>
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-900">{currentPath}</span>
                  </>
                )}
              </div>
            </div>

            {/* Select All */}
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-black/5">
              <Checkbox 
                id="select-all"
                checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                onCheckedChange={handleSelectAll}
                className="h-4 w-4 rounded border-slate-300 data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700"
              />
              <label htmlFor="select-all" className="text-[10px] font-bold uppercase tracking-wider cursor-pointer">
                Select All ({selectedItems.length})
              </label>
            </div>

            {selectedItems.length > 0 && canEdit && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="h-8 px-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] uppercase tracking-tight shadow-sm transition-all animate-in fade-in zoom-in-95"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Selected
              </Button>
            )}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-xl border-black/5 bg-slate-50 text-[11px] font-bold"
            />
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-[11px] font-bold uppercase tracking-tight">Loading...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3 bg-slate-50/50 rounded-2xl border border-dashed border-black/10 m-4">
              <Folder className="w-8 h-8 text-slate-300" />
              <p className="text-[11px] font-bold uppercase tracking-tight">No files found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Folders Section */}
              {folders.length > 0 && (
                <div className="col-span-full mb-6">
                  <div className="flex items-center gap-2 mb-4 px-2">
                    <Folder className="w-4 h-4 text-blue-500" />
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Folders</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {folders.map((folder) => {
                      const isSelected = selectedItems.includes(folder.name);
                      const detail = folderDetails[folder.name];
                      return (
                        <div
                          key={folder.name}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button, .checkbox-container')) return;
                            handleNavigate(folder.name);
                          }}
                          className={`flex items-center gap-3 p-4 rounded-2xl border transition-all group cursor-pointer relative ${
                            isSelected 
                              ? "border-slate-800 bg-slate-50 ring-2 ring-slate-800/20" 
                              : "border-black/5 bg-white hover:border-blue-500/50 hover:shadow-md"
                          }`}
                        >
                          {/* Checkbox */}
                          <div 
                            className={`checkbox-container transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectItem(folder.name)}
                              className="h-4 w-4 rounded border-slate-300 bg-white data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700"
                            />
                          </div>

                          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <Folder className="w-5 h-5 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-slate-900 truncate">{folder.name}</p>
                            {detail && (
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                {detail.count} items • {formatSize(detail.size)}
                              </p>
                            )}
                          </div>

                          {/* Delete folder button */}
                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(folder.name, true);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all"
                              title="Delete Folder"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Grouped Files Sections */}
              {Object.entries(groupedFiles).map(([groupName, groupItems]) => (
                <div key={groupName} className="col-span-full mb-8 last:mb-0">
                  <div className="flex items-center gap-2 mb-4 px-2">
                    {groupName === "Images" && <ImageIcon className="w-4 h-4 text-blue-500" />}
                    {groupName === "Videos" && <Video className="w-4 h-4 text-purple-500" />}
                    {groupName === "Documents" && <FileText className="w-4 h-4 text-red-500" />}
                    {groupName === "Others" && <File className="w-4 h-4 text-slate-500" />}
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      {groupName} ({groupItems.length})
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {groupItems.map((file) => {
                      const url = supabase.storage.from(bucketName).getPublicUrl(currentPath ? `${currentPath}/${file.name}` : file.name).data.publicUrl;
                      const isImage = file.metadata?.mimetype?.startsWith('image/');
                      const isSelected = selectedItems.includes(file.name);

                      return (
                        <div
                          key={file.name}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button, a')) return;
                            toggleSelectItem(file.name);
                          }}
                          className={`flex flex-col p-3 rounded-2xl border transition-all group relative cursor-pointer ${
                            isSelected 
                              ? "border-slate-800 bg-slate-50 ring-2 ring-slate-800/20" 
                              : "border-black/5 bg-white hover:border-slate-300 hover:shadow-md"
                          }`}
                        >
                          {/* Checkbox Overlay */}
                          <div className={`absolute top-4 left-4 z-10 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectItem(file.name)}
                              className="h-5 w-5 rounded-md border-slate-300 bg-white data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700 shadow-md"
                            />
                          </div>

                          <div className="aspect-video w-full rounded-xl bg-slate-50 border border-black/5 flex items-center justify-center overflow-hidden mb-3 relative group-hover:border-slate-200 transition-colors">
                            {isImage ? (
                              <img src={url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              getFileIcon(file.metadata?.mimetype || "")
                            )}
                            
                            {/* Hover Overlay Actions */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                              <a 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-8 h-8 rounded-lg bg-white text-slate-900 flex items-center justify-center hover:scale-110 transition-transform"
                                title="View"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyUrl(url);
                                  }}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center hover:scale-110 transition-transform ${copiedUrl === url ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900'}`}
                                  title="Copy URL"
                                >
                                  {copiedUrl === url ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewImage({ url, name: file.name });
                                    setZoom(1);
                                  }}
                                className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center hover:scale-110 transition-transform"
                                title="Preview"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {canEdit && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(file.name);
                                  }}
                                  className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center hover:scale-110 transition-transform"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-slate-900 truncate" title={file.name}>
                              {file.name}
                            </p>
                            <div className="flex items-center justify-between mt-1 text-[9px] font-medium text-slate-500 uppercase tracking-tight">
                              <span>{formatSize(file.metadata?.size || 0)}</span>
                              <span>{file.updated_at ? format(new Date(file.updated_at), "MMM d, yyyy") : ""}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden flex flex-col rounded-3xl border-none shadow-2xl bg-slate-950/90 backdrop-blur-xl">
          <DialogHeader className="p-4 border-b border-white/10 flex flex-row items-center justify-between shrink-0 bg-black/40">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-2 rounded-xl">
                <ImageIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-white text-sm font-bold uppercase tracking-tight truncate max-w-[200px] sm:max-w-md">
                  {previewImage?.name}
                </DialogTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Image Preview</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mr-8">
              <div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom(prev => Math.max(0.1, prev - 0.25))}
                  className="h-8 w-8 text-white hover:bg-white/10 rounded-lg"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <div className="px-3 text-[11px] font-bold text-white min-w-[60px] text-center">
                  {Math.round(zoom * 100)}%
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom(prev => Math.min(5, prev + 0.25))}
                  className="h-8 w-8 text-white hover:bg-white/10 rounded-lg"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(1)}
                className="h-10 w-10 text-white hover:bg-white/10 rounded-xl border border-white/10"
                title="Reset Zoom"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewImage(null)}
                className="h-10 w-10 text-white hover:bg-red-500 hover:text-white rounded-xl border border-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] flex items-center justify-center p-4 sm:p-12 scrollbar-hide">
            <div 
              className="transition-transform duration-200 ease-out cursor-grab active:cursor-grabbing"
              style={{ transform: `scale(${zoom})` }}
            >
              <img
                src={previewImage?.url}
                alt={previewImage?.name}
                className="max-w-none shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-lg border border-white/10"
                onDragStart={(e) => e.preventDefault()}
              />
            </div>
          </div>

          <div className="p-4 bg-black/60 border-t border-white/10 text-center shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Use mouse wheel to zoom (Alt + Scroll) • Click and drag to pan
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorageManager;
