/*\
title: $:/plugins/byper/image-preview/script.js
type: application/javascript
module-type: startup

TiddlyWiki 原生图片预览插件
\*/

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

// 类名常量
const PROCESSED_CLASS = "tc-image-processed";
const PREVIEW_ACTIVE_CLASS = "tc-image-preview-active";

// 集中式状态管理
const state = {
  modal: null,
  current: {
    image: null,
    index: -1,
    scale: 1,
  },
  drag: {
    active: false,
    startX: 0,
    startY: 0,
    translateX: 0,
    translateY: 0,
  },
  config: {
    maxScale: 3,
    minScale: 0.5,
    scaleStep: 0.25,
  },
  images: [],
};

/**
 * 工具函数：创建按钮元素
 */
const createButton = (className, iconNode, title, onClick) => {
  const btn = document.createElement("button");
  btn.className = className;
  if (iconNode) {
    btn.appendChild(iconNode);
  }
  btn.title = title;
  btn.addEventListener("click", onClick);
  return btn;
};

// 辅助：更通用的 SVG 创建，直接传入 path 属性对象
const createSvg = (paths) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("viewBox", "0 0 16 16");

  paths.forEach((attrs) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    for (const [key, value] of Object.entries(attrs)) {
      path.setAttribute(key, value);
    }
    svg.appendChild(path);
  });
  return svg;
};

/**
 * 创建预览模态框（如果不存在）
 */
const createPreviewModal = () => {
  if (state.modal) return state.modal;

  // 创建模态框容器
  const modal = document.createElement("div");
  modal.className = "tc-image-preview-modal";

  // 定义图标数据
  const icons = {
    close: [
      {
        d: "M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708",
      },
    ],
    zoomOut: [
      { d: "M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8" },
    ],
    reset: [
      {
        "fill-rule": "evenodd",
        d: "M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z",
      },
      {
        d: "M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466",
      },
    ],
    zoomIn: [
      {
        d: "M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4",
      },
    ],
    prev: [
      {
        "fill-rule": "evenodd",
        d: "M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0",
      },
    ],
    next: [
      {
        "fill-rule": "evenodd",
        d: "M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708",
      },
    ],
  };

  // 创建元素
  const closeBtn = createButton(
    "tc-image-preview-close",
    createSvg(icons.close),
    "关闭 (ESC)",
    closePreview,
  );

  const content = document.createElement("div");
  content.className = "tc-image-preview-content";

  const img = document.createElement("img");
  img.className = "tc-image-preview-img";

  const controls = document.createElement("div");
  controls.className = "tc-image-preview-controls";

  const zoomOutBtn = createButton(
    "tc-image-preview-btn",
    createSvg(icons.zoomOut),
    "缩小",
    () => adjustScale(-state.config.scaleStep),
  );
  const resetBtn = createButton(
    "tc-image-preview-btn",
    createSvg(icons.reset),
    "重置缩放",
    resetScale,
  );
  const zoomInBtn = createButton(
    "tc-image-preview-btn",
    createSvg(icons.zoomIn),
    "放大",
    () => adjustScale(state.config.scaleStep),
  );

  const zoomText = document.createElement("div");
  zoomText.className = "tc-image-preview-zoom-text";

  const navigation = document.createElement("div");
  navigation.className = "tc-image-preview-navigation";

  const prevBtn = createButton(
    "tc-image-preview-nav-btn",
    createSvg(icons.prev),
    "上一张 (←)",
    showPreviousImage,
  );
  const nextBtn = createButton(
    "tc-image-preview-nav-btn",
    createSvg(icons.next),
    "下一张 (→)",
    showNextImage,
  );

  // 组装元素
  controls.appendChild(zoomOutBtn);
  controls.appendChild(resetBtn);
  controls.appendChild(zoomInBtn);

  navigation.appendChild(prevBtn);
  navigation.appendChild(nextBtn);

  content.appendChild(img);
  modal.appendChild(closeBtn);
  modal.appendChild(content);
  modal.appendChild(controls);
  modal.appendChild(zoomText);
  modal.appendChild(navigation);
  document.body.appendChild(modal);

  // 事件：点击外部区域关闭
  modal.addEventListener("click", (event) => {
    const isInteractive = event.target.closest(
      ".tc-image-preview-img, .tc-image-preview-btn, .tc-image-preview-nav-btn, .tc-image-preview-close",
    );
    if (!isInteractive) closePreview();
  });

  // 事件：鼠标滚轮缩放（基于鼠标位置）
  content.addEventListener("wheel", (event) => {
    event.preventDefault();
    const delta =
      event.deltaY > 0 ? -state.config.scaleStep : state.config.scaleStep;
    adjustScaleAtPoint(delta, event.clientX, event.clientY);
  });

  // 事件：拖动平移（移除缩放限制，允许自由拖动）
  img.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();

    state.drag.active = true;
    state.drag.startX = event.clientX - state.drag.translateX;
    state.drag.startY = event.clientY - state.drag.translateY;
    state.modal.img.style.cursor = "grabbing";
    // 禁用transition以提升拖动流畅度
    state.modal.img.style.transition = "none";

    const handleMouseMove = (moveEvent) => {
      if (!state.drag.active) return;
      state.drag.translateX = moveEvent.clientX - state.drag.startX;
      state.drag.translateY = moveEvent.clientY - state.drag.startY;
      // 优化性能：直接更新 transform，不调用完整的 updatePreviewImage()
      state.modal.img.style.transform = `translate(${state.drag.translateX}px, ${state.drag.translateY}px) scale(${state.current.scale})`;
    };

    const handleMouseUp = () => {
      state.drag.active = false;
      state.modal.img.style.cursor = "grab";
      // 恢复transition
      state.modal.img.style.transition = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });

  // 存储引用
  state.modal = {
    element: modal,
    img: img,
    zoomText: zoomText,
    prevBtn: prevBtn,
    nextBtn: nextBtn,
  };

  // 设置初始按钮状态
  prevBtn.classList.add("hidden");
  nextBtn.classList.add("hidden");

  return state.modal;
};

/**
 * 处理键盘快捷键
 */
const handleKeyDown = (event) => {
  if (!state.modal || !state.modal.element.classList.contains("active")) return;

  switch (event.key) {
    case "Escape":
      closePreview();
      break;
    case "ArrowLeft":
      showPreviousImage();
      break;
    case "ArrowRight":
      showNextImage();
      break;
    case "+":
    case "=":
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        adjustScale(state.config.scaleStep);
      }
      break;
    case "-":
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        adjustScale(-state.config.scaleStep);
      }
      break;
    case "0":
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        resetScale();
      }
      break;
  }
};

/**
 * 调整图片缩放（中心点）
 */
const adjustScale = (delta) => {
  if (!state.modal || !state.current.image) return;
  state.current.scale = Math.max(
    state.config.minScale,
    Math.min(state.config.maxScale, state.current.scale + delta),
  );
  updatePreviewImage();
};

/**
 * 基于指定点调整图片缩放
 */
const adjustScaleAtPoint = (delta, mouseX, mouseY) => {
  if (!state.modal || !state.current.image) return;

  const img = state.modal.img;
  const rect = img.getBoundingClientRect();

  // 计算鼠标相对于图片中心的位置
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const offsetX = mouseX - centerX;
  const offsetY = mouseY - centerY;

  // 保存旧的缩放比例
  const oldScale = state.current.scale;

  // 计算新的缩放比例
  const newScale = Math.max(
    state.config.minScale,
    Math.min(state.config.maxScale, state.current.scale + delta),
  );

  // 如果缩放比例没有变化，直接返回
  if (newScale === oldScale) return;

  // 计算缩放比例的变化
  const scaleRatio = newScale / oldScale;

  // 调整平移以保持鼠标位置不变
  state.drag.translateX = state.drag.translateX - offsetX * (scaleRatio - 1);
  state.drag.translateY = state.drag.translateY - offsetY * (scaleRatio - 1);

  // 更新缩放比例
  state.current.scale = newScale;

  updatePreviewImage();
};

/**
 * 重置缩放为 1
 */
const resetScale = () => {
  state.current.scale = 1;
  state.drag.translateX = 0;
  state.drag.translateY = 0;
  updatePreviewImage();
};

/**
 * 更新预览图片显示
 */
const updatePreviewImage = () => {
  if (!state.modal || !state.current.image) return;

  state.modal.img.style.transform = `translate(${state.drag.translateX}px, ${state.drag.translateY}px) scale(${state.current.scale})`;
  state.modal.zoomText.textContent = `${Math.round(state.current.scale * 100)}%`;

  // 更新鼠标样式（现在任何缩放级别都可以拖动）
  state.modal.img.style.cursor = state.drag.active ? "grabbing" : "grab";

  // 更新导航按钮
  state.modal.prevBtn.classList.toggle("hidden", state.current.index <= 0);
  state.modal.nextBtn.classList.toggle(
    "hidden",
    state.current.index >= state.images.length - 1,
  );
};

/**
 * 显示上一张图片
 */
const showPreviousImage = () => {
  if (state.current.index > 0) {
    showImageAtIndex(state.current.index - 1);
  }
};

/**
 * 显示下一张图片
 */
const showNextImage = () => {
  if (state.current.index < state.images.length - 1) {
    showImageAtIndex(state.current.index + 1);
  }
};

/**
 * 显示指定索引的图片
 */
const showImageAtIndex = (index) => {
  if (index < 0 || index >= state.images.length) return;

  state.current.index = index;
  state.current.image = state.images[index];
  // 每次切换图片都重置为默认状态
  state.current.scale = 1;
  state.drag.translateX = 0;
  state.drag.translateY = 0;

  if (!state.modal) createPreviewModal();

  state.modal.img.src = state.current.image.src;
  state.modal.img.alt = state.current.image.alt || "";

  updatePreviewImage();
};

/**
 * 打开指定图片的预览
 */
const openPreview = (imgElement) => {
  if (!imgElement || !imgElement.src) return;

  // 收集页面上的所有图片
  state.images = Array.from(document.querySelectorAll("img")).filter(
    (img) => img.src && !img.classList.contains("tc-image-preview-img"),
  );

  state.current.index = state.images.findIndex((img) => img === imgElement);
  if (state.current.index === -1) return;

  state.current.image = imgElement;
  // 每次打开都重置为默认状态
  state.current.scale = 1;
  state.drag.translateX = 0;
  state.drag.translateY = 0;

  if (!state.modal) createPreviewModal();

  state.modal.element.classList.add("active");
  state.modal.img.src = state.current.image.src;
  state.modal.img.alt = state.current.image.alt || "";

  updatePreviewImage();
  document.body.classList.add(PREVIEW_ACTIVE_CLASS);
};

/**
 * 关闭预览模态框
 */
const closePreview = () => {
  if (!state.modal) return;

  state.modal.element.classList.remove("active");
  document.body.classList.remove(PREVIEW_ACTIVE_CLASS);
  state.current.image = null;
  // 重置所有状态
  state.current.scale = 1;
  state.drag.translateX = 0;
  state.drag.translateY = 0;
};

/**
 * 处理图片并添加点击处理器
 */
const processImages = () => {
  const unprocessedImages = document.querySelectorAll(
    `img:not(.${PROCESSED_CLASS})`,
  );

  unprocessedImages.forEach((img) => {
    img.classList.add(PROCESSED_CLASS);

    if (!img.src || img.src.trim() === "") return;

    img.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPreview(img);
    });

    img.style.cursor = "zoom-in";
  });
};

/**
 * 初始化插件
 */
const initializePlugin = () => {
  // 初始处理
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", processImages);
  } else {
    processImages();
  }

  // TiddlyWiki 钩子
  if ($tw && $tw.hooks) {
    $tw.hooks.addHook("th-rendering-tiddler", () => {
      setTimeout(processImages, 50);
    });
  }

  // 带防抖的 MutationObserver
  let processTimeout;
  const debouncedProcess = () => {
    clearTimeout(processTimeout);
    processTimeout = setTimeout(processImages, 100);
  };

  const observer = new MutationObserver((mutations) => {
    const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
    if (hasNewNodes) debouncedProcess();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 键盘快捷键
  document.addEventListener("keydown", handleKeyDown);
};

// 导出启动模块
exports.name = "image-preview";
exports.platforms = ["browser"];
exports.after = ["render"];
exports.synchronous = true;
exports.startup = initializePlugin;
