class BotControlPanel {
    constructor() {
        this.token = null;
        this.user = null;
        this.currentIP = null;
        this.monitoringInterval = null;
        this.init();
    }

    async init() {
        // Deteksi IP
        await this.detectIP();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check if already logged in
        this.checkExistingSession();
        
        // Initialize other components
        this.initializeComponents();
    }

    async detectIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            this.currentIP = data.ip;
            
            // Update display
            const ipDisplay = document.getElementById('ipDisplay');
            if (ipDisplay) {
                ipDisplay.innerHTML = `<i class="fas fa-network-wired"></i> Your IP: ${this.currentIP}`;
            }
            
            // Update current IP in footer
            const currentIPElement = document.getElementById('currentIP');
            if (currentIPElement) {
                currentIPElement.textContent = this.currentIP;
            }
            
            // Check IP authorization
            await this.checkIPAuthorization(data.ip);
            
        } catch (error) {
            console.error('IP detection failed:', error);
            this.currentIP = 'Unknown';
        }
    }

    async checkIPAuthorization(ip) {
        try {
            const response = await fetch('/.netlify/functions/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check-ip', ip })
            });
            
            const data = await response.json();
            console.log('IP Check Response:', data);
            
            if (!data.allowed) {
                const loginForm = document.getElementById('loginForm');
                if (loginForm) {
                    loginForm.style.display = 'none';
                }
                const securityNote = document.querySelector('.security-note');
                if (securityNote) {
                    securityNote.innerHTML = 
                        `<i class="fas fa-ban"></i> Access denied. IP ${ip} not authorized.`;
                }
            }
        } catch (error) {
            console.error('IP check failed:', error);
        }
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.currentTarget;
                this.switchTab(target.dataset.tab);
            });
        });

        // Quick actions
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Bot control actions
        document.querySelectorAll('.btn-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleBotAction(action);
            });
        });

        // Save config
        const saveConfigBtn = document.getElementById('saveConfig');
        if (saveConfigBtn) {
            saveConfigBtn.addEventListener('click', () => this.saveBotConfig());
        }

        // Terminal clear button
        const clearTerminalBtn = document.getElementById('clearTerminal');
        if (clearTerminalBtn && window.terminal) {
            clearTerminalBtn.addEventListener('click', () => window.terminal.clearTerminal());
        }

        // Terminal copy button
        const copyTerminalBtn = document.getElementById('copyTerminal');
        if (copyTerminalBtn && window.terminal) {
            copyTerminalBtn.addEventListener('click', () => window.terminal.copyTerminal());
        }

        // Terminal save button
        const saveTerminalBtn = document.getElementById('saveTerminal');
        if (saveTerminalBtn && window.terminal) {
            saveTerminalBtn.addEventListener('click', () => window.terminal.saveTerminal());
        }

        // Terminal execute button
        const executeCommandBtn = document.getElementById('executeCommand');
        if (executeCommandBtn && window.terminal) {
            executeCommandBtn.addEventListener('click', () => window.terminal.executeCommand());
        }

        // Update last active time
        setInterval(() => {
            this.updateLastActive();
        }, 60000);

        // Auto-update system status
        setInterval(() => {
            this.updateSystemStatus();
        }, 30000);
    }

    initializeComponents() {
        // Initialize terminal if available
        if (window.terminal) {
            window.terminal.init();
        }
        
        // Initialize bot manager if available
        if (window.botManager) {
            // Bot manager is already initialized in its own file
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        const loginBtn = document.querySelector('.btn-login');
        const originalText = loginBtn.innerHTML;
        
        try {
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
            loginBtn.disabled = true;
            
            const response = await fetch('/.netlify/functions/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password,
                    ip: this.currentIP 
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                
                // Save to localStorage
                localStorage.setItem('botPanelToken', data.token);
                localStorage.setItem('botPanelUser', JSON.stringify(data.user));
                
                // Show main panel
                this.showMainPanel();
                
                // Update UI
                document.getElementById('currentUser').textContent = data.user.username;
                document.getElementById('currentIP').textContent = this.currentIP;
                
                // Initialize other components
                if (window.terminal) {
                    window.terminal.sessionId = Date.now();
                    window.terminal.printWelcomeMessage();
                }
                
                this.updateSystemStatus();
                this.showNotification('Login successful!', 'success');
                
            } else {
                throw new Error(data.error || 'Login failed');
            }
            
        } catch (error) {
            this.showNotification(`Login failed: ${error.message}`, 'error');
            console.error('Login error:', error);
        } finally {
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('botPanelToken');
            localStorage.removeItem('botPanelUser');
            this.token = null;
            this.user = null;
            
            // Clear monitoring interval
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = null;
            }
            
            this.showLoginPanel();
            this.showNotification('Logged out successfully', 'success');
        }
    }

    checkExistingSession() {
        const token = localStorage.getItem('botPanelToken');
        const userStr = localStorage.getItem('botPanelUser');
        
        if (token && userStr) {
            try {
                this.token = token;
                this.user = JSON.parse(userStr);
                this.showMainPanel();
                document.getElementById('currentUser').textContent = this.user.username;
                
                const currentIPElement = document.getElementById('currentIP');
                if (currentIPElement && this.currentIP) {
                    currentIPElement.textContent = this.currentIP;
                }
                
                this.updateSystemStatus();
                
            } catch (error) {
                localStorage.removeItem('botPanelToken');
                localStorage.removeItem('botPanelUser');
            }
        }
    }

    showMainPanel() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainPanel').classList.remove('hidden');
        document.title = 'Bot Panel - ' + (this.user?.username || 'Admin');
        
        // Initialize connection status
        this.updateConnectionStatus('connected');
    }

    showLoginPanel() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainPanel').classList.add('hidden');
        document.title = 'Bot Control Panel';
        
        // Clear form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.reset();
        }
        
        // Reset connection status
        this.updateConnectionStatus('disconnected');
    }

    switchTab(tabName) {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
        
        // Show selected tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.getElementById(`${tabName}Tab`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        // Load tab-specific data
        this.loadTabData(tabName);
    }

    async loadTabData(tabName) {
        switch (tabName) {
            case 'terminal':
                if (window.terminal) {
                    window.terminal.printWelcomeMessage();
                }
                break;
                
            case 'bot-control':
                await this.updateBotStatus();
                await this.loadBotConfig();
                break;
                
            case 'config':
                await this.loadSystemConfig();
                break;
                
            case 'users':
                await this.loadUsersList();
                break;
                
            case 'logs':
                await this.loadLogs();
                break;
                
            case 'monitoring':
                await this.startMonitoring();
                break;
        }
    }

    async handleQuickAction(action) {
        if (!this.token) {
            this.showNotification('Please login first', 'warning');
            return;
        }
        
        const actions = {
            'start': 'start',
            'stop': 'stop',
            'logs': 'logs',
            'restart': 'restart'
        };
        
        if (actions[action]) {
            await this.handleBotAction(actions[action]);
        }
    }

    async handleBotAction(action) {
        if (!this.token) {
            this.showNotification('Please login first', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/.netlify/functions/bot-control', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ action })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`Bot ${action} successful`, 'success');
                await this.updateBotStatus();
            } else {
                throw new Error(data.error || 'Action failed');
            }
            
        } catch (error) {
            this.showNotification(`Action failed: ${error.message}`, 'error');
        }
    }

    async updateSystemStatus() {
        if (!this.token) return;
        
        try {
            const response = await fetch('/.netlify/functions/bot-control', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ action: 'status' })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const systemStatusElement = document.getElementById('systemStatus');
                if (systemStatusElement) {
                    systemStatusElement.textContent = 
                        data.status === 'running' ? 'Online' : 'Offline';
                    
                    systemStatusElement.style.color = 
                        data.status === 'running' ? '#28a745' : '#dc3545';
                }
            }
        } catch (error) {
            console.error('Status update failed:', error);
        }
    }

    async updateBotStatus() {
        if (!this.token) return;
        
        try {
            const response = await fetch('/.netlify/functions/bot-control', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ action: 'status' })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const indicator = document.getElementById('botStatusIndicator');
                if (indicator) {
                    indicator.innerHTML = data.status === 'running' 
                        ? '<i class="fas fa-circle"></i> Running'
                        : '<i class="fas fa-circle"></i> Stopped';
                    
                    indicator.className = data.status === 'running' 
                        ? 'status-indicator running'
                        : 'status-indicator stopped';
                    
                    if (data.details) {
                        const botCpu = document.getElementById('botCpu');
                        const botMemory = document.getElementById('botMemory');
                        const botUptime = document.getElementById('botUptime');
                        
                        if (botCpu) botCpu.textContent = data.details.cpu || '-';
                        if (botMemory) botMemory.textContent = data.details.memory || '-';
                        if (botUptime) botUptime.textContent = data.details.uptime || '-';
                    }
                }
            }
        } catch (error) {
            console.error('Bot status update failed:', error);
        }
    }

    async loadBotConfig() {
        if (!this.token) return;
        
        try {
            const response = await fetch('/.netlify/functions/bot-control', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ action: 'get-config' })
            });
            
            const data = await response.json();
            
            if (data.success && data.config) {
                const config = data.config;
                const apiToken = document.getElementById('apiToken');
                const adminIds = document.getElementById('adminIds');
                const autoRestart = document.getElementById('autoRestart');
                const logLevel = document.getElementById('logLevel');
                
                if (apiToken) apiToken.value = config.apiToken || '';
                if (adminIds) adminIds.value = config.adminIds ? config.adminIds.join(', ') : '';
                if (autoRestart) autoRestart.value = config.autoRestart ? 'true' : 'false';
                if (logLevel) logLevel.value = config.logLevel || 'info';
            }
        } catch (error) {
            console.error('Config load failed:', error);
        }
    }

    async saveBotConfig() {
        if (!this.token) {
            this.showNotification('Please login first', 'warning');
            return;
        }
        
        const apiToken = document.getElementById('apiToken').value;
        const adminIds = document.getElementById('adminIds').value;
        const autoRestart = document.getElementById('autoRestart').value;
        const logLevel = document.getElementById('logLevel').value;
        
        const config = {
            apiToken: apiToken,
            adminIds: adminIds.split(',').map(id => id.trim()).filter(id => id),
            autoRestart: autoRestart === 'true',
            logLevel: logLevel
        };
        
        try {
            const response = await fetch('/.netlify/functions/bot-control', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ 
                    action: 'save-config',
                    config 
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Configuration saved successfully', 'success');
            } else {
                throw new Error(data.error || 'Save failed');
            }
            
        } catch (error) {
            this.showNotification(`Save failed: ${error.message}`, 'error');
        }
    }

    async loadSystemConfig() {
        // Load system configuration from localStorage
        const savedIPs = localStorage.getItem('allowedIPs');
        if (savedIPs) {
            const allowedIPs = document.getElementById('allowedIPs');
            if (allowedIPs) allowedIPs.value = savedIPs;
        }
        
        const timeout = localStorage.getItem('sessionTimeout') || '60';
        const sessionTimeout = document.getElementById('sessionTimeout');
        if (sessionTimeout) sessionTimeout.value = timeout;
        
        const maxAttempts = localStorage.getItem('maxLoginAttempts') || '5';
        const maxLoginAttempts = document.getElementById('maxLoginAttempts');
        if (maxLoginAttempts) maxLoginAttempts.value = maxAttempts;
    }

    async loadUsersList() {
        // This is a placeholder - implement actual user loading
        console.log('Loading users list...');
        // In production, fetch from API
    }

    async loadLogs() {
        // This is a placeholder - implement actual log loading
        console.log('Loading logs...');
        
        const logsOutput = document.getElementById('logsOutput');
        if (logsOutput) {
            logsOutput.innerHTML = '<pre>Loading logs...</pre>';
        }
    }

    async startMonitoring() {
        // Start monitoring updates
        this.updateMonitoring();
        
        // Clear existing interval
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        this.monitoringInterval = setInterval(() => {
            this.updateMonitoring();
        }, 5000); // Update every 5 seconds
    }

    async updateMonitoring() {
        // This is mock data - replace with actual API calls
        const mockData = {
            cpu: Math.floor(Math.random() * 100),
            memory: Math.floor(Math.random() * 100),
            disk: Math.floor(Math.random() * 100),
            bot: {
                messagesProcessed: Math.floor(Math.random() * 1000),
                activeUsers: Math.floor(Math.random() * 100),
                uptimeDays: Math.floor(Math.random() * 30),
                errorsCount: Math.floor(Math.random() * 10)
            }
        };
        
        this.updateMonitoringUI(mockData);
    }

    updateMonitoringUI(data) {
        // Update CPU chart
        const cpuPercent = data.cpu || 45;
        const cpuPercentElement = document.getElementById('cpuPercent');
        const cpuChartBar = document.querySelector('#cpuChart .chart-bar');
        
        if (cpuPercentElement) cpuPercentElement.textContent = `${cpuPercent}%`;
        if (cpuChartBar) cpuChartBar.style.width = `${cpuPercent}%`;
        
        // Update Memory chart
        const memoryPercent = data.memory || 65;
        const memoryPercentElement = document.getElementById('memoryPercent');
        const memoryChartBar = document.querySelector('#memoryChart .chart-bar');
        
        if (memoryPercentElement) memoryPercentElement.textContent = `${memoryPercent}%`;
        if (memoryChartBar) memoryChartBar.style.width = `${memoryPercent}%`;
        
        // Update Disk chart
        const diskPercent = data.disk || 30;
        const diskPercentElement = document.getElementById('diskPercent');
        const diskChartBar = document.querySelector('#diskChart .chart-bar');
        
        if (diskPercentElement) diskPercentElement.textContent = `${diskPercent}%`;
        if (diskChartBar) diskChartBar.style.width = `${diskPercent}%`;
        
        // Update bot activity
        if (data.bot) {
            const messagesProcessed = document.getElementById('messagesProcessed');
            const activeUsers = document.getElementById('activeUsers');
            const uptimeDays = document.getElementById('uptimeDays');
            const errorsCount = document.getElementById('errorsCount');
            
            if (messagesProcessed) messagesProcessed.textContent = data.bot.messagesProcessed || 0;
            if (activeUsers) activeUsers.textContent = data.bot.activeUsers || 0;
            if (uptimeDays) uptimeDays.textContent = data.bot.uptimeDays || 0;
            if (errorsCount) errorsCount.textContent = data.bot.errorsCount || 0;
        }
    }

    updateLastActive() {
        const now = new Date();
        const lastActiveElement = document.getElementById('lastActive');
        if (lastActiveElement) {
            lastActiveElement.textContent = 
                now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    updateConnectionStatus(status) {
        const connectionStatus = document.getElementById('connectionStatus');
        const connectionText = document.getElementById('connectionText');
        
        if (connectionStatus && connectionText) {
            connectionStatus.className = `fas fa-circle status-dot ${status}`;
            
            switch (status) {
                case 'connected':
                    connectionText.textContent = 'Connected';
                    break;
                case 'disconnected':
                    connectionText.textContent = 'Disconnected';
                    break;
                case 'connecting':
                    connectionText.textContent = 'Connecting...';
                    break;
            }
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="close-notification"><i class="fas fa-times"></i></button>
        `;
        
        // Add to page
        const container = document.getElementById('notificationContainer');
        if (!container) {
            // Create container if it doesn't exist
            const newContainer = document.createElement('div');
            newContainer.id = 'notificationContainer';
            document.body.appendChild(newContainer);
            newContainer.appendChild(notification);
        } else {
            container.appendChild(notification);
        }
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
        
        // Close button
        const closeBtn = notification.querySelector('.close-notification');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                notification.remove();
            });
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.botPanel = new BotControlPanel();
});
