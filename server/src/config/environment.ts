import { config } from 'dotenv';

const environmentFile = new URL('../../../.env', import.meta.url);

// In local development, the root .env file is the source of truth. Using
// override ensures a restarted watch process cannot retain stale provider
// credentials inherited from an older shell process.
config({
  path: environmentFile,
  override: process.env.NODE_ENV !== 'production',
  quiet: true,
});
