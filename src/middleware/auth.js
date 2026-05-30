import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'lawyer_app_jwt_secret_key_2026_secure';

export function authenticate(request, reply, done) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    request.user = decoded;
    done();
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (request, reply, done) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
    done();
  };
}
