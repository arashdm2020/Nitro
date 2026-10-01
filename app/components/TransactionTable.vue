<script setup lang="ts">
import type { Transaction } from "~/types";

const labels = useLabels();
defineProps<{ items: Transaction[] }>();
</script>
<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>{{ labels.uiReference }}</th>
          <th>{{ labels.uiType }}</th>
          <th>{{ labels.uiSender }}</th>
          <th>{{ labels.uiRecipient }}</th>
          <th>{{ labels.uiAmount }}</th>
          <th>{{ labels.uiStatus }}</th>
          <th>{{ labels.uiTime }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tx in items" :key="tx.id">
          <td>
            <NuxtLink :to="`/transactions/${tx.reference}`" class="mono link">{{
              short(tx.reference)
            }}</NuxtLink>
          </td>
          <td>{{ tx.type.replaceAll("_", " ") }}</td>
          <td>{{ tx.sender?.username ?? "Treasury" }}</td>
          <td>{{ tx.recipient?.username ?? "Treasury" }}</td>
          <td>{{ units(tx.amount) }} {{ tx.asset.symbol }}</td>
          <td><StatusBadge :status="tx.status" /></td>
          <td>{{ date(tx.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="!items.length" class="empty">
      {{ labels.uiNoTransactionsMatchTheseFilters }}
    </div>
  </div>
</template>
