"use client"

import { useState } from "react"
import { UserPlus, Loader2, AlertCircle, CheckCircle2, AlertTriangle, ArrowRightLeft } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { TransferInSearch } from "@/components/chw/transfer-in-search"
import { useNetworkStatus } from "@/lib/hooks/use-network-status"
import { queueTransferIn, upsertChildren } from "@/lib/chw-offline/db"
import { transferPullChild, type TransferInSearchResult } from "@/lib/api/chw"
import { API_BASE_URL } from "@/lib/api/config"
import type { OfflineChild } from "@/lib/chw-offline/db"

type TransferInModalProps = {
  open: boolean
  onClose: () => void
  onSuccess?: (childId: string) => void
}

export function TransferInModal({ open, onClose, onSuccess }: TransferInModalProps) {
  const { isOnline } = useNetworkStatus()
  const [selectedChild, setSelectedChild] = useState<TransferInSearchResult | null>(null)
  const [notes, setNotes] = useState("")
  const [transferring, setTransferring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // Force pull confirmation state
  const [showPullConfirmation, setShowPullConfirmation] = useState(false)

  // Requires force pull only when child belongs to a different zone.
  const childRequiresPull = Boolean(selectedChild?.requiresPull)

  const handleSelectChild = (child: TransferInSearchResult, initiatePull: boolean) => {
    setSelectedChild(child)
    setShowPullConfirmation(initiatePull)
    setError(null)
    setSuccess(null)
  }

  const handleInitiateTransfer = () => {
    if (!selectedChild) return

    // If child is in another catchment, show force pull confirmation
    if (childRequiresPull) {
      setShowPullConfirmation(true)
    } else {
      // No existing catchment, proceed with normal transfer
      handleTransferIn(false)
    }
  }

  const handleTransferIn = async (forcePull: boolean) => {
    if (!selectedChild) return

    setTransferring(true)
    setError(null)
    setSuccess(null)
    setShowPullConfirmation(false)

    try {
      if (isOnline) {
        let result: any

        if (forcePull && childRequiresPull) {
          // Use the force pull endpoint
          result = await transferPullChild(
            selectedChild.id,
            notes || `Forceful pull transfer: ${selectedChild.childName} from ${selectedChild.currentZoneName}`,
          )
        } else {
          // Use the standard transfer-in endpoint
          const response = await fetch(`${API_BASE_URL}/chw/children/${selectedChild.id}/transfer-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              childId: selectedChild.id,
              notes: notes || `Transferred in via global search: ${selectedChild.childName}`,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || "Transfer failed")
          }

          result = await response.json()
        }

        // Add child to local Dexie register
        const childData: OfflineChild = {
          id: selectedChild.id,
          cvccId: selectedChild.childId,
          fullName: selectedChild.childName,
          dateOfBirth: selectedChild.dateOfBirth,
          gender: selectedChild.gender as OfflineChild["gender"],
          guardianName: selectedChild.motherName,
          guardianPhone: selectedChild.motherPhone,
          catchmentAreaId: result.newCatchmentId || result.newCatchment || undefined,
          updatedAt: new Date().toISOString(),
        }

        await upsertChildren([childData])

        const transferType = forcePull ? "pulled" : "transferred"
        setSuccess(`${selectedChild.childName} ${transferType} successfully! Now in your local register.`)

        setTimeout(() => {
          onSuccess?.(selectedChild.id)
          handleClose()
        }, 2000)
      } else {
        // Offline: Queue for later sync
        await queueTransferIn(
          selectedChild.id,
          notes || `Queued for transfer: ${selectedChild.childName}`
        )

        setSuccess(`Transfer queued. Will sync when you're back online.`)

        setTimeout(() => {
          onSuccess?.(selectedChild.id)
          handleClose()
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed")
    } finally {
      setTransferring(false)
    }
  }

  const handleClose = () => {
    setSelectedChild(null)
    setNotes("")
    setError(null)
    setSuccess(null)
    setShowPullConfirmation(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Transfer In - Global Search
          </DialogTitle>
          <DialogDescription>
            Search for children globally (any catchment area) and add them to your local register.
            Used when a mother moves into your area.
          </DialogDescription>
        </DialogHeader>

        {!isOnline && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You must be online to search globally and transfer children in.
            </AlertDescription>
          </Alert>
        )}

        {!selectedChild ? (
          <TransferInSearch disabled={!isOnline} onSelectChild={handleSelectChild} />
        ) : showPullConfirmation ? (
          <>
            {/* Force Pull Confirmation */}
            <div className="space-y-4">
              <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <AlertTitle className="text-amber-900 font-semibold">
                  Child Already Registered Elsewhere
                </AlertTitle>
                <AlertDescription className="text-amber-800 mt-2">
                  <strong>{selectedChild.childName}</strong> is currently registered in{" "}
                  <strong>Zone: {selectedChild.currentZoneName}</strong>.
                  <br /><br />
                  Do you want to <strong>forcefully initiate a Transfer In</strong>? This will:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Remove the child from their current catchment area</li>
                    <li>Add the child to your local register</li>
                    <li>Log a transfer-out for the old zone</li>
                    <li>Log a transfer-in for your zone</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-2 rounded-lg border p-3 bg-muted/50">
                <p className="text-sm">
                  <span className="font-semibold">Child:</span> {selectedChild.childName}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">CVCC ID:</span> {selectedChild.childId}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Current Zone:</span>{" "}
                  <span className="text-amber-700 font-medium">{selectedChild.currentZoneName}</span>
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Mother:</span> {selectedChild.motherName}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pull-notes">Reason for Pull Transfer</Label>
                <Textarea
                  id="pull-notes"
                  placeholder="e.g., Family relocated to this community, mother confirmed move..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setShowPullConfirmation(false)}
                  disabled={transferring}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleTransferIn(true)}
                  disabled={transferring || !isOnline}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {transferring ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Pulling...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Yes, Force Pull Transfer
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </>
        ) : (
          <>
            {/* Transfer Confirmation Section */}
            <div className="space-y-4">
              <Alert className={childRequiresPull ? "border-amber-200 bg-amber-50" : ""}>
                <CheckCircle2 className={`h-4 w-4 ${childRequiresPull ? "text-amber-600" : ""}`} />
                <AlertDescription className={childRequiresPull ? "text-amber-900" : ""}>
                  <strong>{selectedChild.childName}</strong> will be added to your local register.
                  {childRequiresPull && (
                    <span className="block mt-1 text-amber-700">
                      Note: This child is currently in <strong>{selectedChild.currentZoneName}</strong>.
                      You will need to confirm a force pull.
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              <div className="space-y-2 rounded-lg border p-3 bg-muted/50">
                <p className="text-sm">
                  <span className="font-semibold">CVCC ID:</span> {selectedChild.childId}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Date of Birth:</span> {selectedChild.dateOfBirth}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Mother:</span> {selectedChild.motherName}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Phone:</span> {selectedChild.motherPhone}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Previous Village:</span> {selectedChild.village}
                </p>
                {childRequiresPull && (
                  <p className="text-sm">
                    <span className="font-semibold">Current Zone:</span>{" "}
                    <Badge variant="secondary">{selectedChild.currentZoneName}</Badge>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer-notes">Transfer Notes (Optional)</Label>
                <Textarea
                  id="transfer-notes"
                  placeholder="e.g., Mother moved to this community last week..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

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

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedChild(null)}
                  disabled={transferring}
                  className="flex-1"
                >
                  Back to Search
                </Button>
                <Button
                  onClick={handleInitiateTransfer}
                  disabled={transferring || !isOnline}
                  className="flex-1"
                  variant="default"
                >
                  {transferring ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Transferring...
                    </>
                  ) : childRequiresPull ? (
                    <>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Initiate Pull Transfer
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Transfer In
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
