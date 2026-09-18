import { detectHiringSourceType } from "./core";
import type { HiringSourceType, SourceAdapter } from "./types";

export class SourceAdapterRegistry<TInput, TOutput> {
  private readonly adapters: SourceAdapter<TInput, TOutput>[] = [];
  register(adapter: SourceAdapter<TInput, TOutput>) { this.adapters.push(adapter); return this; }
  registered() { return [...this.adapters]; }
  async select(input: TInput) {
    for (const adapter of this.adapters) if (await adapter.canHandle(input)) return adapter;
    return null;
  }
}

export function sourceTypeForCareerUrl(url: string): HiringSourceType { return detectHiringSourceType(url); }
