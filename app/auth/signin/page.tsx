"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("admin@local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  return (
    <div className="mx-auto mt-12 max-w-md card">
      <h1 className="mb-4 text-xl font-semibold">Anmelden</h1>
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
  );
}
