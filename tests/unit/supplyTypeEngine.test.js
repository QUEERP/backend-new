const vectors = require('../fixtures/supply_type_vectors.json');
const { determineSupplyType } = require('../../src/services/tax/supplyTypeEngine');

function runVectorTests() {
  console.log(`\n======================================================`);
  console.log(` RUNNING STATUTORY SUPPLY-TYPE ENGINE TEST VECTORS (${vectors.length} cases)`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < vectors.length; i++) {
    const v = vectors[i];
    try {
      const result = determineSupplyType(v.seller, v.buyer, v.options);

      let mismatch = null;
      for (const [key, expectedVal] of Object.entries(v.expected)) {
        if (Array.isArray(expectedVal)) {
          if (!result[key] || result[key].length !== expectedVal.length || !expectedVal.every(x => result[key].includes(x))) {
            mismatch = `Key "${key}": expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(result[key])}`;
            break;
          }
        } else if (result[key] !== expectedVal) {
          mismatch = `Key "${key}": expected ${expectedVal}, got ${result[key]}`;
          break;
        }
      }

      if (mismatch) {
        console.error(`❌ TEST ${i + 1} FAILED: ${v.description}`);
        console.error(`   ${mismatch}`);
        failed++;
      } else {
        console.log(`✓ TEST ${i + 1} PASSED: ${v.description} -> ${result.supplyType}`);
        passed++;
      }
    } catch (err) {
      console.error(`❌ TEST ${i + 1} ERRORED: ${v.description}`);
      console.error(`   ${err.message}`);
      failed++;
    }
  }

  console.log(`\n======================================================`);
  console.log(` RESULTS: ${passed}/${vectors.length} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runVectorTests();
