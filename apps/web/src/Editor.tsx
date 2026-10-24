import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Undo,
  Redo,
} from "lucide-react";
import { Button } from "./ui";
export default function Editor({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: (() => {
      try {
        return JSON.parse(value);
      } catch {
        return {
          type: "doc",
          content: (value || "")
            .split("\n")
            .map((text) => ({
              type: "paragraph",
              content: text ? [{ type: "text", text }] : [],
            })),
        };
      }
    })(),
    onUpdate: ({ editor }) => onChange(JSON.stringify(editor.getJSON())),
    editorProps: {
      attributes: { class: "rich-editor", "aria-label": "Isi catatan" },
    },
  });
  if (!editor) return null;
  return (
    <div className="editor">
      <div className="toolbar">
        {[
          [Bold, () => editor.chain().focus().toggleBold().run(), "Bold"],
          [Italic, () => editor.chain().focus().toggleItalic().run(), "Italic"],
          [
            Heading2,
            () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            "Heading",
          ],
          [
            List,
            () => editor.chain().focus().toggleBulletList().run(),
            "Bullet list",
          ],
          [
            ListOrdered,
            () => editor.chain().focus().toggleOrderedList().run(),
            "Numbered list",
          ],
          [Undo, () => editor.chain().focus().undo().run(), "Undo"],
          [Redo, () => editor.chain().focus().redo().run(), "Redo"],
        ].map(([Icon, run, label]: any) => (
          <Button
            key={label}
            variant="ghost"
            type="button"
            title={label}
            aria-label={label}
            onClick={run}
          >
            <Icon size={16} />
          </Button>
        ))}
      </div>
      <EditorContent editor={editor} />
      <small>Format editor tersimpan otomatis dalam draft lokal.</small>
    </div>
  );
}
