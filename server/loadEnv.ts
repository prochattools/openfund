import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envFiles = ['.env.local', '.env', '.env.production'];

for (const envFile of envFiles) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) {
    continue;
  }

  dotenv.config({ path: envPath, override: false });
}
