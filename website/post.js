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
  const post = (data.posts || []).find((item) => item.id === id && item.active !== false);
  if (popular) {
    popular.innerHTML = (data.posts || []).filter((item) => item.active !== false).slice(-5).reverse().map((item) => `
      <a href="./post.html?id=${encodeURIComponent(item.id)}">${escapeHtml(item.title || "RGX Post")}</a>
    `).join("") || "<p>No posts yet.</p>";
  }

  if (!post) {
    renderMissing(article);
    return;
  }

  document.title = `${post.title || "RGX Post"} - RGX`;
  article.innerHTML = `
    <p class="kicker">RGX Download Post</p>
    <small class="story-meta">${escapeHtml(post.category || "Downloads")} • ${escapeHtml(post.createdAt ? new Date(post.createdAt).toLocaleDateString() : "RGX")}</small>
    <h1>${escapeHtml(post.title || "RGX Post")}</h1>
    ${post.image ? `<img class="post-cover" src="${post.image}" alt="${escapeHtml(post.title || "RGX Post")}">` : ""}
    ${post.subtitle ? `<h2>${escapeHtml(post.subtitle)}</h2>` : ""}
    <div class="post-content">${formatText(post.description || "")}</div>
    <div class="download-box">
      <span class="download-file-icon">RGX</span>
      <div>
        <strong>${escapeHtml(post.buttonText || "Download Now")}</strong>
        <small>Use the button below to continue safely.</small>
      </div>
    </div>
    <a class="btn primary post-button" style="--button-color:${escapeHtml(post.buttonColor || "#ef1f2d")}" href="${escapeHtml(post.buttonUrl || "#")}" target="_blank" rel="noopener">${escapeHtml(post.buttonText || "Download Now")}</a>
  `;
})();

function renderMissing(article) {
  article.innerHTML = `
    <p class="kicker">Not Found</p>
    <h1>Post unavailable</h1>
    <p class="muted">This RGX post is not available.</p>
    <a class="btn ghost post-button" href="./index.html">Back Home</a>
  `;
}

function formatText(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
