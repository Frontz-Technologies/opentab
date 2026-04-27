"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

function pickGreetingKey(hour: number): string {
  if (hour < 12) return "greetingMorning";
  if (hour < 18) return "greetingAfternoon";
  return "greetingEvening";
}

export function DashboardGreeting({ userName }: { userName: string }) {
  const t = useTranslations("dashboard");
  const firstName = userName.split(" ")[0] || userName;
  const [greetingKey, setGreetingKey] = useState(() =>
    pickGreetingKey(new Date().getHours()),
  );

  useEffect(() => {
    setGreetingKey(pickGreetingKey(new Date().getHours()));
  }, []);

  return (
    <h1 className="font-headline text-3xl sm:text-4xl font-bold text-on-surface tracking-tight mb-8">
      {t(greetingKey, { name: firstName })}
    </h1>
  );
}
