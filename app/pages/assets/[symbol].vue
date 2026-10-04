<script setup lang="ts">
import { ArrowUpRight, ArrowDownLeft, ArrowLeft } from "lucide-vue-next";
import Decimal from "decimal.js";
import type { PageResult, Transaction } from "~/types";

const labels = useLabels();
const route = useRoute(),
  { data: wallet } = await useWallet();
const account = computed(() =>
  wallet.value?.accounts.find((a) => a.asset.symbol === route.params.symbol),
);
if (!account.value)
  throw createError({ statusCode: 404, statusMessage: "Asset not found" });
const address = computed(() =>
  wallet.value?.wallets.find((w) => w.assetId === account.value?.assetId),
);
const { data: history } =
  await useFetch<PageResult<Transaction>>("/api/transactions");
</script>
<template>
  <div>
    <NuxtLink to="/assets" class="back"
      ><ArrowLeft :size="17" />{{ labels.uiAssets }}</NuxtLink
    ><template v-if="account"
      ><div class="asset-detail-heading">
        <AssetIcon :symbol="account.asset.symbol" />
        <h1>{{ account.asset.name }}</h1>
        <span class="muted">{{ account.asset.symbol }}</span>
      </div>
      <section class="detail-balance">
        <h1>
          {{ units(account.balance) }} <span>{{ account.asset.symbol }}</span>
        </h1>
        <p class="muted">
          {{
            account.asset.prices?.[0]
              ? money(
                  new Decimal(account.balance)
                    .mul(account.asset.prices[0].value)
                    .toString(),
                )
              : "USD valuation unavailable"
          }}
        </p>
        <span class="badge">{{ labels.uiAvailableBalance }}</span>
        <p v-if="Number(account.reservedBalance) > 0" class="muted">
          {{ labels.uiReserved }}: {{ units(account.reservedBalance) }}
          {{ account.asset.symbol }}
        </p>
      </section>
      <div class="quick-actions">
        <NuxtLink :to="`/send?asset=${account.asset.symbol}`" class="action"
          ><span><ArrowUpRight :size="23" /></span>{{ labels.uiSend }}</NuxtLink
        ><NuxtLink
          :to="`/receive?asset=${account.asset.symbol}`"
          class="action secondary-action"
          ><span><ArrowDownLeft :size="23" /></span
          >{{ labels.uiReceive }}</NuxtLink
        >
      </div>
      <div class="panel spaced">
        <div class="detail-line">
          <span>{{ labels.uiMarketPrice }}</span
          ><strong>{{ money(account.asset.prices?.[0]?.value) }}</strong>
        </div>
        <div class="detail-line">
          <span>{{ labels.ui24hChange }}</span
          ><strong>{{
            account.asset.prices?.[0]?.change24h
              ? Number(account.asset.prices[0].change24h).toFixed(2) + "%"
              : "Unavailable"
          }}</strong>
        </div>
        <div v-if="address" class="detail-line">
          <span>{{ labels.uiAssignedAddress }}</span
          ><span class="mono"
            >{{ short(address.address) }}<CopyButton :value="address.address"
          /></span>
        </div>
      </div>
      <div class="section-heading">
        <h3>{{ labels.uiRecentActivity }}</h3>
      </div>
      <TransactionRow
        v-for="tx in history?.items.filter(
          (t) => t.asset.id === account!.assetId,
        )"
        :key="tx.id"
        :transaction="tx"
        :user-id="wallet!.user.id" /><EmptyState
        v-if="!history?.items.some((t) => t.asset.id === account!.assetId)"
        :title="labels.uiNoActivityYet"
        description="Your transfers will appear here."
    /></template>
  </div>
</template>
