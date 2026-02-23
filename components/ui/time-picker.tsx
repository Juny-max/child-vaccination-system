"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface TimePickerProps {
  time?: string
  onTimeChange: (time: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function TimePicker({
  time,
  onTimeChange,
  placeholder = "Select time",
  disabled = false,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [hours, setHours] = React.useState(time ? parseInt(time.split(":")[0]) : 9)
  const [minutes, setMinutes] = React.useState(time ? parseInt(time.split(":")[1]) : 0)
  const [period, setPeriod] = React.useState<"AM" | "PM">(
    time ? (parseInt(time.split(":")[0]) >= 12 ? "PM" : "AM") : "AM"
  )

  const handleApply = () => {
    let hour24 = hours
    if (period === "PM" && hours !== 12) {
      hour24 = hours + 12
    } else if (period === "AM" && hours === 12) {
      hour24 = 0
    }
    const timeString = `${hour24.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
    onTimeChange(timeString)
    setOpen(false)
  }

  const formatDisplayTime = () => {
    if (!time) return placeholder
    const [h, m] = time.split(":")
    const hour24 = parseInt(h)
    const hour12 = hour24 % 12 || 12
    const period = hour24 >= 12 ? "PM" : "AM"
    return `${hour12}:${m} ${period}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !time && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <Clock className="mr-2 h-4 w-4" />
          <span>{formatDisplayTime()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4">
        <div className="space-y-4">
          <div className="text-sm font-medium text-center">Select Time</div>
          <div className="flex items-center justify-center gap-2">
            {/* Hours */}
            <div className="flex flex-col items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setHours((h) => (h === 12 ? 1 : h + 1))}
              >
                ▲
              </Button>
              <div className="w-12 h-12 flex items-center justify-center border rounded-md text-lg font-semibold">
                {hours.toString().padStart(2, "0")}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setHours((h) => (h === 1 ? 12 : h - 1))}
              >
                ▼
              </Button>
            </div>

            <div className="text-2xl font-bold">:</div>

            {/* Minutes */}
            <div className="flex flex-col items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMinutes((m) => (m === 45 ? 0 : m + 15))}
              >
                ▲
              </Button>
              <div className="w-12 h-12 flex items-center justify-center border rounded-md text-lg font-semibold">
                {minutes.toString().padStart(2, "0")}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMinutes((m) => (m === 0 ? 45 : m - 15))}
              >
                ▼
              </Button>
            </div>

            {/* AM/PM */}
            <div className="flex flex-col items-center ml-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPeriod(period === "AM" ? "PM" : "AM")}
              >
                ▲
              </Button>
              <div className="w-12 h-12 flex items-center justify-center border rounded-md text-sm font-semibold">
                {period}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPeriod(period === "AM" ? "PM" : "AM")}
              >
                ▼
              </Button>
            </div>
          </div>

          {/* Quick select times */}
          <div className="grid grid-cols-3 gap-2">
            {["09:00", "12:00", "14:00", "16:00"].map((quickTime) => {
              const [h, m] = quickTime.split(":")
              return (
                <Button
                  key={quickTime}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const hour24 = parseInt(h)
                    const hour12 = hour24 % 12 || 12
                    setHours(hour12)
                    setMinutes(parseInt(m))
                    setPeriod(hour24 >= 12 ? "PM" : "AM")
                  }}
                >
                  {quickTime}
                </Button>
              )
            })}
          </div>

          <Button onClick={handleApply} className="w-full">
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
