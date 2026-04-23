import L from "leaflet";
import "leaflet/dist/leaflet.css";
import React from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

// Fix Leaflet default broken marker icons in Vite/webpack builds
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

interface SpatialMapProps {
  data?: {
    rows?: any[];
  };
}

const SpatialMap: React.FC<SpatialMapProps> = ({ data }) => {
  // Normalize backend rows: support both {lat,lon,id} and {latitude,longitude,platform_number}
  const rawRows = data?.rows && data.rows.length > 0 ? data.rows : null;

  const floats = rawRows
    ? rawRows
        .map((r: any) => ({
          id:  r.platform_number || r.float_id || r.id || "?",
          lat: Number(r.latitude  ?? r.lat  ?? 0),
          lon: Number(r.longitude ?? r.lon  ?? 0),
          basin: r.basin || r.ocean || r.data_centre || ""
        }))
        .filter(f => f.lat !== 0 || f.lon !== 0)
    : [
        { id: "2903320", lat: -10.5, lon: 78.2, basin: "Indian Ocean" },
        { id: "2903321", lat:   5.2, lon: 65.4, basin: "Arabian Sea"  },
        { id: "2903322", lat:  12.3, lon: 90.1, basin: "Bay of Bengal"}
      ];

  // Compute map center from data
  const centerLat = floats.reduce((s, f) => s + f.lat, 0) / floats.length;
  const centerLon = floats.reduce((s, f) => s + f.lon, 0) / floats.length;

  return (
    <div className="w-full h-full rounded-xl overflow-hidden">
      <MapContainer
        center={[centerLat || 0, centerLon || 80]}
        zoom={3}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {floats.map((f) => (
          <Marker key={f.id} position={[f.lat, f.lon]}>
            <Popup>
              <div className="text-xs">
                <div className="font-semibold">ARGO Float {f.id}</div>
                {f.basin && <div>Basin: {f.basin}</div>}
                <div>Lat: {f.lat.toFixed(3)}, Lon: {f.lon.toFixed(3)}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default SpatialMap;
