/**
 * Auth.js v5 Configuration
 *
 * Providers:
 * - Resend (Email Link)
 */

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { NextAuthConfig, User } from "next-auth";
import type { Adapter, VerificationToken } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import Resend from "next-auth/providers/resend";
import { env } from "@/config/env";
import { and, db, eq, lt, sql, users } from "@/db";
import { accounts, sessions, verificationTokens } from "@/db/schema";
import { getAuthProviderFlags } from "@/lib/auth/provider-flags";
import { createTrialEntitlement } from "@/lib/billing/entitlements";

const { isResendLoginEnabled } = getAuthProviderFlags();
const EMAIL_LOGIN_MAX_AGE_SECONDS = 10 * 60;
const EMAIL_TOKEN_MAX_USES = 5;

function applyUserToToken(token: JWT, user: User): JWT {
  token.sub = user.id;
  token.email = user.email;
  token.name = user.name;
  token.picture = user.image;
  return token;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildEmailLinkHtml(params: { host: string; magicLinkUrl: string }): string {
  const host = escapeHtml(params.host);
  const magicLinkUrl = escapeHtml(params.magicLinkUrl);

  return `
    <div style="background:#f7f5ef;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#141414;">
      <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:24px;padding:28px;border:1px solid rgba(20,20,20,0.08);">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#8a8a8a;">NexusNote</p>
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.35;">登录 NexusNote</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.8;color:#666;">点击下面按钮即可登录。如果 QQ 邮箱、微信或安全扫描先打开了链接，10 分钟内复制同一链接到默认浏览器仍可继续使用。</p>
        <a href="${magicLinkUrl}" style="display:inline-block;margin:4px 0 18px;padding:12px 18px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">直接登录</a>
        <div style="margin:4px 0 10px;">
          <span style="display:inline-block;padding:10px 14px;border-radius:999px;background:#f3f1ea;color:#111;font-size:13px;font-weight:600;">复制登录链接</span>
        </div>
        <div style="margin:0 0 18px;padding:14px 16px;border-radius:16px;background:#f3f1ea;color:#333;font-size:12px;line-height:1.7;word-break:break-all;">${magicLinkUrl}</div>
        <p style="margin:0;font-size:12px;line-height:1.8;color:#8a8a8a;">这封邮件来自 ${host}。如果不是你本人操作，可以忽略。</p>
      </div>
    </div>
  `;
}

function toVerificationToken(row: typeof verificationTokens.$inferSelect): VerificationToken {
  return {
    identifier: row.identifier,
    token: row.token,
    expires: row.expires,
  };
}

function createAuthAdapter(): Adapter {
  const baseAdapter = DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as Adapter;

  return {
    ...baseAdapter,
    async useVerificationToken(params) {
      const [row] = await db
        .select()
        .from(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, params.identifier),
            eq(verificationTokens.token, params.token),
          ),
        )
        .limit(1);

      if (!row || row.useCount >= EMAIL_TOKEN_MAX_USES) {
        return null;
      }

      const now = new Date();
      const [updated] = await db
        .update(verificationTokens)
        .set({
          firstUsedAt: row.firstUsedAt ?? now,
          lastUsedAt: now,
          useCount: sql`${verificationTokens.useCount} + 1`,
        })
        .where(
          and(
            eq(verificationTokens.identifier, params.identifier),
            eq(verificationTokens.token, params.token),
            lt(verificationTokens.useCount, EMAIL_TOKEN_MAX_USES),
          ),
        )
        .returning();

      return updated ? toVerificationToken(updated) : null;
    },
  };
}

export const authConfig = {
  trustHost: true,
  secret: env.AUTH_SECRET,

  // Only initialize adapter when db is available (runtime)
  // Build phase with no DATABASE_URL: db is null, skip adapter
  ...(db ? { adapter: createAuthAdapter() } : {}),

  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
  },

  providers: [
    ...(isResendLoginEnabled
      ? [
          Resend({
            apiKey: process.env.RESEND_API_KEY,
            from: process.env.EMAIL_FROM ?? "NexusNote <noreply@nexusnote.app>",
            maxAge: EMAIL_LOGIN_MAX_AGE_SECONDS,
            secret: env.AUTH_SECRET,
            async sendVerificationRequest({ identifier, provider, url }) {
              if (!provider.apiKey) {
                throw new Error("Missing Resend API key.");
              }

              const { host } = new URL(url);

              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${provider.apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: provider.from,
                  to: identifier,
                  subject: "NexusNote 登录链接",
                  html: buildEmailLinkHtml({
                    host,
                    magicLinkUrl: url,
                  }),
                  text: [
                    "NexusNote 登录",
                    "",
                    "直接登录链接：",
                    url,
                    "",
                    "如果邮件客户端或安全扫描先打开了链接，10 分钟内复制同一链接到默认浏览器仍可继续使用。",
                  ].join("\n"),
                }),
              });

              if (!res.ok) {
                throw new Error(`Resend error: ${JSON.stringify(await res.json())}`);
              }
            },
          }),
        ]
      : []),
  ],

  callbacks: {
    async jwt({ token, user }) {
      return user ? applyUserToToken(token, user) : token;
    },
    async session({ session, token, user }) {
      const sessionUserId = user?.id ?? token?.sub;
      if (sessionUserId) {
        session.user.id = sessionUserId;
      }
      return session;
    },
  },

  events: {
    async createUser(message) {
      if (!message.user.id) return;
      try {
        await createTrialEntitlement(message.user.id);
      } catch (error) {
        console.error("[Auth] Failed to create trial entitlement:", error);
      }
    },
  },
} satisfies NextAuthConfig;
