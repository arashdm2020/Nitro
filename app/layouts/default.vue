<script setup lang="ts">
import {
  Wallet,
  Layers,
  ArrowLeftRight,
  UserRound,
  ShieldCheck,
} from "lucide-vue-next";
const route = useRoute(),
  labels = useLabels();
const links = [
  { to: "/", label: labels.wallet, icon: Wallet },
  { to: "/assets", label: labels.assets, icon: Layers },
  { to: "/transactions", label: labels.activity, icon: ArrowLeftRight },
  { to: "/profile", label: labels.profile, icon: UserRound },
];
</script>
<template>
  <div class="wallet-shell">
    <header class="wallet-header">
      <NuxtLink to="/" class="brand"
        ><img src="/nitro.svg" alt="" ><span
          >{{ labels.uiNitro56 }}<span class="brand-dot">.</span></span
        ></NuxtLink
      ><NuxtLink to="/profile" class="avatar" :aria-label="labels.uiProfile"
        ><UserRound :size="19"
      /></NuxtLink>
    </header>
    <main class="wallet-main"><slot /></main>
    <div class="wallet-footnote">
      <ShieldCheck :size="13" /> {{ labels.uiPrivateConnectedInYourControl }}
    </div>
    <nav class="bottom-nav" :aria-label="labels.uiMainNavigation">
      <NuxtLink
        v-for="item in links"
        :key="item.to"
        :to="item.to"
        :class="{
          active:
            item.to === '/'
              ? route.path === '/'
              : route.path.startsWith(item.to),
        }"
        ><component :is="item.icon" :size="20" /><span>{{
          item.label
        }}</span></NuxtLink
      >
    </nav>
  </div>
</template>
