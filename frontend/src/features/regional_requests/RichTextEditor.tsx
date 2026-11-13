import { useEffect, useRef, useState } from "react";
import { Image } from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Icon from "../../shared/components/Icon";
import { uploadImage } from "./api";


export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: false, inline: false }),
      TableKit.configure({ table: { resizable: true } }),
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  async function addImage(file?: File) {
    if (!file || !editor) return;
    setUploading(true);
    setError("");
    try {
      const image = await uploadImage(file);
      editor.chain().focus().setImage({ src: image.url, alt: image.original_name }).run();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "이미지를 업로드할 수 없습니다.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const command = (label: string, action: () => void, active = false) => (
    <button
      type="button"
      className={active ? "is-active" : ""}
      aria-label={label}
      title={label}
      disabled={disabled || !editor}
      onClick={action}
    >
      {label}
    </button>
  );

  return (
    <div className={`regional-request-editor${fullscreen ? " is-fullscreen" : ""}`}>
      <div className="regional-request-editor-toolbar" role="toolbar" aria-label="내용 편집 도구">
        {command("굵게", () => editor?.chain().focus().toggleBold().run(), Boolean(editor?.isActive("bold")))}
        {command("기울임", () => editor?.chain().focus().toggleItalic().run(), Boolean(editor?.isActive("italic")))}
        {command("제목", () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), Boolean(editor?.isActive("heading", { level: 2 })))}
        {command("글머리", () => editor?.chain().focus().toggleBulletList().run(), Boolean(editor?.isActive("bulletList")))}
        {command("번호", () => editor?.chain().focus().toggleOrderedList().run(), Boolean(editor?.isActive("orderedList")))}
        <span className="regional-request-toolbar-divider" />
        {command("표 추가", () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
        {editor?.isActive("table") && (
          <>
            {command("행 추가", () => editor.chain().focus().addRowAfter().run())}
            {command("행 삭제", () => editor.chain().focus().deleteRow().run())}
            {command("열 추가", () => editor.chain().focus().addColumnAfter().run())}
            {command("열 삭제", () => editor.chain().focus().deleteColumn().run())}
            {command("표 삭제", () => editor.chain().focus().deleteTable().run())}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={(event) => void addImage(event.target.files?.[0])}
        />
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "업로드 중" : "이미지"}
        </button>
        <button
          type="button"
          className="regional-request-editor-expand"
          aria-label={fullscreen ? "편집기 축소" : "편집기 전체 화면"}
          title={fullscreen ? "편집기 축소" : "편집기 전체 화면"}
          onClick={() => setFullscreen((current) => !current)}
        >
          <Icon name={fullscreen ? "close" : "grid"} size={15} />
          {fullscreen ? "축소" : "전체 화면"}
        </button>
      </div>
      <EditorContent editor={editor} />
      {error && <p className="regional-request-editor-error" role="alert">{error}</p>}
    </div>
  );
}
