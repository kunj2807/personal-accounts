import { LegalPage, LegalSection } from '../components/LegalPage'

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Personal Account is a private bookkeeping app. This policy explains what the app stores when you use it, and what you can do with that information.
      </p>

      <LegalSection heading="Information we store">
        <p>When you create an account, we store your name and email address, and the date and time you confirmed that you are 18 or have a parent or guardian’s consent and accepted the Terms and Privacy Policy. Your password is handled by the sign-in service and is not kept in plain text.</p>
        <p>
          The records you enter stay in your account. That includes banks, categories, income and expenses, lending and borrowing, deposits and withdrawals, transfers, custom forms, dates, amounts, and descriptions.
        </p>
        <p>The app also keeps an activity log of adds, edits, and deletes you make, so you can review your own changes.</p>
      </LegalSection>

      <LegalSection heading="How we use it">
        <p>We use this information to sign you in, show your books, build reports, and keep your activity history. We do not sell your records or use them for advertising.</p>
      </LegalSection>

      <LegalSection heading="Who can see it">
        <p>
          Your records are tied to your account. Other people who use this app cannot read them. The database and sign-in service are hosted with Supabase, so your data is stored there on your behalf.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies and device storage">
        <p>This app does not use advertising or analytics cookies.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your sign-in session is kept in browser storage so you stay signed in until you log out.</li>
          <li>Your theme choice (light, dark, or system) is saved in local storage on this device.</li>
          <li>A short flag in session storage remembers that the cash account was set up for this visit.</li>
        </ul>
        <p>You can clear this storage from your browser. Clearing the sign-in session will sign you out.</p>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <p>Entries stay until you delete them. Account details and activity logs stay until the account is deleted.</p>
      </LegalSection>

      <LegalSection heading="Deleting your data">
        <p>
          You can edit or delete individual records inside the app. From Manage account you can delete the whole account. That removes your sign-in and every record stored with it, including banks, categories, entries, and activity logs. This cannot be undone.
        </p>
        <p>
          If you cannot sign in, email{' '}
          <a href="mailto:noreplay.paofficial@gmail.com" className="font-medium text-purple-700 hover:underline dark:text-purple-400">
            noreplay.paofficial@gmail.com
          </a>{' '}
          and ask for deletion. We will remove the account and its stored records after we confirm the request is yours.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>If this policy changes, the updated page will show a new date at the top. Continued use of the app after that date means you accept the updated policy.</p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about this policy, or a request to access or delete your account, can be sent to{' '}
          <a href="mailto:noreplay.paofficial@gmail.com" className="font-medium text-purple-700 hover:underline dark:text-purple-400">
            noreplay.paofficial@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
