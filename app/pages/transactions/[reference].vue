<script setup lang="ts">
import { ArrowLeft, Check, Clock, X } from "lucide-vue-next";
import type { Transaction } from "~/types";

const labels = useLabels();
const route = useRoute(),
  { data, error, refresh } = await useFetch<Transaction>(
    `/api/transactions/${route.params.reference}`,
  );
const isRequest = computed(() => data.value?.type === "BLOCKCHAIN");
const cancelling = ref(false),
  cancellationError = ref("");
async function cancel() {
  if (cancelling.value) return;
  cancelling.value = true;
  cancellationError.value = "";
  try {
    await $fetch(`/api/transactions/${route.params.reference}/cancel`, {
      method: "POST",
      body: {},
    });
    await Promise.all([refresh(), refreshNuxtData("wallet")]);
  } catch (e) {
    cancellationError.value = errorMessage(e);
  } finally {
    cancelling.value = false;
  }
}
</script>
<template>
  <div>
    <NuxtLink to="/transactions" class="back"
      ><ArrowLeft :size="17" />{{ labels.uiActivity }}</NuxtLink
    >
    <div v-if="data">
      <div class="receipt-heading">
        <span
          class="receipt-check"
          :class="{ waiting: data.status !== 'COMPLETED' }"
          ><Check v-if="data.status === 'COMPLETED'" :size="30" /><X
            v-else-if="data.status === 'CANCELLED'"
            :size="30" /><Clock v-else :size="30"
        /></span>
        <h1>
          {{
            data.status === "PENDING"
              ? labels.uiAwaitingProcessing
              : data.status === "CANCELLED"
                ? labels.uiRequestCancelled
                : data.status === "COMPLETED"
                  ? "Transfer complete"
                  : data.status
          }}
        </h1>
        <p v-if="!isRequest" class="muted">
          {{
            data.type === "INTERNAL"
              ? "Settled instantly within Nitro"
              : "Administrator balance adjustment"
          }}
        </p>
        <p v-else-if="data.status === 'PENDING'" class="muted">
          Demo request accepted. Funds are reserved; no blockchain transfer has
          been sent.
        </p>
        <h2>{{ units(data.amount) }} {{ data.asset.symbol }}</h2>
      </div>
      <section class="panel form-panel">
        <div class="detail-line">
          <span>{{ labels.uiStatus }}</span
          ><StatusBadge :status="data.status" />
        </div>
        <div class="detail-line">
          <span>{{ labels.uiFrom }}</span
          ><strong>{{ data.sender?.username ?? "Treasury" }}</strong>
        </div>
        <div class="detail-line">
          <span>{{ labels.uiTo }}</span
          ><strong class="recipient-address">{{
            data.recipientAddress ?? data.recipient?.username ?? "Treasury"
          }}</strong>
        </div>
        <div v-if="data.networkName" class="detail-line">
          <span>{{ labels.uiNetwork }}</span
          ><strong>{{ data.networkName }}</strong>
        </div>
        <div class="detail-line">
          <span>{{ labels.uiType }}</span
          ><strong>{{
            isRequest
              ? labels.uiTransferRequest
              : data.type.replaceAll("_", " ")
          }}</strong>
        </div>
        <div class="detail-line">
          <span>{{ labels.uiFee }}</span
          ><strong>{{ units(data.fee) }} {{ data.asset.symbol }}</strong>
        </div>
        <div class="detail-line">
          <span>{{ labels.uiCreated }}</span
          ><strong>{{ date(data.createdAt) }}</strong>
        </div>
        <div v-if="data.completedAt" class="detail-line">
          <span>{{ labels.uiCompleted }}</span
          ><strong>{{
            data.completedAt ? date(data.completedAt) : "—"
          }}</strong>
        </div>
        <label
          >{{
            isRequest
              ? labels.uiRequestReference
              : labels.uiTransactionReference
          }}
          <div class="address-box">
            <span class="mono">{{ data.reference }}</span
            ><CopyButton :value="data.reference" /></div
        ></label>
        <p v-if="!isRequest" class="muted note">
          {{
            labels.uiThisReferenceIdentifiesANitroLedgerTransactionItIsNotABlockchai
          }}
        </p>
        <p v-if="data.reason" class="muted">{{ data.reason }}</p>
        <p v-if="cancellationError" class="error" role="alert">
          {{ cancellationError }}
        </p>
        <button
          v-if="isRequest && data.status === 'PENDING'"
          class="button secondary full"
          :disabled="cancelling"
          @click="cancel"
        >
          {{ cancelling ? "Cancelling…" : labels.uiCancelRequest }}
        </button>
      </section>
    </div>
    <EmptyState
      v-else-if="error"
      :title="labels.uiTransactionUnavailable"
      description="This transaction may not belong to your account."
    />
  </div>
</template>
<style scoped>
.recipient-address {
  max-width: 78%;
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: right;
}
.receipt-check.waiting {
  color: var(--muted);
  background: var(--surface);
}
</style>
