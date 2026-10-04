<script setup lang="ts">
import { ArrowUpRight, ArrowDownLeft } from "lucide-vue-next";
import type { Transaction } from "~/types";
const props = defineProps<{ transaction: Transaction; userId: string }>();
const sent = computed(() => props.transaction.senderId === props.userId);
const labels = useLabels();
</script>
<template>
  <NuxtLink
    :to="`/transactions/${transaction.reference}`"
    class="transaction-row"
    ><span class="direction"
      ><ArrowUpRight v-if="sent" :size="20" /><ArrowDownLeft v-else :size="20"
    /></span>
    <div class="grow">
      <strong
        >{{
          transaction.type === "BLOCKCHAIN"
            ? "Request to"
            : sent
              ? "Sent to"
              : "Received from"
        }}
        {{
          (sent
            ? transaction.recipientAddress
              ? short(transaction.recipientAddress)
              : transaction.recipient?.username
            : transaction.sender?.username) ?? "Administrator"
        }}</strong
      ><small
        >{{ date(transaction.createdAt) }} ·
        {{
          transaction.type === "BLOCKCHAIN"
            ? labels.uiTransferRequest
            : transaction.type === "INTERNAL"
              ? "Internal"
              : "Adjustment"
        }}</small
      >
    </div>
    <div class="right">
      <strong :class="sent ? '' : 'success'"
        >{{ transaction.type === "BLOCKCHAIN" ? "" : sent ? "−" : "+"
        }}{{ units(transaction.amount) }} {{ transaction.asset.symbol }}</strong
      ><small>{{
        transaction.status === "PENDING"
          ? labels.uiAwaitingProcessing
          : transaction.status.toLowerCase()
      }}</small>
    </div></NuxtLink
  >
</template>
