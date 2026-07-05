import path from "path";
import { pool } from "./db.js";
import { generateEmbedding, EMBEDDING_DIMENSIONS } from "./embeddings.js";
import { safeExtractPdf } from "./pdf-extractor.js";
import { chunkPdfPages } from "./pdf-chunker.js";

export async function indexPdf(filePath) {
    const filename = path.basename(filePath);

    const existing = await pool.query(
        `SELECT id FROM documents WHERE filename=$1`,
        [filename]
    )

    if(existing.rows.length > 0){
        return { documentId: existing.rows[0].id, alreadyIndexed: true };
    }

    const extracted = await safeExtractPdf(filePath);
    if(!extracted.success){
        throw new Error(`${extracted.error}. ${extracted.hint || ""}`);
    }

    // Chunk with page tracking
    const chunks = chunkPdfPages(extracted.pages, 150, 30);
    if (chunks.length === 0) {
        throw new Error("No chunks produced — document may be too short or contain no extractable text");
    }

    const docResult = await pool.query(
        `INSERT INTO documents (filename, num_pages, word_count, chunk_count)
        VALUES ($1, $2, $3, $4) RETURNING id`,
        [filename, extracted.numPages, extracted.wordCount, chunks.length]
    )

    const documentId = docResult.rows[0].id;

    // Embed all chunks in parallel
    const embeddings = await Promise.all(
        chunks.map(chunk => generateEmbedding(chunk.text))
    );

    // Insert chunks with page metadata
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Dimension mismatch on chunk ${i}: ${embedding.length}`);
        }

        const vectorString = `[${embedding.join(",")}]`;

        await pool.query(
        `INSERT INTO chunks
            (document_id, content, chunk_index, word_count,
            start_word, end_word, start_page, end_page, embedding)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [documentId, chunk.text, chunk.chunkIndex, chunk.wordCount,
        chunk.startWord, chunk.endWord, chunk.startPage, chunk.endPage, vectorString]
        );
    }

    return { documentId, alreadyIndexed: false, chunkCount: chunks.length };
}