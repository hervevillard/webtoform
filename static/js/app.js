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
  // VISUAL FILLABLE TAB
  // ════════════════════════════════════════════════════════
  const visualDropZone      = document.getElementById("visual-drop-zone");
  const visualFileInput     = document.getElementById("visual-file-input");
  const visualFileName      = document.getElementById("visual-file-name");
  const visualPrevPageBtn   = document.getElementById("visual-prev-page");
  const visualNextPageBtn   = document.getElementById("visual-next-page");
  const visualPageLabel     = document.getElementById("visual-page-label");
  const visualFieldLabel    = document.getElementById("visual-field-label");
  const visualFieldType     = document.getElementById("visual-field-type");
  const visualFieldRequired = document.getElementById("visual-field-required");
  const visualCanvas        = document.getElementById("visual-pdf-canvas");
  const visualOverlay       = document.getElementById("visual-overlay");
  const visualFieldList     = document.getElementById("visual-field-list");
  const visualFieldCount    = document.getElementById("visual-field-count");
  const visualClearPageBtn  = document.getElementById("visual-clear-page");
  const visualClearAllBtn   = document.getElementById("visual-clear-all");
  const visualCreateSignBtn = document.getElementById("visual-create-sign-btn");
  const visualGenerateBtn   = document.getElementById("visual-generate-btn");
  const visualStatusArea    = document.getElementById("visual-status-area");

  let visualSelectedFile = null;
  let visualPdfDoc = null;
  let visualPageNumber = 1;
  let visualScale = 1.25;
  let visualPageWidthPts = 0;
  let visualPageHeightPts = 0;
  let visualFields = [];
  let visualFieldSeq = 0;
  let visualSelectedFieldId = null;
  let drawState = null;
  let editState = null;
  const pdfjs = window.pdfjsLib || globalThis.pdfjsLib || null;

  if (pdfjs) {
    pdfjs.GlobalWorkerOptions.workerSrc =
      "/static/vendor/pdfjs/pdf.worker.min.js";
  }

  function updateVisualNavState() {
    const pages = visualPdfDoc ? visualPdfDoc.numPages : 0;
    visualPageLabel.textContent = `Page ${pages ? visualPageNumber : 0} / ${pages}`;
    visualPrevPageBtn.disabled = !visualPdfDoc || visualPageNumber <= 1;
    visualNextPageBtn.disabled = !visualPdfDoc || visualPageNumber >= pages;
    visualCreateSignBtn.disabled = !visualSelectedFile || visualFields.length === 0;
    visualGenerateBtn.disabled = !visualSelectedFile || visualFields.length === 0;
  }

  function updateVisualFieldState() {
    visualFieldCount.textContent = `${visualFields.length} field${visualFields.length !== 1 ? "s" : ""}`;
    visualCreateSignBtn.disabled = !visualSelectedFile || visualFields.length === 0;
    visualGenerateBtn.disabled = !visualSelectedFile || visualFields.length === 0;

    visualFieldList.innerHTML = "";
    if (visualFields.length === 0) {
      const li = document.createElement("li");
      li.className = "visual-empty";
      li.textContent = "No fields yet. Draw on the PDF preview to place fields.";
      visualFieldList.appendChild(li);
      return;
    }

    visualFields.forEach(f => {
      const li = document.createElement("li");
      li.className = "visual-field-row";
      const labelText = f.label ? escHtml(f.label) : "(no label)";
      const sourceText = f.source === "existing" ? " · existing" : " · new";
      li.innerHTML = `
        <span class="visual-field-meta">P${f.page} · ${labelText} · ${f.type}${f.required ? " · required" : ""}${sourceText}</span>
        <button type="button" class="btn-danger-ghost" title="Remove">&#10005;</button>`;
      li.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        visualSelectedFieldId = f.id;
        syncVisualFieldInputsFromSelection();
        renderVisualOverlay();
      });
      li.querySelector("button").addEventListener("click", () => {
        visualFields = visualFields.filter(x => x.id !== f.id);
        if (visualSelectedFieldId === f.id) {
          visualSelectedFieldId = null;
        }
        syncVisualFieldInputsFromSelection();
        updateVisualFieldState();
        renderVisualOverlay();
      });
      visualFieldList.appendChild(li);
    });
  }

  function getSelectedVisualField() {
    if (!visualSelectedFieldId) return null;
    return visualFields.find(f => f.id === visualSelectedFieldId) || null;
  }

  function syncVisualFieldInputsFromSelection() {
    const selected = getSelectedVisualField();
    if (!selected) {
      if (visualFieldLabel) visualFieldLabel.value = "";
      if (visualFieldType) visualFieldType.value = "text";
      if (visualFieldRequired) visualFieldRequired.checked = false;
      return;
    }

    if (visualFieldLabel) visualFieldLabel.value = selected.label || "";
    if (visualFieldType) visualFieldType.value = selected.type === "signature" ? "signature" : "text";
    if (visualFieldRequired) visualFieldRequired.checked = !!selected.required;
  }

  async function inspectVisualExistingFields(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/inspect-layout", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Could not inspect existing fields.");
    }

    return Array.isArray(data.fields) ? data.fields : [];
  }

  async function loadVisualExistingFields(file) {
    const existing = await inspectVisualExistingFields(file);
    visualFields = existing.map((f) => ({
      id: ++visualFieldSeq,
      page: Number(f.page) || 1,
      x: Number(f.x) || 0,
      y: Number(f.y) || 0,
      width: Number(f.width) || 0,
      height: Number(f.height) || 0,
      label: String(f.label || ""),
      type: f.type === "signature" ? "signature" : "text",
      required: !!f.required,
      source: "existing",
    }));
    visualSelectedFieldId = null;
    syncVisualFieldInputsFromSelection();
    updateVisualFieldState();
    renderVisualOverlay();
    return existing.length;
  }

  function resetVisualEditor() {
    visualPdfDoc = null;
    visualPageNumber = 1;
    visualPageWidthPts = 0;
    visualPageHeightPts = 0;
    visualFields = [];
    visualFieldSeq = 0;
    visualSelectedFieldId = null;
    drawState = null;
    editState = null;
    const ctx = visualCanvas.getContext("2d");
    ctx.clearRect(0, 0, visualCanvas.width, visualCanvas.height);
    visualOverlay.innerHTML = "";
    visualOverlay.style.width = "0px";
    visualOverlay.style.height = "0px";
    updateVisualFieldState();
    updateVisualNavState();
    syncVisualFieldInputsFromSelection();
  }

  async function loadVisualPdf(file) {
    if (!pdfjs) {
      showStatus(visualStatusArea, "PDF renderer failed to load. Reload the page and retry.", "error");
      return;
    }

    const bytes = await file.arrayBuffer();
    const options = { data: bytes, stopAtErrors: true };

    try {
      visualPdfDoc = await pdfjs.getDocument(options).promise;
    } catch (_) {
      // Fallback for environments where worker loading is blocked.
      visualPdfDoc = await pdfjs.getDocument({ ...options, disableWorker: true }).promise;
    }

    visualPageNumber = 1;
    await renderVisualPage();
    updateVisualNavState();
  }

  async function renderVisualPage() {
    if (!visualPdfDoc) return;
    const page = await visualPdfDoc.getPage(visualPageNumber);
    const viewport = page.getViewport({ scale: visualScale });
    const viewportOne = page.getViewport({ scale: 1 });
    visualPageWidthPts = viewportOne.width;
    visualPageHeightPts = viewportOne.height;

    visualCanvas.width = Math.floor(viewport.width);
    visualCanvas.height = Math.floor(viewport.height);

    const ctx = visualCanvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    visualOverlay.style.width = `${visualCanvas.clientWidth}px`;
    visualOverlay.style.height = `${visualCanvas.clientHeight}px`;
    renderVisualOverlay();
    updateVisualNavState();
  }

  function renderVisualOverlay() {
    visualOverlay.innerHTML = "";
    if (!visualPdfDoc || visualPageWidthPts <= 0 || visualPageHeightPts <= 0) return;

    const overlayWidthPx = visualOverlay.clientWidth || visualCanvas.clientWidth;
    const overlayHeightPx = visualOverlay.clientHeight || visualCanvas.clientHeight;
    if (!overlayWidthPx || !overlayHeightPx) return;

    if (visualSelectedFieldId && !visualFields.some(f => f.id === visualSelectedFieldId)) {
      visualSelectedFieldId = null;
    }

    const pageFields = visualFields.filter(f => f.page === visualPageNumber);
    pageFields.forEach(field => {
      const box = document.createElement("div");
      box.className = `visual-box ${field.type === "signature" ? "signature" : "text"}`;
      box.dataset.fieldId = String(field.id);
      if (field.id === visualSelectedFieldId) {
        box.classList.add("selected");
      }

      const left = (field.x / visualPageWidthPts) * overlayWidthPx;
      const top = ((visualPageHeightPts - (field.y + field.height)) / visualPageHeightPts) * overlayHeightPx;
      const width = (field.width / visualPageWidthPts) * overlayWidthPx;
      const height = (field.height / visualPageHeightPts) * overlayHeightPx;

      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
      box.innerHTML = `
        <span class="visual-box-label">${escHtml(field.label)}</span>
        <button type="button" class="visual-box-delete" title="Delete field">&#10005;</button>
        <span class="visual-box-resize" title="Resize"></span>`;

      box.addEventListener("click", (event) => {
        event.stopPropagation();
        visualSelectedFieldId = field.id;
        syncVisualFieldInputsFromSelection();
        renderVisualOverlay();
      });

      box.querySelector(".visual-box-delete").addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        visualFields = visualFields.filter(f => f.id !== field.id);
        if (visualSelectedFieldId === field.id) {
          visualSelectedFieldId = null;
        }
        syncVisualFieldInputsFromSelection();
        updateVisualFieldState();
        renderVisualOverlay();
      });

      box.addEventListener("dblclick", () => {
        visualFields = visualFields.filter(f => f.id !== field.id);
        if (visualSelectedFieldId === field.id) {
          visualSelectedFieldId = null;
        }
        syncVisualFieldInputsFromSelection();
        updateVisualFieldState();
        renderVisualOverlay();
      });

      visualOverlay.appendChild(box);
    });
  }

  function setVisualFile(file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showStatus(visualStatusArea, "Please select a PDF file.", "error");
      return;
    }

    visualSelectedFile = file;
    visualFileName.innerHTML = `&#128196; <strong>${escHtml(file.name)}</strong> &nbsp;(${formatBytes(file.size)})`;
    showSpinner(visualStatusArea, "Loading PDF preview…");

    resetVisualEditor();
    loadVisualPdf(file)
      .then(async () => {
        const existingCount = await loadVisualExistingFields(file);
        if (existingCount > 0) {
          showStatus(visualStatusArea, `&#10003; PDF loaded. Found ${existingCount} existing fillable field${existingCount !== 1 ? "s" : ""}. Click a field to edit label/type/required, move, resize, or delete.`, "success");
        } else {
          showStatus(visualStatusArea, "&#10003; PDF loaded. No existing fillable fields found. Drag on the preview to place fields.", "success");
        }
      })
      .catch((err) => {
        const msg = err && err.message ? `Could not open this PDF in the visual editor: ${err.message}` : "Could not open this PDF in the visual editor.";
        showStatus(visualStatusArea, msg, "error");
      });
  }

  visualDropZone.addEventListener("click", (event) => {
    if (event.target === visualFileInput) return;
    visualFileInput.value = "";
    visualFileInput.click();
  });
  visualDropZone.addEventListener("dragover", (e) => { e.preventDefault(); visualDropZone.classList.add("dragover"); });
  ["dragleave", "dragend"].forEach(ev => visualDropZone.addEventListener(ev, () => visualDropZone.classList.remove("dragover")));
  visualDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    visualDropZone.classList.remove("dragover");
    if (e.dataTransfer.files[0]) setVisualFile(e.dataTransfer.files[0]);
  });
  visualFileInput.addEventListener("change", () => {
    if (visualFileInput.files[0]) setVisualFile(visualFileInput.files[0]);
  });

  visualPrevPageBtn.addEventListener("click", async () => {
    if (!visualPdfDoc || visualPageNumber <= 1) return;
    visualPageNumber -= 1;
    await renderVisualPage();
  });

  visualNextPageBtn.addEventListener("click", async () => {
    if (!visualPdfDoc || visualPageNumber >= visualPdfDoc.numPages) return;
    visualPageNumber += 1;
    await renderVisualPage();
  });

  visualClearPageBtn.addEventListener("click", () => {
    visualFields = visualFields.filter(f => f.page !== visualPageNumber);
    if (visualSelectedFieldId && !visualFields.some(f => f.id === visualSelectedFieldId)) {
      visualSelectedFieldId = null;
    }
    updateVisualFieldState();
    renderVisualOverlay();
  });

  visualClearAllBtn.addEventListener("click", () => {
    visualFields = [];
    visualSelectedFieldId = null;
    updateVisualFieldState();
    renderVisualOverlay();
  });

  function getOverlayPoint(event) {
    const rect = visualOverlay.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    return {
      x,
      y,
    };
  }

  function findVisualField(id) {
    return visualFields.find(f => f.id === id) || null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pxRectFromField(field) {
    const overlayWidthPx = visualOverlay.clientWidth;
    const overlayHeightPx = visualOverlay.clientHeight;
    return {
      left: (field.x / visualPageWidthPts) * overlayWidthPx,
      top: ((visualPageHeightPts - (field.y + field.height)) / visualPageHeightPts) * overlayHeightPx,
      width: (field.width / visualPageWidthPts) * overlayWidthPx,
      height: (field.height / visualPageHeightPts) * overlayHeightPx,
    };
  }

  function updateFieldFromPxRect(field, rect) {
    const overlayWidthPx = visualOverlay.clientWidth;
    const overlayHeightPx = visualOverlay.clientHeight;
    if (!overlayWidthPx || !overlayHeightPx) return;

    field.x = Number(((rect.left / overlayWidthPx) * visualPageWidthPts).toFixed(2));
    field.y = Number((visualPageHeightPts - (((rect.top + rect.height) / overlayHeightPx) * visualPageHeightPts)).toFixed(2));
    field.width = Number(((rect.width / overlayWidthPx) * visualPageWidthPts).toFixed(2));
    field.height = Number(((rect.height / overlayHeightPx) * visualPageHeightPts).toFixed(2));
  }

  function beginEdit(event, mode) {
    const box = event.target.closest(".visual-box");
    if (!box || !visualPdfDoc) return;

    const fieldId = Number(box.dataset.fieldId);
    const field = findVisualField(fieldId);
    if (!field) return;

    event.preventDefault();
    event.stopPropagation();

    visualSelectedFieldId = fieldId;
    const start = getOverlayPoint(event);
    const startRect = pxRectFromField(field);

    editState = {
      mode,
      fieldId,
      box,
      start,
      startRect,
    };

    box.classList.add("selected");
  }

  visualOverlay.addEventListener("mousedown", (event) => {
    if (!visualPdfDoc) return;

    const deleteBtn = event.target.closest(".visual-box-delete");
    if (deleteBtn) return;

    const resizeHandle = event.target.closest(".visual-box-resize");
    if (resizeHandle) {
      beginEdit(event, "resize");
      return;
    }

    const targetBox = event.target.closest(".visual-box");
    if (targetBox) {
      beginEdit(event, "move");
      return;
    }

    visualSelectedFieldId = null;
    syncVisualFieldInputsFromSelection();
    renderVisualOverlay();

    const start = getOverlayPoint(event);
    const ghost = document.createElement("div");
    ghost.className = "visual-box visual-box-drawing";
    ghost.style.left = `${start.x}px`;
    ghost.style.top = `${start.y}px`;
    ghost.style.width = "1px";
    ghost.style.height = "1px";
    visualOverlay.appendChild(ghost);

    drawState = { start, ghost };
  });

  visualOverlay.addEventListener("mousemove", (event) => {
    if (editState) {
      const now = getOverlayPoint(event);
      const overlayWidthPx = visualOverlay.clientWidth;
      const overlayHeightPx = visualOverlay.clientHeight;
      const minSizePx = 12;
      const nextRect = { ...editState.startRect };

      if (editState.mode === "move") {
        const dx = now.x - editState.start.x;
        const dy = now.y - editState.start.y;
        nextRect.left = clamp(editState.startRect.left + dx, 0, overlayWidthPx - editState.startRect.width);
        nextRect.top = clamp(editState.startRect.top + dy, 0, overlayHeightPx - editState.startRect.height);
      } else if (editState.mode === "resize") {
        const dx = now.x - editState.start.x;
        const dy = now.y - editState.start.y;
        nextRect.width = clamp(editState.startRect.width + dx, minSizePx, overlayWidthPx - editState.startRect.left);
        nextRect.height = clamp(editState.startRect.height + dy, minSizePx, overlayHeightPx - editState.startRect.top);
      }

      editState.box.style.left = `${nextRect.left}px`;
      editState.box.style.top = `${nextRect.top}px`;
      editState.box.style.width = `${nextRect.width}px`;
      editState.box.style.height = `${nextRect.height}px`;
      editState.currentRect = nextRect;
      return;
    }

    if (!drawState) return;
    const now = getOverlayPoint(event);
    const x = Math.min(drawState.start.x, now.x);
    const y = Math.min(drawState.start.y, now.y);
    const w = Math.abs(now.x - drawState.start.x);
    const h = Math.abs(now.y - drawState.start.y);

    drawState.ghost.style.left = `${x}px`;
    drawState.ghost.style.top = `${y}px`;
    drawState.ghost.style.width = `${w}px`;
    drawState.ghost.style.height = `${h}px`;
  });

  function finishDrawing(event) {
    if (!drawState || !visualPdfDoc) return;

    const end = getOverlayPoint(event);
    const leftPx = Math.min(drawState.start.x, end.x);
    const topPx = Math.min(drawState.start.y, end.y);
    let widthPx = Math.abs(end.x - drawState.start.x);
    let heightPx = Math.abs(end.y - drawState.start.y);

    drawState.ghost.remove();
    drawState = null;

    const selectedType = visualFieldType ? visualFieldType.value : "text";
    const type = selectedType === "signature" ? "signature" : "text";

    if (widthPx < 8 || heightPx < 8) return;

    const overlayWidthPx = visualOverlay.clientWidth;
    const overlayHeightPx = visualOverlay.clientHeight;
    if (!overlayWidthPx || !overlayHeightPx || !visualPageWidthPts || !visualPageHeightPts) return;

    const xPts = (leftPx / overlayWidthPx) * visualPageWidthPts;
    const yPts = visualPageHeightPts - (((topPx + heightPx) / overlayHeightPx) * visualPageHeightPts);
    const wPts = (widthPx / overlayWidthPx) * visualPageWidthPts;
    const hPts = (heightPx / overlayHeightPx) * visualPageHeightPts;

    const fieldLabel = visualFieldLabel.value.trim();

    visualFields.push({
      id: ++visualFieldSeq,
      page: visualPageNumber,
      x: Number(xPts.toFixed(2)),
      y: Number(yPts.toFixed(2)),
      width: Number(wPts.toFixed(2)),
      height: Number(hPts.toFixed(2)),
      label: fieldLabel,
      type,
      required: visualFieldRequired.checked,
      source: "new",
    });

    visualSelectedFieldId = visualFieldSeq;
    syncVisualFieldInputsFromSelection();
    updateVisualFieldState();
    renderVisualOverlay();
  }

  function finishEditing() {
    if (!editState) return;

    const field = findVisualField(editState.fieldId);
    if (field && editState.currentRect) {
      updateFieldFromPxRect(field, editState.currentRect);
    }

    editState = null;
    renderVisualOverlay();
  }

  visualOverlay.addEventListener("mouseup", (event) => {
    if (editState) {
      finishEditing();
      return;
    }
    finishDrawing(event);
  });
  visualOverlay.addEventListener("mouseleave", (event) => {
    if (editState) {
      finishEditing();
      return;
    }
    if (drawState) finishDrawing(event);
  });

  document.addEventListener("keydown", (event) => {
    if ((event.key === "Delete" || event.key === "Backspace") && visualSelectedFieldId && visualPdfDoc) {
      const active = document.activeElement;
      const typingInInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (typingInInput) return;
      visualFields = visualFields.filter(f => f.id !== visualSelectedFieldId);
      visualSelectedFieldId = null;
      syncVisualFieldInputsFromSelection();
      updateVisualFieldState();
      renderVisualOverlay();
    }
  });

  visualFieldLabel.addEventListener("input", () => {
    const selected = getSelectedVisualField();
    if (!selected) return;
    selected.label = visualFieldLabel.value;
    updateVisualFieldState();
    renderVisualOverlay();
  });

  visualFieldType.addEventListener("change", () => {
    const selected = getSelectedVisualField();
    if (!selected) return;
    selected.type = visualFieldType.value === "signature" ? "signature" : "text";
    updateVisualFieldState();
    renderVisualOverlay();
  });

  visualFieldRequired.addEventListener("change", () => {
    const selected = getSelectedVisualField();
    if (!selected) return;
    selected.required = !!visualFieldRequired.checked;
    updateVisualFieldState();
    renderVisualOverlay();
  });

  window.addEventListener("resize", () => {
    if (!visualPdfDoc) return;
    visualOverlay.style.width = `${visualCanvas.clientWidth}px`;
    visualOverlay.style.height = `${visualCanvas.clientHeight}px`;
    renderVisualOverlay();
  });

  visualGenerateBtn.addEventListener("click", async () => {
    if (!visualSelectedFile) {
      showStatus(visualStatusArea, "Please upload a PDF first.", "error");
      return;
    }
    if (visualFields.length === 0) {
      showStatus(visualStatusArea, "Draw at least one field area before generating.", "error");
      return;
    }

    visualGenerateBtn.disabled = true;
    showSpinner(visualStatusArea, "Creating fillable PDF from your visual layout…");

    const formData = new FormData();
    formData.append("file", visualSelectedFile);
    formData.append("fields", JSON.stringify(visualFields.map(({ id, ...f }) => f)));

    try {
      const res = await fetch("/build-from-layout", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        showStatus(visualStatusArea, data.error || "Conversion failed.", "error");
        visualGenerateBtn.disabled = false;
        return;
      }
      const hasSignature = visualFields.some(f => f.type === "signature");
      const successMsg = hasSignature
        ? `&#10003; Done — ${data.field_count} fields added. Downloading… Signature fields are native PDF widgets; use Adobe Acrobat Reader for best signing compatibility.`
        : `&#10003; Done — ${data.field_count} fields added. Downloading…`;
      showStatus(visualStatusArea, successMsg, "success");
      window.location.href = data.download_url;
    } catch (_) {
      showStatus(visualStatusArea, "Network error — is the server running?", "error");
    }

    visualGenerateBtn.disabled = false;
  });

  visualCreateSignBtn.addEventListener("click", async () => {
    if (!visualSelectedFile) {
      showStatus(visualStatusArea, "Please upload a PDF first.", "error");
      return;
    }
    if (visualFields.length === 0) {
      showStatus(visualStatusArea, "Draw at least one field area first.", "error");
      return;
    }

    visualCreateSignBtn.disabled = true;
    showSpinner(visualStatusArea, "Creating web signing link…");

    const formData = new FormData();
    formData.append("file", visualSelectedFile);
    formData.append("fields", JSON.stringify(visualFields.map(({ id, ...f }) => f)));
    formData.append("title", visualSelectedFile.name.replace(/\.pdf$/i, "") || "Sign Document");

    try {
      const res = await fetch("/create-sign-session", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        showStatus(visualStatusArea, data.error || "Could not create signing link.", "error");
        visualCreateSignBtn.disabled = false;
        return;
      }

      const signUrl = data.sign_url;
      const absoluteUrl = new URL(signUrl, window.location.origin).toString();
      showStatus(
        visualStatusArea,
        `&#10003; Signing link ready: <a href="${escHtml(absoluteUrl)}" target="_blank" rel="noopener">${escHtml(absoluteUrl)}</a>`,
        "success"
      );
      window.open(signUrl, "_blank", "noopener");
    } catch (_) {
      showStatus(visualStatusArea, "Network error — is the server running?", "error");
    }

    visualCreateSignBtn.disabled = false;
  });

  updateVisualFieldState();
  updateVisualNavState();
  syncVisualFieldInputsFromSelection();

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
  dropZone.addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });
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

  const FIELD_TYPES = ["text","textarea","date","email","phone","checkbox","list","signature"];
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
          const display = formatResponseValue(v);
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

  function formatResponseValue(value) {
    if (Array.isArray(value)) {
      const joined = value.filter(Boolean).join(", ");
      return joined || "—";
    }

    const text = String(value || "").trim();
    if (!text) return "—";
    if (text.startsWith("data:image/")) return "[signature captured]";
    return text;
  }
})();
