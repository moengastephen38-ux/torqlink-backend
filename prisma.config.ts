 import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  
  // 1. Where Prisma CLI commands (like db push/migrate) look for the database URL
  datasource: {
    url: env('DATABASE_URL'),
  },

  // 2. Where migration file paths live (only takes path, seed, etc.)
  migrations: {
    path: 'prisma/migrations',
  },
});