import { Mail } from 'lucide-react'
import { Card } from '../components/ui'

const EMAIL = 'noreplay.paofficial@gmail.com'

export default function Contact() {
  return (
    <Card title="Contact Us">
      <div className="flex max-w-3xl items-center gap-3 text-[15px] leading-7 text-gray-700 dark:text-gray-300">
        <Mail size={18} className="shrink-0 text-purple-700 dark:text-purple-400" />
        <a href={`mailto:${EMAIL}`} className="font-medium text-purple-700 hover:underline dark:text-purple-400">
          {EMAIL}
        </a>
      </div>
    </Card>
  )
}
