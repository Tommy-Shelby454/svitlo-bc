// Накладає власні іконки й дозволи на згенерований Capacitor-проєкт (android/).
import { cp, access, readFile, writeFile } from 'node:fs/promises';

const target = 'android/app/src/main/res';
await access(target).catch(() => {
  console.error(`Не знайдено ${target}. Спершу виконайте: npx cap add android`);
  process.exit(1);
});
await cp('assets/android-res', target, { recursive: true, force: true });
console.log('Іконки та ресурси застосовано.');

// Дозволи для сповіщень: показ сповіщень (Android 13+) і точні будильники для планування
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let xml = await readFile(manifestPath, 'utf8');
const perms = ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM', 'RECEIVE_BOOT_COMPLETED'];
const missing = perms.filter((p) => !xml.includes(`android.permission.${p}"`));
if (missing.length) {
  const add = missing.map((p) => `    <uses-permission android:name="android.permission.${p}" />\n`).join('');
  xml = xml.replace(/<\/manifest>\s*$/, `${add}</manifest>\n`);
  await writeFile(manifestPath, xml);
}
console.log(`Дозволи в маніфесті: додано ${missing.length ? missing.join(', ') : 'нічого (вже є)'}.`);
