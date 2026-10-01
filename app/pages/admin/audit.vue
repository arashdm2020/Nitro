<script setup lang="ts">
import type { PageResult, Audit } from "~/types";

const labels = useLabels();
definePageMeta({ layout: "admin" });
const page = ref(1),
  { data } = await useFetch<PageResult<Audit>>("/api/admin/audit", {
    query: { page },
  });
</script>
<template>
  <div>
    <div class="admin-title">
      <div>
        <span class="eyebrow">{{ labels.uiADMINISTRATORACTIVITY }}</span>
        <h1>{{ labels.uiAuditTrail }}</h1>
        <p class="muted">
          {{ labels.uiPrivilegedChangesRecordedWithActorAndContext }}
        </p>
      </div>
    </div>
    <div class="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ labels.uiAction }}</th>
            <th>{{ labels.uiActor }}</th>
            <th>{{ labels.uiTarget }}</th>
            <th>{{ labels.uiContext }}</th>
            <th>{{ labels.uiTime }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in data?.items" :key="a.id">
            <td>{{ a.action }}</td>
            <td>@{{ a.actor.username }}</td>
            <td>
              {{ a.targetType
              }}<small class="mono">{{ short(a.targetId) }}</small>
            </td>
            <td>
              <details>
                <summary>{{ labels.uiViewMetadata }}</summary>
                <pre>{{ JSON.stringify(a.metadata, null, 2) }}</pre>
              </details>
            </td>
            <td>{{ date(a.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <Pagination v-model="page" :total="data?.total ?? 0" />
  </div>
</template>
