import { createHash } from "node:crypto";
import { bech32, bech32m, createBase58check } from "@scure/base";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { parseTronAddress } from "./tron-address";

const base58check = createBase58check((value: Uint8Array) =>
  createHash("sha256").update(value).digest(),
);

// Validate mainnet addresses locally; never use an address to guess an EVM chain.
export function parseNetworkAddress(
  value: string,
  networkType: string,
): string | null {
  const address = value.trim();
  if (networkType === "TRON") return parseTronAddress(address)?.address ?? null;
  if (networkType === "EVM") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
    const hex = address.slice(2);
    if (hex !== hex.toLowerCase() && hex !== hex.toUpperCase()) {
      const hash = Buffer.from(
        keccak_256(new TextEncoder().encode(hex.toLowerCase())),
      ).toString("hex");
      for (let i = 0; i < hex.length; i++) {
        const char = hex[i]!;
        if (
          /[a-fA-F]/.test(char) &&
          parseInt(hash[i]!, 16) >= 8 !== (char === char.toUpperCase())
        )
          return null;
      }
    }
    return address;
  }
  if (networkType === "BITCOIN") {
    try {
      if (/^[13]/.test(address)) {
        const bytes = base58check.decode(address);
        return bytes.length === 21 && (bytes[0] === 0 || bytes[0] === 5)
          ? address
          : null;
      }
      for (const codec of [bech32, bech32m]) {
        try {
          const decoded = codec.decode(address as `${string}1${string}`, 90);
          const version = decoded.words[0];
          const program = codec.fromWords(decoded.words.slice(1));
          if (decoded.prefix !== "bc" || version === undefined || version > 16)
            continue;
          if (program.length < 2 || program.length > 40) continue;
          if (
            version === 0 &&
            (codec !== bech32 || ![20, 32].includes(program.length))
          )
            continue;
          if (version > 0 && codec !== bech32m) continue;
          return address.toLowerCase();
        } catch {
          /* Try the other witness checksum encoding. */
        }
      }
    } catch {
      return null;
    }
  }
  return null;
}
