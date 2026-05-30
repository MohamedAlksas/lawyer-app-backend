import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'lawyer_app_jwt_secret_key_2026_secure';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'lawyer_app_refresh_secret_key_2026_secure';

export function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}
