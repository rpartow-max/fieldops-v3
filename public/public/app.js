/* ================================================
   FieldOps - Customer Portal
   ================================================ */

let currentCompany = null;

const customerFiles = [];
const customerFileObjects = [];

// ================================================
// Company Login
// ================================================

async function companyLogin() {
  var name = document.getElementById("company-login-name").value.trim();
  var password = document.getElementById("company-login-password").value;
  var btn = document.getElementById("company-login-btn");
  var err = document.getElementById("company-login-error");

  if (!name || !password) { err.textContent = "Please enter your company name and password."; return; }

  btn.disabled = true;
  btn.textContent = "Logging in...";
  err.textContent = "";

  try {
    var res = await fetch("/api/company-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, password: password })
    });
    var data = await res.json();
    if (!res.ok) { err.textContent = data.error || "Login failed."; return; }

    currentCompany = data.company;
    document.querySelectorAll(".screen").forEach(function(s) { s.classList.remove("active"); });
    document.getElementById("customer-screen").classList.add("active");
    document.getElementById("customer-company-name").textContent = currentCompany.name;

    // Pre-fill company name in the form
    var woCompany = document.getElementById("wo-company");
    if (woCompany) woCompany.value = currentCompany.name;

    switchCustomerTab("my-orders");
  } catch(e) {
    err.textContent = "Login failed. Please try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Login →";
  }
}

function goBack() {
  currentCompany = null;
  document.querySelectorAll(".screen").forEach(function(s) { s.classList.remove("active"); });
  document.getElementById("company-login-screen").classList.add("active");
  document.getElementById("company-login-name").value = "";
  document.getElementById("company-login-password").value = "";
  document.getElementById("company-login-error").textContent = "";
}

function switchCustomerTab(tab) {
  document.querySelectorAll("#customer-screen .tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll("#customer-screen .tab-content").forEach((c) => c.classList.remove("active"));
  if (tab === "new-request") {
    document.querySelector('[onclick="switchCustomerTab(\'new-request\')"]').classList.add("active");
    document.getElementById("customer-new-request").classList.add("active");
  } else {
    document.querySelector('[onclick="switchCustomerTab(\'my-orders\')"]').classList.add("active");
    document.getElementById("customer-my-orders").classList.add("active");
    loadCustomerOrders();
  }
}

// ================================================
// File Upload Handling
// ================================================

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("dragover");
}

function handleDrop(e, context) {
  e.preventDefault();
  e.currentTarget.classList.remove("dragover");
  addFilesToContext(Array.from(e.dataTransfer.files), context);
}

function handleFileSelect(e, context) {
  addFilesToContext(Array.from(e.target.files), context);
  e.target.value = "";
}

function addFilesToContext(files, context) {
  const maxSize = 10 * 1024 * 1024;
  files.forEach((file) => {
    if (file.size > maxSize) { showToast(`${file.name} exceeds 10MB limit`, "error"); return; }
    customerFiles.push({ name: file.name, size: file.size, type: file.type, addedAt: new Date().toISOString() });
    customerFileObjects.push(file);
  });
  renderFileList();
}

function renderFileList() {
  const listEl = document.getElementById("customer-file-list");
  if (!listEl) return;
  if (customerFiles.length === 0) { listEl.innerHTML = ""; return; }
  listEl.innerHTML = customerFiles.map((f, i) => `
    <div class="file-item">
      <span class="file-icon">${getFileIcon(f.type)}</span>
      <div class="file-info">
        <span class="file-name">${escapeHtml(f.name)}</span>
        <span class="file-size">${formatFileSize(f.size)}</span>
      </div>
      <button class="file-remove" onclick="removeFile(${i})" title="Remove">✕</button>
    </div>
  `).join("");
}

function removeFile(index) {
  customerFiles.splice(index, 1);
  customerFileObjects.splice(index, 1);
  renderFileList();
}

function clearFiles() {
  customerFiles.length = 0;
  customerFileObjects.length = 0;
  renderFileList();
}

function getFileIcon(type) {
  if (!type) return "📄";
  if (type.startsWith("image/")) return "🖼️";
  if (type === "application/pdf") return "📕";
  if (type.includes("word")) return "📝";
  return "📄";
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ================================================
// Submit Work Order
// ================================================

async function submitWorkOrder(e) {
  e.preventDefault();
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "Submitting...";

  try {
    const data = {
      title: document.getElementById("wo-title").value.trim(),
      description: document.getElementById("wo-description").value.trim(),
      serviceType: document.getElementById("wo-service-type").value,
      priority: document.getElementById("wo-priority").value,
      company: document.getElementById("wo-company").value.trim(),
      customerName: document.getElementById("wo-customer-name").value.trim(),
      customerEmail: document.getElementById("wo-customer-email").value.trim(),
      customerPhone: document.getElementById("wo-customer-phone").value.trim(),
      siteAddress: document.getElementById("wo-address").value.trim(),
    };

    const res = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create work order");
    const newOrder = await res.json();

    // Upload any attached files
    if (customerFileObjects.length > 0 && newOrder._recordId) {
      btn.textContent = "Uploading files...";
      for (const file of customerFileObjects) {
        try { await uploadFile(newOrder._recordId, file); } catch(e) { console.warn("File upload failed:", e); }
      }
    }

    showToast("Work order submitted successfully!", "success");
    document.getElementById("work-order-form").reset();

    // Re-fill company name after reset
    var woCompany = document.getElementById("wo-company");
    if (woCompany && currentCompany) woCompany.value = currentCompany.name;

    clearFiles();
    switchCustomerTab("my-orders");
  } catch (err) {
    showToast("Failed to submit work order. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Request";
  }
}

async function uploadFile(recordId, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result.split(",")[1];
        const res = await fetch("/api/upload-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ _recordId: recordId, filename: file.name, mimeType: file.type, base64Data }),
        });
        if (!res.ok) throw new Error("Upload failed");
        resolve(await res.json());
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

// ================================================
// My Orders
// ================================================

async function loadCustomerOrders() {
  const container = document.getElementById("customer-orders-list");
  container.innerHTML = '<div class="loading">Loading your orders...</div>';
  try {
    const url = "/api/get-orders" + (currentCompany ? "?company=" + encodeURIComponent(currentCompany.name) : "");
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed");
    const orders = await res.json();

    if (orders.length === 0) {
      container.innerHTML = '<div class="empty-state">No work orders yet. Submit your first request!</div>';
      return;
    }

    const sorted = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    container.innerHTML = sorted.map((o) => `
      <div class="customer-order-card">
        <div class="order-card-top">
          <span class="order-id">${escapeHtml(o.id)}</span>
          <span class="badge badge-${o.status}">${formatStatus(o.status)}</span>
        </div>
        <h4>${escapeHtml(o.title)}</h4>
        <div class="order-card-meta">
          <span class="badge badge-priority-${o.priority}">${escapeHtml(o.priority)}</span>
          <span>${escapeHtml(o.serviceType)}</span>
          <span>${formatDate(o.createdAt)}</span>
          ${o.siteAddress ? `<span>📍 ${escapeHtml(o.siteAddress)}</span>` : ""}
          ${o.assignedTech ? `<span>🔧 ${escapeHtml(o.assignedTech)}</span>` : ""}
        </div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.4rem;">${escapeHtml(o.description)}</p>
        ${o.progress > 0 ? `<div class="progress-bar-container"><div class="progress-bar" style="width:${o.progress}%"></div><span class="progress-label">${o.progress}%</span></div>` : ""}
        ${o.attachments && o.attachments.length > 0 ? `<div class="attachment-count">📎 ${o.attachments.length} attachment${o.attachments.length > 1 ? "s" : ""}</div>` : ""}
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = '<div class="empty-state">Failed to load orders. Please try again.</div>';
  }
}

// ================================================
// Utilities
// ================================================

function formatStatus(status) {
  const map = { new: "New", dispatched: "Dispatched", in_progress: "In Progress", completed: "Completed", signed_off: "Signed Off" };
  return map[status] || status;
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return dateStr; }
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-msg">${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ================================================
// Window exports
// ================================================

window.companyLogin = companyLogin;
window.goBack = goBack;
window.switchCustomerTab = switchCustomerTab;
window.submitWorkOrder = submitWorkOrder;
window.loadCustomerOrders = loadCustomerOrders;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleFileSelect = handleFileSelect;
window.removeFile = removeFile;
window.clearFiles = clearFiles;
