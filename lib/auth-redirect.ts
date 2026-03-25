export function getSafeCallbackUrl(callbackUrl: string | null | undefined): string {
  if (!callbackUrl) {
    return "/";
  }

  return callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
}

export function createLoginPath(callbackUrl: string | null | undefined): string {
  const searchParams = new URLSearchParams({
    callbackUrl: getSafeCallbackUrl(callbackUrl),
  });
  return `/login?${searchParams.toString()}`;
}

export function getCurrentCallbackUrl(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}`;
}
