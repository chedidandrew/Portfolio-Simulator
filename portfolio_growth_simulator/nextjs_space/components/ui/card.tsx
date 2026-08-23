import * as React from 'react'
import { cn } from '@/lib/utils'

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-lg border bg-card text-card-foreground shadow-sm',
      className
    )}
    {...props}
  />
))
Card.displayName = 'Card'

type CardHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  type?: string
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, onKeyDown, role, tabIndex, type: _type, ...props }, ref) => {
    const isCollapsibleTrigger = props['aria-expanded'] !== undefined

    if (isCollapsibleTrigger) {
      return (
        <div
          ref={ref}
          role={role ?? 'button'}
          tabIndex={tabIndex ?? 0}
          className={cn('flex flex-col space-y-1.5 p-6', className)}
          onKeyDown={(event) => {
            onKeyDown?.(event)
            if (
              !event.defaultPrevented
              && (event.key === 'Enter' || event.key === ' ')
            ) {
              event.preventDefault()
              event.currentTarget.click()
            }
          }}
          {...props}
        />
      )
    }

    return (
      <div
        ref={ref}
        role={role}
        tabIndex={tabIndex}
        className={cn('flex flex-col space-y-1.5 p-6', className)}
        onKeyDown={onKeyDown}
        {...props}
      />
    )
  }
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
