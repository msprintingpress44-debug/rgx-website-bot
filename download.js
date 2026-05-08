(async function initDownload() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const title = document.querySelector("#fileTitle");
  const meta = document.querySelector("#fileMeta");
  const caption = document.querySelector("#fileCaption");
  const visual = document.querySelector("#fileVisual");
  const btn = document.querySelector("#downloadBtn");
  const fallback = document.querySelector("#fallbackBtn");
  const timerValue = document.querySelector("#timerValue");
  const timerRing = document.querySelector("#timerRing");
  const redirectDialog = document.querySelector("#redirectDialog");
  const duration = 10;
  const circumference = 326.73;

  if (!id) {
    showError("Download not found", "Missing file id.");
    return;
  }

  try {
    const data = await loadRgxData();
    const file = (data.files || []).find((item) => item.id === id);

    if (!file || file.active === false) {
      showError("Download not found", "This RGX link is not available.");
      return;
    }

    title.textContent = file.fileName || "RGX File";
    meta.textContent = file.sizeLabel ? `Size: ${file.sizeLabel}` : "Verified RGX download";
    caption.textContent = "";
    visual.innerHTML = `<span>${escapeHtml((file.extension || "FILE").toUpperCase().slice(0, 5))}</span>`;

    let remaining = duration;
    timerValue.textContent = remaining;
    timerRing.style.strokeDashoffset = "0";

    const tick = window.setInterval(() => {
      remaining -= 1;
      timerValue.textContent = Math.max(remaining, 0);
      timerRing.style.strokeDashoffset = String(circumference * (1 - Math.max(remaining, 0) / duration));

      if (remaining <= 0) {
        window.clearInterval(tick);
        btn.disabled = false;
        btn.textContent = "Download Now";
      }
    }, 1000);

    btn.addEventListener("click", () => {
      const target = file.shortenedUrl || file.botUrl || file.destinationUrl;
      if (target) {
        redirectDialog.classList.remove("hidden");
        incrementDownloadStats(data, file).catch(() => {});
        window.setTimeout(() => {
          location.href = target;
        }, 900);
      }
    });
  } catch (error) {
    showError("Download unavailable", "Please try again shortly.");
  }

  function showError(message, detail) {
    title.textContent = message;
    meta.textContent = detail;
    btn.classList.add("hidden");
    fallback.classList.remove("hidden");
    timerValue.textContent = "0";
    timerRing.style.strokeDashoffset = String(circumference);
  }
})();

async function incrementDownloadStats(data, file) {
  const files = (data.files || []).map((item) => item.id === file.id ? {
    ...item,
    downloads: Number(item.downloads || 0) + 1,
    lastDownloadedAt: new Date().toISOString()
  } : item);

  await fetch("https://rgxbotfile-default-rtdb.firebaseio.com/rgx/files.json", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(files)
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
