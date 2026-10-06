import { reserveRequest } from "./requests";

export interface ExternalTransferProvider {
  submit: typeof reserveRequest;
}

// Demo acceptance means a durable PENDING reservation, never an on-chain success.
// A future Nobitex adapter must dispatch committed requests outside the retried
// database transaction, using the request reference as its idempotency identity.
export const externalTransferProvider: ExternalTransferProvider = {
  submit: reserveRequest,
};
