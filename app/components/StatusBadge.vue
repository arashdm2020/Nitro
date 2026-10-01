<script setup lang="ts">
defineProps<{ status: string }>();
</script>
<template>
  <span
    class="badge"
    :class="['ACTIVE', 'COMPLETED'].includes(status) ? 'success' : 'muted'"
    >{{ status.toLowerCase().replaceAll("_", " ") }}</span
  >
</template>
