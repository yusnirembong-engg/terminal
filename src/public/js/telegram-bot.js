class TelegramBotManager {
    constructor() {
        this.currentBot = null;
        this.autoTextJobs = [];
        this.messageHistory = [];
        this.connectedChats = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Bot creation form
        const createBotForm = document.getElementById('createBotForm');
        if (createBotForm) {
            createBotForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createUserBot();
            });
        }

        // Verification form
        const verifyBotForm = document.getElementById('verifyBotForm');
        if (verifyBotForm) {
            verifyBotForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.verifyBot();
            });
        }

        // Auto-text form
        const createAutoTextForm = document.getElementById('createAutoTextForm');
        if (createAutoTextForm) {
            createAutoTextForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createAutoText();
            });
        }

        // Send message form
        const sendMessageForm = document.getElementById('sendMessageForm');
        if (sendMessageForm) {
            sendMessageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        // Refresh buttons
        const refreshBotsBtn = document.getElementById('refreshBots');
        if (refreshBotsBtn) {
            refreshBotsBtn.addEventListener('click', () => this.loadUserBots());
        }

        const refreshJobsBtn = document.getElementById('refreshJobs');
        if (refreshJobsBtn) {
            refreshJobsBtn.addEventListener('click', () => this.loadAutoTextJobs());
        }

        const refreshHistoryBtn = document.getElementById('refreshHistory');
        if (refreshHistoryBtn) {
            refreshHistoryBtn.addEventListener('click', () => this.loadMessageHistory());
        }

        const refreshChatsBtn = document.getElementById('refreshChats');
        if (refreshChatsBtn) {
            refreshChatsBtn.addEventListener('click', () => this.loadConnectedChats());
        }
    }

    async createUserBot() {
        const token = window.botPanel ? window.botPanel.token : null;
        if (!token) {
            alert('Please login first');
            return;
        }

        const botName = document.getElementById('botName').value;
        const apiId = document.getElementById('apiId').value;
        const apiHash = document.getElementById('apiHash').value;
        const phoneNumber = document.getElementById('phoneNumber').value;

        if (!botName || !apiId || !apiHash || !phoneNumber) {
            alert('Please fill all fields');
            return;
        }

        try {
            const response = await fetch('/.netlify/functions/userbot-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'create-bot',
                    botName,
                    apiId,
                    apiHash,
                    phoneNumber
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Bot created successfully! Please check your phone for verification code.');
                document.getElementById('verificationBotId').value = data.botId;
                document.getElementById('createBotSection').style.display = 'none';
                document.getElementById('verifyBotSection').style.display = 'block';
                this.loadUserBots();
            } else {
                throw new Error(data.error || 'Failed to create bot');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    async verifyBot() {
        const token = window.botPanel ? window.botPanel.token : null;
        if (!token) {
            alert('Please login first');
            return;
        }

        const botId = document.getElementById('verificationBotId').value;
        const verificationCode = document.getElementById('verificationCode').value;

        if (!botId || !verificationCode) {
            alert('Please enter verification code');
            return;
        }

        try {
            const response = await fetch('/.netlify/functions/userbot-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'start-bot',
                    botId,
                    verificationCode
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Bot verified and connected successfully!');
                document.getElementById('verifyBotSection').style.display = 'none';
                this.currentBot = data.bot;
                this.updateBotStatus();
                this.loadUserBots();
                this.loadConnectedChats();
            } else {
                throw new Error(data.error || 'Verification failed');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    async loadUserBots() {
        const token = window.botPanel ? window.botPanel.token : null;
        if (!token) return;

        try {
            const response = await fetch('/.netlify/functions/userbot-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'list-bots' })
            });

            const data = await response.json();

            if (data.success) {
                this.updateBotsList(data.bots);
            }
        } catch (error) {
            console.error('Failed to load bots:', error);
        }
    }

    updateBotsList(bots) {
        const container = document.getElementById('botsList');
        if (!container) return;

        if (bots.length === 0) {
            container.innerHTML = '<p class="no-data">No bots created yet</p>';
            return;
        }

        container.innerHTML = bots.map(bot => `
            <div class="bot-card ${bot.status}">
                <div class="bot-header">
                    <h4>${bot.name}</h4>
                    <span class="status-badge ${bot.status}">
                        <i class="fas fa-circle"></i> ${bot.status}
                    </span>
                </div>
                <div class="bot-details">
                    <p><i class="fas fa-id-card"></i> ID: ${bot.id}</p>
                    <p><i class="fas fa-calendar"></i> Created: ${new Date(bot.createdAt).toLocaleDateString()}</p>
                    <p><i class="fas fa-clock"></i> Last Active: ${new Date(bot.lastActivity).toLocaleTimeString()}</p>
                    <p><i class="fas fa-paper-plane"></i> Messages: ${bot.messagesSent}</p>
                    <p><i class="fas fa-tasks"></i> Jobs: ${bot.hasActiveJobs ? 'Active' : 'None'}</p>
                </div>
                <div class="bot-actions">
                    <button class="btn-small" onclick="telegramBot.selectBot('${bot.id}')">
                        <i class="fas fa-eye"></i> Select
                    </button>
                    <button class="btn-small ${bot.status === 'connected' ? 'btn-danger' : 'btn-success'}" 
                            onclick="telegramBot.toggleBot('${bot.id}', '${bot.status}')">
                        <i class="fas fa-power-off"></i> ${bot.status === 'connected' ? 'Stop' : 'Start'}
                    </button>
                </div>
            </div>
        `).join('');
    }

    async selectBot(botId) {
        const token = window.botPanel ? window.botPanel.token : null;
        if (!token) return;

        try {
            const response = await fetch('/.netlify/functions/userbot-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'bot-status',
                    botId
                })
            });

            const data = await response.json();

            if (data.success) {
                this.currentBot = data.bot;
                this.updateBotStatus();
                this.loadAutoTextJobs();
                this.loadMessageHistory();
                this.loadConnectedChats();
                
                // Show bot control panel
                document.getElementById('botControlPanel').style.display = 'block';
                document.getElementById('selectedBotName').textContent = this.currentBot.name;
            }
        } catch (error) {
            console.error('Failed to select bot:', error);
        }
    }

    async toggleBot(botId, currentStatus) {
        const token = window.botPanel ? window.botPanel.token : null;
        if (!token) return;

        const action = currentStatus === 'connected' ? 'stop-bot' : 'start-bot';

        try {
            const response = await fetch('/.netlify/functions/userbot-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: action,
                    botId: botId
                })
            });

            const data = await response.json();

            if (data.success) {
                alert(`Bot ${currentStatus === 'connected' ? 'stopped' : 'started'} successfully`);
                this.loadUserBots();
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    updateBotStatus() {
        if (!this.currentBot) return;

        const statusElement = document.getElementById('currentBotStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <strong>${this.currentBot.name}</strong>
                <span class="status-badge ${this.currentBot.status}">
                    <i class="fas fa-circle"></i> ${this.currentBot.status}
                </span>
                <br>
                <small>Connected: ${new Date(this.currentBot.connectedAt).toLocaleString()}</small>
                <br>
                <small>Messages: ${this.currentBot.messagesSent} | Jobs: ${this.currentBot.autoTextJobs}</small>
            `;
        }
    }

    async createAutoText() {
        const token = window.botPanel ? window.botPanel.token : null;
        if (!this.currentBot || !token) {
            alert('Please select a bot first');
            return;
        }

        const targetsInput = document.getElementById('autoTextTargets').value;
        const message = document.getElementById('autoTextMessage').value;
        const interval = document.getElementById('autoTextInterval').value;
        const repeatCount = document.getElementById('autoTextRepeat').value;
        const startNow = document.getElementById('autoTextStartNow').checked;

        if (!targetsInput || !message) {
            alert('Please enter targets and message');
            return;
        }

        // Parse targets (comma separated)
        const targets = targetsInput.split(',').map(t => t.trim()).filter(t => t);

        try {
            const response = await fetch('/.netlify/functions/userbot-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'create-auto-text',
                    botId: this.currentBot.id,
                    targets,
                    message,
                    interval: parseInt(interval) || 60,
                    repeatCount: parseInt(repeatCount) || 1,
                    startNow
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Auto-text job created successfully!');
                document.getElementById('createAutoTextForm').reset();
                this.loadAutoTextJobs();
            } else {
                throw new Error(data.error || 'Failed to create auto-text');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    async loadAutoTextJobs() {
        const token = window.botPanel ? window.botPanel.token : null;
        if (!token) return;

        try {
            const response = await fetch('/.netlify/functions/userbot-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'list-auto-texts' })
            });

            const data = await response.json();

            if (data.success) {
                this.autoTextJobs = data.jobs;
                this.updateJobsList(data.jobs);
            }
        } catch (error) {
            console.error('Failed to load jobs:', error);
        }
    }

    updateJobsList(jobs) {
        const container = document.getElementById('autoTextJobsList');
        if (!container) return;

        if (jobs.length === 0) {
            container.innerHTML = '<p class="no-data">No auto-text jobs</p>';
            return;
        }

        container.innerHTML = jobs.map(job => `
            <div class="job-card ${job.status}">
                <div class="job-header">
                    <h5>Job: ${job.id.substring(0, 8)}...</h5>
                    <span class="status-badge ${job.status}">
                        <i class="fas fa-circle"></i> ${job.status}
                    </span>
                </div>
                <div class="job-details">
                    <p><i class="fas fa-bullseye"></i> Targets: ${job.targets.length}</p>
                    <p><i class="fas fa-clock"></i> Interval: ${job.interval}s</p>
                    <p><i class="fas fa-redo"></i> Repeat: ${job.repeatCount}x</p>
                    <p><i class="fas fa-paper-plane"></i> Sent: ${job.messagesSent}</p>
                    <p><i class="fas fa-calendar"></i> Created: ${new Date(job.createdAt).toLocaleDateString()}</p>
                    ${job.nextRun ? `<p><i class="fas fa-forward"></i> Next: ${new Date(job.nextRun).toLocaleTimeString()}</p>` : ''}
                </div>
                <div class="job-message">
                    <strong>Message:</strong>
                    <p>${job.message.substring(0, 100)}${job.message.length > 100 ? '...' : ''}</p>
                </div>
                <div class="job-actions">
                    <button class="btn-small btn-danger" onclick="telegramBot.stopJob('${job.id}')">
                        <i class="fas fa-stop"></i> Stop
                    </button>
                </div>
            </div>
        `).join('');
    }

    async stopJob(jobId) {
        const token = window.botPanel ? window.botPanel.token : null;
        if (!token) return;

        try {
            const response = await fetch('/.netlify/functions/userbot-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'stop-auto-text',
                    jobId
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Job stopped successfully');
                this.loadAutoTextJobs();
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    async sendMessage() {
        const token = window.botPanel ? window.botPanel.token : null;
        if (!this.currentBot || !token) {
            alert('Please select a bot first');
            return;
        }

        const chatId = document.getElementById('sendMessageChatId').value;
        const message = document.getElementById('sendMessageText').value;
        const scheduleTime = document.getElementById('sendMessageSchedule').value;

        if (!chatId || !message) {
            alert('Please enter chat ID and message');
            return;
        }

        try {
            const response = await fetch('/.netlify/functions/telegram-api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'send-message',
                    sessionId: this.currentBot.id,
                    chatId,
                    message,
                    scheduleTime: scheduleTime || null
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Message sent successfully!');
                document.getElementById('sendMessageForm').reset();
                this.loadMessageHistory();
            } else {
                throw new Error(data.error || 'Failed to send message');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    async loadMessageHistory() {
        const token = window.botPanel ? window.botPanel.token : null;
        if (!token) return;

        try {
            const response = await fetch('/.netlify/functions/userbot-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'get-message-history',
                    limit: 50,
                    botId: this.currentBot ? this.currentBot.id : null
                })
            });

            const data = await response.json();

            if (data.success) {
                this.messageHistory = data.messages;
                this.updateMessageHistory(data.messages);
            }
        } catch (error) {
            console.error('Failed to load message history:', error);
        }
    }

    updateMessageHistory(messages) {
        const container = document.getElementById('messageHistory');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = '<p class="no-data">No messages sent yet</p>';
            return;
        }

        container.innerHTML = messages.map(msg => `
            <div class="message-item ${msg.status}">
                <div class="message-header">
                    <span class="message-id">${msg.id.substring(0, 8)}...</span>
                    <span class="message-time">${new Date(msg.sentAt).toLocaleString()}</span>
                </div>
                <div class="message-details">
                    <p><i class="fas fa-hashtag"></i> Chat: ${msg.chatId}</p>
                    <p><i class="fas fa-${msg.status === 'sent' ? 'check' : 'exclamation'}"></i> Status: ${msg.status}</p>
                    ${msg.scheduled ? `<p><i class="fas fa-clock"></i> Scheduled</p>` : ''}
                </div>
                <div class="message-content">
                    <strong>Message:</strong>
                    <p>${msg.message.substring(0, 150)}${msg.message.length > 150 ? '...' : ''}</p>
                </div>
            </div>
        `).join('');
    }

    async loadConnectedChats() {
        const token = window.botPanel ? window.botPanel.token : null;
        if (!token) return;

        try {
            const response = await fetch('/.netlify/functions/userbot-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'get-connected-chats' })
            });

            const data = await response.json();

            if (data.success) {
                this.connectedChats = data.chats;
                this.updateChatsList(data.chats);
            }
        } catch (error) {
            console.error('Failed to load chats:', error);
        }
    }

    updateChatsList(chats) {
        const container = document.getElementById('connectedChats');
        if (!container) return;

        if (chats.length === 0) {
            container.innerHTML = '<p class="no-data">No connected chats</p>';
            return;
        }

        container.innerHTML = chats.map(chat => `
            <div class="chat-item ${chat.type}">
                <div class="chat-header">
                    <h5>${chat.title || `Chat ${chat.id}`}</h5>
                    <span class="chat-type ${chat.type}">
                        <i class="fas fa-${chat.type === 'group' ? 'users' : 
                                           chat.type === 'channel' ? 'broadcast-tower' : 
                                           'user'}"></i> ${chat.type}
                    </span>
                </div>
                <div class="chat-details">
                    <p><i class="fas fa-hashtag"></i> ID: ${chat.id}</p>
                    ${chat.members ? `<p><i class="fas fa-users"></i> Members: ${chat.members}</p>` : ''}
                    ${chat.subscribers ? `<p><i class="fas fa-eye"></i> Subscribers: ${chat.subscribers}</p>` : ''}
                    <p><i class="fas fa-calendar"></i> Since: ${new Date(chat.createdAt).toLocaleDateString()}</p>
                </div>
                <div class="chat-actions">
                    <button class="btn-small" onclick="telegramBot.selectChat(${chat.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-small btn-primary" onclick="telegramBot.sendToChat(${chat.id})">
                        <i class="fas fa-paper-plane"></i> Send
                    </button>
                </div>
            </div>
        `).join('');
    }

    selectChat(chatId) {
        document.getElementById('sendMessageChatId').value = chatId;
        document.getElementById('sendMessageSection').scrollIntoView();
    }

    sendToChat(chatId) {
        this.selectChat(chatId);
        document.getElementById('sendMessageText').focus();
    }

    async getChatInfo(chatId) {
        const token = window.botPanel ? window.botPanel.token : null;
        if (!this.currentBot || !token) return;

        try {
            const response = await fetch('/.netlify/functions/telegram-api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'get-chat-info',
                    sessionId: this.currentBot.id,
                    chatId
                })
            });

            const data = await response.json();

            if (data.success) {
                return data.chat;
            }
        } catch (error) {
            console.error('Failed to get chat info:', error);
        }
        return null;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.telegramBot = new TelegramBotManager();
});
