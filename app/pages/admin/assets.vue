<script setup lang="ts">
import type { Asset, Network } from "~/types";

const labels = useLabels();
definePageMeta({ layout: "admin" });
const { data, refresh } = await useFetch<{
    assets: Asset[];
    networks: Network[];
  }>("/api/admin/catalog"),
  error = ref(""),
  pending = ref(false);
async function save(a: Asset) {
  pending.value = true;
  error.value = "";
  try {
    await $fetch(`/api/admin/assets/${a.id}`, {
      method: "PATCH",
      body: {
        name: a.name,
        enabled: a.enabled,
        displayOrder: a.displayOrder,
        priceTrackingEnabled: a.priceTrackingEnabled,
      },
    });
    await refresh();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <div>
    <div class="admin-title">
      <div>
        <span class="eyebrow">{{ labels.uiASSETREGISTRY }}</span>
        <h1>{{ labels.uiSupportedAssets }}</h1>
        <p class="muted">
          {{ labels.uiConfigureVisibilityOrderAndPriceTracking }}
        </p>
      </div>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ labels.uiAsset }}</th>
            <th>{{ labels.uiName }}</th>
            <th>{{ labels.uiOrder }}</th>
            <th>{{ labels.uiEnabled }}</th>
            <th>{{ labels.uiTrackPrices }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in data?.assets" :key="a.id">
            <td>
              <div class="inline-asset">
                <AssetIcon :symbol="a.symbol" />{{ a.symbol }}
              </div>
            </td>
            <td><input v-model="a.name" :aria-label="labels.uiAssetName" ></td>
            <td>
              <input
                v-model.number="a.displayOrder"
                type="number"
                min="0"
                max="1000"
                class="small-input"
                :aria-label="labels.uiDisplayOrder"
              >
            </td>
            <td>
              <input
                v-model="a.enabled"
                type="checkbox"
                :aria-label="labels.uiAssetEnabled"
              >
            </td>
            <td>
              <input
                v-model="a.priceTrackingEnabled"
                type="checkbox"
                :aria-label="labels.uiPriceTracking"
              >
            </td>
            <td>
              <button
                class="button secondary"
                :disabled="pending"
                @click="save(a)"
              >
                {{ labels.uiSave }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
