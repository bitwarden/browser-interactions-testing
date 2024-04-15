import { configDotenv } from "dotenv";

configDotenv();

const testSiteHostPort = process.env.PAGES_HOST_PORT
  ? `:${process.env.PAGES_HOST_PORT}`
  : "";
export const testSiteHost = `${process.env.PAGES_HOST}${testSiteHostPort}`;
