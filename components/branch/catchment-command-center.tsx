"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Loader2, MapPinned, Pencil, Trash2, UserCheck } from "lucide-react"
import L from "leaflet"
import { EditControl } from "react-leaflet-draw"
import { FeatureGroup, GeoJSON, MapContainer, TileLayer, Tooltip, useMap, Popup } from "react-leaflet"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  assignCatchmentAreaChw,
  createBranchCatchmentArea,
  deleteBranchCatchmentArea,
  getBranchCatchmentAreas,
  updateBranchCatchmentArea,
  type BranchCatchmentArea,
  type StaffMember,
} from "@/lib/api/branch-manager"

interface CatchmentCommandCenterProps {
  staffRoster: StaffMember[]
  branchRegion?: string
  onDataChanged?: () => void
}

const DEFAULT_GHANA_VIEW = {
  center: [7.9465, -1.0232] as [number, number],
  zoom: 7,
}

const REGION_MAP_VIEWS: Record<string, { center: [number, number]; zoom: number }> = {
  "greater accra": { center: [5.6037, -0.187], zoom: 10 },
  ashanti: { center: [6.6885, -1.6244], zoom: 9 },
  eastern: { center: [6.3812, -0.685], zoom: 9 },
  central: { center: [5.4494, -1.0586], zoom: 9 },
  western: { center: [5.0, -2.5], zoom: 8 },
  "western north": { center: [6.5, -2.9], zoom: 8 },
  volta: { center: [6.5781, 0.4502], zoom: 9 },
  oti: { center: [8.45, 0.2], zoom: 8 },
  northern: { center: [9.5, -0.85], zoom: 8 },
  "north east": { center: [10.65, -0.12], zoom: 8 },
  savannah: { center: [9.6, -1.95], zoom: 8 },
  upper_east: { center: [10.96, -0.85], zoom: 8 },
  "upper east": { center: [10.96, -0.85], zoom: 8 },
  upper_west: { center: [10.3, -2.5], zoom: 8 },
  "upper west": { center: [10.3, -2.5], zoom: 8 },
  bono: { center: [7.95, -2.45], zoom: 8 },
  bono_east: { center: [7.95, -1.7], zoom: 8 },
  "bono east": { center: [7.95, -1.7], zoom: 8 },
  ahafo: { center: [7.05, -2.55], zoom: 8 },
}

function normalizeRegionName(region?: string): string {
  return String(region ?? "")
    .toLowerCase()
    .replace(/region/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function resolveRegionMapView(region?: string): { center: [number, number]; zoom: number } {
  const normalized = normalizeRegionName(region)
  return REGION_MAP_VIEWS[normalized] ?? DEFAULT_GHANA_VIEW
}

function MapInstanceBridge({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap()

  useEffect(() => {
    onReady(map)
  }, [map, onReady])

  return null
}

function FitMapToZones({
  zones,
  fallbackCenter,
  fallbackZoom,
}: {
  zones: BranchCatchmentArea[]
  fallbackCenter: [number, number]
  fallbackZoom: number
}) {
  const map = useMap()

  useEffect(() => {
    const features = zones
      .map((zone) => zone.boundaries)
      .filter((feature): feature is NonNullable<BranchCatchmentArea["boundaries"]> => Boolean(feature))

    if (features.length === 0) {
      map.setView(fallbackCenter, fallbackZoom)
      return
    }

    const layerGroup = L.featureGroup(features.map((feature) => L.geoJSON(feature as any)))
    const bounds = layerGroup.getBounds()

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.12))
    }
  }, [fallbackCenter, fallbackZoom, map, zones])

  return null
}

export default function CatchmentCommandCenter({
  staffRoster,
  branchRegion,
  onDataChanged,
}: CatchmentCommandCenterProps) {
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const mapRef = useRef<L.DrawMap | null>(null)
  const polygonDrawRef = useRef<L.Draw.Polygon | null>(null)
  const [zones, setZones] = useState<BranchCatchmentArea[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingZone, setIsSavingZone] = useState(false)
  const [isUpdatingZone, setIsUpdatingZone] = useState(false)
  const [isDeletingZone, setIsDeletingZone] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [boundaryEditZoneId, setBoundaryEditZoneId] = useState<string | null>(null)
  const [zonePendingDelete, setZonePendingDelete] = useState<BranchCatchmentArea | null>(null)

  const [selectedZone, setSelectedZone] = useState<BranchCatchmentArea | null>(null)
  const [selectedChwId, setSelectedChwId] = useState("")

  const closeAssignModal = useCallback(() => {
    setSelectedZone(null)
    setSelectedChwId("")
  }, [])

  const activeChws = useMemo(
    () => staffRoster.filter((staff) => staff.role === "CHW" && staff.status === "active"),
    [staffRoster],
  )

  const loadZones = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await getBranchCatchmentAreas()
      setZones(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catchment areas.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadZones()
  }, [loadZones])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(null), 4000)
    return () => window.clearTimeout(timer)
  }, [message])

  const boundaryEditZone = useMemo(
    () => zones.find((zone) => zone.id === boundaryEditZoneId) ?? null,
    [zones, boundaryEditZoneId],
  )

  const mapView = useMemo(() => resolveRegionMapView(branchRegion), [branchRegion])

  const mappedZones = useMemo(
    () => zones.filter((zone) => Boolean(zone.boundaries)),
    [zones],
  )

  const zonesWithoutBoundaries = useMemo(
    () => zones.filter((zone) => !zone.boundaries),
    [zones],
  )

  const beginBoundaryEditForZone = useCallback((zone: BranchCatchmentArea) => {
    setBoundaryEditZoneId(zone.id)
    setError(null)
    setMessage(`Boundary edit mode enabled for \"${zone.name}\". Draw the replacement polygon on the map.`)
  }, [])

  const disablePolygonDraw = useCallback(() => {
    if (polygonDrawRef.current) {
      polygonDrawRef.current.disable()
      polygonDrawRef.current = null
    }
  }, [])

  const startPolygonDraw = useCallback(() => {
    const map = mapRef.current
    if (!map) return false

    disablePolygonDraw()

    const drawer = new L.Draw.Polygon(map as unknown as L.DrawMap, {
      allowIntersection: false,
      showArea: true,
      shapeOptions: {
        color: "#0ea5e9",
        weight: 2,
      },
    })

    polygonDrawRef.current = drawer
    drawer.enable()
    return true
  }, [disablePolygonDraw])

  useEffect(() => {
    if (!boundaryEditZoneId || isLoading) {
      disablePolygonDraw()
      return
    }

    const timer = window.setTimeout(() => {
      startPolygonDraw()
    }, 60)

    return () => window.clearTimeout(timer)
  }, [boundaryEditZoneId, disablePolygonDraw, isLoading, startPolygonDraw])

  const handlePersistNewZone = useCallback(
    async (geoJson: Record<string, any>) => {
      if (boundaryEditZoneId) {
        const zoneToUpdate = zones.find((zone) => zone.id === boundaryEditZoneId)

        if (!zoneToUpdate) {
          setBoundaryEditZoneId(null)
          setError("The selected zone for boundary edit could not be found.")
          return
        }

        setIsUpdatingZone(true)
        setError(null)

        try {
          const updated = await updateBranchCatchmentArea(zoneToUpdate.id, {
            boundaries: geoJson as any,
          })
          setZones((previous) => previous.map((zone) => (zone.id === updated.id ? updated : zone)))
          setMessage(`Zone \"${updated.name}\" boundary updated successfully.`)
          onDataChanged?.()
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to update catchment boundary.")
        } finally {
          setIsUpdatingZone(false)
          setBoundaryEditZoneId(null)
        }

        return
      }

      const zoneName = window.prompt("Enter catchment zone name")

      if (!zoneName || !zoneName.trim()) {
        setMessage("Catchment zone creation cancelled.")
        return
      }

      setIsSavingZone(true)
      setError(null)

      try {
        const created = await createBranchCatchmentArea({
          name: zoneName.trim(),
          boundaries: geoJson as any,
        })

        setZones((previous) => [created, ...previous])
        setMessage(`Zone \"${created.name}\" saved successfully.`)
        onDataChanged?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save catchment area.")
      } finally {
        setIsSavingZone(false)
      }
    },
    [boundaryEditZoneId, onDataChanged, zones],
  )

  const handleDrawCreated = useCallback(
    async (event: L.DrawEvents.Created) => {
      const createdLayer = event.layer as L.Layer & {
        toGeoJSON?: () => Record<string, any>
      }

      if (typeof createdLayer.toGeoJSON !== "function") {
        return
      }

      setError(null)
      await handlePersistNewZone(createdLayer.toGeoJSON())

      // Keep the draw layer clean; persisted zones come from API state.
      drawnItemsRef.current?.removeLayer(createdLayer)
      disablePolygonDraw()
    },
    [disablePolygonDraw, handlePersistNewZone],
  )

  const openAssignModal = useCallback(
    (zone: BranchCatchmentArea) => {
      setSelectedZone(zone)
      setSelectedChwId(zone.assignedChwId ?? activeChws[0]?.id ?? "")
      setError(null)
    },
    [activeChws],
  )

  const handleAssignChw = useCallback(async () => {
    if (!selectedZone || !selectedChwId) return

    setIsAssigning(true)
    setError(null)

    try {
      const updated = await assignCatchmentAreaChw(selectedZone.id, selectedChwId)
      setZones((previous) => previous.map((zone) => (zone.id === updated.id ? updated : zone)))
      setSelectedZone(updated)
      setMessage(`Assigned ${updated.name} to ${updated.assignedChwName ?? "selected CHW"}.`)
      onDataChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign CHW.")
    } finally {
      setIsAssigning(false)
    }
  }, [onDataChanged, selectedChwId, selectedZone])

  const handleRenameZone = useCallback(async () => {
    if (!selectedZone) return

    const renamed = window.prompt("Enter a new zone name", selectedZone.name)
    if (renamed === null) return

    const trimmedName = renamed.trim()
    if (!trimmedName) {
      setError("Zone name cannot be empty.")
      return
    }

    if (trimmedName === selectedZone.name) {
      setMessage("Zone name unchanged.")
      return
    }

    setIsUpdatingZone(true)
    setError(null)

    try {
      const updated = await updateBranchCatchmentArea(selectedZone.id, { name: trimmedName })
      setZones((previous) => previous.map((zone) => (zone.id === updated.id ? updated : zone)))
      setSelectedZone(updated)
      setMessage(`Zone renamed to \"${updated.name}\".`)
      onDataChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename zone.")
    } finally {
      setIsUpdatingZone(false)
    }
  }, [onDataChanged, selectedZone])

  const handleStartBoundaryEdit = useCallback(() => {
    if (!selectedZone) return

    beginBoundaryEditForZone(selectedZone)
    closeAssignModal()
  }, [beginBoundaryEditForZone, closeAssignModal, selectedZone])

  const handleRequestDeleteZone = useCallback(() => {
    if (!selectedZone) return
    setZonePendingDelete(selectedZone)
    closeAssignModal()
  }, [closeAssignModal, selectedZone])

  const handleDeleteZone = useCallback(async () => {
    if (!zonePendingDelete) return

    setIsDeletingZone(true)
    setError(null)

    try {
      const removed = await deleteBranchCatchmentArea(zonePendingDelete.id)
      setZones((previous) => previous.filter((zone) => zone.id !== zonePendingDelete.id))
      if (boundaryEditZoneId === zonePendingDelete.id) {
        setBoundaryEditZoneId(null)
      }
      setZonePendingDelete(null)
      setMessage(`Zone \"${removed.name}\" deleted successfully.`)
      onDataChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete zone.")
    } finally {
      setIsDeletingZone(false)
    }
  }, [boundaryEditZoneId, onDataChanged, zonePendingDelete])

  const assignedCount = useMemo(
    () => zones.filter((zone) => Boolean(zone.assignedChwId)).length,
    [zones],
  )

  const unassignedCount = zones.length - assignedCount

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPinned className="h-5 w-5 text-primary" /> Catchment Area Command Center
          </CardTitle>
          <CardDescription>
            Draw branch territory boundaries, then assign active CHWs to each zone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Total zones: {zones.length}</Badge>
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Assigned: {assignedCount}</Badge>
            <Badge className="bg-rose-600 text-white hover:bg-rose-600">Unassigned: {unassignedCount}</Badge>
            <Badge variant="outline">Visible on map: {mappedZones.length}</Badge>
            {boundaryEditZone ? (
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                {isUpdatingZone ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>
                  {isUpdatingZone
                    ? "Saving zone boundary..."
                    : `Editing boundary: ${boundaryEditZone.name}. Draw replacement polygon.`}
                </span>
                {!isUpdatingZone ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startPolygonDraw()}
                    >
                      Start drawing now
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setBoundaryEditZoneId(null)}
                    >
                      Cancel edit
                    </Button>
                  </>
                ) : null}
              </div>
            ) : isSavingZone ? (
              <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving new zone...
              </span>
            ) : (
              <span className="ml-auto text-xs text-muted-foreground">Use the map toolbar to draw a new polygon zone.</span>
            )}
          </div>

          {zonesWithoutBoundaries.length > 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {zonesWithoutBoundaries.length} zone(s) are not yet visible on the map because no boundaries were drawn.
              </AlertDescription>
            </Alert>
          ) : null}

          {zonesWithoutBoundaries.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-sm font-medium text-foreground">Zones without boundaries</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {zonesWithoutBoundaries.map((zone) => (
                  <Button
                    key={zone.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => beginBoundaryEditForZone(zone)}
                    disabled={isUpdatingZone || isSavingZone || isDeletingZone}
                  >
                    Set boundary: {zone.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {message ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="relative z-0 h-[500px] overflow-hidden rounded-xl border border-border">
            {isLoading ? (
              <div className="flex h-full items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading map zones...
              </div>
            ) : (
              <MapContainer center={mapView.center} zoom={mapView.zoom} style={{ height: "100%", width: "100%" }}>
                <MapInstanceBridge
                  onReady={(map) => {
                    mapRef.current = map as L.DrawMap
                  }}
                />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <FeatureGroup ref={drawnItemsRef}>
                  <EditControl
                    position="topright"
                    onCreated={handleDrawCreated}
                    draw={{
                      polyline: false,
                      rectangle: false,
                      circle: false,
                      marker: false,
                      circlemarker: false,
                      polygon: {
                        allowIntersection: false,
                        showArea: true,
                      },
                    }}
                    edit={{
                      edit: false,
                      remove: false,
                    }}
                  />
                </FeatureGroup>

                {mappedZones.map((zone) => {
                  const color = zone.assignedChwId ? "#16a34a" : "#dc2626"

                  return (
                    <GeoJSON
                      key={zone.id}
                      data={zone.boundaries as any}
                      style={{
                        color,
                        fillColor: color,
                        fillOpacity: 0.3,
                        weight: 2,
                      }}
                    >
                      <Tooltip sticky>
                        <div className="flex flex-col items-center gap-0.5 p-1 text-center font-sans">
                          <span className="text-sm font-bold">{zone.name}</span>
                          <span className="text-xs text-muted-foreground">{zone.assignedChwName ?? "Unassigned"}</span>
                          <span className="text-[10px] font-medium text-primary/80">(Click to view)</span>
                        </div>
                      </Tooltip>
                      <Popup>
                        <div className="min-w-[200px] font-sans">
                          <div className="mb-3 border-b pb-2">
                            <h3 className="text-lg font-bold leading-none">{zone.name}</h3>
                            <div className="mt-1 flex items-center gap-2 text-xs">
                              <span
                                className={`font-medium ${
                                  zone.assignedChwId ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                {zone.assignedChwName ?? "Unassigned"}
                              </span>
                            </div>
                          </div>

                          <div className="mb-4 grid grid-cols-3 gap-2">
                            <div className="flex flex-col items-center rounded-md border border-blue-100 bg-blue-50/50 p-2 text-center">
                              <span className="text-[10px] font-bold uppercase text-blue-600">Active</span>
                              <span className="mt-1 text-lg font-bold leading-none text-blue-700">
                                {zone.stats?.activeChildren ?? 0}
                              </span>
                            </div>

                            <div className="flex flex-col items-center rounded-md border border-emerald-100 bg-emerald-50/50 p-2 text-center">
                              <span className="text-[10px] font-bold uppercase text-emerald-600">In</span>
                              <span className="mt-1 text-lg font-bold leading-none text-emerald-700">
                                {zone.stats?.transferredIn ?? 0}
                              </span>
                            </div>

                            <div className="flex flex-col items-center rounded-md border border-rose-100 bg-rose-50/50 p-2 text-center">
                              <span className="text-[10px] font-bold uppercase text-rose-600">Out</span>
                              <span className="mt-1 text-lg font-bold leading-none text-rose-700">
                                {zone.stats?.transferredOut ?? 0}
                              </span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            className="h-8 w-full text-xs"
                            onClick={() => openAssignModal(zone)}
                          >
                            Manage Zone
                          </Button>
                        </div>
                      </Popup>
                    </GeoJSON>
                  )
                })}

                <FitMapToZones
                  zones={mappedZones}
                  fallbackCenter={mapView.center}
                  fallbackZoom={mapView.zoom}
                />
              </MapContainer>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Draw a polygon using the toolbar to create zones. Click a zone to assign CHW, rename, edit boundary, or delete.
          </p>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedZone)}
        onOpenChange={(open) => {
          if (!open) {
            closeAssignModal()
          }
        }}
      >
        <DialogContent className="z-[1100] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> Assign CHW to Zone
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">{selectedZone?.name}</p>
              <p className="mt-1 text-muted-foreground">
                Current: {selectedZone?.assignedChwName ?? "Unassigned"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assign-chw">Active CHW</Label>
              <select
                id="assign-chw"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedChwId}
                onChange={(event) => setSelectedChwId(event.target.value)}
              >
                <option value="">Select CHW...</option>
                {activeChws.map((chw) => (
                  <option key={chw.id} value={chw.id}>
                    {chw.name}
                  </option>
                ))}
              </select>
            </div>

            {activeChws.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No active CHWs are available in this branch. Activate or register a CHW first.
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handleRenameZone}
                disabled={isAssigning || isUpdatingZone || isDeletingZone}
              >
                {isUpdatingZone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                Rename
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleStartBoundaryEdit}
                disabled={isAssigning || isUpdatingZone || isDeletingZone}
              >
                Edit boundary
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                onClick={handleRequestDeleteZone}
                disabled={isAssigning || isUpdatingZone || isDeletingZone}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={closeAssignModal}
                disabled={isAssigning || isUpdatingZone || isDeletingZone}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignChw}
                disabled={isAssigning || isUpdatingZone || isDeletingZone || !selectedChwId}
                className="gap-2"
              >
                {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isAssigning ? "Assigning..." : "Assign CHW"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(zonePendingDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingZone) {
            setZonePendingDelete(null)
          }
        }}
      >
        <DialogContent className="z-[1100] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Catchment Zone</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Delete catchment zone &quot;{zonePendingDelete?.name}&quot;? This action cannot be undone.
          </p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setZonePendingDelete(null)}
              disabled={isDeletingZone}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteZone}
              disabled={isDeletingZone}
              className="gap-2"
            >
              {isDeletingZone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isDeletingZone ? "Deleting..." : "Delete zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
