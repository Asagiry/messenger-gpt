import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/test/**/*.test.ts", "client/test/**/*.test.ts"],
    isolate: true
  }
});
