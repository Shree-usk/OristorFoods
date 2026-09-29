"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { toastManager } from "@/lib/toast"

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn("fixed top-auto right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2 outline-none", className)}
      {...props}
    />
  )
}

function ToastRoot({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "relative flex flex-col gap-1 rounded-lg bg-popover p-3 pr-8 text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-all duration-200 data-ending-style:opacity-0 data-ending-style:translate-x-full data-starting-style:opacity-0 data-starting-style:translate-x-full",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return <ToastPrimitive.Title data-slot="toast-title" className={cn("text-small font-medium text-charcoal", className)} {...props} />
}

function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return <ToastPrimitive.Description data-slot="toast-description" className={cn("text-caption text-charcoal/70", className)} {...props} />
}

function ToastClose({ className, ...props }: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Dismiss"
      className={cn("absolute top-2 right-2 rounded-md p-0.5 text-charcoal/50 hover:bg-muted hover:text-charcoal", className)}
      {...props}
    >
      <XIcon className="size-3.5" />
    </ToastPrimitive.Close>
  )
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((toast) => (
    <ToastRoot key={toast.id} toast={toast}>
      {toast.title && <ToastTitle />}
      {toast.description && <ToastDescription />}
      <ToastClose />
    </ToastRoot>
  ))
}

/**
 * Mounted once, near the app root (src/app/providers.tsx). Any client
 * component calls `toastManager.add({ title, description, type })`
 * (import from `@/lib/toast`) — no hook needed at the call site.
 */
function Toaster() {
  return (
    <ToastPrimitive.Provider toastManager={toastManager}>
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastPrimitive.Provider>
  )
}

export { Toaster }
