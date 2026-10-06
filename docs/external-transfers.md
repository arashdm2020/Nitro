# External transfer demo

External requests validate the enabled asset/network mapping, destination checksum,
asset precision and available account balance on the server. A successful response
means a durable PENDING request with reserved funds, not a completed withdrawal.
Cancellation releases the reservation. Invalid requests create no transaction.

Available balance is total balance minus all pending reservations for that user
and asset. Reservations and internal debits use conditional updates inside a
serializable transaction. Idempotent retries do not reserve twice. Fees for demo
external requests are zero, so an available balance of 28 TRX accepts 28 TRX and
rejects 28.000001 TRX. USDT cannot spend TRX balance even on the same network.

Accounts currently pool each asset across networks; there is no per-network
inventory or gas balance in this schema. The network selects the destination
route and never substitutes its native token balance for the selected asset.
EVM addresses cannot identify a chain: users must select a network when multiple
enabled compatible networks exist. Bitcoin validation targets mainnet.

`ExternalTransferProvider` is the application boundary; its demo implementation
reserves requests through the ledger. No exchange credentials or network calls
are used. A future Nobitex adapter should dispatch committed requests outside
the serializable retry loop, persist provider references and failure states, and
settle/release reservations with balanced ledger entries. Do not perform a real
withdrawal inside a retried database transaction. Provider inventory and network
fees will need separate checks when a real provider is introduced.
