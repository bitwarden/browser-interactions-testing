import fetch from "cross-fetch";
import { configDotenv } from "dotenv";

configDotenv();

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
  if (failedAttemptsCount > 60) {
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
    const requestOptions = {
      headers: {
        accept: "application/json",
        "content-type": "application/json; charset=utf-8",
      },
      method: "POST",
    };

    const preCreationResponse = await fetch(
      `${vaultHost}/identity/accounts/register/send-verification-email`,
      {
        ...requestOptions,
        body: JSON.stringify({ email: `${VAULT_EMAIL}`, name: "" }),
      },
    );

    const preCreationResponseData =
      (await preCreationResponse.json()) as PreAccountCreateResponseData;

    if (
      typeof preCreationResponseData !== "string" &&
      preCreationResponseData.object === "error"
    ) {
      const emailIsTaken = !!preCreationResponseData.message.match(
        /^Email .+@.+ is already taken$/g,
      )?.length;

      if (emailIsTaken) {
        emitSuccessMessage(vaultHost);
        return;
      }

      console.log(`Retrying account creation at ${vaultHost}...`);
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

    const responseData = (await response.json()) as AccountCreationResponseData;

    if (responseData.object === "registerFinish") {
      emitSuccessMessage(vaultHost);
      return;
    }
  } catch (error) {
    // Server isn't ready yet
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
