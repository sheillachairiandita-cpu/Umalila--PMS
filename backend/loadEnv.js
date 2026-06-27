import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const nodeEnv = process.env.NODE_ENV || 'development';

const envFileNames = [
  `.env.${nodeEnv}.local`,
  `.env.${nodeEnv}`,
  '.env.local',
  '.env',
];

/** Load env files from backend/ (primary), then repo root (legacy fallback). */
const searchRoots = [
  __dirname,
  join(__dirname, '..'),
];

for (const root of searchRoots) {
  for (const name of envFileNames) {
    const path = join(root, name);
    if (existsSync(path)) {
      dotenv.config({ path, override: false });
    }
  }
}
