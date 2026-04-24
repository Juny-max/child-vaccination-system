"use client"

import * as React from "react"
import { addMonths, format } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date?: Date
  onDateChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  minDate?: Date
  maxDate?: Date
  fromYear?: number
  toYear?: number
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  minDate,
  maxDate,
  fromYear = 1900,
  toYear = new Date().getFullYear() + 20,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const initialMonth = date ?? maxDate ?? minDate ?? new Date()
  const [month, setMonth] = React.useState<Date>(initialMonth)

  React.useEffect(() => {
    if (date) {
      setMonth(date)
    }
  }, [date])

  React.useEffect(() => {
    if (open) {
      setMonth(date ?? maxDate ?? minDate ?? new Date())
    }
  }, [open, date, minDate, maxDate])

  const stripTime = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="flex items-center justify-between border-b border-border px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8"
            onClick={() => setMonth((currentMonth) => addMonths(currentMonth, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8"
            onClick={() => setMonth((currentMonth) => addMonths(currentMonth, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={(nextDate) => {
            onDateChange(nextDate)
            if (nextDate) {
              setMonth(nextDate)
            }
          }}
          month={month}
          onMonthChange={setMonth}
          captionLayout="dropdown"
          hideNavigation
          classNames={{
            caption_label: "sr-only",
            nav: "hidden",
            button_previous: "hidden",
            button_next: "hidden",
          }}
          fromYear={fromYear}
          toYear={toYear}
          defaultMonth={date ?? maxDate ?? minDate ?? new Date()}
          disabled={(candidateDate) => {
            const normalizedCandidate = stripTime(candidateDate)
            if (minDate && normalizedCandidate < stripTime(minDate)) return true
            if (maxDate && normalizedCandidate > stripTime(maxDate)) return true
            return false
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
