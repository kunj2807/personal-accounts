import { Card } from './ui'

export function LegalPage({ title, children }) {
  return (
    <Card title={title}>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Last updated 19 November 2026</p>
      <div className="max-w-3xl space-y-6 text-[15px] leading-7 text-gray-700 dark:text-gray-300">{children}</div>
    </Card>
  )
}

export function LegalSection({ heading, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{heading}</h2>
      {children}
    </section>
  )
}
