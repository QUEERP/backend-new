const fs = require('fs');
const prisma = require('./src/config/prisma');
prisma.taxRule.findFirst({include:{taxRates:true}}).then(r=>fs.writeFileSync('dump.json', JSON.stringify(r,null,2))).finally(()=>process.exit());
