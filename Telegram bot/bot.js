require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const { execFile } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");

const {
  BOT_TOKEN,
  ADMIN_CHAT_ID,
  SHORTENER_API_KEY,
  PUBLIC_SITE_URL = "https://rahulgamerx.in",
  BOT_USERNAME = "RGX_BOT",
  VERCEL_SCOPE = "instaboosterwesds-projects",
  AUTO_DEPLOY = "true",
  FIREBASE_DATABASE_URL = "https://rgxbotfile-default-rtdb.firebaseio.com",
  FIREBASE_PATH = "rgx",
  REQUIRED_CHANNEL = "",
  REQUIRED_CHANNEL_URL = "",
  UPDATE_MODE = "polling",
  POLLING_ENABLED = "true",
  WEBHOOK_URL = "",
  WEBHOOK_SECRET = ""
} = process.env;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required. Create .env from .env.example.");
if (!ADMIN_CHAT_ID) throw new Error("ADMIN_CHAT_ID is required.");

const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    autoStart: false,
    interval: 500,
    params: {
      timeout: 25,
      allowed_updates: ["message", "callback_query"]
    }
  }
});
const states = new Map();
const dataPath = path.resolve(__dirname, "..", "data", "files.json");
const webhookPath = `/telegram/${WEBHOOK_SECRET || crypto.createHash("sha256").update(BOT_TOKEN).digest("hex").slice(0, 32)}`;
let pollingRestartTimer = null;

startHealthServer();
ensureDataFile();
syncFromFirebase().catch(() => {});
bot.setMyCommands([
  { command: "start", description: "Open RGX panel" }
]).catch(() => {});
setAdminMenuButton().catch(() => {});

bot.on("polling_error", (error) => {
  const message = error?.response?.body?.description || error?.message || String(error);
  console.error(`[polling_error] ${message}`);

  if (message.includes("409 Conflict")) {
    console.error("Another instance is using this BOT_TOKEN with getUpdates. Stop the duplicate Render/local bot, or set POLLING_ENABLED=false on the duplicate service.");
    schedulePollingRestart(15000);
    return;
  }

  schedulePollingRestart(8000);
});

bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const payload = match && match[1] ? match[1].trim() : "";
  rememberUser(msg);

  if (isAdmin(chatId) && !payload) {
    await showAdminPanel(chatId);
    return;
  }

  if (payload) {
    await deliverItem(chatId, payload);
    return;
  }

  await bot.sendMessage(chatId, "Welcome to RGX. Open a download link from the official RGX website.");
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const action = query.data || "";
  await bot.answerCallbackQuery(query.id).catch(() => {});

  if (!isAdmin(chatId)) {
    await bot.sendMessage(chatId, "Admin access required.");
    return;
  }

  if (action === "admin:home") {
    states.delete(chatId);
    await showAdminPanel(chatId);
    return;
  }

  if (action === "admin:generate") {
    states.set(chatId, { step: "chooseType" });
    await bot.sendMessage(chatId, "Generate ka type select karo.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Upload File", callback_data: "generate:file" }],
          [{ text: "Direct Link", callback_data: "generate:link" }],
          [{ text: "Back", callback_data: "admin:home" }]
        ]
      }
    });
    return;
  }

  if (action === "generate:file") {
    states.set(chatId, { mode: "file", step: "awaitFile" });
    await bot.sendMessage(chatId, "File forward/upload karo. Document, video, audio, photo, animation supported hai.", backKeyboard());
    return;
  }

  if (action === "generate:link") {
    states.set(chatId, { mode: "link", step: "awaitUrl" });
    await bot.sendMessage(chatId, "Destination URL bhejo.", backKeyboard());
    return;
  }

  if (action === "admin:users") {
    await showUsers(chatId);
    return;
  }

  if (action.startsWith("user:view:")) {
    const userId = action.replace("user:view:", "");
    await showUserActions(chatId, userId);
    return;
  }

  if (action.startsWith("user:ban:")) {
    const userId = action.replace("user:ban:", "");
    await setUserBan(chatId, userId, true);
    return;
  }

  if (action.startsWith("user:unban:")) {
    const userId = action.replace("user:unban:", "");
    await setUserBan(chatId, userId, false);
    return;
  }

  if (action === "admin:files") {
    await showFilesForEdit(chatId);
    return;
  }

  if (action === "admin:broadcast") {
    states.set(chatId, { step: "awaitBroadcastDraft" });
    await bot.sendMessage(chatId, "Broadcast ke liye text, photo, video, document ya audio bhejo. Caption/bold formatting preserve rahegi. Pehle preview aur confirmation aayega.", backKeyboard());
    return;
  }

  if (action === "broadcast:confirm") {
    const state = states.get(chatId);
    if (!state || state.step !== "confirmBroadcast") {
      await bot.sendMessage(chatId, "Broadcast draft not found.", backKeyboard());
      return;
    }
    await sendBroadcastDraft(chatId, state.draft);
    return;
  }

  if (action === "broadcast:edit") {
    const state = states.get(chatId);
    if (!state || state.step !== "confirmBroadcast") {
      await bot.sendMessage(chatId, "Broadcast draft not found.", backKeyboard());
      return;
    }
    state.step = "awaitBroadcastEdit";
    states.set(chatId, state);
    await bot.sendMessage(chatId, "Naya text/caption bhejo. Bold/formatting jis tarah bhejoge, waise hi jayegi.", backKeyboard());
    return;
  }

  if (action === "broadcast:cancel") {
    states.delete(chatId);
    await bot.sendMessage(chatId, "Broadcast cancelled.", backKeyboard());
    return;
  }

  if (action.startsWith("file:toggle:")) {
    const id = action.replace("file:toggle:", "");
    await toggleFile(chatId, id);
    return;
  }

  if (action.startsWith("file:delete:")) {
    const id = action.replace("file:delete:", "");
    await confirmDeleteFile(chatId, id);
    return;
  }

  if (action.startsWith("file:deleteYes:")) {
    const id = action.replace("file:deleteYes:", "");
    await deleteFile(chatId, id);
    return;
  }

  if (action.startsWith("file:view:")) {
    const id = action.replace("file:view:", "");
    await showFileActions(chatId, id);
    return;
  }

  if (action === "admin:channel") {
    states.set(chatId, { step: "awaitChannel" });
    await bot.sendMessage(chatId, "Channel link ya username bhejo. Example: https://t.me/yourchannel ya @yourchannel\n\nBot ko us channel me admin banana zaroori hai.", backKeyboard());
    return;
  }

  if (action === "admin:social") {
    await showSocialPanel(chatId);
    return;
  }

  if (action.startsWith("social:set:")) {
    const key = action.replace("social:set:", "");
    states.set(chatId, { step: "awaitSocial", socialKey: key });
    await bot.sendMessage(chatId, `${key.toUpperCase()} link bhejo.`, backKeyboard());
    return;
  }

  if (action === "files:deleteAll") {
    await confirmDeleteAll(chatId);
    return;
  }

  if (action === "files:deleteAllYes") {
    await deleteAllFiles(chatId);
    return;
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  rememberUser(msg);

  if (msg.web_app_data && isAdmin(chatId)) {
    await handleMiniAppData(chatId, msg.web_app_data.data);
    return;
  }

  if (msg.text && msg.text.startsWith("/start")) return;
  if (!isAdmin(chatId)) return;

  const state = states.get(chatId);
  if (!state) {
    if (msg.text === "Generate Link") {
      states.set(chatId, { step: "chooseType" });
      await bot.sendMessage(chatId, "Generate ka type select karo.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Upload File", callback_data: "generate:file" }],
            [{ text: "Direct Link", callback_data: "generate:link" }],
            [{ text: "Back", callback_data: "admin:home" }]
          ]
        }
      });
      return;
    }
    if (msg.text === "Channel") {
      states.set(chatId, { step: "awaitChannel" });
      await bot.sendMessage(chatId, "Channel link ya username bhejo. Example: https://t.me/yourchannel ya @yourchannel", backKeyboard());
      return;
    }
    if (msg.text === "Official Links") {
      await showSocialPanel(chatId);
      return;
    }
    if (msg.text === "Edit Files") {
      await showFilesForEdit(chatId);
      return;
    }
    return;
  }

  if (state.step === "awaitUrl") {
    const url = (msg.text || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      await bot.sendMessage(chatId, "Valid http/https URL bhejo.", backKeyboard());
      return;
    }
    state.destinationUrl = url;
    state.step = "awaitTitle";
    states.set(chatId, state);
    await bot.sendMessage(chatId, "Display name bhejo. Bold, emoji, styled Telegram text jaise bhejoge waise bot me preserve hoga.", backKeyboard());
    return;
  }

  if (state.step === "awaitFile") {
    const media = extractMedia(msg);
    if (!media) {
      await bot.sendMessage(chatId, "Supported file upload/forward karo.", backKeyboard());
      return;
    }

    Object.assign(state, media, {
      title: media.fileName || "RGX Premium File",
      caption: msg.caption || "",
      titleEntities: []
    });
    state.step = "awaitTitle";
    states.set(chatId, state);
    await bot.sendMessage(chatId, `File received.\nCurrent name: ${state.title}\n\nFinal display name bhejo.`, backKeyboard());
    return;
  }

  if (state.step === "awaitTitle") {
    const title = (msg.text || "").trim();
    if (!title) {
      await bot.sendMessage(chatId, "Display name text bhejo.", backKeyboard());
      return;
    }
    state.title = title;
    state.titleEntities = msg.entities || [];
    await finishDraft(chatId, state);
    return;
  }

  if (state.step === "awaitBroadcastDraft") {
    await prepareBroadcastDraft(chatId, msg);
    return;
  }

  if (state.step === "awaitBroadcastEdit") {
    await editBroadcastDraft(chatId, msg);
    return;
  }

  if (state.step === "awaitChannel") {
    const input = (msg.text || "").trim();
    const parsed = parseChannelInput(input);
    if (!parsed.channel) {
      await bot.sendMessage(chatId, "Valid channel username/link bhejo. Example: @yourchannel", backKeyboard());
      return;
    }

    const db = readDb();
    db.settings.requiredChannel = parsed.channel;
    db.settings.requiredChannelUrl = parsed.url;
    writeDb(db);
    states.delete(chatId);
    await bot.sendMessage(chatId, `Channel saved:\n${parsed.channel}\n${parsed.url}\n\nBot ko channel admin banana mat bhoolna.`, backKeyboard());
    await deploySite(chatId, "Channel updated");
    return;
  }

  if (state.step === "awaitSocial") {
    const url = (msg.text || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      await bot.sendMessage(chatId, "Valid https link bhejo.", backKeyboard());
      return;
    }

    const db = readDb();
    db.settings.socialLinks = db.settings.socialLinks || {};
    db.settings.socialLinks[state.socialKey] = url;
    writeDb(db);
    states.delete(chatId);
    await bot.sendMessage(chatId, `${state.socialKey.toUpperCase()} link saved:\n${url}`, backKeyboard());
    await deploySite(chatId, "Official links updated");
  }
});

async function showAdminPanel(chatId) {
  const db = readDb();
  const totalUsers = Object.keys(db.users).length;
  const totalFiles = db.files.length;
  const activeFiles = db.files.filter((file) => file.active !== false).length;
  const channel = getRequiredChannel(db).channel || "Not set";

  await bot.sendMessage(chatId, `RGX Admin Panel\n\nUsers: ${totalUsers}\nFiles: ${activeFiles}/${totalFiles} active\nChannel: ${channel}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Generate Link", callback_data: "admin:generate" }],
        [{ text: `Users (${totalUsers})`, callback_data: "admin:users" }, { text: "Broadcast", callback_data: "admin:broadcast" }],
        [{ text: "Edit Files", callback_data: "admin:files" }, { text: "Bulk Delete", callback_data: "files:deleteAll" }],
        [{ text: "Channel", callback_data: "admin:channel" }, { text: "Official Links", callback_data: "admin:social" }]
      ]
    }
  });

  await bot.sendMessage(chatId, "Quick controls", adminReplyKeyboard());
}

async function finishDraft(chatId, state) {
  const id = createSlug();
  const botUrl = `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(id)}`;
  const pageUrl = `${PUBLIC_SITE_URL.replace(/\/$/, "")}/download.html?id=${encodeURIComponent(id)}`;
  const shortenedUrl = await shortenUrl(botUrl);
  const db = readDb();
  const item = {
    id,
    active: true,
    mode: state.mode,
    title: state.title,
    titleEntities: state.titleEntities || [],
    fileName: state.fileName || state.title,
    caption: state.caption || "",
    extension: state.extension || (state.mode === "link" ? "LINK" : "FILE"),
    sizeLabel: state.sizeLabel || "",
    fileId: state.fileId || "",
    fileType: state.fileType || "",
    destinationUrl: state.destinationUrl || "",
    botUrl,
    pageUrl,
    shortenedUrl,
    createdAt: new Date().toISOString()
  };

  db.files.push(item);
  writeDb(db);
  states.delete(chatId);

  await bot.sendMessage(chatId, `Generated successfully:\n\n${pageUrl}\n\nShortener:\n${shortenedUrl || "Shortener failed, website will use Telegram link."}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Open Page", url: pageUrl }],
        [{ text: "Generate Another", callback_data: "admin:generate" }],
        [{ text: "Back", callback_data: "admin:home" }]
      ]
    }
  });
  await deploySite(chatId, "New file published");
}

async function deliverItem(chatId, id) {
  const db = readDb();
  const item = db.files.find((file) => file.id === id);
  const user = db.users[String(chatId)];
  if (user && user.banned) {
    await bot.sendMessage(chatId, "Your RGX access is banned.");
    return;
  }

  if (!item || item.active === false) {
    await bot.sendMessage(chatId, "This RGX file is currently not available.");
    return;
  }

  if (!(await canAccess(chatId, db))) {
    const channel = getRequiredChannel(db);
    await bot.sendMessage(chatId, `Premium access locked.\n\nChannel join karo, phir Restart dabao. Iske baad wahi file automatically mil jayegi.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Join Channel", url: channel.url || "https://t.me/" }],
          [{ text: "Restart Download", url: item.botUrl }]
        ]
      }
    });
    return;
  }

  item.downloads = Number(item.downloads || 0) + 1;
  item.lastDownloadedAt = new Date().toISOString();
  writeDb(db);

  if (item.mode === "link") {
    await bot.sendMessage(chatId, item.title, {
      entities: item.titleEntities || [],
      reply_markup: { inline_keyboard: [[{ text: "Open Download Link", url: item.destinationUrl }]] }
    });
    return;
  }

  await sendStoredFile(chatId, item);
}

async function sendStoredFile(chatId, item) {
  const options = { caption: item.title, caption_entities: item.titleEntities || [] };
  if (item.fileType === "photo") return bot.sendPhoto(chatId, item.fileId, options);
  if (item.fileType === "video") return bot.sendVideo(chatId, item.fileId, options);
  if (item.fileType === "audio") return bot.sendAudio(chatId, item.fileId, options);
  if (item.fileType === "animation") return bot.sendAnimation(chatId, item.fileId, options);
  return bot.sendDocument(chatId, item.fileId, options);
}

async function showUsers(chatId) {
  const users = Object.values(readDb().users).sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
  if (!users.length) {
    await bot.sendMessage(chatId, "Users abhi empty hai.", backKeyboard());
    return;
  }

  const text = users.slice(0, 30).map((user, index) => {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "No name";
    const username = user.username ? `@${user.username}` : "no username";
    return `${index + 1}. ${user.banned ? "BANNED - " : ""}${name} (${username})\nID: ${user.id}`;
  }).join("\n\n");

  const keyboard = users.slice(0, 30).map((user) => ([{
    text: `${user.banned ? "BANNED - " : ""}${trim([user.firstName, user.lastName].filter(Boolean).join(" ") || String(user.id), 28)}`,
    callback_data: `user:view:${user.id}`
  }]));
  keyboard.push([{ text: "Back", callback_data: "admin:home" }]);

  await bot.sendMessage(chatId, `Total users: ${users.length}\n\n${text}`, {
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function showUserActions(chatId, userId) {
  const user = readDb().users[String(userId)];
  if (!user) {
    await bot.sendMessage(chatId, "User not found.", backKeyboard());
    return;
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "No name";
  await bot.sendMessage(chatId, `User Details\n\nName: ${name}\nUsername: ${user.username ? `@${user.username}` : "None"}\nID: ${user.id}\nStatus: ${user.banned ? "BANNED" : "ACTIVE"}\nLast Seen: ${formatDate(user.lastSeenAt)}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: user.banned ? "Unban User" : "Ban User", callback_data: `${user.banned ? "user:unban" : "user:ban"}:${user.id}` }],
        [{ text: "Back", callback_data: "admin:users" }]
      ]
    }
  });
}

async function setUserBan(chatId, userId, banned) {
  const db = readDb();
  const user = db.users[String(userId)];
  if (!user) {
    await bot.sendMessage(chatId, "User not found.", backKeyboard());
    return;
  }

  user.banned = banned;
  user.bannedAt = banned ? new Date().toISOString() : "";
  writeDb(db);
  await showUserActions(chatId, userId);
  await deploySite(chatId, banned ? "User banned" : "User unbanned");
}

async function showFilesForEdit(chatId) {
  const files = readDb().files.slice(-20).reverse();
  if (!files.length) {
    await bot.sendMessage(chatId, "No generated files yet.", backKeyboard());
    return;
  }

  const keyboard = files.map((file) => ([{
    text: `${file.active === false ? "OFF" : "ON"} - ${trim(file.fileName || file.title, 24)} (${file.downloads || 0})`,
    callback_data: `file:view:${file.id}`
  }]));
  keyboard.push([{ text: "Delete All Files", callback_data: "files:deleteAll" }]);
  keyboard.push([{ text: "Back", callback_data: "admin:home" }]);

  await bot.sendMessage(chatId, "Edit Files: kisi file ko select karke ON/OFF kar sakte ho.", {
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function showFileActions(chatId, id) {
  const file = readDb().files.find((item) => item.id === id);
  if (!file) {
    await bot.sendMessage(chatId, "File not found.", backKeyboard());
    return;
  }

  await bot.sendMessage(chatId, `${file.fileName || file.title}\n\nDisplay Text:\n${file.title}\n\nStatus: ${file.active === false ? "OFF" : "ON"}\nDownloads: ${file.downloads || 0}\nCreated: ${formatDate(file.createdAt)}\nLast Download: ${formatDate(file.lastDownloadedAt)}\n\n${file.pageUrl}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: file.active === false ? "Turn ON" : "Turn OFF", callback_data: `file:toggle:${file.id}` }],
        [{ text: "Delete File", callback_data: `file:delete:${file.id}` }],
        [{ text: "Open Page", url: file.pageUrl }],
        [{ text: "Back", callback_data: "admin:files" }]
      ]
    }
  });
}

async function toggleFile(chatId, id) {
  const db = readDb();
  const file = db.files.find((item) => item.id === id);
  if (!file) {
    await bot.sendMessage(chatId, "File not found.", backKeyboard());
    return;
  }

  file.active = file.active === false;
  writeDb(db);
  await showFileActions(chatId, id);
  await deploySite(chatId, "File status updated");
}

async function confirmDeleteAll(chatId) {
  const total = readDb().files.length;
  await bot.sendMessage(chatId, `Delete ALL files permanently?\n\nTotal files: ${total}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Yes, Delete All", callback_data: "files:deleteAllYes" }],
        [{ text: "Cancel", callback_data: "admin:files" }]
      ]
    }
  });
}

async function deleteAllFiles(chatId) {
  const db = readDb();
  const total = db.files.length;
  db.files = [];
  writeDb(db);
  await bot.sendMessage(chatId, `All files deleted.\nRemoved: ${total}`, backKeyboard());
  await deploySite(chatId, "All files deleted");
}

async function confirmDeleteFile(chatId, id) {
  const file = readDb().files.find((item) => item.id === id);
  if (!file) {
    await bot.sendMessage(chatId, "File not found.", backKeyboard());
    return;
  }

  await bot.sendMessage(chatId, `Delete this file permanently?\n\n${file.fileName || file.title}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Yes, Delete", callback_data: `file:deleteYes:${file.id}` }],
        [{ text: "Cancel", callback_data: `file:view:${file.id}` }]
      ]
    }
  });
}

async function deleteFile(chatId, id) {
  const db = readDb();
  const before = db.files.length;
  db.files = db.files.filter((item) => item.id !== id);
  writeDb(db);

  if (db.files.length === before) {
    await bot.sendMessage(chatId, "File not found.", backKeyboard());
    return;
  }

  await bot.sendMessage(chatId, "File deleted.", backKeyboard());
  await deploySite(chatId, "File deleted");
}

async function prepareBroadcastDraft(adminChatId, msg) {
  const draft = createBroadcastDraft(adminChatId, msg);
  if (!draft) {
    await bot.sendMessage(adminChatId, "Supported broadcast message bhejo: text, photo, video, document, audio, animation.", backKeyboard());
    return;
  }

  states.set(adminChatId, { step: "confirmBroadcast", draft });
  await showBroadcastPreview(adminChatId, draft);
}

async function editBroadcastDraft(adminChatId, msg) {
  const state = states.get(adminChatId);
  if (!state || !state.draft) {
    await bot.sendMessage(adminChatId, "Broadcast draft not found.", backKeyboard());
    return;
  }

  const text = msg.text || msg.caption || "";
  if (!text.trim()) {
    await bot.sendMessage(adminChatId, "Text/caption empty hai. Naya text bhejo.", backKeyboard());
    return;
  }

  state.draft.text = text;
  state.draft.entities = msg.entities || msg.caption_entities || [];
  state.step = "confirmBroadcast";
  states.set(adminChatId, state);
  await showBroadcastPreview(adminChatId, state.draft);
}

async function showBroadcastPreview(adminChatId, draft) {
  await bot.sendMessage(adminChatId, "Broadcast preview:");

  if (draft.kind === "text") {
    await bot.sendMessage(adminChatId, draft.text, { entities: draft.entities || [] });
  } else {
    await bot.copyMessage(adminChatId, draft.sourceChatId, draft.messageId, {
      caption: draft.text || undefined,
      caption_entities: draft.entities || undefined
    });
  }

  await bot.sendMessage(adminChatId, "Broadcast confirm karna hai?", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Confirm Broadcast", callback_data: "broadcast:confirm" }],
        [{ text: "Edit Text", callback_data: "broadcast:edit" }],
        [{ text: "Cancel", callback_data: "broadcast:cancel" }]
      ]
    }
  });
}

async function sendBroadcastDraft(adminChatId, draft) {
  const allUsers = readDb().users;
  const users = Object.keys(allUsers).filter((id) => String(id) !== String(adminChatId) && !allUsers[id].banned);
  let sent = 0;
  let failed = 0;

  for (const userId of users) {
    try {
      if (draft.kind === "text") {
        await bot.sendMessage(userId, draft.text, { entities: draft.entities || [] });
      } else {
        await bot.copyMessage(userId, draft.sourceChatId, draft.messageId, {
          caption: draft.text || undefined,
          caption_entities: draft.entities || undefined
        });
      }
      sent += 1;
    } catch (error) {
      failed += 1;
    }
  }

  states.delete(adminChatId);
  await bot.sendMessage(adminChatId, `Broadcast done.\nSent: ${sent}\nFailed: ${failed}`, backKeyboard());
}

function createBroadcastDraft(adminChatId, msg) {
  if (msg.text) {
    return {
      kind: "text",
      sourceChatId: adminChatId,
      messageId: msg.message_id,
      text: msg.text,
      entities: msg.entities || []
    };
  }

  const hasMedia = msg.photo || msg.video || msg.document || msg.audio || msg.animation;
  if (!hasMedia) return null;

  return {
    kind: "media",
    sourceChatId: adminChatId,
    messageId: msg.message_id,
    text: msg.caption || "",
    entities: msg.caption_entities || []
  };
}

async function showSocialPanel(chatId) {
  const links = readDb().settings.socialLinks || {};
  await bot.sendMessage(chatId, `Official Links\n\nYouTube: ${links.youtube || "Not set"}\nTelegram: ${links.telegram || "Not set"}\nInstagram: ${links.instagram || "Not set"}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Set YouTube", callback_data: "social:set:youtube" }],
        [{ text: "Set Telegram", callback_data: "social:set:telegram" }],
        [{ text: "Set Instagram", callback_data: "social:set:instagram" }],
        [{ text: "Back", callback_data: "admin:home" }]
      ]
    }
  });
}

async function handleMiniAppData(chatId, rawData) {
  let payload;
  try {
    payload = JSON.parse(rawData);
  } catch (error) {
    await bot.sendMessage(chatId, "Mini app data invalid.", backKeyboard());
    return;
  }

  if (payload.type === "setSocialLinks") {
    const links = payload.links || {};
    const db = readDb();
    db.settings.socialLinks = {
      youtube: validUrl(links.youtube) ? links.youtube : "",
      telegram: validUrl(links.telegram) ? links.telegram : "",
      instagram: validUrl(links.instagram) ? links.instagram : ""
    };
    writeDb(db);
    await bot.sendMessage(chatId, "Official links updated from mini app.", backKeyboard());
    await deploySite(chatId, "Official links updated");
    return;
  }

  if (payload.type === "broadcastText") {
    await broadcastText(chatId, String(payload.text || ""));
    return;
  }

  if (payload.type === "toggleFile" && payload.id) {
    await toggleFile(chatId, String(payload.id));
    return;
  }

  if (payload.type === "deleteFile" && payload.id) {
    await deleteFile(chatId, String(payload.id));
    return;
  }

  if (payload.type === "deleteAllFiles") {
    await deleteAllFiles(chatId);
    return;
  }

  if (payload.type === "banUser" && payload.id) {
    await setUserBan(chatId, String(payload.id), true);
    return;
  }

  if (payload.type === "unbanUser" && payload.id) {
    await setUserBan(chatId, String(payload.id), false);
    return;
  }

  await bot.sendMessage(chatId, "Mini app action not supported.", backKeyboard());
}

async function broadcastText(adminChatId, text) {
  if (!text.trim()) {
    await bot.sendMessage(adminChatId, "Broadcast text empty.", backKeyboard());
    return;
  }

  const allUsers = readDb().users;
  const users = Object.keys(allUsers).filter((id) => String(id) !== String(adminChatId) && !allUsers[id].banned);
  let sent = 0;
  let failed = 0;

  for (const userId of users) {
    try {
      await bot.sendMessage(userId, text);
      sent += 1;
    } catch (error) {
      failed += 1;
    }
  }

  await bot.sendMessage(adminChatId, `Mini app broadcast done.\nSent: ${sent}\nFailed: ${failed}`, backKeyboard());
}

async function showCommands(chatId) {
  await bot.sendMessage(chatId, "Commands\n\n/start - Admin panel", adminReplyKeyboard());
}

async function canAccess(chatId, db = readDb()) {
  const channel = getRequiredChannel(db).channel;
  if (!channel) return true;

  try {
    const member = await bot.getChatMember(channel, chatId);
    return ["creator", "administrator", "member"].includes(member.status);
  } catch (error) {
    return false;
  }
}

async function shortenUrl(url) {
  if (!SHORTENER_API_KEY) return "";

  try {
    const api = `https://www.earnreverse.fun/api/shorten?api=${encodeURIComponent(SHORTENER_API_KEY)}&url=${encodeURIComponent(url)}`;
    const res = await fetch(api);
    const json = await res.json();
    if (json && json.status === "success" && json.shortenedUrl) return json.shortenedUrl;
  } catch (error) {
    return "";
  }

  return "";
}

async function setAdminMenuButton() {
  const body = {
    chat_id: ADMIN_CHAT_ID,
    menu_button: {
      type: "web_app",
      text: "Open Mini App",
      web_app: { url: `${PUBLIC_SITE_URL.replace(/\/$/, "")}/admin.html` }
    }
  };

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function rememberUser(msg) {
  const from = msg.from;
  if (!from || from.is_bot) return;

  const db = readDb();
  db.users[String(from.id)] = {
    ...(db.users[String(from.id)] || {}),
    id: from.id,
    firstName: from.first_name || "",
    lastName: from.last_name || "",
    username: from.username || "",
    lastSeenAt: new Date().toISOString()
  };
  writeDb(db);
}

function extractMedia(msg) {
  if (msg.document) return fileMeta("document", msg.document.file_id, msg.document.file_name, msg.document.file_size);
  if (msg.video) return fileMeta("video", msg.video.file_id, msg.video.file_name || "video.mp4", msg.video.file_size);
  if (msg.audio) return fileMeta("audio", msg.audio.file_id, msg.audio.file_name || msg.audio.title || "audio.mp3", msg.audio.file_size);
  if (msg.animation) return fileMeta("animation", msg.animation.file_id, msg.animation.file_name || "animation.mp4", msg.animation.file_size);
  if (msg.photo) {
    return {
      fileType: "photo",
      fileId: msg.photo[msg.photo.length - 1].file_id,
      fileName: "photo.jpg",
      extension: "JPG",
      sizeLabel: ""
    };
  }
  return null;
}

function fileMeta(fileType, fileId, fileName, size) {
  const extension = path.extname(fileName || "").replace(".", "").toUpperCase() || "FILE";
  return { fileType, fileId, fileName, extension, sizeLabel: formatSize(size) };
}

function formatSize(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function parseChannelInput(input) {
  if (!input) return { channel: "", url: "" };
  const match = input.match(/(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]+)/i);
  if (match) {
    return { channel: `@${match[1]}`, url: `https://t.me/${match[1]}` };
  }
  if (input.startsWith("@")) {
    return { channel: input, url: `https://t.me/${input.slice(1)}` };
  }
  return { channel: "", url: "" };
}

function getRequiredChannel(db) {
  return {
    channel: db.settings.requiredChannel || REQUIRED_CHANNEL || "",
    url: db.settings.requiredChannelUrl || REQUIRED_CHANNEL_URL || ""
  };
}

function validUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function backKeyboard() {
  return { reply_markup: { inline_keyboard: [[{ text: "Back", callback_data: "admin:home" }]] } };
}

function adminReplyKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: "/start" }, { text: "Generate Link" }],
        [{ text: "Channel" }, { text: "Official Links" }],
        [{ text: "Edit Files" }]
      ],
      resize_keyboard: true
    }
  };
}

function trim(value, length) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function isAdmin(chatId) {
  return String(chatId) === String(ADMIN_CHAT_ID);
}

function createSlug() {
  return crypto.randomBytes(4).toString("hex");
}

function ensureDataFile() {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify(defaultDb(), null, 2));
    return;
  }

  const db = readDb(false);
  writeDb({
    files: Array.isArray(db.files) ? db.files.map((file) => ({ active: true, titleEntities: [], downloads: 0, fileName: file.fileName || file.title || "RGX File", ...file })) : [],
    posts: Array.isArray(db.posts) ? db.posts : [],
    users: db.users && typeof db.users === "object" ? db.users : {},
    settings: db.settings && typeof db.settings === "object" ? { socialLinks: {}, ...db.settings } : { socialLinks: {} }
  });
}

function readDb(ensure = true) {
  if (ensure && !fs.existsSync(dataPath)) ensureDataFile();
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    return {
      files: Array.isArray(data.files) ? data.files : [],
      posts: Array.isArray(data.posts) ? data.posts : [],
      users: data.users && typeof data.users === "object" ? data.users : {},
      settings: data.settings && typeof data.settings === "object" ? data.settings : {}
    };
  } catch (error) {
    return defaultDb();
  }
}

function writeDb(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  pushToFirebase(data).catch(() => {});
}

async function syncFromFirebase() {
  const data = await fetchFirebaseData();
  if (!data) {
    await pushToFirebase(readDb());
    return;
  }

  fs.writeFileSync(dataPath, JSON.stringify(normalizeDb(data), null, 2));
}

async function fetchFirebaseData() {
  try {
    const res = await fetch(firebaseUrl());
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object") return null;
    return data;
  } catch (error) {
    return null;
  }
}

async function pushToFirebase(data) {
  try {
    await fetch(firebaseUrl(), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(normalizeDb(data))
    });
  } catch (error) {
    // Local JSON remains as a cache if Firebase rules/network reject the write.
  }
}

function firebaseUrl() {
  return `${FIREBASE_DATABASE_URL.replace(/\/$/, "")}/${FIREBASE_PATH}.json`;
}

function normalizeDb(data) {
  return {
    files: Array.isArray(data.files) ? data.files : [],
    posts: Array.isArray(data.posts) ? data.posts : [],
    users: data.users && typeof data.users === "object" ? data.users : {},
    settings: data.settings && typeof data.settings === "object" ? { socialLinks: {}, ...data.settings } : { socialLinks: {} }
  };
}

function deploySite(chatId, reason) {
  if (AUTO_DEPLOY !== "true") return Promise.resolve();

  return new Promise((resolve) => {
    const rootDir = path.resolve(__dirname, "..");
    const args = ["vercel", "deploy", "--prod", "--yes", "--scope", VERCEL_SCOPE];

    bot.sendMessage(chatId, `${reason}. Website deploy start ho raha hai...`).catch(() => {});

    execFile("cmd.exe", ["/d", "/s", "/c", "npx.cmd", ...args], { cwd: rootDir, timeout: 240000, windowsHide: true }, async (error, stdout, stderr) => {
      const output = `${stdout || ""}\n${stderr || ""}`;
      const match = output.match(/Aliased:\s+(https?:\/\/\S+)/) || output.match(/Production:\s+(https?:\/\/\S+)/);

      if (error) {
        await bot.sendMessage(chatId, "Website auto deploy failed. Manual Vercel deploy run karna padega.").catch(() => {});
        resolve();
        return;
      }

      await bot.sendMessage(chatId, `Website live updated${match ? `:\n${match[1]}` : "."}`).catch(() => {});
      resolve();
    });
  });
}

function defaultDb() {
  return { files: [], posts: [], users: {}, settings: { socialLinks: {} } };
}

function startHealthServer() {
  const port = Number(process.env.PORT || 3000);
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === webhookPath) {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1_000_000) req.destroy();
      });
      req.on("end", () => {
        try {
          const update = JSON.parse(body || "{}");
          bot.processUpdate(update);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          console.error(`Webhook update failed: ${error.message}`);
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false }));
        }
      });
      return;
    }

    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        service: "rgx-telegram-bot",
        mode: UPDATE_MODE,
        uptime: Math.round(process.uptime()),
        time: new Date().toISOString()
      }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });

  server.on("error", (error) => {
    console.error(`Health server failed on ${port}: ${error.message}`);
  });

  server.listen(port, () => {
    console.log(`Health server listening on ${port}`);
  });
}

async function startTelegramPolling() {
  if (UPDATE_MODE === "webhook") {
    console.log("Telegram polling disabled because UPDATE_MODE=webhook.");
    return;
  }

  if (POLLING_ENABLED !== "true") {
    console.log("Telegram polling is disabled. Health server only.");
    return;
  }

  try {
    await clearTelegramWebhook();
    await bot.startPolling({ restart: true });
    console.log("RGX Telegram polling started.");
  } catch (error) {
    console.error(`Telegram polling failed to start: ${error.message}`);
    schedulePollingRestart(10000);
  }
}

function schedulePollingRestart(delayMs) {
  if (POLLING_ENABLED !== "true" || pollingRestartTimer) return;
  pollingRestartTimer = setTimeout(async () => {
    pollingRestartTimer = null;
    try {
      await bot.stopPolling({ cancel: true });
    } catch (error) {
      // It is fine if polling was already stopped.
    }
    await startTelegramPolling();
  }, delayMs);
}

async function clearTelegramWebhook() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`deleteWebhook failed: ${res.status} ${text}`);
      return;
    }
    console.log("Telegram webhook cleared.");
  } catch (error) {
    console.error(`deleteWebhook request failed: ${error.message}`);
  }
}

async function startTelegramUpdates() {
  if (UPDATE_MODE === "webhook") {
    await startTelegramWebhook();
    return;
  }

  await startTelegramPolling();
}

async function startTelegramWebhook() {
  const baseUrl = WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL || "";
  if (!baseUrl) {
    console.error("UPDATE_MODE=webhook requires WEBHOOK_URL or RENDER_EXTERNAL_URL.");
    return;
  }

  const url = `${baseUrl.replace(/\/$/, "")}${webhookPath}`;
  try {
    await bot.stopPolling({ cancel: true }).catch(() => {});
    await bot.setWebHook(url, {
      drop_pending_updates: true,
      allowed_updates: ["message", "callback_query"]
    });
    console.log(`Telegram webhook set: ${url.replace(webhookPath, "/telegram/<secret>")}`);
  } catch (error) {
    console.error(`Telegram webhook failed to start: ${error.message}`);
  }
}

startTelegramUpdates();
console.log("RGX Telegram bot booted.");
