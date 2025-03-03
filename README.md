# Tabletop Companion

A companion application for tabletop games.

**[🚀 Live Demo: https://tabletop-companion.vercel.app/](https://tabletop-companion.vercel.app/)**

## Upload Rules

![Screenshot 2025-03-03 141342](https://github.com/user-attachments/assets/55ea0e28-a288-47f1-a8b6-13cbc35af98f)

## Ask Questions

![Screenshot 2025-03-03 141100](https://github.com/user-attachments/assets/ff89ad85-b5b8-40c3-9e84-bcda7033eeb2)

![Screenshot 2025-03-03 141417](https://github.com/user-attachments/assets/fc7fe46b-6413-4714-95a8-3e3c32acd5ba)

## Features

- Game details display
- PDF rules upload and processing with RAG (Retrieval-Augmented Generation)

## Environment Variables

The application uses the following environment variables:

- `NEXT_PUBLIC_RAG_ENDPOINT`: URL for the RAG server API (defaults to http://localhost:8787/api)

## Setup

1. Clone the repository
2. Install dependencies with pnpm:
   ```
   pnpm install
   ```
3. Create a `.env.local` file in the `packages/tblcmp` directory with the following content:

   ```
   NEXT_PUBLIC_RAG_ENDPOINT=http://localhost:8787/api
   ```

   Or set it to your actual RAG server endpoint.

4. Start the development server:
   ```
   pnpm dev
   ```

## PDF Upload Feature

The application includes a feature to upload PDF game rules. The uploaded PDFs are processed by a RAG server that:

1. Extracts text from the PDF
2. Splits the text into chunks
3. Creates embeddings for the chunks
4. Stores the embeddings in a vector database
5. Allows for semantic search and retrieval of game rules

The upload process provides real-time feedback through a streaming API that sends progress updates back to the client.

## How the RAG System Works

The Retrieval-Augmented Generation (RAG) system in Tabletop Companion enhances AI responses by grounding them in the specific rules of your tabletop games. Here's a detailed breakdown of how it works:

### PDF Processing Pipeline

1. **File Upload**: When you upload a PDF rulebook, it's stored in Cloudflare R2 storage with a unique identifier.

2. **Text Extraction**: The system uses the `unpdf` library to extract all text content from the PDF document.

3. **Text Chunking**: The extracted text is split into smaller, manageable chunks using a `RecursiveCharacterTextSplitter` with:

   - Chunk size of 500-1000 characters
   - Chunk overlap of 100-200 characters to maintain context between chunks
   - This ensures that related information stays together while keeping chunks small enough for effective embedding

4. **Vector Embedding Generation**: Each text chunk is processed through Cloudflare's AI service using the `@cf/baai/bge-large-en-v1.5` embedding model to create vector representations that capture the semantic meaning of the text.

5. **Storage**: The system stores:
   - Original PDF in Cloudflare R2
   - Document metadata and text chunks in a SQL database (D1)
   - Vector embeddings in Cloudflare Vectorize with metadata linking back to the source chunks

### Query Processing

When you ask a question about game rules:

1. **Query Enhancement**: Your question is rewritten into multiple search queries to capture different aspects and interpretations of your question, improving retrieval accuracy.

2. **Dual Retrieval Strategy**:

   - **Vector Search**: Your query is converted to the same vector space as the stored chunks using the same embedding model, then semantically similar chunks are retrieved.
   - **Full-Text Search**: Traditional keyword-based search is performed in parallel.

3. **Result Fusion**: Results from both search methods are combined using Reciprocal Rank Fusion, which:

   - Assigns scores to each result based on its ranking in each search method
   - Combines these scores to create a unified ranking
   - Prioritizes chunks that appear high in both search methods

4. **Context Assembly**: The top-ranked chunks are assembled into a comprehensive context that provides the AI with the most relevant information from your rulebooks.

5. **Response Generation**: The AI generates a response based on:
   - The assembled context from your rulebooks
   - Your specific question
   - System instructions that guide it to cite sources using numbered references

### Real-time Feedback

Throughout both upload and query processes, the system provides real-time feedback through a streaming API, keeping you informed about:

- Upload progress and processing stages
- Query processing steps
- Retrieved context snippets
- Response generation

This architecture ensures that responses are:

- Grounded in your specific game rules
- Accurate and relevant to your questions
- Transparent about their sources
- Optimized for both semantic understanding and keyword matching
