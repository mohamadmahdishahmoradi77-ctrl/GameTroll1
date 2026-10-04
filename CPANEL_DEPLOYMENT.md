# GAME TROLL — cPanel / MySQL deployment

این نسخه برای هاست Node.js + MySQL آماده شده و منطق فعلی سایت، پنل مدیریت، کاربران، پک‌ها، سفارش‌ها و تیکت‌ها را حفظ می‌کند.

## 1) ساخت MySQL

در cPanel از **MySQL Database Wizard** یک دیتابیس و کاربر بسازید و دسترسی کاربر به دیتابیس را با **ALL PRIVILEGES** فعال کنید.

## 2) Environment Variables

در **Application Manager** این متغیرها را تنظیم کنید:

```text
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=نام_دیتابیس
MYSQL_USER=نام_کاربر
MYSQL_PASSWORD=رمز_کاربر
SESSION_SECRET=یک_رشته_تصادفی_طولانی
APP_URL=https://دامنه-سایت
PORT=3000
```

اگر هاست یک `MYSQL_URL` در اختیار شما قرار داد، می‌توانید به‌جای چهار متغیر MySQL فقط آن را تنظیم کنید.

## 3) اجرای برنامه

- Startup file: `server.js`
- Node.js: نسخه 20 یا بالاتر پیشنهاد می‌شود.
- دستور نصب: `npm install`
- دستور اجرا: `npm start`

با اولین اجرای برنامه، جداول موردنیاز MySQL به‌صورت خودکار ساخته می‌شوند.

## 4) دامنه

دامنه را طبق Application Manager هاست به برنامه متصل کنید. برنامه از `process.env.PORT` استفاده می‌کند.

## 5) انتقال داده از PostgreSQL قبلی

**قبل از انتقال، از PostgreSQL قبلی Backup بگیرید.** این نسخه برای دیتابیس جدید MySQL جداول را می‌سازد؛ داده‌های قدیمی را خودکار حذف یا منتقل نمی‌کند.

اگر دیتابیس PostgreSQL قبلی هنوز قابل دسترسی است، ابتدا داده‌ها را Export/Backup کنید و سپس به MySQL تبدیل و Import کنید. تا قبل از تأیید موفقیت انتقال، سرویس یا دیتابیس قبلی را حذف نکنید.

## 6) بکاپ

هاست اعلام کرده بکاپ روزانه دارد و ۷ روز اخیر از طریق پنل قابل بازیابی یا دانلود است. علاوه بر آن، برای داده‌های مهم GAME TROLL بهتر است Backup مستقل هم نگه‌داری شود.


## PostgreSQL → MySQL migration
Before changing production data, create and verify a PostgreSQL backup. The project now includes two guarded tools:

- `npm run validate:migration` — compares source PostgreSQL and target MySQL row counts, schema columns, IDs, orphan relations and target charset. It never changes data.
- `npm run migrate:pg-mysql` — defaults to dry-run. A real write requires both `MIGRATION_APPLY=YES` and `BACKUP_CONFIRMED=YES`. It upserts source rows in batches and never deletes target-only rows.

Required variables for the tools: `SOURCE_DATABASE_URL` and `MYSQL_URL`. After an applied migration, run the validator again. Do not run the migration against a production database until the backup and validation checks have been completed.


## Final production checklist
- Use Node.js 20+ and HTTPS.
- Set `SESSION_SECRET` and `APP_URL` before first production start.
- Configure the MySQL variables and confirm the database user has permission to create tables/indexes.
- Make sure the application can write to its `uploads/` directory.
- Test `/api/health`, registration/login, profile, uploads, orders, tickets and admin actions after restart.
