import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createId,
  downloadUrl,
  emptyData,
  extractYouTubeId,
  formatDate,
  loadRgxData,
  postUrl,
  saveRgxData,
  sortedPosts,
  uploadImage
} from "./data.js";
import "./styles.css";

const ADMIN_PASSWORD = "reverse";

function App() {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(getRoute());

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

  if (loading) return <Shell navigate={navigate}><div className="loader">Loading Rahul Gamer X...</div></Shell>;

  const pageProps = { data, saveData, refresh, navigate };
  if (route.page === "admin") return <AdminPage {...pageProps} />;
  if (route.page === "about") return <AboutPage navigate={navigate} />;
  if (route.page === "contact") return <ContactPage data={data} navigate={navigate} />;
  if (route.page === "download") return <DownloadPage {...pageProps} id={route.id} />;
  return <HomePage {...pageProps} postId={route.postId} />;
}

function Shell({ children, navigate, dark = true }) {
  return (
    <div className={dark ? "app-shell dark" : "app-shell"}>
      <header className="topbar">
        <button className="icon-btn" onClick={() => navigate("/")}>☰</button>
        <button className="brand-btn" onClick={() => navigate("/")}>Rahul Gamer X</button>
        <div className="search-pill">⌕ <span>e.g. GTA SA Mods, Dialog File</span></div>
        <button className="icon-btn" onClick={() => navigate("/contact")}>☾</button>
      </header>
      <div className="layout">
        <aside className="rail">
          <button onClick={() => navigate("/")}>⌂</button>
          <button onClick={() => navigate("/download")}>▣</button>
          <button onClick={() => navigate("/about")}>◎</button>
          <button onClick={() => navigate("/contact")}>✉</button>
        </aside>
        {children}
      </div>
    </div>
  );
}

function HomePage({ data, navigate, postId }) {
  const posts = useMemo(() => sortedPosts(data.posts), [data.posts]);
  const currentPost = postId ? posts.find((post) => String(post.id) === String(postId)) : null;
  const pinned = posts.find((post) => post.pinned) || posts[0];

  return (
    <Shell navigate={navigate}>
      <main className="content-grid">
        <section className="main-column">
          {currentPost ? (
            <PostView post={currentPost} />
          ) : (
            <>
              <Hero />
              <SectionTitle title="Pinned Post" />
              {pinned ? <PostCard post={pinned} pinned navigate={navigate} /> : <Empty text="No post published yet." />}
              <SectionTitle title="All Story" />
              <div className="story-grid">
                {posts.map((post) => <PostCard key={post.id} post={post} navigate={navigate} />)}
              </div>
            </>
          )}
        </section>
        <Sidebar posts={posts} data={data} navigate={navigate} />
      </main>
    </Shell>
  );
}

function Hero() {
  return (
    <section className="hero-panel">
      <h1>3500+ Subscribers</h1>
      <h2>Thank You</h2>
      <div className="latest-chip"><span>Latest:</span> <b>Loading latest post...</b></div>
    </section>
  );
}

function SectionTitle({ title }) {
  return <h3 className="section-title">{title}<span /></h3>;
}

function PostCard({ post, navigate, pinned = false }) {
  return (
    <article className={pinned ? "post-card pinned" : "post-card"}>
      {post.image && <img src={post.image} alt={post.title} />}
      <div className="post-card-body">
        <small>{post.category || "Post"}{post.pinned ? " · Pinned" : ""}</small>
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
        {links.telegram && <a href={links.telegram} target="_blank" rel="noreferrer">Telegram</a>}
        {links.youtube && <a href={links.youtube} target="_blank" rel="noreferrer">YouTube</a>}
        {links.instagram && <a href={links.instagram} target="_blank" rel="noreferrer">Instagram</a>}
      </div>
      {video && <VideoBox link={video} />}
    </aside>
  );
}

function VideoBox({ link }) {
  const id = extractYouTubeId(link);
  const src = id ? `https://www.youtube.com/embed/${id}?controls=1&rel=0` : link;
  return (
    <div className="video-box">
      <div className="video-title">New Video</div>
      <iframe src={src} title="Rahul Gamer X video" allow="autoplay; encrypted-media" allowFullScreen />
      <a href={link} target="_blank" rel="noreferrer">Open in YouTube</a>
    </div>
  );
}

function PostView({ post }) {
  const buttons = getPostButtons(post);
  const image = post.image || post.imageUrl || post.logo;
  return (
    <article className="full-post">
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

function getPostButtons(post) {
  const buttons = [];
  if (post.buttonUrl) buttons.push({ text: post.buttonText || "Download Now", url: post.buttonUrl });
  if (Array.isArray(post.postButtons)) {
    post.postButtons.forEach((button) => {
      if (button?.text && button?.url) buttons.push(button);
    });
  }
  return buttons;
}

function AdminPage({ data, saveData, refresh, navigate }) {
  const [loggedIn, setLoggedIn] = useState(sessionStorage.getItem("rgxAdmin") === "1");
  const [password, setPassword] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(blankPost());
  const [support, setSupport] = useState(data.settings?.socialLinks || {});
  const [status, setStatus] = useState("Ready");

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
    const nextPost = {
      ...(data.posts.find((post) => post.id === editingId) || {}),
      id: editingId || createId(),
      title: form.title.trim(),
      category: form.category.trim() || "Post",
      description: form.description.trim(),
      image: imageFromUpload || form.imageUrl.trim(),
      imageUrl: imageFromUpload || form.imageUrl.trim(),
      buttonText: form.buttonText.trim() || "Download Now",
      buttonUrl: form.buttonUrl.trim(),
      postButtons: parseButtons(form.extraButtons),
      pinned: form.pinned,
      active: true,
      createdAt: editingId ? data.posts.find((post) => post.id === editingId)?.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!nextPost.title) return setStatus("Post title required.");
    const posts = editingId
      ? data.posts.map((post) => post.id === editingId ? nextPost : post)
      : [nextPost, ...data.posts];
    const finalPosts = nextPost.pinned ? posts.map((post) => ({ ...post, pinned: post.id === nextPost.id })) : posts;
    await saveData({ ...data, posts: finalPosts });
    setForm(blankPost());
    setEditingId("");
    setStatus("Post saved.");
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

  function selectFileLink(value) {
    setForm((current) => ({ ...current, buttonUrl: value }));
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
      extraButtons: Array.isArray(post.postButtons) ? post.postButtons.map((b) => `${b.text} | ${b.url}`).join("\n") : "",
      pinned: !!post.pinned
    });
  }

  if (!loggedIn) {
    return (
      <div className="admin-page">
        <section className="login-card">
          <h1>Rahul Gamer X Admin</h1>
          <p>Clean React admin panel. Password required.</p>
          <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} placeholder="Password" type="password" />
          <button onClick={login}>Login</button>
          <small>{status}</small>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><b>Rahul Gamer X</b><span>{status}</span></div>
        <div>
          <button onClick={refresh}>Refresh</button>
          <button onClick={() => navigate("/")}>Open Site</button>
        </div>
      </header>
      <main className="admin-grid-page">
        <section className="admin-panel">
          <h2>{editingId ? "Edit Post" : "New Post"}</h2>
          <form className="admin-form" onSubmit={submitPost}>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Post title" required />
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" />
            <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, imageFile: e.target.files?.[0] || null })} />
            <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Image URL or upload image above" />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows="5" />
            <select value={form.buttonUrl} onChange={(e) => selectFileLink(e.target.value)}>
              <option value="">Select uploaded bot file for download button</option>
              {data.files.map((file) => <option key={file.id} value={downloadUrl(file)}>{file.fileName || file.title || file.id}</option>)}
            </select>
            <input value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} placeholder="Download button name" />
            <input value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })} placeholder="Download button link (optional)" />
            <textarea value={form.extraButtons} onChange={(e) => setForm({ ...form, extraButtons: e.target.value })} placeholder="Extra buttons optional: Name | Link" rows="3" />
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
                <small>{post.category} · {post.pinned ? "Pinned" : "Normal"}</small>
                <div><button onClick={() => edit(post)}>Edit</button><button onClick={() => deletePost(post.id)}>Delete</button></div>
              </article>
            ))}
          </div>
          <h2>Support Links</h2>
          <form className="admin-form compact" onSubmit={saveSupport}>
            {["telegram", "youtube", "instagram", "video"].map((key) => (
              <input key={key} value={support[key] || ""} onChange={(e) => setSupport({ ...support, [key]: e.target.value })} placeholder={`${key} link`} />
            ))}
            <button className="primary-btn" type="submit">Save Links</button>
          </form>
        </section>
      </main>
    </div>
  );
}

function blankPost() {
  return { title: "", category: "", description: "", imageUrl: "", imageFile: null, buttonText: "Download Now", buttonUrl: "", extraButtons: "", pinned: false };
}

function parseButtons(value) {
  return String(value || "").split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [text, url] = line.split("|").map((part) => part.trim());
      return { text, url };
    })
    .filter((button) => button.text && button.url);
}

function AboutPage({ navigate }) {
  return (
    <SimplePage navigate={navigate} title="About Rahul Gamer X">
      <p>Rahul Gamer X is a gaming and modding hub for premium dialogs, Android modding content, download links and video updates.</p>
      <p>The site is now rebuilt in React, so posts, files and official links stay connected with the database while the UI remains fast and clean.</p>
    </SimplePage>
  );
}

function ContactPage({ data, navigate }) {
  const links = data.settings?.socialLinks || {};
  return (
    <SimplePage navigate={navigate} title="Contact Rahul Gamer X">
      <p>For support, collaborations, paid dialogs or updates, use the official links below.</p>
      <div className="contact-buttons">
        {links.telegram && <a className="telegram" href={links.telegram} target="_blank" rel="noreferrer">Telegram</a>}
        {links.youtube && <a className="youtube" href={links.youtube} target="_blank" rel="noreferrer">YouTube</a>}
        {links.instagram && <a className="instagram" href={links.instagram} target="_blank" rel="noreferrer">Instagram</a>}
      </div>
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
  if (!file) return <Shell navigate={navigate}><main className="simple-page"><article><h1>No download found</h1></article></main></Shell>;
  return (
    <Shell navigate={navigate}>
      <main className="simple-page">
        <article>
          <h1>{file.fileName || file.title || "Rahul Gamer X File"}</h1>
          <p>{file.caption || file.description || "Your download is ready."}</p>
          <a className="download-btn" href={file.url || file.directUrl || file.telegramUrl || "#"} target="_blank" rel="noreferrer">Open Download</a>
        </article>
      </main>
    </Shell>
  );
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

function getRoute() {
  const path = location.pathname.replace(/\/$/, "");
  const params = new URLSearchParams(location.search);
  if (path === "/admin" || path === "/admin.html") return { page: "admin" };
  if (path === "/about" || path === "/about.html") return { page: "about" };
  if (path === "/contact" || path === "/contact.html") return { page: "contact" };
  if (path === "/download" || path === "/download.html") return { page: "download", id: params.get("id") };
  if (path === "/post" || path === "/post.html") return { page: "home", postId: params.get("id") };
  return { page: "home", postId: params.get("post") || params.get("id") };
}

createRoot(document.getElementById("root")).render(<App />);
