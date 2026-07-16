"use client"

import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { useTheme } from "next-themes"
import { toast, Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      closeButton={true}
      onClick={(id) => toast.dismiss(id)}
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        style: isDark
          ? {
              background: "oklch(0.185 0.048 255)",
              color: "oklch(0.88 0.02 255)",
              border: "1px solid oklch(0.55 0.12 52)",
            }
          : {
              background: "oklch(0.215 0.052 255)",
              color: "oklch(1 0 0)",
              border: "1px solid oklch(0.30 0.07 255)",
            },
        classNames: {
          toast: "group toast group-[.toaster]:shadow-lg cursor-pointer",
          description: "group-[.toast]:opacity-70",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "!-left-2 !-top-2 !right-auto !z-10",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
