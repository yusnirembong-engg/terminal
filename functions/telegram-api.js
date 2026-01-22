const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Store Telegram sessions
const telegramSessions = {};

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
    
    // Route handlers
    switch (action) {
        case 'connect-telegram':
            return await handleConnectTelegram(requestData, user);
        
        case 'get-dialogs':
            return await handleGetDialogs(requestData, user);
        
        case 'send-message':
            return await handleSendMessage(requestData, user);
        
        case 'get-chat-info':
            return await handleGetChatInfo(requestData, user);
        
        case 'auto-text':
            return await handleAutoText(requestData, user);
        
        case 'get-session-status':
            return await handleGetSessionStatus(requestData, user);
        
        default:
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Unknown action' })
            };
    }
};

async function handleConnectTelegram(data, user) {
    const { apiId, apiHash, phoneNumber } = data;
    
    if (!apiId || !apiHash || !phoneNumber) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'API ID, API Hash, and Phone Number are required' })
        };
    }
    
    // Store session
    const sessionId = `telegram_${user.username}_${Date.now()}`;
    telegramSessions[sessionId] = {
        apiId,
        apiHash,
        phoneNumber,
        userId: user.username,
        connected: false,
        lastActivity: new Date().toISOString()
    };
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            sessionId,
            message: 'Telegram session created. Please check your phone for verification code.'
        })
    };
}

async function handleGetDialogs(data, user) {
    const { sessionId } = data;
    
    if (!sessionId || !telegramSessions[sessionId]) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Session not found' })
        };
    }
    
    // Mock response - in reality, connect to Telegram API
    const mockDialogs = [
        {
            id: -1001234567890,
            title: 'Test Group',
            type: 'group',
            participants: 150,
            unreadCount: 5,
            lastMessage: 'Hello everyone!',
            lastMessageTime: new Date().toISOString()
        },
        {
            id: 123456789,
            title: 'John Doe',
            type: 'private',
            isUser: true,
            lastMessage: 'Hi there!',
            lastMessageTime: new Date().toISOString()
        },
        {
            id: -1009876543210,
            title: 'Official Channel',
            type: 'channel',
            subscribers: 5000,
            lastMessage: 'New update available!',
            lastMessageTime: new Date().toISOString()
        }
    ];
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            dialogs: mockDialogs,
            total: mockDialogs.length
        })
    };
}

async function handleSendMessage(data, user) {
    const { sessionId, chatId, message, scheduleTime } = data;
    
    if (!sessionId || !chatId || !message) {
        return {
            statusCode: 400,
            body: JSON.stringify({ 
                error: 'Session ID, Chat ID, and Message are required' 
            })
        };
    }
    
    // Mock sending
    console.log(`📤 Sending message to ${chatId}: ${message.substring(0, 50)}...`);
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            messageId: `msg_${Date.now()}`,
            chatId,
            message: message.substring(0, 100),
            sentAt: new Date().toISOString(),
            scheduled: !!scheduleTime
        })
    };
}

async function handleGetChatInfo(data, user) {
    const { sessionId, chatId } = data;
    
    // Mock chat info
    const chatInfo = {
        id: chatId,
        title: chatId < 0 ? 'Group/Chat' : 'User',
        type: chatId < 0 ? (chatId < -1000000000000 ? 'channel' : 'group') : 'private',
        members: chatId < 0 ? Math.floor(Math.random() * 1000) + 1 : 1,
        createdAt: new Date(Date.now() - Math.random() * 31536000000).toISOString(),
        canSend: true,
        permissions: ['send_messages', 'send_media', 'send_stickers']
    };
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            chat: chatInfo
        })
    };
}

async function handleAutoText(data, user) {
    const { sessionId, targets, message, interval, repeat, startImmediately } = data;
    
    if (!targets || !Array.isArray(targets) || targets.length === 0 || !message) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Targets and message are required' })
        };
    }
    
    // Create auto-text job
    const jobId = `auto_${Date.now()}`;
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            jobId,
            message: `Auto-text scheduled for ${targets.length} target(s)`,
            details: {
                targets,
                interval: interval || 60,
                repeat: repeat || 1,
                startImmediately: startImmediately !== false
            }
        })
    };
}

async function handleGetSessionStatus(data, user) {
    const { sessionId } = data;
    
    if (!sessionId || !telegramSessions[sessionId]) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Session not found' })
        };
    }
    
    const session = telegramSessions[sessionId];
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            session: {
                ...session,
                // Hide sensitive data
                apiId: session.apiId ? '••••' : null,
                apiHash: session.apiHash ? '••••••••' : null,
                phoneNumber: session.phoneNumber ? 
                    session.phoneNumber.replace(/\d(?=\d{4})/g, '*') : null
            },
            status: session.connected ? 'connected' : 'pending_verification',
            lastActivity: session.lastActivity
        })
    };
}
