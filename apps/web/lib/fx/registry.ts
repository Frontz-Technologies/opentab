import type { FxProvider } from "./provider";
import { FrankfurterProvider } from "./providers/frankfurter";

let cached: FxProvider | null = null;

/** Returns the active FX provider. v1 hard-codes Frankfurter. v2 will
 *  read the choice from settings / env (FX_PROVIDER). */
export function getActiveFxProvider(): FxProvider {
  if (!cached) cached = new FrankfurterProvider();
  return cached;
}

/** Test-only escape hatch — set a stub provider for unit tests. */
export function __setActiveFxProviderForTesting(p: FxProvider | null): void {
  cached = p;
}
