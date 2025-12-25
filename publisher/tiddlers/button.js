/*\
title: $:/plugins/byper/publisher/button.js
type: application/javascript
module-type: widget
\*/

const Widget = require("$:/core/modules/widgets/widget.js").widget;
const SVG_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#000000" viewBox="0 0 256 256"><path d="M227.32,28.68a16,16,0,0,0-15.66-4.08l-.15,0L19.57,82.84a16,16,0,0,0-2.49,29.8L102,154l41.3,84.87A15.86,15.86,0,0,0,157.74,248q.69,0,1.38-.06a15.88,15.88,0,0,0,14-11.51l58.2-191.94c0-.05,0-.1,0-.15A16,16,0,0,0,227.32,28.68ZM157.83,231.85l-.05.14,0-.07-40.06-82.3,48-48a8,8,0,0,0-11.31-11.31l-48,48L24.08,98.25l-.07,0,.14,0L216,40Z"></path></svg>';

// ==================== 配置常量 ====================
const CONFIG = {
  SUCCESS_COLOR: "#5cb85c",
  ERROR_COLOR: "#d9534f",
  RESET_DELAY_MS: 2000,
  API_PATH: "/api/build",
  BUTTON_TITLE: "Build static HTML",
  BUTTON_CLASS: "tc-btn-invisible tc-tiddlylink",
};

// ==================== 按钮状态枚举 ====================
const BUTTON_STATE = {
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
  FAILURE: "failure",
  ERROR: "error",
};

// ==================== 纯函数区域 ====================

/**
 * 创建按钮元素
 * @param {Document} document - DOM文档对象
 * @returns {HTMLButtonElement}
 */
const createButtonElement = (document) => {
  const button = document.createElement("button");
  button.className = CONFIG.BUTTON_CLASS;
  button.innerHTML = SVG_ICON;
  button.title = CONFIG.BUTTON_TITLE;
  return button;
};

/**
 * 更新按钮状态
 * @param {HTMLButtonElement} button - 按钮元素
 * @param {string} state - 按钮状态
 * @param {string} originalHTML - 原始HTML内容（用于重置）
 */
const updateButtonState = (button, state, originalHTML) => {
  switch (state) {
    case BUTTON_STATE.LOADING:
      button.textContent = "⏳ Publishing...";
      button.disabled = true;
      button.style.color = "";
      break;

    case BUTTON_STATE.SUCCESS:
      button.textContent = "✅ Success";
      button.style.color = CONFIG.SUCCESS_COLOR;
      break;

    case BUTTON_STATE.FAILURE:
      button.textContent = "❌ Failed";
      button.style.color = CONFIG.ERROR_COLOR;
      break;

    case BUTTON_STATE.ERROR:
      button.textContent = "❌ Error";
      button.style.color = CONFIG.ERROR_COLOR;
      break;

    case BUTTON_STATE.IDLE:
    default:
      button.innerHTML = originalHTML;
      button.disabled = false;
      button.style.color = "";
      break;
  }
};

/**
 * 重置按钮到初始状态
 * @param {HTMLButtonElement} button - 按钮元素
 * @param {string} originalHTML - 原始HTML内容
 */
const resetButton = (button, originalHTML) => {
  updateButtonState(button, BUTTON_STATE.IDLE, originalHTML);
};

/**
 * 显示提示信息
 * @param {string} message - 消息内容
 * @param {boolean} isError - 是否为错误消息
 */
const showAlert = (message, isError = true) => {
  alert(`${isError ? "Publish failed: " : ""}${message}`);
};

/**
 * 执行构建API调用
 * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
 */
const executeBuildApi = async () => {
  try {
    const response = await fetch(CONFIG.API_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-Requested-With": "TiddlyWiki",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return { success: true, data: await response.json() };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
};

/**
 * 处理API响应
 * @param {HTMLButtonElement} button - 按钮元素
 * @param {string} originalHTML - 原始HTML内容
 * @param {{ success: boolean, data?: any, error?: string }} result - API结果
 */
const handleApiResponse = (button, originalHTML, result) => {
  if (!result.success) {
    // API调用失败（网络错误、HTTP错误等）
    updateButtonState(button, BUTTON_STATE.FAILURE, originalHTML);
    showAlert(result.error || "Unknown error");
    setTimeout(() => {
      resetButton(button, originalHTML);
    }, CONFIG.RESET_DELAY_MS);
    return;
  }

  // API调用成功，但需要检查业务逻辑是否成功
  const apiData = result.data;
  if (apiData && apiData.success) {
    // 构建成功
    updateButtonState(button, BUTTON_STATE.SUCCESS, originalHTML);
    setTimeout(() => {
      resetButton(button, originalHTML);
    }, CONFIG.RESET_DELAY_MS);
  } else {
    // 构建失败（业务逻辑失败）
    updateButtonState(button, BUTTON_STATE.FAILURE, originalHTML);
    showAlert(apiData?.error || "Build failed");
    setTimeout(() => {
      resetButton(button, originalHTML);
    }, CONFIG.RESET_DELAY_MS);
  }
};

/**
 * 处理API错误
 * @param {HTMLButtonElement} button - 按钮元素
 * @param {string} originalHTML - 原始HTML内容
 * @param {Error} error - 错误对象
 */
const handleApiError = (button, originalHTML, error) => {
  updateButtonState(button, BUTTON_STATE.ERROR, originalHTML);
  showAlert(error.message);
  setTimeout(() => {
    resetButton(button, originalHTML);
  }, CONFIG.RESET_DELAY_MS);
};

/**
 * 创建按钮点击事件处理器
 * @param {HTMLButtonElement} button - 按钮元素
 * @returns {Function} 点击事件处理函数
 */
const createButtonClickHandler = (button) => {
  const originalHTML = SVG_ICON;

  return async (event) => {
    event.preventDefault();

    // 设置为加载状态
    updateButtonState(button, BUTTON_STATE.LOADING, originalHTML);

    try {
      const result = await executeBuildApi();
      handleApiResponse(button, originalHTML, result);
    } catch (error) {
      handleApiError(button, originalHTML, error);
    }
  };
};

class PublishButton extends Widget {
  constructor(parseTreeNode, options) {
    super();
    this.initialise(parseTreeNode, options);
  }

  render(parent, nextSibling) {
    this.parentDomNode = parent;

    // 创建按钮元素
    const button = createButtonElement(this.document);

    // 设置点击事件处理器
    button.onclick = createButtonClickHandler(button);

    // 插入DOM并记录节点
    parent.insertBefore(button, nextSibling);
    this.domNodes.push(button);
  }
}

exports["publisher-button"] = PublishButton;
