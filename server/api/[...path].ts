export default defineEventHandler(() => {
  throw createError({ statusCode: 404, statusMessage: "API_NOT_FOUND" });
});
