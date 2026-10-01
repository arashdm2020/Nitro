import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import { EnvironmentSecretStore } from "../server/services/secrets";
describe("authenticated secret storage", () => {
  beforeEach(() => {
    process.env.SECRET_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });
  it("encrypts without revealing plaintext and decrypts on the server", () => {
    const vault = new EnvironmentSecretStore(),
      record = vault.encrypt("secret-private-key");
    expect(record.ciphertext).not.toContain("secret-private-key");
    expect(vault.decrypt(record)).toBe("secret-private-key");
  });
  it("rejects modified ciphertext", () => {
    const vault = new EnvironmentSecretStore(),
      record = vault.encrypt("secret");
    record.tag = randomBytes(16).toString("base64");
    expect(() => vault.decrypt(record)).toThrow();
  });
  it("requires a configured 256-bit key", () => {
    process.env.SECRET_ENCRYPTION_KEY = "";
    expect(() => new EnvironmentSecretStore().encrypt("secret")).toThrow();
  });
});
