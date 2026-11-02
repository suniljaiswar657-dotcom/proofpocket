const STORAGE_KEY = "proofpocket.records.v1";
const dialog = document.getElementById("recordDialog");
const form = document.getElementById("recordForm");
const list = document.getElementById("recordList");
const warrantyList = document.getElementById("warrantyList");
let records = loadRecords();

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}
function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
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
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">⌕</div><strong>' + (records.length ? "No matching records" : "Your vault is ready") + '</strong><p>' + (records.length ? "Try another search or filter." : "Add your first receipt, warranty or document to get started.") + '</p>' + (records.length ? "" : '<button class="secondary-btn" id="emptyAdd">＋ Add first record</button>') + '</div>';
    const emptyAdd = document.getElementById("emptyAdd");
    if (emptyAdd) emptyAdd.addEventListener("click", openDialog);
  } else {
    list.innerHTML = filtered.slice().reverse().map(item => '<div class="record-item"><div class="record-symbol">' + (item.type === "Warranty" ? "◷" : item.type === "Document" ? "▧" : "▤") + '</div><div class="record-meta"><strong>' + escapeHTML(item.title) + '</strong><small>' + escapeHTML(item.type) + ' · ' + formatDate(item.date) + '</small></div><span class="record-type">' + escapeHTML(item.type) + '</span></div>').join("");
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
function openDialog() { dialog.showModal(); }
document.getElementById("openAdd").addEventListener("click", openDialog);
document.getElementById("emptyAdd").addEventListener("click", openDialog);
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
form.addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  if (!title) return;
  records.push({
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    title,
    type: String(data.get("type")),
    date: String(data.get("date") || ""),
    warrantyEnd: String(data.get("warrantyEnd") || ""),
    notes: String(data.get("notes") || "").trim()
  });
  saveRecords();
  form.reset();
  dialog.close();
  render();
});
render();