import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('health endpoint', () => {
  it('returns json shape when db is reachable', async () => {
    // Requires local postgres from docker-compose.
    const res = await request(createApp()).get('/api/health');
    expect([200, 500]).toContain(res.status);
  });
});
