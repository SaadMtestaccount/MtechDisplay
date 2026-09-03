import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  illustration?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-8 py-16 text-center">
      {illustration ??
        (icon ? (
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
            {icon}
          </div>
        ) : null)}
      <h2 className="text-lg leading-[1.05] font-semibold tracking-[-0.02em]">{title}</h2>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
