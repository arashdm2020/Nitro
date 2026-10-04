<script setup lang="ts">
import type { Account, PageResult } from "~/types";

const labels = useLabels();
definePageMeta({ layout: "admin" });
const search = ref(""),
  asset = ref(""),
  page = ref(1);
watch([search, asset], () => (page.value = 1));
const { data } = await useFetch<PageResult<Account>>("/api/admin/balances", {
  query: { search, asset, page },
});
</script>
<template>
  <div>
    <div class="admin-title">
      <div>
        <span class="eyebrow">{{ labels.uiFINANCIALOPERATIONS }}</span>
        <h1>{{ labels.uiUserBalances }}</h1>
        <p class="muted">
          {{
            labels.uiBalancesAreDerivedFromTheLedgerAdjustmentsRequireAReason
          }}
        </p>
      </div>
    </div>
    <div class="toolbar">
      <input
        v-model="search"
        :placeholder="labels.uiSearchUsername"
        :aria-label="labels.uiSearchBalances"
      ><select v-model="asset" :aria-label="labels.uiFilterAsset">
        <option value="">All assets</option>
        <option v-for="a in ['BTC', 'ETH', 'USDT', 'TRX', 'BNB']" :key="a">
          {{ a }}
        </option>
      </select>
    </div>
    <div class="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ labels.uiUser }}</th>
            <th>{{ labels.uiAsset }}</th>
            <th>{{ labels.uiAvailableBalance }}</th>
            <th>{{ labels.uiReserved }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in data?.items" :key="a.id">
            <td>@{{ a.user?.username }}</td>
            <td>
              <div class="inline-asset">
                <AssetIcon :symbol="a.asset.symbol" />{{ a.asset.symbol }}
              </div>
            </td>
            <td class="mono">{{ units(a.balance) }}</td>
            <td class="mono">{{ units(a.reservedBalance) }}</td>
            <td>
              <NuxtLink
                :to="`/admin/users/${a.userId}/balances`"
                class="link"
                >{{ labels.uiAdjustBalance }}</NuxtLink
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <Pagination v-model="page" :total="data?.total ?? 0" />
  </div>
</template>
