"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Brand } from "@/components/brand";

export default function SignInPage() {
  const [email, setEmail] = useState("admin@local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  return (
    <div className="mx-auto mt-6 max-w-md px-1 sm:mt-12">
      <div className="card">
        <div className="mb-6 flex flex-col items-center gap-4">
          <Link href="/" className="text-workshop-800 dark:text-[#e6ebf2]">
            <Brand
              stacked
              showSubtitle
              logoClassName="h-16 w-16 sm:h-20 sm:w-20"
              textClassName="text-xl font-semibold text-workshop-800 sm:text-2xl dark:text-[#e6ebf2]"
            />
          </Link>
          <h1 className="text-xl font-semibold">Anmelden</h1>
        </div>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await signIn("credentials", {
              email,
              password,
              callbackUrl: "/"
            });
            if (result?.error) setError("Login fehlgeschlagen");
          }}
        >
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" />
          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Passwort"
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn w-full" type="submit">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
