import fetch from "cross-fetch";
import { configDotenv } from "dotenv";

configDotenv({ quiet: true });

type ResponseData = {
  captchaBypassToken?: string;
  message?: string | "The model state is invalid.";
  validationErrors?: {
    [key: string]: string[];
  };
  exceptionMessage?: string | null;
  exceptionStackTrace?: string | null;
  innerExceptionMessage?: string | null;
  object?: "registerFinish" | "error";
};

type PreAccountCreateResponseData = ResponseData | string;

type AccountCreationResponseData = ResponseData;

let failedAttemptsCount = 0;

async function createAccount() {
  if (failedAttemptsCount > 25) {
    throw new Error("The account was unable to be created.");
  }

  const {
    GENERATED_RSA_KEY_PAIR_PROTECTED_PRIVATE_KEY,
    GENERATED_RSA_KEY_PAIR_PUBLIC_KEY,
    KDF_ITERATIONS,
    MASTER_PASSWORD_HASH,
    PROTECTED_SYMMETRIC_KEY,
    VAULT_EMAIL,
    VAULT_HOST_URL,
    VAULT_HOST_PORT,
  } = process.env;
  const vaultHost = `${VAULT_HOST_URL}:${VAULT_HOST_PORT}`;

  try {
    const requestOptions: RequestInit & { compress?: boolean } = {
      headers: {
        accept: "application/json",
        "content-type": "application/json; charset=utf-8",
      },
      method: "POST",
      // node-fetch passthrough: skip gzip negotiation/decompression. The lite
      // container advertises `Content-Encoding: gzip` on register responses but
      // emits a body that gunzip rejects, surfacing as ERR_STREAM_PREMATURE_CLOSE.
      compress: false,
    };

    const preCreationResponse = await fetch(
      `${vaultHost}/identity/accounts/register/send-verification-email`,
      {
        ...requestOptions,
        body: JSON.stringify({ email: `${VAULT_EMAIL}`, name: "" }),
      },
    );

    const rawText1 = await preCreationResponse.text();
    console.log(
      `[debug] step1 status=${preCreationResponse.status} body=${rawText1.slice(0, 500)}`,
    );
    const preCreationResponseData = JSON.parse(
      rawText1,
    ) as PreAccountCreateResponseData;

    if (
      typeof preCreationResponseData !== "string" &&
      preCreationResponseData.object === "error"
    ) {
      const emailIsTaken = !!preCreationResponseData.message?.match(
        /^Email .+@.+ is already taken$/g,
      )?.length;

      if (emailIsTaken) {
        emitSuccessMessage(vaultHost);
        return;
      }

      console.log(`Retrying account creation at ${vaultHost}...`);
      if (preCreationResponseData.validationErrors) {
        // Validation errors indicate a real misconfiguration — always surface them
        if (preCreationResponseData.message) {
          console.log(`\x1b[2m  ${preCreationResponseData.message}\x1b[0m`);
        }
        Object.entries(preCreationResponseData.validationErrors).forEach(
          ([field, msgs]) =>
            console.log(`\x1b[2m    ${field}: ${msgs.join(", ")}\x1b[0m`),
        );
      }
      failedAttemptsCount++;
      setTimeout(createAccount, 3000);
      return;
    } else if (
      typeof preCreationResponseData !== "string" ||
      !preCreationResponseData.startsWith(
        "BwRegistrationEmailVerificationToken_",
      )
    ) {
      console.log(
        "Unexpected response: expected BwRegistrationEmailVerificationToken",
      );
      return;
    }

    const response = await fetch(
      `${vaultHost}/identity/accounts/register/finish`,
      {
        ...requestOptions,
        body: JSON.stringify({
          email: `${VAULT_EMAIL}`,
          emailVerificationToken: preCreationResponseData,
          masterPasswordHash: `${MASTER_PASSWORD_HASH}`,
          kdf: 0,
          kdfIterations: KDF_ITERATIONS,
          masterPasswordHint: "",
          userSymmetricKey: `${PROTECTED_SYMMETRIC_KEY}`,
          userAsymmetricKeys: {
            publicKey: `${GENERATED_RSA_KEY_PAIR_PUBLIC_KEY}`,
            encryptedPrivateKey: `${GENERATED_RSA_KEY_PAIR_PROTECTED_PRIVATE_KEY}`,
          },
        }),
      },
    );

    const rawText2 = await response.text();
    console.log(
      `[debug] step2 status=${response.status} body=${rawText2.slice(0, 500)}`,
    );
    const responseData = JSON.parse(rawText2) as AccountCreationResponseData;

    if (responseData.object === "registerFinish") {
      emitSuccessMessage(vaultHost);
      return;
    }
  } catch (error) {
    console.log("[debug] caught:", error);
  }

  console.log(`Retrying account creation at ${vaultHost}...`);
  failedAttemptsCount++;
  setTimeout(createAccount, 3000);
}

function emitSuccessMessage(vaultHost: string) {
  console.log(
    "\x1b[1m\x1b[32m%s\x1b[0m", // bold, light green foreground
    `Account has been created successfully at ${vaultHost}!\n`,
  );
}

createAccount();
