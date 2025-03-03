/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PDF Upload and Processing API Endpoint
 *
 * This file handles the upload of PDF files to Cloudflare R2 storage,
 * extracts text content, splits it into chunks, generates vector embeddings,
 * and stores everything in the database for RAG (Retrieval Augmented Generation) applications.
 *
 * The workflow is:
 * 1. Upload PDF to R2 storage
 * 2. Extract text from PDF
 * 3. Insert document metadata into database
 * 4. Split text into chunks
 * 5. Generate vector embeddings for each chunk
 * 6. Store chunks and vectors in database
 * 7. Stream progress updates to client
 */
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getDocumentProxy, extractText } from "unpdf";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { documentChunks, documents } from "./schema";
import { ulid } from "ulidx";
import { DrizzleError } from "drizzle-orm";

/**
 * Uploads a file to Cloudflare R2 storage
 *
 * @param pdfFile - The file to upload
 * @param storageContainer - The R2 bucket to upload to
 * @param sessionIdentifier - The session ID to associate with the file
 * @returns The R2 URL/key where the file is stored
 */
async function storeFileInR2({
  pdfFile,
  storageContainer,
  sessionIdentifier,
}: {
  pdfFile: File;
  storageContainer: R2Bucket;
  sessionIdentifier: string;
}): Promise<string> {
  // Create a unique key using sessionIdentifier, timestamp, and filename
  const storageKey = `${sessionIdentifier}/${Date.now()}-${pdfFile.name}`;
  await storageContainer.put(storageKey, await pdfFile.arrayBuffer(), {
    httpMetadata: { contentType: pdfFile.type },
  });

  return `${storageKey}`;
}

/**
 * Extracts text content from a PDF file
 *
 * @param pdfFile - The PDF file to extract text from
 * @returns The extracted text content as a string
 */
async function parsePdfContent({
  pdfFile,
}: {
  pdfFile: File;
}): Promise<string> {
  const fileBuffer = await pdfFile.arrayBuffer();
  const pdfDocument = await getDocumentProxy(new Uint8Array(fileBuffer));
  const extractionResult = await extractText(pdfDocument, { mergePages: true });
  // Handle different return types from extractText
  return Array.isArray(extractionResult.text)
    ? extractionResult.text.join(" ")
    : extractionResult.text;
}

/**
 * Inserts document metadata into the database
 *
 * @param dbConnection - The database connection
 * @param pdfFile - The uploaded file
 * @param extractedContent - The extracted text content
 * @param sessionIdentifier - The session ID
 * @param storageUrl - The R2 storage URL
 * @returns The inserted document ID
 */
async function saveDocumentMetadata({
  dbConnection,
  pdfFile,
  extractedContent,
  sessionIdentifier,
  storageUrl,
}: {
  dbConnection: any;
  pdfFile: File;
  extractedContent: string;
  sessionIdentifier: string;
  storageUrl: string;
}) {
  console.log("Inserting document...", {
    pdfFile,
    extractedContent,
    sessionIdentifier,
    storageUrl,
  });
  // Create document record with ULID as primary key
  const documentRecord = {
    id: ulid(),
    name: pdfFile.name,
    size: pdfFile.size,
    textContent: extractedContent,
    sessionId: sessionIdentifier,
    r2Url: storageUrl,
  };
  console.log({ documentRecord });

  return dbConnection
    .insert(documents)
    .values(documentRecord)
    .returning({ insertedId: documents.id });
}

/**
 * Processes text chunks, generates embeddings, and inserts vectors into the database
 *
 * @param dbConnection - The database connection
 * @param vectorIndex - The Cloudflare Vectorize index
 * @param aiService - The AI service for generating embeddings
 * @param textChunks - The text chunks to process
 * @param pdfFile - The original file
 * @param sessionIdentifier - The session ID
 * @param documentIdentifier - The document ID
 * @param sendProgressUpdate - Function to stream progress updates to client
 */
async function processAndStoreEmbeddings({
  dbConnection,
  vectorIndex,
  aiService,
  textChunks,
  pdfFile,
  sessionIdentifier,
  documentIdentifier,
  sendProgressUpdate,
}: {
  dbConnection: DrizzleD1Database<any>;
  vectorIndex: VectorizeIndex;
  aiService: any;
  textChunks: string[];
  pdfFile: File;
  sessionIdentifier: string;
  documentIdentifier: string;
  sendProgressUpdate: (message: any) => Promise<void>;
}) {
  console.log("Inserting vectors...", {
    pdfFile,
    sessionIdentifier,
    documentIdentifier,
  });

  // Process chunks in batches to avoid overwhelming the AI service
  const batchSize = 10;
  const processingTasks = [];
  let completionPercentage = 0;

  for (let i = 0; i < textChunks.length; i += batchSize) {
    const currentBatch = textChunks.slice(i, i + batchSize);

    processingTasks.push(
      (async () => {
        // Generate embeddings for the current batch using Cloudflare AI
        const embeddingResponse = await aiService.run(
          "@cf/baai/bge-large-en-v1.5",
          {
            text: currentBatch,
          }
        );
        const embeddingVectors: number[][] = embeddingResponse.data;

        // Insert chunks into the database and get their IDs
        const chunkInsertResults = await dbConnection
          .insert(documentChunks)
          .values(
            currentBatch.map((chunkText) => ({
              id: ulid(),
              text: chunkText,
              sessionId: sessionIdentifier,
              documentId: documentIdentifier,
            }))
          )
          .returning({ insertedChunkId: documentChunks.id });

        // Extract the inserted chunk IDs
        const chunkIdentifiers = chunkInsertResults.map(
          (result) => result.insertedChunkId
        );

        // Insert vectors into Vectorize index with metadata for retrieval
        await vectorIndex.insert(
          embeddingVectors.map((embedding, index) => ({
            id: chunkIdentifiers[index],
            values: embedding,
            namespace: "default",
            metadata: {
              sessionId: sessionIdentifier,
              documentId: documentIdentifier,
              chunkId: chunkIdentifiers[index],
              text: currentBatch[index],
            },
          }))
        );

        // Update and stream progress to client
        completionPercentage += (batchSize / textChunks.length) * 100;
        await sendProgressUpdate({
          message: `Embedding... (${completionPercentage.toFixed(2)}%)`,
          progress: completionPercentage,
        });
      })()
    );
  }

  // Wait for all batches to complete processing
  await Promise.all(processingTasks);
}

/**
 * Main API handler for PDF upload and processing
 *
 * This function handles the HTTP request, validates inputs, orchestrates the processing
 * pipeline, and streams progress updates back to the client using Server-Sent Events.
 */
export const onRequest: PagesFunction<Env> = async (ctx) => {
  // Set up streaming response for real-time progress updates
  const { readable, writable } = new TransformStream();
  const streamWriter = writable.getWriter();
  const { request } = ctx;
  const clientIpAddress = request.headers.get("cf-connecting-ip") || "";

  // Helper function to stream SSE messages to client
  const sendProgressUpdate = async (message: any) => {
    await streamWriter.write(
      new TextEncoder().encode(`data: ${JSON.stringify(message)}\n\n`)
    );
  };

  // Basic rate limiting to prevent abuse
  const previousRequestTimestamp =
    await ctx.env.rate_limiter.get(clientIpAddress);
  if (previousRequestTimestamp) {
    const lastRequestTime = parseInt(previousRequestTimestamp);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp - lastRequestTime < 3) {
      return new Response(
        `Too many requests (${
          currentTimestamp - lastRequestTime
        }s since last request, ${clientIpAddress})`,
        { status: 429 }
      );
    }
  }

  // Update rate limit timestamp
  await ctx.env.rate_limiter.put(
    clientIpAddress,
    Math.floor(Date.now() / 1000).toString(),
    {
      expirationTtl: 60,
    }
  );

  // Validate request method
  if (request.method !== "POST") {
    return new Response("Expected a POST request with a file", { status: 405 });
  }

  // Process the upload in the background while immediately returning a streaming response
  ctx.waitUntil(
    (async () => {
      try {
        // Extract form data
        const formData = await request.formData();
        const pdfFile = formData.get("pdf") as File;
        const sessionIdentifier = formData.get("sessionId") as string;

        // Initialize database connection
        const dbConnection = drizzle(ctx.env.DB);

        // Validate file
        if (
          !pdfFile ||
          typeof pdfFile !== "object" ||
          !("arrayBuffer" in pdfFile)
        ) {
          await sendProgressUpdate({
            error: "Please upload a PDF file.",
          });
          await streamWriter.close();
          return;
        }

        // Parallelize file upload and text extraction for efficiency
        const [storageUrl, extractedContent] = await Promise.all([
          storeFileInR2({
            pdfFile,
            storageContainer: ctx.env.R2_BUCKET,
            sessionIdentifier,
          }),
          parsePdfContent({ pdfFile }),
        ]);

        await sendProgressUpdate({ message: "Extracted text from PDF" });

        // Insert document metadata and get document ID
        const insertResult = await saveDocumentMetadata({
          dbConnection,
          pdfFile,
          extractedContent,
          sessionIdentifier,
          storageUrl,
        });

        // Split text into chunks for vector embedding
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 500, // Size of each text chunk
          chunkOverlap: 100, // Overlap between chunks to maintain context
        });

        const textChunks = await textSplitter.splitText(extractedContent);

        // Process chunks and generate vector embeddings
        await processAndStoreEmbeddings({
          dbConnection,
          vectorIndex: ctx.env.VECTORIZE_INDEX,
          aiService: ctx.env.AI,
          textChunks,
          pdfFile,
          sessionIdentifier,
          documentIdentifier: insertResult[0].insertedId,
          sendProgressUpdate,
        });

        // Send final success response with file info
        const documentSummary = {
          documentId: insertResult[0].insertedId,
          name: pdfFile.name,
          type: pdfFile.type,
          size: pdfFile.size,
          r2Url: storageUrl,
          chunks: textChunks,
        };
        console.log({ documentSummary });
        await sendProgressUpdate({
          message: "Inserted vectors into database",
          ...documentSummary,
        });

        await streamWriter.close();
      } catch (error) {
        // Handle errors and close the stream
        streamWriter.close();
        if (error instanceof DrizzleError) {
          console.error("Drizzle error:", error.message);
        }
        console.error(
          "Error processing upload:",
          (error as Error).stack,
          Object.keys(error as any)
        );
        console.error(error);
        await sendProgressUpdate({
          error: `An error occurred while processing the upload: ${
            (error as Error).message
          }`,
        });
        await streamWriter.close();
      }
    })()
  );

  // Return streaming response to client
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Transfer-Encoding": "chunked",
      "content-encoding": "identity",
    },
  });
};
