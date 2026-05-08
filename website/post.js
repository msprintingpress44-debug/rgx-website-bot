(async function initPost() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const article = document.querySelector("#postArticle");
  const popular = document.querySelector("#postPopular");

  if (!id) {
    renderMissing(article);
    return;
  }

  const data = await loadRgxData();
  const activePosts = (data.posts || []).filter((item) => item.active !== false);
  const post = activePosts.find((item) => item.id === id);
  applySocialLinks(data.settings && data.settings.socialLinks);
  renderPostSidebar(activePosts, popular);

  if (!post) {
    renderMissing(article);
    return;
  }

  document.title = `${post.title || "Rahul Gamer X Post"} - Rahul Gamer X`;
  const content = post.htmlContent && post.htmlContent.trim()
    ? post.htmlContent
    : formatText(post.description || "");

  article.innerHTML = `
    <p class="kicker">Rahul Gamer X Post</p>
    <small class="story-meta">${escapeHtml(post.category || "Downloads")} - ${escapeHtml(formatDate(post.createdAt))}</small>
    <h1>${escapeHtml(post.title || "Rahul Gamer X Post")}</h1>
    ${post.image ? `<img class="post-cover" src="${escapeAttr(post.image)}" alt="${escapeHtml(post.title || "Rahul Gamer X Post")}">` : ""}
    ${post.subtitle ? `<h2>${escapeHtml(post.subtitle)}</h2>` : ""}
    <div class="post-content">${content}</div>
    <div class="download-box">
      <span class="download-file-icon">RGX</span>
      <div>
        <strong>${escapeHtml(post.buttonText || "Download Now")}</strong>
        <small>Use the button below to continue safely.</small>
      </div>
    </div>
    <a class="btn primary post-button" style="--button-color:${escapeAttr(post.buttonColor || "#ef1f2d")}" href="${escapeAttr(post.buttonUrl || "#")}" target="_blank" rel="noopener">${escapeHtml(post.buttonText || "Download Now")}</a>
  `;
})();

function renderPostSidebar(posts, popular) {
  if (popular) {
    popular.innerHTML = posts.slice(-5).reverse().map((item) => `
      <a href="./post.html?id=${encodeURIComponent(item.id)}">${escapeHtml(item.title || "Rahul Gamer X Post")}</a>
    `).join("") || "<p>No posts yet.</p>";
  }

  const labels = document.querySelector("#postLabels");
  if (!labels) return;
  const counts = posts.reduce((map, post) => {
    const label = post.category || "Downloads";
    map.set(label, (map.get(label) || 0) + 1);
    return map;
  }, new Map());
  labels.innerHTML = [...counts.entries()].map(([label, count]) => `<span>${escapeHtml(label)} ${count}</span>`).join("");
}

function renderMissing(article) {
  article.innerHTML = `
    <p class="kicker">Not Found</p>
    <h1>Post unavailable</h1>
    <p class="muted">This Rahul Gamer X post is not available.</p>
    <a class="btn ghost post-button" href="./index.html">Back Home</a>
  `;
}

function applySocialLinks(links = {}) {
  const social = {
    youtube: links.youtube,
    telegram: links.telegram,
    instagram: links.instagram
  };

  Object.entries(social).forEach(([key, href]) => {
    if (!href) return;
    document.querySelectorAll(`[data-social="${key}"]`).forEach((anchor) => {
      anchor.href = href;
    });
  });
}

function formatDate(value) {
  if (!value) return "Rahul Gamer X";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function formatText(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
