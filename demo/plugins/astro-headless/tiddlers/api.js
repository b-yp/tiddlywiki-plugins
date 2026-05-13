/*\
title: $:/plugins/byper/astro-headless/api.js
type: application/javascript
module-type: route
\*/

(() => {
  exports.method = "POST";
  exports.path = /^\/api\/astro-build$/;
  exports.csrfDisable = true;

  const child_process = require("child_process");
  const path = require("path");

  /**
   * 执行构建命令
   */
  const executeCommand = (cmd, options) => {
    return new Promise((resolve) => {
      console.log(`[Astro Build] Executing: ${cmd}`);
      child_process.exec(cmd, options, (error, stdout, stderr) => {
        resolve({
          success: !error,
          stdout,
          stderr,
          error,
        });
      });
    });
  };

  exports.handler = async (request, response, state) => {
    const wikiPath = process.cwd();
    // 假设在根目录下执行 bun run publish
    // 如果 demo 是子目录，根目录在 ../
    const rootPath = path.resolve(wikiPath);
    const startTime = new Date();

    console.log(
      "[Astro Build] Starting build process via 'bun run publish'...",
    );

    try {
      // 直接调用根目录的 publish 脚本，它已经包含了 build:astro 和 blog:build
      const buildResult = await executeCommand("bun run publish", {
        cwd: rootPath,
      });

      const endTime = new Date();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      // 保存详细日志到 Tiddler
      const logText =
        `!! Build Log (${startTime.toLocaleString()})\n\n` +
        `* Duration: \`${duration}s\`\n` +
        `* Status: ${buildResult.success ? "✅ Success" : "❌ Failed"}\n\n` +
        `!!! Stdout\n\`\`\`\n${buildResult.stdout}\n\`\`\`\n\n` +
        `!!! Stderr\n\`\`\`\n${buildResult.stderr}\n\`\`\``;

      $tw.wiki.addTiddler(
        new $tw.Tiddler({
          title: "$:/plugins/byper/astro-headless/log",
          text: logText,
          type: "text/vnd.tiddlywiki",
          modified: $tw.utils.stringifyDate(new Date()),
        }),
      );

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          success: buildResult.success,
          duration,
          message: buildResult.success
            ? "Build completed successfully"
            : "Build failed",
        }),
      );
    } catch (error) {
      console.error("[Astro Build] Error:", error);
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
      );
    }
  };
})();
