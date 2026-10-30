// Накладає власні іконки на згенерований Capacitor-проєкт (android/).
import { cp, access } from 'node:fs/promises';

const target = 'android/app/src/main/res';
await access(target).catch(() => {
  console.error(`Не знайдено ${target}. Спершу виконайте: npx cap add android`);
  process.exit(1);
});
await cp('assets/android-res', target, { recursive: true, force: true });
console.log('Іконки застосовано.');
