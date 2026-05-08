const FIREBASE_URL = "https://rgxbotfile-default-rtdb.firebaseio.com/rgx.json";
const CLOUDINARY_CLOUD_NAME = "dbuwndic4";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";

export const emptyData = {
  files: [],
  posts: [],
  users: {},
  settings: { socialLinks: {} }
};

export async function loadRgxData() {
  try {
    const res = await fetch(`${FIREBASE_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) return normalizeData(await res.json());
  } catch {
    // Static fallback below.
  }
  return normalizeData(emptyData);
}

export async function saveRgxData(data) {
  const res = await fetch(FIREBASE_URL, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(normalizeData(data))
  });
  if (!res.ok) throw new Error("Firebase write failed");
}

export async function uploadImage(file) {
  if (!file || !file.size) return "";
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body
  });
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const data = await res.json();
  return data.secure_url || "";
}

export function normalizeData(data = {}) {
  return {
    files: normalizeList(data.files),
    posts: normalizeList(data.posts),
    users: data.users && typeof data.users === "object" ? data.users : {},
    settings: data.settings && typeof data.settings === "object" ? data.settings : { socialLinks: {} }
  };
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}

export function createId() {
  if (crypto?.randomUUID) return crypto.randomUUID().slice(0, 12);
  return Math.random().toString(16).slice(2, 14);
}

export function downloadUrl(file) {
  return `${location.origin}/download?id=${encodeURIComponent(file.id)}`;
}

export function postUrl(post) {
  return `${location.origin}/?post=${encodeURIComponent(post.id)}`;
}

export function sortedPosts(posts) {
  return posts
    .filter((post) => post && post.active !== false)
    .slice()
    .sort((a, b) => String(b.createdAt || b.timestamp || "").localeCompare(String(a.createdAt || a.timestamp || "")));
}

export function formatDate(value) {
  if (!value) return "Latest";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function extractYouTubeId(link = "") {
  const match = String(link).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : "";
}
