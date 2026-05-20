/**
 * Auth.js v5 Configuration
 *
 * Providers:
 * - Resend (Email Code)
 */

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { NextAuthConfig, User } from "next-auth";
import type { Adapter, VerificationToken } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import Resend from "next-auth/providers/resend";
import { and, db, eq, lt, sql, users } from "@/db";
import { accounts, sessions, verificationTokens } from "@/db/schema";
import { getAuthProviderFlags } from "@/lib/auth/provider-flags";

const { isResendLoginEnabled } = getAuthProviderFlags();
const AUTH_EMAIL_SECRET = process.env.AUTH_SECRET ?? "nexusnote-dev-secret-change-in-production";
const EMAIL_LOGIN_MAX_AGE_SECONDS = 10 * 60;
const EMAIL_LOGIN_CODE_LENGTH = 8;
const EMAIL_TOKEN_MAX_USES = 5;

function applyUserToToken(token: JWT, user: User): JWT {
  token.sub = user.id;
  token.email = user.email;
  token.name = user.name;
  token.picture = user.image;
  return token;
}

function generateEmailLoginCode(): string {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return String(value % 100_000_000).padStart(EMAIL_LOGIN_CODE_LENGTH, "0");
}

async function createAuthTokenHash(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildSafeLoginUrl(callbackUrl: string, email: string): string {
  const authCallbackUrl = new URL(callbackUrl);
  const loginUrl = new URL("/login", authCallbackUrl.origin);
  const safeCallbackUrl = authCallbackUrl.searchParams.get("callbackUrl");

  if (safeCallbackUrl) {
    loginUrl.searchParams.set("callbackUrl", safeCallbackUrl);
  }

  loginUrl.searchParams.set("email", email);
  return loginUrl.toString();
}

function buildVerificationCodeHtml(params: {
  code: string;
  host: string;
  magicLinkUrl: string;
  loginUrl: string;
}): string {
  const code = escapeHtml(params.code);
  const host = escapeHtml(params.host);
  const magicLinkUrl = escapeHtml(params.magicLinkUrl);
  const loginUrl = escapeHtml(params.loginUrl);

  return `
    <div style="background:#f7f5ef;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#141414;">
      <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:24px;padding:28px;border:1px solid rgba(20,20,20,0.08);">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#8a8a8a;">NexusNote</p>
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.35;">登录 NexusNote</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.8;color:#666;">可以直接点击登录按钮；如果 QQ 邮箱、微信或安全扫描先打开了链接，10 分钟内复制到默认浏览器仍可继续使用。</p>
        <a href="${magicLinkUrl}" style="display:inline-block;margin:4px 0 18px;padding:12px 18px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">直接登录</a>
        <p style="margin:4px 0 12px;font-size:14px;line-height:1.8;color:#666;">也可以在 ${host} 的登录页输入下面验证码：</p>
        <div style="margin:22px 0;padding:18px 20px;border-radius:18px;background:#f3f1ea;text-align:center;font-size:34px;letter-spacing:0.18em;font-weight:700;color:#111;">${code}</div>
        <p style="margin:0 0 18px;font-size:13px;line-height:1.8;color:#777;">验证码 10 分钟内有效。复制验证码到你正在使用的浏览器即可完成登录。</p>
        <a href="${loginUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#f3f1ea;color:#111;text-decoration:none;font-size:14px;font-weight:600;">打开验证码登录页</a>
      </div>
    </div>
  `;
}

async function storeEmailLoginCode(params: {
  identifier: string;
  code: string;
  expires: Date;
}): Promise<void> {
  if (!db) {
    return;
  }

  await db.insert(verificationTokens).values({
    identifier: params.identifier,
    token: await createAuthTokenHash(`${params.code}${AUTH_EMAIL_SECRET}`),
    expires: params.expires,
  });
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
            secret: AUTH_EMAIL_SECRET,
            async sendVerificationRequest({ identifier, provider, url, expires }) {
              if (!provider.apiKey) {
                throw new Error("Missing Resend API key.");
              }

              const { host } = new URL(url);
              const code = generateEmailLoginCode();
              const loginUrl = buildSafeLoginUrl(url, identifier);
              await storeEmailLoginCode({ identifier, code, expires });

              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${provider.apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: provider.from,
                  to: identifier,
                  subject: `NexusNote 登录链接和验证码：${code}`,
                  html: buildVerificationCodeHtml({
                    code,
                    host,
                    magicLinkUrl: url,
                    loginUrl,
                  }),
                  text: [
                    "NexusNote 登录",
                    "",
                    "直接登录链接：",
                    url,
                    "",
                    `验证码：${code}`,
                    "登录链接和验证码 10 分钟内有效。链接短时间内可重复使用，避免 QQ 邮箱、微信或邮件安全扫描提前消耗登录链接。",
                    "",
                    `验证码登录页：${loginUrl}`,
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
} satisfies NextAuthConfig;
