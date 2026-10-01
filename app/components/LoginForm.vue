<script setup lang="ts">
import { ArrowRight, LockKeyhole } from "lucide-vue-next";
const props = defineProps<{ admin?: boolean }>(),
  labels = useLabels();
const form = reactive({ username: "", password: "" }),
  error = ref(""),
  pending = ref(false);
async function login() {
  pending.value = true;
  error.value = "";
  try {
    await $fetch("/api/auth/login", {
      method: "POST",
      body: { ...form, admin: !!props.admin },
    });
    clearNuxtData();
    await navigateTo(props.admin ? "/admin/dashboard" : "/");
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <main class="login-shell">
    <div class="brand">
      <img src="/nitro.svg" :alt="labels.uiNitro" ><span
        >{{ labels.uiNitro2 }}<span class="brand-dot">.</span></span
      >
    </div>
    <div class="login-card">
      <span class="eyebrow">{{
        admin ? "OPERATIONS CONSOLE" : "YOUR ASSETS, CONNECTED"
      }}</span>
      <h1>{{ labels.signIn }}</h1>
      <p class="muted">
        {{
          admin ? "Secure access for Nitro administrators." : labels.signInHint
        }}
      </p>
      <form @submit.prevent="login">
        <label
          >{{ labels.username
          }}<input
            v-model="form.username"
            autocomplete="username"
            required
            :placeholder="labels.uiYourUsername" ></label
        ><label
          >{{ labels.password
          }}<input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            required
            :placeholder="labels.uiEnterYourPassword"
        ></label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="button full" :disabled="pending">
          {{ pending ? "Signing in…" : labels.login }}<ArrowRight :size="18" />
        </button>
      </form>
      <div class="login-note">
        <LockKeyhole :size="14" />
        {{ labels.uiAccessIsProvisionedByYourAdministrator }}
      </div>
    </div>
    <NuxtLink
      class="muted subtle-link"
      :to="admin ? '/login' : '/admin/login'"
      >{{ admin ? "Wallet sign in" : "Administrator access" }}</NuxtLink
    >
  </main>
</template>
