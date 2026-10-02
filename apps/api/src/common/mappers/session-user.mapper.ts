import type { Role, RoleMembership, User } from "@travelghana/database";
import type { SessionUser } from "@travelghana/types";

type UserWithMemberships = User & { memberships: RoleMembership[] };

export function toSessionUser(user: UserWithMemberships): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerifiedAt !== null,
    roles: user.memberships
      .filter((m) => m.status === "ACTIVE")
      .map((m) => m.role as Role),
  };
}
