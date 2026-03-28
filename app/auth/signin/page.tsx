"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { useAppLanguage } from "@/components/app-language-provider";

export default function SignInPage() {
  const [email, setEmail] = useState("admin@local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const { t } = useAppLanguage();
  const searchParams = useSearchParams();

  return (
    <div className="mx-auto mt-6 max-w-md px-1 sm:mt-12">
      <div className="card">
        <div className="mb-6 flex flex-col items-center gap-4">
          <Link href="/" className="text-workshop-800">
            <Brand
              stacked
              showSubtitle
              logoClassName="h-16 w-16 sm:h-20 sm:w-20"
              textClassName="text-xl font-semibold text-workshop-800 sm:text-2xl"
            />
          </Link>
          <h1 className="text-xl font-semibold">{t("signInTitle")}</h1>
        </div>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const callbackUrl = searchParams.get("callbackUrl") || "/";
            const result = await signIn("credentials", {
              email,
              password,
              callbackUrl,
              redirect: false
            });
            if (result?.error || !result?.ok || !result.url) {
              setError(t("signInError"));
              return;
            }
            window.location.assign(result.url);
          }}
        >
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("signInEmail")} />
          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder={t("signInPassword")}
          />
          {error && <p className="text-sm [color:var(--app-danger-text)]">{error}</p>}
          <button className="btn w-full" type="submit">
            {t("signInSubmit")}
          </button>
        </form>
      </div>
    </div>
  );
}
