import { Link } from 'react-router-dom'
import { LegalPage, LegalSection } from '../components/LegalPage'

export default function Terms() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>These terms cover your use of Personal Account. By creating an account or using the app, you agree to them.</p>

      <LegalSection heading="The service">
        <p>
          Personal Account is a record book for your own money. You can track income, expenses, banks, lending, deposits, transfers, and custom forms. It is not a bank, payment service, tax filing service, or financial advisor.
        </p>
      </LegalSection>

      <LegalSection heading="Your account">
        <p>You must give a real name and an email address you can access. You are responsible for keeping your password private and for activity under your account.</p>
        <p>You must be at least 18 years old, or have a parent or guardian’s consent, to create an account and use this app. Creating an account records the date and time you accepted these terms and the Privacy Policy.</p>
      </LegalSection>

      <LegalSection heading="Your records">
        <p>You own the records you enter. You are responsible for their accuracy. The app shows totals and reports from what you save. It does not check them against a bank or a tax authority.</p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>Use the app for your own bookkeeping. Do not try to access another person’s account, disrupt the service, or use it to store anything unlawful.</p>
      </LegalSection>

      <LegalSection heading="Availability">
        <p>
          The app is provided as it is. It may be unavailable during maintenance or if the host is down. We do not promise that reports will meet a legal, tax, or accounting standard.
        </p>
      </LegalSection>

      <LegalSection heading="Privacy">
        <p>
          How the app handles your information is described in the <Link to="/privacy-policy" className="font-medium text-purple-700 hover:underline dark:text-purple-400">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection heading="Ending use">
        <p>
          You can stop using the app at any time and sign out. From <Link to="/account" className="font-medium text-purple-700 hover:underline dark:text-purple-400">Manage account</Link> you can delete your account and the records stored with it.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>If these terms change, the updated page will show a new date at the top. Continued use of the app after that date means you accept the updated terms.</p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about these terms can be sent to{' '}
          <a href="mailto:noreplay.paofficial@gmail.com" className="font-medium text-purple-700 hover:underline dark:text-purple-400">
            noreplay.paofficial@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
