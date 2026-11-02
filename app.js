const STORAGE_KEY = "proofpocket.records.v1";
const dialog = document.getElementById("recordDialog");
const form = document.getElementById("recordForm");
const list = document.getElementById("recordList");
const warrantyList = document.getElementById("warrantyList");
const syncStatus = document.getElementById("syncStatus");
const formError = document.getElementById("formError");
const saveButton = document.getElementById("saveRecordBtn");
let records = [];
let cloudReady = false;

function readLocalBackup() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}
function saveLocalBackup() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch {}
}
function setStatus(message, offline = false) {
  syncStatus.classList.toggle("offline", offline);
  syncStatus.innerHTML = "<i></i> " + escapeHTML(message);
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
}
function formatDate(value) {
  if (!value) return "Date not added";
  return new Date(value + "T00:00:00").toLocaleDateString(undefined, {day:"numeric",month:"short",year:"numeric"});
}
function daysUntil(value) {
  if (!value) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((new Date(value + "T00:00:00") - today) / 86400000);
}
function attachmentLink(attachment) {
  if (!attachment || !attachment.pathname) return "";
  const href = "/api/file?pathname=" + encodeURIComponent(attachment.pathname);
  const label = attachment.contentType === "application/pdf" ? "View PDF ↗" : "View photo ↗";
  return '<a class="record-attachment" href="' + href + '" target="_blank" rel="noopener">' + label + '</a>';
}
function render() {
  const warranties = records.filter(item => item.warrantyEnd && daysUntil(item.warrantyEnd) >= 0);
  const expiring = warranties.filter(item => daysUntil(item.warrantyEnd) <= 30);
  document.getElementById("totalCount").textContent = records.length;
  document.getElementById("warrantyCount").textContent = warranties.length;
  document.getElementById("expiringCount").textContent = expiring.length;

  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const type = document.getElementById("typeFilter").value;
  const filtered = records.filter(item => (type === "all" || item.type === type) &&
    (item.title.toLowerCase().includes(query) || (item.notes || "").toLowerCase().includes(query)));
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">▤</div><strong>' + (records.length ? "No matching records" : "Your cloud vault is ready") + '</strong><p>' + (records.length ? "Try another search or filter." : "Add your first receipt, warranty or document to get started.") + '</p>' + (records.length ? "" : '<button class="secondary-btn" id="emptyAdd">＋ Add first record</button>') + '</div>';
    const emptyAdd = document.getElementById("emptyAdd");
    if (emptyAdd) emptyAdd.addEventListener("click", openDialog);
  } else {
    list.innerHTML = filtered.slice().reverse().map(item => {
      const hasPdf = item.attachment && item.attachment.contentType === "application/pdf";
      return '<div class="record-item"><div class="record-symbol ' + (item.attachment ? (hasPdf ? "pdf" : "image") : "") + '">' + (hasPdf ? "PDF" : item.attachment ? "▧" : item.type === "Warranty" ? "◷" : item.type === "Document" ? "▧" : "▤") + '</div><div class="record-meta"><strong>' + escapeHTML(item.title) + '</strong><small>' + escapeHTML(item.type) + ' · ' + formatDate(item.date) + '</small>' + attachmentLink(item.attachment) + '</div><span class="record-type">' + escapeHTML(item.type) + '</span></div>';
    }).join("");
  }

  if (!warranties.length) {
    warrantyList.innerHTML = '<div class="small-empty">Your saved warranties will appear here.</div>';
  } else {
    warrantyList.innerHTML = warranties.slice().sort((a,b) => a.warrantyEnd.localeCompare(b.warrantyEnd)).slice(0,4).map(item => {
      const days = daysUntil(item.warrantyEnd);
      const label = days === 0 ? "Expires today" : days + " days left";
      return '<div class="warranty-item"><div class="record-symbol">◷</div><div class="record-meta"><strong>' + escapeHTML(item.title) + '</strong><small>' + formatDate(item.warrantyEnd) + ' · ' + label + '</small></div></div>';
    }).join("");
  }
}
function openDialog() { formError.textContent = ""; formError.classList.remove("visible"); dialog.showModal(); }
async function getCloudRecords() {
  const response = await fetch("/api/records", {credentials:"same-origin", cache:"no-store"});
  if (!response.ok) throw new Error("Cloud records could not be loaded (" + response.status + ").");
  return await response.json();
}
async function createCloudRecord(record) {
  const response = await fetch("/api/records", {
    method:"POST", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body:JSON.stringify(record)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Record could not be saved.");
  }
  return await response.json();
}
async function initialiseVault() {
  try {
    setStatus("Connecting cloud...");
    let cloudRecords = await getCloudRecords();
    const localRecords = readLocalBackup();
    const cloudIds = new Set(cloudRecords.map(item => item.id));
    const toMigrate = localRecords.filter(item => item && item.id && !cloudIds.has(item.id));
    for (const item of toMigrate) {
      await createCloudRecord({
        id:item.id, title:item.title, type:item.type, date:item.date || "",
        warrantyEnd:item.warrantyEnd || "", notes:item.notes || "", createdAt:item.createdAt || new Date().toISOString()
      });
    }
    if (toMigrate.length) cloudRecords = await getCloudRecords();
    records = Array.isArray(cloudRecords) ? cloudRecords : [];
    cloudReady = true;
    saveLocalBackup();
    setStatus("Cloud synced");
    render();
  } catch (error) {
    records = readLocalBackup();
    setStatus("Cloud unavailable", true);
    render();
    list.insertAdjacentHTML("afterbegin", '<div class="cloud-warning"><strong>Cloud connection issue</strong><p>' + escapeHTML(error.message) + '</p><button class="secondary-btn" id="retryCloud">Retry connection</button></div>');
    const retry = document.getElementById("retryCloud");
    if (retry) retry.addEventListener("click", initialiseVault);
  }
}

document.getElementById("openAdd").addEventListener("click", openDialog);
document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
document.getElementById("cancelDialog").addEventListener("click", () => dialog.close());
document.getElementById("searchInput").addEventListener("input", render);
document.getElementById("typeFilter").addEventListener("change", render);
document.getElementById("showAll").addEventListener("click", () => {
  document.getElementById("searchInput").value = "";
  document.getElementById("typeFilter").value = "all";
  render();
  document.getElementById("records").scrollIntoView({behavior:"smooth"});
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!cloudReady) {
    formError.textContent = "Cloud is not connected. Please retry after the connection is restored.";
    formError.classList.add("visible");
    return;
  }
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  if (!title) return;
  const file = data.get("attachment");
  const recordId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  saveButton.disabled = true;
  saveButton.textContent = file && file.size ? "Uploading..." : "Saving...";
  formError.classList.remove("visible");
  try {
    let attachment = null;
    if (file && file.size) {
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("recordId", recordId);
      const uploadResponse = await fetch("/api/upload", {method:"POST", credentials:"same-origin", body:uploadData});
      const uploadResult = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) throw new Error(uploadResult.error || "File upload failed.");
      attachment = uploadResult.attachment;
    }
    const record = {
      id:recordId, title, type:String(data.get("type")), date:String(data.get("date") || ""),
      warrantyEnd:String(data.get("warrantyEnd") || ""), notes:String(data.get("notes") || "").trim(),
      attachment, createdAt:new Date().toISOString()
    };
    await createCloudRecord(record);
    records.push(record);
    saveLocalBackup();
    form.reset();
    dialog.close();
    setStatus("Cloud synced");
    render();
  } catch (error) {
    formError.textContent = error.message;
    formError.classList.add("visible");
    setStatus("Sync issue", true);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save record";
  }
});

initialiseVault();
