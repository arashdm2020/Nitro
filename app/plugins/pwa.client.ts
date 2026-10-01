export default defineNuxtPlugin(() => {
  if ("serviceWorker" in navigator && !import.meta.dev)
    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      },
      { once: true },
    );
});
