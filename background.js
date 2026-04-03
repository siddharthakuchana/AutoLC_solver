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
    return true;
  }

  // Handle code insertion into the LeetCode editor.
  // We use chrome.scripting.executeScript with world: "MAIN" to bypass CSP.
  if (message.type === "INSERT_CODE") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, message: "No tab ID found" });
      return true;
    }

    const codeToInsert = message.code;

    chrome.scripting.executeScript({
      target: { tabId: tabId },
      world: "MAIN",
      func: (code) => {
        let success = false;
        let message = "No editor found";

        try {
          // Method 1: window.monaco.editor.getModels()
          if (window.monaco && window.monaco.editor) {
            const models = window.monaco.editor.getModels();
            if (models && models.length > 0) {
              // Find the code model (skip plaintext/json/etc)
              for (const model of models) {
                if (model && typeof model.setValue === "function") {
                  model.setValue(code);
                  success = true;
                  message = "Inserted via monaco.editor.getModels().setValue";
                  break;
                }
              }
            }

            // Also try getEditors
            if (!success) {
              const editors = window.monaco.editor.getEditors
                ? window.monaco.editor.getEditors()
                : [];
              for (const editor of editors) {
                const model = editor.getModel && editor.getModel();
                if (model) {
                  model.setValue(code);
                  editor.setPosition({ lineNumber: 1, column: 1 });
                  editor.focus();
                  success = true;
                  message = "Inserted via monaco.editor.getEditors().setValue";
                  break;
                }
              }
            }
          }

          // Method 2: React Fiber traversal
          if (!success) {
            const editorEls = document.querySelectorAll(
              ".monaco-editor, .cm-editor, [class*='editor'], .view-lines"
            );
            for (const el of editorEls) {
              let current = el;
              while (current && current !== document.body) {
                const fiberKey = Object.keys(current).find((k) =>
                  k.startsWith("__reactFiber$")
                );
                if (fiberKey) {
                  let fiber = current[fiberKey];
                  let depth = 0;
                  while (fiber && depth < 50) {
                    // Monaco editor via stateNode
                    if (
                      fiber.stateNode &&
                      fiber.stateNode.editor &&
                      typeof fiber.stateNode.editor.getModel === "function"
                    ) {
                      fiber.stateNode.editor.getModel().setValue(code);
                      success = true;
                      message = "Inserted via React Fiber -> stateNode.editor";
                      break;
                    }
                    // onChange prop
                    if (fiber.memoizedProps) {
                      const props = fiber.memoizedProps;
                      if (
                        typeof props.onChange === "function" &&
                        typeof props.value === "string"
                      ) {
                        props.onChange(code);
                        success = true;
                        message = "Inserted via React Fiber -> props.onChange";
                        break;
                      }
                      // CodeMirror view.dispatch
                      if (
                        props.view &&
                        typeof props.view.dispatch === "function"
                      ) {
                        props.view.dispatch({
                          changes: {
                            from: 0,
                            to: props.view.state.doc.length,
                            insert: code,
                          },
                        });
                        success = true;
                        message = "Inserted via React Fiber -> view.dispatch";
                        break;
                      }
                    }
                    fiber = fiber.return;
                    depth++;
                  }
                  if (success) break;
                }
                current = current.parentElement;
              }
              if (success) break;
            }
          }

          // Method 3: CodeMirror 6 contenteditable
          if (!success) {
            const cmContent = document.querySelector(
              '.cm-content[contenteditable="true"]'
            );
            if (cmContent) {
              cmContent.focus();
              const sel = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(cmContent);
              sel.removeAllRanges();
              sel.addRange(range);
              document.execCommand("insertText", false, code);
              success = true;
              message = "Inserted via CodeMirror 6 contenteditable";
            }
          }

          // Method 4: Textarea fallback with Ctrl+A simulation
          if (!success) {
            const textarea = document.querySelector(
              "textarea.inputarea, .inputarea, textarea"
            );
            if (textarea) {
              textarea.focus();
              textarea.select && textarea.select();
              document.execCommand("selectAll", false, null);
              document.execCommand("insertText", false, code);
              success = true;
              message = "Inserted via textarea selectAll fallback";
            }
          }
        } catch (e) {
          message = "Error: " + e.message;
        }

        return { success, message };
      },
      args: [codeToInsert],
    })
      .then((results) => {
        const result = results && results[0] && results[0].result;
        if (result) {
          console.log("[LeetCode Solver BG]", result.message);
          sendResponse(result);
        } else {
          sendResponse({ success: false, message: "Script returned no result" });
        }
      })
      .catch((err) => {
        console.error("[LeetCode Solver BG] executeScript failed:", err);
        sendResponse({ success: false, message: err.message });
      });

    return true; // keep sendResponse channel open for async
  }

  return true;
});
