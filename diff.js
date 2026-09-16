require('dotenv').config();
const { execSync } = require('child_process');
try {
  const result = execSync(`npx prisma migrate diff --from-url "${process.env.DATABASE_URL}" --to-schema-datamodel prisma/schema.prisma --script`);
  console.log(result.toString());
} catch (e) {
  console.error(e.stdout.toString());
  console.error(e.stderr.toString());
}
