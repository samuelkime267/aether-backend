const { Client } = require('pg');
const { createHmac, randomUUID } = require('node:crypto');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const id = randomUUID();
  const email = 'google-lab-' + Date.now() + '@example.com';
  const googleId = 'google-lab-' + Date.now();
  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO "User" (id, email, "googleId", "createdAt", "updatedAt", role, tier)
     VALUES ($1, $2, $3, $4, $4, 'USER', 'FREE')`,
    [id, email, googleId, now],
  );
  console.log('USER_ID=' + id);
  console.log('EMAIL=' + email);

  const secret = process.env.GOOGLE_TICKET_SECRET;
  const ts = Date.now();
  const payload = {
    sub: id,
    purpose: 'google-login',
    iat: ts,
    exp: ts + 120000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  console.log('TICKET=' + body + '.' + sig);
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
