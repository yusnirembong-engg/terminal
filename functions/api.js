const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Bot configuration management
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
  const route = event.path.replace('/api/', '');
  
  // Authentication middleware
  const authHeader = event.headers.authorization;
  let user = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Invalid token, continue without user
    }
  }
  
  // IP restriction
  const clientIP = event.headers['x-nf-client-connection-ip'];
  const allowedIPs = process.env.ALLOWED_IPS 
    ? process.env.ALLOWED_IPS.split(',') 
    : [];
  
  if (!allowedIPs.includes(clientIP) && 
      !allowedIPs.includes('*') && 
      process.env.NODE_ENV === 'production') {
    return {
      statusCode: 403,
      body: JSON.stringify({ 
        error: 'IP tidak diizinkan',
        yourIP: clientIP,
        allowedIPs: allowedIPs
      })
    };
  }
  
  // Route handlers
  switch (route) {
    case 'status':
      return handleStatus(event, user);
    
    case 'config':
      return handleConfig(event, user);
    
    case 'bot-control':
      return handleBotControl(event, user);
    
    case 'users':
      return handleUsers(event, user);
    
    default:
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Endpoint not found' })
      };
  }
};

async function handleStatus(event, user) {
  try {
    // Get system status
    const [uptime, disk, memory] = await Promise.all([
      execAsync('uptime'),
      execAsync('df -h'),
      execAsync('free -m')
    ]);
    
    // Get bot process status
    let botStatus = 'unknown';
    try {
      await execAsync('pgrep -f "bot.js|bot.py"');
      botStatus = 'running';
    } catch {
      botStatus = 'stopped';
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        system: {
          uptime: uptime.stdout.trim(),
          disk: disk.stdout,
          memory: memory.stdout,
          timestamp: new Date().toISOString()
        },
        bot: {
          status: botStatus,
          lastActive: new Date().toISOString()
        },
        user: user ? {
          username: user.username,
          permissions: user.permissions
        } : null
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

async function handleConfig(event, user) {
  if (!user || !user.permissions.includes('config_edit')) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  
  if (event.httpMethod === 'GET') {
    try {
      const configPath = path.join(process.cwd(), 'data', 'config.json');
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Mask sensitive data
      const safeConfig = { ...config };
      if (safeConfig.apiKeys) {
        safeConfig.apiKeys = Object.keys(safeConfig.apiKeys).reduce((acc, key) => {
          acc[key] = '***MASKED***';
          return acc;
        }, {});
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify(safeConfig)
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to read config' })
      };
    }
  }
  
  if (event.httpMethod === 'POST') {
    try {
      const updates = JSON.parse(event.body);
      const configPath = path.join(process.cwd(), 'data', 'config.json');
      
      let currentConfig = {};
      try {
        const currentData = await fs.readFile(configPath, 'utf8');
        currentConfig = JSON.parse(currentData);
      } catch (err) {
        // File doesn't exist, create new
      }
      
      // Merge updates
      const newConfig = { ...currentConfig, ...updates };
      
      await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));
      
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Config updated' })
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update config' })
      };
    }
  }
}

async function handleBotControl(event, user) {
  if (!user || !user.permissions.includes('bot_control')) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  
  const { action } = JSON.parse(event.body || '{}');
  
  const commands = {
    start: 'node bot.js > bot.log 2>&1 &',
    stop: 'pkill -f "node bot.js"',
    restart: 'pkill -f "node bot.js" && sleep 2 && node bot.js > bot.log 2>&1 &',
    logs: 'tail -n 100 bot.log',
    status: 'pgrep -f "node bot.js"'
  };
  
  if (!commands[action]) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid action' })
    };
  }
  
  try {
    const { stdout, stderr } = await execAsync(commands[action]);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        action,
        output: stdout || 'Command executed',
        error: stderr || null
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        action,
        error: error.message
      })
    };
  }
}
