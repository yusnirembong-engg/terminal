const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Pre-defined users (in production, use database)
const USERS = {
  [ADMIN_USER]: {
    passwordHash: ADMIN_PASSWORD_HASH,
    role: 'admin',
    permissions: ['terminal', 'bot_control', 'config_edit', 'user_management']
  }
};

exports.handler = async (event, context) => {
  // IP Whitelist check
  const clientIP = event.headers['x-nf-client-connection-ip'];
  const allowedIPs = process.env.ALLOWED_IPS 
    ? process.env.ALLOWED_IPS.split(',') 
    : [];
  
  if (!allowedIPs.includes(clientIP) && process.env.NODE_ENV === 'production') {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'IP not authorized' })
    };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const { username, password } = JSON.parse(event.body);
    
    const user = USERS[username];
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }
    
    // Generate JWT token
    const token = jwt.sign(
      {
        username,
        role: user.role,
        permissions: user.permissions,
        ip: clientIP
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        token,
        user: {
          username,
          role: user.role,
          permissions: user.permissions
        }
      })
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Authentication failed' })
    };
  }
};
