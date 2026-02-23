import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * security.ts captures `process.env.NODE_ENV` at module load time into a
 * module-level `const isDev`. To test both dev and production branches we
 * must reset the module registry, change the env, and re-import.
 */

describe('getSocketCorsConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns origin: true in development mode (NODE_ENV unset)', async () => {
    // Ensure NODE_ENV is NOT 'production' — isDev will be true
    const saved = process.env.NODE_ENV;
    delete process.env.NODE_ENV;

    const { getSocketCorsConfig } = await import('../src/security');
    const config = getSocketCorsConfig();

    expect(config.origin).toBe(true);
    expect(config.methods).toEqual(['GET', 'POST']);

    // Restore
    if (saved !== undefined) {
      process.env.NODE_ENV = saved;
    }
  });

  it('returns origin: true when NODE_ENV is "development"', async () => {
    const saved = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const { getSocketCorsConfig } = await import('../src/security');
    const config = getSocketCorsConfig();

    expect(config.origin).toBe(true);
    expect(config.methods).toEqual(['GET', 'POST']);

    // Restore
    if (saved !== undefined) {
      process.env.NODE_ENV = saved;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  it('returns origin: false when NODE_ENV is "production"', async () => {
    const saved = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const { getSocketCorsConfig } = await import('../src/security');
    const config = getSocketCorsConfig();

    expect(config.origin).toBe(false);
    expect(config.methods).toEqual(['GET', 'POST']);

    // Restore
    if (saved !== undefined) {
      process.env.NODE_ENV = saved;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  it('always includes GET and POST methods regardless of environment', async () => {
    const saved = process.env.NODE_ENV;

    // Dev
    delete process.env.NODE_ENV;
    vi.resetModules();
    const devModule = await import('../src/security');
    expect(devModule.getSocketCorsConfig().methods).toContain('GET');
    expect(devModule.getSocketCorsConfig().methods).toContain('POST');

    // Prod
    process.env.NODE_ENV = 'production';
    vi.resetModules();
    const prodModule = await import('../src/security');
    expect(prodModule.getSocketCorsConfig().methods).toContain('GET');
    expect(prodModule.getSocketCorsConfig().methods).toContain('POST');

    // Restore
    if (saved !== undefined) {
      process.env.NODE_ENV = saved;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  it('returns exactly two methods', async () => {
    const { getSocketCorsConfig } = await import('../src/security');
    const config = getSocketCorsConfig();
    expect(config.methods).toHaveLength(2);
  });
});
