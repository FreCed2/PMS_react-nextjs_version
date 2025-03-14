"use client"; // Ensure this runs only on the client side

import { useEffect, useState, useCallback } from "react";
import { useRef } from "react";
import Draggable from "react-draggable"; // ✅ Import the draggable library
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

//import { SnippetExtension } from '../lib/tiptap-snippets-extension/src/components/extensions/snippet.ts';




// // ✅ Add this function here
// const addSnippet = async (name, snippet) => {
//   const newSnippet = { name, snippet };

//   try {
//     const response = await fetch("/api/snippets", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(newSnippet),
//     });

//     if (!response.ok) {
//       const error = await response.json();
//       alert(`Error: ${error.error}`);
//       return;
//     }

//     // ✅ Update state with new snippet
//     setSnippetsData((prev) => [...prev, newSnippet]); // ✅ Correct snippet state

//     alert("Snippet added successfully!");
//   } catch (error) {
//     console.error("Error saving snippet:", error);
//   }
// };

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

const handleEditorChange = (newContent) => {
  console.log("🔄 Tiptap Editor Change Detected:", newContent);
  onChange(newContent); // Calls handleChange in TaskModal
};

const TiptapEditor = ({ value, onChange, isDarkMode = false, selectedTask }) => {
    const [Snippets, setSnippets] = useState(null);
    const [snippets, setSnippetsData] = useState([]);
    const [snippetModalOpen, setSnippetModalOpen] = useState(false);
    const [isSnippetsOpen, setIsSnippetsOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("All"); // ✅ Selected category

    // ✅ Add these missing state variables for snippet input
    const [newSnippetName, setNewSnippetName] = useState("");  
    const [newSnippetContent, setNewSnippetContent] = useState(""); 
    const [newSnippetCategory, setNewSnippetCategory] = useState("Markdown"); // ✅ Default to "Markdown"

    const SnippetsModal = ({ isSnippetsOpen, setIsSnippetsOpen, selectedCategory, setSelectedCategory, snippets, editor }) => {
      const nodeRef = useRef(null); // ✅ Use a ref to prevent findDOMNode issues

      if (!isSnippetsOpen) return null; // ✅ Prevents rendering when closed
      return (
        <Draggable nodeRef={nodeRef} handle=".snippets-header">
          <div ref={nodeRef} className="snippets-modal">
            <div className="snippets-header">
              <h3>Saved Snippets</h3>
              <button className="close-btn" onClick={() => setIsSnippetsOpen(false)}>✖</button>
            </div>

            {/* ✅ Category Selector */}
            <div className="snippets-categories">
              {["All", "Markdown", "Code", "Text"].map((category) => (
                <button 
                  key={category} 
                  className={selectedCategory === category ? "active-category" : ""}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedCategory(category);
                  }}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* ✅ Filter snippets by category */}
            <ul className="snippets-list">
              {snippets
                .filter(snippet => selectedCategory === "All" || snippet.category === selectedCategory)
                .map((snippet, index) => (
                  <li key={index} className="snippet-item">
                    <button
                      className="snippet-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        editor.chain().focus().insertContent(snippet.snippet).run();
                      }}
                    >
                      {`"${snippet.name}"`}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </Draggable>
      );
    };

    // ✅ Keep other hooks (like useEffect) below the state hooks
    useEffect(() => {
      setIsClient(true);
    }, []);

    useEffect(() => {
      console.log("🔄 isSnippetsOpen changed:", isSnippetsOpen);
    }, [isSnippetsOpen]);

    const toggleSnippets = useCallback((event) => {
      console.log("📌 Snippets button clicked!"); // ✅ Debug Log
      event.preventDefault();
      event.stopPropagation();
    
      setIsSnippetsOpen((prev) => {
        console.log("Previous state of isSnippetsOpen:", prev);
        const newState = !prev;
        console.log("New state of isSnippetsOpen:", newState);
        return newState;
      });
    }, []);


    useEffect(() => {
      const fetchSnippets = async () => {
        try {
          const response = await fetch("/api/snippets");
          if (!response.ok) {
            throw new Error("Failed to fetch snippets");
          }
          const data = await response.json();

          console.log("Fetched Snippets Data:", data); // 🔍 Debug fetched data
          setSnippetsData(data); // ✅ Store fetched snippets in state
          
        } catch (error) {
          console.error("Error fetching snippets:", error);
        }
      };
      fetchSnippets();
    }, []);

    useEffect(() => {
      const toggleSnippets = (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === "S") {
          event.preventDefault();
          setIsSnippetsOpen((prev) => !prev); // ✅ Toggle modal on shortcut
        }
      };
    
      document.addEventListener("keydown", toggleSnippets);
      return () => document.removeEventListener("keydown", toggleSnippets);
    }, []);

    const handleEditorChange = (newContent) => {
      onChange(newContent);
    };

    const addSnippet = async (name, snippet) => {
      if (!name || !snippet) {
        alert("Snippet name and content are required.");
        return;
      }
    
      const newSnippet = { name, snippet };
    
      try {
        const response = await fetch("/api/snippets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSnippet),
        });
    
        if (!response.ok) {
          const error = await response.json();
          alert(`Error: ${error.error}`);
          return;
        }
    
        // ✅ Update state with new snippet immediately
        setSnippetsData((prev) => [...prev, newSnippet]);
        alert("Snippet added successfully!");
      } catch (error) {
        console.error("Error saving snippet:", error);
      }
    };


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
        // SnippetExtension, // ✅ Correctly imported Snippet extension
      ],
      content: value || "<p>Write your task description...</p>",
      onUpdate: ({ editor }) => handleEditorChange(editor.getHTML()),
      autofocus: true,
      immediatelyRender: false, // ✅ Fix hydration mismatch
  });

  useEffect(() => {
    if (!editor || !selectedTask?.id) return;

    // ✅ Load correct description from the database (not localStorage)
    if (selectedTask.description) {
        editor.commands.setContent(selectedTask.description);
    }
  }, [editor, selectedTask?.id]); 


  useEffect(() => {
    if (!editor || !selectedTask?.id) return;

    // Save draft for the specific task when content changes
    const saveDraft = () => {
        localStorage.setItem(`editorDraft-${selectedTask.id}`, editor.getHTML());
    };

    editor.on("update", saveDraft);

    return () => {
        editor.off("update", saveDraft);
    };
  }, [editor, selectedTask?.id]); // Runs when editor or selected task changes

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

  useEffect(() => {
    console.log("🔄 isSnippetsOpen changed:", isSnippetsOpen);
  }, [isSnippetsOpen]);

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
          onClick={(event) => {
            event.preventDefault();  // ✅ Prevents default behavior (useful for forms)
            event.stopPropagation(); // ✅ Stops event bubbling (avoids unintended modal closures)
            setSnippetModalOpen(true);
          }}
          aria-label="Open Snippets Modal" // ✅ Improves accessibility
        >
          Create/Edit Snippets
        </button>

        <button onClick={toggleSnippets}>
          Snippets
        </button>
        {/* <p>Snippets Open: {isSnippetsOpen.toString()}</p> */}
        
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

      {/* ✅ Create/Edit Snippet Modal JSX (Insert inside return statement of `TiptapEditor`)*/}
      {snippetModalOpen && (
        <div className="snippet-modal-overlay" onClick={() => setSnippetModalOpen(false)}>
          <div className="snippet-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create / Edit Snippet</h3>

            <label>Snippet Name:</label>
            <input
              type="text"
              value={newSnippetName}
              onChange={(e) => setNewSnippetName(e.target.value)}
              placeholder="Enter snippet name..."
            />

            <label>Snippet Category:</label>
            <select value={newSnippetCategory} onChange={(e) => setNewSnippetCategory(e.target.value)}>
              <option value="Markdown">Markdown</option>
              <option value="Code">Code</option>
              <option value="Text">Text</option>
            </select>

            <label>Snippet Content:</label>
            <textarea
              value={newSnippetContent}
              onChange={(e) => setNewSnippetContent(e.target.value)}
              placeholder="Enter snippet content..."
            />

            <div className="snippet-modal-actions">
              <button className="cancel-btn" onClick={() => setSnippetModalOpen(false)}>Cancel</button>
              <button className="save-btn" onClick={addSnippet}>Save Snippet</button>
            </div>
          </div>
        </div>
      )}
      
      {/* ✅ Snippets Modal (Now correctly placed inside TiptapEditor) */}
      <SnippetsModal
        isSnippetsOpen={isSnippetsOpen}
        setIsSnippetsOpen={setIsSnippetsOpen}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        snippets={snippets}
        editor={editor}
      />
    </div>
  );
};

// ✅ Named export for SnippetsModal (so it can be imported separately if needed)
export { SnippetsModal };

// ✅ Default export for TiptapEditor
export default TiptapEditor;