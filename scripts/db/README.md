# ฐานข้อมูล: Phase 1–2 runbook

> ⚠️ `prisma.config.ts` อ่าน `SUPABASE_POSTGRES_PRISMA_URL` ซึ่งใน `.env` ชี้ไปที่ **production**
> ห้ามรัน `prisma migrate dev` / `prisma db push` / `prisma migrate reset` จากเครื่องนี้จนกว่าจะแยก DB เสร็จ
> คำสั่งด้านล่างทุกคำสั่งระบุ URL ปลายทางเองเสมอ

## Phase 1: แยก DB สำหรับ preview

1. Supabase → New project (เช่น `it-tracker-preview`) ภูมิภาคเดียวกับ production
2. Vercel → Settings → Environment Variables → ตั้งค่า `SUPABASE_*` ทุกตัวของ **Preview** ให้ชี้ project ใหม่
   (Production คงเดิม)
3. สร้างตารางใน DB preview จาก migration (DB ว่าง):
   ```bash
   DATABASE_URL="<preview direct url>" npx prisma migrate deploy --schema prisma/schema.prisma
   ```
   ถ้า Prisma ไม่รับ `DATABASE_URL` ให้ตั้ง `SUPABASE_POSTGRES_PRISMA_URL="<preview url>"` เฉพาะคำสั่งนั้น
4. ใส่ข้อมูลทดสอบ:
   ```bash
   ALLOW_SEED=1 SEED_DATABASE_URL="<preview direct url>" npm run db:seed
   ```
5. ทดสอบ restore: Supabase production → Database → Backups → restore สำเนาล่าสุดลง DB preview อีกตัว
   (ใช้เป็น "สำเนา production" สำหรับซ้อม Phase 2)

## Phase 1: baseline production (ทำครั้งเดียว ไม่แก้ข้อมูล)

ตาราง production มีอยู่แล้ว จึงบอก Prisma ว่า `0_init` ถูก apply ไปแล้ว:
```bash
SUPABASE_POSTGRES_PRISMA_URL="<production direct url>" npx prisma migrate resolve --applied 0_init
```
คำสั่งนี้เขียนแค่ตาราง `_prisma_migrations` ไม่แตะตารางอื่น

## Phase 2: ย้าย assignee / แผนก / companions

ทำบน **สำเนา production** ก่อนเสมอ แล้วค่อยทำบน production

1. Expand (สร้างตารางใหม่ ไม่แตะคอลัมน์เดิม):
   ```bash
   SUPABASE_POSTGRES_PRISMA_URL="<url>" npx prisma migrate deploy
   ```
2. Backfill (รันซ้ำได้):
   ```bash
   psql "<url>" -f scripts/db/backfill_relations.sql
   ```
3. Verify (อ่านอย่างเดียว): `psql "<url>" -f scripts/db/verify_relations.sql`
   - query 1–3 ต้องได้ 0 แถว ถ้าไม่ใช่ = ค่าที่จับคู่ไม่ได้ แก้ข้อมูลหรือยืนยันว่าทิ้งได้
   - query 4: `legacy_pairs` ต้องเท่ากับ `new_rows`
4. เปลี่ยนโค้ดให้เขียนทั้งสองที่ (dual-write) แล้วค่อยย้าย read มาตารางใหม่ (Phase 3)
5. Contract: ลบคอลัมน์เดิมใน migration ใหม่ **หลังจาก** production ใช้ตารางใหม่ครบ 1 สัปดาห์และมี backup

ไม่มี `psql`? ใช้ Supabase → SQL Editor วางเนื้อหาไฟล์ .sql แทนได้
