import swc from "unplugin-swc";
import type { UserConfig } from "vitest/config";

/**
 * Shared Vitest transform for the API.
 *
 * NestJS resolves constructor dependencies through `emitDecoratorMetadata`
 * (`design:paramtypes`). Vite's default transformer is esbuild, which does NOT
 * support decorator metadata — so under Vitest, `@Injectable()` classes were
 * instantiated with `undefined` constructor arguments and every guarded
 * request failed with "Cannot read properties of undefined (reading
 * 'getAllAndOverride')" instead of the real 401/403.
 *
 * `nest build` uses tsc (see tsconfig.json), which does emit the metadata,
 * so production was correct and only the test harness was broken.
 *
 * SWC can emit it, so both the unit and integration configs route through it.
 * See ./.swcrc for the decorator settings.
 */
export const swcDecorators = {
  plugins: [
    swc.vite({
      module: { type: "es6" },
    }),
  ],
} satisfies Partial<UserConfig>;