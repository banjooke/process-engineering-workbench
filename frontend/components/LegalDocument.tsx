import type { ReactNode } from "react";
import Link from "next/link";
import BetaBadge from "@/components/BetaBadge";
import { siteConfig } from "@/lib/site-config";

export default function LegalDocument({ title, children }: { title: string; children: ReactNode }) {
  return <main className="flex-1 bg-gray-50 px-6 py-10 sm:py-16">
    <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 text-base leading-7 text-gray-700 sm:p-10 [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-gray-900 [&_p]:mb-4 [&_a]:rounded [&_a]:text-teal-800 [&_a]:underline [&_a]:underline-offset-4 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-teal-700 [&_li]:mb-2 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6">
      <div className="mb-6 flex flex-wrap items-center gap-3"><Link href="/">{siteConfig.applicationName}</Link><BetaBadge /></div>
      <h1 className="mb-3 text-3xl font-bold text-gray-900">{title}</h1>
      <p className="text-sm">Effective date: {siteConfig.effectiveDate}</p>
      {children}
    </article>
  </main>;
}
