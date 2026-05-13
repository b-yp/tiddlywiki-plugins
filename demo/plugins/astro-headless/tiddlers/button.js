/*\
title: $:/plugins/byper/astro-headless/button.js
type: application/javascript
module-type: widget
\*/

const Widget = require("$:/core/modules/widgets/widget.js").widget;

const ASTRO_ICON =
  '<svg width="20" height="20" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="vertical-align: middle;"><path d="M7.70883 25.5523C6.35819 24.3134 5.9639 21.7103 6.52661 19.8245C7.50233 21.0135 8.85426 21.3901 10.2546 21.6027C12.4164 21.9308 14.5395 21.8081 16.5477 20.8166C16.7774 20.7031 16.9897 20.5522 17.2407 20.3993C17.4292 20.9478 17.4782 21.5017 17.4124 22.0653C17.2524 23.4381 16.5716 24.4985 15.4887 25.3023C15.0557 25.6238 14.5975 25.9112 14.1503 26.2144C12.7765 27.1462 12.4048 28.2387 12.921 29.828C12.9333 29.8667 12.9443 29.9054 12.972 29.9999C12.2705 29.6849 11.7582 29.2263 11.3678 28.6232C10.9554 27.9867 10.7592 27.2826 10.7489 26.5208C10.7437 26.1501 10.7437 25.776 10.694 25.4106C10.5727 24.5195 10.1559 24.1205 9.37051 24.0975C8.56451 24.0739 7.92694 24.5739 7.75787 25.3613C7.74497 25.4217 7.72625 25.4814 7.70754 25.5516L7.70883 25.5523Z" fill="currentColor"></path><path d="M0 19.5103C0 19.5103 3.99947 17.5552 8.01012 17.5552L11.034 8.16461C11.1472 7.71047 11.4778 7.40185 11.8509 7.40185C12.2241 7.40185 12.5547 7.71047 12.6679 8.16461L15.6918 17.5552C20.4418 17.5552 23.7019 19.5103 23.7019 19.5103C23.7019 19.5103 16.9085 0.939907 16.8952 0.902648C16.7002 0.353607 16.3711 0 15.9273 0H7.77531C7.33154 0 7.01567 0.353607 6.80741 0.902648C6.79274 0.939204 0 19.5103 0 19.5103Z" fill="currentColor"></path></svg>';

class AstroBuildButton extends Widget {
  constructor(parseTreeNode, options) {
    super();
    this.initialise(parseTreeNode, options);
    this.state = "idle"; // idle, loading, success, error
  }

  render(parent, nextSibling) {
    this.parentDomNode = parent;
    this.computeAttributes();
    this.execute();

    const button = this.document.createElement("button");
    // 使用 TC 工具栏标准样式
    button.className = this.getAttribute(
      "class",
      "tc-btn-invisible tc-btn-mini",
    );
    button.title = "Build Astro Site";

    this.buttonNode = button;
    this.updateButtonLabel();

    button.onclick = async (e) => {
      e.preventDefault();
      if (this.state === "loading") return;

      this.state = "loading";
      this.updateButtonLabel();

      try {
        const response = await fetch("/api/astro-build", {
          method: "POST",
          headers: {
            "X-Requested-With": "TiddlyWiki",
          },
        });
        const result = await response.json();

        if (result.success) {
          this.state = "success";
        } else {
          this.state = "error";
          console.error("Build failed:", result.error);
        }
      } catch (err) {
        this.state = "error";
        console.error("API error:", err);
      }

      this.updateButtonLabel();
      setTimeout(() => {
        this.state = "idle";
        this.updateButtonLabel();
      }, 3000);
    };

    parent.insertBefore(button, nextSibling);
    this.domNodes.push(button);
  }

  updateButtonLabel() {
    if (!this.buttonNode) return;

    switch (this.state) {
      case "loading":
        this.buttonNode.innerHTML = "⏳";
        this.buttonNode.style.color = "#aaa";
        break;
      case "success":
        this.buttonNode.innerHTML = "✅";
        this.buttonNode.style.color = "#5cb85c";
        break;
      case "error":
        this.buttonNode.innerHTML = "❌";
        this.buttonNode.style.color = "#d9534f";
        break;
      default:
        this.buttonNode.innerHTML = ASTRO_ICON;
        this.buttonNode.style.color = "";
    }
  }
}

exports["astro-build-button"] = AstroBuildButton;
