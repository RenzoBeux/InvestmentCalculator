import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" hace que los assets usen rutas relativas, así el build funciona
// tanto abierto directo (file://) como servido desde un subpath
// (p. ej. tu homelab detrás de Cloudflare).
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 1818,
  },
  preview: {
    port: 1818,
  },
});
