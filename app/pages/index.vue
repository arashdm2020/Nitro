<script setup lang="ts">
import {
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-vue-next";
import Decimal from "decimal.js";
import { sortWalletAccounts } from "~/composables/useNitro";
const { data: wallet, status, error, refresh } = await useWallet(),
  labels = useLabels(),
  hidden = ref(false);
const accounts = computed(() =>
  sortWalletAccounts(
    wallet.value?.accounts.filter((a) => a.asset.enabled) ?? [],
  ),
);
const total = computed(() =>
  wallet.value?.accounts
    .reduce(
      (sum, a) =>
        a.asset.prices?.[0]
          ? sum.add(new Decimal(a.totalBalance).mul(a.asset.prices[0].value))
          : sum,
      new Decimal(0),
    )
    .toString(),
);
const hasPrices = computed(() =>
  wallet.value?.accounts.some((a) => a.asset.prices?.length),
);
const unavailable = computed(() =>
  wallet.value?.accounts.some((a) => !a.asset.prices?.length),
);
const stale = computed(() =>
  wallet.value?.accounts.some((a) => a.asset.prices?.[0]?.stale),
);
</script>
<template>
  <div>
    <section v-if="error && !wallet" class="empty">
      <h2>{{ labels.uiUnableToLoadYourWallet }}</h2>
      <button class="button" @click="refresh()">{{ labels.uiTryAgain }}</button>
    </section>
    <template v-else
      ><div class="greeting">
        <span class="muted">{{ labels.uiGoodToSeeYou }}</span>
        <h2>
          {{ wallet?.user.displayName ?? wallet?.user.username ?? "…"
          }}<span class="wave">↗</span>
        </h2>
      </div>
      <section class="balance-card">
        <div class="balance-label">
          <span>{{ labels.totalBalance }}</span
          ><button
            class="icon-button"
            :aria-label="hidden ? 'Show balance' : 'Hide balance'"
            @click="hidden = !hidden"
          >
            <EyeOff v-if="hidden" :size="17" /><Eye v-else :size="17" />
          </button>
        </div>
        <h1 :class="{ skeleton: status === 'pending' && !wallet }">
          {{
            hidden
              ? "••••••"
              : !hasPrices
                ? "—"
                : unavailable
                  ? money(total) + "*"
                  : money(total)
          }}
        </h1>
        <span class="balance-currency"
          >{{ labels.uiUSD }}
          <span
            >·
            {{
              !hasPrices
                ? "Market prices unavailable"
                : unavailable
                  ? "Partial valuation · prices unavailable"
                  : stale
                    ? "Last known prices · stale"
                    : error
                      ? "Update failed · retrying"
                      : "Auto-updating · balances 15s · prices 60s"
            }}</span
          ></span
        >
        <div class="balance-decoration" aria-hidden="true">N</div>
      </section>
      <div class="quick-actions">
        <NuxtLink to="/send" class="action"
          ><span><ArrowUpRight :size="23" /></span>{{ labels.send }}</NuxtLink
        ><NuxtLink to="/receive" class="action secondary-action"
          ><span><ArrowDownLeft :size="23" /></span
          >{{ labels.receive }}</NuxtLink
        >
      </div>
      <div class="section-heading">
        <h3>{{ labels.uiYourAssets }}</h3>
        <NuxtLink to="/assets"
          >{{ labels.uiViewAll }} <ChevronRight :size="15"
        /></NuxtLink>
      </div>
      <div class="asset-list">
        <NuxtLink
          v-for="account in accounts"
          :key="account.id"
          :to="`/assets/${account.asset.symbol}`"
          class="asset-row"
          ><AssetIcon :symbol="account.asset.symbol" />
          <div class="grow">
            <strong>{{ account.asset.name }}</strong
            ><small
              >{{ money(account.asset.prices?.[0]?.value) }}
              <span
                v-if="account.asset.prices?.[0]?.change24h"
                :class="
                  Number(account.asset.prices[0].change24h) >= 0
                    ? 'success'
                    : 'error'
                "
                >{{ Number(account.asset.prices[0].change24h) > 0 ? "+" : ""
                }}{{
                  Number(account.asset.prices[0].change24h).toFixed(2)
                }}%</span
              ><span v-else class="muted">{{
                labels.uiPriceUnavailable
              }}</span></small
            >
          </div>
          <div class="right">
            <strong>{{
              hidden
                ? "••••"
                : account.asset.prices?.[0]
                  ? money(
                      new Decimal(account.balance)
                        .mul(account.asset.prices[0].value)
                        .toString(),
                    )
                  : "—"
            }}</strong
            ><small
              >{{ hidden ? "••••" : units(account.balance) }}
              {{ account.asset.symbol }}</small
            >
          </div></NuxtLink
        >
      </div>
      <div class="info-strip">
        <span class="status-dot" />
        <div>
          <strong>{{ labels.uiConnectedWithinNitro }}</strong>
          <p>{{ labels.uiTransfersBetweenNitroAccountsSettleInstantly }}</p>
        </div>
      </div></template
    >
  </div>
</template>
