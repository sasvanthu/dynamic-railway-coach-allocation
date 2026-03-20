import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";

interface NetworkNode {
  id: number;
  code: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  crowd_density: number;
}

interface NetworkEdge {
  source: number;
  target: number;
  route_name: string;
  distance_km: number;
  demand_level: string;
}

interface NetworkGraphProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  width?: number;
  height?: number;
}

const demandColor: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#10b981",
};

const zoneColor: Record<string, string> = {
  North: "#3b82f6",
  South: "#10b981",
  East: "#f59e0b",
  West: "#8b5cf6",
  Central: "#ec4899",
};

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(points, { padding: [24, 24], maxZoom: 7 });
  }, [map, points]);

  return null;
}

export default function NetworkGraph({ nodes, edges, height = 400 }: NetworkGraphProps) {
  const mapHeight = typeof height === "number" ? `${height}px` : height;

  const center = useMemo<[number, number]>(() => {
    if (!nodes.length) return [22.5, 79.0];
    const lat = nodes.reduce((sum, node) => sum + node.lat, 0) / nodes.length;
    const lng = nodes.reduce((sum, node) => sum + node.lng, 0) / nodes.length;
    return [lat, lng];
  }, [nodes]);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const routeLines = useMemo(
    () =>
      edges
        .map((edge, index) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;

          return {
            id: `${edge.source}-${edge.target}-${index}`,
            edge,
            source,
            target,
            positions: [
              [source.lat, source.lng] as [number, number],
              [target.lat, target.lng] as [number, number],
            ],
          };
        })
        .filter((entry): entry is { id: string; edge: NetworkEdge; source: NetworkNode; target: NetworkNode; positions: [number, number][] } => Boolean(entry)),
    [edges, nodeMap]
  );

  if (!nodes.length) {
    return (
      <div className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 flex items-center justify-center text-sm text-zinc-500" style={{ height: mapHeight }}>
        Network map unavailable
      </div>
    );
  }

  const fitPoints: Array<[number, number]> = nodes.map((node) => [node.lat, node.lng]);

  return (
    <div className="w-full rounded-lg border border-zinc-800 overflow-hidden" style={{ height: mapHeight }}>
      <MapContainer center={center} zoom={5} scrollWheelZoom className="h-full w-full" zoomControl>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO'
        />
        <FitBounds points={fitPoints} />

        {routeLines.map((line) => (
          <Polyline
            key={line.id}
            positions={line.positions}
            pathOptions={{
              color: demandColor[line.edge.demand_level] ?? "#6b7280",
              weight: 3,
              opacity: 0.85,
            }}
          >
            <Tooltip sticky>
              <div className="text-xs">
                <div className="font-semibold">{line.edge.route_name}</div>
                <div>{Math.round(line.edge.distance_km)} km</div>
                <div className="capitalize">{line.edge.demand_level} demand corridor</div>
              </div>
            </Tooltip>
          </Polyline>
        ))}

        {nodes.map((node) => {
          const color = zoneColor[node.zone] ?? "#6b7280";
          const radius = 6 + node.crowd_density * 8;

          return (
            <CircleMarker
              key={node.id}
              center={[node.lat, node.lng]}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.45,
                weight: 2,
              }}
            >
              <Tooltip direction="top">{node.code}</Tooltip>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{node.name}</p>
                  <p className="text-xs text-zinc-600">Zone: {node.zone}</p>
                  <p className="text-xs text-zinc-600">Crowd density: {Math.round(node.crowd_density * 100)}%</p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
