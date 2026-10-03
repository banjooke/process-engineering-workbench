"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { industryPreference } from "@/lib/industry-preference";

export default function UserAccount({ beforeSignOut }: { beforeSignOut?: () => boolean }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) industryPreference.clear();
    });
    async function loadUser() {

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setEmail(user?.email ?? "");
      setLoading(false);
    }

    loadUser();
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    if (beforeSignOut && !beforeSignOut()) return;
    setSigningOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) { setSigningOut(false); return; }
    industryPreference.clear();

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
