import { defineConfig } from "drizzle-kit";

export default defineConfig({
  driver: "d1-http",
  schema: "./schema.ts",
  dialect: "sqlite",
  migrations: {
    prefix: "timestamp",
  },
});
