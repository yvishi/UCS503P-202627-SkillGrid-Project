"use client";

import { useEffect } from "react";

// Strips the OAuth callback's ?github=connected|error (and evidenceId/
// username) query params from the URL once GithubConnectionBanner has read
// them -- mirrors what the onboarding wizard already does for its own
// callback params. Without this, refreshing, going back to, or bookmarking
// the dashboard/profile URL re-shows a stale "GitHub connected" banner
// indefinitely, since nothing else ever clears those params.
export function ClearGithubQueryParam() {
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  return null;
}
