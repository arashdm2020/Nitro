<script setup lang="ts">
defineProps<{ status: string }>();
const labels = useLabels();
</script>
<template>
  <span
    class="badge"
    :class="['ACTIVE', 'COMPLETED'].includes(status) ? 'success' : 'muted'"
    >{{
      status === "PENDING"
        ? labels.uiAwaitingProcessing
        : status.toLowerCase().replaceAll("_", " ")
    }}</span
  >
</template>
