import React, { useState } from "react";
import { setStoredPasscode } from "../api.js";

const PIN_LENGTH = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export default function Lock({ onUnlock }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function tryUnlock(code) {
    setChecking(true);
    setError(false);
    setStoredPasscode(code);
    try {
      const res = await fetch("/api/settings", { headers: { "x-app-passcode": code } });
      if (res.status === 401) {
        setError(true);
        setDigits("");
        setStoredPasscode("");
      } else {
        onUnlock();
        return;
      }
    } catch (e) {
      setError(true);
    } finally {
      setChecking(false);
    }
  }

  function press(key) {
    if (checking || key === "") return;
    if (key === "back") {
      setDigits((d) => d.slice(0, -1));
      setError(false);
      return;
    }
    if (digits.length >= PIN_LENGTH) return;
    const next = digits + key;
    setDigits(next);
    setError(false);
    if (next.length === PIN_LENGTH) tryUnlock(next);
  }

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-title">Enter passcode</div>
        <div className="lock-dots">
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={"lock-dot" + (i < digits.length ? " filled" : "") + (error ? " err" : "")} />
          ))}
        </div>
        <div className="lock-error">{error ? "Incorrect passcode, try again" : "\u00A0"}</div>
        <div className="lock-pad">
          {KEYS.map((k, i) => (
            <button
              key={i}
              className={"lock-key" + (k === "" ? " lock-key-empty" : "") + (k === "back" ? " lock-key-back" : "")}
              onClick={() => press(k)}
              disabled={k === "" || checking}
            >
              {k === "back" ? "\u232B" : k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
