import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { NetworkGraphData, NetworkNode } from '../types';

interface NetworkGraphProps {
  data: NetworkGraphData;
  onScanNode: (label: string) => void;
  onIsolateNode: (label: string) => void;
  onRemediateNode: (label: string) => void;
}

// Visual Config
const LAYER_HEIGHT = 60; // Height difference between layers
const NODE_SIZE = 4;
const HOVER_SCALE = 1.5;

// Extended D3 Types to avoid TS errors
interface SimulationNode extends NetworkNode, d3.SimulationNodeDatum {}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  source: string | SimulationNode;
  target: string | SimulationNode;
  value: number;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, onScanNode, onIsolateNode, onRemediateNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
      visible: boolean;
      x: number;
      y: number;
      nodeId: string;
      label: string;
  } | null>(null);

  // Three.js Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const animationFrameRef = useRef<number>(0);
  
  // Object Store (Map ID to Mesh)
  const nodeMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const nodeGlowsRef = useRef<Map<string, THREE.Sprite>>(new Map());
  const linkLinesRef = useRef<THREE.LineSegments | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  
  // Data Refs for simulation
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  const nodesDataRef = useRef<SimulationNode[]>([]);
  const linksDataRef = useRef<SimulationLink[]>([]);
  
  // HTML Overlay Refs (for Labels)
  const labelsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    // --- 1. Init Three.js Scene ---
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617); // Slate 950
    // Add subtle fog for depth
    scene.fog = new THREE.FogExp2(0x020617, 0.002);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(100, 80, 100); // Slightly lower angle for better depth
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }); // Antialias off for Bloom performance
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    containerRef.current.appendChild(renderer.domElement);

    // --- POST PROCESSING (BLOOM) ---
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.2; // Only bright things glow
    bloomPass.strength = 1.2; // Intensity
    bloomPass.radius = 0.5; // Spread

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.maxDistance = 400;
    controls.minDistance = 20;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1); // Dimmer ambient to make bloom pop
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(50, 100, 50);
    scene.add(pointLight);

    // Helpers (Grid at bottom)
    const gridHelper = new THREE.GridHelper(400, 40, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -100; // Lower grid
    scene.add(gridHelper);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    // Resize Handler
    const handleResize = () => {
        if (!containerRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      composer.dispose();
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      if (simulationRef.current) simulationRef.current.stop();
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // --- 2. Handle Data & Simulation ---
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Clone data
    const nodes: SimulationNode[] = data.nodes.map(n => ({ ...n }));
    const links: SimulationLink[] = data.links.map(l => ({ ...l }));
    nodesDataRef.current = nodes;
    linksDataRef.current = links;

    // Clear previous meshes
    nodeMeshesRef.current.forEach(mesh => scene.remove(mesh));
    nodeMeshesRef.current.clear();
    nodeGlowsRef.current.forEach(sprite => scene.remove(sprite));
    nodeGlowsRef.current.clear();
    if (linkLinesRef.current) scene.remove(linkLinesRef.current);
    if (particleSystemRef.current) scene.remove(particleSystemRef.current);
    
    // Clear Labels
    labelsRef.current.forEach(div => div.remove());
    labelsRef.current.clear();

    // Create Nodes
    const geometry = new THREE.IcosahedronGeometry(NODE_SIZE, 1); // Tech-looking shape
    
    nodes.forEach((node) => {
        // Color based on Group
        let color = 0x94a3b8;
        if (node.group === 1) color = 0x3b82f6; // Gateway Blue
        if (node.group === 2) color = 0x8b5cf6; // Server Purple
        if (node.group === 3) color = 0xec4899; // DB Pink
        
        // Status override
        if (node.status === 'compromised') color = 0xff0000; // Bright Red for bloom

        const material = new THREE.MeshStandardMaterial({ 
            color: color, 
            roughness: 0.2,
            metalness: 0.8,
            emissive: color,
            emissiveIntensity: node.status === 'compromised' ? 2 : 0.5 // High emissive for bloom
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { id: node.id, label: node.label, originalColor: color };
        scene.add(mesh);
        nodeMeshesRef.current.set(node.id, mesh);

        // Add Glow Sprite (Inner Core)
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        if (context) {
            const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
            gradient.addColorStop(0.4, 'rgba(255,255,255,0.3)');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            context.fillStyle = gradient;
            context.fillRect(0,0,64,64);
        }
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture, 
            color: color, 
            transparent: true, 
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(NODE_SIZE * 6, NODE_SIZE * 6, 1);
        scene.add(sprite);
        nodeGlowsRef.current.set(node.id, sprite);

        // Add HTML Label
        if (containerRef.current) {
            const div = document.createElement('div');
            div.className = 'absolute text-[10px] font-mono text-slate-300 pointer-events-none select-none drop-shadow-md transition-opacity duration-300';
            div.textContent = node.label;
            div.style.textShadow = '0 0 4px rgba(0,0,0,1)';
            containerRef.current.appendChild(div);
            labelsRef.current.set(node.id, div);
        }
    });

    // Create Links
    const linkMaterial = new THREE.LineBasicMaterial({ 
        color: 0x475569, 
        transparent: true, 
        opacity: 0.2,
        linewidth: 1 
    });
    const linkGeometry = new THREE.BufferGeometry();
    const linkLines = new THREE.LineSegments(linkGeometry, linkMaterial);
    scene.add(linkLines);
    linkLinesRef.current = linkLines;

    // Create Particles (Brighter, Bigger)
    const particleGeometry = new THREE.BufferGeometry();
    const particleMaterial = new THREE.PointsMaterial({
        color: 0x60a5fa, // Light blue
        size: 3,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        map: new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/disc.png'),
    });
    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);
    particleSystemRef.current = particleSystem;
    
    // Initialize Particles Data
    const particles: any[] = [];
    for(let i=0; i<40; i++) {
        particles.push({
            linkIndex: Math.floor(Math.random() * links.length),
            progress: Math.random(),
            speed: 0.005 + Math.random() * 0.015
        });
    }

    // --- D3 Simulation ---
    simulationRef.current = d3.forceSimulation<SimulationNode, SimulationLink>(nodes)
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(links).id((d) => d.id).distance(60))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(0, 0))
      .force("collide", d3.forceCollide(20));

    // --- Animation Loop ---
    const targetCameraPos = new THREE.Vector3();
    let isFocusing = false;

    const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        
        if (controlsRef.current) controlsRef.current.update();
        if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !composerRef.current) return;

        // Smart Camera Focus
        if (selectedNodeId) {
            const selectedMesh = nodeMeshesRef.current.get(selectedNodeId);
            if (selectedMesh) {
                // Smoothly pan controls target to the node
                const currentTarget = controlsRef.current.target;
                const lerpSpeed = 0.05;
                currentTarget.lerp(selectedMesh.position, lerpSpeed);
                
                // Disable auto rotate when focused so user can inspect
                controlsRef.current.autoRotate = false;
            }
        } else {
             controlsRef.current.autoRotate = true;
        }

        // 1. Sync Three.js Meshes with D3 Simulation
        nodes.forEach(node => {
            const mesh = nodeMeshesRef.current.get(node.id);
            const glow = nodeGlowsRef.current.get(node.id);
            const label = labelsRef.current.get(node.id);

            if (mesh && glow) {
                let targetY = 0;
                if (node.group === 1) targetY = LAYER_HEIGHT * 1.5;
                if (node.group === 2) targetY = LAYER_HEIGHT * 0.5;
                if (node.group === 3) targetY = -LAYER_HEIGHT * 0.5;
                if (node.group === 4) targetY = -LAYER_HEIGHT * 1.5;

                mesh.position.set(node.x || 0, targetY, node.y || 0);
                
                // Rotation effect for visual interest
                mesh.rotation.x += 0.005;
                mesh.rotation.y += 0.01;

                const isHovered = node.id === hoveredNodeId;
                const isSelected = node.id === selectedNodeId;
                const scale = (isHovered || isSelected) ? HOVER_SCALE : 1;
                
                mesh.scale.setScalar(scale);

                // Pulse compromised nodes
                if (node.status === 'compromised') {
                    const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.2;
                    mesh.scale.setScalar(scale * pulse);
                    (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.sin(Date.now() * 0.01) * 1;
                }

                // Sync Glow
                glow.position.copy(mesh.position);
                glow.scale.setScalar(NODE_SIZE * 6 * scale);
                glow.material.rotation -= 0.01; // Spin the glow

                // Sync Label
                if (label && containerRef.current) {
                    const vector = mesh.position.clone();
                    vector.project(cameraRef.current);
                    const x = (vector.x * .5 + .5) * containerRef.current.clientWidth;
                    const y = (-(vector.y * .5) + .5) * containerRef.current.clientHeight;

                    if (vector.z > 1) {
                        label.style.display = 'none';
                    } else {
                        label.style.display = 'block';
                        label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y - 25}px)`;
                        label.style.opacity = (isHovered || isSelected || vector.z < 0.9) ? '1' : '0.4';
                        if (isSelected) {
                            label.style.color = '#fff';
                            label.style.opacity = '1';
                            label.style.zIndex = '10';
                        }
                        else label.style.color = '#cbd5e1';
                    }
                }
            }
        });

        // 2. Update Links
        if (linkLinesRef.current) {
            const positions: number[] = [];
            links.forEach(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source as string;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target as string;
                
                const source = nodes.find(n => n.id === sourceId);
                const target = nodes.find(n => n.id === targetId);

                if (source && target) {
                    const sMesh = nodeMeshesRef.current.get(source.id);
                    const tMesh = nodeMeshesRef.current.get(target.id);
                    if (sMesh && tMesh) {
                        positions.push(sMesh.position.x, sMesh.position.y, sMesh.position.z);
                        positions.push(tMesh.position.x, tMesh.position.y, tMesh.position.z);
                    }
                }
            });
            linkLinesRef.current.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            linkLinesRef.current.geometry.attributes.position.needsUpdate = true;
        }

        // 3. Update Particles
        if (particleSystemRef.current && particleSystemRef.current.geometry) {
             const particlePositions: number[] = [];
             particles.forEach(p => {
                 const link = links[p.linkIndex];
                 if (!link) return;
                 const sourceId = typeof link.source === 'object' ? link.source.id : link.source as string;
                 const targetId = typeof link.target === 'object' ? link.target.id : link.target as string;
                 
                 const source = nodes.find(n => n.id === sourceId);
                 const target = nodes.find(n => n.id === targetId);
                 
                 if (source && target) {
                     const sMesh = nodeMeshesRef.current.get(source.id);
                     const tMesh = nodeMeshesRef.current.get(target.id);
                     
                     if (sMesh && tMesh) {
                         p.progress += p.speed;
                         if (p.progress > 1) {
                             p.progress = 0;
                             p.linkIndex = Math.floor(Math.random() * links.length);
                         }
                         
                         const x = sMesh.position.x + (tMesh.position.x - sMesh.position.x) * p.progress;
                         const y = sMesh.position.y + (tMesh.position.y - sMesh.position.y) * p.progress;
                         const z = sMesh.position.z + (tMesh.position.z - sMesh.position.z) * p.progress;
                         
                         particlePositions.push(x, y, z);
                     }
                 }
             });
             particleSystemRef.current.geometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
             particleSystemRef.current.geometry.attributes.position.needsUpdate = true;
        }

        // 4. Render with Bloom Composer
        composerRef.current.render();
    };

    animate();

  }, [data, selectedNodeId]); // Re-run effect partially if selection changes? No, handle selection inside animate loop for smooth transition.

  // --- 3. Interactions (Raycasting) ---
  const handlePointerMove = (e: React.MouseEvent) => {
      if (!containerRef.current || !cameraRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      const intersects = raycasterRef.current.intersectObjects(Array.from(nodeMeshesRef.current.values()));
      
      if (intersects.length > 0) {
          const id = intersects[0].object.userData.id;
          setHoveredNodeId(id);
          if (containerRef.current) containerRef.current.style.cursor = 'pointer';
      } else {
          setHoveredNodeId(null);
          if (containerRef.current) containerRef.current.style.cursor = 'default';
      }
  };

  const handleClick = (e: React.MouseEvent) => {
      setContextMenu(null); // Close context menu on click
      if (hoveredNodeId) {
          setSelectedNodeId(prev => prev === hoveredNodeId ? null : hoveredNodeId);
      } else {
          setSelectedNodeId(null);
      }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      if (hoveredNodeId && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const node = data.nodes.find(n => n.id === hoveredNodeId);
          if (node) {
              setContextMenu({
                  visible: true,
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  nodeId: hoveredNodeId,
                  label: node.label
              });
              // Also select it on right click
              setSelectedNodeId(hoveredNodeId);
          }
      } else {
          setContextMenu(null);
      }
  };

  const selectedNode = data.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="w-full h-full relative bg-slate-900 fui-border shadow-2xl overflow-hidden group">
      {/* 3D Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full outline-none"
        onMouseMove={handlePointerMove}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />

      {/* Decorative Corners */}
      <div className="fui-corner-tl"></div>
      <div className="fui-corner-br"></div>
      
      {/* UI Overlays */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
         <div className="bg-slate-950/80 backdrop-blur px-3 py-1 text-xs font-mono text-cyan-400 border-l-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            NEURAL GRID :: ONLINE
         </div>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-[10px] text-slate-500 font-mono pointer-events-none text-center bg-slate-950/50 px-4 py-1 rounded-full border border-slate-800/50 backdrop-blur-sm">
          <span>LMB: TARGET LOCK &nbsp;|&nbsp; RMB: TACTICAL MENU &nbsp;|&nbsp; SCROLL: ZOOM</span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-slate-950/80 backdrop-blur p-2 text-[10px] font-mono border border-slate-800 pointer-events-none rounded">
          <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div> GATEWAY</div>
          <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]"></div> SERVER</div>
          <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]"></div> DATA</div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-500"></div> CLIENT</div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
          <div 
            className="absolute z-50 bg-slate-900/95 backdrop-blur border border-indigo-500/50 rounded shadow-[0_0_30px_rgba(99,102,241,0.4)] min-w-[180px] animate-in fade-in zoom-in-95 duration-150"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
             <div className="px-3 py-2 border-b border-slate-800 text-[10px] text-cyan-400 font-mono font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Target Lock</span>
                <span className="animate-pulse">●</span>
             </div>
             <div className="p-1">
                <button 
                    onClick={() => { onScanNode(contextMenu.label); setContextMenu(null); }}
                    className="w-full text-left px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 rounded flex items-center gap-2 group transition-colors"
                >
                    <span className="opacity-50 group-hover:opacity-100 font-mono">[SCAN]</span> Deep Fingerprint
                </button>
                <button 
                    onClick={() => { onIsolateNode(contextMenu.label); setContextMenu(null); }}
                    className="w-full text-left px-3 py-2 text-xs text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 rounded flex items-center gap-2 group transition-colors"
                >
                    <span className="opacity-50 group-hover:opacity-100 font-mono">[LOCK]</span> Quarantine Host
                </button>
                <button 
                    onClick={() => { onRemediateNode(contextMenu.label); setContextMenu(null); }}
                    className="w-full text-left px-3 py-2 text-xs text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 rounded flex items-center gap-2 group transition-colors"
                >
                    <span className="opacity-50 group-hover:opacity-100 font-mono">[FIX]</span> Deploy Patch
                </button>
             </div>
          </div>
      )}

      {/* Selected Node Details */}
      {selectedNode && (
          <div className="absolute bottom-4 right-4 z-20 w-64 bg-slate-950/90 backdrop-blur border-r-2 border-indigo-500 p-4 shadow-2xl animate-in slide-in-from-right-4 fade-in duration-300 clip-path-polygon ring-1 ring-white/10">
             <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-2">
                <h3 className="font-bold text-cyan-100 font-mono glow-text flex items-center gap-2">
                    {selectedNode.label}
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                </h3>
                <button onClick={() => setSelectedNodeId(null)} className="text-slate-500 hover:text-white">✕</button>
             </div>
             <div className="space-y-2 text-xs font-mono text-slate-400">
                 <div className="flex justify-between items-center bg-slate-900/50 p-1 rounded">
                    <span>IP ADDR</span>
                    <span className="text-slate-200">{selectedNode.ip}</span>
                 </div>
                 <div className="flex justify-between items-center bg-slate-900/50 p-1 rounded">
                    <span>LAYER</span>
                    <span className={
                        selectedNode.group === 1 ? 'text-blue-400' :
                        selectedNode.group === 2 ? 'text-purple-400' :
                        selectedNode.group === 3 ? 'text-pink-400' : 'text-slate-400'
                    }>
                        {selectedNode.group === 1 ? 'GATEWAY' : selectedNode.group === 2 ? 'SERVER' : selectedNode.group === 3 ? 'DATA' : 'CLIENT'}
                    </span>
                 </div>
                 <div className="flex justify-between pt-1 border-t border-slate-800 mt-1">
                    <span>STATUS</span>
                    <span className={`font-bold ${
                        selectedNode.status === 'secure' ? 'text-emerald-400' :
                        selectedNode.status === 'vulnerable' ? 'text-amber-400' :
                        'text-red-500 animate-pulse'
                    }`}>
                        {selectedNode.status.toUpperCase()}
                    </span>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default NetworkGraph;