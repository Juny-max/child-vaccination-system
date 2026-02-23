import * as React from "react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "space-y-4",
        month_caption: "relative flex items-center justify-center pt-1",
        caption_label: "text-sm font-semibold text-foreground",
        nav: "absolute inset-x-0 top-1 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "h-8 w-8 p-0 text-foreground hover:bg-muted"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "h-8 w-8 p-0 text-foreground hover:bg-muted"
        ),
        dropdowns: "flex items-center gap-2 px-10",
        dropdown_root: "relative",
        dropdown: "h-8 rounded-md border border-input bg-background px-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40",
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7",
        weekday: "text-foreground/80 text-center text-xs font-semibold py-1",
        weeks: "grid gap-1",
        week: "grid grid-cols-7 gap-1",
        day: "h-9 w-9 p-0",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-medium text-foreground hover:bg-muted"
        ),
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        today: "bg-primary/15 text-primary ring-2 ring-primary/70 ring-offset-1 ring-offset-background font-bold",
        outside: "text-muted-foreground opacity-55",
        disabled: "text-muted-foreground opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
