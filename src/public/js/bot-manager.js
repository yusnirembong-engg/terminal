class BotManager {
    constructor() {
        this.botStatus = 'unknown';
        this.config = {};
        this.init();
    }

    init() {
        // Configuration will be loaded when needed
    }

    async startBot() {
        return this.sendBotCommand('start');
    }

    async stopBot() {
        return this.sendBotCommand('stop');
    }

    async restartBot() {
        return this.sendBotCommand('restart');
    }

    async getLogs(lines = 100) {
        return this.sendBotCommand('logs', { lines });
    }

    async getStatus() {
        return this.sendBotCommand('status');
    }

    async updateBot() {
        return this.sendBotCommand('update');
    }

    async saveConfig(newConfig) {
        return this.sendBotCommand('save-config', { config: newConfig });
    }

    async getConfig() {
        return this.sendBotCommand('get-config');
    }

    async sendBotCommand(action, data = {}) {
        const token = window.botPanel ? window.botPanel.token : null;
        
        if (!token) {
            throw new Error('Not authenticated');
        }

        try {
            const response = await fetch('/.netlify/functions/bot-control', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action, ...data })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Command failed');
            }

            return result;
        } catch (error) {
            console.error('Bot command failed:', error);
            throw error;
        }
    }

    updateUI(status) {
        // Update status indicator
        const indicator = document.getElementById('botStatusIndicator');
        if (indicator) {
            indicator.className = `status-indicator ${status}`;
            indicator.innerHTML = status === 'running' 
                ? '<i class="fas fa-circle"></i> Running'
                : '<i class="fas fa-circle"></i> Stopped';
        }

        // Update quick action buttons
        const startBtn = document.querySelector('[data-action="start"]');
        const stopBtn = document.querySelector('[data-action="stop"]');
        
        if (startBtn && stopBtn) {
            if (status === 'running') {
                startBtn.disabled = true;
                stopBtn.disabled = false;
            } else {
                startBtn.disabled = false;
                stopBtn.disabled = true;
            }
        }
    }
}

// Initialize bot manager
document.addEventListener('DOMContentLoaded', () => {
    window.botManager = new BotManager();
});
