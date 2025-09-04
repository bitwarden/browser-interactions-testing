#!/usr/bin/env node

// A purpose-built modification of
// https://github.com/bitwarden/qa-tools/blob/main/crypto-browser/crypto.js

import fs from "fs";
import { configDotenv } from "dotenv";

configDotenv({ quiet: true });

const defaultKdfIterations = 600000;

class Cipher {
  encType: number;
  iv: ByteData;
  ct: ByteData;
  mac: ByteData | null;
  string: string;

  constructor(
    encType: number,
    iv: ByteData,
    ct: ByteData,
    mac: ByteData | undefined,
  ) {
    this.encType = encType;
    this.iv = iv;
    this.ct = ct;
    this.string = encType + "." + iv.b64 + "|" + ct.b64;

    this.mac = null;
    if (mac) {
      this.mac = mac;
      this.string += "|" + mac.b64;
    }
  }
}

class SymmetricCryptoKey {
  key: ByteData;
  encKey: ByteData;
  macKey: ByteData;

  constructor(buf: ArrayBuffer | Uint8Array<ArrayBuffer>) {
    this.key = new ByteData(buf);

    // First half
    const encKey = this.key.arr.slice(0, this.key.arr.length / 2).buffer;
    this.encKey = new ByteData(encKey);

    // Second half
    const macKey = this.key.arr.slice(this.key.arr.length / 2).buffer;
    this.macKey = new ByteData(macKey);
  }
}

class ByteData {
  arr: Uint8Array<ArrayBuffer>;
  b64: string;

  constructor(buf: ArrayBuffer | Uint8Array<ArrayBuffer>) {
    this.arr = new Uint8Array(buf);
    this.b64 = toB64(buf);
  }
}

async function generateKeys() {
  let symKey = new Uint8Array(512 / 8);
  crypto.getRandomValues(symKey);

  const { publicKey, privateKey } = (await generateRsaKeyPair()) || {};

  return {
    symKey: new SymmetricCryptoKey(symKey),
    publicKey,
    privateKey,
  };
}

// Constants/Enums

const encTypes = {
  AesCbc256_B64: 0,
  AesCbc128_HmacSha256_B64: 1,
  AesCbc256_HmacSha256_B64: 2,
  Rsa2048_OaepSha256_B64: 3,
  Rsa2048_OaepSha1_B64: 4,
  Rsa2048_OaepSha256_HmacSha256_B64: 5,
  Rsa2048_OaepSha1_HmacSha256_B64: 6,
};

// Helpers

function fromUtf8(str: string) {
  const strUtf8 = decodeURIComponent(encodeURIComponent(str));
  const bytes = new Uint8Array(strUtf8.length);
  for (let i = 0; i < strUtf8.length; i++) {
    bytes[i] = strUtf8.charCodeAt(i);
  }
  return bytes.buffer;
}

function toB64(buf: ArrayBuffer | Uint8Array<ArrayBuffer> | Buffer) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return buf.toString("base64");
}

// Crypto

async function pbkdf2(
  password: BufferSource,
  salt: ArrayBuffer,
  iterations: number,
  length: number,
) {
  const importAlg = {
    name: "PBKDF2",
  };

  const deriveAlg = {
    name: "PBKDF2",
    salt: salt,
    iterations: iterations,
    hash: { name: "SHA-256" },
  };

  const aesOptions = {
    name: "AES-CBC",
    length: length,
  };

  try {
    const importedKey = await crypto.subtle.importKey(
      "raw",
      password,
      importAlg,
      false,
      ["deriveKey"],
    );
    const derivedKey = await crypto.subtle.deriveKey(
      deriveAlg,
      importedKey,
      aesOptions,
      true,
      ["encrypt"],
    );
    const exportedKey = await crypto.subtle.exportKey("raw", derivedKey);
    return new ByteData(exportedKey);
  } catch (err) {
    console.log(err);
  }
}

async function aesEncrypt(
  data: ArrayBuffer,
  encKey: ByteData,
  macKey: ByteData,
) {
  const keyOptions = {
    name: "AES-CBC",
  };

  const encOptions = {
    name: "AES-CBC",
    iv: new Uint8Array(16),
  };
  crypto.getRandomValues(encOptions.iv);
  const ivData = new ByteData(encOptions.iv.buffer);

  try {
    const importedKey = await crypto.subtle.importKey(
      "raw",
      encKey.arr.buffer,
      keyOptions,
      false,
      ["encrypt"],
    );
    const encryptedBuffer = await crypto.subtle.encrypt(
      encOptions,
      importedKey,
      data,
    );
    const ctData = new ByteData(encryptedBuffer);
    let type = encTypes.AesCbc256_B64;
    let macData;
    if (macKey) {
      const dataForMac = buildDataForMac(ivData.arr, ctData.arr);
      const macBuffer = await computeMac(dataForMac.buffer, macKey.arr.buffer);
      type = encTypes.AesCbc256_HmacSha256_B64;
      macData = new ByteData(macBuffer);
    }
    return new Cipher(type, ivData, ctData, macData);
  } catch (err) {
    console.error(err);
  }
}

async function computeMac(data: ArrayBuffer, key: ArrayBuffer) {
  const alg = {
    name: "HMAC",
    hash: { name: "SHA-256" },
  };
  const importedKey = await crypto.subtle.importKey("raw", key, alg, false, [
    "sign",
  ]);
  return crypto.subtle.sign(alg, importedKey, data);
}

function buildDataForMac(
  ivArr: Uint8Array<ArrayBuffer>,
  ctArr: Uint8Array<ArrayBuffer>,
) {
  const dataForMac = new Uint8Array(ivArr.length + ctArr.length);
  dataForMac.set(ivArr, 0);
  dataForMac.set(ctArr, ivArr.length);
  return dataForMac;
}

async function generateRsaKeyPair() {
  const rsaOptions = {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
    hash: { name: "SHA-1" },
  };

  try {
    const keyPair = await crypto.subtle.generateKey(rsaOptions, true, [
      "encrypt",
      "decrypt",
    ]);
    const publicKey = new ByteData(
      await crypto.subtle.exportKey("spki", keyPair.publicKey),
    );
    const privateKey = new ByteData(
      await crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
    );
    return {
      publicKey: publicKey,
      privateKey: privateKey,
    };
  } catch (err) {
    console.error(err);
  }
}

async function stretchKey(key: ArrayBuffer) {
  const newKey = new Uint8Array(64);
  newKey.set(await hkdfExpand(key, new Uint8Array(fromUtf8("enc")), 32));
  newKey.set(await hkdfExpand(key, new Uint8Array(fromUtf8("mac")), 32), 32);
  return new SymmetricCryptoKey(newKey.buffer);
}

// ref: https://tools.ietf.org/html/rfc5869
async function hkdfExpand(
  prk: ArrayBuffer,
  info: Uint8Array<ArrayBuffer>,
  size: number,
) {
  const alg = {
    name: "HMAC",
    hash: { name: "SHA-256" },
  };
  const importedKey = await crypto.subtle.importKey("raw", prk, alg, false, [
    "sign",
  ]);
  const hashLen = 32; // sha256
  const okm = new Uint8Array(size);
  let previousT = new Uint8Array(0);
  const n = Math.ceil(size / hashLen);
  for (let i = 0; i < n; i++) {
    const t = new Uint8Array(previousT.length + info.length + 1);
    t.set(previousT);
    t.set(info, previousT.length);
    t.set([i + 1], t.length - 1);
    previousT = new Uint8Array(
      await crypto.subtle.sign(alg, importedKey, t.buffer),
    );
    okm.set(previousT, i * hashLen);
  }
  return okm;
}

async function getValues() {
  const {
    CI,
    GENERATED_RSA_KEY_PAIR_PROTECTED_PRIVATE_KEY,
    GENERATED_RSA_KEY_PAIR_PUBLIC_KEY,
    KDF_ITERATIONS,
    MASTER_PASSWORD_HASH,
    PROTECTED_SYMMETRIC_KEY,
    VAULT_EMAIL,
    VAULT_PASSWORD,
  } = process.env;

  if (CI !== "true") {
    console.log(
      [
        "Now generating values for the following environment variables and adding them to your dotenv file:",
        "KDF_ITERATIONS",
        "MASTER_PASSWORD_HASH",
        "PROTECTED_SYMMETRIC_KEY",
        "GENERATED_RSA_KEY_PAIR_PUBLIC_KEY",
        "GENERATED_RSA_KEY_PAIR_PROTECTED_PRIVATE_KEY",
        "",
      ].join("\n"),
    );
  }

  if (!VAULT_EMAIL?.length || !VAULT_PASSWORD?.length) {
    console.error(
      "\x1b[1m\x1b[31m%s\x1b[0m",
      `Your dotenv file is missing valid values for VAULT_EMAIL and/or VAULT_PASSWORD. Crypto values will not be generated.`,
      "\n",
    );

    return;
  }

  const email = fromUtf8(VAULT_EMAIL);
  const masterPassword = fromUtf8(VAULT_PASSWORD);

  if (
    KDF_ITERATIONS?.length ||
    MASTER_PASSWORD_HASH?.length ||
    PROTECTED_SYMMETRIC_KEY?.length ||
    GENERATED_RSA_KEY_PAIR_PUBLIC_KEY?.length ||
    GENERATED_RSA_KEY_PAIR_PROTECTED_PRIVATE_KEY?.length
  ) {
    console.warn(
      "\x1b[1m\x1b[33m%s\x1b[0m",
      "There are existing crypto values in your dotenv file. Remove them or update the values manually with guidance from https://bitwarden.com/help/bitwarden-security-white-paper/#hashing-key-derivation-and-encryption\n",
    );

    return;
  }

  const { symKey, publicKey, privateKey } = await generateKeys();
  const masterKey = await pbkdf2(
    masterPassword,
    email,
    defaultKdfIterations,
    256,
  );

  if (!masterKey?.arr.buffer || !publicKey?.arr || !privateKey?.arr.buffer) {
    return;
  }

  const stretchedMasterKey = await stretchKey(masterKey.arr.buffer);
  const protectedSymKey = await aesEncrypt(
    symKey.key.arr.buffer,
    stretchedMasterKey.encKey,
    stretchedMasterKey.macKey,
  );

  const masterKeyHash = await pbkdf2(masterKey.arr, masterPassword, 1, 256);

  if (!masterKeyHash?.arr || !protectedSymKey) {
    return;
  }

  const masterKeyHashBytes = new Uint8Array(masterKeyHash.arr);
  const masterKeyHashString = btoa(String.fromCharCode(...masterKeyHashBytes));
  // protectedSymKey.string
  const encType = protectedSymKey.encType;
  const iv = btoa(String.fromCharCode(...protectedSymKey.iv.arr));
  const ct = btoa(String.fromCharCode(...protectedSymKey.ct.arr));
  let result = `${encType}.${iv}|${ct}`;

  if (protectedSymKey.mac?.arr) {
    const mac = btoa(String.fromCharCode(...protectedSymKey.mac.arr));
    result += `|${mac}`;
  }

  // publicKey.b64
  const generatedPublicKey = new Uint8Array(publicKey.arr);
  const generatedPublicKeyB64 = btoa(
    String.fromCharCode.apply(null, [...generatedPublicKey]),
  );
  // protectedPrivateKey.string
  const protectedPrivateKey = await aesEncrypt(
    privateKey.arr.buffer,
    stretchedMasterKey.encKey,
    stretchedMasterKey.macKey,
  );

  if (!protectedPrivateKey?.mac) {
    return;
  }

  const protectedPrivateKeyEncType = protectedPrivateKey.encType;
  const protectedPrivateKeyIv = btoa(
    String.fromCharCode(...protectedPrivateKey.iv.arr),
  );
  const protectedPrivateKeyCt = btoa(
    String.fromCharCode(...protectedPrivateKey.ct.arr),
  );
  const protectedPrivateKeyMac = btoa(
    String.fromCharCode(...protectedPrivateKey.mac.arr),
  );
  const protectedPrivateKeyResult = `${protectedPrivateKeyEncType}.${protectedPrivateKeyIv}|${protectedPrivateKeyCt}|${protectedPrivateKeyMac}`;

  const environmentVariables = [
    `\n`,
    `# Generated crypto values`,
    `KDF_ITERATIONS=${defaultKdfIterations}`,
    `MASTER_PASSWORD_HASH="${masterKeyHashString}"`,
    `PROTECTED_SYMMETRIC_KEY="${result}"`,
    `GENERATED_RSA_KEY_PAIR_PUBLIC_KEY="${generatedPublicKeyB64}"`,
    `GENERATED_RSA_KEY_PAIR_PROTECTED_PRIVATE_KEY="${protectedPrivateKeyResult}"`,
    `\n`,
  ];

  const stream = fs.createWriteStream(".env", { flags: "a" });
  stream.write(environmentVariables.join("\n"));
  stream.end();
}

getValues();
