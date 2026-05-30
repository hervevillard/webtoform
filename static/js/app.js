(function () {
  "use strict";

  // ════════════════════════════════════════════════════════
  // TAB SWITCHING
  // ════════════════════════════════════════════════════════
  const tabBtns   = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  function switchTab(id) {
    tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === id));
    tabPanels.forEach(p => p.classList.toggle("active", p.id === "tab-" + id));
  }
  tabBtns.forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  // ════════════════════════════════════════════════════════
  // STEP INDICATOR (AI tab)
  // ════════════════════════════════════════════════════════
  const steps = [
    document.getElementById("step-1"),
    document.getElementById("step-2"),
    document.getElementById("step-3"),
  ];

  function setStep(active) {
    steps.forEach((s, i) => {
      s.classList.remove("active", "done");
      if (i + 1 < active)       s.classList.add("done");
      else if (i + 1 === active) s.classList.add("active");
    });
  }
  setStep(1);

  // ════════════════════════════════════════════════════════
  // SETTINGS DRAWER (API key)
  // ════════════════════════════════════════════════════════
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

  function openDrawer()  { settingsDrawer.style.display = "block"; settingsBtn.style.transform = "rotate(60deg)"; }
  function closeDrawer() { settingsDrawer.style.display = "none";  settingsBtn.style.transform = ""; }

  settingsBtn.addEventListener("click", () =>
    settingsDrawer.style.display === "none" ? openDrawer() : closeDrawer()
  );
  settingsClose.addEventListener("click", closeDrawer);
  document.addEventListener("click", (e) => {
    if (settingsDrawer.style.display === "block" &&
        !settingsDrawer.contains(e.target) && e.target !== settingsBtn) closeDrawer();
  });

  async function checkKeyStatus() {
    try {
      const data = await fetch("/api-key-status").then(r => r.json());
      keyIsSet   = data.key_set;
    } catch (_) { keyIsSet = false; }
    renderKeyState();
  }

  function renderKeyState() {
    if (keyIsSet) {
      keyDot.className          = "key-dot key-dot--set";
      keyIndicLabel.textContent = "API Key ✓";
      keyStatusIcon.textContent = "✅";
      keyStatusText.textContent = "API key is configured";
      keyStatusText.style.color = "#4ADE80";
      keyBanner.style.display   = "none";
    } else {
      keyDot.className          = "key-dot key-dot--missing";
      keyIndicLabel.textContent = "API Key";
      keyStatusIcon.textContent = "⚠️";
      keyStatusText.textContent = "No key set — paste one below";
      keyStatusText.style.color = "var(--terra-light)";
      keyBanner.style.display   = "flex";
      openDrawer();
    }
  }

  keyVisBtn.addEventListener("click", () => {
    keyInput.type         = keyInput.type === "password" ? "text" : "password";
    keyVisBtn.textContent = keyInput.type === "password" ? "👁" : "🙈";
  });

  saveKeyBtn.addEventListener("click", async () => {
    const key = keyInput.value.trim();
    if (!key) { keySaveStatus.textContent = "Please paste a key first."; keySaveStatus.style.color = "var(--terra-light)"; return; }
    saveKeyBtn.disabled = true;
    keySaveStatus.textContent = "Saving…"; keySaveStatus.style.color = "var(--sand)";
    try {
      const res  = await fetch("/set-api-key", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({api_key: key}) });
      const data = await res.json();
      if (res.ok) {
        keyInput.value = ""; keySaveStatus.textContent = "✓ Saved!"; keySaveStatus.style.color = "#4ADE80";
        keyIsSet = true; renderKeyState();
        setTimeout(() => { keySaveStatus.textContent = ""; closeDrawer(); }, 1500);
      } else { keySaveStatus.textContent = data.error || "Failed to save."; keySaveStatus.style.color = "var(--terra-light)"; }
    } catch (_) { keySaveStatus.textContent = "Network error."; keySaveStatus.style.color = "var(--terra-light)"; }
    saveKeyBtn.disabled = false;
  });

  checkKeyStatus();

  // ════════════════════════════════════════════════════════
  // AI GENERATE TAB
  // ════════════════════════════════════════════════════════
  const dropZone   = document.getElementById("drop-zone");
  const fileInput  = document.getElementById("file-input");
  const fileNameEl = document.getElementById("file-name");
  const analyzeBtn = document.getElementById("analyze-btn");
  const statusArea = document.getElementById("status-area");
  const resultCard      = document.getElementById("result-card");
  const fieldCount      = document.getElementById("field-count-text");
  const fieldList       = document.getElementById("field-list");
  const aiBuilderEmpty  = document.getElementById("ai-builder-empty");
  const aiAddFieldBtn   = document.getElementById("ai-add-field-btn");
  const downloadBtn     = document.getElementById("download-btn");
  const aiBuildStatus   = document.getElementById("ai-build-status");
  let   aiFormTitle     = "Customer Information Form";

  let selectedFile = null;

  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
  ["dragleave","dragend"].forEach(ev => dropZone.addEventListener(ev, () => dropZone.classList.remove("dragover")));
  dropZone.addEventListener("drop", (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

  function setFile(file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) { showStatus(statusArea, "Please select a PDF file.", "error"); return; }
    selectedFile = file;
    fileNameEl.innerHTML = `&#128196; <strong>${escHtml(file.name)}</strong> &nbsp;(${formatBytes(file.size)})`;
    analyzeBtn.disabled  = false;
    statusArea.innerHTML = "";
    resultCard.style.display = "none";
    setStep(1);
  }

  analyzeBtn.addEventListener("click", async () => {
    if (!selectedFile) return;
    analyzeBtn.disabled = true; resultCard.style.display = "none"; setStep(2);
    showSpinner(statusArea, "Uploading and analyzing document with AI…");
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      const res  = await fetch("/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { showStatus(statusArea, data.error || "An unexpected error occurred.", "error"); analyzeBtn.disabled = false; setStep(1); return; }
      showStatus(statusArea, `&#10003; Done — ${data.field_count} fields identified.`, "success");
      renderFieldResults(data);
      resultCard.style.display = "block";
      resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
      setStep(3);
    } catch (_) { showStatus(statusArea, "Network error — is the server running?", "error"); analyzeBtn.disabled = false; setStep(1); }
    analyzeBtn.disabled = false;
  });

  // ════════════════════════════════════════════════════════
  // MANUAL BUILDER TAB
  // ════════════════════════════════════════════════════════
  const buildTitleInput   = document.getElementById("build-title");
  const builderList       = document.getElementById("builder-list");
  const builderEmpty      = document.getElementById("builder-empty");
  const builderCountEl    = document.getElementById("builder-count");
  const addFieldBtn       = document.getElementById("add-field-btn");
  const buildGenerateBtn  = document.getElementById("build-generate-btn");
  const buildStatusArea   = document.getElementById("build-status-area");
  const buildResultCard   = document.getElementById("build-result-card");
  const buildFieldCount   = document.getElementById("build-field-count-text");
  const buildDownloadBtn  = document.getElementById("build-download-btn");

  const FIELD_TYPES = ["text","textarea","date","email","phone","checkbox","list"];
  let fieldSeq = 0;   // unique key for each row

  function updateBuilderState() {
    const rows = builderList.querySelectorAll(".builder-row").length;
    builderEmpty.style.display  = rows === 0 ? "block" : "none";
    builderCountEl.textContent  = rows === 1 ? "1 field" : `${rows} fields`;
  }

  function addFieldRow(label = "", type = "text", required = false) {
    builderEmpty.style.display = "none";
    const id  = ++fieldSeq;
    const li  = document.createElement("li");
    li.className   = "builder-row";
    li.dataset.key = id;

    const typeOptions = FIELD_TYPES.map(t =>
      `<option value="${t}"${t === type ? " selected" : ""}>${t}</option>`
    ).join("");

    li.innerHTML = `
      <span class="builder-drag-handle" title="Field">&#8801;</span>
      <input type="text" class="builder-label-input" placeholder="Field label…" value="${escHtml(label)}" />
      <select class="builder-type-select">${typeOptions}</select>
      <label class="req-toggle-wrap" title="Required">
        <input type="checkbox" ${required ? "checked" : ""} />
        <span class="req-label">Req.</span>
      </label>
      <button class="btn-danger-ghost" title="Remove field">&#10005;</button>`;

    li.querySelector(".btn-danger-ghost").addEventListener("click", () => {
      li.remove();
      updateBuilderState();
    });

    builderList.appendChild(li);
    li.querySelector(".builder-label-input").focus();
    updateBuilderState();
  }

  addFieldBtn.addEventListener("click", () => addFieldRow());

  function collectBuilderFields() {
    return Array.from(builderList.querySelectorAll(".builder-row")).map(row => ({
      label:    row.querySelector(".builder-label-input").value.trim(),
      type:     row.querySelector(".builder-type-select").value,
      required: row.querySelector('input[type="checkbox"]').checked,
    }));
  }

  buildGenerateBtn.addEventListener("click", async () => {
    const title  = buildTitleInput.value.trim();
    const fields = collectBuilderFields();

    if (!title) { showStatus(buildStatusArea, "Please enter a form title.", "error"); buildTitleInput.focus(); return; }
    if (fields.length === 0) { showStatus(buildStatusArea, "Please add at least one field.", "error"); return; }
    const emptyIdx = fields.findIndex(f => !f.label);
    if (emptyIdx !== -1) { showStatus(buildStatusArea, `Field #${emptyIdx + 1} has an empty label.`, "error"); return; }

    buildGenerateBtn.disabled  = true;
    buildResultCard.style.display = "none";
    showSpinner(buildStatusArea, "Generating your fillable PDF…");

    try {
      const res  = await fetch("/build", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({title, fields}) });
      const data = await res.json();
      if (!res.ok) { showStatus(buildStatusArea, data.error || "Generation failed.", "error"); buildGenerateBtn.disabled = false; return; }
      showStatus(buildStatusArea, `&#10003; Done — ${data.field_count} fields generated.`, "success");
      buildFieldCount.textContent   = `${data.field_count} field${data.field_count !== 1 ? "s" : ""} in your form`;
      buildDownloadBtn.onclick      = () => { window.location.href = data.download_url; };
      buildResultCard.style.display = "block";
      buildResultCard.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (_) { showStatus(buildStatusArea, "Network error — is the server running?", "error"); }
    buildGenerateBtn.disabled = false;
  });

  // ════════════════════════════════════════════════════════
  // SHARED HELPERS
  // ════════════════════════════════════════════════════════
  // SHARE FORM TAB
  // ════════════════════════════════════════════════════════
  const shareBuilderList   = document.getElementById("share-builder-list");
  const shareBuilderEmpty  = document.getElementById("share-builder-empty");
  const shareBuilderCount  = document.getElementById("share-builder-count");
  const shareAddFieldBtn   = document.getElementById("share-add-field-btn");
  const shareGenerateBtn   = document.getElementById("share-generate-btn");
  const shareStatusArea    = document.getElementById("share-status-area");
  const shareUrlResult     = document.getElementById("share-url-result");
  const shareUrlBox        = document.getElementById("share-url-box");
  const copyUrlBtn         = document.getElementById("copy-url-btn");
  const shareTitleInput    = document.getElementById("share-title");

  let shareSeq = 0;

  function updateShareBuilderState() {
    const rows = shareBuilderList.querySelectorAll(".builder-row").length;
    shareBuilderEmpty.style.display = rows === 0 ? "block" : "none";
    shareBuilderCount.textContent   = rows === 1 ? "1 field" : `${rows} fields`;
  }

  function addShareFieldRow(label = "", type = "text", required = false) {
    shareBuilderEmpty.style.display = "none";
    const id  = ++shareSeq;
    const li  = document.createElement("li");
    li.className   = "builder-row";
    li.dataset.key = id;
    const typeOptions = FIELD_TYPES.map(t =>
      `<option value="${t}"${t === type ? " selected" : ""}>${t}</option>`
    ).join("");
    li.innerHTML = `
      <span class="builder-drag-handle" title="Field">&#8801;</span>
      <input type="text" class="builder-label-input" placeholder="Field label…" value="${escHtml(label)}" />
      <select class="builder-type-select">${typeOptions}</select>
      <label class="req-toggle-wrap" title="Required">
        <input type="checkbox" ${required ? "checked" : ""} />
        <span class="req-label">Req.</span>
      </label>
      <button class="btn-danger-ghost" title="Remove field">&#10005;</button>`;
    li.querySelector(".btn-danger-ghost").addEventListener("click", () => { li.remove(); updateShareBuilderState(); });
    shareBuilderList.appendChild(li);
    li.querySelector(".builder-label-input").focus();
    updateShareBuilderState();
  }

  shareAddFieldBtn.addEventListener("click", () => addShareFieldRow());

  function collectShareFields() {
    return Array.from(shareBuilderList.querySelectorAll(".builder-row")).map(row => ({
      label:    row.querySelector(".builder-label-input").value.trim(),
      type:     row.querySelector(".builder-type-select").value,
      required: row.querySelector('input[type="checkbox"]').checked,
    }));
  }

  shareGenerateBtn.addEventListener("click", async () => {
    const title  = shareTitleInput.value.trim();
    const fields = collectShareFields();
    if (!title) { showStatus(shareStatusArea, "Please enter a form title.", "error"); shareTitleInput.focus(); return; }
    if (fields.length === 0) { showStatus(shareStatusArea, "Please add at least one field.", "error"); return; }
    const emptyIdx = fields.findIndex(f => !f.label);
    if (emptyIdx !== -1) { showStatus(shareStatusArea, `Field #${emptyIdx + 1} has an empty label.`, "error"); return; }

    shareGenerateBtn.disabled = true;
    shareUrlResult.style.display = "none";
    showSpinner(shareStatusArea, "Creating your shareable form link…");

    try {
      const res  = await fetch("/share", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({title, fields}) });
      const data = await res.json();
      if (!res.ok) { showStatus(shareStatusArea, data.error || "Failed to create share link.", "error"); shareGenerateBtn.disabled = false; return; }
      showStatus(shareStatusArea, `&#10003; Link created — ${data.field_count} fields.`, "success");
      shareUrlBox.value            = data.share_url;
      shareUrlResult.style.display = "block";
      shareUrlBox.select();
    } catch (_) { showStatus(shareStatusArea, "Network error — is the server running?", "error"); }
    shareGenerateBtn.disabled = false;
  });

  copyUrlBtn.addEventListener("click", () => {
    if (!shareUrlBox.value) return;
    navigator.clipboard.writeText(shareUrlBox.value).then(() => {
      copyUrlBtn.textContent = "✓";
      copyUrlBtn.classList.add("copied");
      setTimeout(() => { copyUrlBtn.textContent = "📋"; copyUrlBtn.classList.remove("copied"); }, 2000);
    }).catch(() => { shareUrlBox.select(); });
  });

  // ════════════════════════════════════════════════════════
  // RESPONSES TAB
  // ════════════════════════════════════════════════════════
  const responsesList    = document.getElementById("responses-list");
  const responsesEmpty   = document.getElementById("responses-empty");
  const responsesLoading = document.getElementById("responses-loading");
  const refreshBtn       = document.getElementById("refresh-responses-btn");

  async function loadResponses() {
    responsesLoading.style.display = "block";
    responsesEmpty.style.display   = "none";
    responsesList.innerHTML        = "";
    try {
      const forms = await fetch("/responses").then(r => r.json());
      responsesLoading.style.display = "none";
      if (!forms.length) { responsesEmpty.style.display = "block"; return; }
      forms.forEach(form => responsesList.appendChild(buildFormBlock(form)));
    } catch (_) {
      responsesLoading.textContent = "Failed to load — is the server running?";
    }
  }

  function buildFormBlock(form) {
    const subCount  = form.submissions.length;
    const block     = document.createElement("div");
    block.className = "resp-form-block";

    const header = document.createElement("div");
    header.className = "resp-form-header";
    header.innerHTML = `
      <div style="flex:1;min-width:0;">
        <div class="resp-form-title">${escHtml(form.title)}</div>
        <div class="resp-form-meta">Created ${form.created.replace("T"," ")} &nbsp;·&nbsp; ID: ${escHtml(form.id)}</div>
      </div>
      <span class="resp-badge ${subCount === 0 ? "zero" : ""}">${subCount} response${subCount !== 1 ? "s" : ""}</span>
      <span class="resp-chevron">&#8964;</span>`;

    const body = document.createElement("div");
    body.className = "resp-submissions";

    if (subCount === 0) {
      body.innerHTML = `<div class="resp-no-submissions">No responses yet.</div>`;
    } else {
      form.submissions.forEach((sub, idx) => {
        const s  = document.createElement("div");
        s.className = "resp-submission";
        const rows = Object.entries(sub.data).map(([k, v]) => {
          const display = Array.isArray(v) ? v.filter(Boolean).join(", ") || "—" : (v || "—");
          return `<div class="resp-field-row"><span class="resp-field-key">${escHtml(k)}</span><span class="resp-field-val">${escHtml(display)}</span></div>`;
        }).join("");
        s.innerHTML = `<div class="resp-submission-time">&#128337; ${sub.submitted.replace("T"," ")}</div>${rows}`;
        body.appendChild(s);
      });
    }

    header.addEventListener("click", () => {
      const chevron = header.querySelector(".resp-chevron");
      body.classList.toggle("open");
      chevron.classList.toggle("open");
    });

    block.appendChild(header);
    block.appendChild(body);
    return block;
  }

  // Load responses when switching to that tab
  const origSwitchTab = switchTab;
  tabBtns.forEach(b => b.addEventListener("click", () => {
    if (b.dataset.tab === "responses") loadResponses();
  }));
  refreshBtn.addEventListener("click", loadResponses);

  // ════════════════════════════════════════════════════════
  // AI RESULT CARD — editable field rows
  // ════════════════════════════════════════════════════════
  let aiFieldSeq = 0;

  function updateAiBuilderState() {
    const rows = fieldList.querySelectorAll(".builder-row").length;
    aiBuilderEmpty.style.display = rows === 0 ? "block" : "none";
    fieldCount.textContent = `${rows} field${rows !== 1 ? "s" : ""} identified by AI`;
  }

  function addAiFieldRow(label = "", type = "text", required = false) {
    aiBuilderEmpty.style.display = "none";
    const id  = ++aiFieldSeq;
    const li  = document.createElement("li");
    li.className   = "builder-row";
    li.dataset.key = id;
    const typeOptions = FIELD_TYPES.map(t =>
      `<option value="${t}"${t === type ? " selected" : ""}>${t}</option>`
    ).join("");
    li.innerHTML = `
      <span class="builder-drag-handle" title="Field">&#8801;</span>
      <input type="text" class="builder-label-input" placeholder="Field label…" value="${escHtml(label)}" />
      <select class="builder-type-select">${typeOptions}</select>
      <label class="req-toggle-wrap" title="Required">
        <input type="checkbox" ${required ? "checked" : ""} />
        <span class="req-label">Req.</span>
      </label>
      <button class="btn-danger-ghost" title="Remove field">&#10005;</button>`;
    li.querySelector(".btn-danger-ghost").addEventListener("click", () => {
      li.remove();
      updateAiBuilderState();
    });
    fieldList.appendChild(li);
    updateAiBuilderState();
  }

  function collectAiFields() {
    return Array.from(fieldList.querySelectorAll(".builder-row")).map(row => ({
      label:    row.querySelector(".builder-label-input").value.trim(),
      type:     row.querySelector(".builder-type-select").value,
      required: row.querySelector('input[type="checkbox"]').checked,
    }));
  }

  aiAddFieldBtn.addEventListener("click", () => {
    addAiFieldRow();
    fieldList.lastElementChild.querySelector(".builder-label-input").focus();
  });

  downloadBtn.addEventListener("click", async () => {
    const fields = collectAiFields();
    const emptyIdx = fields.findIndex(f => !f.label);
    if (emptyIdx !== -1) { showStatus(aiBuildStatus, `Field #${emptyIdx + 1} has an empty label.`, "error"); return; }
    if (fields.length === 0) { showStatus(aiBuildStatus, "Please add at least one field.", "error"); return; }

    downloadBtn.disabled = true;
    showSpinner(aiBuildStatus, "Generating your PDF…");
    try {
      const res  = await fetch("/build", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({title: aiFormTitle, fields}),
      });
      const data = await res.json();
      if (!res.ok) { showStatus(aiBuildStatus, data.error || "Generation failed.", "error"); downloadBtn.disabled = false; return; }
      showStatus(aiBuildStatus, "&#10003; PDF ready — downloading…", "success");
      window.location.href = data.download_url;
    } catch (_) { showStatus(aiBuildStatus, "Network error — is the server running?", "error"); }
    downloadBtn.disabled = false;
  });

  function renderFieldResults(data) {
    aiFormTitle = data.title || "Customer Information Form";
    fieldList.innerHTML = "";
    aiFieldSeq = 0;
    data.fields.forEach(f => addAiFieldRow(f.label, f.type || "text", !!f.required));
    updateAiBuilderState();
    aiBuildStatus.innerHTML = "";
  }

  function showSpinner(area, msg) {
    area.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>${escHtml(msg)}</span></div>`;
  }
  function showStatus(area, msg, type) {
    area.innerHTML = `<div class="${type === "error" ? "msg-error" : "msg-success"}">${msg}</div>`;
  }
  function escHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function formatBytes(b) {
    if (b < 1024)        return b + " B";
    if (b < 1024*1024)   return (b/1024).toFixed(1) + " KB";
    return (b/1024/1024).toFixed(1) + " MB";
  }
})();
