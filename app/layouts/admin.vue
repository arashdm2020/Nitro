<script setup lang="ts">
import {
  LayoutDashboard,
  Users,
  Coins,
  Network,
  ArrowLeftRight,
  Scale,
  ChartNoAxesCombined,
  ShieldCheck,
  Settings,
  LogOut,
  ArrowUpRight,
} from "lucide-vue-next";

const labels = useLabels();
const route = useRoute();
const items = [
  { to: "dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "users", label: "Users", icon: Users },
  { to: "balances", label: "Balances", icon: Scale },
  { to: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "assets", label: "Assets", icon: Coins },
  { to: "networks", label: "Networks", icon: Network },
  { to: "prices", label: "Market prices", icon: ChartNoAxesCombined },
  { to: "audit", label: "Audit trail", icon: ShieldCheck },
  { to: "settings", label: "Settings", icon: Settings },
];
async function logout() {
  await $fetch("/api/auth/logout", { method: "POST", body: {} });
  clearNuxtData();
  await navigateTo("/admin/login");
}
</script>
<template>
  <div class="admin-shell">
    <aside class="sidebar">
      <NuxtLink to="/admin/dashboard" class="brand"
        ><img src="/nitro.svg" alt="" ><span
          >{{ labels.uiNitro50 }}<span class="brand-dot">.</span></span
        ></NuxtLink
      ><span class="eyebrow sidebar-caption">{{ labels.uiOPERATIONS }}</span>
      <nav>
        <NuxtLink
          v-for="item in items"
          :key="item.to"
          :to="`/admin/${item.to}`"
          :class="{ active: route.path.startsWith(`/admin/${item.to}`) }"
          ><component :is="item.icon" :size="18" />{{ item.label }}</NuxtLink
        >
      </nav>
      <div class="sidebar-bottom">
        <NuxtLink to="/"
          ><ArrowUpRight :size="17" />{{ labels.uiOpenWallet }}</NuxtLink
        ><button @click="logout">
          <LogOut :size="17" />{{ labels.uiSignOut }}
        </button>
      </div>
    </aside>
    <div class="admin-content">
      <header class="admin-header">
        <span class="muted"
          >{{ labels.uiWorkspace }}
          <strong>{{
            items.find((i) => route.path.includes(i.to))?.label ??
            "User details"
          }}</strong></span
        ><span class="badge"
          ><ShieldCheck :size="13" /> {{ labels.uiAdministrator }}</span
        >
      </header>
      <main><slot /></main>
    </div>
  </div>
</template>
