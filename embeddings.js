import {GoogleGenerativeAI} from "@google/generative-ai";
import dotenv from "dotenv";
import {fileURLToPath} from "url";
import {dirname, join} from "path";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({model : "gemini-embedding-001"});

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 3072;

export async function generateEmbedding(text) {
    if(!text || text.trim().length === 0) {
        throw new Error("Cannot embed empty string");
    }

    const result = await model.embedContent(text);
    return result.embedding.values;
}