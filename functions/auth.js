const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ALLOWED_IPS = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : ['127.0.0.1'];

// Mock user database (in production, use real database)
const USERS = {
    admin: {
        // Password: admin123
        passwordHash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        role: 'admin',
        permissions: ['terminal', 'bot_control', 'config', 'users', 'logs', 'monitoring']
    }
};

exports.handler = async (event, context) => {
    // Get client IP
    const clientIP = event.headers['x-nf-client-connection-ip'] || 
                     event.headers['client-ip'] || 
                     'unknown';
    
    console.log(`Auth request from IP: ${clientIP}`);
    
    // IP Whitelist check (only in production)
    if (process.env.NODE_ENV === 'production' && !ALLOWED_IPS.includes(clientIP)) {
        return {
            statusCode: 403,
            body: JSON.stringify({ 
                error: 'Access denied. IP not authorized.',
                yourIP: clientIP,
                allowedIPs: ALLOWED_IPS
            })
        };
    }
    
    // Parse request
    let requestData;
    try {
        requestData = JSON.parse(event.body || '{}');
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid JSON' })
        };
    }
    
    // Route based on action
    if (requestData.action === 'check-ip') {
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                allowed: ALLOWED_IPS.includes(clientIP) || ALLOWED_IPS.includes('*'),
                ip: clientIP
            })
        };
    }
    
    // Login
    if (!requestData.username || !requestData.password) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Username and password required' })
        };
    }
    
    const user = USERS[requestData.username];
    if (!user) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Invalid credentials' })
        };
    }
    
    // Verify password
    const passwordValid = await bcrypt.compare(requestData.password, user.passwordHash);
    if (!passwordValid) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Invalid credentials' })
        };
    }
    
    // Generate JWT token
    const token = jwt.sign(
        {
            username: requestData.username,
            role: user.role,
            permissions: user.permissions,
            ip: clientIP,
            exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60) // 8 hours
        },
        JWT_SECRET
    );
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            token,
            user: {
                username: requestData.username,
                role: user.role,
                permissions: user.permissions
            }
        })
    };
};
