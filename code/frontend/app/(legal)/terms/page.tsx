import type { Metadata } from "next";
import Link from "next/link";

import { CONTACT_URL, LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "Terms of Service · SkillGrid" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="25 November 2026">
      <p>
        SkillGrid is a free student project built at Thapar Institute of Engineering &amp;
        Technology that helps students find hackathon teammates. By signing in you agree to these
        terms.
      </p>

      <h2>Who can use SkillGrid</h2>
      <p>
        SkillGrid is for Thapar Institute students. Sign-in may be limited to college Google
        accounts. You are responsible for activity on your account.
      </p>

      <h2>Your content</h2>
      <ul>
        <li>
          You own what you upload or enter (resume, profile, skills, feedback). You let us store
          and display it inside SkillGrid so the service works.
        </li>
        <li>
          Be honest. Do not claim skills or evidence that are not yours, upload someone
          else&apos;s resume, or connect a GitHub account you do not own.
        </li>
        <li>Give fair, good-faith feedback to teammates.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Do not harass other users, spam invitations, scrape the site, or try to break or bypass
        its security. We may remove content or suspend accounts that break these rules.</p>

      <h2>Hackathon listings</h2>
      <p>
        Hackathon details are imported from public sources such as Devfolio, Unstop and Devpost.
        Always check dates and rules on the organiser&apos;s own page; we are not responsible for
        events run by others.
      </p>

      <h2>No warranty</h2>
      <p>
        SkillGrid is provided &ldquo;as is&rdquo; as an academic project. Skill scores are
        estimates from the evidence available, not a certification. The service may change, be
        unavailable, or be shut down at any time, and we are not liable for any loss arising from
        its use, to the extent the law allows.
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle your data is described in our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using SkillGrid at any time and ask us to delete your account via the{" "}
        <a href={CONTACT_URL}>project issue tracker</a>.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms; the date above shows the latest version. Continuing to use
        SkillGrid after a change means you accept the updated terms.
      </p>
    </LegalPage>
  );
}
