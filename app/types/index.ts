export interface User {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  status: string;
  mustResetPassword: boolean;
  createdAt?: string;
}
export interface Price {
  value: string;
  change24h: string | null;
  stale: boolean;
  fetchedAt: string;
  source: string;
}
export interface Asset {
  id: string;
  symbol: string;
  name: string;
  icon: string;
  decimals: number;
  enabled: boolean;
  displayOrder: number;
  priceTrackingEnabled: boolean;
  prices?: Price[];
  networks?: { networkId: string; assetId: string; network?: Network }[];
}
export interface Network {
  id: string;
  name: string;
  slug: string;
  chainId: number | null;
  nativeAsset: string;
  explorerBaseUrl: string | null;
  enabled: boolean;
  networkType: string;
  assets?: { assetId: string }[];
}
export interface Account {
  id: string;
  userId: string;
  assetId: string;
  balance: string;
  reservedBalance: string;
  totalBalance: string;
  asset: Asset;
  user?: { id: string; username: string };
}
export interface Wallet {
  id: string;
  assetId: string;
  networkId: string;
  address: string;
  label: string | null;
  network: Network;
  asset?: Asset;
}
export interface WalletData {
  user: User;
  accounts: Account[];
  wallets: Wallet[];
  feeBps: string;
}
export interface Transaction {
  id: string;
  reference: string;
  senderId: string | null;
  recipientId: string | null;
  recipientAddress: string | null;
  networkId: string | null;
  networkName: string | null;
  amount: string;
  fee: string;
  type: string;
  status: string;
  reason: string | null;
  createdAt: string;
  completedAt: string | null;
  asset: Asset;
  sender: { username: string } | null;
  recipient: { username: string } | null;
}
export interface Audit {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: { username: string };
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
}
