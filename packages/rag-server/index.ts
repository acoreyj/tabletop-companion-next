import { Hono } from "hono";
import { streamText } from "hono/streaming";
import { cors } from "hono/cors";
import uploadRoutes from "./routes/upload";
import queryRoutes from "./routes/query";
import getFilesRoutes from "./routes/get-files";

// Define the environment interface
type Bindings = {
  rate_limiter: KVNamespace;
  GROQ_API_KEY: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  R2_BUCKET: R2Bucket;
  DB: D1Database;
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Ai;
};

// Create the Hono app
const app = new Hono<{ Bindings: Bindings }>();

// Add middleware
app.use(cors());

// Add routes
app.route("/api/upload", uploadRoutes);
app.route("/api/query", queryRoutes);
app.route("/api/get-files", getFilesRoutes);
// Add a simple health check route
app.get("/", (c) => {
  return c.json({
    status: "ok",
    message: "RAG Server is running",
  });
});

// Export the app for Cloudflare Workers
export default app;
