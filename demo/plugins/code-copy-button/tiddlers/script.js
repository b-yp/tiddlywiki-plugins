/*\
title: $:/plugins/byper/code-copy-button/script.js
type: application/javascript
module-type: startup

Startup module to add copy buttons to code blocks
\*/

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

const copyIconSVG =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
const checkIconSVG =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

// Create copy functionality (using modern Clipboard API only)
const copyToClipboard = async (text, button) => {
  const originalHTML = button.innerHTML;

  try {
    await navigator.clipboard.writeText(text);
    button.innerHTML = checkIconSVG;
    button.classList.add("tc-copied");
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.classList.remove("tc-copied");
    }, 2000);
  } catch (err) {
    console.error("Copy failed:", err);
    // You can add a simple error tooltip here, or keep the button unchanged
  }
};

// Add copy buttons to code blocks
const addCopyButtonToCodeBlocks = () => {
  // Handle standalone code blocks <pre><code>
  const codeBlocks = document.querySelectorAll("pre > code:not(.tc-processed)");

  codeBlocks.forEach((codeBlock) => {
    const pre = codeBlock.parentElement;

    // Avoid duplicate processing
    codeBlock.classList.add("tc-processed");

    // If pre is not yet wrapped
    if (!pre.parentElement.classList.contains("tc-code-wrapper")) {
      const wrapper = document.createElement("div");
      wrapper.className = "tc-code-wrapper";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // Create copy button
      const button = document.createElement("button");
      button.className = "tc-copy-button";
      button.innerHTML = copyIconSVG;
      button.setAttribute("aria-label", "Copy code");
      button.setAttribute("title", "Copy code");

      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        copyToClipboard(codeBlock.textContent, button);
      });

      wrapper.appendChild(button);
    }
  });

  // Handle inline code <code> (not inside pre)
  const inlineCodes = document.querySelectorAll(
    "code:not(pre > code):not(.tc-processed)",
  );

  inlineCodes.forEach((code) => {
    // Skip very short code
    if (code.textContent.trim().length < 3) return;

    code.classList.add("tc-processed", "tc-has-copy-button");

    // Create inline code wrapper
    const wrapper = document.createElement("span");
    wrapper.className = "tc-inline-code-wrapper";
    code.parentNode.insertBefore(wrapper, code);
    wrapper.appendChild(code);

    // Create inline copy button (placed after code element)
    const button = document.createElement("button");
    button.className = "tc-inline-copy-button";
    button.innerHTML = copyIconSVG;
    button.setAttribute("aria-label", "Copy code");
    button.setAttribute("title", "Copy");

    // Insert button after code element
    code.parentNode.insertBefore(button, code.nextSibling);

    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyToClipboard(code.textContent, button);
    });
  });
};

// Export name and synchronous execution
exports.name = "code-copy-button";
exports.platforms = ["browser"];
exports.after = ["render"];
exports.synchronous = true;

exports.startup = () => {
  // Initial execution
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addCopyButtonToCodeBlocks);
  } else {
    addCopyButtonToCodeBlocks();
  }

  // Listen for TiddlyWiki rendering events
  $tw.hooks.addHook("th-rendering-tiddler", (event) => {
    // Delay execution to ensure DOM is updated
    setTimeout(addCopyButtonToCodeBlocks, 10);
  });

  // Use MutationObserver to monitor DOM changes
  const observer = new MutationObserver((mutations) => {
    const shouldUpdate = mutations.some(
      (mutation) => mutation.addedNodes.length > 0,
    );
    if (shouldUpdate) {
      addCopyButtonToCodeBlocks();
    }
  });

  // Observe the entire document
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("Code copy button plugin loaded");
};
