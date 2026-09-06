"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-9 w-24 rounded-md bg-neutral-900" />;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        {session.user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt={session.user.githubLogin ?? session.user.name ?? "avatar"}
            className="h-7 w-7 rounded-full"
          />
        )}
        <span className="text-sm text-neutral-300">{session.user.githubLogin ?? session.user.name}</span>
        <button
          onClick={() => signOut()}
          className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-500"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("github")}
      className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm hover:border-neutral-500"
    >
      Sign in with GitHub
    </button>
  );
}
