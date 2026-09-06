import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { error: "/" },
  providers: [
    GitHub({
      authorization: { params: { scope: "read:user repo" } },
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          githubLogin: profile.login,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.githubLogin = user.githubLogin;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.githubLogin = token.githubLogin;
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

/**
 * Looks up the signed-in user's stored GitHub OAuth access token
 * (data-model.md `Account.access_token`) for making authenticated GitHub API
 * calls on their behalf. Never exposed to the client - server-only.
 */
export async function getGitHubAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" },
  });
  return account?.access_token ?? null;
}
