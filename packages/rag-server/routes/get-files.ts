import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { documents } from "../schema";
import { eq } from "drizzle-orm";

// Create a new Hono router
const app = new Hono<{ Bindings: Bindings }>();

/**
 * GET endpoint to retrieve a list of files for a specific session
 */
app.get("/:sessionId", async (c) => {
  try {
    // Get session ID from URL parameters
    const sessionId = c.req.param("sessionId");

    if (!sessionId) {
      return c.json({ error: "Session ID is required" }, 400);
    }

    // Initialize database connection
    const db = drizzle(c.env.DB);

    // Query documents table for files in the session
    const sessionFiles = await db
      .select({
        id: documents.id,
        name: documents.name,
        size: documents.size,
        r2Url: documents.r2Url,
        hash: documents.hash,
      })
      .from(documents)
      .where(eq(documents.sessionId, sessionId));

    // Return the list of files
    return c.json({
      files: sessionFiles,
      count: sessionFiles.length,
      sessionId,
    });
  } catch (error) {
    console.error("Error retrieving files:", error);
    return c.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        status: "error",
      },
      500
    );
  }
});

export default app;
