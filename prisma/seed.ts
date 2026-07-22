import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Geographic Hierarchy (Kenya & Primary Counties)
  const kenya = await prisma.country.upsert({
    where: { code: 'KE' },
    update: {},
    create: {
      name: 'Kenya',
      code: 'KE',
      phoneCode: '+254',
      currency: 'KES',
    },
  });

  const counties = [
    { name: 'Mombasa', code: '001' },
    { name: 'Nairobi', code: '047' },
    { name: 'Nakuru', code: '032' },
    { name: 'Kisumu', code: '042' },
    { name: 'Uasin Gishu', code: '027' },
  ];

  for (const county of counties) {
    await prisma.county.upsert({
      where: { countryId_code: { countryId: kenya.id, code: county.code } },
      update: {},
      create: {
        name: county.name,
        code: county.code,
        countryId: kenya.id,
      },
    });
  }

  // 2. Seed Base System Roles
  const roles = [
    { name: 'SUPER_ADMIN', description: 'System Administrator' },
    { name: 'GARAGE_OWNER', description: 'Garage / Workshop Owner' },
    { name: 'MECHANIC', description: 'Independent or Station Mechanic' },
    { name: 'PARTS_SELLER', description: 'Auto Spare Parts Vendor' },
    { name: 'DRIVER', description: 'Vehicle Owner / Fleet Operator' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  // 3. Seed Core Vehicle Makes
  const makes = ['Mazda', 'Toyota', 'Subaru', 'Nissan', 'Honda', 'Isuzu', 'Mercedes-Benz', 'BMW'];

  for (const makeName of makes) {
    await prisma.vehicleMake.upsert({
      where: { name: makeName },
      update: {},
      create: { name: makeName },
    });
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });