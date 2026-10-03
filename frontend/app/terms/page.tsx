import type { Metadata } from "next";
import Link from "next/link";
import LegalDocument from "@/components/LegalDocument";
import { confidentialityWarning, contactHref, siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Beta Terms of Use | ${siteConfig.applicationName}`,
  description: "Permitted beta use, engineering limitations, user content, availability and contact information.",
};

export default function TermsPage() {
  return <LegalDocument title="Beta Terms of Use">
    <h2>1. Operator</h2>
    <p>{siteConfig.applicationName} is operated by {siteConfig.operatorName}, enterprise number {siteConfig.enterpriseNumber}, {siteConfig.operatorCountry}. Contact: <a href={contactHref}>{siteConfig.contactEmail}</a>.</p>
    <h2>2. Beta status</h2>
    <p>The software is under active development. Functions may change, be unavailable or contain defects. Beta access may be modified or withdrawn.</p>
    <h2>3. Permitted use</h2>
    <p>Use the beta for professional evaluation, testing and feedback, and only lawfully. Do not interfere with the service, conduct security testing without permission, scrape or abuse it, or attempt to access another user’s data.</p>
    <h2>4. Engineering limitations</h2>
    <p className="rounded-lg border border-teal-200 bg-teal-50 p-4 font-medium text-teal-900">The {siteConfig.applicationName} provides preliminary engineering calculations and workflow assistance. Outputs are not certified designs, professional approvals, vendor guarantees or substitutes for competent engineering review.</p>
    <p>You remain responsible for verifying inputs, assumptions, units, outputs and applicability. Applicable standards, legislation, company procedures and manufacturer data take precedence. Outputs must not be the sole basis for safety-critical, regulatory, procurement, construction or final-design decisions.</p>
    <h2>5. User data</h2>
    <p>You are responsible for information you submit and must have authority to submit it. {confidentialityWarning} You retain ownership of your submitted engineering content. {siteConfig.operatorName} receives only the limited permission needed to process that content to operate the service.</p>
    <h2>6. Availability</h2>
    <p>Uninterrupted or error-free availability is not guaranteed. Retain independent copies of important data and reports.</p>
    <h2>7. Intellectual property</h2>
    <p>Application software, branding and original interface content remain owned by or licensed to {siteConfig.operatorName}. You retain your own project information. Downloaded reports may be used for internal evaluation subject to the engineering limitations in these terms.</p>
    <h2>8. Feedback</h2>
    <p>Feedback is voluntary. {siteConfig.operatorName} may use non-confidential feedback to improve the service. Submitting feedback does not transfer ownership of your confidential engineering data.</p>
    <h2>9. Disclaimer and limitation</h2>
    <p>The service is supplied as a beta for evaluation, with the limitations described above. Liability is limited only to the extent permitted by applicable law. Nothing in these terms excludes or limits liability that cannot legally be excluded or limited.</p>
    <h2>10. Suspension or termination</h2>
    <p>Access may be suspended or terminated for misuse, security risks or violation of these terms.</p>
    <h2>11. Privacy</h2>
    <p>See the <Link href="/privacy">Privacy Notice</Link> for information about personal-data processing and your rights.</p>
    <h2>12. Governing law</h2>
    <p>Belgian law applies, subject to mandatory rights that apply to you.</p>
    <h2>13. Contact</h2>
    <p>For support, feedback, privacy enquiries or account-deletion requests, contact <a href={contactHref}>{siteConfig.contactEmail}</a>.</p>
  </LegalDocument>;
}
