import type { Role } from "@prisma/client";

export const ROLES_THAT_CAN_MUTATE: ReadonlyArray<Role> = [
  "OWNER",
  "ADMIN",
  "OPERATOR",
];

export const ROLES_THAT_CAN_ADMINISTER: ReadonlyArray<Role> = ["OWNER", "ADMIN"];

export function canMutate(role: Role): boolean {
  return ROLES_THAT_CAN_MUTATE.includes(role);
}

export function canAdminister(role: Role): boolean {
  return ROLES_THAT_CAN_ADMINISTER.includes(role);
}

export class RoleNotPermittedError extends Error {
  constructor(role: Role, action: string) {
    super(`Role ${role} is not permitted to ${action}`);
    this.name = "RoleNotPermittedError";
  }
}

// Throws if the user's role can't perform write operations on master data
// or transactions. Use in server actions.
export function assertCanMutate(role: Role, action = "mutate data"): void {
  if (!canMutate(role)) {
    throw new RoleNotPermittedError(role, action);
  }
}

// Throws if the user's role can't perform administrative changes (org
// settings, doc-number config, etc.).
export function assertCanAdminister(role: Role, action = "administer"): void {
  if (!canAdminister(role)) {
    throw new RoleNotPermittedError(role, action);
  }
}
