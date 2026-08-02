import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base must match the repository name for GitHub Pages project sites, because the site is served
// from https://<user>.github.io/<repo>/ rather than the domain root. Set it to "/" if you later
// attach a custom domain or publish from a <user>.github.io repository.
export default defineConfig({
  plugins: [react()],
  base: "/skal-bench/",
  build: { outDir: "dist", chunkSizeWarningLimit: 1500 },
});
