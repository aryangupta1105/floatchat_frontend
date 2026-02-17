import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface FloatData {
  id: string;
  lat: number;
  lon: number;
  basin?: string;
}

interface SpatialMapProps {
  data?: {
    rows?: FloatData[];
  };
}

const SpatialMap: React.FC<SpatialMapProps> = ({ data }) => {
  const floats =
    data?.rows && data.rows.length > 0
      ? data.rows
      : [
          { id: "2903320", lat: -10.5, lon: 78.2, basin: "Indian Ocean" },
          { id: "2903321", lat: 5.2, lon: 65.4, basin: "Arabian Sea" },
          { id: "2903322", lat: 12.3, lon: 90.1, basin: "Bay of Bengal" }
        ];

  return (
    <div className="w-full h-full rounded-xl overflow-hidden">
      <MapContainer
        center={[0, 80]}
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
                <div>Basin: {f.basin}</div>
                <div>
                  Lat: {f.lat.toFixed(2)}, Lon: {f.lon.toFixed(2)}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default SpatialMap;
