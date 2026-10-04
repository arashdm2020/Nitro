import { describe, expect, it } from "vitest";
import { parseTronAddress } from "../server/services/tron-address";

describe("TRON address validation", () => {
  const address = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
  const hex = "41" + "00".repeat(20);

  it("accepts a valid Base58Check address without looking up an account", () => {
    expect(parseTronAddress(` ${address} `)).toEqual({ address, hex });
  });
  it("normalizes the documented hexadecimal format", () => {
    expect(parseTronAddress(hex)).toEqual({ address, hex });
    expect(parseTronAddress(`0x${hex}`)).toEqual({ address, hex });
  });
  it.each([
    "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwa", // bad checksum
    address.toLowerCase(),
    "TNitroAssignedBobAddress1234567890", // an internal alias is not an on-chain address
    "0x" + "00".repeat(20), // EVM
    "42" + "00".repeat(20), // wrong version
    "41" + "00".repeat(19), // wrong length
    "1BoatSLRHtKNngkdXEeobR76b53LETtpyT", // Bitcoin
    address + "?amount=10",
  ])("rejects malformed or non-TRON input: %s", (value) => {
    expect(parseTronAddress(value)).toBeNull();
  });
});
