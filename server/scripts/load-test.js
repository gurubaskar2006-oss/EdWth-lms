/**
 * Lumina LMS V2 - Multi-Tier Concurrency Load Test Benchmark
 * 6th Civilians Corporation
 *
 * Benchmarks HTTP and Code Lab queue performance across concurrency tiers:
 * - Tier 1: 100 concurrent requests
 * - Tier 2: 250 concurrent requests
 * - Tier 3: 500 concurrent requests
 *
 * Usage:
 *   node server/scripts/load-test.js [baseUrl]
 *   node server/scripts/load-test.js http://localhost:5000
 */

const TARGET_URL = process.argv[2] || 'http://localhost:5000';

const runTier = async (concurrencyLevel, totalRequests) => {
  console.log(`\n======================================================`);
  console.log(`🚀 Benchmarking Tier: ${concurrencyLevel} Concurrent Users (${totalRequests} Requests)`);
  console.log(`🎯 Target: ${TARGET_URL}`);
  console.log(`======================================================`);

  const latencies = [];
  let successful = 0;
  let failed = 0;
  let rateLimited = 0;

  const startTime = Date.now();
  let completed = 0;

  const sendRequest = async (id) => {
    const reqStart = Date.now();
    try {
      // Alternate between health checks and code lab execution requests
      const isHealth = id % 3 !== 0;
      let url = `${TARGET_URL}/api/v1/health`;
      let options = { method: 'GET' };

      if (!isHealth) {
        url = `${TARGET_URL}/api/v1/execute`;
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: 'python',
            files: [{ name: 'main.py', content: `print("Benchmark test #${id}")` }],
            run_timeout: 3000
          })
        };
      }

      const res = await fetch(url, options);
      const reqDuration = Date.now() - reqStart;
      latencies.push(reqDuration);

      if (res.status === 200) {
        successful++;
      } else if (res.status === 429) {
        rateLimited++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
    } finally {
      completed++;
    }
  };

  // Run bounded worker pool
  const pool = Array.from({ length: concurrencyLevel });
  let nextIdx = 0;

  const worker = async () => {
    while (nextIdx < totalRequests) {
      const current = nextIdx++;
      await sendRequest(current);
    }
  };

  await Promise.all(pool.map(() => worker()));

  const totalTimeSec = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1));
  const rps = (totalRequests / totalTimeSec).toFixed(1);

  console.log(`\n📊 Benchmark Results:`);
  console.log(`   Total Completed: ${completed}/${totalRequests}`);
  console.log(`   Success (200 OK): ${successful}`);
  console.log(`   Rate Limited (429): ${rateLimited}`);
  console.log(`   Errors (5xx/Network): ${failed}`);
  console.log(`   Elapsed Time: ${totalTimeSec.toFixed(2)}s`);
  console.log(`   Throughput: ${rps} req/sec`);
  console.log(`   Latency: Avg=${avg}ms | p50=${p50}ms | p95=${p95}ms | p99=${p99}ms`);
};

const runSuite = async () => {
  console.log(`\nStarting Lumina LMS Concurrency Stress Suite on ${TARGET_URL}`);
  
  // Verify target is alive
  try {
    const ping = await fetch(`${TARGET_URL}/api/v1/health`);
    if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
    console.log('✅ Target server is online and responding.');
  } catch (err) {
    console.error(`❌ Cannot reach ${TARGET_URL}. Start server first (e.g. npm start).`);
    process.exit(1);
  }

  await runTier(100, 300);
  await runTier(250, 750);
  await runTier(500, 1500);

  console.log('\n🏁 Benchmark Suite Completed.');
};

runSuite();
