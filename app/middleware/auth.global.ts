import type { User } from "~/types";
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/login" || to.path === "/admin/login") return;
  const request = useRequestFetch();
  try {
    const user = await request<User>("/api/auth/me");
    if (user.mustResetPassword && to.path !== "/profile")
      return navigateTo("/profile");
    if (to.path.startsWith("/admin") && user.role !== "ADMIN")
      return navigateTo("/");
  } catch (error) {
    const failure = error as {
      statusCode?: number;
      data?: { statusMessage?: string };
    };
    console.warn(
      JSON.stringify({
        event: "route_auth_failed",
        path: to.path,
        status: failure.statusCode,
        code: failure.data?.statusMessage,
        server: import.meta.server,
      }),
    );
    return navigateTo(to.path.startsWith("/admin") ? "/admin/login" : "/login");
  }
});
