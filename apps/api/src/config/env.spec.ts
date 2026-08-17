import { loadEnv } from './env';

const validEnv = {
  NODE_ENV: 'production',
  PORT: '4000',
  WEB_ORIGIN: 'https://data-room.vercel.app',
} satisfies NodeJS.ProcessEnv;

describe('loadEnv', () => {
  it('parses a valid environment', () => {
    expect(loadEnv(validEnv)).toEqual({
      nodeEnv: 'production',
      port: 4000,
      corsOrigins: ['https://data-room.vercel.app'],
    });
  });

  it('falls back to development defaults', () => {
    expect(loadEnv({ WEB_ORIGIN: 'http://localhost:3000' })).toEqual({
      nodeEnv: 'development',
      port: 3001,
      corsOrigins: ['http://localhost:3000'],
    });
  });

  it('splits and trims a multi-origin allowlist', () => {
    const env = loadEnv({
      ...validEnv,
      WEB_ORIGIN: 'http://localhost:3000, https://data-room.vercel.app ',
    });

    expect(env.corsOrigins).toEqual(['http://localhost:3000', 'https://data-room.vercel.app']);
  });

  it('rejects a missing origin allowlist', () => {
    expect(() => loadEnv({ ...validEnv, WEB_ORIGIN: '' })).toThrow(/WEB_ORIGIN/);
  });

  it('rejects a wildcard origin, which cannot carry credentials', () => {
    expect(() => loadEnv({ ...validEnv, WEB_ORIGIN: '*' })).toThrow(/WEB_ORIGIN/);
  });

  it('rejects a malformed origin', () => {
    expect(() => loadEnv({ ...validEnv, WEB_ORIGIN: 'data-room.vercel.app' })).toThrow(
      /WEB_ORIGIN/,
    );
  });

  it('rejects a non-numeric port', () => {
    expect(() => loadEnv({ ...validEnv, PORT: 'eighty' })).toThrow(/PORT/);
  });
});
