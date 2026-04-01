// Background service worker for LeetCode Auto Solver

chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ LeetCode Auto Solver extension installed.");

  // Set default settings
  chrome.storage.local.get(["serverUrl", "language"], (result) => {
    if (!result.serverUrl) {
      chrome.storage.local.set({ serverUrl: "http://localhost:3000" });
    }
    if (!result.language) {
      chrome.storage.local.set({ language: "python" });
    }
  });
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATUS") {
    sendResponse({ status: "active" });
  }
  return true;
});
