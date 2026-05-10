import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createId,
  downloadIdFromUrl,
  downloadUrl,
  emptyData,
  extractYouTubeId,
  fileTargetUrl,
  formatDate,
  loadRgxData,
  saveRgxData,
  sortedPosts,
  uploadImage
} from "./data.js";
import "./styles.css";

const ADMIN_PASSWORD = "reverse";
const SUBSCRIBER_TEXT = "25.8K+ Subscribers";

const ADMIN_TABS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "posts", label: "Posts", icon: "post" },
  { id: "links", label: "Links", icon: "link" },
  { id: "files", label: "Files", icon: "download" }
];

function App() {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(getRoute());
  const [favoriteIds, setFavoriteIds] = useState(() => readStoredFavorites());

  async function refresh() {
    setLoading(true);
    setData(await loadRgxData());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const onPop = () => setRoute(getRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(path) {
    history.pushState({}, "", path);
    setRoute(getRoute());
    scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveData(next) {
    await saveRgxData(next);
    setData(next);
  }

  function toggleFavorite(id) {
    setFavoriteIds((current) => {
      const key = String(id);
      const next = current.includes(key) ? current.filter((item) => item !== key) : [key, ...current];
      localStorage.setItem("rgxFavorites", JSON.stringify(next));
      return next;
    });
  }

  if (loading) {
    return <Shell navigate={navigate}><div className="loader">Loading Rahul Gamer X...</div></Shell>;
  }

  const pageProps = { data, saveData, refresh, navigate, favoriteIds, toggleFavorite };
  if (route.page === "admin") return <AdminPage {...pageProps} />;
  if (route.page === "about") return <AboutPage navigate={navigate} />;
  if (route.page === "contact") return <ContactPage data={data} navigate={navigate} />;
  if (route.page === "privacy") return <PrivacyPage navigate={navigate} />;
  if (route.page === "disclaimer") return <DisclaimerPage navigate={navigate} />;
  if (route.page === "terms") return <TermsPage navigate={navigate} />;
  if (route.page === "favorites") return <FavoritesPage {...pageProps} />;
  if (route.page === "download") return <DownloadPage {...pageProps} id={route.id} />;
  return <HomePage {...pageProps} postId={route.postId} query={route.query} />;
}

function Shell({ children, navigate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("rgxTheme") || "light");
  const [searchText, setSearchText] = useState(() => new URLSearchParams(location.search).get("q") || "");
  const navItems = [
    { label: "Home", path: "/", icon: "home" },
    { label: "Favorites", path: "/favorites", icon: "heart" },
    { label: "Categories", path: "/?q=Android", icon: "dashboard" },
    { label: "About", path: "/about", icon: "user" },
    { label: "Contact", path: "/contact", icon: "mail" },
    { label: "Privacy Policy", path: "/privacy-policy", icon: "link" },
    { label: "Disclaimer", path: "/disclaimer", icon: "post" },
    { label: "Terms", path: "/terms-and-conditions", icon: "dashboard" }
  ];

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("rgxTheme", next);
    setTheme(next);
  }

  function submitSearch(event) {
    event.preventDefault();
    const query = searchText.trim();
    navigate(query ? `/?q=${encodeURIComponent(query)}` : "/");
  }

  return (
    <div className={`app-shell ${theme}`}>
      <div className="luxury-particles" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, index) => <span key={index} />)}
      </div>
      <header className="topbar">
        <button className="icon-btn" onClick={() => setMenuOpen((value) => !value)} aria-label="Menu"><Icon name="menu" /></button>
        <button className="brand-btn" onClick={() => navigate("/")}>Rahul Gamer X</button>
        <form className="search-pill" onSubmit={submitSearch}>
          <Icon name="search" />
          <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="e.g. GTA SA Mods, Dialog File" aria-label="Search posts" />
        </form>
        <button className="icon-btn theme-toggle" onClick={toggleTheme} aria-label="Toggle theme"><Icon name={theme === "dark" ? "moon" : "sun"} /></button>
      </header>
      <div className="layout">
        <aside className={menuOpen ? "rail expanded" : "rail"}>
          {navItems.map((item) => (
            <button key={item.path} onClick={() => { navigate(item.path); setMenuOpen(false); }} title={item.label}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </aside>
        <div className="shell-content">
          {children}
          <SiteFooter navigate={navigate} />
        </div>
      </div>
    </div>
  );
}

function SiteFooter({ navigate }) {
  const links = [
    ["Home", "/"],
    ["Categories", "/?q=Android"],
    ["About Us", "/about"],
    ["Contact Us", "/contact"],
    ["Privacy Policy", "/privacy-policy"],
    ["Disclaimer", "/disclaimer"],
    ["Terms and Conditions", "/terms-and-conditions"]
  ];
  return (
    <footer className="site-footer">
      <div>
        <b>Rahul Gamer X</b>
        <p>Gaming, Android modding, tutorial updates, downloadable resources and creator support links in one trusted place.</p>
      </div>
      <nav aria-label="Footer links">
        {links.map(([label, path]) => (
          <button key={path} onClick={() => navigate(path)}>{label}</button>
        ))}
      </nav>
      <small>Copyright {new Date().getFullYear()} Rahul Gamer X. All rights reserved.</small>
    </footer>
  );
}

function HomePage({ data, navigate, postId, favoriteIds, toggleFavorite, query = "" }) {
  const posts = useMemo(() => sortedPosts(data.posts), [data.posts]);
  const filteredPosts = useMemo(() => filterPosts(posts, query), [posts, query]);
  const currentPost = postId ? posts.find((post) => String(post.id) === String(postId)) : null;
  const pinned = posts.find((post) => post.pinned) || posts[0];

  return (
    <Shell navigate={navigate}>
      <main className="content-grid">
        <section className="main-column">
          {currentPost ? (
            <PostView post={currentPost} files={data.files} favoriteIds={favoriteIds} toggleFavorite={toggleFavorite} />
          ) : (
            <>
              <SectionTitle title="Pinned Post" />
              {!query && pinned ? <PostCard post={pinned} pinned navigate={navigate} favoriteIds={favoriteIds} toggleFavorite={toggleFavorite} /> : null}
              {query && <Empty text={`Search results for "${query}"`} />}
              <SectionTitle title="Recent Posts" />
              <div className="story-grid">
                {filteredPosts.map((post) => <PostCard key={post.id} post={post} navigate={navigate} favoriteIds={favoriteIds} toggleFavorite={toggleFavorite} />)}
                {!filteredPosts.length && <Empty text="No matching posts found." />}
              </div>
            </>
          )}
        </section>
        <Sidebar posts={posts} data={data} navigate={navigate} />
      </main>
    </Shell>
  );
}

function filterPosts(posts, query = "") {
  const cleanQuery = String(query).trim().toLowerCase();
  if (!cleanQuery) return posts;
  return posts.filter((post) => [post.title, post.category, post.description, post.subtitle]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(cleanQuery)));
}

function Hero({ latest }) {
  return (
    <section className="hero-panel">
      <h1><span>{SUBSCRIBER_TEXT}</span></h1>
      <h2><span>Thank You Fans</span></h2>
      <div className="latest-chip"><span>Latest</span> <b>{latest || "Loading latest post..."}</b></div>
    </section>
  );
}

function SectionTitle({ title }) {
  return <h3 className="section-title">{title}<span /></h3>;
}

function PostCard({ post, navigate, favoriteIds = [], toggleFavorite = () => {}, pinned = false }) {
  const isFavorite = favoriteIds.includes(String(post.id));
  return (
    <article className={pinned ? "post-card pinned" : "post-card"}>
      <button className={isFavorite ? "favorite-btn active" : "favorite-btn"} onClick={() => toggleFavorite(post.id)} aria-label="Favorite post"><Icon name="heart" /></button>
      {post.image && <img src={post.image} alt={post.title} />}
      <div className="post-card-body">
        <small>{post.category || "Post"}{post.pinned ? " - Pinned" : ""}</small>
        <button className="post-title-btn" onClick={() => navigate(`/?post=${encodeURIComponent(post.id)}`)}>{post.title}</button>
        <p>{post.description || post.subtitle || "Rahul Gamer X update."}</p>
        <time>{formatDate(post.createdAt || post.timestamp)}</time>
      </div>
    </article>
  );
}

function Sidebar({ posts, data, navigate }) {
  const links = data.settings?.socialLinks || {};
  const video = links.video || links.videoLink || "";
  return (
    <aside className="sidebar">
      <SectionTitle title="Popular Posts" />
      <div className="popular-list">
        {posts.slice(0, 5).map((post, index) => (
          <button key={post.id} onClick={() => navigate(`/?post=${encodeURIComponent(post.id)}`)}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span>{post.title}</span>
          </button>
        ))}
      </div>
      <SectionTitle title="Social Media" />
      <div className="social-stack">
        {links.telegram && <a href={links.telegram} target="_blank" rel="noreferrer"><Icon name="send" /> Telegram</a>}
        {links.youtube && <a href={links.youtube} target="_blank" rel="noreferrer"><Icon name="play" /> YouTube</a>}
        {links.instagram && <a href={links.instagram} target="_blank" rel="noreferrer"><Icon name="camera" /> Instagram</a>}
      </div>
      {video && <VideoBox link={video} floating />}
    </aside>
  );
}

function VideoBox({ link, floating = false }) {
  const id = extractYouTubeId(link);
  const src = id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=1&rel=0&playsinline=1` : link;
  return (
    <div className={floating ? "video-box floating-video" : "video-box"}>
      <div className="video-title">New Video</div>
      <iframe src={src} title="Rahul Gamer X video" allow="autoplay; encrypted-media" allowFullScreen />
      <a href={link} target="_blank" rel="noreferrer">Open in YouTube</a>
    </div>
  );
}

function PostView({ post, files = [], favoriteIds = [], toggleFavorite = () => {} }) {
  const buttons = getPostButtons(post, files);
  const image = post.image || post.imageUrl || post.logo;
  const isFavorite = favoriteIds.includes(String(post.id));
  return (
    <article className="full-post">
      <button className={isFavorite ? "favorite-btn post-favorite active" : "favorite-btn post-favorite"} onClick={() => toggleFavorite(post.id)} aria-label="Favorite post"><Icon name="heart" /> <span>{isFavorite ? "Favorited" : "Favorite"}</span></button>
      <h1>{post.templateTitle || post.title}</h1>
      {(post.templateSubtitle || post.category) && <p className="post-kicker">{post.templateSubtitle || post.category}</p>}
      {image && <img className="full-post-image" src={image} alt={post.title} />}
      {post.htmlContent ? (
        <div className="post-description" dangerouslySetInnerHTML={{ __html: post.htmlContent }} />
      ) : (
        <p className="post-description">{post.description}</p>
      )}
      {!!buttons.length && (
        <div className="post-buttons">
          {buttons.map((button, index) => <a key={`${button.url}-${index}`} className={index === 0 ? "download-btn" : "soft-btn"} href={button.url} target="_blank" rel="noreferrer">{button.text || "Open Link"}</a>)}
        </div>
      )}
    </article>
  );
}

function FavoritesPage({ data, navigate, favoriteIds, toggleFavorite }) {
  const posts = useMemo(() => sortedPosts(data.posts).filter((post) => favoriteIds.includes(String(post.id))), [data.posts, favoriteIds]);
  return (
    <Shell navigate={navigate}>
      <main className="simple-page favorites-page">
        <article>
          <h1>Favorite Posts</h1>
          <p>Saved posts yahan milenge. Kisi bhi post ke heart icon par click karke add ya remove kar sakte ho.</p>
          <div className="story-grid">
            {posts.map((post) => <PostCard key={post.id} post={post} navigate={navigate} favoriteIds={favoriteIds} toggleFavorite={toggleFavorite} />)}
            {!posts.length && <Empty text="No favorite posts yet." />}
          </div>
        </article>
      </main>
    </Shell>
  );
}

function getPostButtons(post, files = []) {
  const buttons = [];
  if (post.buttonUrl) buttons.push({ text: post.buttonText || "Download Now", url: resolvePostButtonUrl(post.buttonUrl, files) });
  if (Array.isArray(post.postButtons)) {
    post.postButtons.forEach((button) => {
      if (button?.text && button?.url) buttons.push({ ...button, url: resolvePostButtonUrl(button.url, files) });
    });
  }
  return buttons;
}

function resolvePostButtonUrl(url, files = []) {
  const fileId = downloadIdFromUrl(url);
  if (!fileId) return url;
  const file = files.find((item) => String(item.id) === String(fileId));
  return fileTargetUrl(file) || url;
}

function AdminPage({ data, saveData, refresh, navigate }) {
  const [loggedIn, setLoggedIn] = useState(sessionStorage.getItem("rgxAdmin") === "1");
  const [password, setPassword] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(blankPost());
  const [support, setSupport] = useState(data.settings?.socialLinks || {});
  const [status, setStatus] = useState("Ready");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [adminMenuOpen, setAdminMenuOpen] = useState(true);

  useEffect(() => setSupport(data.settings?.socialLinks || {}), [data.settings]);

  function login() {
    if (password.trim().toLowerCase() !== ADMIN_PASSWORD) {
      setStatus("Wrong password");
      return;
    }
    sessionStorage.setItem("rgxAdmin", "1");
    setLoggedIn(true);
  }

  async function submitPost(event) {
    event.preventDefault();
    setStatus("Uploading/saving...");
    const imageFromUpload = await uploadImage(form.imageFile);
    const existing = data.posts.find((post) => post.id === editingId);
    const nextPost = {
      ...(existing || {}),
      id: editingId || createId(),
      title: form.title.trim(),
      category: form.category.trim() || "Post",
      description: form.description.trim(),
      image: imageFromUpload || form.imageUrl.trim(),
      imageUrl: imageFromUpload || form.imageUrl.trim(),
      buttonText: form.buttonText.trim() || "Download Now",
      buttonUrl: form.buttonUrl.trim(),
      postButtons: form.extraButtons.filter((button) => button.text.trim() && button.url.trim()),
      pinned: form.pinned,
      active: true,
      createdAt: editingId ? existing?.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!nextPost.title) {
      setStatus("Post title required.");
      return;
    }
    const posts = editingId
      ? data.posts.map((post) => post.id === editingId ? nextPost : post)
      : [nextPost, ...data.posts];
    const finalPosts = nextPost.pinned ? posts.map((post) => ({ ...post, pinned: post.id === nextPost.id })) : posts;
    await saveData({ ...data, posts: finalPosts });
    setForm(blankPost());
    setEditingId("");
    setStatus("Post saved.");
    setActiveTab("posts");
  }

  async function deletePost(id) {
    if (!confirm("Delete this post?")) return;
    await saveData({ ...data, posts: data.posts.filter((post) => post.id !== id) });
  }

  async function saveSupport(event) {
    event.preventDefault();
    await saveData({ ...data, settings: { ...(data.settings || {}), socialLinks: support } });
    setStatus("Support links saved.");
  }

  function edit(post) {
    setEditingId(post.id);
    setForm({
      title: post.title || "",
      category: post.category || "",
      description: post.description || "",
      imageUrl: post.image || "",
      imageFile: null,
      buttonText: post.buttonText || "Download Now",
      buttonUrl: post.buttonUrl || "",
      extraButtons: Array.isArray(post.postButtons) ? post.postButtons.map((b) => ({ text: b.text || "", url: b.url || "" })) : [],
      pinned: !!post.pinned
    });
    setActiveTab("posts");
  }

  if (!loggedIn) {
    return (
      <div className="admin-page login-screen">
        <section className="login-card">
          <div className="login-glow" />
          <div className="login-logo"><Icon name="dashboard" /></div>
          <h1>Rahul Gamer X Admin</h1>
          <p>Luxury React control center. Login to manage posts, links and files.</p>
          <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} placeholder="Password" type="password" />
          <button onClick={login}>Login</button>
          <small>{status}</small>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <aside className={adminMenuOpen ? "admin-sidebar open" : "admin-sidebar"}>
        <button className="admin-menu-btn" onClick={() => setAdminMenuOpen((value) => !value)}><Icon name="menu" /><span>Menu</span></button>
        <div className="admin-brand">RGX Admin</div>
        {ADMIN_TABS.map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
            <Icon name={tab.icon} /><span>{tab.label}</span>
          </button>
        ))}
      </aside>

      <section className="admin-workspace">
        <header className="admin-header">
          <div><b>Rahul Gamer X</b><span>{status}</span></div>
          <div>
            <button onClick={refresh}><Icon name="refresh" /> Refresh</button>
            <button onClick={() => navigate("/")}><Icon name="home" /> Open Site</button>
          </div>
        </header>

        {activeTab === "dashboard" && <DashboardPanel data={data} setActiveTab={setActiveTab} />}

        {activeTab === "posts" && (
          <main className="admin-grid-page">
            <section className="admin-panel">
              <h2>{editingId ? "Edit Post" : "New Post"}</h2>
              <form className="admin-form" onSubmit={submitPost}>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Post title" required />
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" />
                <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, imageFile: e.target.files?.[0] || null })} />
                <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Image URL or upload image above" />
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows="5" />
                <select value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })}>
                  <option value="">Select uploaded bot file for download button</option>
                  {data.files.map((file) => <option key={file.id} value={downloadUrl(file)}>{file.fileName || file.title || file.id}</option>)}
                </select>
                <input value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} placeholder="Download button name" />
                <input value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })} placeholder="Download button link (optional)" />
                <ExtraButtonsEditor buttons={form.extraButtons} onChange={(extraButtons) => setForm({ ...form, extraButtons })} />
                <label className="check-row"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Pin this post</label>
                <button className="primary-btn" type="submit">{editingId ? "Update Post" : "Publish Post"}</button>
              </form>
            </section>
            <section className="admin-panel">
              <h2>Posts</h2>
              <div className="admin-list">
                {data.posts.map((post) => (
                  <article key={post.id}>
                    <b>{post.title}</b>
                    <small>{post.category} - {post.pinned ? "Pinned" : "Normal"}</small>
                    <div><button onClick={() => edit(post)}>Edit</button><button onClick={() => deletePost(post.id)}>Delete</button></div>
                  </article>
                ))}
              </div>
            </section>
          </main>
        )}

        {activeTab === "links" && (
          <section className="admin-panel wide-panel">
            <h2>Support Links</h2>
            <form className="admin-form" onSubmit={saveSupport}>
              {["telegram", "youtube", "instagram", "video"].map((key) => (
                <input key={key} value={support[key] || ""} onChange={(e) => setSupport({ ...support, [key]: e.target.value })} placeholder={`${key} link`} />
              ))}
              <button className="primary-btn" type="submit">Save Links</button>
            </form>
          </section>
        )}

        {activeTab === "files" && <FilesPanel files={data.files} />}
      </section>
    </div>
  );
}

function blankPost() {
  return { title: "", category: "", description: "", imageUrl: "", imageFile: null, buttonText: "Download Now", buttonUrl: "", extraButtons: [], pinned: false };
}

function ExtraButtonsEditor({ buttons, onChange }) {
  function update(index, key, value) {
    onChange(buttons.map((button, current) => current === index ? { ...button, [key]: value } : button));
  }
  return (
    <div className="extra-buttons-editor">
      <div className="field-heading">
        <span>Extra buttons</span>
        <button type="button" onClick={() => onChange([...buttons, { text: "", url: "" }])}>Add New Button</button>
      </div>
      {!buttons.length && <small>Optional. Add Telegram, YouTube, support or any custom button.</small>}
      {buttons.map((button, index) => (
        <div className="extra-button-row" key={index}>
          <input value={button.text} onChange={(e) => update(index, "text", e.target.value)} placeholder="Button name" />
          <input value={button.url} onChange={(e) => update(index, "url", e.target.value)} placeholder="Button link" />
          <button type="button" onClick={() => onChange(buttons.filter((_, current) => current !== index))}>Delete</button>
        </div>
      ))}
    </div>
  );
}

function DashboardPanel({ data, setActiveTab }) {
  const cards = [
    ["Posts", data.posts.length, "posts"],
    ["Files", data.files.length, "files"],
    ["Users", Object.keys(data.users || {}).length, "dashboard"],
    ["Links", Object.keys(data.settings?.socialLinks || {}).filter((key) => data.settings.socialLinks[key]).length, "links"]
  ];
  return (
    <section className="dashboard-panel">
      {cards.map(([label, value, tab]) => (
        <button key={label} onClick={() => setActiveTab(tab)}>
          <span>{label}</span>
          <b>{value}</b>
        </button>
      ))}
    </section>
  );
}

function FilesPanel({ files }) {
  return (
    <section className="admin-panel wide-panel">
      <h2>Bot Files</h2>
      <div className="admin-list">
        {!files.length && <p>No bot files yet. Upload files in Telegram bot, then select them in post form.</p>}
        {files.map((file) => (
          <article key={file.id}>
            <b>{file.fileName || file.title || file.id}</b>
            <small>{downloadUrl(file)}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function AboutPage({ navigate }) {
  return (
    <SimplePage navigate={navigate} title="About Rahul Gamer X">
      <p>Rahul Gamer X is a gaming and modding hub for premium dialogs, Android modding content, download links and video updates.</p>
      <p>The site is rebuilt in React, so posts, files and official links stay connected with the database while the UI remains fast and clean.</p>
    </SimplePage>
  );
}

function ContactPage({ data, navigate }) {
  const links = data.settings?.socialLinks || {};
  return (
    <SimplePage navigate={navigate} title="Contact Rahul Gamer X">
      <p>For support, collaborations, paid dialogs or updates, use the official links below.</p>
      <div className="contact-buttons">
        {links.telegram && <a className="telegram" href={links.telegram} target="_blank" rel="noreferrer"><Icon name="send" /> Telegram</a>}
        {links.youtube && <a className="youtube" href={links.youtube} target="_blank" rel="noreferrer"><Icon name="play" /> YouTube</a>}
        {links.instagram && <a className="instagram" href={links.instagram} target="_blank" rel="noreferrer"><Icon name="camera" /> Instagram</a>}
      </div>
    </SimplePage>
  );
}

function PrivacyPage({ navigate }) {
  return (
    <SimplePage navigate={navigate} title="Privacy Policy">
      <section className="policy-block">
        <p>At Rahul Gamer X, visitor privacy is important. This page explains what information may be collected when you use this website and how it may be used.</p>
        <h2>Information We Collect</h2>
        <p>We may collect non-personal information such as browser type, device type, pages visited, referral source and general analytics data. If you contact us through Telegram, YouTube, Instagram or another link, the information you share there is handled by that platform.</p>
        <h2>Cookies And Advertising</h2>
        <p>This website may use cookies, web beacons, IP addresses and similar technologies to improve user experience, measure traffic and serve relevant advertising. Third-party vendors, including Google, may use cookies to serve ads based on a user's prior visits to this website or other websites.</p>
        <p>Users may opt out of personalized advertising by visiting Google Ads Settings. You can also manage cookies in your browser settings.</p>
        <h2>Third-Party Links</h2>
        <p>Our posts may include download pages, shortener links, Telegram links, YouTube videos and other external resources. We are not responsible for the privacy practices or content of external websites.</p>
        <h2>Children's Privacy</h2>
        <p>Rahul Gamer X is not directed to children under 13. We do not knowingly collect personal information from children.</p>
        <h2>Updates</h2>
        <p>We may update this Privacy Policy when needed. The latest version will always be available on this page.</p>
      </section>
    </SimplePage>
  );
}

function DisclaimerPage({ navigate }) {
  return (
    <SimplePage navigate={navigate} title="Disclaimer">
      <section className="policy-block">
        <p>Rahul Gamer X publishes gaming, Android modding, educational tutorials, download references and creator updates for informational purposes.</p>
        <h2>No Warranty</h2>
        <p>We try to keep information accurate and useful, but we do not guarantee completeness, reliability or availability of any file, tool, tutorial or external link.</p>
        <h2>Downloads And External Links</h2>
        <p>Some posts may redirect to external websites, shortener pages, Telegram bots or third-party services. Users should review those pages before downloading or using any file.</p>
        <h2>Copyright And Ownership</h2>
        <p>All trademarks, logos, app names and game names belong to their respective owners. If you believe any content violates your rights, please contact us so we can review it.</p>
        <h2>Use At Your Own Risk</h2>
        <p>Any modification, installation or use of files shown on this website is done at your own risk. Always follow local laws and platform terms.</p>
      </section>
    </SimplePage>
  );
}

function TermsPage({ navigate }) {
  return (
    <SimplePage navigate={navigate} title="Terms and Conditions">
      <section className="policy-block">
        <p>By using Rahul Gamer X, you agree to these basic terms. If you do not agree, please stop using the website.</p>
        <h2>Website Use</h2>
        <p>You may browse posts, tutorials and download references for personal and educational use. You must not misuse the website, attempt to break its systems or use content for illegal activity.</p>
        <h2>Content</h2>
        <p>Post content, images, descriptions and links may change at any time. We may remove or update content without notice to keep the website clean and useful.</p>
        <h2>External Services</h2>
        <p>This website may link to YouTube, Telegram, shortener services, Cloudinary-hosted images and other external services. Their own terms and policies apply when you visit them.</p>
        <h2>Limitation Of Liability</h2>
        <p>Rahul Gamer X is not responsible for losses, device issues, account problems or damages caused by external files, third-party links or user actions.</p>
        <h2>Contact</h2>
        <p>For questions about these terms, please use the Contact Us page.</p>
      </section>
    </SimplePage>
  );
}

function SimplePage({ navigate, title, children }) {
  return (
    <Shell navigate={navigate}>
      <main className="simple-page">
        <article>
          <h1>{title}</h1>
          {children}
        </article>
      </main>
    </Shell>
  );
}

function DownloadPage({ data, id, navigate }) {
  const file = data.files.find((item) => String(item.id) === String(id)) || data.files[0];
  const targetUrl = fileTargetUrl(file);
  const isShortened = !!(file?.shortenedUrl || file?.shortUrl || file?.shortenerUrl);

  useEffect(() => {
    if (!file || !targetUrl) return undefined;
    const timer = setTimeout(() => {
      window.location.href = targetUrl;
    }, 1200);
    return () => clearTimeout(timer);
  }, [file?.id, targetUrl]);

  if (!file) return <Shell navigate={navigate}><main className="simple-page"><article><h1>No download found</h1></article></main></Shell>;
  return (
    <Shell navigate={navigate}>
      <main className="download-portal">
        <article className="download-card">
          <div className="download-badge"><Icon name="download" /></div>
          <span className="download-status">{isShortened ? "Secure shortener ready" : "Secure download ready"}</span>
          <h1>{file.fileName || file.title || "Rahul Gamer X File"}</h1>
          <p>{file.caption || file.description || "Your download is ready."}</p>
          <div className="download-progress" aria-hidden="true"><span /></div>
          <small>{targetUrl ? "Redirecting automatically..." : "Download link missing. Please contact support."}</small>
          <a className="download-btn" href={targetUrl || "#"} target="_blank" rel="noreferrer">Continue Download</a>
        </article>
      </main>
    </Shell>
  );
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

function readStoredFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem("rgxFavorites") || "[]");
    return Array.isArray(stored) ? stored.map(String) : [];
  } catch {
    return [];
  }
}

function Icon({ name }) {
  const icons = {
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
    download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    mail: <><path d="M4 6h16v12H4z" /><path d="M4 7l8 6 8-6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 7 7 0 1 0 20 15.5z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M4.93 4.93l1.41 1.41" /><path d="M17.66 17.66l1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M4.93 19.07l1.41-1.41" /><path d="M17.66 6.34l1.41-1.41" /></>,
    send: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></>,
    play: <path d="M8 5v14l11-7z" />,
    camera: <><path d="M4 8h4l2-3h4l2 3h4v11H4z" /><circle cx="12" cy="13" r="4" /></>,
    dashboard: <><path d="M4 13h7V4H4z" /><path d="M13 20h7V4h-7z" /><path d="M4 20h7v-5H4z" /></>,
    post: <><path d="M5 4h14v16H5z" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></>,
    refresh: <><path d="M21 12a9 9 0 0 1-15 6.7" /><path d="M3 12a9 9 0 0 1 15-6.7" /><path d="M18 3v5h-5" /><path d="M6 21v-5h5" /></>
  };
  return <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">{icons[name] || icons.home}</svg>;
}

function getRoute() {
  const path = location.pathname.replace(/\/$/, "");
  const params = new URLSearchParams(location.search);
  if (path === "/admin" || path === "/admin.html") return { page: "admin" };
  if (path === "/about" || path === "/about.html") return { page: "about" };
  if (path === "/contact" || path === "/contact.html") return { page: "contact" };
  if (path === "/privacy-policy" || path === "/privacy" || path === "/privacy-policy.html") return { page: "privacy" };
  if (path === "/disclaimer" || path === "/disclaimer.html") return { page: "disclaimer" };
  if (path === "/terms-and-conditions" || path === "/terms" || path === "/terms-and-conditions.html") return { page: "terms" };
  if (path === "/favorites" || path === "/favorites.html") return { page: "favorites" };
  if (path === "/download" || path === "/download.html") return { page: "download", id: params.get("id") };
  if (path === "/post" || path === "/post.html") return { page: "home", postId: params.get("id") };
  return { page: "home", postId: params.get("post") || params.get("id"), query: params.get("q") || "" };
}

createRoot(document.getElementById("root")).render(<App />);
