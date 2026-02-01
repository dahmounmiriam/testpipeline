import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('@vitejs/plugin-react', () => ({
  __esModule: true,
  default: vi.fn(() => ({ name: 'mock:react' })),
}));

let config;

describe('vite.config.js', () => {
  beforeAll(async () => {
    const mod = await import('../vite.config.js');
    config = mod.default;
  });

  it('should export a config object with server settings', () => {
    expect(config).toBeTruthy();
    expect(config).toHaveProperty('server');
    expect(config.server).toBeTruthy();
    expect(config.server.port).toBe(3000);
    expect(config.server.proxy).toBeDefined();
    expect(config.server.proxy['/api']).toBeDefined();
    const apiProxy = config.server.proxy['/api'];
    expect(apiProxy.target).toBe('http://localhost:8000');
    expect(apiProxy.changeOrigin).toBe(true);
  });

  it('should include a react plugin mock', () => {
    expect(config).toHaveProperty('plugins');
    expect(Array.isArray(config.plugins)).toBe(true);
    const hasMockReact = config.plugins.some((p) => p?.name === 'mock:react');
    expect(hasMockReact).toBe(true);
  });
});