<script setup lang="ts">
const labels = useLabels();

const page = defineModel<number>({ required: true });
defineProps<{ total: number }>();
</script>
<template>
  <div class="pagination">
    <button class="button secondary" :disabled="page <= 1" @click="page--">
      {{ labels.uiPrevious }}</button
    ><span class="muted"
      >{{ labels.uiPage }} {{ page }} · {{ total }} {{ labels.uiRecords }}</span
    ><button
      class="button secondary"
      :disabled="page * 20 >= total"
      @click="page++"
    >
      {{ labels.uiNext }}
    </button>
  </div>
</template>
