<script setup lang="ts">
import type { NuxtError } from "#app";
defineProps<{ error: NuxtError }>();
const labels = useLabels();
</script>
<template>
  <main class="login-shell">
    <NuxtLink to="/login" class="brand"
      ><img src="/nitro.svg" alt="Nitro" ><span>nitro.</span></NuxtLink
    >
    <div class="login-card">
      <span class="eyebrow">{{ error.statusCode }}</span>
      <h1>{{ labels.uiUnableToContinue }}</h1>
      <p class="muted">
        {{
          error.statusCode === 404
            ? labels.uiPageNotFound
            : labels.uiPleaseTryAgain
        }}
      </p>
      <button
        class="button full spaced"
        @click="clearError({ redirect: '/login' })"
      >
        {{ labels.uiReturnToSignIn }}
      </button>
    </div>
  </main>
</template>
