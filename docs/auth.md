# Authentication

Aether AI uses two authentication methods:

- **Wallet (SIWE / EIP-4361)** — "Sign in with Ethereum" message signing.
- **Email + password** — bcrypt-hashed credentials.

Both flows issue a short-lived **access token** (JWT, default `15m`, sent in the
response body) and a longer-lived **refresh token** (JWT, default `7d`, stored in
an `httpOnly` cookie). The refresh token is rotated on every refresh and revoked
on logout.

Every auth response includes an `authType` field that tells the client which
authentication method the session uses — nothing is assumed:

| `authType`   | Meaning                                                       |
| ------------ | ------------------------------------------------------------- |
| `WALLET`     | Session was created via SIWE (`/auth/verify`).                |
| `CREDENTIALS`| Session was created via email/password (`/auth/register` or `/auth/login`). |

It is returned by `/auth/verify`, `/auth/register`, `/auth/login`, `/auth/refresh`
and `/auth/me`, and is carried in the access token payload.

## Environment variables

| Variable          | Default  | Description                                              |
| ----------------- | -------- | -------------------------------------------------------- |
| `JWT_SECRET`      | dev fallback in `src/auth/auth.constants.ts` | Secret used to sign JWTs. **Must be set in production.** |
| `ACCESS_TOKEN_TTL`| `15m`    | Access token lifetime (`ms` string).                     |
| `REFRESH_TOKEN_TTL`| `7d`    | Refresh token lifetime (`ms` string).                    |
| `FE_URL`          | `http://localhost:3000` | Frontend origin. Used as the SIWE `uri`/`domain` when no `Origin` header is present and for CORS. |
| `PORT`            | `3000`   | HTTP port (main.ts).                                     |

## Refresh cookie

- Name: `aether_refresh`
- `HttpOnly`, `SameSite=Strict`, `Path=/auth` (only sent to `/auth/*` routes), `Secure` when `NODE_ENV=production`.
- Expiry matches `REFRESH_TOKEN_TTL`.
- Stored at rest as a SHA-256 hash of the token (`Session.refreshTokenHash`).

## Endpoints

All responses are wrapped by the global interceptor: `{ "statusCode": 200, "data": { ... } }`.

### POST /auth/nonce
Request a fresh SIWE nonce and the message the wallet must sign.

```jsonc
// request body
{
  "address": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  "uri": "http://localhost:3000"
}
```

```jsonc
// 201 response -> data
{
  "nonce": "64-hex-char-random",
  "message": "localhost wants you to sign in with your Ethereum account:\n0x8ba1...\n\nSign in to Aether AI\n\nURI: http://localhost:3000\nVersion: 1\nChain ID: 1\nNonce: ...\nIssued At: 2026-07-31T12:00:00.000Z",
  "expiresAt": "2026-07-31T12:05:00.000Z"
}
```

Nonces are single-use and expire after 5 minutes. The `domain`/`chainId` in the
message are derived server-side from the request `Origin` header (falling back to
`FE_URL`); never trust a client-supplied domain.

### POST /auth/verify
Verify the SIWE signature and create or log in the wallet user. Optionally
provisions profile fields on first sign-in (`email`, `username`, `firstName`,
`lastName`). Sets the refresh cookie.

```jsonc
{
  "address": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  "nonce": "…from /auth/nonce…",
  "signature": "0x…65-byte hex…",
  "email": "user@example.com",   // optional, 409 if already taken
  "username": "alice",           // optional, 409 if already taken
  "firstName": "Alice",          // optional
  "lastName": "Example"          // optional
}
```

```jsonc
// 201 response -> data
{
  "accessToken": "eyJhbGciOi…",
  "authType": "WALLET",
  "user": {
    "id": "…uuid…",
    "address": "0x8ba1…",
    "email": "user@example.com",
    "username": "alice",
    "firstName": "Alice",
    "lastName": "Example",
    "role": "USER",
    "tier": "FREE",
    "createdAt": "2026-07-31T12:00:00.000Z"
  }
}
```

This is also how an **existing** wallet user logs back in: repeat
`nonce` → `verify`, matched by `address`. Wallet accounts have no password, so
`/auth/login` always returns `401` for them (`passwordHash` is null).

### POST /auth/register
Create an email/password account. Sets the refresh cookie.

```jsonc
{
  "email": "user@example.com",
  "password": "hunter2hunter2",
  "username": "alice",     // optional
  "firstName": "Alice",    // optional
  "lastName": "Example"    // optional
}
```

- `409 Conflict` if the email or username is already registered.
- Password must be 8–72 characters.

### POST /auth/login
```jsonc
{ "email": "user@example.com", "password": "hunter2hunter2" }
```
- `200` — `data` = `{ accessToken, authType: "CREDENTIALS", user }`, refresh cookie set.
- `401` — invalid credentials, or the account has no password (wallet-created accounts).

### POST /auth/refresh
Requires the `aether_refresh` cookie. Rotates the refresh token and returns a new
access token. The request body is optional:

```jsonc
// plain refresh (any valid session)
// no body

// silent wallet re-auth (WALLET sessions only)
{ "address": "0x8ba1f109551bD432803012645Ac136ddd64DBA72" }
```

- **No body** — works for any valid `WALLET` or `CREDENTIALS` session.
- **With `address`** — for wallet users re-opening the app: the connected wallet
  address is checked against the session's user. On match the session is rotated
  and a fresh access token is issued **without requiring a new SIWE signature**.
  This avoids re-signing on every page load.
- `401` — cookie missing/expired/revoked/hash mismatch; or the `address` does not
  match the session's wallet; or the session is `CREDENTIALS` (email/password
  users don't use wallet auth — fall back to `/auth/nonce` → `/auth/verify` for a
  full wallet sign-in, or the plain refresh above).
- `400` — `address` is present but not a valid Ethereum address.

```jsonc
// 200 response -> data
{
  "accessToken": "…",
  "authType": "WALLET",
  "user": { … }
}
```

### POST /auth/logout
Requires the `aether_refresh` cookie. Revokes the session and clears the cookie.
```
// 200 response -> data
{ "message": "Logged out" }
```

### GET /auth/me
Requires `Authorization: Bearer <accessToken>`.

```jsonc
// 200 response -> data
{
  "user": {
    "id": "…",
    "address": "0x…",
    "email": "user@example.com",
    "username": "alice",
    "firstName": null,
    "lastName": null,
    "role": "USER",
    "tier": "FREE",
    "createdAt": "2026-07-31T12:00:00.000Z"
  },
  "authType": "CREDENTIALS"
}
```
- `401` if the token is missing/expired/invalid.

## Rate limiting

Public endpoints are rate-limited per IP using `@nestjs/throttler`:

| Endpoint            | Limit | Window |
| ------------------- | ----- | ------ |
| `/auth/nonce`       | 20    | 1 min  |
| `/auth/verify`      | 10    | 1 min  |
| `/auth/register`    | 5     | 1 min  |
| `/auth/login`       | 10    | 1 min  |
| `/auth/refresh`     | 30    | 1 min  |
| `/auth/logout`      | 30    | 1 min  |

## Security notes

- Refresh tokens are hashed (SHA-256) at rest and rotated on each refresh; an
  old token cannot be reused after rotation.
- A `Nonce` (issued challenge) is single-use: replaying a nonce returns `401`.
- The SIWE signature is verified server-side with viem (`verifyMessage`,
  EIP-191 over the stored message string).
- `passwordHash` is never returned; `SafeUser` strips it from all responses.
- Sessions are revocable (`Session.revokedAt`); see the `Session` model.
- A session records its origin (`Session.authType`); `WALLET` sessions can use the
  address-checked silent refresh, `CREDENTIALS` sessions cannot.
- The address-checked refresh relies on the refresh cookie as the credential and
  the supplied address matching the session's user — it does **not** verify a
  fresh wallet signature. Re-signing is only required when the session is gone.
