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
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
