const { exec } = require('child_process');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');

const execAsync = promisify(exec);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Whitelist of allowed commands
const ALLOWED_COMMANDS = [
    // System info
    'pwd',
    'whoami',
    'date',
    'uptime',
    'uname -a',
    
    // File operations (safe)
    'ls',
    'ls -la',
    'ls -l',
    'ls -lh',
    
    // Process info
    'ps aux | head -20',
    'ps aux | grep -v grep | grep -i bot',
    
    // Git operations
    'git status',
    'git branch',
    'git log --oneline -10',
    'git remote -v',
    
    // Node/Python versions
    'node --version',
    'npm --version',
    'python --version',
    'python3 --version',
    
    // Directory listing
    'find . -name "*.js" -type f | head -20',
    'find . -name "*.py" -type f | head -20',
    
    // Help command
    'help'
];

// Additional allowed patterns
const ALLOWED_PATTERNS = [
    /^cat (config\.json|package\.json|\.env\.example)$/,
    /^tail -n \d+ (bot\.log|\.log)$/,
    /^head -n \d+ .*\.(js|py|json)$/,
    /^wc -l .*\.(js|py|json)$/,
    /^grep -i ".*" .*\.(js|py|json)$/,
    /^git log --oneline -\d+$/,
    /^ps aux \| grep -i ".*"$/,
    /^find \. -name ".*" -type f \| head -\d+$/
];

function isCommandAllowed(command) {
    // Trim and clean command
    const cleanCmd = command.trim();
    
    // Check exact matches
    if (ALLOWED_COMMANDS.includes(cleanCmd)) {
        return true;
    }
    
    // Check patterns
    for (const pattern of ALLOWED_PATTERNS) {
        if (pattern.test(cleanCmd)) {
            return true;
        }
    }
    
    return false;
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
    
    const { command } = requestData;
    
    if (!command) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'No command provided' })
        };
    }
    
    // Security check
    if (!isCommandAllowed(command)) {
        return {
            statusCode: 403,
            body: JSON.stringify({ 
                error: 'Command not allowed',
                allowedCommands: ALLOWED_COMMANDS
            })
        };
    }
    
    // Special help command
    if (command === 'help') {
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                output: `
Available Commands:
===================

System Info:
  pwd                    - Show current directory
  whoami                 - Show current user
  date                   - Show current date/time
  uptime                 - Show system uptime
  uname -a              - Show system information

File Operations:
  ls                    - List files
  ls -la                - List all files with details
  cat config.json       - View config file
  cat package.json      - View package file
  tail -n 50 bot.log    - View last 50 lines of log

Process Management:
  ps aux | head -20     - Show top 20 processes
  ps aux | grep bot     - Find bot processes

Git Operations:
  git status            - Check git status
  git branch            - List branches
  git log --oneline -10 - Show last 10 commits

Development:
  node --version        - Check Node.js version
  npm --version         - Check npm version
  python --version      - Check Python version

Search:
  find . -name "*.js"   - Find JavaScript files
  grep -i "error" *.log - Search logs for errors

Note: All commands are executed in a secure sandbox environment.
                `.trim()
            })
        };
    }
    
    // Execute command
    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd: process.cwd(),
            timeout: 30000, // 30 second timeout
            maxBuffer: 1024 * 1024 // 1MB buffer
        });
        
        const output = stderr ? `${stdout}\nERROR:\n${stderr}` : stdout;
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                output: output || '(No output)',
                command: command,
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: `Command execution failed: ${error.message}`,
                command: command
            })
        };
    }
};
