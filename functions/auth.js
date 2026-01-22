const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ALLOWED_IPS = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim()) : ['127.0.0.1'];

// 🚨 FIX: Tambahkan IP Anda secara manual
if (!ALLOWED_IPS.includes('49.156.45.218')) {
    ALLOWED_IPS.push('49.156.45.218');
}
if (!ALLOWED_IPS.includes('::1')) {
    ALLOWED_IPS.push('::1'); // IPv6 localhost
}

// DEBUG: Log untuk troubleshooting
console.log('Environment ALLOWED_IPS:', process.env.ALLOWED_IPS);
console.log('Final ALLOWED_IPS:', ALLOWED_IPS);

// Mock user database
const USERS = {
    admin: {
        // Password: password123
        passwordHash: process.env.ADMIN_PASSWORD_HASH || '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        role: 'admin',
        permissions: ['terminal', 'bot_control', 'config', 'users', 'logs', 'monitoring']
    }
};

exports.handler = async (event, context) => {
    // Get client IP from Netlify headers
    const clientIP = event.headers['x-nf-client-connection-ip'] || 
                     event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     event.headers['client-ip'] || 
                     'unknown';
    
    console.log(`🔍 Auth request from IP: ${clientIP}`);
    console.log(`📋 Allowed IPs: ${ALLOWED_IPS.join(', ')}`);
    
    // Parse request
    let requestData;
    try {
        requestData = JSON.parse(event.body || '{}');
    } catch (error) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Invalid JSON' })
        };
    }
    
    // Route based on action
    if (requestData.action === 'check-ip') {
        const isAllowed = ALLOWED_IPS.includes(clientIP) || 
                         ALLOWED_IPS.includes('*') || 
                         ALLOWED_IPS.includes('0.0.0.0') ||
                         clientIP === '49.156.45.218'; // 🚨 Tambah check spesifik
        
        console.log(`✅ IP ${clientIP} allowed: ${isAllowed}`);
        console.log(`🔍 Checking if ${clientIP} is in:`, ALLOWED_IPS);
        console.log(`🔍 Client IP matches '49.156.45.218':`, clientIP === '49.156.45.218');
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                allowed: isAllowed,
                ip: clientIP,
                allowedIPs: ALLOWED_IPS,
                yourIP: '49.156.45.218',
                match: clientIP === '49.156.45.218'
            })
        };
    }
    
    // Login logic
    if (!requestData.username || !requestData.password) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Username and password required' })
        };
    }
    
    const user = USERS[requestData.username];
    if (!user) {
        return {
            statusCode: 401,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Invalid credentials' })
        };
    }
    
    // Verify password
    const passwordValid = await bcrypt.compare(requestData.password, user.passwordHash);
    if (!passwordValid) {
        return {
            statusCode: 401,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
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
    
    console.log(`✅ Login successful for user: ${requestData.username} from IP: ${clientIP}`);
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
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
