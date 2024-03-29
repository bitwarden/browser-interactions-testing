const fs = require("fs");
const crypto = require("node:crypto");
const { configDotenv } = require("dotenv");

// Constants

configDotenv();

const defaultKdfIterations = 600000;

const encTypes = {
  AesCbc256_B64: 0,
  AesCbc128_HmacSha256_B64: 1,
  AesCbc256_HmacSha256_B64: 2,
  Rsa2048_OaepSha256_B64: 3,
  Rsa2048_OaepSha1_B64: 4,
  Rsa2048_OaepSha256_HmacSha256_B64: 5,
  Rsa2048_OaepSha1_HmacSha256_B64: 6,
};

// Object Classes

class Cipher {
  constructor(encType, iv, ct, mac) {
    if (!arguments.length) {
      this.encType = null;
      this.iv = null;
      this.ct = null;
      this.mac = null;
      this.string = null;
      return;
    }

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

class ByteData {
  constructor(buf) {
    if (!arguments.length) {
      this.arr = null;
      this.b64 = null;
      return;
    }

    this.arr = new Uint8Array(buf);
    this.b64 = toB64(buf);
  }
}

class SymmetricCryptoKey {
  constructor(buf) {
    if (!arguments.length) {
      this.key = new ByteData();
      this.encKey = new ByteData();
      this.macKey = new ByteData();
      return;
    }

    this.key = new ByteData(buf);

    // First half
    const encKey = this.key.arr.slice(0, this.key.arr.length / 2).buffer;
    this.encKey = new ByteData(encKey);

    // Second half
    const macKey = this.key.arr.slice(this.key.arr.length / 2).buffer;
    this.macKey = new ByteData(macKey);
  }
}

// Helpers

function fromUtf8(str) {
  const strUtf8 = unescape(encodeURIComponent(str));
  const bytes = new Uint8Array(strUtf8.length);
  for (let i = 0; i < strUtf8.length; i++) {
    bytes[i] = strUtf8.charCodeAt(i);
  }
  return bytes.buffer;
}

function toB64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return Buffer.from(binary).toString("base64");
}

// Crypto

async function pbkdf2(password, salt, iterations, length) {
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

async function aesEncrypt(data, encKey, macKey) {
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

async function computeMac(data, key) {
  const alg = {
    name: "HMAC",
    hash: { name: "SHA-256" },
  };
  const importedKey = await crypto.subtle.importKey("raw", key, alg, false, [
    "sign",
  ]);
  return crypto.subtle.sign(alg, importedKey, data);
}

function buildDataForMac(ivArr, ctArr) {
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

async function stretchKey(key) {
  const newKey = new Uint8Array(64);
  newKey.set(await hkdfExpand(key, new Uint8Array(fromUtf8("enc")), 32));
  newKey.set(await hkdfExpand(key, new Uint8Array(fromUtf8("mac")), 32), 32);
  return new SymmetricCryptoKey(newKey.buffer);
}

// ref: https://tools.ietf.org/html/rfc5869
async function hkdfExpand(prk, info, size) {
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

async function generateKeys() {
  const self = this;

  const symKey = new Uint8Array(512 / 8);
  crypto.getRandomValues(symKey);
  self.symKey = new SymmetricCryptoKey(symKey);

  const keyPair = await generateRsaKeyPair();
  self.publicKey = keyPair.publicKey;
  self.privateKey = keyPair.privateKey;
  return {
    symKey: self.symKey,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
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
      "There are existing crypto values in your dotenv file. Remove them or update the values manually with the tools on https://bitwarden.com/crypto.html\n",
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

  const stretchedMasterKey = await stretchKey(masterKey.arr.buffer);
  const masterKeyHash = await pbkdf2(
    masterKey.arr.buffer,
    masterPassword,
    1,
    256,
  );

  const protectedSymKey = await aesEncrypt(
    symKey.key.arr,
    stretchedMasterKey.encKey,
    stretchedMasterKey.macKey,
  );

  const protectedPrivateKey = await aesEncrypt(
    privateKey.arr,
    symKey.encKey,
    symKey.macKey,
  );

  const environmentVariables = [
    `\n`,
    `# Generated crypto values`,
    `KDF_ITERATIONS=${defaultKdfIterations}`,
    `MASTER_PASSWORD_HASH="${masterKeyHash.b64}"`,
    `PROTECTED_SYMMETRIC_KEY="${protectedSymKey.string}"`,
    `GENERATED_RSA_KEY_PAIR_PUBLIC_KEY="${publicKey.b64}"`,
    `GENERATED_RSA_KEY_PAIR_PROTECTED_PRIVATE_KEY="${protectedPrivateKey.string}"`,
    `\n`,
  ];
  const stream = fs.createWriteStream(".env", { flags: "a" });
  stream.write(environmentVariables.join("\n"));
  stream.end();
}

getValues();
