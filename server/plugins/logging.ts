export default defineNitroPlugin((app) => {
  app.hooks.hook("afterResponse", (event) => {
    if (!event.path.startsWith("/api/")) return;
    console.info(
      JSON.stringify({
        event: "api_response",
        method: event.method,
        path: event.path.split("?")[0],
        status: event.node.res.statusCode,
      }),
    );
  });
});
