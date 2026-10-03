import Link from "next/link";
import { contactHref, siteConfig } from "@/lib/site-config";

export default function SiteFooter() {
  const linkStyle = "rounded underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700";
  return <footer className="mt-auto border-t border-gray-200 bg-white px-6 py-5 text-sm text-gray-700">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
      <p>© 2026 {siteConfig.operatorName}</p>
      <nav aria-label="Legal and contact" className="flex flex-wrap gap-x-6 gap-y-3">
        <Link className={linkStyle} href="/privacy">Privacy</Link>
        <Link className={linkStyle} href="/terms">Terms</Link>
        <a className={linkStyle} href={siteConfig.feedbackFormUrl} target="_blank" rel="noopener noreferrer">Send feedback</a>
        <a className={linkStyle} href={contactHref}>Contact</a>
      </nav>
    </div>
  </footer>;
}
