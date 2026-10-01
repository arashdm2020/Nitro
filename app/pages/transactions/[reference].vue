<script setup lang="ts">
import { ArrowLeft, Check, ArrowUpRight } from "lucide-vue-next";
import type { Transaction } from "~/types";

const labels = useLabels();
const route = useRoute(),
  { data, error } = await useFetch<Transaction>(
    `/api/transactions/${route.params.reference}`,
  );
</script>
<template>
  <div>
    <NuxtLink to="/transactions" class="back"
      ><ArrowLeft :size="17" />{{ labels.uiActivity }}</NuxtLink
    >
    <div v-if="data">
      <div class="receipt-heading">
        <span class="receipt-check"
          ><Check v-if="data.status === 'COMPLETED'" :size="30" /><ArrowUpRight
            v-else
            :size="30"
        /></span>
        <h1>
          {{ data.status === "COMPLETED" ? "Transfer complete" : data.status }}
        </h1>
        <p class="muted">
          {{
            data.type === "INTERNAL"
              ? "Settled instantly within Nitro"
              : "Administrator balance adjustment"
          }}
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
          ><strong>{{ data.recipient?.username ?? "Treasury" }}</strong>
        </div>
        <div class="detail-line">
          <span>{{ labels.uiType }}</span
          ><strong>{{ data.type.replaceAll("_", " ") }}</strong>
        </div>
        <div class="detail-line">
          <span>{{ labels.uiFee }}</span
          ><strong>{{ units(data.fee) }} {{ data.asset.symbol }}</strong>
        </div>
        <div class="detail-line">
          <span>{{ labels.uiCreated }}</span
          ><strong>{{ date(data.createdAt) }}</strong>
        </div>
        <div class="detail-line">
          <span>{{ labels.uiCompleted }}</span
          ><strong>{{
            data.completedAt ? date(data.completedAt) : "—"
          }}</strong>
        </div>
        <label
          >{{ labels.uiTransactionReference }}
          <div class="address-box">
            <span class="mono">{{ data.reference }}</span
            ><CopyButton :value="data.reference" /></div
        ></label>
        <p class="muted note">
          {{
            labels.uiThisReferenceIdentifiesANitroLedgerTransactionItIsNotABlockchai
          }}
        </p>
        <p v-if="data.reason" class="muted">{{ data.reason }}</p>
      </section>
    </div>
    <EmptyState
      v-else-if="error"
      :title="labels.uiTransactionUnavailable"
      description="This transaction may not belong to your account."
    />
  </div>
</template>
