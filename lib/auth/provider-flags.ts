export interface AuthProviderFlags {
  isResendLoginEnabled: boolean;
}

function readBooleanEnv(name: string): boolean | null {
  const value = process.env[name];
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function getAuthProviderFlags(): AuthProviderFlags {
  return {
    isResendLoginEnabled: readBooleanEnv("AUTH_RESEND_ENABLED") ?? true,
  };
}
