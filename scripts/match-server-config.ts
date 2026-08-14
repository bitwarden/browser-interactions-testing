import path from "path";
import fs from "fs";
import { configDotenv } from "dotenv";
import { writeFeatureFlagEnvironmentFile } from "./write-feature-flags";

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
  const { CI, REMOTE_VAULT_CONFIG_MATCH, EXTENSION_BUILD_PATH } = process.env;
  const pathToExtensionManifest = path.join(
    __dirname,
    "../",
    CI ? "build" : EXTENSION_BUILD_PATH || "",
    "/manifest.json",
  );
  let extensionBuildVersion: string | undefined;

  if (REMOTE_VAULT_CONFIG_MATCH) {
    try {
      const manifestContent = await fs.promises.readFile(
        pathToExtensionManifest,
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
          // "Chrome Extension"
          // see: https://github.com/bitwarden/server/blob/main/src/Core/Enums/DeviceType.cs
          "device-type": "2",
          "bitwarden-client-name": "browser",
        },
      };

      const response = await fetch(REMOTE_VAULT_CONFIG_MATCH, options);

      const { featureStates } =
        ((await response.json()) as VaultConfigurationResponseData) || {};

      const flagCount = await writeFeatureFlagEnvironmentFile(
        featureStates ?? {},
      );

      console.log(
        "\x1b[1m\x1b[32m%s\x1b[0m", // bold, light green foreground
        `${flagCount} feature flag value(s) from ${REMOTE_VAULT_CONFIG_MATCH} have been successfully written to 'flags.env'!\n`,
      );
    } catch (error) {
      throw error;
    }
  } else {
    console.warn(
      "\x1b[1m\x1b[33m%s\x1b[0m", // bold, yellow foreground
      "No remote config URL was provided! Any existing 'flags.env' file has been left as-is.\n",
    );
  }

  return;
}

matchRemoteFeatureFlags();
