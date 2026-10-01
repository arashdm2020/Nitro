import tailwindcss from "@tailwindcss/vite";
export default defineNuxtConfig({
  compatibilityDate: "2026-10-01",
  devtools: { enabled: false },
  modules: ["@nuxt/eslint"],
  css: ["~/assets/css/main.css"],
  vite: { plugins: [tailwindcss()] },
  typescript: { strict: true, typeCheck: true },
  app: {
    head: {
      title: "Nitro · Your assets, connected",
      htmlAttrs: { lang: "en", dir: "ltr" },
      meta: [
        { name: "theme-color", content: "#07090D" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1, viewport-fit=cover",
        },
      ],
      link: [
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "icon", href: "/nitro.svg", type: "image/svg+xml" },
        { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
      ],
    },
  },
  routeRules: { "/api/**": { headers: { "Cache-Control": "no-store" } } },
});
