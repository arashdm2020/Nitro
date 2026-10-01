<script setup lang="ts">
import { ArrowLeftRight } from "lucide-vue-next";
defineProps<{ title: string; description: string }>();
</script>
<template>
  <div class="empty">
    <ArrowLeftRight :size="30" />
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </div>
</template>
