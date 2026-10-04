import db from '../db/index.js';
import { signToken, verifyToken } from './session.js';

export function getUserRoleInNotebook(userId, notebookId) {
  if (!userId || !notebookId) return null;

  // Check if owner
  const notebook = db.get('SELECT owner_id, visibility, deleted_at FROM notebooks WHERE id = ?', [notebookId]);
  if (!notebook || notebook.deleted_at) return null;

  if (notebook.owner_id === userId) {
    return 'owner';
  }

  // Check explicit membership
  const member = db.get('SELECT role FROM notebook_members WHERE notebook_id = ? AND user_id = ?', [notebookId, userId]);
  if (member) {
    return member.role;
  }

  // If public/shared notebook and no specific membership, default to viewer if visibility allows
  if (notebook.visibility === 'shared') {
    return 'viewer';
  }

  return null;
}

export function canViewNotebook(userId, notebookId) {
  const role = getUserRoleInNotebook(userId, notebookId);
  return Boolean(role);
}

export function canEditNotebook(userId, notebookId) {
  const role = getUserRoleInNotebook(userId, notebookId);
  return role === 'owner' || role === 'editor';
}

export function canManageMembers(userId, notebookId) {
  const role = getUserRoleInNotebook(userId, notebookId);
  return role === 'owner';
}

export function canDeleteNotebook(userId, notebookId) {
  const role = getUserRoleInNotebook(userId, notebookId);
  return role === 'owner';
}

// Generate short-lived (1 hour) collaboration token for WebSocket connection
export function generateCollabToken(user, notebookId, pageId) {
  const role = getUserRoleInNotebook(user.id, notebookId);
  if (!role) return null;

  return signToken({
    sub: user.id,
    userId: user.id,
    name: user.name,
    avatar: user.avatar_url,
    notebookId,
    pageId,
    role,
    canEdit: role === 'owner' || role === 'editor'
  }, '1h');
}

export function verifyCollabToken(token) {
  return verifyToken(token);
}
