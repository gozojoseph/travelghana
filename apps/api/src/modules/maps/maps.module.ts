import { DynamicModule, Module, Provider } from "@nestjs/common";

import { MapboxAdapter } from "./mapbox.adapter";
import { MapsAdapter } from "./maps-adapter.interface";
import { NullMapAdapter } from "./null-maps.adapter";

export const MAPS = Symbol("MAPS");

/**
 * Maps module (D4): Mapbox first, behind an adapter. When no token is
 * configured the NullMapAdapter answers gracefully so explore/degraded
 * UI works without map assets.
 */
@Module({})
export class MapsModule {
  static register(): DynamicModule {
    const token = process.env.MAPBOX_PUBLIC_TOKEN ?? "";
    const adapter: Provider = {
      provide: MAPS,
      useClass: token ? MapboxAdapter : NullMapAdapter,
    };
    return {
      module: MapsModule,
      providers: [adapter],
      exports: [MAPS],
      global: true,
    };
  }
}
