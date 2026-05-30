import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionPath = join(__dirname, '../../version.json');

export default async function versionRoutes(fastify) {

  fastify.get('/latest', async () => {
    const content = await readFile(versionPath, 'utf-8');
    return JSON.parse(content);
  });

}
