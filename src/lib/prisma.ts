import { IS_TEST_MODE } from "@/lib/testMode";
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Singleton — reuse across warm serverless invocations (dev AND prod)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Supabase pooler ใช้ cert ที่ Node ตรวจ chain ไม่ผ่าน จึงต้องข้ามการตรวจ cert
 * เดิมตั้ง NODE_TLS_REJECT_UNAUTHORIZED=0 ทั้ง process ซึ่งปิดการตรวจ cert ของ
 * ทุก HTTPS ที่ server เรียก (Google OAuth, Gmail, Chat) ด้วย → เปลี่ยนมาข้ามเฉพาะการเชื่อม DB
 *
 * ต้องตัด sslmode ออกจาก URL เพราะ node-postgres ให้ค่าใน URL ทับ option `ssl`
 * (ทางที่ดีกว่าในอนาคต: ใส่ CA ของ Supabase ใน `ssl.ca` แล้วเปิด rejectUnauthorized)
 */
function dbConnectionString(raw: string): string {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("sslrootcert");
    return url.toString();
  } catch {
    return raw;
  }
}

function isLocalDatabase(raw: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(raw).hostname);
  } catch {
    return false;
  }
}

function createPrismaClient() {
  const connectionString = dbConnectionString(process.env.SUPABASE_POSTGRES_PRISMA_URL ?? '');

  // Serverless-optimised pool: small size, short timeouts
  // pgbouncer handles real pooling; pg Pool is a thin layer here
  const pool = new Pool({
    connectionString,
    // Postgres ในเครื่อง/CI ไม่มี SSL; Supabase ต้องใช้ SSL
    ssl: isLocalDatabase(connectionString) ? false : { rejectUnauthorized: false },
    max: 3,                       // ไม่เกิน 3 connections ต่อ lambda instance
    idleTimeoutMillis: 10_000,    // ปิด idle connection เร็ว (10s)
    connectionTimeoutMillis: 5_000, // timeout ถ้า connect ไม่ได้ใน 5s
  });

  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  if (IS_TEST_MODE) {
    return new Proxy(client, {
      get(target, prop) {
        if (prop === 'project') {
          return new Proxy(target.project, {
            get(pTarget, pProp) {
              if (pProp === 'findMany') {
                return async () => [
                  { id: 'min-proj-1', project_code: 'MP-01', project_name: 'Minimal Project A', status: 'In Progress', department: 'dept-1', created_at: new Date() },
                  { id: 'proj-min-99', project_code: 'MP-99', project_name: 'Super Minimal Project', status: 'In Progress', department: 'dept-1', created_at: new Date() }
                ];
              }
              const val = pTarget[pProp as keyof typeof pTarget];
              return typeof val === 'function' ? val.bind(pTarget) : val;
            }
          });
        }
        if (prop === 'task') {
          return new Proxy(target.task, {
            get(tTarget, tProp) {
              if (tProp === 'findMany') {
                return async () => [
                  { id: 'min-task-1', project_id: 'min-proj-1', task_name: 'Minimal Task 1', status: 'Pending', created_at: new Date() },
                  { id: 'task-min-88', project_id: 'proj-min-99', task_name: 'Very Minimal Task Display', status: 'In Progress', created_at: new Date() }
                ];
              }
              if (tProp === 'update' || tProp === 'updateMany') {
                return async (args: any) => ({ id: args.where?.id || 'min-task-1', ...args.data });
              }
              if (tProp === 'findUnique' || tProp === 'findFirst') {
                return async (args: any) => ({ id: args.where?.id || 'min-task-1', project_id: 'min-proj-1', task_name: 'Minimal Task 1', status: 'Pending', created_at: new Date() });
              }
              const val = tTarget[tProp as keyof typeof tTarget];
              return typeof val === 'function' ? val.bind(tTarget) : val;
            }
          });
        }
        const val = target[prop as keyof typeof target];
        return typeof val === 'function' ? val.bind(target) : val;
      }
    });
  }

  return client;
}

// Reuse singleton in both dev and prod to avoid re-creating pool on every warm invocation
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
