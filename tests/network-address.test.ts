import { describe, expect, it } from "vitest";
import { bech32, bech32m } from "@scure/base";
import { parseNetworkAddress } from "../server/services/network-address";

describe("external network addresses", () => {
  it("checks EVM length and mixed-case EIP-55 checksum", () => {
    const address = "0x5Aeda56215b167893e80B4fE645BA6d5Bab767DE";
    // Lowercase addresses are permitted without a checksum.
    expect(parseNetworkAddress(address.toLowerCase(), "EVM")).toBe(
      address.toLowerCase(),
    );
    expect(
      parseNetworkAddress("0x52908400098527886E0F7030069857D2E4169EE7", "EVM"),
    ).toBeTruthy();
    expect(
      parseNetworkAddress("0x52908400098527886E0F7030069857D2E4169Ee7", "EVM"),
    ).toBeNull();
    expect(parseNetworkAddress("0x1234", "EVM")).toBeNull();
  });
  it("checks Bitcoin mainnet version, checksum and witness encoding", () => {
    expect(
      parseNetworkAddress("1BoatSLRHtKNngkdXEeobR76b53LETtpyT", "BITCOIN"),
    ).toBeTruthy();
    expect(
      parseNetworkAddress("1BoatSLRHtKNngkdXEeobR76b53LETtpyU", "BITCOIN"),
    ).toBeNull();
    for (const [version, codec, length] of [
      [0, bech32, 20],
      [1, bech32m, 32],
    ] as const) {
      const words = [version, ...codec.toWords(new Uint8Array(length))];
      const address = codec.encode("bc", words);
      expect(parseNetworkAddress(address, "BITCOIN")).toBe(address);
      expect(
        parseNetworkAddress(codec.encode("tb", words), "BITCOIN"),
      ).toBeNull();
      const wrongCodec = version === 0 ? bech32m : bech32;
      expect(
        parseNetworkAddress(wrongCodec.encode("bc", words), "BITCOIN"),
      ).toBeNull();
    }
  });
  it("rejects cross-network destinations and unsupported networks", () => {
    expect(
      parseNetworkAddress("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb", "EVM"),
    ).toBeNull();
    expect(parseNetworkAddress("0x" + "12".repeat(20), "TRON")).toBeNull();
    expect(parseNetworkAddress("virtual-address", "VIRTUAL")).toBeNull();
  });
});
