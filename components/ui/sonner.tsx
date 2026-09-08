"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * Deliberately low-key: toasts confirm routine saves, so they are compact (small text, tight
 * padding), disappear after 2.5 s, stack at most two deep and sit in the bottom-right corner
 * out of the way.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      duration={2500}
      visibleToasts={2}
      gap={8}
      offset={16}
      icons={{
        success: (
          <CircleCheckIcon className="size-3.5" />
        ),
        info: (
          <InfoIcon className="size-3.5" />
        ),
        warning: (
          <TriangleAlertIcon className="size-3.5" />
        ),
        error: (
          <OctagonXIcon className="size-3.5" />
        ),
        loading: (
          <Loader2Icon className="size-3.5 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "300px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !py-2.5 !px-3 !text-[13px] !shadow-sm",
          title: "!font-medium",
          description: "!text-xs",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
