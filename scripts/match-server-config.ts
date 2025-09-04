import fetch from "cross-fetch";
import fs from "fs";
import { configDotenv } from "dotenv";

configDotenv({ quiet: true });

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
  const { REMOTE_VAULT_CONFIG_MATCH, EXTENSION_BUILD_PATH } = process.env;
  let extensionBuildVersion: string | undefined;

  if (REMOTE_VAULT_CONFIG_MATCH) {
    try {
      const manifestContent = await fs.promises.readFile(
        `${EXTENSION_BUILD_PATH}/manifest.json`,
        "utf8",
      );

      if (manifestContent) {
        const parsedFile: { version: string; manifest_version: number } =
          JSON.parse(manifestContent);
        extensionBuildVersion = parsedFile.version;
      }

      if (extensionBuildVersion) {
        console.log(
          "\x1b[1m\x1b[32m%s\x1b[0m", // bold, light green foreground
          `Extension build is v${extensionBuildVersion}\n`,
        );
      }
    } catch (error) {
      console.warn(
        "\x1b[1m\x1b[33m%s\x1b[0m", // bold, yellow foreground
        `Could not find the extension version in the manifest.json! Flags will be fetched without it.\n`,
      );
    }

    try {
      const options = {
        method: "GET",
        headers: {
          // We need to include client headers that are targeted by our external
          // feature flag service for conditional return values
          ...(extensionBuildVersion
            ? { "bitwarden-client-version": extensionBuildVersion }
            : {}),
          "device-type": "2",
        },
      };

      const response = await fetch(REMOTE_VAULT_CONFIG_MATCH, options);

      const { featureStates } =
        ((await response.json()) as VaultConfigurationResponseData) || {};

      const flagsContent = await fs.promises.readFile("flags.json", "utf8");

      let parsedFile = {};

      if (flagsContent) {
        parsedFile = JSON.parse(flagsContent);
      }

      const fileData = { ...parsedFile, flagValues: { ...featureStates } };

      const newFileContent = JSON.stringify(fileData);

      await fs.promises.writeFile("flags.json", newFileContent, "utf8");

      console.log(
        "\x1b[1m\x1b[32m%s\x1b[0m", // bold, light green foreground
        `Feature flag values from ${REMOTE_VAULT_CONFIG_MATCH} have been successfully written to 'flags.json'!\n`,
      );
    } catch (error) {
      throw error;
    }
  } else {
    console.warn(
      "\x1b[1m\x1b[33m%s\x1b[0m", // bold, yellow foreground
      "No remote config URL was provided!\n",
    );
  }

  return;
}

matchRemoteFeatureFlags();
