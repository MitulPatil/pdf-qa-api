export function deduplicateCitations(retrievedChunks){

    const pageMap = new Map();

    for(const chunk of retrievedChunks){

        const pageKey = chunk.startpage === chunk.endPage 
        ? `${chunk.startPage}`
        : `${chunk.startPage} - ${chunk.endPege}`

        if(!pageMap.has(pageKey)){
            pageMap.set(pageKey,chunk);
        }else {
            const existing = pageMap.get(pageKey);

            if(chunk.similarity > existing.similariy){
                pageMap.set(pageKey,chunk);
            }
        }
    }

    return Array.from(pageMap.values());
}

export function formatPageCitations(startPage, endPage) {
    if(!startPage || !endPage) return "unknown page";

    if(startPage === endPage){
        return `page ${startPage}`
    }

    return `page ${startPage} - ${endPage}`
}

export function buildCitationsArray(deduplicateChunks) {
    return deduplicateChunks.map((chunk,i)=>({
        citationNumber : i + 1,
        pageReference : formatPageCitations(chunk.startPage, chunk.endPage),
        startPage : chunk.startPage,
        endPage : chunk.endPage,
        similarity : chunk.similarity,
        chunkId : chunk.chunkId || null,
        preview : chunk.content ? chunk.content.substring(0,150).replace(/\s+/g, " ").trim() + "..." : null
    }))
}

export function appendCitationSummery(answerText, citations) {
    if (!answerText || !citations.length === 0) return answerText;

    const sourceLines = citations.map(c=>
        `[${c.citationNumber}] ${c.pageReference} - "${c.preview}"`
    ).join("\n");

    return `${answerText}\n\nSources:\n${sourceLines}`;
}