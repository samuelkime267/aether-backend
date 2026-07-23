const { execSync } = require('child_process');

const resources = [
  'auth', 'users', 'ai', 'chats', 'conversations', 'prompts',
  'wallets', 'blockchains', 'portfolio', 'token-research', 'smart-contracts',
  'memory', 'rag', 'agents', 'notifications', 'analytics', 'admin', 'health'
];

for (const res of resources) {
  console.log(`Scaffolding ${res}...`);
  try {
    execSync(`npx @nestjs/cli g resource ${res} --no-spec --type rest`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Failed scaffolding ${res}`);
  }
}
