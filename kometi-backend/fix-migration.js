const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Adding missing columns...');

  await prisma.$executeRawUnsafe(
    'ALTER TABLE "committee_months" ADD COLUMN IF NOT EXISTS "bidding_deadline" TIMESTAMP(3)'
  );
  console.log('bidding_deadline column added (or already exists)');

  await prisma.$disconnect();
  console.log('Migration complete');
}

main().catch(e => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
