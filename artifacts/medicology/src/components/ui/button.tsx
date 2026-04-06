import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 btn-press",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border border-primary/30 shadow-md hover:shadow-lg hover:border-primary/50 active:shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md border border-destructive/30 hover:shadow-lg hover:border-destructive/50 active:shadow-sm",
        outline:
          "border border-border/80 bg-background/50 hover:bg-background hover:border-primary/50 shadow-sm hover:shadow-md active:shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground border border-secondary/30 shadow-md hover:shadow-lg hover:border-secondary/50 active:shadow-sm",
        ghost: "border border-transparent hover:bg-accent/10 text-foreground active:bg-accent/5",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-10 px-4 py-2.5",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-11 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
