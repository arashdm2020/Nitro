<script setup lang="ts">
import { ArrowLeft, UserPlus } from "lucide-vue-next";
import type { User } from "~/types";

const labels = useLabels();
definePageMeta({ layout: "admin" });
const form = reactive({
    username: "",
    password: "",
    displayName: "",
    status: "ACTIVE",
  }),
  pending = ref(false),
  error = ref("");
async function save() {
  pending.value = true;
  error.value = "";
  try {
    const user = await $fetch<User>("/api/admin/users", {
      method: "POST",
      body: form,
    });
    await navigateTo(`/admin/users/${user.id}`);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <div>
    <NuxtLink to="/admin/users" class="back"
      ><ArrowLeft :size="17" />{{ labels.uiUsers }}</NuxtLink
    >
    <div class="admin-title">
      <div>
        <span class="eyebrow">{{ labels.uiADMINISTRATORMANAGED }}</span>
        <h1>{{ labels.uiCreateUser }}</h1>
        <p class="muted">
          {{ labels.uiProvisionALoginAndInitializeAssetAccounts }}
        </p>
      </div>
    </div>
    <form class="panel form-panel admin-form" @submit.prevent="save">
      <label
        >{{ labels.uiUsername
        }}<input
          v-model="form.username"
          required
          pattern="[a-z0-9][a-z0-9_.-]{2,31}"
          autocomplete="off"
          :placeholder="labels.uiAlice"
        ><small>{{
          labels.ui332LowercaseLettersNumbersPeriodsHyphensOrUnderscores
        }}</small></label
      ><label
        >{{ labels.uiInitialPassword
        }}<input
          v-model="form.password"
          type="password"
          required
          minlength="12"
          maxlength="128"
          autocomplete="new-password"
        ><small>{{
          labels.uiMinimum12CharactersDeliverCredentialsThroughASecureChannel
        }}</small></label
      ><label
        >{{ labels.uiDisplayName
        }}<input
          v-model="form.displayName"
          maxlength="80"
          :placeholder="labels.uiOptional" ></label
      ><label
        >{{ labels.uiAccountStatus
        }}<select v-model="form.status">
          <option>ACTIVE</option>
          <option>SUSPENDED</option>
          <option>DISABLED</option>
        </select></label
      >
      <p v-if="error" class="error">{{ error }}</p>
      <button class="button" :disabled="pending">
        <UserPlus :size="17" />{{ pending ? "Creating…" : "Create account" }}
      </button>
    </form>
  </div>
</template>
