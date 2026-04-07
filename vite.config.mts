import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(() => ({
  base: "./",
  resolve: {
    alias: {
      phaser: "phaser/src/phaser-arcade-physics.js",
      phaser3spectorjs: resolve("src/vendor/phaser3spectorjs.ts"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    sourcemap: process.env.VITE_SOURCEMAP === "1",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser")) return "phaser";
          if (id.includes("/src/game/scenes/")) return "scenes";
          // Keep the platform layer with core game systems so Rollup does not
          // create a cross-chunk cycle between platform and game.
          if (id.includes("/src/platform/")) return "game";
          if (id.includes("/src/game/")) return "game";
          if (id.includes("/src/visual/")) return "visual";
          return undefined;
        },
      },
    },
  },
}));
