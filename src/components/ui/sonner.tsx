"use client"

import { useTheme } from 'next-themes';
import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme as 'light' | 'dark'}
      className="toaster group"
      closeButton={true}
      richColors={true}
      position="top-center"
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "group-[.toaster]:rounded-2xl group-[.toaster]:shadow-lg group-[.toaster]:border",
          description: "group-[.toast]:opacity-80",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
