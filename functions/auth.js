const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-debug';
const ALLOWED_IPS = ['49.156.45.218', '127.0.0.1', '::1'];

// Tambahkan validasi JWT_SECRET
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET not found in environment variables');
  console.error('💡 Set JWT_SECRET in Netlify dashboard:');
  console.error('💡 Site settings → Environment variables → Add JWT_SECRET');
}

console.log('🔧 Auth function loaded - HARDCODE VERSION');
console.log('✅ JWT Secret present:', !!JWT_SECRET);
console.log('✅ Allowed IPs:', ALLOWED_IPS);

// 🚨 HARDCODE USER DATABASE
const USERS = {
    admin: {
        // 🎯 PASTI WORK - Simple password check
        password: 'admin123', // Password hardcode
        role: 'admin',
        permissions: ['terminal', 'bot_control', 'telegram', 'config', 'users', 'logs', 'monitoring']
    }
};

exports.handler = async (event, context) => {
    // Validasi JWT_SECRET sebelum melanjutkan
    if (!JWT_SECRET) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: 'Server misconfiguration',
                message: 'JWT_SECRET not set. Please configure in Netlify dashboard.',
                hint: 'Go to Site settings → Environment variables → Add JWT_SECRET variable'
            })
        };
    }
    
    console.log('📥 Auth request received');
    
    // Get client IP
    const clientIP = event.headers['x-nf-client-connection-ip'] || 
                     event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     event.headers['client-ip'] || 
                     'unknown';
    
    console.log(`🌐 Client IP: ${clientIP}`);
    
    // Parse request
    let requestData;
    try {
        requestData = JSON.parse(event.body || '{}');
        console.log('📋 Login attempt for:', requestData.username);
    } catch (error) {
        console.error('❌ JSON parse error:', error);
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Invalid JSON' })
        };
    }
    
    // Route based on action
    if (requestData.action === 'check-ip') {
        console.log(`🔐 IP Check for: ${clientIP}`);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                allowed: true, // 🚨 SELALU ALLOW
                ip: clientIP,
                allowedIPs: ALLOWED_IPS
            })
        };
    }
    
    // Login logic
    if (!requestData.username || !requestData.password) {
        console.log('❌ Missing username or password');
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Username and password required' })
        };
    }
    
    const user = USERS[requestData.username];
    if (!user) {
        console.log(`❌ User not found: ${requestData.username}`);
        return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: 'Invalid credentials',
                hint: 'Try username: admin, password: admin123'
            })
        };
    }
    
    // 🚨 SIMPLE PASSWORD CHECK - NO BCRYPT
    console.log(`🔑 Checking password: input="${requestData.password}", expected="${user.password}"`);
    
    if (requestData.password !== user.password) {
        console.log('❌ Password mismatch');
        return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: 'Invalid credentials',
                hint: `Password should be: ${user.password}`
            })
        };
    }
    
    console.log(`✅ Login successful for: ${requestData.username}`);
    
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            success: true,
            token: token,
            user: {
                username: requestData.username,
                role: user.role,
                permissions: user.permissions
            }
        })
    };
};
