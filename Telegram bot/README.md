# RGX Telegram Bot

This bot is the admin panel. The website has no `/admin` page.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill `BOT_TOKEN`, `ADMIN_CHAT_ID`, `PUBLIC_SITE_URL`, and `BOT_USERNAME`.
3. Optional: set `REQUIRED_CHANNEL=@yourchannel` and `REQUIRED_CHANNEL_URL=https://t.me/yourchannel`.
4. Run:

```powershell
npm install
npm start
```

## Render Web Service

Use `render.yaml` or create a Web Service manually:

- Root directory: `Telegram bot`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`
- Add env vars from `.env.example`
- Set `AUTO_DEPLOY=false` on Render because the bot should write data to Firebase, not run Vercel CLI.

Keep-alive URL:

```text
https://YOUR-RENDER-SERVICE.onrender.com/health
```

Ping this URL from a keep-alive monitor if the free service sleeps.

## Admin Flow

- `/start` from `ADMIN_CHAT_ID` opens the admin panel.
- `Generate Link` asks for file upload or direct link.
- File upload supports Telegram document, video, audio, photo, and animation.
- After file/link input, the bot only asks for the display name and then generates the link.
- `Users` shows total users and recent user details.
- `Broadcast` copies a message to all saved users.
- `Edit Files` can turn generated links on or off.
- `Channel` sets the required join channel. The bot must be admin in that channel.
- The bot creates `../data/files.json` entries for the website.
- The generated website link opens `download.html?id=<id>`.
- After countdown, users go through the shortener URL and then Telegram deep link.

## User Flow

Website -> RGX download page -> shortener -> Telegram bot -> file/link delivery.
