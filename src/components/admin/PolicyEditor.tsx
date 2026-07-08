import React, { useState, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'quill/dist/quill.snow.css';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Scale } from "lucide-react";
import ImageResize from 'quill-image-resize-module-react';
import { cn } from "@/lib/utils";

// Register modules if they haven't been registered yet
// Note: DocumentTemplates.tsx also registers these, but we ensure it here too
// to avoid dependency on execution order.
try {
  Quill.register('modules/imageResize', ImageResize);
} catch (e) {
  // Ignore if already registered
}

interface PolicyEditorProps {
  title: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  canEdit?: boolean;
}

export function PolicyEditor({ title, initialContent, onSave, canEdit = true }: PolicyEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  // Update local state when initialContent changes (e.g. after fetch)
  React.useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(content);
    } finally {
      setSaving(false);
    }
  };

  const modules = useMemo(() => {
    return {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
        ['link', 'image'],
        ['clean']
      ],
      imageResize: {
        parchment: Quill.import('parchment'),
        modules: ['Resize', 'DisplaySize']
      }
    };
  }, []);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image',
    'width', 'height', 'style', 'alt',
    'background', 'color', 'align'
  ];

  return (
    <Card className="border-black/5 shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-6 border-b border-black/5 bg-slate-50/50 p-6 sm:p-10">
        <Button 
          onClick={handleSave} 
          disabled={saving || !canEdit}
          className="h-16 px-10 bg-slate-700 hover:bg-slate-700/90 text-white shadow-xl shadow-slate-200/50 transition-all active:scale-[0.98] font-bold uppercase tracking-tight rounded-[2.5rem] w-full sm:w-auto disabled:opacity-50"
        >
          {saving ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />}
          {canEdit ? 'Save Policy' : 'Read Only Mode'}
        </Button>
      </CardHeader>
      <CardContent className="p-6 sm:p-10">
        <div className={cn(
          "bg-white text-black rounded-[2rem] overflow-hidden border border-black/5 shadow-inner",
          !canEdit && "opacity-90 grayscale-[0.2]"
        )}>
          <ReactQuill
            theme="snow"
            value={content}
            onChange={setContent}
            modules={canEdit ? modules : { toolbar: false }}
            formats={formats}
            readOnly={!canEdit}
            className="min-h-[400px]"
          />
        </div>
        <style>{`
          .ql-toolbar.ql-snow {
            border: none !important;
            border-bottom: 1px solid rgba(0,0,0,0.05) !important;
            padding: 1.5rem !important;
            background: rgba(248, 250, 252, 0.5) !important;
          }
          .ql-container.ql-snow {
            border: none !important;
          }
          .ql-editor {
            min-height: 400px;
            padding: 2rem !important;
            font-size: 16px !important;
            line-height: 1.6 !important;
          }
          .ql-editor p {
            margin-bottom: 1rem !important;
          }
        `}</style>
      </CardContent>
    </Card>
  );
}
