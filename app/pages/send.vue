<script setup lang="ts">
import Decimal from "decimal.js";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-vue-next";

const labels = useLabels();
const { data: wallet, refresh } = await useWallet(),
  route = useRoute();
const form = reactive({
  assetId:
    wallet.value?.accounts.find((a) => a.asset.symbol === route.query.asset)
      ?.assetId ??
    wallet.value?.accounts.find((a) => a.asset.enabled)?.assetId ??
    "",
  recipient: "",
  amount: "",
});
const confirm = ref(false),
  pending = ref(false),
  error = ref(""),
  key = ref("");
const account = computed(() =>
  wallet.value?.accounts.find((a) => a.assetId === form.assetId),
);
const fee = computed(() => {
  try {
    return new Decimal(form.amount || "0")
      .mul(wallet.value?.feeBps ?? "0")
      .div(10000)
      .toDecimalPlaces(account.value?.asset.decimals ?? 18, Decimal.ROUND_UP)
      .toString();
  } catch {
    return "0";
  }
});
const total = computed(() => {
  try {
    return new Decimal(form.amount || "0").add(fee.value).toString();
  } catch {
    return "0";
  }
});
function review() {
  error.value = "";
  try {
    const n = new Decimal(form.amount);
    if (
      !n.gt(0) ||
      n.decimalPlaces() > (account.value?.asset.decimals ?? 0) ||
      new Decimal(total.value).gt(account.value?.balance ?? "0")
    )
      throw Error();
    key.value = crypto.randomUUID();
    confirm.value = true;
  } catch {
    error.value = "Enter a valid amount within your available balance.";
  }
}
async function send() {
  pending.value = true;
  error.value = "";
  try {
    const result = await $fetch<{ reference: string }>("/api/transfers", {
      method: "POST",
      body: { ...form, idempotencyKey: key.value },
    });
    await refresh();
    await navigateTo(`/transactions/${result.reference}`);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <div>
    <NuxtLink to="/" class="back"
      ><ArrowLeft :size="17" />{{ labels.uiWallet }}</NuxtLink
    >
    <div class="page-title">
      <span class="eyebrow">{{ labels.uiINTERNALTRANSFER }}</span>
      <h1>{{ confirm ? "Review transfer" : "Send assets" }}</h1>
      <p class="muted">{{ labels.uiInstantTransfersToAnotherNitroAccount }}</p>
    </div>
    <form v-if="!confirm" class="panel form-panel" @submit.prevent="review">
      <label
        >{{ labels.uiAsset
        }}<select v-model="form.assetId">
          <option
            v-for="a in wallet?.accounts.filter((a) => a.asset.enabled)"
            :key="a.id"
            :value="a.assetId"
          >
            {{ a.asset.name }} · {{ a.asset.symbol }}
          </option>
        </select></label
      ><label
        >{{ labels.uiRecipientUsername
        }}<input
          v-model="form.recipient"
          required
          pattern="[a-z0-9][a-z0-9_.-]{2,31}"
          :placeholder="labels.uiEGAlice"
          autocapitalize="none" ></label
      ><label
        >{{ labels.uiAmount }}
        <div class="amount-input">
          <input
            v-model="form.amount"
            required
            inputmode="decimal"
            placeholder="0.00"
          ><span>{{ account?.asset.symbol }}</span>
        </div>
        <small
          >{{ labels.uiAvailable }} {{ units(account?.balance ?? "0") }}
          {{ account?.asset.symbol }}</small
        ></label
      >
      <div class="detail-line">
        <span>{{ labels.uiNetworkFee }}</span
        ><strong>{{ fee }} {{ account?.asset.symbol }}</strong>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="button full">
        {{ labels.uiReviewTransfer }}<ArrowUpRight :size="18" />
      </button>
    </form>
    <section v-else class="panel form-panel">
      <div class="review-amount">
        <AssetIcon :symbol="account!.asset.symbol" />
        <h1>
          {{ units(form.amount) }} <span>{{ account?.asset.symbol }}</span>
        </h1>
      </div>
      <div class="detail-line">
        <span>{{ labels.uiTo }}</span
        ><strong>@{{ form.recipient }}</strong>
      </div>
      <div class="detail-line">
        <span>{{ labels.uiTransferType }}</span
        ><strong>{{ labels.uiInternalNitro }}</strong>
      </div>
      <div class="detail-line">
        <span>{{ labels.uiFee }}</span
        ><strong>{{ fee }} {{ account?.asset.symbol }}</strong>
      </div>
      <div class="detail-line">
        <span>{{ labels.uiTotalDebit }}</span
        ><strong>{{ total }} {{ account?.asset.symbol }}</strong>
      </div>
      <p class="muted note">
        <ShieldCheck :size="16" />{{
          labels.uiCompletedInternalTransfersCannotBeReversedByTheSender
        }}
      </p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="button full" :disabled="pending" @click="send">
        {{ pending ? "Sending…" : "Confirm & send" }}</button
      ><button
        class="button secondary full"
        :disabled="pending"
        @click="confirm = false"
      >
        {{ labels.uiEditDetails }}
      </button>
    </section>
  </div>
</template>
