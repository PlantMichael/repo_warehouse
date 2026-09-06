"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  AccessDenied: "Sign-in wasn't completed - the GitHub authorization was cancelled or denied.",
  OAuthCallback: "Sign-in wasn't completed - GitHub's response could not be processed. Please try again.",
  OAuthSignin: "Sign-in wasn't completed - couldn't start the GitHub authorization flow. Please try again.",
  OAuthAccountNotLinked: "Sign-in wasn't completed - this GitHub account is already linked differently.",
  Configuration: "Sign-in isn't configured correctly on this server.",
};

function Banner() {
  const params = useSearchParams();
  const error = params.get("error");
  if (!error) return null;

  const message = MESSAGES[error] ?? "Sign-in wasn't completed. Please try again.";

  return (
    <div className="border-b border-amber-900/50 bg-amber-950/40 text-amber-200 text-sm px-4 py-2 text-center">
      {message}
    </div>
  );
}

export default function SignInErrorBanner() {
  return (
    <Suspense fallback={null}>
      <Banner />
    </Suspense>
  );
}
