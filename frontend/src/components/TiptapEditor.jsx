"use client"; // Ensure this runs only on the client side

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Link from "@tiptap/extension-link";
import { Color } from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import ListItem from "@tiptap/extension-list-item";
import Placeholder from "@tiptap/extension-placeholder";
import "../app/styles/tiptap.scss"; // Ensure the correct path to styles
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { common, createLowlight } from "lowlight";
import js from "highlight.js/lib/languages/javascript";
import css from "highlight.js/lib/languages/css";
import python from "highlight.js/lib/languages/python";

// 🔹 Setup Lowlight with Syntax Highlighting
const lowlight = createLowlight(common);
lowlight.register("javascript", js);
lowlight.register("css", css);
lowlight.register("python", python);


// 🔹 Custom CodeBlock Component (Ensuring it's Defined)
const CustomCodeBlock = (props) => {
  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(props.node.textContent).then(() => {
      alert("Copied to clipboard!");
    });
  };

  return (
    <NodeViewWrapper as="div" className="relative">
      <button
        className="absolute top-2 right-2 px-2 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-600"
        onClick={copyCodeToClipboard}
      >
        📋 Copy
      </button>
      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
};

// Register Custom CodeBlock
const CustomCodeBlockExtension = CodeBlockLowlight.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      exitOnArrowDown: false, // Prevents Enter from splitting into multiple code blocks
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CustomCodeBlock);
  },
});



const TiptapEditor = ({ value, onChange, isDarkMode = false }) => {
    const [isClient, setIsClient] = useState(false);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({ 
          heading: { levels: [1, 2, 3, 4] },
          bulletList: { keepMarks: true, keepAttributes: false },
          orderedList: { keepMarks: true, keepAttributes: false },
        }),
        Color.configure({ types: [TextStyle.name, ListItem.name] }),
        TextStyle.configure({ types: [ListItem.name] }),
        Placeholder.configure({ placeholder: "Write your task description..." }),
        Link.configure({
          openOnClick: true, // Links are clickable
          autolink: true, // Automatically converts URLs into clickable links
          HTMLAttributes: {
            rel: "noopener noreferrer",
            target: "_blank", // Opens in new tab
          },
        }),
        CustomCodeBlockExtension.configure({ lowlight }), // ✅ Fixed CodeBlock
      ],
      content: value || "<p>Write your task description...</p>",
      onUpdate: ({ editor }) => onChange(editor.getHTML()),
      autofocus: true,
      immediatelyRender: false, // ✅ Fix hydration mismatch
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => console.log("⛔ Page is reloading!");
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // 🔹 Fix: Handle Paste Correctly
  useEffect(() => {
    if (!editor) return;
  
    const handlePaste = (event) => {
      const clipboardData = event.clipboardData || window.clipboardData;
      const pastedText = clipboardData.getData("text");

      if (editor.isActive("codeBlock")) {
        event.preventDefault();
        editor.chain().focus().insertContent(pastedText).run();
      }
    };
    
    document.addEventListener("paste", handlePaste);
      
    return () => {
      document.removeEventListener("paste", handlePaste);
      };
    }, [editor]); // ✅ No conditional hook calls
  
    if (!isClient || !editor) {
      return <p>Loading editor...</p>;
    }

  // ✅ Helper function to prevent modal closure & handle formatting actions
  const handleButtonClick = (event, command, options = {}) => {
    event.preventDefault();
    event.stopPropagation();

    if (command === "toggleCodeBlock") {
      editor.chain().focus().toggleCodeBlock().run();
      return;
    }

    editor.chain().focus()[command](options).run();
  };
  



  return (
    <div className={`tiptap-container ${isDarkMode ? "dark-theme" : ""}`} onMouseDown={(e) => e.stopPropagation()}>
      {/* Toolbar */}
      <div className="tiptap-toolbar">
      <button
          type="button"
          onMouseDown={(e) => handleButtonClick(e, "toggleHeading", { level: 1 })}
          className={editor.isActive("heading", { level: 1 }) ? "active" : ""}
        >
          H1
        </button>

        <button
          type="button"
          onMouseDown={(e) => handleButtonClick(e, "toggleHeading", { level: 2 })}
          className={editor.isActive("heading", { level: 2 }) ? "active" : ""}
        >
          H2
        </button>

        <button
          type="button"
          onMouseDown={(e) => handleButtonClick(e, "toggleHeading", { level: 3 })}
          className={editor.isActive("heading", { level: 3 }) ? "active" : ""}
        >
          H3
        </button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "toggleBold")}>Bold</button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "toggleItalic")}>Italic</button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "toggleStrike")}>Strike</button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "toggleCodeBlock")}>Code Block</button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "unsetAllMarks")}>Clear marks</button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "clearNodes")}>Clear nodes</button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "toggleBulletList")}>Bullet list</button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "toggleOrderedList")}>Ordered list</button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "toggleBlockquote")}>Blockquote</button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "setHorizontalRule")}>Horizontal rule</button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "setHardBreak")}>Hard break</button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "undo")} disabled={!editor.can().chain().focus().undo().run()}>
          Undo
        </button>
        <button type="button" onMouseDown={(e) => handleButtonClick(e, "redo")} disabled={!editor.can().chain().focus().redo().run()}>
          Redo
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            const previousUrl = editor.getAttributes("link").href;
            const url = window.prompt("Enter a URL", previousUrl || "https://");

            if (url === null) return; // Do nothing if user cancels
            if (url === "") {
              handleButtonClick(e, "unsetLink"); // Remove link if empty
            } else {
              handleButtonClick(e, "setLink", { href: url }); // Apply new link
            }
          }}
          className={editor.isActive("link") ? "active" : ""}
        >
          🔗 Link
        </button>
      </div>

      {/* The Editor */}
      <div className="tiptap-editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default TiptapEditor;