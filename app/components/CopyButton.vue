<script setup lang="ts">
import { Copy, Check } from "lucide-vue-next";

const labels = useLabels();
const props = defineProps<{ value: string }>();
const copied = ref(false),
  failed = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
async function copy() {
  try {
    await navigator.clipboard.writeText(props.value);
    copied.value = true;
    timer = setTimeout(() => (copied.value = false), 2000);
  } catch {
    failed.value = true;
  }
}
onUnmounted(() => clearTimeout(timer));
</script>
<template>
  <button
    class="icon-button"
    :aria-label="copied ? 'Copied' : 'Copy'"
    @click="copy"
  >
    <Check v-if="copied" :size="17" /><Copy v-else :size="17" /><span
      v-if="failed"
      class="error"
      >{{ labels.uiCopyUnavailable }}</span
    >
  </button>
</template>
