import { loadEnv } from './env';

const validEnv = {
  NODE_ENV: 'production',
  PORT: '4000',
  WEB_ORIGIN: 'https://data-room.vercel.app',
  DATABASE_URL: 'postgresql://user:pw@db.example.com:6543/postgres?pgbouncer=true',
} satisfies NodeJS.ProcessEnv;

describe('loadEnv', () => {
  it('parses a valid environment', () => {
    expect(loadEnv(validEnv)).toEqual({
      nodeEnv: 'production',
      port: 4000,
      corsOrigins: ['https://data-room.vercel.app'],
      databaseUrl: validEnv.DATABASE_URL,
    });
  });

  it('falls back to development defaults', () => {
    const env = loadEnv({
      WEB_ORIGIN: 'http://localhost:3000',
      DATABASE_URL: validEnv.DATABASE_URL,
    });

    expect(env.nodeEnv).toBe('development');
    expect(env.port).toBe(3001);
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

  it('rejects a missing database url', () => {
    expect(() => loadEnv({ ...validEnv, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('rejects a database url that is not postgres', () => {
    expect(() => loadEnv({ ...validEnv, DATABASE_URL: 'mysql://user:pw@host/db' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
