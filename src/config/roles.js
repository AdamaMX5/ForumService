// Forum-eigene Rollen werden im AuthService angelegt/mitgespeichert (siehe Spec Abschnitt 2),
// nicht lokal im Forum. ADMIN folgt der AuthService-Konvention (siehe AuthService.md /admin).
const ADMIN = 'ADMIN';
const MODERATOR = 'FORUM_MODERATOR';

function isAdmin(user) {
  return !!user && Array.isArray(user.roles) && user.roles.includes(ADMIN);
}

function isModerator(user) {
  return !!user && Array.isArray(user.roles) && user.roles.includes(MODERATOR);
}

function isModOrAdmin(user) {
  return isAdmin(user) || isModerator(user);
}

module.exports = { ADMIN, MODERATOR, isAdmin, isModerator, isModOrAdmin };
