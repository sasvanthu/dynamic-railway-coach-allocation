import { useEffect, useRef } from "react";
import * as d3 from "d3";

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

export default function NetworkGraph({ nodes, edges, width = 600, height = 400 }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const linkData = edges
      .map((e) => ({ ...e, source: e.source, target: e.target }))
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target));

    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(linkData).id((d: d3.SimulationNodeDatum) => (d as NetworkNode).id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(35));

    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M 0,-5 L 10,0 L 0,5")
      .attr("fill", "#6b7280");

    const link = svg.append("g")
      .selectAll("line")
      .data(linkData)
      .join("line")
      .attr("stroke", (d) => demandColor[d.demand_level] ?? "#6b7280")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowhead)");

    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(
        d3.drag<SVGGElement, NetworkNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            (d as d3.SimulationNodeDatum).fx = (d as d3.SimulationNodeDatum).x;
            (d as d3.SimulationNodeDatum).fy = (d as d3.SimulationNodeDatum).y;
          })
          .on("drag", (event, d) => {
            (d as d3.SimulationNodeDatum).fx = event.x;
            (d as d3.SimulationNodeDatum).fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            (d as d3.SimulationNodeDatum).fx = null;
            (d as d3.SimulationNodeDatum).fy = null;
          }) as never
      );

    node.append("circle")
      .attr("r", (d) => 12 + d.crowd_density * 14)
      .attr("fill", (d) => zoneColor[d.zone] ?? "#6b7280")
      .attr("fill-opacity", 0.25)
      .attr("stroke", (d) => zoneColor[d.zone] ?? "#6b7280")
      .attr("stroke-width", 2);

    node.append("circle")
      .attr("r", 6)
      .attr("fill", (d) => zoneColor[d.zone] ?? "#6b7280");

    node.append("text")
      .attr("dy", -20)
      .attr("text-anchor", "middle")
      .attr("fill", "#e4e4e7")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .text((d) => d.code);

    node.append("title").text((d) => `${d.name}\nZone: ${d.zone}\nCrowd: ${Math.round(d.crowd_density * 100)}%`);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as d3.SimulationNodeDatum).x ?? 0)
        .attr("y1", (d) => (d.source as d3.SimulationNodeDatum).y ?? 0)
        .attr("x2", (d) => (d.target as d3.SimulationNodeDatum).x ?? 0)
        .attr("y2", (d) => (d.target as d3.SimulationNodeDatum).y ?? 0);

      node.attr("transform", (d) => `translate(${(d as d3.SimulationNodeDatum).x ?? 0},${(d as d3.SimulationNodeDatum).y ?? 0})`);
    });

    return () => { simulation.stop(); };
  }, [nodes, edges, width, height]);

  return <svg ref={svgRef} className="w-full" style={{ height }} />;
}
