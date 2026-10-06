<script setup lang="ts">
import Decimal from "decimal.js";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-vue-next";
const TransferDecimal = Decimal.clone({ precision: 60 });

const labels = useLabels();
const { data: wallet, error: walletError, refresh } = await useWallet(),
  route = useRoute();
const form = reactive({
  assetId:
    wallet.value?.accounts.find((a) => a.asset.symbol === route.query.asset)
      ?.assetId ??
    wallet.value?.accounts.find((a) => a.asset.enabled)?.assetId ??
    "",
  recipientAddress: "",
  amount: "",
  recipientNetworkId: "",
});
const confirm = ref(false),
  pending = ref(false),
  error = ref(""),
  key = ref("");
type ResolvedRecipient = {
  kind: "INTERNAL" | "EXTERNAL";
  canSend: boolean;
  walletId: string | null;
  address: string;
  network: { id: string; name: string } | null;
  networks?: { id: string; name: string }[];
};
const recipient = ref<ResolvedRecipient | null>(null);
watch(
  () => [
    form.assetId,
    form.recipientAddress,
    form.amount,
    form.recipientNetworkId,
  ],
  () => {
    if (!pending.value) recipient.value = null;
  },
  { flush: "sync" },
);
watch(
  () => form.assetId,
  () => {
    form.recipientNetworkId = "";
  },
);
const account = computed(() =>
  wallet.value?.accounts.find((a) => a.assetId === form.assetId),
);
const fee = computed(() => {
  if (recipient.value?.kind === "EXTERNAL") return "0";
  try {
    return new TransferDecimal(form.amount || "0")
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
    return new TransferDecimal(form.amount || "0").add(fee.value).toString();
  } catch {
    return "0";
  }
});
async function review() {
  if (pending.value) return;
  error.value = "";
  pending.value = true;
  try {
    await refresh();
    if (walletError.value || !wallet.value) {
      error.value = errorMessage(walletError.value);
      pending.value = false;
      return;
    }
    const n = new TransferDecimal(form.amount);
    if (
      !/^(0|[1-9]\d{0,19})(\.\d{1,18})?$/.test(form.amount) ||
      !n.isFinite() ||
      !n.gt(0) ||
      n.decimalPlaces() > (account.value?.asset.decimals ?? 0)
    )
      throw Error();
    if (n.gt(account.value?.balance ?? "0")) {
      error.value = "Your available balance is insufficient.";
      pending.value = false;
      return;
    }
  } catch {
    error.value = "Enter a positive amount within the asset precision.";
    pending.value = false;
    return;
  }
  pending.value = true;
  try {
    recipient.value = await $fetch<ResolvedRecipient>(
      "/api/transfers/resolve",
      {
        method: "POST",
        body: {
          assetId: form.assetId,
          recipientAddress: form.recipientAddress.trim(),
          recipientNetworkId: form.recipientNetworkId || undefined,
        },
      },
    );
    if (new TransferDecimal(total.value).gt(account.value?.balance ?? "0")) {
      error.value = "Your available balance is insufficient.";
      return;
    }
    form.recipientAddress = recipient.value!.address;
    key.value = crypto.randomUUID();
    confirm.value = true;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    pending.value = false;
  }
}
async function send() {
  if (pending.value || !recipient.value?.canSend) return;
  pending.value = true;
  error.value = "";
  try {
    const result = await $fetch<{ reference: string }>("/api/transfers", {
      method: "POST",
      body: {
        ...form,
        recipientWalletId: recipient.value.walletId ?? undefined,
        recipientNetworkId: recipient.value.network?.id,
        idempotencyKey: key.value,
      },
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
      <span class="eyebrow">{{ labels.uiSendAssetsEyebrow }}</span>
      <h1>{{ confirm ? "Review transfer" : "Send assets" }}</h1>
      <p class="muted">{{ labels.uiSendAddressDescription }}</p>
    </div>
    <form v-if="!confirm" class="panel form-panel" @submit.prevent="review">
      <label
        >{{ labels.uiAsset
        }}<select v-model="form.assetId" :disabled="pending">
          <option
            v-for="a in wallet?.accounts.filter((a) => a.asset.enabled)"
            :key="a.id"
            :value="a.assetId"
          >
            {{ a.asset.name }} · {{ a.asset.symbol }}
          </option>
        </select></label
      ><label>
        {{ labels.uiNetwork }}
        <select v-model="form.recipientNetworkId" :disabled="pending">
          <option value="">Automatic (when unambiguous)</option>
          <option
            v-for="mapping in account?.asset.networks?.filter(
              (m) => m.network?.enabled,
            )"
            :key="mapping.networkId"
            :value="mapping.networkId"
          >
            {{ mapping.network?.name }}
          </option>
        </select> </label
      ><label
        >{{ labels.uiRecipientAddress
        }}<input
          v-model="form.recipientAddress"
          :disabled="pending"
          type="text"
          required
          minlength="8"
          maxlength="256"
          :placeholder="labels.uiEnterRecipientAddress"
          autocomplete="off"
          :spellcheck="false"
          autocapitalize="none"
          dir="ltr"
        ><small>{{ labels.uiRecipientAddressHelp }}</small></label
      ><label
        >{{ labels.uiAmount }}
        <div class="amount-input">
          <input
            v-model="form.amount"
            :disabled="pending"
            required
            inputmode="decimal"
            placeholder="0.00"
          ><span>{{ account?.asset.symbol }}</span>
        </div>
        <small
          >{{ labels.uiAvailable }} {{ units(account?.balance ?? "0") }}
          {{ account?.asset.symbol }}</small
        ><small v-if="Number(account?.reservedBalance) > 0">
          {{ labels.uiReserved }}: {{ units(account!.reservedBalance) }}
          {{ account?.asset.symbol }}
        </small></label
      >
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="button full" :disabled="pending">
        {{ pending ? "Checking address…" : labels.uiReviewTransfer
        }}<ArrowUpRight :size="18" />
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
        ><strong class="mono recipient-address" dir="ltr">{{
          recipient?.address
        }}</strong>
      </div>
      <div class="detail-line">
        <span>{{ labels.uiNetwork }}</span
        ><strong>{{
          recipient?.network?.name ?? labels.uiNetworkNotDetermined
        }}</strong>
      </div>
      <div class="detail-line">
        <span>{{ labels.uiTransferType }}</span
        ><strong>{{
          recipient?.kind === "INTERNAL"
            ? labels.uiInternalNitro
            : labels.uiExternalWallet
        }}</strong>
      </div>
      <div v-if="recipient?.canSend" class="detail-line">
        <span>{{ labels.uiFee }}</span
        ><strong>{{ fee }} {{ account?.asset.symbol }}</strong>
      </div>
      <div v-if="recipient?.canSend" class="detail-line">
        <span>{{
          recipient?.kind === "EXTERNAL"
            ? labels.uiAmountReserved
            : labels.uiTotalDebit
        }}</span
        ><strong>{{ total }} {{ account?.asset.symbol }}</strong>
      </div>
      <div
        v-if="recipient?.kind === 'EXTERNAL' && recipient.canSend"
        class="detail-line"
      >
        <span>{{ labels.uiStatus }}</span
        ><StatusBadge status="PENDING" />
      </div>
      <p v-if="recipient?.kind === 'INTERNAL'" class="muted note">
        <ShieldCheck :size="16" />{{
          labels.uiCompletedInternalTransfersCannotBeReversedByTheSender
        }}
      </p>
      <p v-else-if="recipient?.canSend" class="muted note" role="status">
        Demo request: funds will be reserved for this asset. No blockchain
        transfer will be sent.
      </p>
      <div
        v-else-if="!recipient?.canSend"
        class="external-status"
        role="status"
      >
        <strong>{{ labels.uiAddressVerified }}</strong>
        <p v-if="!recipient?.network">
          {{ labels.uiCompatibleNetworks }}
          {{ recipient?.networks?.map((network) => network.name).join(", ") }}.
          {{ labels.uiAddressDoesNotIdentifyNetwork }}
          Edit details and select the destination network.
        </p>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button
        class="button full"
        :disabled="pending || !recipient?.canSend"
        @click="send"
      >
        {{
          !recipient?.canSend
            ? labels.uiNetworkNotDetermined
            : pending
              ? "Submitting…"
              : recipient?.kind === "EXTERNAL"
                ? labels.uiConfirmRequest
                : "Confirm & send"
        }}</button
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
<style scoped>
.recipient-address {
  overflow-wrap: anywhere;
  min-width: 0;
  max-width: 78%;
  text-align: right;
}
.external-status {
  margin: 20px 0;
  padding: 16px;
  border: 1px solid var(--border, #252830);
  border-radius: 12px;
}
.external-status p {
  margin: 8px 0 0;
  color: var(--muted, #8c95a4);
  line-height: 1.6;
}
</style>
