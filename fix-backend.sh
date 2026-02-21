#!/bin/bash

# Fix for LangGraph ES Module error
echo "🔧 Fixing ES Module configuration..."

# Backup original package.json
cp package.json package.json.backup

# Update package.json with ES Module configuration
cat > package.json << 'EOF'
{
  "name": "dte-backend",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@langchain/langgraph": "^1.1.4",
    "@langchain/core": "^1.1.25",
    "@supabase/supabase-js": "^2.x",
    "resend": "^3.x",
    "express": "^4.x",
    "cors": "^2.x",
    "helmet": "^7.x",
    "joi": "^17.x",
    "winston": "^3.x",
    "jsonwebtoken": "^9.x",
    "bcryptjs": "^2.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "@types/express": "^4.x",
    "@types/cors": "^2.x",
    "@types/jsonwebtoken": "^9.x",
    "@types/bcryptjs": "^2.x",
    "typescript": "^5.x",
    "tsx": "^4.x"
  }
}
EOF

# Update tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

echo "✅ Configuration updated. Rebuilding..."
npm install
npm run build

echo "🚀 Ready to deploy!"
