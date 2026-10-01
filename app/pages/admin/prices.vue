<script setup lang="ts">
import type { Asset } from "~/types";

const labels = useLabels();
definePageMeta({ layout: "admin" });
const { data, refresh, status } = await useFetch<Asset[]>("/api/admin/prices");
</script>
<template>
  <div>
    <div class="admin-title">
      <div>
        <span class="eyebrow">{{ labels.uiSERVERSIDEMARKETDATA }}</span>
        <h1>{{ labels.uiMarketPrices }}</h1>
        <p class="muted">
          {{ labels.uiCoinGeckoCachedPricesRefreshAtMostOncePerMinute }}
        </p>
      </div>
      <button
        class="button secondary"
        :disabled="status === 'pending'"
        @click="refresh()"
      >
        {{ labels.uiRefresh }}
      </button>
    </div>
    <div class="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ labels.uiAsset }}</th>
            <th>{{ labels.uiPrice }}</th>
            <th>{{ labels.ui24hChange }}</th>
            <th>{{ labels.uiProvider }}</th>
            <th>{{ labels.uiUpdated }}</th>
            <th>{{ labels.uiFreshness }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in data" :key="a.id">
            <td>
              <div class="inline-asset">
                <AssetIcon :symbol="a.symbol" />{{ a.symbol }}
              </div>
            </td>
            <td>{{ money(a.prices?.[0]?.value) }}</td>
            <td>
              {{
                a.prices?.[0]?.change24h
                  ? Number(a.prices[0].change24h).toFixed(2) + "%"
                  : "—"
              }}
            </td>
            <td>{{ a.prices?.[0]?.source ?? "—" }}</td>
            <td>{{ a.prices?.[0] ? date(a.prices[0].fetchedAt) : "—" }}</td>
            <td>
              {{
                a.prices?.[0]
                  ? Date.now() - new Date(a.prices[0].fetchedAt).getTime() >
                    300000
                    ? "Stale"
                    : "Current"
                  : "Unavailable"
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
