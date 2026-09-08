// Mirrors src/config/roles.js on the backend - client-side role checks only ever drive UI
// visibility (which buttons render). The backend re-checks every mutating request independently
// (requireRole(isModOrAdmin)/(isAdmin) in src/routes/nodes.js) - this file grants no access.
import type { JwtPayload } from './jwt';

const ADMIN = 'ADMIN';
const MODERATOR = 'FORUM_MODERATOR';

export function isAdmin(user: JwtPayload | null): boolean {
  return !!user && Array.isArray(user.roles) && user.roles.includes(ADMIN);
}

export function isModerator(user: JwtPayload | null): boolean {
  return !!user && Array.isArray(user.roles) && user.roles.includes(MODERATOR);
}

export function canModerate(user: JwtPayload | null): boolean {
  return isAdmin(user) || isModerator(user);
}
