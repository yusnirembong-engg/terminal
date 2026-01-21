class SecureTerminal {
    constructor() {
        this.history = [];
        this.currentHistoryIndex = -1;
        this.sessionId = Date.now();
        this.commandInput = null;
        this.executeButton = null;
        this.terminalOutput = null;
        this.clearButton = null;
        this.copyButton = null;
        this.saveButton = null;
        this.historyList = null;
    }

    init() {
        this.commandInput = document.getElementById('commandInput');
        this.executeButton = document.getElementById('executeCommand');
        this.terminalOutput = document.getElementById('terminalOutput');
        this.clearButton = document.getElementById('clearTerminal');
        this.copyButton = document.getElementById('copyTerminal');
        this.saveButton = document.getElementById('saveTerminal');
        this.historyList = document.getElementById('historyList');
        
        if (!this.commandInput || !this.terminalOutput) {
            console.error('Terminal elements not found');
            return;
        }
        
        this.setupEventListeners();
        this.printWelcomeMessage();
        
        // Focus input
        setTimeout(() => {
            if (this.commandInput) {
                this.commandInput.focus();
            }
        }, 100);
    }

    setupEventListeners() {
        if (!this.commandInput || !this.executeButton) return;
        
        // Command execution
        this.commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.executeCommand();
            }
        });

        this.commandInput.addEventListener('keydown', (e) => {
            // Arrow up for history
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1);
            }
            // Arrow down for history
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1);
            }
        });

        this.executeButton.addEventListener('click', () => this.executeCommand());
        
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.clearTerminal());
        }
        
        if (this.copyButton) {
            this.copyButton.addEventListener('click', () => this.copyTerminal());
        }
        
        if (this.saveButton) {
            this.saveButton.addEventListener('click', () => this.saveTerminal());
        }
        
        // Auto-focus on click anywhere
        document.addEventListener('click', (e) => {
            if (this.commandInput && !this.commandInput.contains(e.target)) {
                this.commandInput.focus();
            }
        });
    }

    async executeCommand() {
        if (!this.commandInput) return;
        
        const command = this.commandInput.value.trim();
        if (!command) return;

        // Add to history
        this.addToHistory(command);
        
        // Display command in terminal
        this.printCommand(command);
        
        // Clear input
        this.commandInput.value = '';
        this.currentHistoryIndex = -1;

        try {
            // Get token from main panel
            const token = window.botPanel ? window.botPanel.token : null;
            
            if (!token) {
                this.printOutput('Error: Not authenticated. Please login first.', 'error');
                return;
            }

            // Execute via API
            const response = await fetch('/.netlify/functions/terminal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    command: command,
                    sessionId: this.sessionId
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.printOutput(data.output || '(No output)', 'success');
            } else {
                this.printOutput(`Error: ${data.error || 'Unknown error'}`, 'error');
                if (data.allowedCommands) {
                    this.printOutput(`Allowed commands: ${data.allowedCommands.join(', ')}`, 'info');
                }
            }
        } catch (error) {
            this.printOutput(`Network error: ${error.message}`, 'error');
        }
    }

    printCommand(cmd) {
        if (!this.terminalOutput) return;
        
        const line = document.createElement('div');
        line.className = 'command-line';
        line.innerHTML = `
            <span class="prompt">$</span>
            <span class="command">${this.escapeHtml(cmd)}</span>
        `;
        this.terminalOutput.appendChild(line);
        this.scrollToBottom();
    }

    printOutput(text, type = 'normal') {
        if (!this.terminalOutput) return;
        
        const line = document.createElement('div');
        line.className = `output-line ${type}`;
        
        // Preserve formatting
        const formattedText = this.escapeHtml(text)
            .replace(/\n/g, '<br>')
            .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
        
        line.innerHTML = formattedText;
        this.terminalOutput.appendChild(line);
        this.scrollToBottom();
    }

    addToHistory(command) {
        // Don't add duplicate consecutive commands
        if (this.history.length === 0 || this.history[0] !== command) {
            this.history.unshift(command);
            if (this.history.length > 50) {
                this.history.pop();
            }
            this.updateHistoryDisplay();
        }
    }

    navigateHistory(direction) {
        if (this.history.length === 0 || !this.commandInput) return;
        
        if (direction === -1) { // Arrow up
            if (this.currentHistoryIndex < this.history.length - 1) {
                this.currentHistoryIndex++;
                this.commandInput.value = this.history[this.currentHistoryIndex];
            }
        } else { // Arrow down
            if (this.currentHistoryIndex > 0) {
                this.currentHistoryIndex--;
                this.commandInput.value = this.history[this.currentHistoryIndex];
            } else if (this.currentHistoryIndex === 0) {
                this.currentHistoryIndex = -1;
                this.commandInput.value = '';
            }
        }
    }

    updateHistoryDisplay() {
        if (!this.historyList) return;
        
        this.historyList.innerHTML = this.history
            .slice(0, 10)
            .map((cmd, index) => `
                <div class="history-item" onclick="window.terminal.selectHistoryCommand(${index})">
                    <i class="fas fa-history"></i>
                    <span>${this.escapeHtml(cmd.substring(0, 50))}${cmd.length > 50 ? '...' : ''}</span>
                </div>
            `)
            .join('');
    }

    selectHistoryCommand(index) {
        if (!this.commandInput || index >= this.history.length) return;
        
        this.commandInput.value = this.history[index];
        this.commandInput.focus();
        this.currentHistoryIndex = index;
    }

    clearTerminal() {
        if (!this.terminalOutput) return;
        
        this.terminalOutput.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-shield-alt"></i>
                <h4>Secure Terminal</h4>
                <p>Terminal cleared at ${new Date().toLocaleTimeString()}</p>
                <p>Type 'help' for available commands</p>
            </div>
        `;
    }

    copyTerminal() {
        if (!this.terminalOutput) return;
        
        const text = this.terminalOutput.innerText;
        navigator.clipboard.writeText(text)
            .then(() => {
                this.printOutput('Terminal output copied to clipboard', 'success');
            })
            .catch(err => {
                this.printOutput('Failed to copy: ' + err, 'error');
            });
    }

    saveTerminal() {
        if (!this.terminalOutput) return;
        
        const text = this.terminalOutput.innerText;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `terminal-log-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.printOutput('Terminal log saved', 'success');
    }

    printWelcomeMessage() {
        if (!this.terminalOutput) return;
        
        this.printOutput('=== SECURE TERMINAL ===', 'info');
        this.printOutput('Session ID: ' + this.sessionId, 'info');
        this.printOutput('Connected: ' + new Date().toLocaleString(), 'info');
        this.printOutput('Type "help" for available commands', 'info');
        this.printOutput('', 'info');
    }

    scrollToBottom() {
        if (this.terminalOutput) {
            this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize terminal when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.terminal = new SecureTerminal();
    // Terminal will be initialized by main.js when user logs in
});
