/*\
title: $:/plugins/byper/blur-lock/startup.js
type: application/javascript
module-type: startup

Startup logic for Blur Lock plugin. Handles password messages and dynamic DOM classes.
\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.name = "blur-lock-startup";
exports.platforms = ["browser"];
exports.after = ["startup"];
exports.synchronous = true;

exports.startup = function() {
    // Message listeners
    $tw.rootWidget.addEventListener("tm-blurlock-change-password", handlePasswordChange);
    $tw.rootWidget.addEventListener("tm-blurlock-validate-unlock", handleValidateUnlock);

    // Dynamic class management
    var observer = new MutationObserver(updateAllTiddlerClasses);
    observer.observe(document.body, { childList: true, subtree: true });
    
    $tw.wiki.addEventListener("change", function(changes) {
        if(changes["$:/state/byper/blur-lock/unlocked"]) {
            updateAllTiddlerClasses();
        }
    });

    function updateAllTiddlerClasses() {
        var isUnlocked = $tw.wiki.getTiddlerText("$:/state/byper/blur-lock/unlocked") === "yes";
        var frames = document.querySelectorAll(".tc-tiddler-frame");
        for(var i=0; i<frames.length; i++) {
            var title = frames[i].getAttribute("data-tiddler-title");
            if(title) {
                var tiddler = $tw.wiki.getTiddler(title);
                var hasLockTag = tiddler && tiddler.hasTag("lock");
                if(hasLockTag && !isUnlocked) {
                    frames[i].classList.add("tc-blur-lock-active");
                } else {
                    frames[i].classList.remove("tc-blur-lock-active");
                }
            }
        }
    }
};

function handlePasswordChange(event) {
    var oldPassword = event.paramObject.oldPassword || "";
    var newPassword = event.paramObject.newPassword || "";
    var storedHash = $tw.wiki.getTiddlerText("$:/config/byper/blur-lock/password-hash", "");
    if(!window.crypto || !window.crypto.subtle) return alert("Crypto API not available (requires HTTPS or localhost)");

    var verifyPromise = storedHash ? hashString(oldPassword) : Promise.resolve("");
    verifyPromise.then(function(oldHash) {
        if(!storedHash || oldHash === storedHash) {
            return hashString(newPassword).then(function(newHash) {
                $tw.wiki.setText("$:/config/byper/blur-lock/password-hash", "text", null, newHash);
                clearTemps();
                $tw.rootWidget.dispatchEvent({type: "tm-notify", param: "$:/plugins/byper/blur-lock/notify/success"});
            });
        } else {
            $tw.rootWidget.dispatchEvent({type: "tm-notify", param: "$:/plugins/byper/blur-lock/notify/wrong-old-password"});
        }
    });
}

function handleValidateUnlock(event) {
    var input = event.paramObject.password || "";
    var storedHash = $tw.wiki.getTiddlerText("$:/config/byper/blur-lock/password-hash", "");
    hashString(input).then(function(hash) {
        if(hash === storedHash) {
            $tw.wiki.setText("$:/state/byper/blur-lock/unlocked", "text", null, "yes");
            $tw.wiki.setText("$:/temp/byper/blur-lock/password", "text", null, "");
        } else {
            $tw.rootWidget.dispatchEvent({type: "tm-notify", param: "$:/plugins/byper/blur-lock/notify/wrong-password"});
        }
    });
}

function clearTemps() {
    $tw.wiki.setText("$:/temp/byper/blur-lock/old-password", "text", null, "");
    $tw.wiki.setText("$:/temp/byper/blur-lock/new-password", "text", null, "");
    $tw.wiki.setText("$:/temp/byper/blur-lock/confirm-password", "text", null, "");
}

function hashString(str) {
    var encoder = new TextEncoder();
    var data = encoder.encode(str);
    return window.crypto.subtle.digest('SHA-256', data).then(function(hashBuffer) {
        var hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
}

})();
