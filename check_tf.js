const prisma=require('./src/config/prisma'); 
async function f(){ 
  const tf=await prisma.taxFramework.findFirst(); 
  console.log(tf);
  const country = await prisma.country.findFirst({where: {id: tf.countryId}});
  console.log("Country for framework:", country);
  await prisma.$disconnect();
} 
f();
