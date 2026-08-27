import { apsProvider } from './apsProvider';
import { waveProvider } from './waveProvider';
import { PaymentProvider, ProviderHealth, ProviderId } from './types';

export * from './types';
export { outcomeFromStatuses } from './waveProvider';

const REGISTRY: Record<ProviderId, PaymentProvider> = {
  wave: waveProvider,
  aps: apsProvider
};

export function getProvider(id: ProviderId): PaymentProvider {
  const provider = REGISTRY[id];
  if (!provider) throw Object.assign(new Error(`Unknown payment provider: ${id}`), { status: 400 });
  return provider;
}

export function providerHealth(id: ProviderId): ProviderHealth {
  return getProvider(id).health();
}

export function allProviderHealth(): Record<ProviderId, ProviderHealth> {
  return { wave: waveProvider.health(), aps: apsProvider.health() };
}
