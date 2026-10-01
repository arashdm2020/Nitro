<script setup lang="ts">
const labels = useLabels();

definePageMeta({ layout: "admin" });
const { data } = await useFetch<{ feeBps: string }>("/api/admin/settings"),
  feeBps = ref(Number(data.value?.feeBps ?? 0)),
  pending = ref(false),
  error = ref(""),
  saved = ref(false);
async function save() {
  pending.value = true;
  error.value = "";
  saved.value = false;
  try {
    await $fetch("/api/admin/settings", {
      method: "PUT",
      body: { feeBps: feeBps.value },
    });
    saved.value = true;
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
        <span class="eyebrow">{{ labels.uiSYSTEMCONFIGURATION }}</span>
        <h1>{{ labels.uiSettings }}</h1>
        <p class="muted">
          {{ labels.uiChangesAreAppliedServerSideAndAudited }}
        </p>
      </div>
    </div>
    <form class="panel form-panel admin-form" @submit.prevent="save">
      <h3>{{ labels.uiInternalTransferFees }}</h3>
      <label
        >{{ labels.uiFeeInBasisPoints
        }}<input
          v-model.number="feeBps"
          type="number"
          min="0"
          max="1000"
          step="1"
          required
        ><small>{{
          labels.ui100BasisPoints1DefaultIsZeroFeesCreditTheSystemFeeAccount
        }}</small></label
      >
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="saved" class="success">{{ labels.uiSettingsSaved }}</p>
      <button class="button" :disabled="pending">
        {{ labels.uiSaveSettings }}
      </button>
    </form>
  </div>
</template>
