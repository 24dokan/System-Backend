import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD');
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: { email: email.toLowerCase(), passwordHash: await argon2.hash(password), role: 'ADMIN' },
  });
  console.log(`Admin ready: ${email}`);
}

main().finally(() => prisma.$disconnect());

// ---- placeholder packages (Admin can edit all of this afterwards) ----
async function seedPackages() {
  const tiers = [
    { name: 'Silver', tagline: 'Ready your store', priceMinor: 129000, maxProducts: 100, maxMicroStores: 1, pickupFeeMinor: 700, displayOrder: 1 },
    { name: 'Gold', tagline: 'Set the goals', priceMinor: 329000, maxProducts: 1000, maxMicroStores: 1, displayOrder: 2 },
    { name: 'Platinum', tagline: 'Skyrocket your sales', priceMinor: 1000000, maxProducts: null, maxMicroStores: 3, isPopular: true, displayOrder: 3 },
    { name: 'Enterprise', tagline: 'Talk to us', priceMinor: null, maxProducts: null, maxMicroStores: 1, isContactUs: true, displayOrder: 4 },
  ];
  for (const t of tiers) {
    const maxSkus = t.maxProducts == null ? null : t.maxProducts * 10;
    await prisma.package.upsert({ where: { name: t.name }, update: {}, create: { ...t, maxSkus, currency: 'MYR', billingPeriod: 'YEARLY' } });
  }
  console.log('Packages ready');
}
seedPackages().finally(() => prisma.$disconnect());
