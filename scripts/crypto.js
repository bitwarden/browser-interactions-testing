#!/usr/bin/env node

// A CLI version of https://bitwarden.com/crypto.html

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { program } = require("commander");

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

program
  .command("encrypt <secret> <password> <email> <iterations>")
  .description("Encrypts a secret using AES")
  .option("-o, --output <filename>", "write output to a file")
  .option("--items", "generate items")
  .action(async (email, password, iterations, secret, options) => {
    secret = secret;
    password = password;
    email = email;
    iterations = parseInt(iterations);
    const logStream = options.output
      ? fs.createWriteStream(path.resolve(options.output), { flags: "a" })
      : process.stdout;
    console.log = function (data) {
      logStream.write(`${data}\n`);
    };
    console.log(`EMAIL="${email}"`);
    await generateKeys();
    const masterKey = await pbkdf2(password, email, iterations, 256);
    const masterKeyBytes = new Uint8Array(masterKey.arr);
    const masterKeyString = btoa(String.fromCharCode(...masterKeyBytes));
    const stretchedMasterKey = await stretchKey(masterKey.arr.buffer);
    const protectedSymKey = await aesEncrypt(
      symKey.key.arr.buffer,
      stretchedMasterKey.encKey,
      stretchedMasterKey.macKey,
    );

    console.log('MASTER_KEY="' + masterKeyString + '"');
    const stretchedMasterKeyArrayBuffer = new Uint8Array(
      stretchedMasterKey.key.arr,
    ).buffer;
    const stretchedMasterKeyBase64String = btoa(
      String.fromCharCode(...new Uint8Array(stretchedMasterKeyArrayBuffer)),
    );
    const masterKeyHash = await pbkdf2(masterKey.arr, password, 1, 256);
    const masterKeyHashBytes = new Uint8Array(masterKeyHash.arr);
    const masterKeyHashString = btoa(
      String.fromCharCode(...masterKeyHashBytes),
    );
    console.log('MASTER_PASSWORD_HASH="' + masterKeyHashString + '"');
    console.log(
      'STRETCHED_MASTER_KEY="' + stretchedMasterKeyBase64String + '"',
    );
    const encKey = new Uint8Array(stretchedMasterKey.encKey.arr);
    const encKeyB64 = btoa(String.fromCharCode.apply(null, encKey));
    console.log('ENCRYPTION_KEY="' + encKeyB64 + '"');
    const macKey = new Uint8Array(stretchedMasterKey.macKey.arr);
    const macKeyB64 = btoa(String.fromCharCode.apply(null, macKey));
    console.log('MAC_KEY="' + macKeyB64 + '"');
    const generatedMacKey = new Uint8Array(symKey.macKey.arr);
    const generatedMacKeyB64 = btoa(
      String.fromCharCode.apply(null, generatedMacKey),
    );
    console.log('SYMMETRIC_KEY="' + generatedMacKeyB64 + '"');
    // protectedSymKey.string
    const cipher = protectedSymKey;
    const encType = cipher.encType;
    const iv = btoa(String.fromCharCode(...cipher.iv.arr));
    const ct = btoa(String.fromCharCode(...cipher.ct.arr));
    const mac = btoa(String.fromCharCode(...cipher.mac.arr));
    const result = `${encType}.${iv}|${ct}|${mac}`;
    console.log('PROTECTED_SYMMETRIC_KEY="' + result + '"');
    // publicKey.b64
    const generatedPublicKey = new Uint8Array(publicKey.arr);
    const generatedPublicKeyB64 = btoa(
      String.fromCharCode.apply(null, generatedPublicKey),
    );
    console.log('PUBLIC_KEY="' + generatedPublicKeyB64 + '"');
    // privateKey.b64
    const generatedPrivateKey = new Uint8Array(privateKey.arr);
    const generatedPrivateKeyB64 = btoa(
      String.fromCharCode.apply(null, generatedPrivateKey),
    );
    console.log('PRIVATE_KEY="' + generatedPrivateKeyB64 + '"');
    // protectedPrivateKey.string
    const protectedPrivateKey = await aesEncrypt(
      privateKey.arr.buffer,
      stretchedMasterKey.encKey,
      stretchedMasterKey.macKey,
    );
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
    console.log('PROTECTED_PRIVATE_KEY="' + protectedPrivateKeyResult + '"');
    // protectedSecret.string
    const protectedSecret = await aesEncrypt(
      secret,
      stretchedMasterKey.encKey,
      stretchedMasterKey.macKey,
    );
    const protectedSecretEncType = protectedSecret.encType;
    const protectedSecretIv = btoa(
      String.fromCharCode(...protectedSecret.iv.arr),
    );
    const protectedSecretCt = btoa(
      String.fromCharCode(...protectedSecret.ct.arr),
    );
    const protectedSecretMac = btoa(
      String.fromCharCode(...protectedSecret.mac.arr),
    );
    const protectedSecretResult = `${protectedSecretEncType}.${protectedSecretIv}|${protectedSecretCt}|${protectedSecretMac}`;
    console.log('PROTECTED_SECRET="' + protectedSecretResult + '"');
    // unprotectedSecret
    const unprotectedSecret = await aesDecrypt(
      protectedSecret,
      stretchedMasterKey.encKey,
      stretchedMasterKey.macKey,
    );
    const unprotectedSecretKeyCipher = unprotectedSecret;
    const unprotectedSecretKeyCipherBytes = new Uint8Array(
      unprotectedSecretKeyCipher,
    );
    const unprotectedSecretKeyCipherString = decoder.decode(
      unprotectedSecretKeyCipherBytes,
    );

    console.log(
      'UNPROTECTED_SECRET_KEY_CIPHER="' +
        unprotectedSecretKeyCipherString +
        '"',
    );
    if (options.items) {
      console.log("########## Generated cipher text ##########");
      const item = {
        name: "This is an item",
        username: "username123",
        password: "password123",
        notes: "The quick brown fox jumps over the lazy dog",
        uri: "https://github.com/tangowithfoxtrot",
      };
      for (const [key, value] of Object.entries(item)) {
        const protectedValue = await aesEncrypt(
          value,
          stretchedMasterKey.encKey,
          stretchedMasterKey.macKey,
        );
        const protectedValueEncType = protectedValue.encType;
        const protectedValueIv = btoa(
          String.fromCharCode(...protectedValue.iv.arr),
        );
        const protectedValueCt = btoa(
          String.fromCharCode(...protectedValue.ct.arr),
        );
        const protectedValueMac = btoa(
          String.fromCharCode(...protectedValue.mac.arr),
        );
        const protectedValueResult = `${protectedValueEncType}.${protectedValueIv}|${protectedValueCt}|${protectedValueMac}`;
        console.log(`${key.toUpperCase()}="${protectedValueResult}"`);
      }
    }
    if (options.output) {
      logStream.end();
    }
  });

program // Doesn't work yet
  .command("decrypt <cipher> <password> <email> <iterations>")
  .description("Decrypts an encrypted data using AES")
  .action(async (cipherString, password, email, iterations) => {
    const [encType, encData] = cipherString.split(".");
    const [ivB64, ctB64, macB64] = encData.split("|");
    await generateKeys();

    console.log("ivB64:", ivB64);
    console.log("ctB64:", ctB64);
    console.log("macB64:", macB64);

    const iv = new Uint8Array(
      atob(ivB64)
        .split("")
        .map((c) => c.charCodeAt(0)),
    );

    console.log("iv:", iv);

    iterations = parseInt(iterations);
    const masterKey = await pbkdf2(password, email, iterations, 256);
    const stretchedMasterKey = await stretchKey(masterKey.arr.buffer);
    const stretchedMasterKeyBytes = new Uint8Array(stretchedMasterKey.arr);

    const cipher = {
      encType,
      iv: iv,
      ct: new Uint8Array(
        atob(ctB64)
          .split("")
          .map((c) => c.charCodeAt(0)),
      ),
      mac: new Uint8Array(
        atob(macB64)
          .split("")
          .map((c) => c.charCodeAt(0)),
      ),
    };

    console.log("cipher:", cipher);

    const unprotectedSecret = await aesDecrypt(
      cipher,
      stretchedMasterKey.encKey,
      stretchedMasterKey.macKey,
    );
    const unprotectedSecretKeyCipher = unprotectedSecret;
    const unprotectedSecretKeyCipherBytes = new Uint8Array(
      unprotectedSecretKeyCipher,
    );
    const unprotectedSecretKeyCipherString = decoder.decode(
      unprotectedSecretKeyCipherBytes,
    );

    console.log(
      'UNPROTECTED_SECRET_KEY_CIPHER="' +
        unprotectedSecretKeyCipherString +
        '"',
    );
  });

program.parse(process.argv);

async function masterKey(newValue) {
  const self = this;

  if (!newValue || !newValue.arr || !self.masterPasswordBuffer) {
    return new ByteData();
  }

  self.stretchedMasterKey = await stretchKey(newValue.arr.buffer);
  self.masterKeyHash = await pbkdf2(
    newValue.arr.buffer,
    self.masterPasswordBuffer,
    1,
    256,
  );
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

function fromUtf8(str) {
  const strUtf8 = unescape(encodeURIComponent(str));
  const bytes = new Uint8Array(strUtf8.length);
  for (let i = 0; i < strUtf8.length; i++) {
    bytes[i] = strUtf8.charCodeAt(i);
  }
  return bytes.buffer;
}

function toUtf8(buf) {
  const bytes = new Uint8Array(buf);
  const encodedString = String.fromCharCode.apply(null, bytes);
  return decodeURIComponent(escape(encodedString));
}

function toB64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return buf.toString("base64");
}

function hasValue(str) {
  return str && str !== "";
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
    // const base64Key = btoa(String.fromCharCode.apply(null, new Uint8Array(exportedKey)));
    // return { arr: new Uint8Array(exportedKey), b64: base64Key };
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
      [
        // this is line 206
        "encrypt",
      ],
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

async function aesDecrypt(cipher, encKey, macKey) {
  const keyOptions = {
    name: "AES-CBC",
  };

  const decOptions = {
    name: "AES-CBC",
    iv: cipher.iv.arr.buffer,
  };

  try {
    const checkMac = cipher.encType != encTypes.AesCbc256_B64;
    if (checkMac) {
      if (!macKey) {
        throw "MAC key not provided.";
      }
      const dataForMac = buildDataForMac(cipher.iv.arr, cipher.ct.arr);
      const macBuffer = await computeMac(dataForMac.buffer, macKey.arr.buffer);
      const macsMatch = await macsEqual(
        cipher.mac.arr.buffer,
        macBuffer,
        macKey.arr.buffer,
      );
      if (!macsMatch) {
        throw "MAC check failed.";
      }
      const importedKey = await crypto.subtle.importKey(
        "raw",
        encKey.arr.buffer,
        keyOptions,
        false,
        ["decrypt"],
      );
      return crypto.subtle.decrypt(
        decOptions,
        importedKey,
        cipher.ct.arr.buffer,
      );
    }
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

async function macsEqual(mac1Data, mac2Data, key) {
  const alg = {
    name: "HMAC",
    hash: { name: "SHA-256" },
  };

  const importedMacKey = await crypto.subtle.importKey("raw", key, alg, false, [
    "sign",
  ]);
  const mac1 = await crypto.subtle.sign(alg, importedMacKey, mac1Data);
  const mac2 = await crypto.subtle.sign(alg, importedMacKey, mac2Data);

  if (mac1.byteLength !== mac2.byteLength) {
    return false;
  }

  const arr1 = new Uint8Array(mac1);
  const arr2 = new Uint8Array(mac2);

  for (let i = 0; i < arr2.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }

  return true;
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
