import { pool } from "./db.js";
import { generateEmbedding } from "./embeddings.js";

export async function retrieveChunks(question, documentId, topK = 3) {
    const questionVector = await generateEmbedding(question);

    const vectorString = `[${questionVector}]`;

    const result = await pool.query(
        `SELECT
            id,
            chunk_index,
            content,
            start_page,
            end_page,
            word_count,
            1 - (embedding <=> $1) AS similarity
        FROM chunks
        WHERE document_id = $2
        ORDER BY embedding <=> $1 ASC
        LIMIT $3`,
        [vectorString, documentId, topK]
    );

    return result.rows.map(row => ({
        chunkId: row.id,
        chunkIndex: row.chunk_index,
        content: row.content,
        startPage: row.start_page,
        endPage: row.end_page,
        wordCount: row.word_count,
        similarity: parseFloat(row.similarity)
    }));
}