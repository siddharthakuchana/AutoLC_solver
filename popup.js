// ============================================
// LeetCode Auto Solver — Popup Script
// ============================================

const serverUrlInput = document.getElementById("server-url");
const langSelect = document.getElementById("lang-select");
const saveBtn = document.getElementById("save-btn");
const saveLabel = document.getElementById("save-label");
const testBtn = document.getElementById("test-btn");
const statusBadge = document.getElementById("status-badge");
const statusText = document.getElementById("status-text");

// ---------- Load saved settings ----------
chrome.storage.local.get(["serverUrl", "language"], (result) => {
  serverUrlInput.value = result.serverUrl || "http://localhost:3000";
  langSelect.value = result.language || "python";

  // Auto-check server status on popup open
  checkServerStatus(serverUrlInput.value);
});

// ---------- Save ----------
saveBtn.addEventListener("click", () => {
  const url = serverUrlInput.value.trim().replace(/\/+$/, ""); // remove trailing slash
  const lang = langSelect.value;

  chrome.storage.local.set({ serverUrl: url, language: lang }, () => {
    saveLabel.textContent = "✓ Saved!";
    saveBtn.classList.add("saved");

    setTimeout(() => {
      saveLabel.textContent = "Save Settings";
      saveBtn.classList.remove("saved");
    }, 2000);
  });
});

// ---------- Test Connection ----------
testBtn.addEventListener("click", () => {
  const url = serverUrlInput.value.trim().replace(/\/+$/, "");
  checkServerStatus(url);
});

async function checkServerStatus(baseUrl) {
  setStatus("checking", "Checking…");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      setStatus("online", "Online");
    } else {
      setStatus("offline", `Error ${res.status}`);
    }
  } catch (err) {
    setStatus("offline", "Offline");
  }
}

function setStatus(state, text) {
  statusBadge.className = `status-badge status-${state}`;
  statusText.textContent = text;
}
