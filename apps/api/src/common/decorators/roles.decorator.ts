import { SetMetadata } from "@nestjs/common";

import { Role } from "@travelghana/database";

export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const ANY_ROLES_KEY = "anyRoles";
/**
 * Any-of authorization: the user must hold AT LEAST ONE of the listed roles
 * (active membership). @Roles(...) above is all-of; use this for routes open
 * to several operator kinds, e.g. tour + hotel managers.
 */
export const AnyRole = (...roles: Role[]) => SetMetadata(ANY_ROLES_KEY, roles);
