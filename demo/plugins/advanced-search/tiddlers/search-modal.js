/*\
title: $:/plugins/custom/advanced-search/search-modal.js
type: application/javascript
module-type: startup

高级搜索弹窗插件 - Ctrl+K 触发,支持多匹配展开和自动定位
\*/

(function () {
  "use strict";

  exports.name = "advanced-search-modal";
  exports.platforms = ["browser"];
  exports.after = ["startup"];
  exports.synchronous = true;

  exports.startup = () => {
    // 样式现在由 $:/plugins/byper/advanced-search/styles 统一管理
    // 无需在此处动态注入 JS 样式

    let overlay = null;
    let modal = null;
    let input = null;
    let resultsContainer = null;
    let selectedIndex = -1;
    let currentResults = [];
    let currentKeyword = "";

    // 全局定时器变量，防止冲突
    let fadeOutTimer = null;
    let removeTimer = null;

    // 创建弹窗
    const createModal = () => {
      overlay = document.createElement("div");
      overlay.className = "advanced-search-overlay";

      modal = document.createElement("div");
      modal.className = "advanced-search-modal";

      const inputWrapper = document.createElement("div");
      inputWrapper.className = "advanced-search-input-wrapper";

      input = document.createElement("input");
      input.className = "advanced-search-input";
      input.placeholder = "Search tiddlers...";
      input.type = "text";

      resultsContainer = document.createElement("div");
      resultsContainer.className = "advanced-search-results";

      inputWrapper.appendChild(input);
      modal.appendChild(inputWrapper);
      modal.appendChild(resultsContainer);
      overlay.appendChild(modal);

      // 阻止点击弹窗内部关闭
      modal.addEventListener("click", (e) => e.stopPropagation());

      // 点击遮罩关闭
      overlay.addEventListener("click", closeModal);

      // 输入事件
      input.addEventListener("input", handleSearch);

      // 键盘事件 - 绑定到 overlay 确保总能捕获
      overlay.addEventListener("keydown", handleKeydown);

      return overlay;
    };

    // 创建高亮的DOM节点 (替代 innerHTML)
    const createHighlightedNodes = (text, keyword) => {
      const fragment = document.createDocumentFragment();

      if (!text) return fragment;

      if (!keyword) {
        fragment.textContent = text;
        return fragment;
      }

      const regex = new RegExp(
        `(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi",
      );

      const parts = text.split(regex);

      parts.forEach((part, index) => {
        if (index % 2 === 1) {
          // 匹配的部分
          const span = document.createElement("span");
          span.className = "search-highlight";
          span.textContent = part;
          fragment.appendChild(span);
        } else if (part) {
          // 普通文本部分
          fragment.appendChild(document.createTextNode(part));
        }
      });

      return fragment;
    };

    // 统计字符串中关键词出现的次数
    const countMatches = (text, keyword) => {
      if (!text || !keyword) return 0;
      let count = 0;
      let pos = 0;
      const lowerText = text.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();
      while (true) {
        const found = lowerText.indexOf(lowerKeyword, pos);
        if (found === -1) break;
        count++;
        pos = found + 1;
      }
      return count;
    };

    // 搜索
    const handleSearch = () => {
      const keyword = input.value.trim();
      currentKeyword = keyword;
      selectedIndex = -1;

      if (!keyword) {
        resultsContainer.innerHTML =
          '<div class="advanced-search-empty">Type to start searching</div>';
        currentResults = [];
        return;
      }

      const results = [];

      $tw.wiki.each((tiddler, title) => {
        // 跳过系统tiddler
        if (title.startsWith("$:/")) return;

        const text = tiddler.fields.text || "";
        const titleLower = title.toLowerCase();
        const keywordLower = keyword.toLowerCase();
        const titleMatched = titleLower.indexOf(keywordLower) !== -1;

        // 如果标题匹配,作为一个单独的结果项
        if (titleMatched) {
          results.push({
            type: "title",
            title: title,
            modified: tiddler.fields.modified,
            text: "Title Match",
            matchIndices: [], // 标题匹配不高亮内容
          });
        }

        // 内容匹配 - 按段落分组 separated by double newlines
        const blocks = text.split(/\n\n+/);
        let globalMatchIndex = 0;

        blocks.forEach((blockText) => {
          // 计算当前段落中的匹配数
          const matchesInBlock = countMatches(blockText, keyword);

          if (matchesInBlock > 0) {
            // 生成当前这段中所有匹配的全局索引
            const currentBlockIndices = [];
            for (let i = 0; i < matchesInBlock; i++) {
              currentBlockIndices.push(globalMatchIndex + i);
            }

            results.push({
              type: "content",
              title: title,
              modified: tiddler.fields.modified,
              text: blockText,
              matchIndices: currentBlockIndices,
            });
          }

          // 更新全局匹配计数
          globalMatchIndex += matchesInBlock;
        });
      });

      // 排序: 最新修改的在前
      results.sort((a, b) => (b.modified || 0) - (a.modified || 0));

      currentResults = results;

      if (currentResults.length === 0) {
        resultsContainer.innerHTML =
          '<div class="advanced-search-empty">No matches found</div>';
        return;
      }

      renderResults(keyword);
    };

    // 渲染结果
    const renderResults = (keyword) => {
      resultsContainer.innerHTML = "";

      currentResults.forEach((result, index) => {
        const item = document.createElement("div");
        item.className = "advanced-search-item";
        item.dataset.index = index;

        const header = document.createElement("div");
        header.className = "advanced-search-item-header";

        // 标题行
        const titleRow = document.createElement("div");

        const metaSpan = document.createElement("span");
        metaSpan.className = "advanced-search-item-meta";
        if (result.modified) {
          metaSpan.textContent = $tw.utils.formatDateString(
            result.modified,
            "YYYY-MM-DD",
          );
        }

        const titleSpan = document.createElement("div");
        titleSpan.className = "advanced-search-item-title";
        // 如果是标题匹配,高亮标题
        if (result.type === "title") {
          titleSpan.appendChild(createHighlightedNodes(result.title, keyword));
        } else {
          titleSpan.textContent = result.title;
        }

        titleRow.appendChild(metaSpan);
        titleRow.appendChild(titleSpan);

        // 内容预览
        const previewDiv = document.createElement("div");
        previewDiv.className = "advanced-search-item-preview";
        if (result.type === "title") {
          // 标题匹配时, 显示开头的一点文本作为上下文
          const previewText = $tw.wiki.getTiddlerText(result.title) || "";
          previewDiv.textContent =
            previewText.substring(0, 100) +
            (previewText.length > 100 ? "..." : "");
        } else {
          // 内容匹配,高亮所有关键词
          previewDiv.appendChild(createHighlightedNodes(result.text, keyword));
        }

        header.appendChild(titleRow);
        header.appendChild(previewDiv);
        item.appendChild(header);

        // 点击事件
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          openTiddlerWithHighlight(result.title, keyword, result.matchIndices);
        });

        resultsContainer.appendChild(item);
      });
    };

    // 辅助函数：查找指定标题的 Tiddler Frame
    const findTiddlerFrame = (title) => {
      const tiddlerFrames = document.querySelectorAll(".tc-tiddler-frame");
      for (let i = 0; i < tiddlerFrames.length; i++) {
        const titleElement =
          tiddlerFrames[i].querySelector(".tc-tiddler-title");
        if (titleElement && titleElement.textContent.trim() === title) {
          return tiddlerFrames[i];
        }
      }
      return null;
    };

    // 清除现有的高亮和定时器
    const clearExistingHighlights = () => {
      if (fadeOutTimer) {
        clearTimeout(fadeOutTimer);
        fadeOutTimer = null;
      }
      if (removeTimer) {
        clearTimeout(removeTimer);
        removeTimer = null;
      }

      const highlights = document.querySelectorAll(".search-target-highlight");
      highlights.forEach((el) => {
        const parent = el.parentNode;
        if (parent) {
          const text = document.createTextNode(el.textContent);
          parent.replaceChild(text, el);
          parent.normalize();
        }
      });
    };

    // 在tiddler中高亮并滚动到关键词
    // needsNavigation: 如果是刚打开/展开的tiddler，可能需要更长的延迟来等待TW的滚动完成
    const highlightAndScrollInTiddler = (
      title,
      keyword,
      matchIndices,
      needsNavigation,
    ) => {
      // 每次开始高亮前，先清理之前的
      clearExistingHighlights();

      if (!keyword || !matchIndices || matchIndices.length === 0) return;

      let attempt = 0;
      const maxAttempts = 30; // 3秒超时

      const tryHighlight = () => {
        const targetFrame = findTiddlerFrame(title);

        // 还没渲染出来，继续等待
        if (!targetFrame) {
          if (attempt < maxAttempts) {
            attempt++;
            setTimeout(tryHighlight, 100);
          }
          return;
        }

        // 找到了Frame, 尝试获取内容区域
        let contentArea = targetFrame.querySelector(".tc-tiddler-body");

        // 如果没有内容区域(还在展开动画中?)，也视为还没准备好，除非它是非文本tiddler
        // 但简单起见，我们先尝试获取
        if (!contentArea) contentArea = targetFrame;

        const walker = document.createTreeWalker(
          contentArea,
          NodeFilter.SHOW_TEXT,
          null,
          false,
        );

        const allMatches = [];
        let node;
        while ((node = walker.nextNode())) {
          if (
            node.parentElement &&
            (node.parentElement.tagName === "SCRIPT" ||
              node.parentElement.tagName === "STYLE" ||
              node.parentElement.classList.contains("search-target-highlight")) // 防止重复高亮
          ) {
            continue;
          }

          const text = node.nodeValue;
          const lowerText = text.toLowerCase();
          const lowerKeyword = keyword.toLowerCase();
          let pos = 0;

          while (pos < text.length) {
            const index = lowerText.indexOf(lowerKeyword, pos);
            if (index === -1) break;
            allMatches.push({
              node: node,
              index: index,
              length: keyword.length,
            });
            pos = index + 1;
          }
        }

        // 如果内容是空的或者没找到匹配(可能是异步渲染/Transclusion)，再稍微等等
        if (allMatches.length === 0) {
          if (attempt < maxAttempts) {
            attempt++;
            setTimeout(tryHighlight, 100);
            return;
          }
          return;
        }

        // 收集此次点击需要高亮的匹配项
        const targets = [];
        matchIndices.forEach((idx) => {
          if (idx < allMatches.length) {
            targets.push(allMatches[idx]);
          }
        });

        // 按 Node 分组
        const matchesByNode = new Map();
        targets.forEach((match) => {
          if (!matchesByNode.has(match.node)) {
            matchesByNode.set(match.node, []);
          }
          matchesByNode.get(match.node).push(match);
        });

        let firstHighlight = null;

        matchesByNode.forEach((matches, node) => {
          // 对每个node内的matches按位置倒序
          matches.sort((a, b) => b.index - a.index);

          const parent = node.parentNode;
          if (!parent) return;

          let currentNode = node;

          matches.forEach((match) => {
            try {
              // splitText会改变DOM，所以必须倒序处理
              const matchNode = currentNode.splitText(match.index);
              const afterNode = matchNode.splitText(match.length);

              const span = document.createElement("span");
              span.className = "search-target-highlight";
              span.textContent = matchNode.textContent;

              parent.replaceChild(span, matchNode);

              firstHighlight = span;
            } catch (e) {
              console.error("Error highlighting", e);
            }
          });
        });

        if (firstHighlight) {
          const doScroll = () => {
            firstHighlight.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          };

          if (needsNavigation) {
            setTimeout(doScroll, 400);
          } else {
            doScroll();
          }

          // 淡化逻辑
          fadeOutTimer = setTimeout(() => {
            const highlights = document.querySelectorAll(
              ".search-target-highlight",
            );
            highlights.forEach((h) => h.classList.add("fade-out"));

            removeTimer = setTimeout(() => {
              // 移除高亮
              const highlights = document.querySelectorAll(
                ".search-target-highlight",
              );
              highlights.forEach((el) => {
                const parent = el.parentNode;
                if (parent) {
                  const text = document.createTextNode(el.textContent);
                  parent.replaceChild(text, el);
                  parent.normalize();
                }
              });
              // 重置定时器ID
              fadeOutTimer = null;
              removeTimer = null;
            }, 3000); // 3秒淡出
          }, 5000); // 5秒后开始淡出
        }
      };

      // 首次尝试
      tryHighlight();
    };

    const openTiddlerWithHighlight = (title, keyword, matchIndices = []) => {
      closeModal();

      // 检查Tiddler是否已经打开且展开
      const frame = findTiddlerFrame(title);
      const isFolded = frame && !frame.querySelector(".tc-tiddler-body");
      const needsNavigation = !frame || isFolded;

      // 只有在未打开或已折叠时才导航
      if (needsNavigation) {
        const story = new $tw.Story();
        story.navigateTiddler(title);
      }

      highlightAndScrollInTiddler(
        title,
        keyword,
        matchIndices,
        needsNavigation,
      );
    };

    // 键盘导航
    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }

      if (currentResults.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
        renderResults(currentKeyword);
        scrollToSelected();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        renderResults(currentKeyword);
        scrollToSelected();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0) {
          const res = currentResults[selectedIndex];
          openTiddlerWithHighlight(res.title, currentKeyword, res.matchIndices);
        }
      }
    };

    const scrollToSelected = () => {
      const selected = resultsContainer.querySelector(
        `.advanced-search-item[data-index="${selectedIndex}"]`,
      );
      if (selected) {
        selected.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };

    // 打开弹窗
    const openModal = () => {
      if (!overlay) {
        createModal();
      }
      document.body.appendChild(overlay);
      input.value = "";
      input.focus();
      selectedIndex = -1;
      currentResults = [];
      resultsContainer.innerHTML =
        '<div class="advanced-search-empty">Type to start searching</div>';
    };

    // 关闭弹窗
    const closeModal = () => {
      if (overlay && overlay.parentNode) {
        document.body.removeChild(overlay);
      }
    };

    // 监听 Ctrl+K
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        openModal();
      }
    });

    // 监听 tm-open-advanced-search 消息 (支持按钮调用)
    const registerMessage = () => {
      if ($tw.rootWidget) {
        $tw.rootWidget.addEventListener("tm-open-advanced-search", openModal);
      } else {
        setTimeout(registerMessage, 100);
      }
    };
    registerMessage();
  };
})();
