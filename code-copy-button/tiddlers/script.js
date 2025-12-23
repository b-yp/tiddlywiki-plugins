/*\
title: $:/plugins/byper/code-copy-button/script.js
type: application/javascript
module-type: startup

为代码块添加复制按钮的启动模块
\*/

(function () {
  /*jslint node: true, browser: true */
  /*global $tw: false */
  "use strict";

  // 导出名称和同步执行
  exports.name = "code-copy-button";
  exports.platforms = ["browser"];
  exports.after = ["render"];
  exports.synchronous = true;

  exports.startup = function () {
    // SVG 图标
    var copyIconSVG =
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
    var checkIconSVG =
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

    // 创建复制功能（兼容多种方式）
    function copyToClipboard(text, button) {
      var originalHTML = button.innerHTML;

      // 方法1: 使用 Clipboard API（现代浏览器）
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(function () {
            button.innerHTML = checkIconSVG;
            button.classList.add("tc-copied");
            setTimeout(function () {
              button.innerHTML = originalHTML;
              button.classList.remove("tc-copied");
            }, 2000);
          })
          .catch(function (err) {
            console.error("复制失败:", err);
            fallbackCopy(text, button, originalHTML);
          });
      } else {
        // 方法2: 降级方案
        fallbackCopy(text, button, originalHTML);
      }
    }

    // 降级复制方案
    function fallbackCopy(text, button, originalHTML) {
      try {
        var textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.top = "0";
        textarea.style.left = "0";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        var successful = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (successful) {
          button.innerHTML = checkIconSVG;
          button.classList.add("tc-copied");
          setTimeout(function () {
            button.innerHTML = originalHTML;
            button.classList.remove("tc-copied");
          }, 2000);
        } else {
          // 保持原图标，短暂显示失败状态
          button.style.background = "rgba(220, 53, 69, 0.9)";
          setTimeout(function () {
            button.style.background = "";
          }, 2000);
        }
      } catch (err) {
        console.error("降级复制也失败:", err);
        button.style.background = "rgba(220, 53, 69, 0.9)";
        setTimeout(function () {
          button.style.background = "";
        }, 2000);
      }
    }

    // 为代码块添加复制按钮
    function addCopyButtonToCodeBlocks() {
      // 处理独立代码块 <pre><code>
      var codeBlocks = document.querySelectorAll(
        "pre > code:not(.tc-processed)",
      );

      codeBlocks.forEach(function (codeBlock) {
        var pre = codeBlock.parentElement;

        // 避免重复处理
        codeBlock.classList.add("tc-processed");

        // 如果 pre 还没有被包装
        if (!pre.parentElement.classList.contains("tc-code-wrapper")) {
          var wrapper = document.createElement("div");
          wrapper.className = "tc-code-wrapper";
          pre.parentNode.insertBefore(wrapper, pre);
          wrapper.appendChild(pre);

          // 创建复制按钮
          var button = document.createElement("button");
          button.className = "tc-copy-button";
          button.innerHTML = copyIconSVG;
          button.setAttribute("aria-label", "复制代码");
          button.setAttribute("title", "复制代码");

          button.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            copyToClipboard(codeBlock.textContent, button);
          });

          wrapper.appendChild(button);
        }
      });

      // 处理行内代码 <code>（不在 pre 中的）
      var inlineCodes = document.querySelectorAll(
        "code:not(pre > code):not(.tc-processed)",
      );

      inlineCodes.forEach(function (code) {
        // 跳过太短的代码
        if (code.textContent.trim().length < 3) return;

        code.classList.add("tc-processed", "tc-has-copy-button");

        // 创建行内代码包装器
        var wrapper = document.createElement("span");
        wrapper.className = "tc-inline-code-wrapper";
        code.parentNode.insertBefore(wrapper, code);
        wrapper.appendChild(code);

        // 创建行内复制按钮（放在 code 元素后面）
        var button = document.createElement("button");
        button.className = "tc-inline-copy-button";
        button.innerHTML = copyIconSVG;
        button.setAttribute("aria-label", "复制代码");
        button.setAttribute("title", "复制");

        // 将按钮插入到 code 元素之后
        code.parentNode.insertBefore(button, code.nextSibling);

        button.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          copyToClipboard(code.textContent, button);
        });
      });
    }

    // 初始执行
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", addCopyButtonToCodeBlocks);
    } else {
      addCopyButtonToCodeBlocks();
    }

    // 监听 TiddlyWiki 的渲染事件
    $tw.hooks.addHook("th-rendering-tiddler", function (event) {
      // 延迟执行，确保 DOM 已更新
      setTimeout(addCopyButtonToCodeBlocks, 10);
    });

    // 使用 MutationObserver 监听 DOM 变化
    var observer = new MutationObserver(function (mutations) {
      var shouldUpdate = false;
      mutations.forEach(function (mutation) {
        if (mutation.addedNodes.length > 0) {
          shouldUpdate = true;
        }
      });
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
})();
