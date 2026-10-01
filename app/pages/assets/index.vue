<script setup lang="ts">
const labels = useLabels();

const { data: wallet } = await useWallet(),
  search = ref("");
const accounts = computed(() =>
  wallet.value?.accounts.filter(
    (a) =>
      a.asset.enabled &&
      `${a.asset.name} ${a.asset.symbol}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
  ),
);
</script>
<template>
  <div>
    <div class="page-title">
      <span class="eyebrow">{{ labels.uiYOURPORTFOLIO }}</span>
      <h1>{{ labels.uiAssets }}</h1>
      <p class="muted">{{ labels.uiAllYourBalancesInOnePlace }}</p>
    </div>
    <input
      v-model="search"
      :placeholder="labels.uiSearchAssets"
      :aria-label="labels.uiSearchAssets"
    >
    <div class="asset-list spaced">
      <NuxtLink
        v-for="a in accounts"
        :key="a.id"
        :to="`/assets/${a.asset.symbol}`"
        class="asset-row"
        ><AssetIcon :symbol="a.asset.symbol" />
        <div class="grow">
          <strong>{{ a.asset.name }}</strong
          ><small>{{ a.asset.symbol }}</small>
        </div>
        <div class="right">
          <strong>{{ units(a.balance) }}</strong
          ><small
            >{{ money(a.asset.prices?.[0]?.value) }} {{ labels.uiUnit }}</small
          >
        </div></NuxtLink
      >
    </div>
  </div>
</template>
