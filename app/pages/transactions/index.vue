<script setup lang="ts">
import type { PageResult, Transaction } from "~/types";
const { data: wallet } = await useWallet(),
  direction = ref("all"),
  page = ref(1),
  labels = useLabels();
watch(direction, () => (page.value = 1));
const { data, error, refresh } = await useFetch<PageResult<Transaction>>(
  "/api/transactions",
  { query: { direction, page } },
);
</script>
<template>
  <div>
    <div class="page-title">
      <span class="eyebrow">{{ labels.uiYOURTRANSFERHISTORY }}</span>
      <h1>{{ labels.uiActivity }}</h1>
      <p class="muted">{{ labels.uiEveryMovementClearlyRecorded }}</p>
    </div>
    <div class="tabs">
      <button
        v-for="filter in ['all', 'sent', 'received']"
        :key="filter"
        :class="{ active: direction === filter }"
        @click="direction = filter"
      >
        {{ filter }}
      </button>
    </div>
    <p v-if="error" class="error" @click="refresh()">
      {{ labels.uiUnableToLoadActivityTryAgain }}
    </p>
    <div class="transaction-list">
      <TransactionRow
        v-for="tx in data?.items"
        :key="tx.id"
        :transaction="tx"
        :user-id="wallet?.user.id ?? ''"
      />
    </div>
    <EmptyState
      v-if="!data?.items.length"
      :title="labels.noActivity"
      :description="labels.noActivityHint"
    /><Pagination
      v-if="(data?.total ?? 0) > 20"
      v-model="page"
      :total="data!.total"
    />
  </div>
</template>
