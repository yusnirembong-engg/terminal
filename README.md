# Telegram Bot Control Panel

Secure web-based control panel for Telegram bots with terminal access, IP restriction, and full monitoring.

## 🚀 Deployment to Netlify

### Prerequisites
1. Netlify account
2. Node.js 18+
3. Git

### Step 1: Create Password Hash
```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YOUR_PASSWORD', 10));"
