interface SectionHeaderProps {
  headline: string
  subheadline?: string
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeader({ headline, subheadline, align = 'center', className = '' }: SectionHeaderProps) {
  const isCenter = align === 'center'
  return (
    <div className={`${isCenter ? 'text-center mx-auto' : 'text-left'} max-w-3xl mb-12 md:mb-16 ${className}`}>
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-text-primary">
        {headline}
      </h2>
      {subheadline && (
        <p className="mt-4 text-lg md:text-xl text-text-muted leading-relaxed">
          {subheadline}
        </p>
      )}
    </div>
  )
}

export default SectionHeader
