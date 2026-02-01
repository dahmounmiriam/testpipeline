import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '5m', target: 50 } // Baseline: 10 -> 50 users
      ],
      startTime: '0s',
      gracefulStop: '1m',
    },
    normal: {
      executor: 'ramping-vus',
      startVUs: 60,
      stages: [
        { duration: '10m', target: 200 } // Normal: 60 -> 200 users
      ],
      startTime: '6m',
      gracefulStop: '1m',
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 200,
      stages: [
        { duration: '15m', target: 600 } // Stress: up to 600 users
      ],
      startTime: '16m',
      gracefulStop: '1m',
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 250 },   // Spike: quick rise
        { duration: '2m', target: 1000 },  // Spike to 1000 users
        { duration: '3m', target: 1000 }
      ],
      startTime: '30m',
      gracefulStop: '2m',
    }
  },
  thresholds: {
    // Per-endpoint latency targets
    'http_req_duration{endpoint:/}': ['p95<500', 'p99<1000'],
    'http_req_duration{endpoint:/health}': ['p95<500', 'p99<1000'],
    'http_req_duration{endpoint:/api/generate-pipeline}': ['p95<500', 'p99<1000'],
    'http_req_duration{endpoint:/api/analyze-repository}': ['p95<500', 'p99<1000'],
    // Error rate targets
    'http_req_failed{endpoint:/}': ['rate<0.01'],
    'http_req_failed{endpoint:/health}': ['rate<0.01'],
    'http_req_failed{endpoint:/api/generate-pipeline}': ['rate<0.02'],
    'http_req_failed{endpoint:/api/analyze-repository}': ['rate<0.02'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export function setup() {
  // Optional setup: could obtain tokens or perform warm-up if needed
  return { baseURL: BASE_URL };
}

export default function (data) {
  const baseURL = data.baseURL;

  // 1) GET /
  let res = http.get(`${baseURL}/`, { tags: { endpoint: '/' } });
  check(res, { 'GET / status 200': (r) => r.status === 200 });

  // 2) GET /health
  res = http.get(`${baseURL}/health`, { tags: { endpoint: '/health' } });
  check(res, { 'GET /health status 200': (r) => r.status === 200 });

  // 3) POST /api/generate-pipeline
  const payload1 = JSON.stringify({
    repositoryUrl: 'https://github.com/example/repo',
    pipelineType: 'full',
    iterations: 20
  });
  res = http.post(`${baseURL}/api/generate-pipeline`, payload1, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: '/api/generate-pipeline' }
  });
  check(res, { 'POST /api/generate-pipeline status 200/201': (r) => r.status === 200 || r.status === 201 });

  // 4) POST /api/analyze-repository
  const payload2 = JSON.stringify({
    repositoryUrl: 'https://github.com/example/repo',
    analyzeDepth: 5
  });
  res = http.post(`${baseURL}/api/analyze-repository`, payload2, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: '/api/analyze-repository' }
  });
  check(res, { 'POST /api/analyze-repository status 200/201': (r) => r.status === 200 || r.status === 201 });

  // Optional heavier load for the repository analysis endpoint
  if (__ENV.EXTRA_LOAD === 'true') {
    const payload3 = JSON.stringify({
      repositoryUrl: 'https://github.com/other/repo',
      analyzeDepth: 8
    });
    res = http.post(`${baseURL}/api/analyze-repository`, payload3, {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: '/api/analyze-repository' }
    });
    check(res, { 'POST /api/analyze-repository extra': (r) => r.status === 200 || r.status === 201 });
  }

  // Brief think time to simulate real user pacing
  sleep(0.5);
}

export function teardown(_data) {
  // Cleanup if needed (none required for stateless API)
}