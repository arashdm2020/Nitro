<script setup lang="ts">
import { LogOut, ShieldCheck } from "lucide-vue-next";
import type { User } from "~/types";

const labels = useLabels();
const { data: user } = await useFetch<User>("/api/auth/me"),
  form = reactive({ currentPassword: "", password: "" }),
  error = ref(""),
  pending = ref(false);
async function logout() {
  await $fetch("/api/auth/logout", { method: "POST", body: {} });
  clearNuxtData();
  await navigateTo("/login");
}
async function change() {
  error.value = "";
  pending.value = true;
  try {
    await $fetch("/api/auth/password", { method: "POST", body: form });
    clearNuxtData();
    await navigateTo("/login");
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <div>
    <div class="page-title">
      <span class="eyebrow">{{ labels.uiACCOUNTSETTINGS }}</span>
      <h1>{{ user?.displayName ?? user?.username }}</h1>
      <p class="muted">
        @{{ user?.username }} · {{ user?.role.toLowerCase() }}
      </p>
    </div>
    <div v-if="user?.mustResetPassword" class="info-strip">
      <ShieldCheck :size="20" />{{
        labels.uiChangeYourInitialPasswordToContinue
      }}
    </div>
    <form class="panel form-panel" @submit.prevent="change">
      <h3>{{ labels.uiChangePassword }}</h3>
      <label
        >{{ labels.uiCurrentPassword
        }}<input
          v-model="form.currentPassword"
          type="password"
          required
          autocomplete="current-password" ></label
      ><label
        >{{ labels.uiNewPassword
        }}<input
          v-model="form.password"
          type="password"
          minlength="12"
          maxlength="128"
          required
          autocomplete="new-password"
        ><small>{{
          labels.uiAtLeast12CharactersYouWillBeSignedOutOnAllDevices
        }}</small></label
      >
      <p v-if="error" class="error">{{ error }}</p>
      <button class="button full" :disabled="pending">
        {{ pending ? "Updating…" : "Update password" }}
      </button>
    </form>
    <NuxtLink
      v-if="user?.role === 'ADMIN' && !user.mustResetPassword"
      to="/admin/dashboard"
      class="button secondary full spaced"
      >{{ labels.uiOpenAdministration }}</NuxtLink
    ><button class="button secondary full spaced" @click="logout">
      <LogOut :size="17" />{{ labels.uiSignOut }}
    </button>
  </div>
</template>
