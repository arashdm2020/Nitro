<script setup lang="ts">
import QRCode from "qrcode";
import { ArrowLeft, Info } from "lucide-vue-next";

const labels = useLabels();
const { data: wallet } = await useWallet(),
  route = useRoute();
const assetId = ref(
  wallet.value?.accounts.find((a) => a.asset.symbol === route.query.asset)
    ?.assetId ??
    wallet.value?.accounts[0]?.assetId ??
    "",
);
const networkId = ref(""),
  qr = ref("");
const wallets = computed(
  () =>
    wallet.value?.wallets.filter(
      (w) => w.assetId === assetId.value && w.network.enabled,
    ) ?? [],
);
const selected = computed(
  () =>
    wallets.value.find((w) => w.networkId === networkId.value) ??
    wallets.value[0],
);
watch(
  selected,
  async (value) => {
    qr.value = value
      ? await QRCode.toDataURL(value.address, {
          width: 256,
          margin: 2,
          color: { dark: "#07090D", light: "#ffffff" },
        })
      : "";
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
      ><template v-if="selected"
        ><label
          >{{ labels.uiNetwork
          }}<select v-model="networkId">
            <option v-for="a in wallets" :key="a.id" :value="a.networkId">
              {{ a.network.name }}
            </option>
          </select></label
        >
        <div class="qr-card">
          <img
            v-if="qr"
            :src="qr"
            :alt="labels.uiAssignedWalletAddressQRCode"
          >
        </div>
        <div class="address-box">
          <span class="mono">{{ selected.address }}</span
          ><CopyButton :value="selected.address" />
        </div>
        <p class="note muted">
          <Info :size="18" />{{
            labels.uiThisIsAnAdministratorManagedDisplayAddressOn
          }}
          {{ selected.network.name
          }}{{ labels.uiExternalDepositsAreNotProcessedByNitroInThisVersion }}
        </p></template
      ><EmptyState
        v-else
        :title="labels.uiNoAddressAssigned"
        description="Ask your administrator to assign an address for this asset."
      />
    </div>
    <div class="info-strip">
      <Info :size="18" />
      <div>
        <strong>{{ labels.uiReceivingAnInternalTransfer }}</strong>
        <p>
          {{ labels.uiShareYourUsername }}{{ wallet?.user.username }}
          <CopyButton :value="wallet?.user.username ?? ''" />
        </p>
      </div>
    </div>
  </div>
</template>
