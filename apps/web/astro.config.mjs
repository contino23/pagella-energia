import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://pagellaenergia.it",
  base: process.env.BASE_PATH ?? "/",
  trailingSlash: "always",
  build: { format: "directory" },
  vite: {
    server: { fs: { allow: ["../.."] } },
    worker: { format: "es" },
  },
});
