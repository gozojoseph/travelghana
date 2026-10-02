import { Injectable } from "@nestjs/common";

import { MapsAdapter, StaticMapOptions } from "./maps-adapter.interface";

/** Answers "unavailable" so routes degrade gracefully without a token. */
@Injectable()
export class NullMapAdapter implements MapsAdapter {
  readonly isConfigured = false;
  staticMap(_options: StaticMapOptions): string | null {
    return null;
  }
}
