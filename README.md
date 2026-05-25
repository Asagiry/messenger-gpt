# Project Plan & Specifications: Web Messenger (MVP)

This document outlines the strict technical specifications and requirements for developing and deploying the Minimum Viable Product (MVP) of the Web Messenger.

## 1. Tech Stack
- **Backend**: Node.js + Express (TypeScript)
- **Frontend**: React + TypeScript (Vite bundler)
- **Database**: PostgreSQL
- **Real-time**: WebSockets (ws or socket.io)
- **Process Management**: PM2 for running the server on the VM

## 2. Infrastructure & Server Access
All connection parameters are stored in your `.env` file. Read it before starting.
- `SSH_IP` — IP address of your target Ubuntu VM.
- `SSH_USER` — username on the server (`base-ubuntu`).
- `DATABASE_URL` — PostgreSQL connection string.

Use the SSH private key `./id_ed25519` for passwordless access:
`ssh -i ./id_ed25519 base-ubuntu@$SSH_IP`

⚠️ IMPORTANT: The VM is already pre-configured with Node.js (v18), npm, PostgreSQL (v16), and PM2. The database 'app' and the default 'postgres' user (password: 'postgres') are already created and fully configured. You do NOT need to install these system dependencies or configure database users — you can immediately proceed to running migrations and deploying your application.

## 3. Network & Server Port Binding
- **Subdomain Configuration**: Use `http://gpt-messenger.voimaxgm.online` for any redirect configurations, CORS policies, client-side API URLs, and WebSocket handshakes.
- **Unified Port Design**: 
  - The React frontend must be compiled into static assets (`npm run build`).
  - The Express backend must serve these static assets and handle WebSocket/API requests on a single unified port.
- **Deployment Port: `80` (Standard HTTP)**: Configure your Express server to listen directly on port `80` (use `sudo` or `authbind` for PM2 to bind to privileged ports). Do NOT attempt to install SSL/TLS certificates, HTTPS, or Certbot. The app must be directly accessible via `http://gpt-messenger.voimaxgm.online` (or `http://<SSH_IP>`).

## 4. Workflow & Autonomy (Critical!)
- **Full Autonomy**: Make all technical, architectural, and configuration decisions on your own. Do not ask any clarifying questions during development. Your task is to deliver a fully finished, turnkey product.
- **Continuous Execution**: Work continuously without stopping to wait for user confirmations or approvals. Complete the environment setup, coding, and deployment in one single run.
- **Custom UI/UX Design**: Design a modern, clean, user-friendly, and visually appealing interface **based entirely on your own taste and style**. You are free to use any CSS libraries (e.g., Tailwind CSS, Material UI, Bootstrap, Styled Components). The design should reflect your model's unique aesthetic vision.
- **Granular Git Commits (Mandatory)**: You must commit your progress frequently. Make a separate Git commit for every logical step, completed subtask, or feature (e.g., initial environment setup, database tables creation, authentication logic, WebSocket integration, styling, deployment script). Write descriptive, meaningful, and professional commit messages in English. Push your commits to the remote `origin` repository regularly throughout the session. Do NOT make one giant commit at the end.
- **Strict Commit Message Cleanliness**: Your commit messages must look strictly human-written and organic. Do NOT include, append, or allow any platform-generated footers, bot signatures, automation tags, or co-author metadata (such as 'Co-Authored-By', 'Generated with', or 'Devin'). Keep the commit history 100% clean, professional, and free of any bot-related signatures.
- **Strict Single-Agent Execution**: You must execute the entire task by yourself as a single, unified agent. Do NOT spawn, launch, or delegate any work to parallel subagents, background agents, or helper agent instances. All coding, debugging, and deployment steps must be processed sequentially within your own main agent session. This is a strict constraint for consistency and resource control.

## 5. Functional Requirements
### 5.1. Authentication & Profiles
- **Registration**: User sign-up (Email, password, unique Nickname).
- **Login**: Authentication and session management (JWT or session tokens).
- **Logout**: Logout button to invalidate sessions.
- **Profile**: Ability to set an avatar via an image URL, change Nickname, update password, and write a bio.
- **User Directory**: View public profiles of other registered users.

### 5.2. Search & Dialogs
- Search for other users by partial nickname match.
- Dialogs list on the main page (sorted dynamically: chats with the newest messages must be at the top).
- Display the last message snippet and read/unread status in the chat list.

### 5.3. Real-Time WebSocket Messaging
- 1-on-1 private messaging in real time via WebSockets.
- Chat history with pagination (Lazy Loading: messages load in batches as the user scrolls up).
- Message statuses (sent, delivered, read).
- Live "user is typing..." indicator and presence status ("online / offline").
- Edit sent messages.
- Delete messages (option to delete "for me" or "for both").

## 6. Database Seeding
Upon initialization, the database must be automatically seeded with:
- **10 test users** with simple passwords (e.g., `123456`, `qwerty`, or the user's nickname).
- **Chat history** between them (5-10 messages across 3-4 different dialogs) so the app looks active and populated on the first login.

## 7. Automated Deployment Script (`deploy.sh`)
Write a `deploy.sh` script in the project root to automate the following steps on the remote VM:
1. Pull/update the code on the VM.
2. Install npm dependencies for both backend and frontend.
3. Run database migrations and seed the database.
4. Build the React frontend.
5. Configure and start the Node.js application under PM2 on port 80.

## 8. First Response Checklist & Completion Criteria (Mandatory)
Before writing any code, perform the following verification:
1. SSH into the VM, perform the initial setup (install Node.js, PostgreSQL, PM2), and configure the database.
2. Verify the environment by printing installed versions (`node -v && npm -v`) and testing the database connection with `SELECT version();`.
3. Provide a brief implementation plan (5-7 lines): list the database tables you will create and outline how you will organize the WebSocket connections.

Immediately after presenting the plan, proceed to coding and deployment.

⚠️ **Definition of Done**: Do not stop or declare completion until the entire MVP is fully built, successfully deployed, and running under PM2 on port 80. The session is complete only when the app is fully online and reachable at `http://gpt-messenger.voimaxgm.online`.
