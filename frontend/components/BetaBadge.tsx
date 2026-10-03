import { siteConfig } from "@/lib/site-config";

export default function BetaBadge() {
  return siteConfig.betaStatus ? <span className="inline-flex shrink-0 items-center rounded-full border border-teal-300 bg-teal-50 px-2 py-0.5 align-middle text-[10px] font-bold tracking-widest text-teal-900">BETA</span> : null;
}
