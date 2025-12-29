// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) return res.status(401).json({ message: 'No token' });

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = {
      _id: decoded._id,
      role: decoded.role,
      sacco: decoded.sacco || null  // MUST INCLUDE SACCO ID
    };
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};