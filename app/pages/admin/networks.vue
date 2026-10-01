<script setup lang="ts">
import type { Asset, Network } from "~/types";

const labels = useLabels();
definePageMeta({ layout: "admin" });
const { data, refresh } = await useFetch<{
    assets: Asset[];
    networks: Network[];
  }>("/api/admin/catalog"),
  error = ref(""),
  pending = ref(false),
  editing = ref(false);
const form = reactive({
  id: undefined as string | undefined,
  name: "",
  slug: "",
  nativeAsset: "ETH",
  chainId: null as number | null,
  explorerBaseUrl: null as string | null,
  enabled: true,
  networkType: "EVM",
  assetIds: [] as string[],
});
function edit(n?: Network) {
  Object.assign(form, {
    id: n?.id,
    name: n?.name ?? "",
    slug: n?.slug ?? "",
    nativeAsset: n?.nativeAsset ?? "ETH",
    chainId: n?.chainId ?? null,
    explorerBaseUrl: n?.explorerBaseUrl ?? null,
    enabled: n?.enabled ?? true,
    networkType: n?.networkType ?? "EVM",
    assetIds: n?.assets?.map((a) => a.assetId) ?? [],
  });
  editing.value = true;
}
async function save() {
  pending.value = true;
  error.value = "";
  try {
    await $fetch("/api/admin/networks", {
      method: "POST",
      body: {
        ...form,
        chainId: form.chainId || null,
        explorerBaseUrl: form.explorerBaseUrl || null,
      },
    });
    editing.value = false;
    await refresh();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <div>
    <div class="admin-title">
      <div>
        <span class="eyebrow">{{ labels.uiNETWORKCONFIGURATION }}</span>
        <h1>{{ labels.uiNetworks }}</h1>
        <p class="muted">{{ labels.uiManageAssetSupportAcrossChains }}</p>
      </div>
      <button class="button" @click="edit()">{{ labels.uiAddNetwork }}</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ labels.uiNetwork }}</th>
            <th>{{ labels.uiType }}</th>
            <th>{{ labels.uiChainID }}</th>
            <th>{{ labels.uiNativeAsset }}</th>
            <th>{{ labels.uiEnabled }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in data?.networks" :key="n.id">
            <td>
              <strong>{{ n.name }}</strong
              ><small>{{ n.slug }}</small>
            </td>
            <td>{{ n.networkType }}</td>
            <td>{{ n.chainId ?? "—" }}</td>
            <td>{{ n.nativeAsset }}</td>
            <td><StatusBadge :status="n.enabled ? 'ACTIVE' : 'DISABLED'" /></td>
            <td>
              <button class="link" @click="edit(n)">
                {{ labels.uiEdit109 }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <form
      v-if="editing"
      class="panel form-panel admin-form spaced"
      @submit.prevent="save"
    >
      <h3>{{ form.id ? "Edit network" : "New network" }}</h3>
      <label
        >{{ labels.uiName
        }}<input
          v-model="form.name"
          required
          minlength="2"
          maxlength="80" ></label
      ><label
        >{{ labels.uiSlug
        }}<input
          v-model="form.slug"
          required
          pattern="[a-z0-9-]{2,50}" ></label
      ><label
        >{{ labels.uiType
        }}<select v-model="form.networkType">
          <option>EVM</option>
          <option>BITCOIN</option>
          <option>TRON</option>
          <option>VIRTUAL</option>
        </select></label
      ><label
        >{{ labels.uiNativeAsset
        }}<select v-model="form.nativeAsset">
          <option v-for="a in data?.assets" :key="a.id">{{ a.symbol }}</option>
        </select></label
      ><label
        >{{ labels.uiChainID
        }}<input v-model.number="form.chainId" type="number" min="1" ></label
      ><label
        >{{ labels.uiExplorerURL
        }}<input
          v-model="form.explorerBaseUrl"
          type="url"
          :placeholder="labels.uiHttps" ></label
      ><label class="checkbox-label"
        ><input v-model="form.enabled" type="checkbox" >{{
          labels.uiEnabled
        }}</label
      >
      <fieldset>
        <legend>{{ labels.uiSupportedAssets }}</legend>
        <label v-for="a in data?.assets" :key="a.id" class="checkbox-label"
          ><input v-model="form.assetIds" type="checkbox" :value="a.id" >{{
            a.symbol
          }}</label
        >
      </fieldset>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="button" :disabled="pending || !form.assetIds.length">
        {{ labels.uiSaveNetwork }}</button
      ><button type="button" class="button secondary" @click="editing = false">
        {{ labels.uiCancel }}
      </button>
    </form>
  </div>
</template>
