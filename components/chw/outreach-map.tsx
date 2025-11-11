"use client"

import { useEffect, useMemo, type ComponentType } from "react"
import L from "leaflet"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"

import "leaflet/dist/leaflet.css"

const MapContainerAny = MapContainer as unknown as ComponentType<any>
const TileLayerAny = TileLayer as unknown as ComponentType<any>
const MarkerAny = Marker as unknown as ComponentType<any>
const PopupAny = Popup as unknown as ComponentType<any>

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

L.Marker.prototype.options.icon = defaultIcon

type OutreachMapEntry = {
  childId: string
  childName: string
  vaccineId: string
  vaccineName: string
  recordedDate: string
  latitude: number
  longitude: number
}

type OutreachMapProps = {
  entries: OutreachMapEntry[]
}

const defaultCenter: [number, number] = [8.145, -1.207]

export function OutreachMap({ entries }: OutreachMapProps) {
  const positions = useMemo(() => entries.map((entry) => [entry.latitude, entry.longitude] as [number, number]), [entries])

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <MapContainerAny
        center={defaultCenter}
        zoom={6}
        scrollWheelZoom={false}
        style={{ height: "260px", width: "100%" }}
        className="bg-muted"
      >
        <TileLayerAny
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMapBounds positions={positions} />
        {entries.map((entry) => (
          <MarkerAny key={`${entry.childId}-${entry.vaccineId}-${entry.recordedDate}`} position={[entry.latitude, entry.longitude]}>
            <PopupAny>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{entry.childName}</p>
                <p>{entry.vaccineName}</p>
                <p className="text-xs text-muted-foreground">{entry.recordedDate}</p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {entry.latitude.toFixed(6)}, {entry.longitude.toFixed(6)}
                </p>
              </div>
            </PopupAny>
          </MarkerAny>
        ))}
      </MapContainerAny>
    </div>
  )
}

function FitMapBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    if (positions.length === 0) {
      map.setView(defaultCenter, 6)
      return
    }

    const bounds = L.latLngBounds(positions)
    map.fitBounds(bounds.pad(0.2))
  }, [positions, map])

  return null
}
