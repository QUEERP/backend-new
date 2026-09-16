require('dotenv').config();
const { execSync } = require('child_process');
execSync(`npx prisma migrate diff --from-url "${process.env.DATABASE_URL}" --to-schema-datamodel prisma/schema.prisma --script > diff.sql`);
