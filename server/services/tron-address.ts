import { createHash } from "node:crypto";
import { createBase58check } from "@scure/base";

const base58check = createBase58check((value: Uint8Array) =>
  createHash("sha256").update(value).digest(),
);

// Accept both documented TRON formats, including unactivated addresses.
// Validate the Base58Check checksum as well as the 0x41 version byte.
export function parseTronAddress(value: string) {
  const input = value.trim();
  try {
    const bytes = /^(?:0x)?41[0-9a-fA-F]{40}$/.test(input)
      ? Buffer.from(input.replace(/^0x/, ""), "hex")
      : /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(input)
        ? base58check.decode(input)
        : null;
    if (!bytes || bytes.length !== 21 || bytes[0] !== 0x41) return null;
    return {
      address: base58check.encode(bytes),
      hex: Buffer.from(bytes).toString("hex"),
    };
  } catch {
    return null;
  }
}
