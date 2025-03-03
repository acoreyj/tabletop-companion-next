# RAG Server

A Retrieval-Augmented Generation (RAG) server built with Hono and Cloudflare Workers.

## Features

- PDF document upload and processing
- Text extraction from PDFs
- Text chunking and vector embedding generation
- Storage in Cloudflare D1 and Vectorize
- Real-time progress streaming using Hono's streaming capabilities
- Rate limiting to prevent abuse

## API Endpoints

### `POST /api/upload`

Uploads a PDF file, processes it, and stores it in the database.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: PDF file (required)
  - `sessionId`: Session ID (optional, will be generated if not provided)

**Response:**
- Streaming response with JSON progress updates
- Each line is a JSON object with progress information
- Final response includes document ID and session ID

## Development

### Prerequisites

- Node.js 18+
- pnpm
- Cloudflare account with Workers, D1, R2, and Vectorize enabled

### Setup

1. Clone the repository
2. Install dependencies:
   ```
   pnpm install
   ```
3. Copy `wrangler.jsonc.example` to `wrangler.jsonc` and update with your Cloudflare credentials
4. Run migrations:
   ```
   pnpm migrate:local
   ```

### Local Development

```
pnpm dev
```

### Deployment

```
pnpm deploy
```

## Architecture

The RAG server uses the following Cloudflare services:

- **Workers**: Serverless execution environment
- **D1**: SQLite database for document metadata and chunks
- **R2**: Object storage for PDF files
- **Vectorize**: Vector database for embeddings
- **AI**: AI models for generating embeddings

## Implementation Details

The server is built with Hono, a lightweight web framework for Cloudflare Workers. It uses streaming responses to provide real-time progress updates to the client during the processing of PDF files.

The processing pipeline includes:

1. Upload PDF to R2 storage
2. Extract text from PDF
3. Insert document metadata into D1 database
4. Split text into chunks
5. Generate vector embeddings for each chunk using Cloudflare AI
6. Store chunks in D1 and vectors in Vectorize
7. Stream progress updates to client 