import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: "public/popup.html",
        options: "public/options.html",
        blocked: "public/blocked.html",
      },
    },
  },
});
