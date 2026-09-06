import type { DefaultSession } from "next-auth";

declare module "@auth/core/types" {
  interface User {
    githubLogin?: string;
  }

  interface Session {
    user: {
      id?: string;
      githubLogin?: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    githubLogin?: string;
  }
}
