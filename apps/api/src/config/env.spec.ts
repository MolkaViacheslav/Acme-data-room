import { loadEnv } from './env';

const validEnv = {
  NODE_ENV: 'production',
  PORT: '4000',
  WEB_ORIGIN: 'https://data-room.vercel.app',
  DATABASE_URL: 'postgresql://user:pw@db.example.com:6543/postgres?pgbouncer=true',
  JWT_SECRET: 's'.repeat(48),
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_STORAGE_BUCKET: 'data-room-files',
} satisfies NodeJS.ProcessEnv;

describe('loadEnv', () => {
  it('parses a valid environment', () => {
    expect(loadEnv(validEnv)).toEqual({
      nodeEnv: 'production',
      port: 4000,
      corsOrigins: ['https://data-room.vercel.app'],
      databaseUrl: validEnv.DATABASE_URL,
      jwtSecret: validEnv.JWT_SECRET,
      jwtExpiresInSeconds: 7 * 24 * 60 * 60,
      supabaseUrl: validEnv.SUPABASE_URL,
      supabaseServiceRoleKey: validEnv.SUPABASE_SERVICE_ROLE_KEY,
      supabaseStorageBucket: validEnv.SUPABASE_STORAGE_BUCKET,
    });
  });

  it('falls back to development defaults', () => {
    const env = loadEnv({ ...validEnv, NODE_ENV: undefined, PORT: undefined });

    expect(env.nodeEnv).toBe('development');
    expect(env.port).toBe(3001);
  });

  it.each(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET'])(
    'rejects a missing %s',
    (variable) => {
      expect(() => loadEnv({ ...validEnv, [variable]: '' })).toThrow(new RegExp(variable));
    },
  );

  it('rejects a Supabase URL that is not a URL', () => {
    expect(() => loadEnv({ ...validEnv, SUPABASE_URL: 'project.supabase.co' })).toThrow(
      /SUPABASE_URL/,
    );
  });

  it('strips a trailing slash from the Supabase URL', () => {
    expect(loadEnv({ ...validEnv, SUPABASE_URL: 'https://project.supabase.co/' }).supabaseUrl).toBe(
      'https://project.supabase.co',
    );
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

  it('rejects a missing jwt secret', () => {
    expect(() => loadEnv({ ...validEnv, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
  });

  it('rejects a jwt secret short enough to brute force', () => {
    expect(() => loadEnv({ ...validEnv, JWT_SECRET: 'secret' })).toThrow(/JWT_SECRET/);
  });

  it('accepts an explicit token lifetime', () => {
    expect(loadEnv({ ...validEnv, JWT_EXPIRES_IN_SECONDS: '3600' }).jwtExpiresInSeconds).toBe(3600);
  });

  it('rejects a non-numeric token lifetime', () => {
    expect(() => loadEnv({ ...validEnv, JWT_EXPIRES_IN_SECONDS: 'a week' })).toThrow(
      /JWT_EXPIRES_IN_SECONDS/,
    );
  });
});
