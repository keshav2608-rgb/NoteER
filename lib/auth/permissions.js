import db from '../db/index.js';
import { signToken, verifyToken } from './session.js';

export function getUserRoleInNotebook(userId, notebookId) {
  if (!userId || !notebookId) return null;

  const res = db.get('SELECT owner_id, visibility, deleted_at FROM notebooks WHERE id = ?', [notebookId]);
  if (res instanceof Promise) {
    return (async () => {
      const notebook = await res;
      if (!notebook || notebook.deleted_at) return null;
      if (notebook.owner_id === userId) return 'owner';
      const member = await db.get('SELECT role FROM notebook_members WHERE notebook_id = ? AND user_id = ?', [notebookId, userId]);
      if (member) return member.role;
      if (notebook.visibility === 'shared') return 'viewer';
      return null;
    })();
  }

  const notebook = res;
  if (!notebook || notebook.deleted_at) return null;
  if (notebook.owner_id === userId) return 'owner';
  const member = db.get('SELECT role FROM notebook_members WHERE notebook_id = ? AND user_id = ?', [notebookId, userId]);
  if (member) return member.role;
  if (notebook.visibility === 'shared') return 'viewer';
  return null;
}

export function canViewNotebook(userId, notebookId) {
  const role = getUserRoleInNotebook(userId, notebookId);
  if (role instanceof Promise) return role.then((r) => Boolean(r));
  return Boolean(role);
}

export function canEditNotebook(userId, notebookId) {
  const role = getUserRoleInNotebook(userId, notebookId);
  if (role instanceof Promise) return role.then((r) => r === 'owner' || r === 'editor');
  return role === 'owner' || role === 'editor';
}

export function canManageMembers(userId, notebookId) {
  const role = getUserRoleInNotebook(userId, notebookId);
  if (role instanceof Promise) return role.then((r) => r === 'owner');
  return role === 'owner';
}

export function canDeleteNotebook(userId, notebookId) {
  const role = getUserRoleInNotebook(userId, notebookId);
  if (role instanceof Promise) return role.then((r) => r === 'owner');
  return role === 'owner';
}

// Generate short-lived (1 hour) collaboration token for WebSocket connection
export function generateCollabToken(user, notebookId, pageId) {
  const role = getUserRoleInNotebook(user.id, notebookId);
  if (role instanceof Promise) {
    return role.then((r) => {
      if (!r) return null;
      return signToken({
        sub: user.id,
        userId: user.id,
        name: user.name,
        avatar: user.avatar_url,
        notebookId,
        pageId,
        role: r,
        canEdit: r === 'owner' || r === 'editor'
      }, '1h');
    });
  }

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
