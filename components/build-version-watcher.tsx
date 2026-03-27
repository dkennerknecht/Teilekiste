"use client";

import { useEffect, useRef } from "react";

async function fetchBuildVersion() {
  const res = await fetch("/api/runtime-version", { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { version?: string } | null;
  return data?.version || null;
}

export function BuildVersionWatcher() {
  const versionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkVersion() {
      const version = await fetchBuildVersion().catch(() => null);
      if (cancelled || !version) return;
      if (!versionRef.current) {
        versionRef.current = version;
        return;
      }
      if (versionRef.current !== version) {
        window.location.reload();
      }
    }

    checkVersion();

    const interval = window.setInterval(checkVersion, 30000);
    const onFocus = () => {
      checkVersion();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkVersion();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
