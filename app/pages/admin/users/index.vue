<script setup lang="ts">
import { Plus, Search } from "lucide-vue-next";
import type { PageResult, User } from "~/types";

const labels = useLabels();
definePageMeta({ layout: "admin" });
const search = ref(""),
  status = ref(""),
  page = ref(1);
watch([search, status], () => (page.value = 1));
const { data, error } = await useFetch<PageResult<User>>("/api/admin/users", {
  query: { search, status, page },
});
</script>
<template>
  <div>
    <div class="admin-title">
      <div>
        <span class="eyebrow">{{ labels.uiACCOUNTPROVISIONING }}</span>
        <h1>{{ labels.uiUsers }}</h1>
        <p class="muted">{{ labels.uiManageAccessAndAccountLifecycle }}</p>
      </div>
      <NuxtLink to="/admin/users/new" class="button"
        ><Plus :size="17" />{{ labels.uiCreateUser }}</NuxtLink
      >
    </div>
    <div class="toolbar">
      <div class="search-field">
        <Search :size="17" /><input
          v-model="search"
          :placeholder="labels.uiSearchByUsername"
          :aria-label="labels.uiSearchUsers"
        >
      </div>
      <select v-model="status" :aria-label="labels.uiFilterStatus">
        <option value="">All statuses</option>
        <option v-for="s in ['ACTIVE', 'SUSPENDED', 'DISABLED']" :key="s">
          {{ s }}
        </option>
      </select>
    </div>
    <p v-if="error" class="error">{{ labels.uiCouldNotLoadUsers }}</p>
    <div class="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ labels.uiUser }}</th>
            <th>{{ labels.uiUsername }}</th>
            <th>{{ labels.uiRole }}</th>
            <th>{{ labels.uiStatus }}</th>
            <th>{{ labels.uiCreated }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in data?.items" :key="u.id">
            <td>
              <strong>{{ u.displayName ?? u.username }}</strong>
            </td>
            <td>@{{ u.username }}</td>
            <td>{{ u.role }}</td>
            <td><StatusBadge :status="u.status" /></td>
            <td>{{ u.createdAt ? date(u.createdAt) : "—" }}</td>
            <td>
              <NuxtLink :to="`/admin/users/${u.id}`" class="link">{{
                labels.uiManage
              }}</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState
        v-if="!data?.items.length"
        :title="labels.uiNoUsersFound"
        description="Create an account or adjust your filters."
      />
    </div>
    <Pagination v-model="page" :total="data?.total ?? 0" />
  </div>
</template>
