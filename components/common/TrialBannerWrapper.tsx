"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { TrialBanner } from "./TrialBanner";

export function TrialBannerWrapper() {
  const { data: session } = useSession();
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setTrialEndsAt(null);
      return;
    }

    fetch("/api/user/entitlement")
      .then((res) => res.json())
      .then((data) => {
        if (data.isTrialing && data.trialEndsAt) {
          setTrialEndsAt(data.trialEndsAt);
        }
      })
      .catch(() => {});
  }, [session]);

  if (!trialEndsAt) {
    return null;
  }

  return <TrialBanner trialEndsAt={trialEndsAt} />;
}
