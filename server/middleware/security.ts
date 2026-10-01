export default defineEventHandler((event) => {
  setHeader(event, "X-Content-Type-Options", "nosniff");
  if (
    !event.path.startsWith("/_nuxt/") &&
    !event.path.startsWith("/assets/") &&
    !event.path.startsWith("/icons/")
  )
    setHeader(event, "Cache-Control", "no-store");
  setHeader(event, "Referrer-Policy", "same-origin");
  setHeader(event, "X-Frame-Options", "DENY");
  setHeader(
    event,
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  if (process.env.NODE_ENV === "production")
    setHeader(
      event,
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  if (!event.path.startsWith("/api/")) return;
  setHeader(event, "Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(event.method)) {
    const origin = getHeader(event, "origin");
    if (!origin || origin !== getRequestURL(event).origin)
      throw createError({ statusCode: 403, statusMessage: "INVALID_ORIGIN" });
    if (!getHeader(event, "content-type")?.startsWith("application/json"))
      throw createError({ statusCode: 415, statusMessage: "JSON_REQUIRED" });
  }
});
