import type { StringValue } from 'ms';

export type NodeEnv = 'development' | 'test' | 'production';

export interface EnvConfig {
  nodeEnv: NodeEnv;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  feUrl: string;
  accessTokenTtl: StringValue;
  refreshTokenTtl: StringValue;
  googleClientId?: string;
  googleClientSecret?: string;
  googleTicketSecret?: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_FE_URL = 'http://localhost:3000';
const DEFAULT_ACCESS_TOKEN_TTL: StringValue = '15m';
const DEFAULT_REFRESH_TOKEN_TTL: StringValue = '7d';

function parseNodeEnv(value: string | undefined): NodeEnv {
  return value === 'production' || value === 'test' ? value : 'development';
}

export function loadConfig(): EnvConfig {
  const missing: string[] = [];
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    missing.push('DATABASE_URL');
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    missing.push('JWT_SECRET');
  }

  const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
  const feUrl = process.env.FE_URL;
  if (nodeEnv === 'production' && !feUrl) {
    missing.push('FE_URL');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in the required values.',
    );
  }

  return {
    nodeEnv,
    port: Number(process.env.PORT) || DEFAULT_PORT,
    databaseUrl: databaseUrl as string,
    jwtSecret: jwtSecret as string,
    feUrl: feUrl || DEFAULT_FE_URL,
    accessTokenTtl:
      (process.env.ACCESS_TOKEN_TTL as StringValue | undefined) ||
      DEFAULT_ACCESS_TOKEN_TTL,
    refreshTokenTtl:
      (process.env.REFRESH_TOKEN_TTL as StringValue | undefined) ||
      DEFAULT_REFRESH_TOKEN_TTL,
    googleClientId: process.env.GOOGLE_CLIENT_ID || undefined,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
    googleTicketSecret: process.env.GOOGLE_TICKET_SECRET || undefined,
  };
}

let cached: EnvConfig | undefined;

export function getConfig(): EnvConfig {
  if (!cached) {
    cached = loadConfig();
  }
  return cached;
}
