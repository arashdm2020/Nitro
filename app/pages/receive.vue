<script setup lang="ts">
import QRCode from "qrcode";
import { ArrowLeft, Info } from "lucide-vue-next";

const labels = useLabels();
const { data: wallet } = await useWallet(),
  route = useRoute();
const assetId = ref(
  wallet.value?.accounts.find((a) => a.asset.symbol === route.query.asset)
    ?.assetId ??
    wallet.value?.accounts.find((a) => a.asset.enabled)?.assetId ??
    "",
);
const qr = ref<Record<string, string>>({});
const wallets = computed(
  () =>
    wallet.value?.wallets.filter(
      (w) => w.assetId === assetId.value && w.network.enabled,
    ) ?? [],
);
watch(
  wallets,
  async (values, _previous, onCleanup) => {
    let current = true;
    onCleanup(() => {
      current = false;
    });
    qr.value = {};
    const entries = await Promise.all(
      values.map(async (value) => {
        try {
          return [
            value.id,
            await QRCode.toDataURL(value.address, {
              width: 256,
              margin: 2,
              color: { dark: "#07090D", light: "#ffffff" },
            }),
          ] as const;
        } catch {
          return [value.id, ""] as const;
        }
      }),
    );
    if (current) qr.value = Object.fromEntries(entries);
  },
  { immediate: true },
);
</script>
<template>
  <div>
    <NuxtLink to="/" class="back"
      ><ArrowLeft :size="17" />{{ labels.uiWallet }}</NuxtLink
    >
    <div class="page-title">
      <span class="eyebrow">{{ labels.uiYOURASSIGNEDADDRESS }}</span>
      <h1>{{ labels.uiReceiveAssets }}</h1>
      <p class="muted">{{ labels.uiAddressesAreManagedByYourAdministrator }}</p>
    </div>
    <div class="panel form-panel">
      <label
        >{{ labels.uiAsset
        }}<select v-model="assetId">
          <option
            v-for="a in wallet?.accounts.filter((a) => a.asset.enabled)"
            :key="a.id"
            :value="a.assetId"
          >
            {{ a.asset.name }} · {{ a.asset.symbol }}
          </option>
        </select></label
      >
      <section
        v-for="assigned in wallets"
        :key="assigned.id"
        class="assigned-wallet"
      >
        <div class="detail-line">
          <span>{{ labels.uiNetwork }}</span>
          <strong>{{ assigned.network.name }}</strong>
        </div>
        <p class="muted note">
          Network set by your administrator for this address.
        </p>
        <div class="qr-card">
          <img
            v-if="qr[assigned.id]"
            :src="qr[assigned.id]"
            :alt="labels.uiAssignedWalletAddressQRCode"
          >
        </div>
        <div class="address-box">
          <span class="mono" dir="ltr">{{ assigned.address }}</span
          ><CopyButton :value="assigned.address" />
        </div>
        <p class="note muted">
          <Info :size="18" />{{
            labels.uiThisIsAnAdministratorManagedDisplayAddressOn
          }}
          {{ assigned.network.name
          }}{{ labels.uiExternalDepositsAreNotProcessedByNitroInThisVersion }}
        </p>
      </section>
      <EmptyState
        v-if="!wallets.length"
        :title="labels.uiNoAddressAssigned"
        description="Ask your administrator to assign an address for this asset."
      />
    </div>
    <div v-if="wallets.length" class="info-strip">
      <Info :size="18" />
      <div>
        <strong>{{ labels.uiReceivingAnInternalTransfer }}</strong>
        <p>
          {{ labels.uiShareYourAddress }}
        </p>
      </div>
    </div>
  </div>
</template>
<style scoped>
.assigned-wallet + .assigned-wallet {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border, #252830);
}
</style>
