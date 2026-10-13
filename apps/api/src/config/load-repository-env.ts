import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryEnvFiles = [
  new URL('../../../../.env.local', import.meta.url),
  new URL('../../../../.env', import.meta.url),
];

export function loadRepositoryEnv(): void {
  for (const envFile of repositoryEnvFiles) {
    try {
      loadEnvFile(fileURLToPath(envFile));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
