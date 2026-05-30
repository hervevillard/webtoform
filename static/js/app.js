(function () {
  "use strict";

  // ── Step indicator ───────────────────────────────────────
  const steps = [
    document.getElementById("step-1"),
    document.getElementById("step-2"),
    document.getElementById("step-3"),
  ];

  function setStep(active) {
    steps.forEach((s, i) => {
      s.classList.remove("active", "done");
      if (i + 1 < active)      s.classList.add("done");
      else if (i + 1 === active) s.classList.add("active");
    });
  }
  setStep(1);

  // ── Settings drawer (API key) ────────────────────────────
  const settingsBtn    = document.getElementById("settings-btn");
  const settingsDrawer = document.getElementById("settings-drawer");
  const settingsClose  = document.getElementById("settings-close");
  const keyBanner      = document.getElementById("key-banner");
  const keyDot         = document.getElementById("key-dot");
  const keyIndicLabel  = document.getElementById("key-indicator-label");
  const keyStatusIcon  = document.getElementById("key-status-icon");
  const keyStatusText  = document.getElementById("key-status-text");
  const keyInput       = document.getElementById("api-key-input");
  const keyVisBtn      = document.getElementById("key-toggle-vis");
  const saveKeyBtn     = document.getElementById("save-key-btn");
  const keySaveStatus  = document.getElementById("key-save-status");

  let keyIsSet = false;

  function openDrawer()  {
    settingsDrawer.style.display = "block";
    settingsBtn.style.transform  = "rotate(60deg)";
  }
  function closeDrawer() {
    settingsDrawer.style.display = "none";
    settingsBtn.style.transform  = "";
  }

  settingsBtn.addEventListener("click", () =>
    settingsDrawer.style.display === "none" ? openDrawer() : closeDrawer()
  );
  settingsClose.addEventListener("click", closeDrawer);

  // Close drawer when clicking outside
  document.addEventListener("click", (e) => {
    if (settingsDrawer.style.display === "block" &&
        !settingsDrawer.contains(e.target) &&
        e.target !== settingsBtn) {
      closeDrawer();
    }
  });

  async function checkKeyStatus() {
    try {
      const res  = await fetch("/api-key-status");
      const data = await res.json();
      keyIsSet   = data.key_set;
    } catch (_) {
      keyIsSet = false;
    }
    renderKeyState();
  }

  function renderKeyState() {
    if (keyIsSet) {
      keyDot.className         = "key-dot key-dot--set";
      keyIndicLabel.textContent= "API Key ✓";
      keyStatusIcon.textContent= "✅";
      keyStatusText.textContent= "API key is configured";
      keyStatusText.style.color= "#4ADE80";
      keyBanner.style.display  = "none";
    } else {
      keyDot.className         = "key-dot key-dot--missing";
      keyIndicLabel.textContent= "API Key";
      keyStatusIcon.textContent= "⚠️";
      keyStatusText.textContent= "No key set — paste one below";
      keyStatusText.style.color= "var(--terra-light)";
      keyBanner.style.display  = "flex";
      openDrawer();
    }
  }

  keyVisBtn.addEventListener("click", () => {
    keyInput.type              = keyInput.type === "password" ? "text" : "password";
    keyVisBtn.textContent      = keyInput.type === "password" ? "👁" : "🙈";
  });

  saveKeyBtn.addEventListener("click", async () => {
    const key = keyInput.value.trim();
    if (!key) {
      keySaveStatus.textContent = "Please paste a key first.";
      keySaveStatus.style.color = "var(--terra-light)";
      return;
    }
    saveKeyBtn.disabled        = true;
    keySaveStatus.textContent  = "Saving…";
    keySaveStatus.style.color  = "var(--sand)";
    try {
      const res  = await fetch("/set-api-key", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ api_key: key }),
      });
      const data = await res.json();
      if (res.ok) {
        keyInput.value             = "";
        keySaveStatus.textContent  = "✓ Saved!";
        keySaveStatus.style.color  = "#4ADE80";
        keyIsSet = true;
        renderKeyState();
        setTimeout(() => { keySaveStatus.textContent = ""; closeDrawer(); }, 1500);
      } else {
        keySaveStatus.textContent  = data.error || "Failed to save.";
        keySaveStatus.style.color  = "var(--terra-light)";
      }
    } catch (_) {
      keySaveStatus.textContent    = "Network error.";
      keySaveStatus.style.color    = "var(--terra-light)";
    }
    saveKeyBtn.disabled = false;
  });

  checkKeyStatus();

  // ── Upload / analysis ────────────────────────────────────
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

  // Drag & drop
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
  ["dragleave", "dragend"].forEach((ev) => dropZone.addEventListener(ev, () => dropZone.classList.remove("dragover")));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

  function setFile(file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showStatus("Please select a PDF file.", "error");
      return;
    }
    selectedFile = file;
    fileNameEl.innerHTML = `&#128196; <strong>${escHtml(file.name)}</strong> &nbsp;(${formatBytes(file.size)})`;
    analyzeBtn.disabled  = false;
    clearStatus();
    resultCard.style.display = "none";
    setStep(1);
  }

  analyzeBtn.addEventListener("click", async () => {
    if (!selectedFile) return;
    analyzeBtn.disabled       = true;
    resultCard.style.display  = "none";
    setStep(2);
    showSpinner("Uploading and analyzing document with AI…");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res  = await fetch("/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        showStatus(data.error || "An unexpected error occurred.", "error");
        analyzeBtn.disabled = false;
        setStep(1);
        return;
      }
      showStatus(`&#10003; Done — ${data.field_count} fields identified.`, "success");
      renderResults(data);
      setStep(3);
    } catch (_) {
      showStatus("Network error — is the server running?", "error");
      analyzeBtn.disabled = false;
      setStep(1);
    }
  });

  function renderResults(data) {
    fieldCount.textContent = `${data.field_count} field${data.field_count !== 1 ? "s" : ""} identified by AI`;

    fieldList.innerHTML = "";
    data.fields.forEach((f) => {
      const li   = document.createElement("li");
      const type = f.type || "text";
      li.innerHTML = `
        <span class="f-label">${escHtml(f.label)}</span>
        <span style="display:flex;gap:.35rem;align-items:center;">
          <span class="badge badge-${escHtml(type)}">${escHtml(type)}</span>
          ${f.required ? '<span class="badge badge-req">required</span>' : ""}
        </span>`;
      fieldList.appendChild(li);
    });

    downloadBtn.onclick       = () => { window.location.href = data.download_url; };
    resultCard.style.display  = "block";
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
    analyzeBtn.disabled       = false;
  }

  function showSpinner(msg) {
    statusArea.innerHTML = `
      <div class="spinner-wrap">
        <div class="spinner"></div>
        <span>${escHtml(msg)}</span>
      </div>`;
  }
  function showStatus(msg, type) {
    const cls = type === "error" ? "msg-error" : "msg-success";
    statusArea.innerHTML = `<div class="${cls}">${msg}</div>`;
  }
  function clearStatus() { statusArea.innerHTML = ""; }
  function escHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function formatBytes(b) {
    if (b < 1024)         return b + " B";
    if (b < 1024 * 1024)  return (b / 1024).toFixed(1) + " KB";
    return (b / (1024 * 1024)).toFixed(1) + " MB";
  }
})();
