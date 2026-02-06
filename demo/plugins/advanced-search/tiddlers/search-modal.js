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

    // selectedIndex 现在是一个对象 { groupIndex: number, matchIndex: number }
    // matchIndex = -1 代表选中了 Group Header
    let selection = { groupIndex: -1, matchIndex: -1 };

    let currentResults = []; // Array of Group Objects
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

    // 显示空状态/提示信息 (替代 innerHTML)
    const showEmptyState = (text) => {
      if (!resultsContainer) return;
      resultsContainer.replaceChildren();
      const div = document.createElement("div");
      div.className = "advanced-search-empty";
      div.textContent = text;
      resultsContainer.appendChild(div);
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

    // 获取所有匹配的索引
    const getMatchIndices = (text, keyword) => {
      if (!text || !keyword) return [];
      const indices = [];
      let pos = 0;
      const lowerText = text.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();
      while (true) {
        const found = lowerText.indexOf(lowerKeyword, pos);
        if (found === -1) break;
        indices.push(found);
        pos = found + 1;
      }
      return indices;
    };

    // 辅助：清理文本用于比较 (移除非字母数字字符)
    const cleanText = (text) => {
      return text.replace(/[\W_]+/g, "").toLowerCase();
    };

    // 搜索
    const handleSearch = () => {
      const keyword = input.value.trim();
      currentKeyword = keyword;
      selection = { groupIndex: -1, matchIndex: -1 };

      if (!keyword) {
        showEmptyState("Type to start searching");
        currentResults = [];
        return;
      }

      const groups = [];

      $tw.wiki.each((tiddler, title) => {
        // 跳过系统tiddler
        if (title.startsWith("$:/")) return;

        const text = tiddler.fields.text || "";
        const titleLower = title.toLowerCase();
        const keywordLower = keyword.toLowerCase();

        const titleMatched = titleLower.indexOf(keywordLower) !== -1;

        // 存储当前tiddler的所有匹配项
        const matches = [];

        // 1. 标题匹配
        if (titleMatched) {
          // 标题匹配作为一个特殊的 Match Item
        }

        // 2. 内容匹配 - 按段落分组 separated by double newlines
        const blocks = text.split(/\n\n+/);

        blocks.forEach((blockText) => {
          const indices = getMatchIndices(blockText, keyword);

          if (indices.length > 0) {
            // 生成上下文 (Contexts)
            // UPDATE: 使用完整的 blockText 作为上下文，以便进行更严格的匹配 (Length check)
            const contexts = [blockText];

            matches.push({
              type: "content",
              text: blockText,
              contexts: contexts, // Store full block text
            });
          }
        });

        // 如果标题匹配 OR 有内容匹配
        if (titleMatched || matches.length > 0) {
          groups.push({
            title: title,
            modified: tiddler.fields.modified,
            matches: matches,
            titleMatched: titleMatched,
            expanded: true, // 默认展开
          });
        }
      });

      // 排序: 最新修改的在前
      groups.sort((a, b) => (b.modified || 0) - (a.modified || 0));

      currentResults = groups;

      if (currentResults.length === 0) {
        showEmptyState("No matches found");
        return;
      }

      renderResults();
    };

    // 智能截取 - 确保关键词在预览可视区域内
    const smartTruncate = (text, keyword) => {
      const maxLength = 150; // 预览显示的最大字符数 roughly
      if (text.length <= maxLength) return text;

      const lowerText = text.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();
      const index = lowerText.indexOf(lowerKeyword);

      if (index === -1) return text.substring(0, maxLength) + "...";

      // 如果关键词在开头附近
      if (index < 50) {
        return text.substring(0, maxLength) + "...";
      }

      // 关键词在中间或后面，需要截取
      const start = Math.max(0, index - 30); // 保留关键词前30个字符
      const end = Math.min(text.length, start + maxLength);

      let prefix = "...";
      if (start === 0) prefix = "";

      let suffix = "...";
      if (end >= text.length) suffix = "";

      return prefix + text.substring(start, end) + suffix;
    };

    // 渲染结果
    const renderResults = () => {
      resultsContainer.replaceChildren();

      currentResults.forEach((group, groupIndex) => {
        const groupDiv = document.createElement("div");
        groupDiv.className = "advanced-search-group";
        if (!group.expanded) {
          groupDiv.classList.add("collapsed");
        }

        // --- Header ---
        const header = document.createElement("div");
        header.className = "advanced-search-group-header";

        // 选中状态
        if (
          selection.groupIndex === groupIndex &&
          selection.matchIndex === -1
        ) {
          header.classList.add("selected");
        }

        // Toggle Icon
        const iconContainer = document.createElement("span");
        iconContainer.className = "advanced-search-toggle-icon";
        iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path></svg>`;

        // Icon click -> Toggle
        iconContainer.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent header click (open)
          group.expanded = !group.expanded;
          renderResults();
        });

        // Content Container (Title + Meta) -> Click to Open
        const contentContainer = document.createElement("div");
        contentContainer.className = "advanced-search-header-content";
        contentContainer.style.flex = "1";
        contentContainer.style.display = "flex";
        contentContainer.style.alignItems = "center";

        const titleSpan = document.createElement("span");
        titleSpan.className = "advanced-search-group-title";
        if (group.titleMatched) {
          titleSpan.appendChild(
            createHighlightedNodes(group.title, currentKeyword),
          );
        } else {
          titleSpan.textContent = group.title;
        }

        const metaSpan = document.createElement("span");
        metaSpan.className = "advanced-search-group-meta";
        if (group.modified) {
          const count = group.matches.length;
          const date = $tw.utils.formatDateString(group.modified, "YYYY-MM-DD");
          const countText =
            count > 0 ? `${count} matches • ` : "Title match • ";
          metaSpan.textContent = `${countText}${date}`;
        }

        contentContainer.appendChild(titleSpan);
        contentContainer.appendChild(metaSpan);

        // Header Content Click -> Open
        header.addEventListener("click", (e) => {
          openTiddlerWithHighlight(group.title, currentKeyword, []);
        });

        header.appendChild(iconContainer);
        header.appendChild(contentContainer);

        groupDiv.appendChild(header);

        // --- Body (Matches) ---
        const body = document.createElement("div");
        body.className = "advanced-search-group-body";

        // ONLY render matches if expanded
        if (group.expanded) {
          group.matches.forEach((match, matchIndex) => {
            const item = document.createElement("div");
            item.className = "advanced-search-match-item";

            // 选中状态
            if (
              selection.groupIndex === groupIndex &&
              selection.matchIndex === matchIndex
            ) {
              item.classList.add("selected");
            }

            const previewDiv = document.createElement("div");
            // CSS Truncation is still useful for safety, but we pre-truncate text now
            previewDiv.style.display = "-webkit-box";
            previewDiv.style.webkitLineClamp = "3";
            previewDiv.style.webkitBoxOrient = "vertical";
            previewDiv.style.overflow = "hidden";

            // FIX: Use smartTruncate to aim at the keyword
            const snippet = smartTruncate(match.text, currentKeyword);

            previewDiv.appendChild(
              createHighlightedNodes(snippet, currentKeyword),
            );
            item.appendChild(previewDiv);

            item.addEventListener("click", (e) => {
              e.stopPropagation();
              openTiddlerWithHighlight(
                group.title,
                currentKeyword,
                match.contexts, // Pass contexts!
              );
            });

            body.appendChild(item);
          });
        }

        groupDiv.appendChild(body);
        resultsContainer.appendChild(groupDiv);
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
    const highlightAndScrollInTiddler = (
      title,
      keyword,
      matchContexts, // Array of context strings
      needsNavigation,
    ) => {
      // 每次开始高亮前，先清理之前的
      clearExistingHighlights();

      if (!keyword) return;

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
              node.parentElement.classList.contains("search-target-highlight"))
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

            // Extract DOM context for verification
            // FIX: node.nodeValue is too short. Use parent block text.
            let contextSource = text; // Default fallback
            const parentBlock = node.parentElement.closest(
              "p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre",
            );
            if (parentBlock) {
              // If we found a block parent, use its text content which is much richer
              contextSource = parentBlock.textContent;
            } else if (node.parentElement) {
              contextSource = node.parentElement.textContent;
            }

            allMatches.push({
              node: node,
              index: index,
              length: keyword.length,
              context: contextSource, // Use the full block text as context
            });
            pos = index + 1;
          }
        }

        if (allMatches.length === 0) {
          if (attempt < maxAttempts) {
            attempt++;
            setTimeout(tryHighlight, 100);
            return;
          }
          return;
        }

        // Filter Matches using Context
        let targets = [];
        if (!matchContexts || matchContexts.length === 0) {
          // If no context provided (e.g. title click), maybe highlight first match?
          // Or highlight nothing? Let's highlight first for fallback.
          if (allMatches.length > 0) targets.push(allMatches[0]);
        } else {
          // Fuzzier matching: Check if cleaned contexts match
          const cleanContexts = matchContexts.map(cleanText);

          targets = allMatches.filter((domMatch) => {
            const cleanDom = cleanText(domMatch.context);
            if (!cleanDom) return false;

            // Check if ANY of the provided contexts match this DOM element strictly.
            // We use a combination of Inclusion + Length Check to prevent Header/Paragraph confusion.
            return cleanContexts.some((cleanCtx) => {
              if (!cleanCtx) return false;

              const lenA = cleanDom.length;
              const lenB = cleanCtx.length;

              // 长度差异不能太大 (e.g. < 20% or < 20 chars difference)
              // This filters out "Header inside Paragraph" (Para is much longer)
              const diffProps = Math.abs(lenA - lenB) / Math.max(lenA, lenB);

              // 允许 30% 的长度差异 (考虑到 wiki 语法被渲染成 html 后可能会变短)
              if (diffProps > 0.3) return false;

              // 内容包含检查
              return cleanCtx.includes(cleanDom) || cleanDom.includes(cleanCtx);
            });
          });

          // If strict filtering failed completely, fallback to first match?
          // User said "found two, highlighted zero". Better to highlight something.
          if (targets.length === 0 && allMatches.length > 0) {
            targets.push(allMatches[0]);
          }
        }

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

              // 记录第一个高亮用于滚动
              if (!firstHighlight) firstHighlight = span;
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

    const openTiddlerWithHighlight = (title, keyword, matchContexts = []) => {
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
        matchContexts,
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
        navigateSelection(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        navigateSelection(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleEnter();
      } else if (e.key === "ArrowLeft") {
        // Expand current group if header selected
        if (selection.groupIndex !== -1 && selection.matchIndex === -1) {
          e.preventDefault();
          const group = currentResults[selection.groupIndex];
          if (!group.expanded) {
            group.expanded = true;
            renderResults();
            scrollToSelected();
          }
        }
      } else if (e.key === "ArrowRight") {
        // Collapse current group if header selected
        if (selection.groupIndex !== -1 && selection.matchIndex === -1) {
          e.preventDefault();
          const group = currentResults[selection.groupIndex];
          if (group.expanded) {
            group.expanded = false;
            renderResults();
            scrollToSelected();
          }
        }
      }
    };

    const navigateSelection = (direction) => {
      // Flat list abstraction for navigation
      // We need to find the "next" or "previous" visible item
      // Items are: Header (G, -1), matches (G, 0), (G, 1)...
      // Note: if group is collapsed, matches are not visible.

      // Find current flat index
      let flatList = [];
      currentResults.forEach((group, gIndex) => {
        flatList.push({ gIndex, mIndex: -1 }); // Header
        if (group.expanded) {
          group.matches.forEach((_, mIndex) => {
            flatList.push({ gIndex, mIndex });
          });
        }
      });

      let currentFlatIndex = -1;
      // Check if selection is valid
      if (selection.groupIndex !== -1) {
        currentFlatIndex = flatList.findIndex(
          (item) =>
            item.gIndex === selection.groupIndex &&
            item.mIndex === selection.matchIndex,
        );
      }

      // If selection is invalid (e.g. collapsed group made current selection invisible),
      // try to find the group header of the selected group?
      if (currentFlatIndex === -1 && selection.groupIndex !== -1) {
        // Fallback: select header of current group
        currentFlatIndex = flatList.findIndex(
          (item) => item.gIndex === selection.groupIndex && item.mIndex === -1,
        );
      }

      let newFlatIndex = currentFlatIndex + direction;

      // Boundaries
      if (newFlatIndex < 0) newFlatIndex = 0;
      if (newFlatIndex >= flatList.length) newFlatIndex = flatList.length - 1;

      if (flatList.length > 0) {
        const nextItem = flatList[newFlatIndex];
        selection = {
          groupIndex: nextItem.gIndex,
          matchIndex: nextItem.mIndex,
        };
        renderResults();
        scrollToSelected();
      }
    };

    const handleEnter = () => {
      if (selection.groupIndex === -1) return;

      const group = currentResults[selection.groupIndex];

      if (selection.matchIndex === -1) {
        // Header selected -> Open Tiddler
        // User said: "We also click title to jump to tiddler"
        openTiddlerWithHighlight(group.title, currentKeyword, []);
      } else {
        // Match item selected
        const match = group.matches[selection.matchIndex];
        openTiddlerWithHighlight(group.title, currentKeyword, match.contexts);
      }
    };

    const scrollToSelected = () => {
      const selected = resultsContainer.querySelector(".selected");
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
      selection = { groupIndex: -1, matchIndex: -1 };
      currentResults = [];
      showEmptyState("Type to start searching");
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
