import { CountUp } from '@/components/home/CountUp'
import { RevealStagger, RevealStaggerItem } from '@/components/motion/RevealStagger'

const STATS: { value: string; label: string; numeric?: number }[] = [
  { value: '< 3', label: 'seconds — average scan time' },
  { value: '4', label: 'modalities — detection categories', numeric: 4 },
  { value: 'REST + Webhook', label: 'enterprise API integrations' },
  { value: '24/7', label: 'continuous monitoring uptime' },
]

export default function StatisticsSection() {
  return (
    <section aria-label="Platform statistics" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-[1440px] mx-auto px-6">
        <RevealStagger className="grid grid-cols-2 lg:flex lg:justify-between gap-8 lg:gap-6" margin="-60px">
          {STATS.map((stat) => (
            <RevealStaggerItem key={stat.label} className="text-center flex-1">
              {stat.numeric !== undefined ? (
                <div className="font-black text-4xl md:text-5xl gradient-text tabular-nums">
                  <CountUp target={stat.numeric} />
                </div>
              ) : (
                <div className="font-black text-4xl md:text-5xl gradient-text tabular-nums">{stat.value}</div>
              )}
              <p className="text-sm text-text-muted uppercase tracking-wider mt-2">{stat.label}</p>
            </RevealStaggerItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  )
}
