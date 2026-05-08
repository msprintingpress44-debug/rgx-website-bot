const ADMIN_PASSWORD = "reverse";
const FIREBASE_WRITE_URL = "https://rgxbotfile-default-rtdb.firebaseio.com/rgx.json";
const CLOUDINARY_CLOUD_NAME = "dbuwndic4";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";

let rgxData = { files: [], posts: [], users: {}, settings: {} };

(async function initAdmin() {
  const login = document.querySelector("#adminLogin");
  const app = document.querySelector("#adminApp");
  const form = document.querySelector("#postForm");
  const supportForm = document.querySelector("#supportForm");

  if (sessionStorage.getItem("rgxAdmin") === "1") {
    login.classList.add("hidden");
    app.classList.remove("hidden");
    await refreshAdmin();
  }

  document.querySelector("#loginBtn").addEventListener("click", async () => {
    const value = document.querySelector("#adminPassword").value.trim().toLowerCase();
    if (value !== ADMIN_PASSWORD) {
      document.querySelector("#loginError").textContent = "Wrong password.";
      return;
    }
    sessionStorage.setItem("rgxAdmin", "1");
    login.classList.add("hidden");
    app.classList.remove("hidden");
    await refreshAdmin();
  });

  document.querySelector("#refreshAdmin").addEventListener("click", refreshAdmin);
  document.querySelector("#copyLatest").addEventListener("click", copyLatestPost);
  document.querySelector("#cancelEditBtn").addEventListener("click", () => resetPostForm(form));
  document.querySelector("#logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("rgxAdmin");
    location.reload();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await savePost(new FormData(form));
    } catch (error) {
      document.querySelector("#refreshStatus").textContent = "Save failed";
      alert(error.message || "Post save failed.");
    }
  });

  supportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    rgxData.settings = rgxData.settings || {};
    rgxData.settings.socialLinks = {
      youtube: document.querySelector("#youtubeLink").value.trim(),
      telegram: document.querySelector("#telegramLink").value.trim(),
      instagram: document.querySelector("#instagramLink").value.trim()
    };
    await writeData();
    await refreshAdmin();
    alert("Support links saved.");
  });

  document.querySelectorAll(".admin-tab[data-tab]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });
})();

async function refreshAdmin() {
  rgxData = await loadRgxData();
  renderStats();
  renderFileOptions();
  renderSupportLinks();
  renderPosts();
  renderDownloads();
  renderAnalytics();
  renderUsers();
  document.querySelector("#refreshStatus").textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

function activateTab(name) {
  document.querySelectorAll(".admin-tab[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === name);
  });
}

function renderStats() {
  const posts = rgxData.posts || [];
  const files = rgxData.files || [];
  const users = rgxData.users || {};
  document.querySelector("#stats").innerHTML = [
    ["Posts", posts.length],
    ["Files", files.length],
    ["Users", Object.keys(users).length],
    ["Active Posts", posts.filter((post) => post.active !== false).length]
  ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function renderFileOptions() {
  const select = document.querySelector("#fileLinkSelect");
  const files = rgxData.files || [];
  select.innerHTML = '<option value="">Select bot/file link</option>' + files.slice().reverse().map((file) => {
    const url = `${location.origin}/download.html?id=${encodeURIComponent(file.id)}`;
    return `<option value="${escapeHtml(url)}">${escapeHtml(file.fileName || file.title || file.id)}</option>`;
  }).join("");

  select.onchange = () => {
    if (select.value) document.querySelector("#buttonUrl").value = select.value;
  };
}

function renderSupportLinks() {
  const links = (rgxData.settings && rgxData.settings.socialLinks) || {};
  document.querySelector("#youtubeLink").value = links.youtube || "";
  document.querySelector("#telegramLink").value = links.telegram || "";
  document.querySelector("#instagramLink").value = links.instagram || "";
}

async function savePost(formData) {
  const imageFile = formData.get("image");
  const editingId = String(formData.get("editingPostId") || "").trim();
  const existing = editingId ? (rgxData.posts || []).find((item) => item.id === editingId) : null;
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const uploadedImage = imageUrl || (imageFile && imageFile.size ? await uploadImageToCloudinary(imageFile) : "");
  const post = {
    id: editingId || createId(),
    active: existing ? existing.active !== false : true,
    title: String(formData.get("title") || "").trim(),
    category: String(formData.get("category") || "Downloads").trim(),
    subtitle: String(formData.get("subtitle") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    image: uploadedImage || (existing && existing.image) || "",
    buttonText: String(formData.get("buttonText") || "Download Now").trim(),
    buttonUrl: String(formData.get("buttonUrl") || "").trim(),
    buttonColor: String(formData.get("buttonColor") || "#ef1f2d").trim(),
    createdAt: (existing && existing.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!post.title || !post.buttonUrl) {
    alert("Title and button link required.");
    return;
  }

  rgxData.posts = Array.isArray(rgxData.posts) ? rgxData.posts : [];
  if (existing) {
    rgxData.posts = rgxData.posts.map((item) => item.id === editingId ? post : item);
  } else {
    rgxData.posts.push(post);
  }
  await writeData();
  resetPostForm(document.querySelector("#postForm"));
  await refreshAdmin();
  await navigator.clipboard.writeText(postLink(post.id)).catch(() => {});
  alert(`${existing ? "Post updated" : "Post published"}:\n${postLink(post.id)}`);
}

function renderPosts() {
  const target = document.querySelector("#postList");
  const posts = rgxData.posts || [];
  if (!posts.length) {
    target.innerHTML = "<p>No posts yet.</p>";
    return;
  }

  target.innerHTML = posts.slice().reverse().map((post) => `
    <article>
      <div>
        <strong>${escapeHtml(post.title)}</strong>
        <small>${escapeHtml(post.category || "Downloads")} | ${post.active === false ? "Hidden" : "Published"}</small>
        <small>${escapeHtml(post.createdAt || "")}</small>
        <small>${escapeHtml(postLink(post.id))}</small>
      </div>
      <div>
        <button type="button" data-action="open" data-id="${escapeHtml(post.id)}">Open</button>
        <button type="button" data-action="copy" data-id="${escapeHtml(post.id)}">Copy</button>
        <button type="button" data-action="edit" data-id="${escapeHtml(post.id)}">Edit</button>
        <button type="button" data-action="toggle" data-id="${escapeHtml(post.id)}">${post.active === false ? "Enable" : "Disable"}</button>
        <button type="button" data-action="delete" data-id="${escapeHtml(post.id)}">Delete</button>
      </div>
    </article>
  `).join("");

  target.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", async () => {
      const post = posts.find((item) => item.id === button.dataset.id);
      if (!post) return;
      if (button.dataset.action === "open") {
        window.open(postLink(post.id), "_blank", "noopener");
      }
      if (button.dataset.action === "copy") {
        await navigator.clipboard.writeText(postLink(post.id)).catch(() => {});
        alert("Copied.");
      }
      if (button.dataset.action === "edit") {
        fillPostForm(post);
        activateTab("posts");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (button.dataset.action === "toggle") {
        post.active = post.active === false;
        await writeData();
        await refreshAdmin();
      }
      if (button.dataset.action === "delete" && confirm("Delete this post?")) {
        rgxData.posts = posts.filter((item) => item.id !== post.id);
        await writeData();
        await refreshAdmin();
      }
    });
  });
}

function renderDownloads() {
  const target = document.querySelector("#downloadAdminList");
  const files = rgxData.files || [];
  if (!files.length) {
    target.innerHTML = "<p>No generated downloads yet.</p>";
    return;
  }

  target.innerHTML = files.slice().reverse().map((file) => `
    <article>
      <div>
        <strong>${escapeHtml(file.fileName || file.title || "RGX File")}</strong>
        <small>${escapeHtml(file.sizeLabel || "")} | ${file.downloads || 0} downloads</small>
        <small>${location.origin}/download.html?id=${escapeHtml(file.id)}</small>
      </div>
      <div>
        <button type="button" data-copy-download="${escapeHtml(file.id)}">Copy</button>
        <button type="button" data-open-download="${escapeHtml(file.id)}">Open</button>
        <button type="button" data-toggle-download="${escapeHtml(file.id)}">${file.active === false ? "Enable" : "Disable"}</button>
        <button type="button" data-delete-download="${escapeHtml(file.id)}">Delete</button>
      </div>
    </article>
  `).join("");

  target.querySelectorAll("[data-copy-download]").forEach((button) => {
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(`${location.origin}/download.html?id=${button.dataset.copyDownload}`).catch(() => {});
      alert("Download link copied.");
    });
  });
  target.querySelectorAll("[data-open-download]").forEach((button) => {
    button.addEventListener("click", () => {
      window.open(`${location.origin}/download.html?id=${button.dataset.openDownload}`, "_blank", "noopener");
    });
  });
  target.querySelectorAll("[data-toggle-download]").forEach((button) => {
    button.addEventListener("click", async () => {
      const file = files.find((item) => item.id === button.dataset.toggleDownload);
      if (!file) return;
      file.active = file.active === false;
      await writeData();
      await refreshAdmin();
    });
  });
  target.querySelectorAll("[data-delete-download]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this generated download?")) return;
      rgxData.files = files.filter((item) => item.id !== button.dataset.deleteDownload);
      await writeData();
      await refreshAdmin();
    });
  });
}

function renderAnalytics() {
  const target = document.querySelector("#analyticsList");
  const files = (rgxData.files || []).slice().sort((a, b) => Number(b.downloads || 0) - Number(a.downloads || 0));
  const posts = rgxData.posts || [];
  target.innerHTML = `
    <article><div><strong>Total Posts</strong><small>${posts.length}</small></div></article>
    <article><div><strong>Total Downloads</strong><small>${files.reduce((sum, file) => sum + Number(file.downloads || 0), 0)}</small></div></article>
    ${files.slice(0, 10).map((file) => `<article><div><strong>${escapeHtml(file.fileName || file.title || "RGX File")}</strong><small>${file.downloads || 0} downloads</small></div></article>`).join("")}
  `;
}

function renderUsers() {
  const users = Object.values(rgxData.users || {}).sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
  document.querySelector("#adminUsers").innerHTML = users.length ? users.slice(0, 40).map((user) => `
    <article>
      <div>
        <strong>${escapeHtml([user.firstName, user.lastName].filter(Boolean).join(" ") || "User")}</strong>
        <small>${escapeHtml(user.username ? `@${user.username}` : String(user.id))}</small>
      </div>
    </article>
  `).join("") : "<p>No users yet.</p>";
}

async function copyLatestPost() {
  const latest = (rgxData.posts || [])[rgxData.posts.length - 1];
  if (!latest) return alert("No post yet.");
  await navigator.clipboard.writeText(postLink(latest.id)).catch(() => {});
  alert("Latest post link copied.");
}

async function writeData() {
  const res = await fetch(FIREBASE_WRITE_URL, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(rgxData)
  });
  if (!res.ok) throw new Error("Firebase write failed");
}

function postLink(id) {
  return `${location.origin}/post.html?id=${encodeURIComponent(id)}`;
}

function fillPostForm(post) {
  const form = document.querySelector("#postForm");
  form.elements.title.value = post.title || "";
  form.elements.category.value = post.category || "Downloads";
  form.elements.subtitle.value = post.subtitle || "";
  form.elements.imageUrl.value = post.image && !post.image.startsWith("data:") ? post.image : "";
  form.elements.description.value = post.description || "";
  form.elements.buttonUrl.value = post.buttonUrl || "";
  form.elements.buttonText.value = post.buttonText || "Download Now";
  form.elements.buttonColor.value = post.buttonColor || "#e11d2e";
  form.elements.editingPostId.value = post.id || "";
  document.querySelector("#publishBtn").textContent = "Update Post";
  document.querySelector("#cancelEditBtn").classList.remove("hidden");
}

function resetPostForm(form) {
  form.reset();
  form.elements.category.value = "Downloads";
  form.elements.buttonText.value = "Download Now";
  form.elements.buttonColor.value = "#e11d2e";
  form.elements.editingPostId.value = "";
  document.querySelector("#publishBtn").textContent = "Publish Post";
  document.querySelector("#cancelEditBtn").classList.add("hidden");
}

async function uploadImageToCloudinary(file) {
  document.querySelector("#refreshStatus").textContent = "Uploading image...";
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  body.append("folder", "rgx-posts");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error(data.error && data.error.message ? data.error.message : "Cloudinary upload failed");
  }
  return data.secure_url;
}

function createId() {
  return Math.random().toString(16).slice(2, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
