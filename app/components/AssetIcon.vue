<script setup lang="ts">
defineProps<{ symbol: string }>();
const failed = ref(false);
</script>
<template>
  <span class="asset-icon"
    ><img
      v-if="!failed"
      :src="`/assets/${symbol.toLowerCase()}.svg`"
      :alt="symbol"
      @error="failed = true"
    ><span v-else>{{ symbol.slice(0, 1) }}</span></span
  >
</template>
