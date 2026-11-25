import type { Metadata } from "next";

import { CONTACT_URL, LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · SkillGrid" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="25 November 2026">
      <p>
        SkillGrid is a student project built at Thapar Institute of Engineering &amp; Technology
        to help students find hackathon teammates based on evidence of their skills. This policy
        explains what we collect, why, and what you can do about it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Google account basics.</strong> When you sign in with Google we receive your
          name, email address and profile picture. We use these to create your account and show
          you to other students. We do not request access to your Gmail, Drive, Calendar or
          contacts.
        </li>
        <li>
          <strong>Your resume</strong>, if you upload one. It is stored privately and read to
          suggest skills for your profile.
        </li>
        <li>
          <strong>Your GitHub username and public repositories</strong>, if you choose to connect
          GitHub. We read your profile and repository languages once to find skill evidence. We
          do not store your GitHub access token.
        </li>
        <li>
          <strong>What you enter in the app</strong>: profile details, skill ratings, interests,
          availability, project links, teams, invitations, and the skill feedback you give
          teammates after a hackathon.
        </li>
        <li>
          <strong>Session cookies</strong> that keep you signed in. We do not use advertising or
          analytics trackers.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Only to run SkillGrid: building your skill grid, showing your profile to other signed-in
        students looking for teammates, managing teams and invites, and calculating evidence
        scores. We do not sell your data or use it for advertising.
      </p>

      <h2>Who can see it</h2>
      <p>
        Other signed-in students can see your name, picture, skills, evidence levels and team
        activity. Your resume file is never shown to others, and your email is not shown in
        teammate listings (members of your own team may see it). Peer
        feedback is shown in aggregate as evidence, not attributed to the person who gave it.
        Project administrators can review reported skills to keep the catalogue accurate.
      </p>

      <h2>Services that process data for us</h2>
      <ul>
        <li><strong>Google</strong> for sign-in.</li>
        <li><strong>Vercel</strong> for hosting and private resume file storage.</li>
        <li>Our <strong>PostgreSQL database provider</strong> for account and profile data.</li>
        <li><strong>GitHub</strong>, only if you connect it.</li>
        <li>
          <strong>OCR.space</strong>, only when an uploaded resume has no readable text layer
          (for example a scanned PDF) and needs text recognition.
        </li>
        <li>
          <strong>OpenRouter</strong>, only for the text you type into &ldquo;Describe your
          idea&rdquo;, which is sent to an AI model to suggest relevant skills.
        </li>
      </ul>

      <h2>Google user data</h2>
      <p>
        SkillGrid&apos;s use of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Keeping and deleting your data</h2>
      <p>
        We keep your data while your account exists. You can ask us to delete your account and
        everything linked to it (profile, resume, skills, teams and feedback) at any time by
        opening a request on our <a href={CONTACT_URL}>project issue tracker</a>. Do not post
        personal details in the issue itself; we will follow up with you.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy we will update the date above. Significant changes will be shown
        in the app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy: <a href={CONTACT_URL}>open an issue on the SkillGrid project</a>.
      </p>
    </LegalPage>
  );
}
