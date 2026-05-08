const RGX_FIREBASE_URL = "https://rgxbotfile-default-rtdb.firebaseio.com/rgx.json";

async function loadRgxData() {
  try {
    const res = await fetch(`${RGX_FIREBASE_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") return normalizeRgxData(data);
    }
  } catch (error) {
    // Fallback below keeps the static site usable if Firebase rules are closed.
  }

  try {
    const res = await fetch("./data/files.json", { cache: "no-store" });
    if (res.ok) return normalizeRgxData(await res.json());
  } catch (error) {
    return normalizeRgxData({});
  }

  return normalizeRgxData({});
}

function normalizeRgxData(data) {
  return {
    files: Array.isArray(data.files) ? data.files : [],
    posts: Array.isArray(data.posts) ? data.posts : [],
    users: data.users && typeof data.users === "object" ? data.users : {},
    settings: data.settings && typeof data.settings === "object" ? data.settings : { socialLinks: {} }
  };
}
