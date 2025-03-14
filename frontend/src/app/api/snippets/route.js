import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "src", "data", "snippets.json");

export async function GET() {
  try {
    const fileData = fs.readFileSync(filePath, "utf-8");
    const snippets = JSON.parse(fileData);

    return new Response(JSON.stringify(snippets), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error reading snippets.json:", error);
    return new Response(JSON.stringify({ error: "Failed to load snippets." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(req) {
  try {
    const { name, snippet } = await req.json();
    if (!name || !snippet) {
      return new Response(JSON.stringify({ error: "Name and snippet content are required!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fileData = fs.readFileSync(filePath, "utf-8");
    const snippets = JSON.parse(fileData);

    // Add new snippet
    const newSnippet = { name, snippet };
    snippets.push(newSnippet);

    // Save back to file
    fs.writeFileSync(filePath, JSON.stringify(snippets, null, 2));

    return new Response(JSON.stringify(newSnippet), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error saving snippet:", error);
    return new Response(JSON.stringify({ error: "Failed to save snippet." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}