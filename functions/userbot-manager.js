const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// User bot configurations
const userBots = {};

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
    let user;
    
    try {
        user = jwt.verify(token, JWT_SECRET);
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
    const userId = user.username;
    
    // Initialize user's bot storage
    if (!userBots[userId]) {
        userBots[userId] = {
            bots: {},
            autoTextJobs: {},
            messageHistory: [],
            connectedChats: []
        };
    }
    
    // Route handlers
    switch (action) {
        case 'create-bot':
            return await handleCreateBot(requestData, userId);
        
        case 'list-bots':
            return await handleListBots(userId);
        
        case 'start-bot':
            return await handleStartBot(requestData, userId);
        
        case 'stop-bot':
            return await handleStopBot(requestData, userId);
        
        case 'bot-status':
            return await handleBotStatus(requestData, userId);
        
        case 'create-auto-text':
            return await handleCreateAutoText(requestData, userId);
        
        case 'list-auto-texts':
            return await handleListAutoTexts(userId);
        
        case 'stop-auto-text':
            return await handleStopAutoText(requestData, userId);
        
        case 'get-message-history':
            return await handleGetMessageHistory(requestData, userId);
        
        case 'get-connected-chats':
            return await handleGetConnectedChats(userId);
        
        default:
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Unknown action' })
            };
    }
};

async function handleCreateBot(data, userId) {
    const { botName, apiId, apiHash, phoneNumber } = data;
    
    if (!botName || !apiId || !apiHash || !phoneNumber) {
        return {
            statusCode: 400,
            body: JSON.stringify({ 
                error: 'Bot name, API ID, API Hash, and Phone Number are required' 
            })
        };
    }
    
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    userBots[userId].bots[botId] = {
        id: botId,
        name: botName,
        apiId,
        apiHash,
        phoneNumber,
        status: 'created',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        messagesSent: 0,
        autoTextJobs: []
    };
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            botId,
            message: 'User bot created successfully. Please verify the phone number.',
            verificationRequired: true
        })
    };
}

async function handleListBots(userId) {
    const bots = Object.values(userBots[userId].bots).map(bot => ({
        id: bot.id,
        name: bot.name,
        status: bot.status,
        createdAt: bot.createdAt,
        lastActivity: bot.lastActivity,
        messagesSent: bot.messagesSent,
        hasActiveJobs: bot.autoTextJobs.length > 0
    }));
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            bots,
            total: bots.length
        })
    };
}

async function handleStartBot(data, userId) {
    const { botId, verificationCode } = data;
    
    if (!botId || !userBots[userId].bots[botId]) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Bot not found' })
        };
    }
    
    const bot = userBots[userId].bots[botId];
    
    // Mock verification
    if (verificationCode === '12345' || verificationCode === '00000') {
        bot.status = 'connected';
        bot.connectedAt = new Date().toISOString();
        bot.lastActivity = new Date().toISOString();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Bot connected successfully!',
                bot: {
                    id: bot.id,
                    name: bot.name,
                    status: bot.status,
                    connectedAt: bot.connectedAt
                }
            })
        };
    } else {
        return {
            statusCode: 401,
            body: JSON.stringify({
                error: 'Invalid verification code',
                hint: 'Try 12345 for testing'
            })
        };
    }
}

async function handleStopBot(data, userId) {
    const { botId } = data;
    
    if (!botId || !userBots[userId].bots[botId]) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Bot not found' })
        };
    }
    
    userBots[userId].bots[botId].status = 'stopped';
    userBots[userId].bots[botId].stoppedAt = new Date().toISOString();
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            message: 'Bot stopped successfully'
        })
    };
}

async function handleBotStatus(data, userId) {
    const { botId } = data;
    
    if (!botId || !userBots[userId].bots[botId]) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Bot not found' })
        };
    }
    
    const bot = userBots[userId].bots[botId];
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            bot: {
                id: bot.id,
                name: bot.name,
                status: bot.status,
                createdAt: bot.createdAt,
                connectedAt: bot.connectedAt,
                lastActivity: bot.lastActivity,
                messagesSent: bot.messagesSent,
                autoTextJobs: bot.autoTextJobs.length
            }
        })
    };
}

async function handleCreateAutoText(data, userId) {
    const { botId, targets, message, interval, repeatCount, startNow } = data;
    
    if (!botId || !targets || !message) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Bot ID, targets, and message are required' })
        };
    }
    
    if (!userBots[userId].bots[botId]) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Bot not found' })
        };
    }
    
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const autoTextJob = {
        id: jobId,
        botId,
        targets: Array.isArray(targets) ? targets : [targets],
        message,
        interval: interval || 60, // seconds
        repeatCount: repeatCount || 1,
        status: startNow ? 'running' : 'paused',
        createdAt: new Date().toISOString(),
        lastRun: startNow ? new Date().toISOString() : null,
        messagesSent: 0,
        nextRun: startNow ? new Date(Date.now() + (interval || 60) * 1000).toISOString() : null
    };
    
    // Store job
    userBots[userId].autoTextJobs[jobId] = autoTextJob;
    userBots[userId].bots[botId].autoTextJobs.push(jobId);
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            jobId,
            message: 'Auto-text job created successfully',
            job: autoTextJob
        })
    };
}

async function handleListAutoTexts(userId) {
    const jobs = Object.values(userBots[userId].autoTextJobs);
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            jobs,
            total: jobs.length,
            running: jobs.filter(j => j.status === 'running').length,
            paused: jobs.filter(j => j.status === 'paused').length
        })
    };
}

async function handleStopAutoText(data, userId) {
    const { jobId } = data;
    
    if (!jobId || !userBots[userId].autoTextJobs[jobId]) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Job not found' })
        };
    }
    
    userBots[userId].autoTextJobs[jobId].status = 'stopped';
    userBots[userId].autoTextJobs[jobId].stoppedAt = new Date().toISOString();
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            message: 'Auto-text job stopped successfully'
        })
    };
}

async function handleGetMessageHistory(data, userId) {
    const { limit = 50, botId } = data;
    
    let messages = userBots[userId].messageHistory || [];
    
    if (botId) {
        messages = messages.filter(msg => msg.botId === botId);
    }
    
    // Sort by date, newest first
    messages.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            messages: messages.slice(0, limit),
            total: messages.length,
            totalSent: messages.filter(m => m.status === 'sent').length
        })
    };
}

async function handleGetConnectedChats(userId) {
    const chats = userBots[userId].connectedChats || [];
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            chats,
            total: chats.length,
            groups: chats.filter(c => c.type === 'group').length,
            users: chats.filter(c => c.type === 'private').length,
            channels: chats.filter(c => c.type === 'channel').length
        })
    };
}
