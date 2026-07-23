import { Module } from '@nestjs/common';

@Module({
  providers: [
    // OpenAIProvider,
    // AnthropicProvider,
    // GeminiProvider,
    // GroqProvider,
    // CoinGeckoProvider,
    // CoinMarketCapProvider,
    // DefiLlamaProvider,
    // EtherscanProvider,
    // GitHubProvider,
    // RPCProvider,
  ],
  exports: [
    // Export providers when implemented
  ],
})
export class ProvidersModule {}
