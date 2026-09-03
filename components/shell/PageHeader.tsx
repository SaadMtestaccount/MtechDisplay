import type { ReactNode } from 'react'

/**
 * Every list page header: title + primary (outline) button + kebab menu slot; `children`
 * renders the toolbar row (ListToolbar) on the right.
 */
export function PageHeader({
  title,
  description,
  primary,
  menu,
  children,
}: {
  title: string
  description?: string
  primary?: ReactNode
  menu?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl leading-[1.05] font-semibold tracking-[-0.02em]">{title}</h1>
        {primary}
        {menu}
        {children ? <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}
