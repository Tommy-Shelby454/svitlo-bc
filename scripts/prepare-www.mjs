// Готує теку www для Android-збірки: копія застосунку + config.json з адресою даних.
import { cp, rm, writeFile } from 'node:fs/promises';

const repo = process.env.GITHUB_REPOSITORY || process.env.REPO;
if (!repo) {
  console.error('Не задано GITHUB_REPOSITORY (формат: власник/репозиторій).');
  process.exit(1);
}

await rm('www', { recursive: true, force: true });
await cp('app/www', 'www', { recursive: true });
const dataUrl = `https://raw.githubusercontent.com/${repo}/data/schedule.json`;
const addressesUrl = `https://raw.githubusercontent.com/${repo}/map/addresses.json`;
await writeFile('www/config.json', JSON.stringify({ dataUrl, addressesUrl }));
console.log(`www готово, дані з ${dataUrl}, адреси з ${addressesUrl}`);
