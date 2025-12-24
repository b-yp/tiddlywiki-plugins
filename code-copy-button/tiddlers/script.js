/*\
title: $:/plugins/yourname/code-copy-button/script.js
type: application/javascript
module-type: startup

为代码块添加复制按钮的启动模块
\*/

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

const copyIconSVG =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
const checkIconSVG =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

// 创建复制功能（仅使用现代 Clipboard API）
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
    console.error("复制失败:", err);
    // 可以在这里添加一个简单的错误提示，或者保持按钮不变
  }
};

// 为代码块添加复制按钮
const addCopyButtonToCodeBlocks = () => {
  // 处理独立代码块 <pre><code>
  const codeBlocks = document.querySelectorAll("pre > code:not(.tc-processed)");

  codeBlocks.forEach((codeBlock) => {
    const pre = codeBlock.parentElement;

    // 避免重复处理
    codeBlock.classList.add("tc-processed");

    // 如果 pre 还没有被包装
    if (!pre.parentElement.classList.contains("tc-code-wrapper")) {
      const wrapper = document.createElement("div");
      wrapper.className = "tc-code-wrapper";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // 创建复制按钮
      const button = document.createElement("button");
      button.className = "tc-copy-button";
      button.innerHTML = copyIconSVG;
      button.setAttribute("aria-label", "复制代码");
      button.setAttribute("title", "复制代码");

      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        copyToClipboard(codeBlock.textContent, button);
      });

      wrapper.appendChild(button);
    }
  });

  // 处理行内代码 <code>（不在 pre 中的）
  const inlineCodes = document.querySelectorAll(
    "code:not(pre > code):not(.tc-processed)",
  );

  inlineCodes.forEach((code) => {
    // 跳过太短的代码
    if (code.textContent.trim().length < 3) return;

    code.classList.add("tc-processed", "tc-has-copy-button");

    // 创建行内代码包装器
    const wrapper = document.createElement("span");
    wrapper.className = "tc-inline-code-wrapper";
    code.parentNode.insertBefore(wrapper, code);
    wrapper.appendChild(code);

    // 创建行内复制按钮（放在 code 元素后面）
    const button = document.createElement("button");
    button.className = "tc-inline-copy-button";
    button.innerHTML = copyIconSVG;
    button.setAttribute("aria-label", "复制代码");
    button.setAttribute("title", "复制");

    // 将按钮插入到 code 元素之后
    code.parentNode.insertBefore(button, code.nextSibling);

    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyToClipboard(code.textContent, button);
    });
  });
};

// 导出名称和同步执行
exports.name = "code-copy-button";
exports.platforms = ["browser"];
exports.after = ["render"];
exports.synchronous = true;

exports.startup = () => {
  // 初始执行
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addCopyButtonToCodeBlocks);
  } else {
    addCopyButtonToCodeBlocks();
  }

  // 监听 TiddlyWiki 的渲染事件
  $tw.hooks.addHook("th-rendering-tiddler", (event) => {
    // 延迟执行，确保 DOM 已更新
    setTimeout(addCopyButtonToCodeBlocks, 10);
  });

  // 使用 MutationObserver 监听 DOM 变化
  const observer = new MutationObserver((mutations) => {
    const shouldUpdate = mutations.some(
      (mutation) => mutation.addedNodes.length > 0,
    );
    if (shouldUpdate) {
      addCopyButtonToCodeBlocks();
    }
  });

  // 监听整个文档
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("代码复制按钮插件已加载");
};
