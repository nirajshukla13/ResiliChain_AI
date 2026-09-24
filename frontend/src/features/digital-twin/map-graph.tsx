import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { type NetworkNode, type NodeType } from "@/types";

// Fix for default leaflet icons not loading in React
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// A dictionary of known cities from our seeded database to rough coordinates
const CITY_COORDINATES: Record<string, [number, number]> = {
  // Suppliers
  Shenzhen: [22.5431, 114.0579],
  Ningbo: [29.8683, 121.5440],
  Mumbai: [19.0760, 72.8777],
  Istanbul: [41.0082, 28.9784],
  Porto: [41.1579, -8.6291],
  Lodz: [51.7592, 19.4560],
  Duisburg: [51.4344, 6.7623],
  Lyon: [45.7640, 4.8357],
  Milan: [45.4642, 9.1900],
  Sheffield: [53.3811, -1.4701],
  
  // Factories
  Birmingham: [52.4862, -1.8904],
  Leeds: [53.8008, -1.5491],
  Rotterdam: [51.9225, 4.4792],
  Hamburg: [53.5511, 9.9937],
  Dublin: [53.3498, -6.2603],
  
  // Warehouses
  London: [51.5074, -0.1278],
  Manchester: [53.4808, -2.2426],
  Bristol: [51.4545, -2.5879],
  Paris: [48.8566, 2.3522],
  Frankfurt: [50.1109, 8.6821],
  Amsterdam: [52.3676, 4.9041],
  Madrid: [40.4168, -3.7038],
  Zurich: [47.3769, 8.5417],
};

const NODE_COLORS: Record<NodeType, string> = {
  supplier: "#3b82f6", // blue
  factory: "#f59e0b", // amber
  warehouse: "#8b5cf6", // purple
  retail_store: "#10b981", // green
};

// Create custom colored markers with optional risk indicator
const createCustomIcon = (color: string, riskLevel?: string) => {
  const isHighRisk = riskLevel === "high" || riskLevel === "critical";
  
  return L.divIcon({
    className: "custom-icon bg-transparent border-none",
    html: `
      <div class="relative w-full h-full">
        ${isHighRisk ? '<div class="absolute -inset-1.5 rounded-full bg-destructive/50 animate-ping"></div>' : ''}
        <div 
          class="absolute inset-0 rounded-full shadow-sm z-10 ${isHighRisk ? 'border-2 border-destructive' : 'border-2 border-white'}" 
          style="background-color: ${color};"
        ></div>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

interface MapGraphProps {
  nodes: NetworkNode[];
  edges: any[];
  onNodeClick: (node: NetworkNode) => void;
}

export function MapGraph({ nodes, edges, onNodeClick }: MapGraphProps) {
  // Filter nodes that have valid city coordinates
  const validNodes = nodes.filter((node) => node.city && CITY_COORDINATES[node.city]);

  return (
    <>
      <MapContainer
        center={[48.8566, 2.3522]} // Center roughly over Europe
        zoom={4}
        style={{ height: "100%", width: "100%", borderRadius: "inherit" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_3w4g_1_d10b34279e1987991cf22eb2"
        />
        
        {/* Edges */}
        {edges.map((edge) => {
          const sourceNode = validNodes.find((n) => n.id === edge.source);
          const targetNode = validNodes.find((n) => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;
          
          const sourceCoords = CITY_COORDINATES[sourceNode.city as string];
          const targetCoords = CITY_COORDINATES[targetNode.city as string];
          if (!sourceCoords || !targetCoords) return null;

          const isDisrupted = edge.status === "disrupted";
          
          return (
            <Polyline
              key={edge.id}
              positions={[sourceCoords, targetCoords]}
              color={isDisrupted ? "#dc2626" : "#94a3b8"}
              weight={isDisrupted ? 3 : 1.5}
              opacity={isDisrupted ? 0.9 : 0.6}
              dashArray={isDisrupted ? "5, 5" : undefined}
            />
          );
        })}

        {/* Nodes */}
        {validNodes.map((node) => {
          const coords = CITY_COORDINATES[node.city as string];
          return (
            <Marker
              key={node.id}
              position={coords}
              icon={createCustomIcon(NODE_COLORS[node.type], node.risk_level)}
              eventHandlers={{
                click: () => onNodeClick(node),
              }}
            >
              <Popup>
                <div className="font-medium">{node.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{node.type}</div>
                <div className="text-xs mt-1">Status: {node.status}</div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute bottom-6 left-6 z-[400] rounded-md bg-background/95 p-3 shadow-lg border backdrop-blur-sm">
        <h4 className="text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Map Legend</h4>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: NODE_COLORS.supplier }}></div>
            <span>Supplier</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: NODE_COLORS.factory }}></div>
            <span>Factory</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: NODE_COLORS.warehouse }}></div>
            <span>Warehouse</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="relative w-3 h-3 mx-0.5">
              <div className="absolute -inset-1 rounded-full bg-destructive/50 animate-ping"></div>
              <div className="absolute inset-0 rounded-full border-2 border-destructive bg-muted"></div>
            </div>
            <span className="text-destructive font-medium text-xs">High Risk Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 border-t-[3px] border-dashed border-red-600"></div>
            <span className="text-red-600 font-medium text-xs">Disrupted Route</span>
          </div>
        </div>
      </div>
    </>
  );
}
