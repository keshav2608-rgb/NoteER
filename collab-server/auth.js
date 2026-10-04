import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-notebook-key-dev-38914820';

export function authenticateCollabToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    console.error('[Collab Auth] Invalid token:', err.message);
    return null;
  }
}
