/*\
title: $:/plugins/byper/publisher/api.js
type: application/javascript
module-type: route
\*/

(() => {
  exports.method = "POST";
  exports.path = /^\/api\/build$/;
  exports.csrfDisable = true;

  // ==================== 纯函数区域 ====================

  /**
   * 从Authorization header提取Basic认证凭据
   * @param {string} authHeader
   * @returns {Object|null} { username, password } 或 null
   */
  const extractCredentials = (authHeader) => {
    if (!authHeader.startsWith("Basic ")) return null;

    try {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
      const parts = decoded.split(":");
      return {
        username: parts[0],
        password: parts.slice(1).join(":"),
      };
    } catch (e) {
      return null;
    }
  };

  /**
   * 检查用户是否已认证
   * @param {Object} state - TiddlyWiki state对象
   * @param {Object|null} credentials - 提取的凭据
   * @param {string} expectedUsername - 期望的用户名
   * @param {string} expectedPassword - 期望的密码
   * @returns {boolean}
   */
  const isAuthenticated = (state, credentials, expectedUsername, expectedPassword) => {
    return (
      state.authenticatedUsername ||
      (credentials &&
        credentials.username === expectedUsername &&
        credentials.password === expectedPassword)
    );
  };

  /**
   * 认证中间件 - 验证请求权限
   * @param {Object} request
   * @param {Object} response
   * @param {Object} state
   * @returns {{ success: boolean, error?: string, credentials?: Object }}
   */
  const authenticateRequest = (request, response, state) => {
    const credentials = extractCredentials(request.headers.authorization || "");
    const expectedUsername = process.env.TW_USERNAME;
    const expectedPassword = process.env.TW_PASSWORD;

    const authenticated = isAuthenticated(state, credentials, expectedUsername, expectedPassword);

    console.log(
      "🐔 Authentication status:",
      authenticated,
      expectedUsername,
      expectedPassword,
      credentials,
    );

    if (!authenticated) {
      return { success: false, error: "Unauthorized" };
    }

    return { success: true, credentials };
  };

  // ==================== 构建执行函数 ====================

  /**
   * 执行构建命令
   * @param {string} wikiPath - 工作目录
   * @returns {Promise<{ success: boolean, stdout?: string, stderr?: string, error?: Error, startTime: Date, endTime: Date, duration: string }>}
   */
  const executeBuildCommand = (wikiPath) => {
    const child_process = require("child_process");
    const startTime = new Date();

    console.log("[Build API] Starting build at", startTime.toISOString());
    console.log("[Build API] Working directory:", wikiPath);
    console.log("[Build API] Executing build command...");

    return new Promise((resolve) => {
      child_process.exec(
        "bun run publish",
        {
          cwd: wikiPath,
          timeout: 120000, // 增加到 2 分钟，因为要 rsync
        },
        (error, stdout, stderr) => {
          const endTime = new Date();
          const duration = ((endTime - startTime) / 1000).toFixed(2);

          if (error) {
            console.error("[Build API] Build failed:", error);
            console.error("[Build API] stderr:", stderr);
            resolve({
              success: false,
              stdout,
              stderr,
              error,
              startTime,
              endTime,
              duration,
            });
          } else {
            console.log("[Build API] Build completed successfully");
            resolve({
              success: true,
              stdout,
              stderr,
              startTime,
              endTime,
              duration,
            });
          }
        }
      );
    });
  };

  // ==================== 日志处理函数 ====================

  /**
   * 分离构建输出和部署输出
   * @param {string} stdout
   * @returns {{ buildOutput: string[], deployOutput: string[] }}
   */
  const separateBuildOutput = (stdout) => {
    const outputLines = stdout.split("\n");
    const buildOutput = [];
    const deployOutput = [];
    let isDeploySection = false;

    outputLines.forEach((line) => {
      // rsync 输出通常包含这些特征
      if (
        line.match(/sending|sent|total size|speedup/) ||
        isDeploySection
      ) {
        isDeploySection = true;
        deployOutput.push(line);
      } else {
        buildOutput.push(line);
      }
    });

    return { buildOutput, deployOutput };
  };

  /**
   * 生成构建日志条目
   * @param {Date} startTime
   * @param {string} duration
   * @param {boolean} success
   * @param {string} stdout
   * @returns {string}
   */
  const generateLogEntry = (startTime, duration, success, stdout) => {
    let newLogEntry = "---\n\n";
    const buildTime = startTime.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    newLogEntry += `\n\n -----\n`;
    newLogEntry += `* Build time: \`${buildTime}\` \n\n`;
    newLogEntry += `* Duration: \`${duration} seconds\` \n\n`;
    newLogEntry += `* Status: \`${success ? "✅ Build successful" : "❌ Build failed"}\` \n\n`;

    if (success) {
      const { buildOutput, deployOutput } = separateBuildOutput(stdout);

      if (buildOutput.length > 0) {
        newLogEntry +=
          "!! Build output\n\n```\n" +
          buildOutput.join("\n").trim() +
          "\n```\n\n";
      }

      if (deployOutput.length > 0) {
        newLogEntry +=
          "!! Deployment output\n\n```\n" +
          deployOutput.join("\n").trim() +
          "\n```\n\n";
      } else {
        newLogEntry += "!! Full output\n\n```\n" + stdout + "\n```\n\n";
      }
    }

    return newLogEntry;
  };

  /**
   * 获取现有日志内容
   * @returns {string}
   */
  const getExistingLogContent = () => {
    const existingLog = $tw.wiki.getTiddler("$:/custom/build-publish-log");
    let existingText = existingLog ? existingLog.fields.text : "";

    // 移除"暂无日志"提示（如果存在）
    if (existingText.includes("No logs available")) {
      existingText = "";
    }

    return existingText;
  };

  /**
   * 限制历史记录数量
   * @param {string} logContent
   * @param {number} maxEntries
   * @returns {string}
   */
  const limitLogEntries = (logContent, maxEntries = 10) => {
    const logEntries = logContent
      .split("---\n\n")
      .filter((entry) => entry.trim().length > 0);

    if (logEntries.length > maxEntries) {
      return logEntries.slice(0, maxEntries).join("\n\n---\n\n");
    }

    return logContent;
  };

  /**
   * 保存日志到TiddlyWiki
   * @param {string} logContent
   */
  const saveLogToWiki = (logContent) => {
    $tw.wiki.addTiddler(
      new $tw.Tiddler({
        title: "$:/custom/build-publish-log",
        text: logContent,
        type: "text/vnd.tiddlywiki",
        modified: $tw.utils.stringifyDate(new Date()),
      })
    );
  };

  /**
   * 处理构建日志
   * @param {Object} buildResult - 构建结果
   * @returns {string} 新的完整日志内容
   */
  const processBuildLog = (buildResult) => {
    const { success, startTime, duration, stdout } = buildResult;
    const existingText = getExistingLogContent();
    const newLogEntry = generateLogEntry(startTime, duration, success, stdout);

    // 新日志放在最前面，保留旧日志
    let fullLogContent = newLogEntry + existingText;
    fullLogContent = limitLogEntries(fullLogContent);

    saveLogToWiki(fullLogContent);

    return fullLogContent;
  };

  // ==================== 响应处理函数 ====================

  /**
   * 发送错误响应
   * @param {Object} response
   * @param {number} statusCode
   * @param {string} error
   * @param {string} duration
   */
  const sendErrorResponse = (response, statusCode, error, duration) => {
    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        success: false,
        error,
        duration,
      })
    );
  };

  /**
   * 发送成功响应
   * @param {Object} response
   * @param {string} message
   * @param {string} duration
   * @param {string} output
   */
  const sendSuccessResponse = (response, message, duration, output) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        success: true,
        message,
        duration,
        output,
      })
    );
  };

  // ==================== 主处理函数 ====================

  exports.handler = async (request, response, state) => {
    // 认证检查
    const authResult = authenticateRequest(request, response, state);
    if (!authResult.success) {
      sendErrorResponse(response, 401, authResult.error, "0.00");
      return;
    }

    const path = require("path");
    const wikiPath = path.resolve(process.cwd());

    try {
      // 执行构建
      const buildResult = await executeBuildCommand(wikiPath);

      // 处理日志
      processBuildLog(buildResult);

      // 发送响应
      if (buildResult.success) {
        sendSuccessResponse(
          response,
          "Build completed successfully",
          buildResult.duration,
          buildResult.stdout
        );
      } else {
        sendErrorResponse(
          response,
          500,
          buildResult.stderr || buildResult.error?.message,
          buildResult.duration
        );
      }
    } catch (error) {
      console.error("[Build API] Unexpected error:", error);
      sendErrorResponse(response, 500, "Internal server error", "0.00");
    }
  };
})();
