"use client"

import { useState } from "react"
import { UserMinus, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useNetworkStatus } from "@/lib/hooks/use-network-status"
import { queueTransferOut, removeChildFromLocalRegister } from "@/lib/chw-offline/db"
import { API_BASE_URL } from "@/lib/api/config"

type TransferOutButtonProps = {
  childId: string
  childName: string
  onSuccess?: () => void
  variant?: "default" | "outline" | "ghost"
  className?: string
}

export function TransferOutButton({
  childId,
  childName,
  onSuccess,
  variant = "outline",
  className = "",
}: TransferOutButtonProps) {
  const { isOnline } = useNetworkStatus()
  const [showDialog, setShowDialog] = useState(false)
  const [reason, setReason] = useState("")
  const [transferring, setTransferring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleTransferOut = async () => {
    setTransferring(true)
    setError(null)
    setSuccess(null)

    try {
      if (isOnline) {
        // Online: Make API call to transfer out
        const token = localStorage.getItem("accessToken")
        const response = await fetch(`${API_BASE_URL}/chw/children/${childId}/transfer-out`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({
            childId,
            reason: reason || "Family relocated",
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || "Transfer out failed")
        }

        const result = await response.json()

        // Remove child from local Dexie register
        await removeChildFromLocalRegister(childId)

        setSuccess(result.message || `${childName} transferred out successfully`)
        
        setTimeout(() => {
          setShowDialog(false)
          onSuccess?.()
        }, 2000)
      } else {
        // Offline: Queue for later sync
        await queueTransferOut(childId, reason || "Family relocated")
        
        // Still remove from local register (will be reconciled when synced)
        await removeChildFromLocalRegister(childId)

        setSuccess(`Transfer queued. ${childName} removed from local register. Will sync when online.`)
        
        setTimeout(() => {
          setShowDialog(false)
          onSuccess?.()
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer out failed")
    } finally {
      setTransferring(false)
    }
  }

  const handleCancel = () => {
    setShowDialog(false)
    setReason("")
    setError(null)
    setSuccess(null)
  }

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => setShowDialog(true)}
        className={className}
      >
        <UserMinus className="mr-2 h-4 w-4" />
        Transfer Out
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5" />
              Transfer Out Child
            </DialogTitle>
            <DialogDescription>
              You are about to remove <strong>{childName}</strong> from your local register.
              Use this when a mother/child leaves your catchment area.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="transfer-reason">Reason for Transfer (Optional)</Label>
              <Textarea
                id="transfer-reason"
                placeholder="e.g., Family relocated to Kumasi, Mother moved back to village..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                disabled={transferring}
              />
            </div>

            {!isOnline && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You are offline. This transfer will be queued and synced when you reconnect.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-green-50 text-green-900 border-green-200">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancel} disabled={transferring}>
              Cancel
            </Button>
            <Button
              onClick={handleTransferOut}
              disabled={transferring}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {transferring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <UserMinus className="mr-2 h-4 w-4" />
                  Confirm Transfer Out
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
