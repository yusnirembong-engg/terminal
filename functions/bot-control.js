const jwt = require('jsonwebtoken');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Mock bot configuration
let botConfig = {
    apiToken: '',
    adminIds: [],
    autoRestart: true,
    logLevel: 'info',
    status: 'stopped'
};

// Load config from file if exists
async function loadConfig() {
    try {
        const configPath = path.join('/tmp', 'bot-config.json');
        const data = await fs.readFile(configPath, 'utf8');
        botConfig = { ...botConfig, ...JSON.parse(data) };
    } catch (error) {
        // Config file doesn't exist yet
        console.log('No config file found, using defaults');
    }
}

// Save config to file
async function saveConfig() {
    try {
        const configPath = path.join('/tmp', 'bot-config.json');
        await fs.writeFile(configPath, JSON.stringify(botConfig, null, 2));
    } catch (error) {
        console.error('Failed to save config:', error);
    }
}

// Check bot status
async function checkBotStatus() {
    try {
        const { stdout } = await execAsync('ps aux | grep -E "[n]ode.*bot|[p]ython.*bot" | grep -v grep');
        return stdout.trim() ? 'running' : 'stopped';
    } catch (error) {
        return 'stopped';
    }
}

// Get system info
async function getSystemInfo() {
    try {
        const [uptime, memory] = await Promise.all([
            execAsync('uptime -p').catch(() => ({ stdout: 'unknown' })),
            execAsync('free -m | head -2 | tail -1').catch(() => ({ stdout: '0 0 0' }))
        ]);
        
        const memParts = memory.stdout.trim().split(/\s+/);
        const totalMem = parseInt(memParts[1]) || 0;
        const usedMem = parseInt(memParts[2]) || 0;
        const memPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;
        
        return {
            uptime: uptime.stdout.trim(),
            memory: `${memPercent}% (${usedMem}MB/${totalMem}MB)`,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            uptime: 'unknown',
            memory: 'unknown',
            timestamp: new Date().toISOString()
        };
    }
}

exports.handler = async (event, context) => {
    // Authentication
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Authentication required' })
        };
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Invalid token' })
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
    
    const { action } = requestData;
    
    // Load config
    await loadConfig();
    
    // Handle actions
    switch (action) {
        case 'status':
            const status = await checkBotStatus();
            const systemInfo = await getSystemInfo();
            botConfig.status = status;
            
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    status: status,
                    details: systemInfo,
                    config: {
                        autoRestart: botConfig.autoRestart,
                        logLevel: botConfig.logLevel
                    }
                })
            };
            
        case 'start':
            try {
                // Mock bot start - in reality, you'd start your bot process
                await execAsync('echo "Starting bot..."');
                botConfig.status = 'running';
                
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        success: true,
                        message: 'Bot started successfully'
                    })
                };
            } catch (error) {
                return {
                    statusCode: 500,
                    body: JSON.stringify({
                        success: false,
                        error: `Failed to start bot: ${error.message}`
                    })
                };
            }
            
        case 'stop':
            try {
                // Mock bot stop
                await execAsync('echo "Stopping bot..."');
                botConfig.status = 'stopped';
                
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        success: true,
                        message: 'Bot stopped successfully'
                    })
                };
            } catch (error) {
                return {
                    statusCode: 500,
                    body: JSON.stringify({
                        success: false,
                        error: `Failed to stop bot: ${error.message}`
                    })
                };
            }
            
        case 'restart':
            try {
                await execAsync('echo "Restarting bot..."');
                botConfig.status = 'running';
                
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        success: true,
                        message: 'Bot restarted successfully'
                    })
                };
            } catch (error) {
                return {
                    statusCode: 500,
                    body: JSON.stringify({
                        success: false,
                        error: `Failed to restart bot: ${error.message}`
                    })
                };
            }
            
        case 'logs':
            try {
                const lines = requestData.lines || 50;
                const { stdout } = await execAsync(`tail -n ${lines} /tmp/bot.log 2>/dev/null || echo "No log file found"`);
                
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        success: true,
                        logs: stdout
                    })
                };
            } catch (error) {
                return {
                    statusCode: 500,
                    body: JSON.stringify({
                        success: false,
                        error: `Failed to get logs: ${error.message}`
                    })
                };
            }
            
        case 'save-config':
            const newConfig = requestData.config;
            if (newConfig) {
                botConfig = { ...botConfig, ...newConfig };
                await saveConfig();
                
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        success: true,
                        message: 'Configuration saved successfully'
                    })
                };
            }
            break;
            
        case 'get-config':
            // Return masked config (hide sensitive data)
            const safeConfig = { ...botConfig };
            if (safeConfig.apiToken) {
                safeConfig.apiToken = '••••••••' + safeConfig.apiToken.slice(-4);
            }
            
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    config: safeConfig
                })
            };
            
        default:
            return {
                statusCode: 400,
                body: JSON.stringify({
                    success: false,
                    error: `Unknown action: ${action}`
                })
            };
    }
};
