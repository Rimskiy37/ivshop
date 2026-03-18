// api/_lib/auth.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
};

module.exports = { verifyToken };