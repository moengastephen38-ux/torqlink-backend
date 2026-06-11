import { PrismaClient } from '@prisma/client';
/**
 * We attach Prisma to the 'global' object in development to prevent
 * exhausting our database connection limit during hot-reloads.
 */
const globalForPrisma = global;
export const prisma = globalForPrisma.prisma ||
    new PrismaClient({
        log: ['query'], // This helps you see the actual SQL in your terminal
    });
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = prisma;
//# sourceMappingURL=db.js.map