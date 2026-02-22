"use client"

import { useState } from "react"
import { Search, UserPlus, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useNetworkStatus } from "@/lib/hooks/use-network-status"
import { queueTransferIn, upsertChildren } from "@/lib/chw-offline/db"
import { searchAllChwChildren } from "@/lib/api/chw"
import { API_BASE_URL } from "@/lib/api/config"
import type { OfflineChild } from "@/lib/chw-offline/db"

type SearchResult = {
  id: string
  childId: string
  childName: string
  motherName: string
  motherPhone: string
  nextVaccine: string
  village: string
  dateOfBirth: string
  gender: string
  inMyCatchment?: boolean
}

type TransferInModalProps = {
  open: boolean
  onClose: () => void
  onSuccess?: (childId: string) => void
}

export function TransferInModal({ open, onClose, onSuccess }: TransferInModalProps) {
  const { isOnline } = useNetworkStatus()
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedChild, setSelectedChild] = useState<SearchResult | null>(null)
  const [notes, setNotes] = useState("")
  const [transferring, setTransferring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a name, CVCC ID, or phone number")
      return
    }

    if (!isOnline) {
      setError("You must be online to search for children globally")
      return
    }

    setSearching(true)
    setError(null)
    setSearchResults([])

    try {
      const results = await searchAllChwChildren(searchQuery)
      setSearchResults(results)

      if (results.length === 0) {
        setError("No children found matching your search")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setSearching(false)
    }
  }

  const handleTransferIn = async () => {
    if (!selectedChild) return

    setTransferring(true)
    setError(null)
    setSuccess(null)

    try {
      if (isOnline) {
        // Online: Make API call to transfer in
        const token = localStorage.getItem("accessToken")
        const response = await fetch(`${API_BASE_URL}/chw/children/${selectedChild.id}/transfer-in`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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

        const result = await response.json()

        // Add child to local Dexie register
        const childData: OfflineChild = {
          id: selectedChild.id,
          cvccId: selectedChild.childId,
          fullName: selectedChild.childName,
          dateOfBirth: selectedChild.dateOfBirth,
          gender: selectedChild.gender as OfflineChild["gender"],
          guardianName: selectedChild.motherName,
          guardianPhone: selectedChild.motherPhone,
          catchmentAreaId: result.newCatchment || undefined,
          updatedAt: new Date().toISOString(),
        }

        await upsertChildren([childData])

        setSuccess(`${selectedChild.childName} transferred in successfully! Now in your local register.`)
        
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
    setSearchQuery("")
    setSearchResults([])
    setSelectedChild(null)
    setNotes("")
    setError(null)
    setSuccess(null)
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
          <>
            {/* Search Section */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name, CVCC ID, or phone number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  disabled={!isOnline || searching}
                />
                <Button onClick={handleSearch} disabled={!isOnline || searching}>
                  {searching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </>
                  )}
                </Button>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Found {searchResults.length} child{searchResults.length !== 1 ? "ren" : ""}
                  </p>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {searchResults.map((child) => (
                      <div
                        key={child.id}
                        className="border rounded-lg p-3 hover:bg-primary/5 hover:border-primary/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedChild(child)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-semibold">{child.childName}</p>
                            <p className="text-sm text-muted-foreground">
                              CVCC ID: {child.childId}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Mother: {child.motherName} ({child.motherPhone})
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Village: {child.village}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Next Vaccine: {child.nextVaccine}
                            </p>
                          </div>
                          <Button size="sm" variant="outline">
                            Select
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Transfer Confirmation Section */}
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>{selectedChild.childName}</strong> will be added to your local register.
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
                  onClick={handleTransferIn}
                  disabled={transferring || !isOnline}
                  className="flex-1"
                >
                  {transferring ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Transferring...
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
