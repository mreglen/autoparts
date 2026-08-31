import React, { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function MapResizeOnMount() {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

export default function PartDetailMap({ latitude, longitude }) {
  const position = [latitude, longitude];

  return (
    <MapContainer
      center={position}
      zoom={15}
      scrollWheelZoom={false}
      attributionControl={false}
      className="part-detail-map h-[260px] w-full [&_.leaflet-control-attribution]:hidden"
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={position} />
      <MapResizeOnMount />
    </MapContainer>
  );
}
