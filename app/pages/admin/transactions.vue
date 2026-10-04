<script setup lang="ts">
import type { PageResult, Transaction } from "~/types";

const labels = useLabels();
definePageMeta({ layout: "admin" });
const search = ref(""),
  type = ref(""),
  status = ref(""),
  asset = ref(""),
  since = ref(""),
  until = ref(""),
  page = ref(1);
watch([search, type, status, asset, since, until], () => (page.value = 1));
const { data, error } = await useFetch<PageResult<Transaction>>(
  "/api/admin/transactions",
  { query: { search, type, status, asset, since, until, page } },
);
</script>
<template>
  <div>
    <div class="admin-title">
      <div>
        <span class="eyebrow">{{ labels.uiLEDGEREXPLORER }}</span>
        <h1>{{ labels.uiTransactions }}</h1>
        <p class="muted">{{ labels.uiInspectEveryTransferAndAdjustment }}</p>
      </div>
    </div>
    <div class="toolbar wrap">
      <input
        v-model="search"
        :placeholder="labels.uiReferenceUsernameOrAddress"
        :aria-label="labels.uiSearchTransactions"
      ><select v-model="type" :aria-label="labels.uiTransactionType">
        <option value="">All types</option>
        <option>INTERNAL</option>
        <option value="BLOCKCHAIN">Transfer request</option>
        <option>ADMIN_ADJUSTMENT</option></select
      ><select v-model="status" :aria-label="labels.uiTransactionStatus">
        <option value="">All statuses</option>
        <option>COMPLETED</option>
        <option value="PENDING">{{ labels.uiAwaitingProcessing }}</option>
        <option>FAILED</option>
        <option>CANCELLED</option></select
      ><select v-model="asset" :aria-label="labels.uiAssetFilter">
        <option value="">All assets</option>
        <option v-for="a in ['BTC', 'ETH', 'USDT', 'TRX', 'BNB']" :key="a">
          {{ a }}
        </option></select
      ><input
        v-model="since"
        type="date"
        :aria-label="labels.uiStartDate"
      ><input v-model="until" type="date" :aria-label="labels.uiEndDate" >
    </div>
    <p v-if="error" class="error">{{ labels.uiCouldNotLoadTransactions }}</p>
    <section class="panel">
      <TransactionTable :items="data?.items ?? []" />
    </section>
    <Pagination v-model="page" :total="data?.total ?? 0" />
  </div>
</template>
