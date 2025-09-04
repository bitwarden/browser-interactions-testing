import fs from "fs";
import { configDotenv } from "dotenv";

configDotenv({ quiet: true });

type InstallationResponseData = {
  id?: string;
  key?: string;
  enabled?: boolean;
  object?: string;
};

let installationsEndpoint = "https://api.bitwarden.com/installations";

async function getValues() {
  const {
    BW_INSTALLATION_ID,
    BW_INSTALLATION_KEY,
    CI,
    INSTALLATIONS_ENDPOINT,
    VAULT_EMAIL,
  } = process.env;

  if (CI !== "true") {
    console.log(
      [
        "Now generating values for the following environment variables and adding them to your dotenv file:",
        "BW_INSTALLATION_ID",
        "BW_INSTALLATION_KEY",
        "",
      ].join("\n"),
    );
  }

  if (!VAULT_EMAIL?.length) {
    console.error(
      "\x1b[1m\x1b[31m%s\x1b[0m", // bold, red foreground
      `Your dotenv file is missing a valid value for VAULT_EMAIL. Installation values will not be fetched.`,
      "\n",
    );

    return;
  }

  if (BW_INSTALLATION_ID?.length || BW_INSTALLATION_KEY?.length) {
    console.warn(
      "\x1b[1m\x1b[33m%s\x1b[0m", // bold, yellow foreground
      "There are existing installation values in your dotenv file. Remove them or update the values manually with the tools on https://bitwarden.com/host\n",
    );

    return;
  }

  if (INSTALLATIONS_ENDPOINT?.length) {
    installationsEndpoint = INSTALLATIONS_ENDPOINT;
  }

  const installationValues = await fetch(installationsEndpoint, {
    method: "POST",
    body: JSON.stringify({ email: VAULT_EMAIL }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  const { id, key } =
    (await installationValues.json()) as InstallationResponseData;

  if (!id || !key) {
    console.error(
      "\x1b[1m\x1b[31m%s\x1b[0m", // bold, red foreground
      `There was a problem getting the installation values.`,
      "\n",
    );

    return;
  }

  const environmentVariables = [
    `\n`,
    `# Generated installation values`,
    `BW_INSTALLATION_ID="${id}"`,
    `BW_INSTALLATION_KEY="${key}"`,
    `\n`,
  ];

  const stream = fs.createWriteStream(".env", { flags: "a" });
  stream.write(environmentVariables.join("\n"));
  stream.end();
}

getValues();
