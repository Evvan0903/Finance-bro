export type {
  MarketDataProvider,
  MarketDataRequest,
  MarketEvidence,
  MarketSourceReference,
  ProviderResult,
} from "../types";

export type ProviderFactoryOptions = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
};
