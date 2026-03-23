/* ================================================
   FieldOps - Work Order System Application v2.0
   ================================================ */

const TECHNICIANS = ["Marcus Rivera", "Dana Okafor", "Sam Trellis", "Priya Nair"];

let currentRole = null;
let currentFilter = "all";
let currentTechFilter = "all";
let selectedOrderId = null;
let selectedTechOrderId = null;
let allOrders = [];
let allTechOrders = [];
let currentTech = "";
let currentCompany = null; // { id, name, email, phone } for logged-in customer

// Per-portal file stores (since no real backend, store as base64 metadata)
const customerFiles = [];
const customerFileObjects = []; // actual File objects for upload
const techFiles = {};

// Enhanced tech media stores
const techPhotos = {};    // orderId -> [{name, dataUrl, size}]
const techDocs   = {};    // orderId -> [{name, size, type, dataUrl}]
const techSignatures = {}; // orderId -> dataUrl string

// ================================================
// Navigation
// ================================================

function selectRole(role) {
  currentRole = role;
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));

  if (role === "customer") {
    // Show login screen first
    document.getElementById("company-login-screen").classList.add("active");
  } else if (role === "dispatcher") {
    document.getElementById("dispatcher-screen").classList.add("active");
    loadDispatcherOrders();
  } else if (role === "technician") {
    document.getElementById("technician-screen").classList.add("active");
    populateTechIdentitySelect();
  }
}

function goBack() {
  currentRole = null;
  currentCompany = null;
  selectedOrderId = null;
  selectedTechOrderId = null;
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById("role-screen").classList.add("active");
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
    switchCustomerTab("my-orders");
  } catch(e) {
    err.textContent = "Login failed. Please try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Login";
  }
}

// ================================================
// Company Management (Dispatcher)
// ================================================

var allCompanies = [];

async function loadCompanies() {
  try {
    var res = await fetch("/api/companies");
    allCompanies = await res.json();
    renderCompanyList();
  } catch(e) {
    showToast("Failed to load companies.", "error");
  }
}

function renderCompanyList() {
  var container = document.getElementById("companies-list");
  if (!container) return;
  if (allCompanies.length === 0) {
    container.innerHTML = '<div class="empty-state">No companies yet. Add one below.</div>';
    return;
  }
  container.innerHTML = allCompanies.map(function(c) {
    return '<div class="company-item">' +
      '<div class="company-item-info">' +
        '<span class="company-item-name">' + escapeHtml(c.name) + '</span>' +
        (c.email ? '<span class="company-item-meta">' + escapeHtml(c.email) + '</span>' : '') +
      '</div>' +
      '<div class="company-item-actions">' +
        '<button class="btn btn-small btn-warning-small" onclick="editCompanyPassword(' + c.id + ', \'' + escapeHtml(c.name) + '\')">Reset Password</button>' +
        '<button class="btn btn-small btn-danger-small" onclick="deleteCompany(' + c.id + ', \'' + escapeHtml(c.name) + '\')">Remove</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

async function addCompany() {
  var name = document.getElementById("new-company-name").value.trim();
  var password = document.getElementById("new-company-password").value;
  var email = document.getElementById("new-company-email").value.trim();

  if (!name || !password) { showToast("Company name and password are required.", "error"); return; }

  try {
    var res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, password: password, email: email })
    });
    if (!res.ok) { var d = await res.json(); showToast(d.error || "Failed to add company.", "error"); return; }
    showToast("Company added successfully!", "success");
    document.getElementById("new-company-name").value = "";
    document.getElementById("new-company-password").value = "";
    document.getElementById("new-company-email").value = "";
    await loadCompanies();
  } catch(e) {
    showToast("Failed to add company.", "error");
  }
}

async function editCompanyPassword(id, name) {
  var newPass = prompt("Enter new password for " + name + ":");
  if (!newPass) return;
  try {
    var res = await fetch("/api/companies/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPass })
    });
    if (!res.ok) throw new Error("Failed");
    showToast("Password updated for " + name, "success");
  } catch(e) {
    showToast("Failed to update password.", "error");
  }
}

async function deleteCompany(id, name) {
  if (!confirm("Remove company '" + name + "'? They will no longer be able to log in.")) return;
  try {
    await fetch("/api/companies/" + id, { method: "DELETE" });
    showToast("Company removed.", "success");
    await loadCompanies();
  } catch(e) {
    showToast("Failed to remove company.", "error");
  }
}

function switchDispatcherTab(tab) {
  document.querySelectorAll(".dispatcher-tab-btn").forEach(function(b) { b.classList.remove("active"); });
  document.querySelector('[data-dispatchtab="' + tab + '"]').classList.add("active");
  document.querySelectorAll(".dispatcher-tab-content").forEach(function(c) {
    c.style.display = "none";
    c.classList.remove("active");
  });
  var el = document.getElementById("dispatcher-tab-" + tab);
  el.style.display = tab === "companies" ? "block" : "flex";
  el.classList.add("active");
  // Show/hide order filters
  var orderFilters = document.getElementById("order-filters");
  if (orderFilters) orderFilters.style.display = tab === "orders" ? "" : "none";
  if (tab === "companies") loadCompanies();
  if (tab === "orders") loadDispatcherOrders();
}

// ================================================

async function apiGet(companyFilter) {
  var url = "/api/get-orders";
  if (companyFilter) url += "?company=" + encodeURIComponent(companyFilter);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load work orders");
  return res.json();
}

async function apiPost(data) {
  const res = await fetch("/api/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create work order");
  return res.json();
}

async function apiPut(data) {
  // Find the _recordId from the in-memory order list so we can patch Airtable
  const order = [...allOrders, ...allTechOrders].find(o => o.id === data.id);
  if (!order || !order._recordId) throw new Error("Order record ID not found");
  const res = await fetch("/api/update-order", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, _recordId: order._recordId }),
  });
  if (!res.ok) throw new Error("Failed to update work order");
  return res.json();
}

async function apiUploadFile(recordId, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result.split(",")[1];
        const res = await fetch("/api/upload-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            _recordId: recordId,
            filename: file.name,
            mimeType: file.type,
            base64Data,
          }),
        });
        if (!res.ok) throw new Error("Upload failed");
        resolve(await res.json());
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
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
  const files = Array.from(e.dataTransfer.files);
  addFilesToContext(files, context);
}

function handleFileSelect(e, context) {
  const files = Array.from(e.target.files);
  addFilesToContext(files, context);
  e.target.value = "";
}

function addFilesToContext(files, context) {
  const store = context === "customer" ? customerFiles : (techFiles[selectedTechOrderId] = techFiles[selectedTechOrderId] || []);
  const maxSize = 10 * 1024 * 1024;
  files.forEach((file) => {
    if (file.size > maxSize) {
      showToast(`${file.name} exceeds 10MB limit`, "error");
      return;
    }
    store.push({ name: file.name, size: file.size, type: file.type, addedAt: new Date().toISOString() });
    if (context === "customer") customerFileObjects.push(file);
  });
  renderFileList(context);
}

function renderFileList(context) {
  const store = context === "customer" ? customerFiles : (techFiles[selectedTechOrderId] || []);
  const listEl = document.getElementById(context === "customer" ? "customer-file-list" : "tech-file-list");
  if (!listEl) return;
  if (store.length === 0) { listEl.innerHTML = ""; return; }

  listEl.innerHTML = store.map((f, i) => `
    <div class="file-item">
      <span class="file-icon">${getFileIcon(f.type)}</span>
      <div class="file-info">
        <span class="file-name">${escapeHtml(f.name)}</span>
        <span class="file-size">${formatFileSize(f.size)}</span>
      </div>
      <button class="file-remove" onclick="removeFile('${context}', ${i})" title="Remove">✕</button>
    </div>
  `).join("");
}

function removeFile(context, index) {
  if (context === "customer") {
    customerFiles.splice(index, 1);
  } else {
    (techFiles[selectedTechOrderId] || []).splice(index, 1);
  }
  renderFileList(context);
}

function clearFiles(context) {
  if (context === "customer") { customerFiles.length = 0; customerFileObjects.length = 0; }
  renderFileList(context);
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
// Customer: Submit Work Order
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
      preferredDate: document.getElementById("wo-preferred-date").value,
      siteAddress: document.getElementById("wo-address").value.trim(),
    };
    const newOrder = await apiPost(data);

    // Upload any attached files
    if (customerFileObjects && customerFileObjects.length > 0 && newOrder._recordId) {
      btn.textContent = "Uploading files...";
      for (const file of customerFileObjects) {
        try { await apiUploadFile(newOrder._recordId, file); } catch(e) { console.warn("File upload failed:", e); }
      }
    }

    showToast("Work order request submitted successfully!", "success");
    document.getElementById("work-order-form").reset();
    clearFiles("customer");
    switchCustomerTab("my-orders");
  } catch (err) {
    showToast("Failed to submit work order. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Request";
  }
}

// ================================================
// Customer: My Orders
// ================================================

async function loadCustomerOrders() {
  const container = document.getElementById("customer-orders-list");
  container.innerHTML = '<div class="loading">Loading your orders...</div>';
  try {
    const orders = await apiGet(currentCompany ? currentCompany.name : null);
    if (orders.length === 0) {
      container.innerHTML = '<div class="empty-state">No work orders yet. Submit your first request!</div>';
      return;
    }
    // Sort by company name, then by createdAt descending within each company
    const sorted = [...orders].sort((a, b) => {
      const ca = (a.company || a.customerName || "").toLowerCase();
      const cb = (b.company || b.customerName || "").toLowerCase();
      if (ca < cb) return -1;
      if (ca > cb) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Group by company
    const grouped = {};
    sorted.forEach(o => {
      const key = o.company || o.customerName || "Unknown Company";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(o);
    });

    container.innerHTML = Object.entries(grouped).map(([company, compOrders]) => `
      <div class="company-group">
        <div class="company-group-header">
          <span class="company-group-name">🏢 ${escapeHtml(company)}</span>
          <span class="company-group-count">${compOrders.length} order${compOrders.length !== 1 ? "s" : ""}</span>
        </div>
        ${compOrders.map((o) => `
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
        `).join("")}
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = '<div class="empty-state">Failed to load orders. Please try again.</div>';
  }
}

// ================================================
// Dispatcher: Orders List
// ================================================

async function loadDispatcherOrders() {
  const container = document.getElementById("dispatcher-orders-list");
  container.innerHTML = '<div class="loading">Loading work orders...</div>';
  try {
    allOrders = await apiGet();
    renderDispatcherList();
  } catch (err) {
    container.innerHTML = '<div class="empty-state">Failed to load work orders.</div>';
  }
}

function filterOrders(filter) {
  currentFilter = filter;
  document.querySelectorAll(".filter-btn[data-filter]").forEach((b) => b.classList.remove("active"));
  document.querySelector(`.filter-btn[data-filter="${filter}"]`).classList.add("active");
  renderDispatcherList();
}

function renderDispatcherList() {
  const container = document.getElementById("dispatcher-orders-list");
  const filtered = currentFilter === "all" ? allOrders : allOrders.filter((o) => o.status === currentFilter);
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">No ${currentFilter === "all" ? "" : currentFilter + " "}work orders found.</div>`;
    return;
  }
  container.innerHTML = filtered.map((o) => `
    <div class="order-card ${selectedOrderId === o.id ? "selected" : ""}" onclick="selectOrder('${o.id}')">
      <div class="order-card-top">
        <span class="order-id">${escapeHtml(o.id)}</span>
        <span class="badge badge-${o.status}">${formatStatus(o.status)}</span>
      </div>
      <h4>${escapeHtml(o.title)}</h4>
      <div class="order-card-meta">
        <span class="badge badge-priority-${o.priority}">${escapeHtml(o.priority)}</span>
        <span>${escapeHtml(o.serviceType)}</span>
        <span>🏢 ${escapeHtml(o.company || o.customerName)}</span>
        ${o.attachments && o.attachments.length > 0 ? `<span>📎 ${o.attachments.length}</span>` : ""}
      </div>
    </div>
  `).join("");
}

// ================================================
// Dispatcher: Order Detail
// ================================================

function selectOrder(id) {
  selectedOrderId = id;
  renderDispatcherList();
  renderOrderDetail(id);
}

function renderOrderDetail(id) {
  const order = allOrders.find((o) => o.id === id);
  if (!order) return;
  const panel = document.getElementById("detail-panel");
  const techOptions = TECHNICIANS.map(
    (t) => `<option value="${escapeHtml(t)}" ${order.assignedTech === t ? "selected" : ""}>${escapeHtml(t)}</option>`
  ).join("");

  const attachmentsHtml = order.attachments && order.attachments.length > 0 ? `
    <div class="detail-section">
      <h3>Attachments</h3>
      <div class="attachments-grid">
        ${order.attachments.map((a) => `
          <div class="attachment-item">
            <span class="att-icon">${getFileIcon(a.type)}</span>
            <div class="att-info">
              <span class="att-name">${escapeHtml(a.name)}</span>
              <span class="att-size">${formatFileSize(a.size)}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  ` : "";

  const notesHtml = `
    <div class="detail-section">
      <h3>Dispatcher Notes</h3>
      <div class="notes-list" id="notes-list-${id}">
        ${renderNotes(order.notes || [])}
      </div>
      <div class="add-note-form">
        <textarea id="new-note-${id}" rows="2" placeholder="Add a note or comment..." class="note-input"></textarea>
        <button class="btn btn-small btn-primary-small" onclick="addDispatcherNote('${id}')">Add Note</button>
      </div>
    </div>
  `;

  panel.innerHTML = `
    <div class="detail-header">
      <h2>${escapeHtml(order.title)}</h2>
      <div class="detail-badges">
        <span class="badge badge-${order.status}">${formatStatus(order.status)}</span>
        <span class="badge badge-priority-${order.priority}">${escapeHtml(order.priority)} Priority</span>
        <span class="badge" style="background:rgba(255,255,255,0.05);color:var(--text-secondary)">${escapeHtml(order.serviceType)}</span>
      </div>
    </div>
    <div class="detail-section">
      <h3>Description</h3>
      <p class="detail-description">${escapeHtml(order.description)}</p>
    </div>
    <div class="detail-section">
      <h3>Customer Information</h3>
      <div class="detail-field full-width" style="margin-bottom:0.75rem;">
        <label>Company</label>
        <p style="font-size:1rem;font-weight:700;color:var(--text-primary);">🏢 ${escapeHtml(order.company || "—")}</p>
      </div>
      <div class="detail-grid">
        <div class="detail-field"><label>Contact Name</label><p>${escapeHtml(order.customerName)}</p></div>
        <div class="detail-field"><label>Email</label><p>${escapeHtml(order.customerEmail)}</p></div>
        <div class="detail-field"><label>Phone</label><p>${escapeHtml(order.customerPhone)}</p></div>
        <div class="detail-field"><label>Site Address</label><p>${escapeHtml(order.siteAddress)}</p></div>
      </div>
    </div>
    <div class="detail-section">
      <h3>Schedule & Assignment</h3>
      <div class="detail-grid">
        <div class="detail-field"><label>Preferred Date</label><p>${order.preferredDate ? formatDate(order.preferredDate) : "Not specified"}</p></div>
        <div class="detail-field"><label>Submitted</label><p>${formatDate(order.createdAt)}</p></div>
        <div class="detail-field"><label>Assigned Technician</label><p>${order.assignedTech ? escapeHtml(order.assignedTech) : "Unassigned"}</p></div>
        <div class="detail-field"><label>Progress</label><p>${order.progress}%</p></div>
      </div>
    </div>
    ${attachmentsHtml}
    ${order.status === "new" || order.status === "dispatched" ? `
    <div class="detail-section">
      <h3>Dispatch</h3>
      <div class="dispatch-form">
        <div class="form-row">
          <div class="form-group">
            <label>Assign Technician</label>
            <select id="dispatch-tech">
              <option value="">-- Select Technician --</option>
              ${techOptions}
            </select>
          </div>
        </div>
        <div class="dispatch-actions">
          ${order.status === "new"
            ? `<button class="btn btn-primary" onclick="dispatchOrder('${order.id}')">⚡ Dispatch Work Order</button>`
            : `<button class="btn btn-warning" onclick="dispatchOrder('${order.id}')">🔄 Re-dispatch</button>`}
          ${order.status === "new" ? `<button class="btn btn-secondary" onclick="updateOrderStatus('${order.id}', 'in_progress')">Mark In Progress</button>` : ""}
        </div>
      </div>
    </div>
    ` : ""}
    ${order.status === "in_progress" ? `
    <div class="detail-section">
      <h3>Actions</h3>
      <div class="dispatch-actions">
        <button class="btn btn-success" onclick="updateOrderStatus('${order.id}', 'completed')">✓ Mark Completed</button>
      </div>
    </div>
    ` : ""}
    ${notesHtml}
    ${order.updates && order.updates.length > 0 ? `
    <div class="detail-section">
      <h3>Activity Timeline</h3>
      <div class="timeline">
        ${order.updates.slice().reverse().map((u) => `
          <div class="timeline-item">
            <div class="timeline-dot ${u.type || "info"}"></div>
            <div class="timeline-content">
              <div class="timeline-msg">${escapeHtml(u.msg)}</div>
              <div class="timeline-time">${formatDate(u.time)}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
    ` : ""}
  `;
}

function renderNotes(notes) {
  if (!notes || notes.length === 0) return '<p class="notes-empty">No notes yet.</p>';
  return notes.map((n) => `
    <div class="note-item">
      <div class="note-header">
        <span class="note-author">${escapeHtml(n.author || "Dispatcher")}</span>
        <span class="note-time">${formatDate(n.time)}</span>
      </div>
      <p class="note-text">${escapeHtml(n.text)}</p>
    </div>
  `).join("");
}

async function addDispatcherNote(orderId) {
  const textarea = document.getElementById(`new-note-${orderId}`);
  const text = textarea ? textarea.value.trim() : "";
  if (!text) { showToast("Please enter a note.", "error"); return; }
  try {
    const order = allOrders.find((o) => o.id === orderId);
    const notes = order.notes || [];
    notes.push({ author: "Dispatcher", text, time: new Date().toISOString() });
    await apiPut({ id: orderId, notes });
    textarea.value = "";
    showToast("Note added.", "success");
    await loadDispatcherOrders();
    renderOrderDetail(orderId);
  } catch (err) {
    showToast("Failed to add note.", "error");
  }
}

// ================================================
// Dispatcher: Actions
// ================================================

async function dispatchOrder(id) {
  const techSelect = document.getElementById("dispatch-tech");
  const tech = techSelect ? techSelect.value : "";
  if (!tech) { showToast("Please select a technician to dispatch.", "error"); return; }
  try {
    await apiPut({ id, status: "dispatched", assignedTech: tech });
    showToast(`Work order dispatched to ${tech}!`, "success");
    await loadDispatcherOrders();
    renderOrderDetail(id);
  } catch (err) {
    showToast("Failed to dispatch work order.", "error");
  }
}

async function updateOrderStatus(id, status) {
  try {
    await apiPut({ id, status });
    showToast(`Work order status updated to ${formatStatus(status)}.`, "success");
    await loadDispatcherOrders();
    renderOrderDetail(id);
  } catch (err) {
    showToast("Failed to update work order.", "error");
  }
}

// ================================================
// Technician Portal
// ================================================

function populateTechIdentitySelect() {
  const sel = document.getElementById("tech-identity-select");
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Select Name --</option>' +
    TECHNICIANS.map((t) => `<option value="${escapeHtml(t)}" ${currentTech === t ? "selected" : ""}>${escapeHtml(t)}</option>`).join("");
}

function onTechIdentityChange() {
  const sel = document.getElementById("tech-identity-select");
  currentTech = sel ? sel.value : "";
  selectedTechOrderId = null;
  document.getElementById("tech-detail-panel").innerHTML = `<div class="empty-detail"><div class="empty-icon">🔧</div><p>Select a job to view details and update progress</p></div>`;
  loadTechOrders();
}

async function loadTechOrders() {
  const container = document.getElementById("tech-orders-list");
  if (!currentTech) {
    container.innerHTML = '<div class="empty-state">Select your name above to see assigned jobs.</div>';
    return;
  }
  container.innerHTML = '<div class="loading">Loading your jobs...</div>';
  try {
    const orders = await apiGet();
    allTechOrders = orders.filter((o) => o.assignedTech === currentTech);
    renderTechList();
  } catch (err) {
    container.innerHTML = '<div class="empty-state">Failed to load jobs.</div>';
  }
}

function filterTechOrders(filter) {
  currentTechFilter = filter;
  document.querySelectorAll(".filter-btn[data-techfilter]").forEach((b) => b.classList.remove("active"));
  document.querySelector(`.filter-btn[data-techfilter="${filter}"]`).classList.add("active");
  renderTechList();
}

function renderTechList() {
  const container = document.getElementById("tech-orders-list");
  const filtered = currentTechFilter === "all" ? allTechOrders : allTechOrders.filter((o) => o.status === currentTechFilter);
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">No ${currentTechFilter === "all" ? "" : currentTechFilter + " "}jobs assigned.</div>`;
    return;
  }
  container.innerHTML = filtered.map((o) => `
    <div class="order-card ${selectedTechOrderId === o.id ? "selected" : ""}" onclick="selectTechOrder('${o.id}')">
      <div class="order-card-top">
        <span class="order-id">${escapeHtml(o.id)}</span>
        <span class="badge badge-${o.status}">${formatStatus(o.status)}</span>
      </div>
      <h4>${escapeHtml(o.title)}</h4>
      <div class="order-card-meta">
        <span class="badge badge-priority-${o.priority}">${escapeHtml(o.priority)}</span>
        <span>${escapeHtml(o.serviceType)}</span>
        ${o.siteAddress ? `<span>📍 ${escapeHtml(o.siteAddress)}</span>` : ""}
      </div>
      ${o.progress > 0 ? `<div class="progress-bar-container" style="margin-top:0.5rem;"><div class="progress-bar" style="width:${o.progress}%"></div></div>` : ""}
    </div>
  `).join("");
}

function selectTechOrder(id) {
  selectedTechOrderId = id;
  renderTechList();
  renderTechOrderDetail(id);
}

function renderTechOrderDetail(id) {
  const order = allTechOrders.find((o) => o.id === id);
  if (!order) return;
  const panel = document.getElementById("tech-detail-panel");

  const attachmentsHtml = order.attachments && order.attachments.length > 0 ? `
    <div class="detail-section">
      <h3>Customer Attachments</h3>
      <div class="attachments-grid">
        ${order.attachments.map((a) => `
          <div class="attachment-item">
            <span class="att-icon">${getFileIcon(a.type)}</span>
            <div class="att-info">
              <span class="att-name">${escapeHtml(a.name)}</span>
              <span class="att-size">${formatFileSize(a.size)}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  ` : "";

  const notesHtml = `
    <div class="detail-section">
      <h3>Notes & Comments</h3>
      <div class="notes-list" id="tech-notes-list-${id}">
        ${renderNotes(order.notes || [])}
      </div>
      <div class="add-note-form">
        <textarea id="tech-new-note-${id}" rows="2" placeholder="Add a field note or update..." class="note-input"></textarea>
        <button class="btn btn-small btn-primary-small" onclick="addTechNote('${id}')">Add Note</button>
      </div>
    </div>
  `;

  // Tech file upload section
  const techPhotoStore = techPhotos[id] || [];
  const techDocStore = techDocs[id] || [];
  const sig = techSignatures[id] || null;

  const techUploadHtml = `
    <div class="detail-section">
      <h3>Site Photos</h3>
      <div class="file-upload-zone" onclick="document.getElementById('tech-photo-input').click()"
           ondragover="handleDragOver(event)" ondrop="handlePhotoDrop(event)">
        <input type="file" id="tech-photo-input" multiple accept="image/*" capture="environment"
               style="display:none" onchange="handlePhotoSelect(event)" />
        <div class="file-upload-icon">📷</div>
        <p class="file-upload-text">Tap to capture or upload site photos</p>
        <p class="file-upload-hint">Images only · Max 10MB each</p>
      </div>
      <div id="tech-photo-preview-grid" class="photo-preview-grid">
        ${techPhotoStore.map((p, i) => `
          <div class="photo-preview-item">
            <img src="${p.dataUrl}" alt="${escapeHtml(p.name)}" />
            <button class="photo-remove" onclick="removeTechPhoto(${i})" title="Remove">✕</button>
            <span class="photo-name">${escapeHtml(p.name)}</span>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="detail-section">
      <h3>Documents</h3>
      <div class="file-upload-zone" onclick="document.getElementById('tech-doc-input').click()"
           ondragover="handleDragOver(event)" ondrop="handleDocDrop(event)">
        <input type="file" id="tech-doc-input" multiple accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
               style="display:none" onchange="handleDocSelect(event)" />
        <div class="file-upload-icon">📎</div>
        <p class="file-upload-text">Attach reports, forms, or documents</p>
        <p class="file-upload-hint">PDF, Word, Excel · Max 10MB each</p>
      </div>
      <div id="tech-doc-list" class="file-list">
        ${techDocStore.map((f, i) => `
          <div class="file-item">
            <span class="file-icon">${getFileIcon(f.type)}</span>
            <div class="file-info">
              <span class="file-name">${escapeHtml(f.name)}</span>
              <span class="file-size">${formatFileSize(f.size)}</span>
            </div>
            <button class="file-remove" onclick="removeTechDoc(${i})" title="Remove">✕</button>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="detail-section">
      <h3>Customer Signature</h3>
      <div id="tech-sig-display">
        ${sig ? `<div class="sig-captured"><img src="${sig}" alt="Signature" class="sig-preview-img" /><div style="font-size:0.78rem;color:var(--success);margin-top:0.4rem;">✓ Signature captured</div></div>` : `<p class="notes-empty" style="margin-bottom:0.5rem;">No signature captured yet.</p>`}
      </div>
      <button class="btn btn-secondary" style="width:100%;margin-top:0.5rem;" onclick="openSigModal()">✍️ ${sig ? "Re-capture" : "Capture"} Signature</button>
      ${sig ? `<button class="btn btn-small" style="width:100%;margin-top:0.4rem;background:transparent;border:1px solid var(--danger);color:var(--danger);" onclick="clearSignature(); renderTechOrderDetail('${id}')">Remove Signature</button>` : ""}
    </div>
  `;

  const canStart = order.status === "dispatched";
  const canComplete = order.status === "in_progress";
  const canUpdateProgress = order.status === "in_progress";

  panel.innerHTML = `
    <div class="detail-header">
      <h2>${escapeHtml(order.title)}</h2>
      <div class="detail-badges">
        <span class="badge badge-${order.status}">${formatStatus(order.status)}</span>
        <span class="badge badge-priority-${order.priority}">${escapeHtml(order.priority)} Priority</span>
        <span class="badge" style="background:rgba(255,255,255,0.05);color:var(--text-secondary)">${escapeHtml(order.serviceType)}</span>
      </div>
    </div>
    <div class="detail-section">
      <h3>Job Details</h3>
      <p class="detail-description">${escapeHtml(order.description)}</p>
    </div>
    <div class="detail-section">
      <h3>Site Information</h3>
      <div class="detail-field full-width" style="margin-bottom:0.75rem;">
        <label>Company</label>
        <p style="font-size:1rem;font-weight:700;color:var(--text-primary);">🏢 ${escapeHtml(order.company || "—")}</p>
      </div>
      <div class="detail-grid">
        <div class="detail-field"><label>Site Address</label><p>${escapeHtml(order.siteAddress)}</p></div>
        <div class="detail-field"><label>Contact Name</label><p>${escapeHtml(order.customerName)}</p></div>
        <div class="detail-field"><label>Contact Phone</label><p>${escapeHtml(order.customerPhone)}</p></div>
        <div class="detail-field"><label>Preferred Date</label><p>${order.preferredDate ? formatDate(order.preferredDate) : "Not specified"}</p></div>
      </div>
    </div>
    ${attachmentsHtml}
    ${canStart || canComplete || canUpdateProgress ? `
    <div class="detail-section">
      <h3>Job Actions</h3>
      ${canStart ? `<button class="btn btn-primary" style="width:100%" onclick="techStartJob('${order.id}')">🔧 Start Job</button>` : ""}
      ${canUpdateProgress ? `
        <div class="progress-update-form">
          <label>Update Progress: <span id="progress-val-${order.id}">${order.progress}%</span></label>
          <input type="range" min="0" max="100" step="5" value="${order.progress}"
                 oninput="document.getElementById('progress-val-${order.id}').textContent = this.value + '%'"
                 id="progress-slider-${order.id}" class="progress-slider" />
          <button class="btn btn-secondary" style="margin-top:0.5rem;" onclick="techUpdateProgress('${order.id}')">Save Progress</button>
        </div>
      ` : ""}
      ${canComplete ? `<button class="btn btn-success" style="width:100%;margin-top:0.5rem;" onclick="techCompleteJob('${order.id}')">✓ Mark Job Complete</button>` : ""}
    </div>
    ` : ""}
    ${techUploadHtml}
    ${notesHtml}
    ${order.updates && order.updates.length > 0 ? `
    <div class="detail-section">
      <h3>Activity Timeline</h3>
      <div class="timeline">
        ${order.updates.slice().reverse().map((u) => `
          <div class="timeline-item">
            <div class="timeline-dot ${u.type || "info"}"></div>
            <div class="timeline-content">
              <div class="timeline-msg">${escapeHtml(u.msg)}</div>
              <div class="timeline-time">${formatDate(u.time)}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
    ` : ""}
  `;
}

function renderTechFileListHtml(orderId) {
  const store = techFiles[orderId] || [];
  if (store.length === 0) return "";
  return store.map((f, i) => `
    <div class="file-item">
      <span class="file-icon">${getFileIcon(f.type)}</span>
      <div class="file-info">
        <span class="file-name">${escapeHtml(f.name)}</span>
        <span class="file-size">${formatFileSize(f.size)}</span>
      </div>
      <button class="file-remove" onclick="removeFile('tech', ${i})" title="Remove">✕</button>
    </div>
  `).join("");
}

async function techStartJob(id) {
  try {
    await apiPut({ id, status: "in_progress" });
    showToast("Job started! Status updated to In Progress.", "success");
    await loadTechOrders();
    renderTechOrderDetail(id);
  } catch (err) {
    showToast("Failed to update job status.", "error");
  }
}

async function techUpdateProgress(id) {
  const slider = document.getElementById(`progress-slider-${id}`);
  const progress = slider ? parseInt(slider.value) : 0;
  try {
    await apiPut({ id, progress });
    showToast(`Progress updated to ${progress}%.`, "success");
    await loadTechOrders();
    renderTechOrderDetail(id);
  } catch (err) {
    showToast("Failed to update progress.", "error");
  }
}

async function techCompleteJob(id) {
  try {
    await apiPut({ id, status: "completed", progress: 100 });
    showToast("Job marked as complete!", "success");
    await loadTechOrders();
    renderTechOrderDetail(id);
  } catch (err) {
    showToast("Failed to complete job.", "error");
  }
}

async function addTechNote(orderId) {
  const textarea = document.getElementById(`tech-new-note-${orderId}`);
  const text = textarea ? textarea.value.trim() : "";
  if (!text) { showToast("Please enter a note.", "error"); return; }
  try {
    const order = allTechOrders.find((o) => o.id === orderId);
    const notes = order.notes || [];
    notes.push({ author: currentTech || "Technician", text, time: new Date().toISOString() });
    await apiPut({ id: orderId, notes });
    textarea.value = "";
    showToast("Note added.", "success");
    await loadTechOrders();
    renderTechOrderDetail(orderId);
  } catch (err) {
    showToast("Failed to add note.", "error");
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
// New Work Order Modal (Dispatcher & Technician)
// ================================================

let newWORole = null;

function openNewWOModal(role) {
  newWORole = role;
  document.getElementById("new-wo-role-label").textContent =
    role === "dispatcher" ? "Created by Dispatcher" : `Created by ${currentTech || "Technician"}`;
  const assignRow = document.getElementById("nwo-assign-row");
  const assignSel = document.getElementById("nwo-assignee");
  if (role === "dispatcher") {
    assignRow.style.display = "";
    assignSel.innerHTML = '<option value="">-- Unassigned --</option>' +
      TECHNICIANS.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  } else {
    assignRow.style.display = "none";
  }
  // Clear fields
  ["nwo-title","nwo-description","nwo-address","nwo-company","nwo-customer-name","nwo-customer-phone","nwo-customer-email"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("nwo-service-type").value = "Repair";
  document.getElementById("nwo-priority").value = "Normal";
  document.getElementById("nwo-preferred-date").value = "";
  document.getElementById("new-wo-modal").style.display = "flex";
}

function closeNewWOModal(e) {
  if (e && e.target !== document.getElementById("new-wo-modal")) return;
  document.getElementById("new-wo-modal").style.display = "none";
}

async function submitNewWO() {
  const title = document.getElementById("nwo-title").value.trim();
  const description = document.getElementById("nwo-description").value.trim();
  const address = document.getElementById("nwo-address").value.trim();
  const company = document.getElementById("nwo-company").value.trim();
  const customerName = document.getElementById("nwo-customer-name").value.trim();
  if (!title || !description || !address || !company || !customerName) {
    showToast("Please fill in all required fields.", "error");
    return;
  }
  const data = {
    title,
    description,
    serviceType: document.getElementById("nwo-service-type").value,
    priority: document.getElementById("nwo-priority").value,
    company,
    customerName,
    customerEmail: document.getElementById("nwo-customer-email").value.trim(),
    customerPhone: document.getElementById("nwo-customer-phone").value.trim(),
    preferredDate: document.getElementById("nwo-preferred-date").value,
    siteAddress: address,
    attachments: [],
    ...(newWORole === "dispatcher" ? { assignedTech: document.getElementById("nwo-assignee").value } : {}),
    ...(newWORole === "technician" && currentTech ? { assignedTech: currentTech } : {}),
  };
  try {
    await apiPost(data);
    showToast("Work order created successfully!", "success");
    document.getElementById("new-wo-modal").style.display = "none";
    if (newWORole === "dispatcher") {
      await loadDispatcherOrders();
    } else {
      await loadTechOrders();
    }
  } catch (err) {
    showToast("Failed to create work order.", "error");
  }
}

// ================================================
// Tech Photo Capture
// ================================================

function handlePhotoSelect(e) {
  const files = Array.from(e.target.files);
  addTechPhotos(files);
  e.target.value = "";
}

function handlePhotoDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("dragover");
  addTechPhotos(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/")));
}

function addTechPhotos(files) {
  if (!selectedTechOrderId) return;
  if (!techPhotos[selectedTechOrderId]) techPhotos[selectedTechOrderId] = [];
  const maxSize = 10 * 1024 * 1024;
  const readers = files.map(file => new Promise(resolve => {
    if (file.size > maxSize) { showToast(`${file.name} exceeds 10MB`, "error"); resolve(null); return; }
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, size: file.size, dataUrl: r.result });
    r.readAsDataURL(file);
  }));
  Promise.all(readers).then(results => {
    results.filter(Boolean).forEach(p => techPhotos[selectedTechOrderId].push(p));
    refreshTechPhotoGrid();
  });
}

function refreshTechPhotoGrid() {
  const grid = document.getElementById("tech-photo-preview-grid");
  if (!grid) return;
  const store = techPhotos[selectedTechOrderId] || [];
  grid.innerHTML = store.map((p, i) => `
    <div class="photo-preview-item">
      <img src="${p.dataUrl}" alt="${escapeHtml(p.name)}" />
      <button class="photo-remove" onclick="removeTechPhoto(${i})" title="Remove">✕</button>
      <span class="photo-name">${escapeHtml(p.name)}</span>
    </div>
  `).join("");
}

function removeTechPhoto(index) {
  if (!selectedTechOrderId) return;
  (techPhotos[selectedTechOrderId] || []).splice(index, 1);
  refreshTechPhotoGrid();
}

// ================================================
// Tech Document Upload
// ================================================

function handleDocSelect(e) {
  const files = Array.from(e.target.files);
  addTechDocs(files);
  e.target.value = "";
}

function handleDocDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("dragover");
  addTechDocs(Array.from(e.dataTransfer.files));
}

function addTechDocs(files) {
  if (!selectedTechOrderId) return;
  if (!techDocs[selectedTechOrderId]) techDocs[selectedTechOrderId] = [];
  const maxSize = 10 * 1024 * 1024;
  const readers = files.map(file => new Promise(resolve => {
    if (file.size > maxSize) { showToast(`${file.name} exceeds 10MB`, "error"); resolve(null); return; }
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, size: file.size, type: file.type, dataUrl: r.result });
    r.readAsDataURL(file);
  }));
  Promise.all(readers).then(results => {
    results.filter(Boolean).forEach(d => techDocs[selectedTechOrderId].push(d));
    refreshTechDocList();
  });
}

function refreshTechDocList() {
  const list = document.getElementById("tech-doc-list");
  if (!list) return;
  const store = techDocs[selectedTechOrderId] || [];
  list.innerHTML = store.map((f, i) => `
    <div class="file-item">
      <span class="file-icon">${getFileIcon(f.type)}</span>
      <div class="file-info">
        <span class="file-name">${escapeHtml(f.name)}</span>
        <span class="file-size">${formatFileSize(f.size)}</span>
      </div>
      <button class="file-remove" onclick="removeTechDoc(${i})" title="Remove">✕</button>
    </div>
  `).join("");
}

function removeTechDoc(index) {
  if (!selectedTechOrderId) return;
  (techDocs[selectedTechOrderId] || []).splice(index, 1);
  refreshTechDocList();
}

// ================================================
// Signature Pad
// ================================================

let sigDrawing = false;
let sigCtx = null;

function openSigModal() {
  const modal = document.getElementById("sig-modal");
  modal.style.display = "flex";
  const canvas = document.getElementById("sig-canvas");
  sigCtx = canvas.getContext("2d");
  sigCtx.clearRect(0, 0, canvas.width, canvas.height);
  sigCtx.strokeStyle = "#E8EDF5";
  sigCtx.lineWidth = 2.5;
  sigCtx.lineCap = "round";
  sigCtx.lineJoin = "round";

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  };

  canvas.onmousedown = (e) => { sigDrawing = true; const p = getPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); };
  canvas.onmousemove = (e) => { if (!sigDrawing) return; const p = getPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); };
  canvas.onmouseup = () => sigDrawing = false;
  canvas.onmouseleave = () => sigDrawing = false;
  canvas.ontouchstart = (e) => { e.preventDefault(); sigDrawing = true; const p = getPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); };
  canvas.ontouchmove = (e) => { e.preventDefault(); if (!sigDrawing) return; const p = getPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); };
  canvas.ontouchend = () => sigDrawing = false;
}

function closeSigModal(e) {
  if (e && e.target !== document.getElementById("sig-modal")) return;
  document.getElementById("sig-modal").style.display = "none";
}

function clearSignature() {
  if (sigCtx) {
    const canvas = document.getElementById("sig-canvas");
    if (canvas) sigCtx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (selectedTechOrderId) {
    delete techSignatures[selectedTechOrderId];
  }
}

function saveSignature() {
  const canvas = document.getElementById("sig-canvas");
  if (!canvas || !selectedTechOrderId) return;
  const dataUrl = canvas.toDataURL("image/png");
  techSignatures[selectedTechOrderId] = dataUrl;
  document.getElementById("sig-modal").style.display = "none";
  // Update sig display inline
  const display = document.getElementById("tech-sig-display");
  if (display) {
    display.innerHTML = `<div class="sig-captured"><img src="${dataUrl}" alt="Signature" class="sig-preview-img" /><div style="font-size:0.78rem;color:var(--success);margin-top:0.4rem;">✓ Signature captured</div></div>`;
  }
  showToast("Signature saved!", "success");
}

// ================================================

window.selectRole = selectRole;
window.goBack = goBack;
window.companyLogin = companyLogin;
window.switchDispatcherTab = switchDispatcherTab;
window.addCompany = addCompany;
window.editCompanyPassword = editCompanyPassword;
window.deleteCompany = deleteCompany;
window.switchCustomerTab = switchCustomerTab;
window.submitWorkOrder = submitWorkOrder;
window.loadCustomerOrders = loadCustomerOrders;
window.loadDispatcherOrders = loadDispatcherOrders;
window.filterOrders = filterOrders;
window.selectOrder = selectOrder;
window.dispatchOrder = dispatchOrder;
window.updateOrderStatus = updateOrderStatus;
window.addDispatcherNote = addDispatcherNote;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleFileSelect = handleFileSelect;
window.removeFile = removeFile;
window.clearFiles = clearFiles;
window.populateTechIdentitySelect = populateTechIdentitySelect;
window.onTechIdentityChange = onTechIdentityChange;
window.loadTechOrders = loadTechOrders;
window.filterTechOrders = filterTechOrders;
window.selectTechOrder = selectTechOrder;
window.techStartJob = techStartJob;
window.techUpdateProgress = techUpdateProgress;
window.techCompleteJob = techCompleteJob;
window.addTechNote = addTechNote;
window.openNewWOModal = openNewWOModal;
window.closeNewWOModal = closeNewWOModal;
window.submitNewWO = submitNewWO;
window.handlePhotoSelect = handlePhotoSelect;
window.handlePhotoDrop = handlePhotoDrop;
window.removeTechPhoto = removeTechPhoto;
window.handleDocSelect = handleDocSelect;
window.handleDocDrop = handleDocDrop;
window.removeTechDoc = removeTechDoc;
window.openSigModal = openSigModal;
window.closeSigModal = closeSigModal;
window.clearSignature = clearSignature;
window.saveSignature = saveSignature;

