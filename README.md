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
