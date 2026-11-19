import { Link } from 'react-router-dom'

export function ConsentField({ id = 'consentAccepted', error, ...inputProps }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-purple-600 focus:ring-2 focus:ring-purple-200 dark:border-zinc-600 dark:bg-zinc-800 dark:focus:ring-purple-900"
          {...inputProps}
        />
        <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
          <label htmlFor={id} className="cursor-pointer">
            I confirm that I am 18 years or older, or I have a parent or guardian’s consent, and I agree to the{' '}
          </label>
          <Link to="/terms" target="_blank" rel="noreferrer" className="font-medium text-purple-700 hover:underline dark:text-purple-400">
            Terms & Conditions
          </Link>
          {' '}and{' '}
          <Link to="/privacy-policy" target="_blank" rel="noreferrer" className="font-medium text-purple-700 hover:underline dark:text-purple-400">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
