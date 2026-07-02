 import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL as string;

// Initialize the native PostgreSQL connection pool socket
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Instantiate the Client runtime using the driver adapter
const prisma = new PrismaClient({
  adapter, // The adapter handles the connection payload natively now!
});

export default prisma;