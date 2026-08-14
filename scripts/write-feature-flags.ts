import path from "path";
import fs from "fs";

const featureFlagEnvironmentVariablePrefix = "Features__FlagValues__";

export const featureFlagEnvironmentFilePath = path.join(
  __dirname,
  "../flags.env",
);

function warn(message: string) {
  console.warn(
    "\x1b[1m\x1b[33m%s\x1b[0m", // bold, yellow foreground
    message,
  );
}

/**
 * Writes the given flag key-value pairs to `flags.env` in the
 * `<featureFlagEnvironmentVariablePrefix><key>=<value>` format the server
 * expects, replacing any previously generated file.
 *
 * No validation or normalization is performed; the provided JSON inputs are
 * presumed to be correct and valid.
 *
 * @returns the number of flags written
 */
export async function writeFeatureFlagEnvironmentFile(
  flagValues: Record<string, unknown>,
): Promise<number> {
  const environmentFileLines = Object.entries(flagValues ?? {}).map(
    ([flagKey, flagValue]) =>
      `${featureFlagEnvironmentVariablePrefix}${flagKey}=${flagValue}`,
  );

  const fileContent =
    environmentFileLines.length > 0
      ? `${environmentFileLines.join("\n")}\n`
      : "";

  await fs.promises.writeFile(
    featureFlagEnvironmentFilePath,
    fileContent,
    "utf8",
  );

  return environmentFileLines.length;
}

/**
 * Parses a JSON object of flag key-value pairs (the format accepted by the
 * `FEATURE_FLAGS` workflow input) and writes it to `flags.env`.
 */
export async function writeFeatureFlagEnvironmentFileFromJson(
  flagValuesJson: string,
): Promise<number> {
  let parsedFlagValues: unknown;

  try {
    parsedFlagValues = JSON.parse(flagValuesJson);
  } catch (error) {
    throw new Error(
      `FEATURE_FLAGS could not be parsed as JSON: ${(error as Error).message}`,
    );
  }

  if (
    typeof parsedFlagValues !== "object" ||
    parsedFlagValues === null ||
    Array.isArray(parsedFlagValues)
  ) {
    throw new Error(
      "FEATURE_FLAGS must be a JSON object of flag key-value pairs",
    );
  }

  return writeFeatureFlagEnvironmentFile(
    parsedFlagValues as Record<string, unknown>,
  );
}

async function writeFeatureFlagsFromEnvironment() {
  const flagValuesJson = process.env.FEATURE_FLAGS;

  if (!flagValuesJson) {
    warn(
      "No FEATURE_FLAGS value was provided; writing an empty 'flags.env' file.\n",
    );

    await writeFeatureFlagEnvironmentFile({});

    return;
  }

  const flagCount =
    await writeFeatureFlagEnvironmentFileFromJson(flagValuesJson);

  console.log(
    "\x1b[1m\x1b[32m%s\x1b[0m", // bold, light green foreground
    `${flagCount} feature flag value(s) from FEATURE_FLAGS have been written to 'flags.env'!\n`,
  );
}

if (require.main === module) {
  writeFeatureFlagsFromEnvironment();
}
