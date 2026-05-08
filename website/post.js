(async function initPost() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const titleNode = document.querySelector("#postTitle");
  const bodyNode = document.querySelector("#postBody");

  if (!id) {
    renderMissing(titleNode, bodyNode);
    return;
  }

  const data = await loadRgxData();
  const post = (data.posts || []).find((item) => item.id === id && item.active !== false);
  if (!post) {
    renderMissing(titleNode, bodyNode);
    return;
  }

  document.title = `${post.title || "Rahul Gamer X Post"} - Rahul Gamer X`;
  titleNode.textContent = post.title || "Rahul Gamer X Post";
  bodyNode.innerHTML = renderTemplatePost(post);
  loadVideoNotifier(data.settings && data.settings.socialLinks);
})();

function renderTemplatePost(post) {
  const buttons = normalizeButtons(post);
  const customBody = String(post.htmlContent || "").trim();
  const description = customBody || formatText(post.description || "");
  const mainImage = post.image || post.imageUrl || post.logo || "";
  const mainTitle = post.templateTitle || post.title || "Rahul Gamer X Post";
  const subTitle = post.templateSubtitle || post.category || "";

  return `
    <div class="dp-post-wrapper">
      <div class="dp-content-layer">
        <div class="dp-main-title">${escapeHtml(mainTitle)}</div>
        ${subTitle ? `<div class="dp-sub-title">${escapeHtml(subTitle)}</div>` : ""}
        ${mainImage ? `<img class="post-main-image" src="${escapeAttr(mainImage)}" alt="${escapeAttr(post.title || "Rahul Gamer X")}">` : ""}
        <div class="dp-template-copy">${description}</div>
        <div class="dp-dl-area">${buttons.map(renderButton).join("")}</div>
      </div>
    </div>
  `;
}

function normalizeButtons(post) {
  const buttons = Array.isArray(post.postButtons)
    ? post.postButtons.filter((button) => button && button.text && button.url)
    : [];
  if (post.buttonUrl) {
    buttons.unshift({
      text: post.buttonText || "Download Now",
      url: post.buttonUrl,
      subtext: post.buttonSubtext || ""
    });
  }
  return buttons;
}

function renderButton(button, index) {
  if (index === 0) {
    return `
      <a class="dp-dl-button" href="${escapeAttr(button.url)}" target="_blank" rel="noopener">
        <div class="dp-dl-icon">File</div>
        <div class="dp-dl-text"><span class="btn-head">${escapeHtml(button.text)}</span><span class="btn-sub">${escapeHtml(button.subtext || "")}</span></div>
        <div class="dp-dl-arrow">Open</div>
      </a>
    `;
  }

  return `<div class="dp-secondary-row"><a class="dp-secondary-link" href="${escapeAttr(button.url)}" target="_blank" rel="noopener">${escapeHtml(button.text)}</a></div>`;
}

function renderMissing(titleNode, bodyNode) {
  titleNode.textContent = "Post unavailable";
  bodyNode.innerHTML = `
    <div class="dp-post-wrapper">
      <div class="dp-main-title">Post unavailable</div>
      <p>This Rahul Gamer X post is not available.</p>
      <div class="dp-dl-area">${renderButton({ text: "Back Home", url: "./index.html", subtext: "Return to homepage" }, 0)}</div>
    </div>
  `;
}

function loadVideoNotifier(links = {}) {
  const link = links.video || links.videoLink || "";
  if (!link) return;
  const videoId = extractYouTubeId(link);
  const embed = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playlist=${videoId}&loop=1`
    : link;
  document.querySelector("#yt-video-container").innerHTML = `<iframe src="${escapeAttr(embed)}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  document.querySelector("#yt-channel-link").href = link;
  document.querySelector("#yt-notifier").style.display = "block";
}

function closeYtNotifier() {
  const notifier = document.querySelector("#yt-notifier");
  notifier.style.opacity = "0";
  setTimeout(() => {
    notifier.style.display = "none";
    document.querySelector("#yt-video-container").innerHTML = "";
  }, 500);
}

function extractYouTubeId(link) {
  const match = String(link || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : "";
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
