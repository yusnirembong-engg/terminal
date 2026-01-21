class SecureTerminal {
    constructor() {
        this.history = [];
        this.currentHistoryIndex = -1;
        this.sessionToken = localStorage.getItem('sessionToken');
        this.init();
    }

    init() {
        this.commandInput = document.getElementById('commandInput');
        this.executeButton = document.getElementById('executeCommand');
        this.terminalOutput = document.getElementById('terminalOutput');
        this.clearButton = document.getElementById('clearTerminal');
        
        this.setupEventListeners();
        this.printWelcomeMessage();
    }

    setupEventListeners() {
        this.commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.executeCommand();
            }
            
            // Arrow key navigation
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory('up');
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory('down');
            }
        });

        this.executeButton.addEventListener('click', () => this.executeCommand());
        this.clearButton.addEventListener('click', () => this.clearTerminal());
        
        // Auto-focus input
        document.addEventListener('click', () => {
            if (!this.commandInput.matches(':focus')) {
                this.commandInput.focus();
            }
        });
    }

    async executeCommand() {
        const command = this.commandInput.value.trim();
        if (!command) return;

        // Add to history
        this.addToHistory(command);
        
        // Display command
        this.printCommand(command);
        
        // Clear input
        this.commandInput.value = '';
        this.currentHistoryIndex = -1;

        // Execute via API
        await this.sendCommandToAPI(command);
    }

    async sendCommandToAPI(command) {
        this.printOutput('Executing...', 'info');
        
        try {
            const response = await fetch('/.netlify/functions/terminal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({
                    command: command,
                    sessionId: Date.now()
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                // Decrypt output if needed
                let output = data.output;
                if (typeof output === 'object' && output.content) {
                    output = await this.decryptOutput(output);
                }
                this.printOutput(output, 'success');
            } else {
                this.printOutput(`Error: ${data.error}`, 'error');
            }
        } catch (error) {
            this.printOutput(`Network error: ${error.message}`, 'error');
        }
    }

    printCommand(cmd) {
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
        const line = document.createElement('div');
        line.className = `output-line ${type}`;
        line.textContent = text;
        this.terminalOutput.appendChild(line);
        this.scrollToBottom();
    }

    addToHistory(command) {
        this.history.unshift(command);
        if (this.history.length > 50) {
            this.history.pop();
        }
        this.updateHistoryDisplay();
    }

    navigateHistory(direction) {
        if (this.history.length === 0) return;
        
        if (direction === 'up') {
            if (this.currentHistoryIndex < this.history.length - 1) {
                this.currentHistoryIndex++;
            }
        } else {
            if (this.currentHistoryIndex > 0) {
                this.currentHistoryIndex--;
            } else if (this.currentHistoryIndex === 0) {
                this.currentHistoryIndex = -1;
                this.commandInput.value = '';
                return;
            }
        }
        
        if (this.currentHistoryIndex >= 0) {
            this.commandInput.value = this.history[this.currentHistoryIndex];
        }
    }

    updateHistoryDisplay() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        historyList.innerHTML = this.history
            .slice(0, 10)
            .map(cmd => `
                <div class="history-item">
                    <i class="fas fa-history"></i>
                    <span>${this.escapeHtml(cmd)}</span>
                </div>
            `)
            .join('');
    }

    clearTerminal() {
        this.terminalOutput.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-shield-alt"></i>
                <h4>Secure Terminal Ready</h4>
                <p>Terminal cleared at ${new Date().toLocaleTimeString()}</p>
            </div>
        `;
    }

    printWelcomeMessage() {
        this.printOutput('=== Secure Terminal ===', 'info');
        this.printOutput('Type "help" for available commands', 'info');
        this.printOutput('Session started: ' + new Date().toLocaleString(), 'info');
    }

    scrollToBottom() {
        this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async decryptOutput(encrypted) {
        try {
            // In production, implement proper decryption
            return encrypted.content || encrypted;
        } catch (error) {
            return `[Decryption error: ${error.message}]`;
        }
    }
}

// Initialize terminal when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.terminal = new SecureTerminal();
});
