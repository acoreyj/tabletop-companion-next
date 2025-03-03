import { Hono } from "hono";
import { streamText } from "hono/streaming";
import { RoleScopedChatInput } from "@cloudflare/workers-types";
import { inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { documentChunks } from "../schema";
import { ulid } from "ulidx";
import {
  fetchCompleteLanguageModelResponse,
  fetchStreamingLanguageModelResponse,
} from "../lib/aiGateway";

interface EmbeddingVectorResponse {
  shape: number[];
  data: number[][];
}

interface VectorSearchMatch {
  id: string;
  score: number;
  values?: number[];
  metadata?: Record<string, any>;
}

interface VectorSearchResults {
  matches: VectorSearchMatch[];
  namespace: string;
}

interface DocumentFragment {
  id: string;
  document_id: string;
  text: string;
  session_id: string;
  rank: number;
}

const router = new Hono<{ Bindings: Bindings }>();

/**
 * Rewrites a user query into multiple search queries for better retrieval
 */
async function generateEnhancedQueries(
  userMessage: string,
  environment: Bindings
): Promise<string[]> {
  const promptTemplate = `Given the following user message, rewrite it into 5 distinct queries that could be used to search for relevant information. Each query should focus on different aspects or potential interpretations of the original message. No questions, just a query maximizing the chance of finding relevant information.

User message: "${userMessage}"

Provide 5 queries, one per line and nothing else:`;

  const aiResponse = await fetchCompleteLanguageModelResponse({
    organizationId: environment.CLOUDFLARE_ACCOUNT_ID,
    conversationHistory: [{ role: "user", content: promptTemplate }],
    credentialKeys: {
      openai: environment.OPENAI_API_KEY,
      groq: environment.GROQ_API_KEY,
      anthropic: environment.ANTHROPIC_API_KEY,
    },
    modelIdentifier: "llama-3.1-8b-instant",
    languageModelProvider: "groq",
    workerAI: environment.AI,
  });

  const lineNumberingRegex = /^\d+\.\s*"|"$/gm;
  const enhancedQueries = aiResponse
    .replace(lineNumberingRegex, "")
    .split("\n")
    .filter((query) => query.trim() !== "")
    .slice(0, 5);
  enhancedQueries.push(userMessage);
  return enhancedQueries;
}

/**
 * Searches document chunks using full-text search
 */
async function performFullTextSearch(searchPhrases: string[], database: any) {
  const searchQueries = searchPhrases.filter(Boolean).map((phrase) => {
    const sanitizedPhrase = phrase.trim().replace(/[^\w\s]/g, "");
    return sql`
        SELECT document_chunks.*, document_chunks_fts.rank
        FROM document_chunks_fts
        JOIN document_chunks ON document_chunks_fts.id = document_chunks.id
        WHERE document_chunks_fts MATCH ${sanitizedPhrase}
        ORDER BY rank DESC
        LIMIT 5
      `;
  });

  const searchResults = await Promise.all(
    searchQueries.map(async (query) => {
      const { results } = (await database.run(query)) as {
        results: DocumentFragment[];
      };
      return results;
    })
  );

  console.log({ fts: searchResults });

  return searchResults
    .flat()
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 10);
}

/**
 * Queries the vector index for semantic search
 */
async function performVectorSearch(
  searchPhrases: string[],
  environment: Bindings,
  sessionIdentifier: string
): Promise<any[]> {
  const embeddedQueries: EmbeddingVectorResponse[] = await Promise.all(
    searchPhrases.map((phrase) =>
      environment.AI.run("@cf/baai/bge-large-en-v1.5", { text: [phrase] })
    )
  );

  const vectorSearchResults = await Promise.all(
    embeddedQueries.map((embedding) =>
      environment.VECTORIZE_INDEX.query(embedding.data[0], {
        topK: 5,
        returnValues: true,
        returnMetadata: "all",
        namespace: "default",
        filter: {
          sessionId: sessionIdentifier,
        },
      })
    )
  );

  return vectorSearchResults;
}

/**
 * Performs reciprocal rank fusion to combine results from different search methods
 */
function combineSearchResults(
  textSearchResults: DocumentFragment[],
  vectorSearchResults: any[]
): { id: string; score: number }[] {
  const fusionConstant = 60; // Constant for fusion, can be adjusted
  const combinedScores: { [id: string]: number } = {};

  // Process full-text search results
  textSearchResults.forEach((result, index) => {
    const score = 1 / (fusionConstant + index);
    combinedScores[result.id] = (combinedScores[result.id] || 0) + score;
  });

  // Process vector search results
  vectorSearchResults.forEach((result) => {
    result.matches.forEach((match: { id: string }, index: number) => {
      const score = 1 / (fusionConstant + index);
      combinedScores[match.id] = (combinedScores[match.id] || 0) + score;
    });
  });

  // Sort and return fused results
  return Object.entries(combinedScores)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Retrieves document chunks by their IDs
 */
async function fetchDocumentFragments(documentIds: string[], database: any) {
  const documentFragments = await database
    .select({ text: documentChunks.text })
    .from(documentChunks)
    .where(inArray(documentChunks.id, documentIds));

  return documentFragments;
}

/**
 * Processes a user query and retrieves relevant context
 */
async function handleUserQuery(
  requestData: any,
  environment: Bindings,
  responseWriter: WritableStreamDefaultWriter
) {
  const { provider, model, sessionId: sessionIdentifier } = requestData;
  const conversationHistory: RoleScopedChatInput[] =
    requestData.messages as RoleScopedChatInput[];
  const systemInstructions = `You are a helpful assistant that answers questions based on the provided context. When giving a response, always include the source of the information in the format [1], [2], [3] etc.`;
  conversationHistory.unshift({ role: "system", content: systemInstructions });
  const latestUserMessage = conversationHistory[conversationHistory.length - 1];
  const userQuery = latestUserMessage.content;

  const database = drizzle(environment.DB);
  const textEncoder = new TextEncoder();

  await responseWriter.write(
    textEncoder.encode(
      `data: {"message": "Rewriting message to queries..."}\n\n`
    )
  );

  const enhancedQueries = await generateEnhancedQueries(userQuery, environment);
  const queryProgressMessage = {
    message: "Querying vector index and full text search...",
    queries: enhancedQueries,
  };
  await responseWriter.write(
    textEncoder.encode(`data: ${JSON.stringify(queryProgressMessage)}\n\n`)
  );
  console.log({ enhancedQueries });

  const [textSearchResults, vectorSearchResults] = await Promise.all([
    performFullTextSearch(enhancedQueries, database),
    performVectorSearch(enhancedQueries, environment, sessionIdentifier),
  ]);

  console.log({ textSearchResults, vectorSearchResults });
  // Perform reciprocal rank fusion on textSearchResults and vectorSearchResults
  const combinedResults = combineSearchResults(
    textSearchResults,
    vectorSearchResults
  ).sort((a, b) => b.score - a.score);

  console.log({ combinedResults });
  const relevantDocuments = await fetchDocumentFragments(
    combinedResults.map((result) => result.id).slice(0, 10),
    database
  );

  const formattedDocuments = relevantDocuments
    .map(
      (doc: { text: string }, index: number) => `[${index + 1}]: ${doc.text}`
    )
    .join("\n\n");

  console.log({ formattedDocuments });
  const documentsFoundMessage = {
    message: "Found relevant documents, generating response...",
    relevantContext: relevantDocuments,
    queries: enhancedQueries,
  };
  await responseWriter.write(
    textEncoder.encode(`data: ${JSON.stringify(documentsFoundMessage)}\n\n`)
  );

  conversationHistory.push({
    role: "assistant",
    content: `The following queries were made:\n${enhancedQueries.join(
      "\n"
    )}\n\nRelevant context from attached documents:\n${formattedDocuments}`,
  });

  return { messages: conversationHistory, provider, model };
}

/**
 * Streams the LLM response to the client
 */
async function streamAiResponse(
  params: Awaited<ReturnType<typeof handleUserQuery>>,
  environment: Bindings,
  outputStream: WritableStream
) {
  const { messages: conversationHistory, provider, model } = params;
  const apiCredentials = {
    anthropic: environment.ANTHROPIC_API_KEY,
    openai: environment.OPENAI_API_KEY,
    groq: environment.GROQ_API_KEY,
  };

  const aiStream = await fetchStreamingLanguageModelResponse({
    organizationId: environment.CLOUDFLARE_ACCOUNT_ID,
    conversationHistory,
    credentialKeys: apiCredentials,
    languageModelProvider: "groq",
    modelIdentifier: "llama-3.3-70b-versatile",
    workerAI: environment.AI,
  });

  console.log("aiStream", aiStream);

  // Handle the streaming response
  if ((aiStream as Response).body) {
    console.log("serverstream body");
    // Create a text decoder to convert the stream chunks to text
    const textDecoder = new TextDecoder();

    // Create a reader to read from the stream
    const streamReader = (aiStream as Response).body!.getReader();

    try {
      // Read chunks from the stream and process them
      while (true) {
        const { done, value } = await streamReader.read();
        if (done) break;

        // Decode the chunk and log it
        const chunkText = textDecoder.decode(value, { stream: true });
        console.log("Streaming chunk:", chunkText);
      }
    } catch (error) {
      console.error("Error reading from stream:", error);
    } finally {
      streamReader.releaseLock();
    }
  }
  if ((aiStream as Response).body) {
    console.log("stream body");
    await (aiStream as Response).body!.pipeTo(outputStream);
  } else {
    console.log("stream stream");
    await (aiStream as ReadableStream).pipeTo(outputStream);
  }
}

// POST endpoint for querying with streaming response
router.post("/", async (context) => {
  context.header("Content-Encoding", "Identity");
  const { readable: readableStream, writable: writableStream } =
    new TransformStream();
  const responseWriter = writableStream.getWriter();
  const clientIpAddress = context.req.header("cf-connecting-ip") || "";

  // Basic rate limiting
  const rateLimitKey = await context.env.rate_limiter.get(clientIpAddress);
  if (rateLimitKey) {
    const previousRequestTimestamp = parseInt(rateLimitKey);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp - previousRequestTimestamp < 3) {
      return new Response("Too many requests", { status: 429 });
    }
  }

  // Update rate limit timestamp
  await context.env.rate_limiter.put(
    clientIpAddress,
    Math.floor(Date.now() / 1000).toString(),
    {
      expirationTtl: 60,
    }
  );

  context.executionCtx.waitUntil(
    (async () => {
      try {
        const requestData = await context.req.json();
        const queryParams = await handleUserQuery(
          requestData,
          context.env,
          responseWriter
        );
        responseWriter.releaseLock();
        console.log("stream response");
        await streamAiResponse(queryParams, context.env, writableStream);
        console.log("stream response done");
      } catch (error) {
        console.error(error);
        await responseWriter.write(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ error: (error as Error).message })}\n\n`
          )
        );
        await responseWriter.close();
      }
    })()
  );

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Transfer-Encoding": "chunked",
      "content-encoding": "identity",
    },
  });
});

export default router;
