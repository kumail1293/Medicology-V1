import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Undo2, Redo2, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Link2, ImagePlus,
  Table as TableIcon, Rows3, AlignLeft, AlignCenter, AlignRight, Highlighter,
  Code, RemoveFormatting, Plus, Minus, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { sanitizeRichHtml } from "@/lib/richText";
import { useToast } from "@/hooks/use-toast";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

function ToolbarButton({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none",
        active && "bg-primary/10 text-primary"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 160 }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: placeholder || "Write something…" }),
    ],
    content: value || "",
    onUpdate: ({ editor: ed }) => {
      onChange(sanitizeRichHtml(ed.getHTML()));
    },
  });

  // Sync external value changes (e.g. switching between cards/questions).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  const toggleLink = () => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Link URL (https://…)", "https://");
    if (url && /^(https?:|mailto:|tel:|\/)/.test(url)) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  const insertImageByUrl = () => {
    const url = window.prompt("Image URL (https://… or /uploads/…)");
    if (url && /^(https?:|data:image\/|\/)/.test(url)) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  };

  const uploadImage = async (file: File) => {
    try {
      setUploading(true);
      const urlRes = await apiFetch("/api/storage/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name }),
      });
      if (!urlRes.ok) throw new Error("Failed to request upload URL");
      const { objectPath } = await urlRes.json();

      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch(`/api/storage/upload/${objectPath.split("/").pop()}`, { method: "PUT", body: form });
      if (!upRes.ok) throw new Error("Upload failed");
      const { path } = await upRes.json();
      editor?.chain().focus().setImage({ src: `/api/storage${path}` }).run();
    } catch (err) {
      toast({ title: "Image upload failed", description: err instanceof Error ? err.message : "Please try again", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const insertTable = (rows: number, cols: number) => {
    editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setTableOpen(false);
  };

  const tableCmd = (fn: (ed: Editor) => void) => () => {
    if (editor) fn(editor);
    setTableOpen(false);
  };

  const btn = (active?: boolean, disabled?: boolean) => ({ active, disabled });

  return (
    <div className="rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-primary/30 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-2 py-1.5">
        <ToolbarButton title="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}><Undo2 size={15} /></ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}><Redo2 size={15} /></ToolbarButton>
        <Divider />
        <ToolbarButton title="Bold" {...btn(editor?.isActive("bold"))} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={15} /></ToolbarButton>
        <ToolbarButton title="Italic" {...btn(editor?.isActive("italic"))} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolbarButton>
        <ToolbarButton title="Underline" {...btn(editor?.isActive("underline"))} onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolbarButton>
        <ToolbarButton title="Strikethrough" {...btn(editor?.isActive("strike"))} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></ToolbarButton>
        <ToolbarButton title="Highlight" {...btn(editor?.isActive("highlight"))} onClick={() => editor?.chain().focus().toggleHighlight().run()}><Highlighter size={15} /></ToolbarButton>
        <Divider />
        <ToolbarButton title="Heading 1" {...btn(editor?.isActive("heading", { level: 1 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={15} /></ToolbarButton>
        <ToolbarButton title="Heading 2" {...btn(editor?.isActive("heading", { level: 2 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></ToolbarButton>
        <ToolbarButton title="Heading 3" {...btn(editor?.isActive("heading", { level: 3 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></ToolbarButton>
        <Divider />
        <ToolbarButton title="Bullet list" {...btn(editor?.isActive("bulletList"))} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={15} /></ToolbarButton>
        <ToolbarButton title="Numbered list" {...btn(editor?.isActive("orderedList"))} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolbarButton>
        <ToolbarButton title="Code block" {...btn(editor?.isActive("codeBlock"))} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code size={15} /></ToolbarButton>
        <Divider />
        <ToolbarButton title="Align left" {...btn(editor?.isActive({ textAlign: "left" }))} onClick={() => editor?.chain().focus().setTextAlign("left").run()}><AlignLeft size={15} /></ToolbarButton>
        <ToolbarButton title="Align center" {...btn(editor?.isActive({ textAlign: "center" }))} onClick={() => editor?.chain().focus().setTextAlign("center").run()}><AlignCenter size={15} /></ToolbarButton>
        <ToolbarButton title="Align right" {...btn(editor?.isActive({ textAlign: "right" }))} onClick={() => editor?.chain().focus().setTextAlign("right").run()}><AlignRight size={15} /></ToolbarButton>
        <Divider />
        <ToolbarButton title="Link" {...btn(editor?.isActive("link"))} onClick={toggleLink}><Link2 size={15} /></ToolbarButton>
        <ToolbarButton title="Insert image (URL)" onClick={insertImageByUrl}><ImagePlus size={15} /></ToolbarButton>
        <ToolbarButton title={uploading ? "Uploading…" : "Upload image"} onClick={() => fileRef.current?.click()}><ImagePlus size={15} className="text-blue-500" /></ToolbarButton>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ""; }} />
        <Divider />
        {/* Table */}
        <div className="relative">
          <ToolbarButton title="Table" {...btn(editor?.isActive("table"))} onClick={() => setTableOpen((v) => !v)}><TableIcon size={15} /></ToolbarButton>
          {tableOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-xl border border-border bg-card p-2 shadow-xl">
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Insert table</p>
              <div className="mb-2 grid grid-cols-2 gap-1">
                {[[2, 2], [3, 3], [4, 4], [5, 4]].map(([r, c]) => (
                  <button key={`${r}x${c}`} onClick={() => insertTable(r, c)} className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted">
                    {r}×{c}
                  </button>
                ))}
              </div>
              {editor?.isActive("table") && (
                <>
                  <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Edit table</p>
                  <div className="grid grid-cols-3 gap-1 text-[11px]">
                    <button onClick={tableCmd((ed) => ed.chain().focus().addRowAfter().run())} className="flex items-center justify-center gap-1 rounded-lg border border-border px-1 py-1 hover:bg-muted"><Plus size={10} /> Row</button>
                    <button onClick={tableCmd((ed) => ed.chain().focus().deleteRow().run())} className="flex items-center justify-center gap-1 rounded-lg border border-border px-1 py-1 hover:bg-muted"><Minus size={10} /> Row</button>
                    <button onClick={tableCmd((ed) => ed.chain().focus().addColumnAfter().run())} className="flex items-center justify-center gap-1 rounded-lg border border-border px-1 py-1 hover:bg-muted"><Plus size={10} /> Col</button>
                    <button onClick={tableCmd((ed) => ed.chain().focus().deleteColumn().run())} className="flex items-center justify-center gap-1 rounded-lg border border-border px-1 py-1 hover:bg-muted"><Minus size={10} /> Col</button>
                    <button onClick={tableCmd((ed) => ed.chain().focus().deleteTable().run())} className="col-span-2 flex items-center justify-center gap-1 rounded-lg border border-destructive/40 px-1 py-1 text-destructive hover:bg-destructive/10"><X size={10} /> Delete table</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <Divider />
        <ToolbarButton title="Clear formatting" onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}><RemoveFormatting size={15} /></ToolbarButton>
      </div>

      {/* Editor surface */}
      <div className="rich-text-editor px-3 py-2" style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
