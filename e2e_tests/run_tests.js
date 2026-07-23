const runTier1 = require('./tier1_feature_coverage');
const runTier2 = require('./tier2_boundary_corner');
const runTier3 = require('./tier3_cross_feature');
const runTier4 = require('./tier4_real_world');
const { startMockServer, stopMockServer } = require('./utils/helpers');

async function main() {
  console.log('\n==================================================================');
  console.log('    PRODUCTION-GRADE AI TASK PROCESSING PLATFORM - E2E TEST SUITE  ');
  console.log('==================================================================\n');

  // Parse CLI args for --tier=X
  const args = process.argv.slice(2);
  let selectedTier = null;
  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      selectedTier = parseInt(arg.split('=')[1], 10);
    }
  }

  const port = 5050;
  const baseUrl = `http://localhost:${port}`;

  console.log(`Starting standalone mock server on port ${port}...`);
  await startMockServer(port);

  let totalExecuted = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  const allTiers = [
    { num: 1, name: 'Tier 1: Feature Coverage (30 Tests)', runner: runTier1 },
    { num: 2, name: 'Tier 2: Boundary & Corner Cases (25 Tests)', runner: runTier2 },
    { num: 3, name: 'Tier 3: Cross-Feature Combinations (5 Tests)', runner: runTier3 },
    { num: 4, name: 'Tier 4: Real-World Application Scenarios (3 Tests)', runner: runTier4 }
  ];

  const tiersToRun = selectedTier
    ? allTiers.filter(t => t.num === selectedTier)
    : allTiers;

  try {
    for (const tier of tiersToRun) {
      console.log(`---> Running ${tier.name}...`);
      const startTime = Date.now();
      let results = [];
      try {
        results = await tier.runner(baseUrl);
      } catch (err) {
        console.error(`  ✖ Tier execution fatal error: ${err.message}`);
      }
      const elapsed = Date.now() - startTime;

      let tierPassed = 0;
      let tierFailed = 0;
      for (const test of results) {
        if (test.passed) {
          tierPassed++;
          console.log(`  ✔ [PASS] ${test.name}`);
        } else {
          tierFailed++;
          console.log(`  ✖ [FAIL] ${test.name}: ${test.error || 'Failed'}`);
        }
      }
      totalExecuted += results.length;
      totalPassed += tierPassed;
      totalFailed += tierFailed;
      console.log(`   Summary: ${results.length} tests run, ${tierPassed} passed, ${tierFailed} failed (${elapsed}ms)\n`);
    }

    console.log('==================================================================');
    console.log(` TOTAL TEST RESULTS: ${totalPassed} / ${totalExecuted} PASSED (${totalExecuted > 0 ? Math.round((totalPassed / totalExecuted) * 100) : 0}%)`);
    console.log('==================================================================\n');

    if (totalFailed > 0 || totalExecuted === 0) {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  } finally {
    console.log('Stopping standalone mock server...');
    await stopMockServer();
  }
}

main().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
