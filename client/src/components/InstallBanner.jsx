import React, { useEffect, useState } from "react";

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}
function isStandaloneNow() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [standalone, setStandalone] = useState(isStandaloneNow());
  const [dismissed, setDismissed] = useState(false); // resets every fresh page load on purpose

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onInstalled() {
      setStandalone(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || dismissed) return null;

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setStandalone(true);
    setDeferredPrompt(null);
  }

  const ios = isIOS();
  const message = deferredPrompt
    ? "Install this app for one-tap access from your home screen."
    : ios
    ? 'Add to your home screen: tap Share, then "Add to Home Screen."'
    : "Add this app to your home screen from your browser menu for one-tap access.";

  return (
    <div className="install-banner">
      <div className="install-banner-text">{message}</div>
      <div className="install-banner-actions">
        {deferredPrompt && (
          <button className="install-banner-btn" onClick={handleInstallClick}>Install</button>
        )}
        <button className="install-banner-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss">&times;</button>
      </div>
    </div>
  );
}
