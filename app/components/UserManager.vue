<script setup lang="ts">
import type {
  User,
  Account,
  Wallet,
  Asset,
  Network,
  PageResult,
  Transaction,
  Audit,
} from "~/types";

const labels = useLabels();
const route = useRoute(),
  id = String(route.params.id);
const { data: user, refresh } = await useFetch<
  User & { accounts: Account[]; wallets: Wallet[] }
>(`/api/admin/users/${id}`);
const { data: catalog } = await useFetch<{
  assets: Asset[];
  networks: Network[];
}>("/api/admin/catalog");
const { data: transactions, refresh: refreshTx } = await useFetch<
  PageResult<Transaction>
>("/api/admin/transactions", { query: { userId: id } });
const { data: audit, refresh: refreshAudit } = await useFetch<
  PageResult<Audit>
>("/api/admin/audit", { query: { target: id } });
const edit = reactive({
  displayName: user.value?.displayName ?? "",
  status: user.value?.status ?? "ACTIVE",
});
const reset = ref(""),
  error = ref(""),
  notice = ref(""),
  pending = ref(false),
  confirmation = ref(false);
const adjustment = reactive({
  assetId: catalog.value?.assets[0]?.id ?? "",
  operation: "CREDIT",
  amount: "",
  reason: "",
  idempotencyKey: "",
});
const walletForm = reactive({
  assetId: catalog.value?.assets[0]?.id ?? "",
  networkId: "",
  address: "",
  label: "",
});
const availableNetworks = computed(
  () =>
    catalog.value?.networks.filter((n) =>
      n.assets?.some((a) => a.assetId === walletForm.assetId),
    ) ?? [],
);
watch(
  availableNetworks,
  (n) => {
    walletForm.networkId = n[0]?.id ?? "";
  },
  { immediate: true },
);
async function action(
  url: string,
  method: "POST" | "PATCH" | "PUT",
  body: object,
) {
  pending.value = true;
  error.value = "";
  notice.value = "";
  try {
    await $fetch(url, { method, body });
    notice.value = "Changes saved.";
    await Promise.all([refresh(), refreshTx(), refreshAudit()]);
    return true;
  } catch (e) {
    error.value = errorMessage(e);
    return false;
  } finally {
    pending.value = false;
  }
}
async function adjust() {
  if (
    await action("/api/admin/adjustments", "POST", {
      ...adjustment,
      userId: id,
    })
  ) {
    confirmation.value = false;
    adjustment.amount = "";
    adjustment.reason = "";
  }
}
function reviewAdjustment() {
  adjustment.idempotencyKey = crypto.randomUUID();
  confirmation.value = true;
}
async function resetPassword() {
  if (
    await action(`/api/admin/users/${id}`, "PATCH", {
      password: reset.value,
      mustResetPassword: true,
    })
  )
    reset.value = "";
}
function editWallet(w: Wallet) {
  walletForm.assetId = w.assetId;
  nextTick(() => {
    walletForm.networkId = w.networkId;
    walletForm.address = w.address;
    walletForm.label = w.label ?? "";
  });
}
</script>
<template>
  <div v-if="user">
    <div class="admin-title">
      <div>
        <span class="eyebrow">{{ labels.uiUSERACCOUNT }}</span>
        <h1>{{ user.displayName ?? user.username }}</h1>
        <p class="muted">@{{ user.username }} · {{ user.id }}</p>
      </div>
      <StatusBadge :status="user.status" />
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <div class="admin-two-column">
      <form
        class="panel form-panel"
        @submit.prevent="action(`/api/admin/users/${id}`, 'PATCH', edit)"
      >
        <h3>{{ labels.uiAccountDetails }}</h3>
        <label
          >{{ labels.uiDisplayName
          }}<input v-model="edit.displayName" maxlength="80" ></label
        ><label
          >{{ labels.uiStatus
          }}<select v-model="edit.status">
            <option>ACTIVE</option>
            <option>SUSPENDED</option>
            <option>DISABLED</option>
          </select></label
        ><button class="button" :disabled="pending">
          {{ labels.uiSaveAccount }}
        </button>
      </form>
      <form class="panel form-panel" @submit.prevent="resetPassword">
        <h3>{{ labels.uiResetCredentials }}</h3>
        <p class="muted">
          {{
            labels.uiAllSessionsAreRevokedTheUserMustChangeThisPasswordAfterLogin
          }}
        </p>
        <label
          >{{ labels.uiNewTemporaryPassword
          }}<input
            v-model="reset"
            type="password"
            required
            minlength="12"
            maxlength="128"
            autocomplete="new-password" ></label
        ><button class="button secondary" :disabled="pending">
          {{ labels.uiResetPassword }}
        </button>
      </form>
    </div>
    <section class="panel spaced">
      <div class="panel-heading">
        <h3>{{ labels.uiAssetBalances }}</h3>
        <span class="muted">{{ labels.uiLedgerBacked }}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ labels.uiAsset }}</th>
              <th>{{ labels.uiAvailableBalance }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in user.accounts" :key="a.id">
              <td>
                <div class="inline-asset">
                  <AssetIcon :symbol="a.asset.symbol" />{{ a.asset.name }}
                </div>
              </td>
              <td class="mono">{{ units(a.balance) }} {{ a.asset.symbol }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <div class="admin-two-column spaced">
      <form class="panel form-panel" @submit.prevent="reviewAdjustment">
        <h3>{{ labels.uiBalanceAdjustment }}</h3>
        <label
          >{{ labels.uiAsset
          }}<select v-model="adjustment.assetId">
            <option v-for="a in catalog?.assets" :key="a.id" :value="a.id">
              {{ a.symbol }}
            </option>
          </select></label
        ><label
          >{{ labels.uiOperation
          }}<select v-model="adjustment.operation">
            <option>CREDIT</option>
            <option>DEBIT</option>
          </select></label
        ><label
          >{{ labels.uiAmount
          }}<input
            v-model="adjustment.amount"
            required
            inputmode="decimal"
            pattern="(0|[1-9][0-9]*)(\.[0-9]+)?" ></label
        ><label
          >{{ labels.uiReason
          }}<textarea
            v-model="adjustment.reason"
            required
            minlength="5"
            maxlength="500"
            :placeholder="labels.uiRequiredForAuditTrail"
          /></label
        ><button class="button" :disabled="pending">
          {{ labels.uiReviewAdjustment }}
        </button>
      </form>
      <form
        class="panel form-panel"
        @submit.prevent="
          action('/api/admin/wallets', 'PUT', { ...walletForm, userId: id })
        "
      >
        <h3>{{ labels.uiAssignWalletAddress }}</h3>
        <label
          >{{ labels.uiAsset
          }}<select v-model="walletForm.assetId">
            <option v-for="a in catalog?.assets" :key="a.id" :value="a.id">
              {{ a.symbol }}
            </option>
          </select></label
        ><label
          >{{ labels.uiNetwork
          }}<select v-model="walletForm.networkId" required>
            <option v-for="n in availableNetworks" :key="n.id" :value="n.id">
              {{ n.name }}
            </option>
          </select></label
        ><label
          >{{ labels.uiAddress
          }}<input
            v-model="walletForm.address"
            required
            minlength="8"
            maxlength="256" ></label
        ><label
          >{{ labels.uiLabel
          }}<input
            v-model="walletForm.label"
            maxlength="80"
            :placeholder="labels.uiOptional" ></label
        ><button class="button secondary" :disabled="pending">
          {{ labels.uiSaveAddress }}
        </button>
      </form>
    </div>
    <section class="panel padded spaced">
      <h3>{{ labels.uiAssignedAddresses }}</h3>
      <div v-for="w in user.wallets" :key="w.id" class="detail-line">
        <span>{{ w.asset?.symbol }} · {{ w.network.name }}</span
        ><span class="mono"
          >{{ short(w.address) }}<CopyButton :value="w.address" /><button
            class="link"
            @click="editWallet(w)"
          >
            {{ labels.uiEdit }}
          </button></span
        >
      </div>
      <p v-if="!user.wallets.length" class="muted">
        {{ labels.uiNoAddressesAssigned }}
      </p>
    </section>
    <section class="panel spaced">
      <div class="panel-heading">
        <h3>{{ labels.uiTransactionHistory }}</h3>
      </div>
      <TransactionTable :items="transactions?.items ?? []" />
    </section>
    <section class="panel padded spaced">
      <h3>{{ labels.uiAccountAuditHistory }}</h3>
      <div v-for="a in audit?.items" :key="a.id" class="detail-line">
        <span>{{ a.action }}</span
        ><span>{{ a.actor.username }} · {{ date(a.createdAt) }}</span>
      </div>
    </section>
    <div
      v-if="confirmation"
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="labels.uiConfirmBalanceAdjustment"
    >
      <section class="panel form-panel modal">
        <h2>{{ labels.uiConfirmAdjustment }}</h2>
        <p>
          {{ adjustment.operation }} {{ adjustment.amount }}
          {{ catalog?.assets.find((a) => a.id === adjustment.assetId)?.symbol }}
          {{ labels.uiFor }}{{ user.username }}
        </p>
        <p class="muted">{{ adjustment.reason }}</p>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="button" :disabled="pending" @click="adjust">
          {{ pending ? "Processing…" : "Confirm adjustment" }}</button
        ><button
          class="button secondary"
          :disabled="pending"
          @click="confirmation = false"
        >
          {{ labels.uiCancel }}
        </button>
      </section>
    </div>
  </div>
</template>
