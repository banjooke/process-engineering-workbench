"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UserAccount() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setEmail(user?.email ?? "");
      setLoading(false);
    }

    loadUser();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="h-10 w-36 animate-pulse rounded-lg bg-gray-100" />
    );
  }

  return (
    <div className="flex items-center gap-3">
      {email && (
        <div className="hidden text-right md:block">
          <p className="text-xs font-medium text-gray-500">Signed in as</p>

          <p className="max-w-52 truncate text-sm font-semibold text-gray-800">
            {email}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {signingOut ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}