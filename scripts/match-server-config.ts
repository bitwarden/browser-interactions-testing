import fetch from "cross-fetch";
import fs from "fs";
import { configDotenv } from "dotenv";

configDotenv();

type VaultConfigurationResponseData = {
  version: string;
  gitHash: string;
  server: string | null;
  environment: {
    cloudRegion: string;
    vault: string;
    api: string;
    identity: string;
    notifications: string;
    sso: string;
  };
  featureStates: {
    [key: string]: boolean;
  };
  settings: {
    disableUserRegistration: false;
  };
  object: string;
};

async function matchRemoteFeatureFlags() {
  const { REMOTE_VAULT_CONFIG_MATCH } = process.env;
  if (REMOTE_VAULT_CONFIG_MATCH) {
    try {
      const response = await fetch(REMOTE_VAULT_CONFIG_MATCH);

      const { featureStates } =
        ((await response.json()) as VaultConfigurationResponseData) || {};

      await fs.readFile("flags.json", "utf8", async (error, fileContent) => {
        if (error) {
          throw error;
        }

        let parsedFile = {};

        if (fileContent) {
          parsedFile = JSON.parse(fileContent);
        }

        const fileData = { ...parsedFile, flagValues: { ...featureStates } };

        const newFileContent = JSON.stringify(fileData);

        await fs.writeFile("flags.json", newFileContent, "utf8", () => {});

        console.log(
          "\x1b[1m\x1b[32m%s\x1b[0m", // bold, light green foreground
          `Feature flag values from ${REMOTE_VAULT_CONFIG_MATCH} have been successfully written to 'flags.json'!\n`,
        );
      });
    } catch (error) {
      throw error;
    }
  }

  return;
}

matchRemoteFeatureFlags();
