import { type LucideIcon } from 'lucide-react'

export function NavSecondary({
  items,
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  if (!items.length) {
    return null
  }

  return (
    <>
      {items.map((item) => {
        const isExternal = item.url.startsWith('http://') || item.url.startsWith('https://')
        return (
          <a
            key={item.title}
            className='flex h-7 items-center gap-2.5 overflow-hidden rounded-md px-1.5 text-xs ring-ring transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2'
            href={item.url}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
          >
            <item.icon className='h-4 w-4 shrink-0 translate-x-0.5 text-muted-foreground' />
            <div className='line-clamp-1 grow overflow-hidden pr-6 font-medium text-muted-foreground'>{item.title}</div>
          </a>
        )
      })}
    </>
  )
}
