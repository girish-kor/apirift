'use strict';

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * latencyStats — compute min/max/mean/p50/p90/p99 from a latency array.
 */
function latencyStats(values) {
  if (!values.length) return {};
  const sorted = [...values].sort((a, b) => a - b);
  const sum    = sorted.reduce((a, b) => a + b, 0);
  return {
    min:  sorted[0],
    max:  sorted[sorted.length - 1],
    mean: Math.round(sum / sorted.length),
    p50:  percentile(sorted, 50),
    p90:  percentile(sorted, 90),
    p99:  percentile(sorted, 99)
  };
}

module.exports = { percentile, latencyStats };
