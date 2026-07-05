import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";
import { indexPdf } from "./pdf-indexer.js";
import { retrieveChunks } from "./retriever.js";
import { generateAnswer } from "./generator.js";
import { config } from "dotenv";
import cors from "cors";

config();

const app = express();
app.use(cors());
app.use(express.json());


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "uploads");

// Create the uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// multer handles multipart/form-data — the format browsers use for file uploads
// diskStorage saves files to disk so pdf-parse can read them by path

// This code is configuring Multer so your server knows where to save uploaded PDFs, how to name them, and what files to allow.

// cb(error, result) 

const storage = multer.diskStorage({
    destination : (req,file,cb) => {
        cb(null,uploadsDir);
        // cb(error, destination) — null means no error
    },
    filename : (req,file,cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`
        cb(null,uniqueName);
    }
})

const upload = multer({
    storage,
    limits : {fileSize : 20 * 1024 * 1024},
    fileFilter : (req,file,cb)=> {
        if(file.mimetype === "application/pdf"){
            cb(null, true);
        }else {
            cb(new Error("Only PDF files are accepted"), false);
        }
    }
})

app.post("/upload", upload.single("pdf"), async (req,res) => {
    
    if(!req.file){
        return res.status(400).json({error : "No File uploaded"})
    }

    const filePath = req.file.path;

    try {
        const result = await indexPdf(filePath);

        // fs.unlinkSync(filePath);

        res.json({
            success : true,
            documentId : result.documentId,
            filename : req.file.originalname,
            chunkCount : result.chunkCount || null,
            alreadyIndexed : result.alreadyIndexed
        });

    } catch (error) {
        // if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        console.log("Upload error: ",error.message);
        res.status(500).json({
            success : false,
            error : error.message
        })
    }
})

app.post("/ask", async (req,res) => {
    const {documentId, question} = req.body;
    
    if(!documentId || !question){
        return res.status(400).json({
            error: "Both documentId and question are required",
            example: { documentId: 1, question: "What is the main topic?" }
        });
    }

    if(typeof question !== "string" || question.trim().length === 0){
        return res.status(400).json({ error: "question must be a non-empty string" });
    }

    const docresult = await pool.query(
        `SELECT id,filename FROM documents WHERE id=$1`,
        [documentId]
    )

    if(docresult.rows.length === 0){
        return res.status(404).json({
            error: `Document with id ${documentId} not found`,
            hint: "Upload the PDF first using POST /upload"
        });
    }

    try {
        const chunks = await retrieveChunks(question.trim(), documentId);

        const result = await generateAnswer(question.trim(), chunks);

        res.json({
            success : true,
            documentId,
            question : question.trim(),
            answer: result.answer,
            citations: result.citations,
            retrievedChunks: result.retrievedChunks
        })
    } catch (error) {
        console.error("Ask error:", error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
})

app.get("/documents", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, filename, num_pages, chunk_count, created_at
       FROM documents
       ORDER BY created_at DESC`
    );
    res.json({ success: true, documents: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("chunks/:id", async (req,res) => {
    const chunkId = parseInt(req.params.id);

    // parseInt converts the URL parameter string to a number
    // req.params.id is always a string — SQL needs an integer

    if (isNaN(chunkId)) {
        return res.status(400).json({ error: "chunk id must be a number" });
    }

    try {
    const result = await pool.query(
      `SELECT
         id,
         document_id,
         content,
         chunk_index,
         start_page,
         end_page,
         word_count
       FROM chunks
       WHERE id = $1`,
      [chunkId]
    );
    // Note: no embedding column — the vector is large (3072 floats) and
    // the frontend has no use for it. Never fetch data you don't need.

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Chunk ${chunkId} not found` });
    }

    const chunk = result.rows[0];
    res.json({
        success: true,
        chunk: {
            id: chunk.id,
            documentId: chunk.document_id,
            content: chunk.content,          // full text — not just 150-char preview
            chunkIndex: chunk.chunk_index,
            pageReference: chunk.start_page === chunk.end_page
            ? `page ${chunk.start_page}`
            : `pages ${chunk.start_page}–${chunk.end_page}`,
            startPage: chunk.start_page,
            endPage: chunk.end_page,
            wordCount: chunk.word_count
        }
    });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }

})

// GET /health — Railway's health check
// Returns 200 OK if the server is running
// Also checks database connectivity so you know the full stack is working
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    // SELECT 1 is the standard lightweight DB connectivity check
    // If this throws, the database connection is broken
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected"
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      error: err.message
    });
  }
});

// ── START SERVER ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ PDF Q&A API running on http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /upload      — upload a PDF (multipart/form-data, field: "pdf")`);
  console.log(`  POST /ask         — ask a question ({ documentId, question })`);
  console.log(`  GET  /documents   — list all indexed documents`);
});  