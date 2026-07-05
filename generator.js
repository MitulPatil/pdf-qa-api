// generator.js — updated for Session 4
// Now uses citations.js utilities for cleaner, deduplicated citations

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  deduplicateCitations,
  formatPageCitation,
  buildCitationsArray,
  appendCitationSummary
} from "./citations.js";

import dotenv from "dotenv";
import {fileURLToPath} from "url";
import {dirname, join} from "path";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

if(!process.env.GEMINI_API_KEY){
    console.log("couldn't find GEMINI_API_KEY in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({model : "gemini-3.1-flash-lite-preview"});

export async function generateAnswer(question, retrievedChunks) {
  if (!retrievedChunks || retrievedChunks.length === 0) {
    return {
      answer: "I could not find relevant information in the document to answer this question.",
      citations: [],
      retrievedChunks: []
    };
  }


  // Build the context block with citation numbers embedded
  // The model is instructed to reference [1], [2], [3] in its answer
  const context = retrievedChunks
    .map((chunk, i) => {
      const pageRef = formatPageCitation(chunk.startPage, chunk.endPage);
      return `[${i + 1}] (${pageRef}):\n${chunk.content}`;
    })
    .join("\n\n");

  const prompt = `You are a precise assistant that answers questions using only the provided document passages.

DOCUMENT PASSAGES:
${context}

QUESTION: ${question}

INSTRUCTIONS:
- Answer based only on the information in the passages above
- When you use information from a passage, add its citation number in square brackets like [1] or [2]
- Example: "The study found significant results [1], which was later confirmed [2]."
- If the passages do not contain sufficient information, say: "The document does not contain sufficient information to answer this question"
- Do not use knowledge from outside the provided passages
- Be specific and concise

ANSWER:`;

  const result = await model.generateContent(prompt);
  const rawAnswer = result.response.text();

  // Deduplicate chunks by page before building the prompt
  // If three chunks all come from page 4, the model doesn't need to see
  // the same page cited three times — one representative passage is enough
  const deduplicated = deduplicateCitations(retrievedChunks);

  // Build the structured citations array from deduplicated chunks
  const citations = buildCitationsArray(deduplicated);

  // Append a Sources block at the end for users who want to verify
  const answerWithSources = appendCitationSummary(rawAnswer, citations);

  return {
    answer: answerWithSources,
    rawAnswer,       // answer without sources block — useful if frontend formats its own citations
    citations,
    retrievedChunks: retrievedChunks.map(c => ({
      chunkIndex: c.chunkIndex,
      content: c.content,
      startPage: c.startPage,
      endPage: c.endPage,
      similarity: c.similarity
    }))
  };
}