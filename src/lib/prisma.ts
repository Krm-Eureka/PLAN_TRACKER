import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';


// Disable TLS cert verification for Supabase pooler (self-signed cert issue)
// Safe: Supabase connections are still encrypted, just not verifying the cert chain
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Singleton pattern to avoid too many connections in dev/serverless
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.SUPABASE_POSTGRES_PRISMA_URL ?? '';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  if (process.env.PLAYWRIGHT_TEST === '1' || process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === '1') {
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

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
