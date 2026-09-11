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
    <div className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-border bg-card/60 px-8 py-16 text-center">
      {illustration ??
        (icon ? (
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-7">
            {icon}
          </div>
        ) : null)}
      <h2 className="text-xl leading-tight font-extrabold tracking-[-0.02em]">{title}</h2>
      {description ? <p className="max-w-md text-[15px] text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
