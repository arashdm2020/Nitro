<script setup lang="ts">
import {
  Users,
  UserCheck,
  ArrowLeftRight,
  ArrowUpRight,
} from "lucide-vue-next";
import type { Transaction, Audit } from "~/types";

const labels = useLabels();
definePageMeta({ layout: "admin" });
const { data, error, refresh } = await useFetch<{
  users: number;
  activeUsers: number;
  transfers: number;
  transactions: Transaction[];
  audit: Audit[];
  distribution: {
    assetId: string;
    symbol: string;
    _sum: { balance: string };
  }[];
  volumes: { symbol: string; _sum: { amount: string } }[];
}>("/api/admin/overview");
</script>
<template>
  <div>
    <div class="admin-title">
      <div>
        <span class="eyebrow">{{ labels.uiNITROOPERATIONS }}</span>
        <h1>{{ labels.uiWorkspaceOverview }}</h1>
        <p class="muted">{{ labels.uiAClearViewOfYourUsersAndLedger }}</p>
      </div>
      <NuxtLink to="/admin/users/new" class="button"
        >{{ labels.uiCreateUser }}<ArrowUpRight :size="17"
      /></NuxtLink>
    </div>
    <div v-if="error" class="error" @click="refresh()">
      {{ labels.uiCouldNotLoadWorkspaceRetry }}
    </div>
    <div class="stat-grid">
      <div class="stat-card">
        <Users :size="20" /><span>{{ labels.uiTotalUsers }}</span
        ><strong>{{ data?.users ?? "—" }}</strong>
      </div>
      <div class="stat-card">
        <UserCheck :size="20" /><span>{{ labels.uiActiveUsers }}</span
        ><strong>{{ data?.activeUsers ?? "—" }}</strong>
      </div>
      <div class="stat-card">
        <ArrowLeftRight :size="20" /><span>{{
          labels.uiInternalTransfers
        }}</span
        ><strong>{{ data?.transfers ?? "—" }}</strong>
      </div>
    </div>
    <section class="panel">
      <div class="panel-heading">
        <h3>{{ labels.uiRecentTransactions }}</h3>
        <NuxtLink to="/admin/transactions" class="link">{{
          labels.uiViewExplorer
        }}</NuxtLink>
      </div>
      <TransactionTable :items="data?.transactions ?? []" />
    </section>
    <div class="admin-two-column spaced">
      <section class="panel padded">
        <h3>{{ labels.uiAssetDistribution }}</h3>
        <div v-for="a in data?.distribution" :key="a.assetId" class="asset-row">
          <AssetIcon :symbol="a.symbol" />
          <div class="grow">
            <strong>{{ a.symbol }}</strong
            ><small>{{ labels.uiUserHoldings }}</small>
          </div>
          <strong>{{ units(a._sum.balance ?? "0") }}</strong>
        </div>
        <h3 class="spaced">{{ labels.uiInternalTransferVolume }}</h3>
        <div v-for="v in data?.volumes" :key="v.symbol" class="detail-line">
          <span>{{ v.symbol }}</span
          ><strong>{{ units(v._sum.amount ?? "0") }}</strong>
        </div>
      </section>
      <section class="panel padded">
        <h3>{{ labels.uiRecentAdminActivity }}</h3>
        <div v-for="a in data?.audit" :key="a.id" class="audit-row">
          <span class="status-dot" />
          <div>
            <strong>{{ a.action.toLowerCase().replaceAll("_", " ") }}</strong
            ><small>{{ a.actor.username }} · {{ date(a.createdAt) }}</small>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
