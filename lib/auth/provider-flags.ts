export interface AuthProviderFlags {
  isDevLoginEnabled: boolean;
  isResendLoginEnabled: boolean;
  isGithubLoginEnabled: boolean;
}

function readBooleanEnv(name: string): boolean | null {
  const value = process.env[name];
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function getAuthProviderFlags(): AuthProviderFlags {
  const runtimeEnvironment = process.env.APP_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  const isProductionEnvironment = runtimeEnvironment === "production";
  const isDevLoginEnabled = readBooleanEnv("AUTH_DEV_LOGIN_ENABLED") ?? !isProductionEnvironment;
  const isResendLoginEnabled = readBooleanEnv("AUTH_RESEND_ENABLED") ?? !isDevLoginEnabled;

  return {
    isDevLoginEnabled,
    isResendLoginEnabled,
    isGithubLoginEnabled: Boolean(process.env.AUTH_GITHUB_ID),
  };
}
