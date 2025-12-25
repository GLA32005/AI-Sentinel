import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { NetworkGraphData, NetworkNode, NetworkLink } from '../types';

interface NetworkGraphProps {
  data: NetworkGraphData;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("max-width", "100%")
      .style("height", "auto");

    // Click on background to deselect
    svg.on("click", () => {
        setSelectedNodeId(null);
    });

    // Simulation
    const simulation = d3.forceSimulation(data.nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(30));

    // Links
    const link = svg.append("g")
      .attr("stroke", "#334155") // Slate 700
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("class", "network-link transition-all duration-300")
      .attr("stroke-width", (d) => Math.sqrt(d.value));

    // Node Groups
    const nodeGroup = svg.append("g")
      .selectAll("g")
      .data(data.nodes)
      .join("g")
      .attr("id", d => `node-${d.id}`)
      .attr("class", "network-node cursor-pointer transition-opacity duration-300")
      .call(drag(simulation) as any)
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedNodeId(prev => prev === d.id ? null : d.id);
      });

    // Status Halo
    nodeGroup.append("circle")
      .attr("r", 15)
      .attr("fill", (d) => {
        if (d.status === 'secure') return "#10b981"; // Green
        if (d.status === 'vulnerable') return "#f59e0b"; // Amber
        if (d.status === 'compromised') return "#ef4444"; // Red
        return "#64748b"; // Slate
      })
      .attr("opacity", 0.3)
      .attr("class", (d) => d.status === 'vulnerable' || d.status === 'compromised' ? "animate-pulse" : "");

    // Core Node
    nodeGroup.append("circle")
      .attr("r", 8)
      .attr("fill", (d) => {
        if (d.group === 1) return "#3b82f6"; // Blue (Gateway)
        if (d.group === 2) return "#8b5cf6"; // Purple (Server)
        if (d.group === 3) return "#ec4899"; // Pink (DB)
        return "#94a3b8"; // Slate (Workstation)
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    // Labels
    nodeGroup.append("text")
      .text((d) => d.label)
      .attr("x", 12)
      .attr("y", 4)
      .attr("fill", "#e2e8f0")
      .style("font-size", "10px")
      .style("font-family", "JetBrains Mono");

    // IP Labels
    nodeGroup.append("text")
      .text((d) => d.ip)
      .attr("x", 12)
      .attr("y", 16)
      .attr("fill", "#94a3b8")
      .style("font-size", "8px")
      .style("font-family", "JetBrains Mono");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [data]);

  // Effect to handle highlighting separately from simulation
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    if (!selectedNodeId) {
       // Reset styles
       svg.selectAll(".network-node").transition().duration(300).style("opacity", 1);
       svg.selectAll(".network-node circle:last-of-type") // Target the core node circle
          .transition().duration(300)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5);
       svg.selectAll(".network-link").transition().duration(300).style("opacity", 0.6).attr("stroke", "#334155");
       return;
    }

    // 1. Fade everything out
    svg.selectAll(".network-node").transition().duration(300).style("opacity", 0.1);
    // Reset strokes on faded nodes to avoid confusion if quick switching
    svg.selectAll(".network-node circle:last-of-type")
       .transition().duration(300)
       .attr("stroke", "#fff")
       .attr("stroke-width", 1.5);
       
    svg.selectAll(".network-link").transition().duration(300).style("opacity", 0.05).attr("stroke", "#334155");

    // 2. Highlight selected node
    const selectedNodeSelection = svg.select(`#node-${selectedNodeId}`);
    selectedNodeSelection.transition().duration(300).style("opacity", 1);
    selectedNodeSelection.select("circle:last-of-type")
       .transition().duration(300)
       .attr("stroke", "#3b82f6") // Neon Blue for selected
       .attr("stroke-width", 3);

    // 3. Identify and Highlight Connections
    const connectedNodeIds = new Set<string>();
    
    svg.selectAll(".network-link")
       .filter((d: any) => {
           // D3 replaces source/target string IDs with object references after simulation starts
           const sourceId = d.source.id || d.source;
           const targetId = d.target.id || d.target;
           const isConnected = sourceId === selectedNodeId || targetId === selectedNodeId;
           if (isConnected) {
               connectedNodeIds.add(sourceId === selectedNodeId ? targetId : sourceId);
           }
           return isConnected;
       })
       .transition().duration(300)
       .style("opacity", 1)
       .attr("stroke", "#3b82f6"); // Blue Links

    // 4. Highlight Neighbors
    connectedNodeIds.forEach(id => {
        const neighbor = svg.select(`#node-${id}`);
        neighbor.transition().duration(300).style("opacity", 1);
        neighbor.select("circle:last-of-type")
            .transition().duration(300)
            .attr("stroke", "#f59e0b") // Amber for neighbors
            .attr("stroke-width", 2.5);
    });

  }, [selectedNodeId, data]);

  const selectedNode = data.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-lg bg-slate-900 border border-slate-800 shadow-inner group">
      <div className="absolute top-4 left-4 z-10 bg-slate-950/80 backdrop-blur px-3 py-1 rounded text-xs font-mono text-slate-400 border border-slate-800 pointer-events-none">
        World Model // 网络拓扑
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"></svg>

      {/* Node Details Info Box */}
      {selectedNode && (
          <div className="absolute bottom-4 right-4 z-20 w-64 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg p-4 shadow-2xl animate-in slide-in-from-right-4 fade-in duration-300">
             <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-200">{selectedNode.label}</h3>
                <button onClick={() => setSelectedNodeId(null)} className="text-slate-500 hover:text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
             </div>
             <div className="space-y-2 text-xs font-mono">
                 <div className="flex justify-between">
                    <span className="text-slate-500">IP Address:</span>
                    <span className="text-slate-300">{selectedNode.ip}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-slate-500">Status:</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                        selectedNode.status === 'secure' ? 'bg-emerald-500/20 text-emerald-400' :
                        selectedNode.status === 'vulnerable' ? 'bg-amber-500/20 text-amber-400' :
                        selectedNode.status === 'compromised' ? 'bg-red-500/20 text-red-400' :
                        'bg-slate-700 text-slate-400'
                    }`}>
                        {selectedNode.status}
                    </span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-500">Risk Score:</span>
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500" style={{width: `${selectedNode.riskScore || (selectedNode.status === 'secure' ? 5 : selectedNode.status === 'vulnerable' ? 65 : selectedNode.status === 'compromised' ? 95 : 0)}%`}}></div>
                        </div>
                        <span className="text-indigo-400">{selectedNode.riskScore || (selectedNode.status === 'secure' ? 5 : selectedNode.status === 'vulnerable' ? 65 : selectedNode.status === 'compromised' ? 95 : 0)}</span>
                    </div>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-500">Type:</span>
                    <span className="text-slate-400">
                        {selectedNode.group === 1 ? 'Gateway' : 
                         selectedNode.group === 2 ? 'Server' : 
                         selectedNode.group === 3 ? 'Database' : 'Workstation'}
                    </span>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default NetworkGraph;