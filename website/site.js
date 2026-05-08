(async function initHome() {
  const data = await loadRgxData();
  const posts = normalizePosts(data.posts || []);
  applySocialLinks(data.settings && data.settings.socialLinks);
  applyStaticLinks();
  renderPosts(posts);
  renderDownloads(data.files || []);
  renderBloggerPosts(posts);
  setupInlinePosts(posts);
  wireSearch();
})();

function normalizePosts(posts) {
  return posts
    .filter((post) => post && post.active !== false)
    .slice()
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

function renderPosts(posts) {
  const latestTitle = document.querySelector("#latestTitle");
  const pinned = document.querySelector("#pinnedPost");
  const grid = document.querySelector("#postGrid");
  const popular = document.querySelector("#popularPosts");
  if (!latestTitle || !pinned || !grid || !popular) return;

  const active = posts.slice().reverse();
  if (!active.length) {
    latestTitle.textContent = "No post published yet.";
    pinned.innerHTML = emptyCard("No pinned post", "Create a post from the admin panel.");
    grid.innerHTML = emptyCard("No stories yet", "New RGX posts will appear here.");
    popular.innerHTML = "<p>No posts yet.</p>";
    return;
  }

  const pinnedPost = active.find((post) => post.pinned) || active[0];
  latestTitle.textContent = pinnedPost.title || "Rahul Gamer X Post";
  pinned.innerHTML = postCard(pinnedPost, true);
  grid.innerHTML = active.map((post) => postCard(post, false)).join("");
  renderLabels(active);
  popular.innerHTML = active.slice(0, 5).map((post) => `
    <a href="./post.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title || "Rahul Gamer X Post")}</a>
  `).join("");
}

function renderBloggerPosts(posts) {
  const featured = document.querySelector("#FeaturedPost1 .itemP.featured");
  const blogGrid = document.querySelector("#Blog1 .blogP");
  const popular = document.querySelector("#PopularPosts00 .itemP.popular");
  if (!featured && !blogGrid && !popular) return;

  const active = posts.slice().reverse();
  if (!active.length) return;
  const pinned = active.find((post) => post.pinned) || active[0];

  if (featured) featured.innerHTML = bloggerFeatured(pinned);
  if (blogGrid) blogGrid.innerHTML = active.map(bloggerCard).join("");
  if (popular) popular.innerHTML = active.slice(0, 5).map((post, index) => bloggerPopular(post, index)).join("");
}

function setupInlinePosts(posts) {
  const blogB = document.querySelector(".blogB");
  if (!blogB) return;
  injectInlinePostStyles();
  const originalBlogHtml = blogB.innerHTML;

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href*='post.html?id=']");
    if (!link) return;
    const id = new URL(link.href, location.href).searchParams.get("id");
    const post = posts.find((item) => String(item.id) === String(id));
    if (!post) return;
    event.preventDefault();
    renderInlinePost(blogB, post);
    history.pushState({ rgxInlinePost: post.id }, "", `?post=${encodeURIComponent(post.id)}`);
  });

  window.addEventListener("popstate", () => {
    const id = new URLSearchParams(location.search).get("post");
    const post = posts.find((item) => String(item.id) === String(id));
    if (post) {
      renderInlinePost(blogB, post);
      return;
    }
    blogB.innerHTML = originalBlogHtml;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const initialId = new URLSearchParams(location.search).get("post");
  const initialPost = posts.find((item) => String(item.id) === String(initialId));
  if (initialPost) renderInlinePost(blogB, initialPost);
}

function renderInlinePost(target, post) {
  target.innerHTML = `
    <article class="p post rgx-inline-post">
      <div class="pT"><h1>${escapeHtml(post.title || "Rahul Gamer X Post")}</h1></div>
      <div class="pE">${renderTemplatePost(post)}</div>
    </article>
  `;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderTemplatePost(post) {
  const buttons = normalizeButtons(post);
  const customBody = String(post.htmlContent || "").trim();
  const description = customBody || formatText(post.description || "");
  const logo = post.logo || post.image || "";
  const mainTitle = post.templateTitle || post.subtitle || post.title || "Unbypassable Login Key Dialog";
  const subTitle = post.templateSubtitle || post.category || "Rahul Gamer X";

  return `
    <div class="dp-post-wrapper">
      <div class="dp-content-layer">
        ${logo ? `<img class="post-logo" src="${escapeAttr(logo)}" alt="${escapeAttr(post.title || "Rahul Gamer X")}">` : ""}
        <div class="dp-main-title">${escapeHtml(mainTitle)}</div>
        <div class="dp-sub-title">${escapeHtml(subTitle)}</div>
        <div class="dp-template-copy">${description}</div>
        ${customBody ? "" : renderDefaultFeatureGrid(post)}
        <div class="dp-dl-area">${buttons.map(renderTemplateButton).join("")}</div>
      </div>
    </div>
  `;
}

function renderDefaultFeatureGrid(post) {
  return `
    <div class="dp-features-grid">
      <div class="dp-feature-card"><span>🔒</span><div><strong>Device ID / HWID Ready</strong><br>Use this area for security details, features, or mod notes.</div></div>
      <div class="dp-feature-card"><span>☁️</span><div><strong>Remote Panel Support</strong><br>Edit this post from the admin panel and publish instantly.</div></div>
      <div class="dp-feature-card"><span>🎨</span><div><strong>Premium UI</strong><br>The same red dialog template stays consistent for every post.</div></div>
      <div class="dp-feature-card"><span>🛠️</span><div><strong>${escapeHtml(post.category || "MT Manager")}</strong><br>Add your own HTML content for full control.</div></div>
    </div>
  `;
}

function normalizeButtons(post) {
  const extras = Array.isArray(post.postButtons) ? post.postButtons : [];
  const buttons = extras.map((button) => {
    if (typeof button === "string") return null;
    return button;
  }).filter((button) => button && button.text && button.url);

  if (post.buttonUrl) {
    buttons.unshift({
      text: post.buttonText || "Download Dialog Files",
      url: post.buttonUrl,
      subtext: post.buttonSubtext || "Contains files and assets"
    });
  }
  return buttons.length ? buttons : [{ text: "Back Home", url: "./index.html", subtext: "Return to Rahul Gamer X" }];
}

function renderTemplateButton(button, index) {
  if (index === 0) {
    return `
      <a class="dp-dl-button" href="${escapeAttr(button.url)}" target="_blank" rel="noopener">
        <div class="dp-dl-icon">📦</div>
        <div class="dp-dl-text"><span class="btn-head">${escapeHtml(button.text)}</span><span class="btn-sub">${escapeHtml(button.subtext || "")}</span></div>
        <div class="dp-dl-arrow">➡️</div>
      </a>
    `;
  }
  return `<a class="dp-secondary-link" href="${escapeAttr(button.url)}" target="_blank" rel="noopener">${escapeHtml(button.text)}</a>`;
}

function injectInlinePostStyles() {
  if (document.querySelector("#rgx-inline-post-styles")) return;
  const style = document.createElement("style");
  style.id = "rgx-inline-post-styles";
  style.textContent = `
    .rgx-inline-post .pT h1{margin-bottom:22px}
    .dp-post-wrapper{background:#050505;border-radius:20px;padding:clamp(18px,4vw,30px);border:1px solid rgba(255,42,42,.15);box-shadow:0 24px 55px rgba(0,0,0,.55);color:#f8fafc;overflow:hidden}
    .post-logo{display:block;width:min(170px,45vw);margin:0 auto 18px;border-radius:22px;box-shadow:0 16px 38px rgba(0,0,0,.35)}
    .dp-main-title{font-size:clamp(1.7rem,4vw,2.4rem);font-weight:800;text-align:center;color:#fff}
    .dp-sub-title{text-align:center;color:#ff2a2a;font-size:.95em;margin-bottom:30px;letter-spacing:.08em;text-transform:uppercase}
    .dp-template-copy,.dp-template-copy p{color:#e7ecf8}
    .dp-features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:15px;margin:35px 0}
    .dp-feature-card{display:flex;gap:15px;background:#121212;padding:20px;border-radius:14px;border:1px solid rgba(255,42,42,.15)}
    .dp-feature-card>span{font-size:1.6rem}
    .dp-dl-area{display:flex;flex-direction:column;gap:14px;margin-top:28px}
    .dp-dl-button{display:flex;align-items:center;background:#121212;padding:16px 25px;border-radius:16px;text-decoration:none;border:1px solid rgba(255,42,42,.15);transition:.3s;color:white}
    .dp-dl-button:hover{border-color:#ff2a2a;background:rgba(255,42,42,.1)}
    .dp-dl-icon{font-size:2rem;margin-right:18px}.dp-dl-text{flex-grow:1}.dp-dl-arrow{font-size:1.5rem}
    .btn-head{font-weight:800;display:block}.btn-sub{color:#ff8585;font-size:.85em;display:block}
    .dp-secondary-link{align-self:center;padding:10px 22px;background:rgba(255,255,255,.03);border-radius:50px;color:#8b9bb4;text-decoration:none}
  `;
  document.head.appendChild(style);
}

function renderDownloads(files) {
  const list = document.querySelector("#downloadList");
  if (!list) return;
  const active = files.filter((file) => file.active !== false).slice().reverse();

  if (!active.length) {
    list.innerHTML = emptyCard("No downloads yet", "Bot generated download links will appear here.");
    return;
  }

  list.innerHTML = active.map((file) => {
    const size = file.sizeLabel ? `<p>${escapeHtml(file.sizeLabel)}</p>` : "";
    const title = file.fileName || file.title || "Rahul Gamer X File";
    return `
      <article class="story-card download-story">
        <div class="file-badge"><span>${escapeHtml(file.extension || "FILE")}</span></div>
        <h3>${escapeHtml(title)}</h3>
        <small class="story-meta">${escapeHtml(file.createdAt ? new Date(file.createdAt).toLocaleDateString() : "Generated by bot")}</small>
        ${size}
        <a class="read-more" href="./download.html?id=${encodeURIComponent(file.id)}">Download Now</a>
      </article>
    `;
  }).join("");
}

function postCard(post, pinned) {
  const href = postHref(post);
  return `
    <article class="${pinned ? "story-card pinned-card" : "story-card"}">
      ${post.image ? `<a href="${href}"><img src="${escapeAttr(post.image)}" alt="${escapeHtml(post.title || "Rahul Gamer X Post")}"></a>` : ""}
      <div>
        <small class="story-meta">${escapeHtml(post.category || "Downloads")} - ${escapeHtml(formatDate(post.createdAt))}</small>
        <h3><a href="${href}">${escapeHtml(post.title || "Rahul Gamer X Post")}</a></h3>
        ${post.subtitle ? `<p>${escapeHtml(post.subtitle)}</p>` : ""}
        ${post.description ? `<p>${escapeHtml(trim(post.description, pinned ? 160 : 92))}</p>` : ""}
        <a class="read-more" href="${href}">Read More</a>
      </div>
    </article>
  `;
}

function bloggerFeatured(post) {
  const href = postHref(post);
  return `
    <article class="i featured flex wrap">
      <div class="pI cInherit shrink">
        <a class="thumbnail" href="${href}">
          ${post.image ? `<img alt="${escapeAttr(post.title || "Rahul Gamer X Post")}" class="img lazy" data-src="${escapeAttr(post.image)}" src="${escapeAttr(post.image)}">` : ""}
        </a>
      </div>
      <div class="pC grow">
        <div class="pH info flex fontM"><div class="label ellips cInherit" data-text="in"><span><a aria-label="${escapeAttr(post.category || "Downloads")}" data-text="${escapeAttr(post.category || "Downloads")}" href="#"></a></span></div></div>
        <div class="pT cInherit"><h2 class="name"><a class="clamp" href="${href}">${escapeHtml(post.title || "Rahul Gamer X Post")}</a></h2></div>
        <div class="pS fontM"><div class="snippet clamp opacity">${escapeHtml(trim(post.description || post.subtitle || "", 180))}</div></div>
        <div class="pF items flex space-between fontM cInherit noPrint">
          <time class="time ellips opacity publish" data-text="${escapeAttr(formatDate(post.createdAt))}"></time>
          <a aria-label="Read more" class="jump jumpLink shrink" data-text="Read more" href="${href}"></a>
        </div>
      </div>
    </article>
  `;
}

function bloggerCard(post) {
  const href = postHref(post);
  return `
    <article class="p flex column">
      <div class="pI cInherit shrink">
        <a class="thumbnail" href="${href}">
          ${post.image ? `<img alt="${escapeAttr(post.title || "Rahul Gamer X Post")}" class="img lazy" data-src="${escapeAttr(post.image)}" src="${escapeAttr(post.image)}">` : ""}
        </a>
      </div>
      <div class="pC grow flex column">
        <div class="pH info flex fontM"><div class="label ellips cInherit" data-text="in"><span><a aria-label="${escapeAttr(post.category || "Downloads")}" data-text="${escapeAttr(post.category || "Downloads")}" href="#"></a></span></div></div>
        <div class="pT cInherit"><h2 class="name"><a class="clamp" href="${href}">${escapeHtml(post.title || "Rahul Gamer X Post")}</a></h2></div>
        <div class="pS fontM"><div class="snippet clamp opacity">${escapeHtml(trim(post.description || post.subtitle || "", 120))}</div></div>
        <div class="pF items flex space-between fontM cInherit noPrint">
          <time class="time ellips opacity publish" data-text="${escapeAttr(formatDate(post.createdAt))}"></time>
          <a aria-label="Read more" class="jump jumpLink shrink" data-text="Read more" href="${href}"></a>
        </div>
      </div>
    </article>
  `;
}

function bloggerPopular(post, index) {
  const href = postHref(post);
  return `
    <article class="${index === 0 ? "i most flex column" : "i"}">
      ${index === 0 && post.image ? `<div class="pI cInherit shrink"><a class="thumbnail" href="${href}"><img alt="${escapeAttr(post.title || "Rahul Gamer X Post")}" class="img lazy" data-src="${escapeAttr(post.image)}" src="${escapeAttr(post.image)}"></a></div>` : ""}
      <div class="pC flex"><div class="pB">
        <div class="pH info flex cInherit fontM"><time class="time ellips opacity update shrink" data-text="${escapeAttr(formatDate(post.createdAt))}"></time><div class="label ellips cInherit" data-text="in"><a aria-label="${escapeAttr(post.category || "Downloads")}" data-text="${escapeAttr(post.category || "Downloads")}" href="#"></a></div></div>
        <div class="pT cInherit"><h2 class="name"><a class="clamp" href="${href}">${escapeHtml(post.title || "Rahul Gamer X Post")}</a></h2></div>
        ${index === 0 ? `<div class="pS fontM"><div class="snippet clamp opacity">${escapeHtml(trim(post.description || post.subtitle || "", 100))}</div></div>` : ""}
      </div></div>
    </article>
  `;
}

function renderLabels(posts) {
  const target = document.querySelector("#labelCloud");
  if (!target) return;
  const counts = posts.reduce((map, post) => {
    const label = post.category || "Downloads";
    map.set(label, (map.get(label) || 0) + 1);
    return map;
  }, new Map());
  target.innerHTML = [...counts.entries()].map(([label, count]) => `<span>${escapeHtml(label)} <b>${count}</b></span>`).join("");
}

function wireSearch() {
  const input = document.querySelector("#siteSearch") || document.querySelector("#forSearch");
  if (!input) return;
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    document.querySelectorAll(".story-card, #Blog1 article.p").forEach((card) => {
      const text = card.textContent.toLowerCase();
      card.classList.toggle("filtered-out", query && !text.includes(query));
    });
  });
}

function emptyCard(title, text) {
  return `<article class="story-card empty-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></article>`;
}

function applySocialLinks(links = {}) {
  const normal = {
    youtube: document.querySelector('[data-social="youtube"]'),
    telegram: document.querySelector('[data-social="telegram"]'),
    instagram: document.querySelector('[data-social="instagram"]')
  };
  Object.entries(normal).forEach(([key, element]) => {
    if (element && links[key]) element.href = links[key];
  });

  updateAnchorByText("Telegram", links.telegram);
  updateAnchorByText("YouTube", links.youtube);
  updateAnchorByText("Instagram", links.instagram);
}

function applyStaticLinks() {
  updateAnchorByText("About", "./about.html");
  updateAnchorByText("Contact", "./contact.html");
  updateAnchorByText("Contact Us", "./contact.html");
}

function updateAnchorByText(text, href) {
  if (!href) return;
  document.querySelectorAll("a").forEach((anchor) => {
    if (anchor.textContent.trim().toLowerCase() === text.toLowerCase()) anchor.href = href;
  });
}

function postHref(post) {
  return `./post.html?id=${encodeURIComponent(post.id)}`;
}

function formatDate(value) {
  if (!value) return "Rahul Gamer X";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function trim(value, length) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
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
