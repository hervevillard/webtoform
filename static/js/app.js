(function () {
  "use strict";

  const dropZone   = document.getElementById("drop-zone");
  const fileInput  = document.getElementById("file-input");
  const fileNameEl = document.getElementById("file-name");
  const analyzeBtn = document.getElementById("analyze-btn");
  const statusArea = document.getElementById("status-area");
  const resultCard = document.getElementById("result-card");
  const fieldCount = document.getElementById("field-count-text");
  const fieldList  = document.getElementById("field-list");
  const downloadBtn= document.getElementById("download-btn");

  let selectedFile = null;

  // ── Drag & drop ──────────────────────────────────────────
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  ["dragleave", "dragend"].forEach((ev) =>
    dropZone.addEventListener(ev, () => dropZone.classList.remove("dragover"))
  );
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) setFile(fileInput.files[0]);
  });

  function setFile(file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showStatus("Please select a PDF file.", "error");
      return;
    }
    selectedFile = file;
    fileNameEl.textContent = `Selected: ${file.name} (${formatBytes(file.size)})`;
    analyzeBtn.disabled = false;
    clearStatus();
    resultCard.style.display = "none";
  }

  // ── Analyze ──────────────────────────────────────────────
  analyzeBtn.addEventListener("click", async () => {
    if (!selectedFile) return;

    analyzeBtn.disabled = true;
    resultCard.style.display = "none";
    showSpinner("Uploading and analyzing document with AI…");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        showStatus(data.error || "An unexpected error occurred.", "error");
        analyzeBtn.disabled = false;
        return;
      }

      showStatus(`Done! ${data.field_count} fields identified.`, "success");
      renderResults(data);
    } catch (err) {
      showStatus("Network error — is the server running?", "error");
      analyzeBtn.disabled = false;
    }
  });

  // ── Render results ───────────────────────────────────────
  function renderResults(data) {
    fieldCount.textContent = `${data.field_count} field${data.field_count !== 1 ? "s" : ""} identified by AI`;

    fieldList.innerHTML = "";
    data.fields.forEach((f) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="f-label">${escHtml(f.label)}</span>
        <span style="display:flex;gap:.4rem;align-items:center;">
          <span class="badge badge-type">${escHtml(f.type)}</span>
          ${f.required ? '<span class="badge badge-req">required</span>' : ""}
        </span>`;
      fieldList.appendChild(li);
    });

    downloadBtn.onclick = () => {
      window.location.href = data.download_url;
    };

    resultCard.style.display = "block";
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Helpers ──────────────────────────────────────────────
  function showSpinner(msg) {
    statusArea.innerHTML = `
      <div class="spinner-wrap">
        <div class="spinner"></div>
        <span>${escHtml(msg)}</span>
      </div>`;
  }

  function showStatus(msg, type) {
    const cls = type === "error" ? "msg-error" : "msg-success";
    statusArea.innerHTML = `<p class="${cls}">${escHtml(msg)}</p>`;
  }

  function clearStatus() {
    statusArea.innerHTML = "";
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
})();
