import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export interface SecretStore {
  encrypt(value: string): {
    ciphertext: string;
    nonce: string;
    tag: string;
    keyVersion: string;
  };
  decrypt(value: {
    ciphertext: string;
    nonce: string;
    tag: string;
    keyVersion: string;
  }): string;
}
export class EnvironmentSecretStore implements SecretStore {
  private key() {
    const key = Buffer.from(process.env.SECRET_ENCRYPTION_KEY ?? "", "base64");
    if (key.length !== 32)
      throw new Error(
        "SECRET_ENCRYPTION_KEY must contain 32 base64-encoded bytes",
      );
    return key;
  }
  encrypt(value: string) {
    const nonce = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key(), nonce);
    cipher.setAAD(Buffer.from("nitro-wallet-secret:v1"));
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return {
      ciphertext: ciphertext.toString("base64"),
      nonce: nonce.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      keyVersion: "env-v1",
    };
  }
  decrypt(value: {
    ciphertext: string;
    nonce: string;
    tag: string;
    keyVersion: string;
  }) {
    if (value.keyVersion !== "env-v1")
      throw new Error("Unknown encryption key version");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      this.key(),
      Buffer.from(value.nonce, "base64"),
    );
    cipher.setAAD(Buffer.from("nitro-wallet-secret:v1"));
    cipher.setAuthTag(Buffer.from(value.tag, "base64"));
    return Buffer.concat([
      cipher.update(Buffer.from(value.ciphertext, "base64")),
      cipher.final(),
    ]).toString("utf8");
  }
}
