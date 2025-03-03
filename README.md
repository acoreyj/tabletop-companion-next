# Tabletop Companion

A companion application for tabletop games.

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