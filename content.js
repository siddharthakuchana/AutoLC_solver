// ============================================
// LeetCode Auto Solver — Content Script
// Injected on leetcode.com/problems/* pages
// ============================================

(function () {
  "use strict";

  // Prevent double-injection
  if (document.getElementById("lc-solver-btn")) return;

  let currentLanguage = "python";

  const LANG_MAP = {
    python: "Python3",
    javascript: "JavaScript",
    java: "Java",
    cpp: "C++",
    csharp: "C#",
    go: "Go",
    rust: "Rust",
    typescript: "TypeScript",
  };

  // ---------- UI Creation ----------

  function createSolveButton() {
    const btn = document.createElement("button");
    btn.id = "lc-solver-btn";
    btn.innerHTML = `
      <span class="lc-solver-spinner"></span>
      <span class="lc-solver-icon">⚡</span>
      <span class="lc-solver-label">Solve with AI</span>
    `;
    btn.addEventListener("click", handleSolve);
    document.body.appendChild(btn);
    console.log("[LeetCode Solver] ✅ Solve button injected!");
    return btn;
  }

  function createLanguageChip() {
    const chip = document.createElement("div");
    chip.id = "lc-solver-lang-chip";

    const label = document.createElement("span");
    label.textContent = "🌐";

    const select = document.createElement("select");
    Object.entries(LANG_MAP).forEach(([key, display]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = display;
      if (key === currentLanguage) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", (e) => {
      currentLanguage = e.target.value;
      chrome.storage.local.set({ language: currentLanguage });
    });

    chip.appendChild(label);
    chip.appendChild(select);
    document.body.appendChild(chip);
  }

  function createToast() {
    const toast = document.createElement("div");
    toast.id = "lc-solver-toast";
    document.body.appendChild(toast);
    return toast;
  }

  function showToast(message, type = "info") {
    const toast =
      document.getElementById("lc-solver-toast") || createToast();
    toast.textContent = message;
    toast.className = ""; // reset
    toast.classList.add("lc-solver-show");
    if (type === "success") toast.classList.add("lc-solver-toast-success");
    if (type === "error") toast.classList.add("lc-solver-toast-error");

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove("lc-solver-show");
    }, 4000);
  }

  // ---------- Problem Extraction ----------

  function getProblemText() {
    // Primary selector used by LeetCode's React app
    const el = document.querySelector(
      '[data-track-load="description_content"]'
    );
    if (el) return el.innerText.trim();

    // Fallback selectors for different LeetCode layouts
    const fallbackSelectors = [
      ".elfjS",
      "[class*='description__']",
      ".question-content",
      "[data-key='description-content']",
      ".content__u3I1",
      "#qd-content",
    ];

    for (const sel of fallbackSelectors) {
      const fallback = document.querySelector(sel);
      if (fallback && fallback.innerText.trim().length > 50) {
        return fallback.innerText.trim();
      }
    }

    return null;
  }

  function getProblemTitle() {
    const selectors = [
      '[data-cy="question-title"]',
      ".text-title-large a",
      "h4 a",
      "[class*='title__'] a",
      ".css-v3d350",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el.innerText.trim();
    }
    return document.title;
  }

  // ---------- AI Solve ----------

  async function getSolution(problemText) {
    const settings = await new Promise((resolve) =>
      chrome.storage.local.get(["serverUrl"], resolve)
    );
    const serverUrl = settings.serverUrl || "http://localhost:3000";

    const response = await fetch(`${serverUrl}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        problem: problemText,
        language: currentLanguage,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.solution;
  }

  /**
   * Sends the code to the background script, which injects it into the page's
   * MAIN world via chrome.scripting.executeScript — bypassing CSP completely.
   */
  function insertIntoEditor(code) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "INSERT_CODE", code: code },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("[LeetCode Solver] Message error:", chrome.runtime.lastError.message);
            resolve(false);
            return;
          }
          if (response && response.success) {
            console.log("[LeetCode Solver]", response.message);
            resolve(true);
          } else {
            console.warn("[LeetCode Solver]", response ? response.message : "No response");
            resolve(false);
          }
        }
      );
    });
  }

  // ---------- Clean Code ----------

  function extractCode(rawSolution) {
    // Strip markdown code fences if present. 
    // Handle Windows CRLF, spaces, and special language IDs like c++, c#
    const match = rawSolution.match(/```[a-zA-Z0-9+#\s]*[\r\n]+([\s\S]*?)```/);
    if (match) {
      return match[1].trim();
    }

    // Try finding the start of code if fences are missing
    const lines = rawSolution.split(/\r?\n/);
    const codeStart = lines.findIndex(
      (l) =>
        l.startsWith("class ") ||
        l.startsWith("def ") ||
        l.startsWith("function ") ||
        l.startsWith("var ") ||
        l.startsWith("const ") ||
        l.startsWith("public ") ||
        l.startsWith("func ") ||
        l.startsWith("#include") ||
        l.startsWith("import ")
    );

    if (codeStart !== -1) {
      return lines.slice(codeStart).join("\n").trim();
    }

    return rawSolution.trim();
  }

  // ---------- Main Handler ----------

  async function handleSolve() {
    const btn = document.getElementById("lc-solver-btn");
    const labelEl = btn.querySelector(".lc-solver-label");
    const iconEl = btn.querySelector(".lc-solver-icon");

    // Enter loading state
    btn.classList.add("lc-solver-loading");
    btn.classList.remove("lc-solver-success", "lc-solver-error");
    labelEl.textContent = "Solving…";
    iconEl.style.display = "none";

    try {
      const problem = getProblemText();
      if (!problem) {
        throw new Error("Could not extract problem description from the page.");
      }

      showToast(`🧠 Sending "${getProblemTitle()}" to AI…`);

      const rawSolution = await getSolution(problem);
      const cleanCode = extractCode(rawSolution);

      const inserted = await insertIntoEditor(cleanCode);
      if (!inserted) {
        // Copy to clipboard as fallback
        await navigator.clipboard.writeText(cleanCode);
        showToast("📋 Code copied to clipboard (editor not found)", "success");
      } else {
        showToast("✅ Solution inserted into editor!", "success");
      }

      btn.classList.add("lc-solver-success");
      labelEl.textContent = "Solved!";
      iconEl.textContent = "✅";
      iconEl.style.display = "";
    } catch (err) {
      console.error("[LeetCode Solver]", err);
      btn.classList.add("lc-solver-error");
      labelEl.textContent = "Error";
      iconEl.textContent = "❌";
      iconEl.style.display = "";
      showToast(`❌ ${err.message}`, "error");
    } finally {
      btn.classList.remove("lc-solver-loading");

      // Reset button after delay
      setTimeout(() => {
        btn.classList.remove("lc-solver-success", "lc-solver-error");
        labelEl.textContent = "Solve with AI";
        iconEl.textContent = "⚡";
      }, 3500);
    }
  }

  // ---------- Init ----------

  function injectUI() {
    // Don't inject twice
    if (document.getElementById("lc-solver-btn")) return;

    createSolveButton();
    createLanguageChip();
    createToast();
  }

  function init() {
    console.log("[LeetCode Solver] Content script loaded on:", window.location.href);

    // Load saved language preference
    chrome.storage.local.get(["language"], (result) => {
      if (result.language) currentLanguage = result.language;
    });

    // Listen for changes from the extension popup so we don't need a browser refresh
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.language) {
        currentLanguage = changes.language.newValue;
        // Also update the in-page chip dropdown to reflect the change visually
        const selectEl = document.querySelector("#lc-solver-lang-chip select");
        if (selectEl) {
          selectEl.value = currentLanguage;
        }
        console.log("[LeetCode Solver] Language updated dynamically to:", currentLanguage);
      }
    });

    // Try to inject immediately
    injectUI();

    // LeetCode is a React SPA — the DOM may not be ready yet.
    // Use a MutationObserver to wait for the page content to load.
    const observer = new MutationObserver((mutations) => {
      // Check if our button already exists
      if (document.getElementById("lc-solver-btn")) return;

      // Check if the page has loaded enough (look for the problem area)
      const hasContent =
        document.querySelector('[data-track-load="description_content"]') ||
        document.querySelector(".elfjS") ||
        document.querySelector("#qd-content");

      if (hasContent) {
        injectUI();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Safety: also try after a delay in case the observer misses it
    setTimeout(() => {
      if (!document.getElementById("lc-solver-btn")) {
        console.log("[LeetCode Solver] Fallback injection after 3s timeout");
        injectUI();
      }
    }, 3000);

    // Handle SPA navigation (LeetCode uses client-side routing)
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log("[LeetCode Solver] SPA navigation detected:", lastUrl);
        // Wait for new page content to render
        setTimeout(() => {
          if (!document.getElementById("lc-solver-btn")) {
            injectUI();
          }
        }, 1500);
      }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Start as soon as possible
  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
