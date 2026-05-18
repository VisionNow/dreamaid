"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  NodeChange,
  EdgeChange,
  Edge,
  Viewport,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  Connection,
  addEdge,
  Handle,
  Position,
  BaseEdge,
  EdgeProps,
  useStore,
  getSmoothStepPath,
  getBezierPath,
  EdgeLabelRenderer,
  NodeResizer
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { 
  Play, PlusCircle, Link as LinkIcon, Save, Download,
  PanelLeft, PanelBottom, PanelRight, Search, Folder,
  FileCode, File, ChevronDown, ChevronRight, Menu,
  MoreHorizontal, Sun, Moon, Database, Cloud, FileText,
  Hexagon, Triangle, Type, Circle, User, StickyNote,
  MessageSquare, Box, X, Wand2
} from "lucide-react";

// --- SHAPE DESCRIPTIONS (Dành cho Tooltip) ---
const shapeDescriptions: Record<string, string> = {
  'rectangle': 'A standard process, action, or operation.',
  'rounded': 'An alternative process or service step.',
  'text': 'A plain text label or annotation.',
  'ellipse': 'Start or end point of a flowchart.',
  'square': 'A generic square block.',
  'circle': 'A generic circular node.',
  'process': 'A predefined process or subroutine.',
  'diamond': 'A decision or branching point.',
  'parallelogram': 'Data input or output (I/O).',
  'hexagon': 'Preparation or initialization step.',
  'triangle': 'A manual operation or extraction.',
  'cylinder': 'A database or data storage.',
  'cloud': 'Cloud storage or external network.',
  'document': 'A document or report.',
  'internalStorage': 'Internal memory or storage.',
  'cube': 'A 3D cube representation.',
  'step': 'A step in a sequential process.',
  'callout': 'A callout or speech bubble for comments.',
  'actor': 'A user, actor, or person.',
  'note': 'A sticky note for documentation.'
};

// --- 1. CUSTOM SHAPE NODE ---
const CustomShapeNode = ({ id, data, selected, style }: any) => {
  const { shapeType, label } = data;
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  
  const { setNodes } = useReactFlow();
  const connectionNodeId = useStore((state) => state.connectionNodeId);
  const isConnecting = !!connectionNodeId;
  const showHandles = selected || isHovered || isConnecting;

  useEffect(() => { setEditValue(label); }, [label]);

  const saveEdit = () => {
    setIsEditing(false);
    setNodes((nds) => {
      const newNodes = nds.map((n) => n.id === id ? { ...n, data: { ...n.data, label: editValue } } : n);
      setTimeout(() => window.dispatchEvent(new CustomEvent('mermaid-rebuild', { detail: { nodes: newNodes } })), 0);
      return newNodes;
    });
  };

  let shapeStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', height: '100%',
    backgroundColor: 'white', border: selected ? '2px solid #3b82f6' : '2px solid #1e293b',
    color: '#0f172a', fontWeight: 500, fontSize: '12px', textAlign: 'center',
    boxShadow: selected ? '0 4px 6px -1px rgba(59, 130, 246, 0.5)' : 'none',
    transition: 'border 0.1s ease, box-shadow 0.1s ease',
  };

  if (shapeType === 'rounded') shapeStyle.borderRadius = '8px';
  else if (shapeType === 'ellipse' || shapeType === 'circle') shapeStyle.borderRadius = '50%';
  else if (shapeType === 'diamond') { shapeStyle.transform = 'rotate(45deg)'; }
  else if (shapeType === 'parallelogram') { shapeStyle.transform = 'skewX(-15deg)'; }
  
  const handleStyle = { width: '8px', height: '8px', background: '#3b82f6', opacity: showHandles ? 1 : 0, transition: 'opacity 0.2s', border: '1px solid white' };

  return (
    <div className="relative group w-full h-full" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <NodeResizer color="#3b82f6" isVisible={selected} minWidth={50} minHeight={40} handleStyle={{ width: '8px', height: '8px', borderRadius: '2px' }} lineStyle={{ borderWidth: '2px' }} />

      <Handle type="target" position={Position.Top} id="top-t" style={{...handleStyle, top: '-4px'}} />
      <Handle type="source" position={Position.Top} id="top-s" style={{...handleStyle, top: '-4px'}} />
      <Handle type="target" position={Position.Bottom} id="bot-t" style={{...handleStyle, bottom: '-4px'}} />
      <Handle type="source" position={Position.Bottom} id="bot-s" style={{...handleStyle, bottom: '-4px'}} />
      <Handle type="target" position={Position.Right} id="right-t" style={{...handleStyle, right: '-4px'}} />
      <Handle type="source" position={Position.Right} id="right-s" style={{...handleStyle, right: '-4px'}} />
      <Handle type="target" position={Position.Left} id="left-t" style={{...handleStyle, left: '-4px'}} />
      <Handle type="source" position={Position.Left} id="left-s" style={{...handleStyle, left: '-4px'}} />
      
      <div style={shapeStyle} className="relative z-10" onDoubleClick={() => setIsEditing(true)}>
        <span style={shapeType === 'diamond' ? { transform: 'rotate(-45deg)' } : shapeType === 'parallelogram' ? { transform: 'skewX(15deg)' } : {}}>
          {isEditing ? (
            <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="w-[90%] text-center text-slate-800 bg-transparent outline-none border-b border-blue-400" />
          ) : label}
        </span>
      </div>
    </div>
  );
};

// --- 2. SMART EDGE (Hỗ trợ Edit Text trực tiếp) ---
const SmartEdge = ({ id, source, target, style, markerEnd, markerStart, label, data }: EdgeProps) => {
  const { setEdges } = useReactFlow();
  const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]));
  const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]));

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label as string || "");

  useEffect(() => { setEditValue(label as string || ""); }, [label]);

  const saveEdit = () => {
    setIsEditing(false);
    setEdges((eds) => {
      const newEdges = eds.map((e) => e.id === id ? { ...e, label: editValue } : e);
      setTimeout(() => window.dispatchEvent(new CustomEvent('mermaid-rebuild-edge', { detail: { edges: newEdges } })), 0);
      return newEdges;
    });
  };

  if (!sourceNode || !targetNode) return null;
  const sWidth = sourceNode.width || 120; const sHeight = sourceNode.height || 40;
  const tWidth = targetNode.width || 120; const tHeight = targetNode.height || 40;

  // Xử lý Self-Loop
  if (source === target) {
    const labelLength = typeof label === 'string' ? label.length : 0;
    const radiusX = 50 + labelLength * 2.5; 
    const radiusY = 60 + labelLength * 2.5;
    const startX = sourceNode.position.x + sWidth / 2 + 10;
    const startY = sourceNode.position.y;
    const endX = sourceNode.position.x + sWidth;
    const endY = sourceNode.position.y + sHeight / 2 - 10;
    const c1X = startX + radiusX * 0.5; const c1Y = startY - radiusY;
    const c2X = endX + radiusX; const c2Y = endY - radiusY * 0.5;

    const edgePath = `M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`;
    const labelX = startX + radiusX * 0.7; const labelY = startY - radiusY * 0.7;

    return (
      <>
        <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} markerStart={markerStart} />
        {label !== undefined && (
          <EdgeLabelRenderer>
            <div 
              onDoubleClick={() => setIsEditing(true)}
              className="nodrag nopan" 
              style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, background: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: 11, fontWeight: 600, color: '#334155', zIndex: 20, pointerEvents: 'all' }}
            >
              {isEditing ? (
                <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="text-center text-slate-800 bg-transparent outline-none border-b border-blue-400" style={{minWidth: '40px'}} />
              ) : label}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  }

  const sX = sourceNode.position.x + sWidth / 2; const sY = sourceNode.position.y + sHeight / 2;
  const tX = targetNode.position.x + tWidth / 2; const tY = targetNode.position.y + tHeight / 2;
  const dx = tX - sX; const dy = tY - sY;
  
  let sPos = Position.Right, tPos = Position.Left;
  if (Math.abs(dx) > Math.abs(dy)) {
    sPos = dx > 0 ? Position.Right : Position.Left; tPos = dx > 0 ? Position.Left : Position.Right;
  } else {
    sPos = dy > 0 ? Position.Bottom : Position.Top; tPos = dy > 0 ? Position.Top : Position.Bottom;
  }

  const sourceX = sPos === Position.Right ? sX + sWidth/2 : sPos === Position.Left ? sX - sWidth/2 : sX;
  const sourceY = sPos === Position.Bottom ? sY + sHeight/2 : sPos === Position.Top ? sY - sHeight/2 : sY;
  const targetX = tPos === Position.Right ? tX + tWidth/2 : tPos === Position.Left ? tX - tWidth/2 : tX;
  const targetY = tPos === Position.Bottom ? tY + tHeight/2 : tPos === Position.Top ? tY - tHeight/2 : tY;

  let edgePath, labelX, labelY;

  if (data?.isCurved) {
    const mx = (sourceX + targetX) / 2; const my = (sourceY + targetY) / 2;
    const length = Math.sqrt(dx * dx + dy * dy) || 1; 
    const nx = -dy / length; const ny = dx / length;
    const curveOffset = 60; 
    const cx = mx + nx * curveOffset; const cy = my + ny * curveOffset;
    const shiftOffset = 15;
    const finalSourceX = sourceX + nx * shiftOffset; const finalSourceY = sourceY + ny * shiftOffset;
    const finalTargetX = targetX + nx * shiftOffset; const finalTargetY = targetY + ny * shiftOffset;

    edgePath = `M ${finalSourceX} ${finalSourceY} Q ${cx} ${cy} ${finalTargetX} ${finalTargetY}`;
    labelX = 0.25 * finalSourceX + 0.5 * cx + 0.25 * finalTargetX;
    labelY = 0.25 * finalSourceY + 0.5 * cy + 0.25 * finalTargetY;
  } else {
    [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition: sPos, targetX, targetY, targetPosition: tPos, borderRadius: 16 });
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} markerStart={markerStart} />
      {label !== undefined && (
        <EdgeLabelRenderer>
          <div 
            onDoubleClick={() => setIsEditing(true)}
            className="nodrag nopan" 
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, background: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: 11, fontWeight: 600, color: '#334155', zIndex: 20, pointerEvents: 'all' }}
          >
            {isEditing ? (
                <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="text-center text-slate-800 bg-transparent outline-none border-b border-blue-400" style={{minWidth: '40px'}} />
            ) : label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const nodeTypes = { customShape: CustomShapeNode };
const edgeTypes = { smart: SmartEdge };

// --- 3. LOGIC GỘP MŨI TÊN ---
const consolidateEdges = (edges: Edge[]): Edge[] => {
  const consolidated: Edge[] = [];
  const pairMap = new Map<string, Edge[]>();

  edges.forEach(edge => {
    const pairKey = [edge.source, edge.target].sort().join('-');
    if (!pairMap.has(pairKey)) pairMap.set(pairKey, []);
    pairMap.get(pairKey)!.push(edge);
  });

  pairMap.forEach((pairEdges) => {
    const forwardEdges = pairEdges.filter(e => e.source === pairEdges[0].source);
    const backwardEdges = pairEdges.filter(e => e.source !== pairEdges[0].source);

    const forwardEdge = forwardEdges.length > 0 ? forwardEdges[forwardEdges.length - 1] : null;
    const backwardEdge = backwardEdges.length > 0 ? backwardEdges[backwardEdges.length - 1] : null;

    if (forwardEdge && backwardEdge) {
      const fLabel = forwardEdge.label || "";
      const bLabel = backwardEdge.label || "";

      if (fLabel === bLabel) {
        forwardEdge.markerStart = { type: MarkerType.ArrowClosed, width: 20, height: 20 };
        forwardEdge.data = { ...forwardEdge.data, bidirectional: true, isCurved: false };
        consolidated.push(forwardEdge);
      } else {
        forwardEdge.data = { ...forwardEdge.data, bidirectional: false, isCurved: true };
        backwardEdge.data = { ...backwardEdge.data, bidirectional: false, isCurved: true };
        consolidated.push(forwardEdge, backwardEdge);
      }
    } else if (forwardEdge) {
      forwardEdge.data = { ...forwardEdge.data, isCurved: false };
      consolidated.push(forwardEdge);
    } else if (backwardEdge) {
      backwardEdge.data = { ...backwardEdge.data, isCurved: false };
      consolidated.push(backwardEdge);
    }
  });

  return consolidated;
};

// --- 4. STRICT PARSER (Dịch lỗi sang Tiếng Anh) ---
const parseMermaid = (code: string) => {
  const nodesMap = new Map<string, Node>();
  const edges: Edge[] = [];
  const lines = code.split('\n');
  const edgeRegex = /([a-zA-Z0-9_]+)(?:\["(.*?)"\]|\[(.*?)\])?\s*(<--+>|-+>)\s*(?:\|(.*?)\|)?\s*([a-zA-Z0-9_]+)(?:\["(.*?)"\]|\[(.*?)\])?/;
  const nodeRegex = /^\s*([a-zA-Z0-9_]+)(?:\["(.*?)"\]|\[(.*?)\])?/;

  lines.forEach((line, index) => {
    let cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('graph') || cleanLine.startsWith('flowchart') || cleanLine.startsWith('%%')) return;
    
    let metadata = { shapeType: 'rectangle', x: undefined as number|undefined, y: undefined as number|undefined, w: 120, h: 40 };
    let codePart = cleanLine;

    if (cleanLine.includes('%%')) {
       const parts = cleanLine.split('%%');
       codePart = parts[0].trim();
       const metaStr = parts[1];
       const shapeMatch = metaStr.match(/shape:([a-zA-Z0-9_]+)/); if (shapeMatch) metadata.shapeType = shapeMatch[1];
       const xMatch = metaStr.match(/x:(-?\d+)/); if (xMatch) metadata.x = parseInt(xMatch[1]);
       const yMatch = metaStr.match(/y:(-?\d+)/); if (yMatch) metadata.y = parseInt(yMatch[1]);
       const wMatch = metaStr.match(/w:(-?\d+)/); if (wMatch) metadata.w = parseInt(wMatch[1]);
       const hMatch = metaStr.match(/h:(-?\d+)/); if (hMatch) metadata.h = parseInt(hMatch[1]);
    }
    
    if (!codePart) return; 

    const edgeMatch = codePart.match(edgeRegex);
    if (edgeMatch) {
      const [_, sourceId, sQ, sNQ, arrow, edgeLabel, targetId, tQ, tNQ] = edgeMatch;
      const sourceLabel = sQ || sNQ || sourceId; const targetLabel = tQ || tNQ || targetId;
      const isBidirectional = arrow.includes('<');

      if (!nodesMap.has(sourceId)) nodesMap.set(sourceId, { id: sourceId, position: { x: metadata.x || 0, y: metadata.y || 0 }, data: { label: sourceLabel, shapeType: metadata.shapeType }, style: { width: metadata.w, height: metadata.h }, type: 'customShape' });
      if (!nodesMap.has(targetId)) nodesMap.set(targetId, { id: targetId, position: { x: (metadata.x || 0) + 200, y: (metadata.y || 0) + 100 }, data: { label: targetLabel, shapeType: 'rectangle' }, style: { width: 120, height: 40 }, type: 'customShape' });
      
      edges.push({ id: `e${sourceId}-${targetId}-${index}`, source: sourceId, target: targetId, label: edgeLabel || undefined, type: 'smart', markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 }, markerStart: isBidirectional ? { type: MarkerType.ArrowClosed, width: 20, height: 20 } : undefined, data: { bidirectional: isBidirectional } });
      return;
    } 
    
    const nodeMatch = codePart.match(nodeRegex);
    if (nodeMatch) {
      const [_, nodeId, lQ, lNQ] = nodeMatch;
      const label = lQ || lNQ || nodeId;
      if (!nodesMap.has(nodeId)) {
        nodesMap.set(nodeId, { id: nodeId, position: { x: metadata.x !== undefined ? metadata.x : Math.random() * 200, y: metadata.y !== undefined ? metadata.y : Math.random() * 200 }, data: { label, shapeType: metadata.shapeType }, style: { width: metadata.w, height: metadata.h }, type: 'customShape' });
      } else {
        const existingNode = nodesMap.get(nodeId)!;
        existingNode.data.label = label; existingNode.data.shapeType = metadata.shapeType;
        if (metadata.x !== undefined && metadata.y !== undefined) existingNode.position = { x: metadata.x, y: metadata.y };
        existingNode.style = { width: metadata.w, height: metadata.h };
      }
      return;
    }
    throw { line: index + 1, message: "Invalid Mermaid syntax.", lineText: codePart };
  });

  return { nodes: Array.from(nodesMap.values()), edges: consolidateEdges(edges) };
};

const generateMermaidFromFlow = (nodes: Node[], edges: Edge[]): string => {
  if (nodes.length === 0) return "";
  let mermaidCode = "graph TD;\n";
  nodes.forEach(node => { 
    const label = node.data.label || node.id;
    const shape = node.data.shapeType || 'rectangle';
    const x = Math.round(node.position.x); const y = Math.round(node.position.y);
    const w = Math.round(node.style?.width as number || node.width || 120);
    const h = Math.round(node.style?.height as number || node.height || 40);
    mermaidCode += `    ${node.id}["${label}"] %% shape:${shape} x:${x} y:${y} w:${w} h:${h}\n`; 
  });
  mermaidCode += "\n";
  edges.forEach(edge => {
    const labelStr = edge.label ? `|${edge.label}|` : "";
    const arrowType = edge.data?.bidirectional ? "<-->" : "-->";
    mermaidCode += `    ${edge.source} ${arrowType}${labelStr} ${edge.target};\n`;
  });
  return mermaidCode;
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const autoLayoutElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 100 });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: 150, height: 50 }));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return { ...node, position: { x: nodeWithPosition.x - 75, y: nodeWithPosition.y - 25 } };
  });
};

const SHAPE_CATEGORIES = ["General", "Flowchart", "Misc", "Basic", "Arrows", "Entity Relation", "UML"];

// --- NỘI DUNG IDE CHÍNH ---
const IDEPageContent = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const coordsRef = useRef<HTMLDivElement>(null); 
  const monacoRef = useRef<any>(null); 
  
  const { screenToFlowPosition } = useReactFlow();

  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [isTabOpen, setIsTabOpen] = useState<boolean>(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(false); 
  const [parseError, setParseError] = useState<{line: number, message: string, lineText: string} | null>(null);

  const [openShapeMenus, setOpenShapeMenus] = useState<Record<string, boolean>>({ "General": true, "Flowchart": true });
  
  const [explorerWidth, setExplorerWidth] = useState<number>(256);
  const [editorWidth, setEditorWidth] = useState<number>(500);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(256);
  
  const [isDraggingExplorer, setIsDraggingExplorer] = useState(false);
  const [isDraggingEditor, setIsDraggingEditor] = useState(false);
  const [isDraggingRightPanel, setIsDraggingRightPanel] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ id: string; top: number; left: number; type: 'node' | 'edge' } | null>(null);
  const [hoveredShape, setHoveredShape] = useState<{ x: number, y: number, item: any } | null>(null);
  const hoverTimeout = useRef<any>(null);

  const [code, setCode] = useState<string>("graph TD;\n    KH[\"Khách hàng\"] %% shape:actor x:100 y:100 w:120 h:40\n    BA[\"Business Analyst\"] %% shape:rectangle x:300 y:250 w:120 h:40\n\n    KH -->|Gửi yêu cầu| BA;\n");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const updateCodeFromFlow = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    setCode(generateMermaidFromFlow(currentNodes, currentEdges));
    setParseError(null);
    if (monacoRef.current) monacoRef.current.monaco.editor.setModelMarkers(monacoRef.current.editor.getModel(), "mermaid", []);
  }, []);

  // Bắt Event từ cả Node và Edge khi sửa chữ
  useEffect(() => {
    const nodeHandler = (e: any) => { updateCodeFromFlow(e.detail.nodes, edges); };
    const edgeHandler = (e: any) => { updateCodeFromFlow(nodes, e.detail.edges); };
    window.addEventListener('mermaid-rebuild', nodeHandler);
    window.addEventListener('mermaid-rebuild-edge', edgeHandler);
    return () => {
      window.removeEventListener('mermaid-rebuild', nodeHandler);
      window.removeEventListener('mermaid-rebuild-edge', edgeHandler);
    };
  }, [nodes, edges, updateCodeFromFlow]);

  const handleSyncCodeToDiagram = useCallback(() => {
    try {
      const parsedData = parseMermaid(code);
      setNodes([...parsedData.nodes]);
      setEdges([...parsedData.edges]);
      
      setParseError(null);
      if (monacoRef.current) monacoRef.current.monaco.editor.setModelMarkers(monacoRef.current.editor.getModel(), "mermaid", []);
    } catch (err: any) { 
      setParseError(err);
      setIsTerminalOpen(true);
      if (monacoRef.current && err.line) {
        monacoRef.current.monaco.editor.setModelMarkers(monacoRef.current.editor.getModel(), "mermaid", [{
          startLineNumber: err.line, startColumn: 1, endLineNumber: err.line, endColumn: err.lineText.length + 1,
          message: err.message, severity: monacoRef.current.monaco.MarkerSeverity.Error
        }]);
      }
      alert(`${err.message}\n\nThe system will restore the source code to the last valid Canvas state.`);
      updateCodeFromFlow(nodes, edges);
    }
  }, [code, nodes, edges, updateCodeFromFlow]);

  useEffect(() => { handleSyncCodeToDiagram(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAutoLayout = useCallback(() => {
    const layoutedNodes = autoLayoutElements(nodes, edges);
    setNodes(layoutedNodes);
    setCode(generateMermaidFromFlow(layoutedNodes, edges));
  }, [nodes, edges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onNodeDragStop = useCallback(() => { updateCodeFromFlow(nodes, edges); }, [nodes, edges, updateCodeFromFlow]);
  
  const onConnect = useCallback((params: Connection) => {
    const rawEdge = { ...params, id: `e${params.source}-${params.target}-${Date.now()}`, type: 'smart', markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 } } as Edge;
    const consolidatedEdges = consolidateEdges([...edges, rawEdge]);
    setEdges(consolidatedEdges); updateCodeFromFlow(nodes, consolidatedEdges);
  }, [nodes, edges, updateCodeFromFlow]);

  const handleMove = useCallback((event: any, viewport: Viewport) => { setZoomLevel(viewport.zoom); }, []);

  const handleCanvasMouseUp = useCallback(() => {
    updateCodeFromFlow(nodes, edges);
  }, [nodes, edges, updateCodeFromFlow]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (coordsRef.current && reactFlowWrapper.current) {
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      coordsRef.current.innerText = `X: ${Math.round(flowPos.x)} | Y: ${Math.round(flowPos.y)}`;
    }
  }, [screenToFlowPosition]);

  const onDragStart = (event: React.DragEvent, shapeType: string, defaultLabel: string) => {
    event.dataTransfer.setData("application/reactflow-type", shapeType);
    event.dataTransfer.setData("application/reactflow-label", defaultLabel);
    event.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }, []);
  
  const addNodeToCanvas = useCallback((type: string, label: string, position: {x: number, y: number}) => {
    const uniqueId = Date.now().toString().slice(-4);
    const newNodeId = `node_${type}_${uniqueId}`;
    const newNode: Node = { id: newNodeId, type: 'customShape', position, data: { label: `${label}`, shapeType: type }, style: { width: 120, height: 40 } };
    const newNodes = nodes.concat(newNode);
    setNodes(newNodes); updateCodeFromFlow(newNodes, edges);
  }, [nodes, edges, updateCodeFromFlow]);

  const onDrop = useCallback((event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow-type");
      const label = event.dataTransfer.getData("application/reactflow-label");
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNodeToCanvas(type, label, position);
  }, [screenToFlowPosition, addNodeToCanvas]);

  const onShapeClick = useCallback((type: string, label: string) => {
      const offset = (Math.random() * 40) - 20; 
      const centerPosition = screenToFlowPosition({ x: window.innerWidth / 2 + offset, y: window.innerHeight / 2 + offset });
      addNodeToCanvas(type, label, centerPosition);
  }, [screenToFlowPosition, addNodeToCanvas]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault(); setContextMenu({ id: node.id, top: event.clientY, left: event.clientX, type: 'node' });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault(); setContextMenu({ id: edge.id, top: event.clientY, left: event.clientX, type: 'edge' });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleEditItem = useCallback(() => {
    if (!contextMenu) return;
    const currentLabel = contextMenu.type === 'node' ? nodes.find(n => n.id === contextMenu.id)?.data.label : edges.find(e => e.id === contextMenu.id)?.label;
    const newLabel = prompt("Enter new text:", currentLabel || "");
    if (newLabel !== null) {
      if (contextMenu.type === 'node') {
        const newNodes = nodes.map(n => n.id === contextMenu.id ? { ...n, data: { ...n.data, label: newLabel } } : n);
        setNodes(newNodes); updateCodeFromFlow(newNodes, edges);
      } else {
        const newEdges = edges.map(e => e.id === contextMenu.id ? { ...e, label: newLabel } : e);
        const consolidated = consolidateEdges(newEdges); 
        setEdges(consolidated); updateCodeFromFlow(nodes, consolidated);
      }
    }
    closeContextMenu();
  }, [contextMenu, nodes, edges, updateCodeFromFlow, closeContextMenu]);

  const handleDeleteItem = useCallback(() => {
    if (!contextMenu) return;
    if (contextMenu.type === 'node') {
      const newNodes = nodes.filter((n) => n.id !== contextMenu.id);
      const newEdges = edges.filter((e) => e.source !== contextMenu.id && e.target !== contextMenu.id);
      setNodes(newNodes); setEdges(newEdges); updateCodeFromFlow(newNodes, newEdges);
    } else {
      const newEdges = edges.filter((e) => e.id !== contextMenu.id);
      setEdges(newEdges); updateCodeFromFlow(nodes, newEdges);
    }
    closeContextMenu();
  }, [contextMenu, nodes, edges, updateCodeFromFlow, closeContextMenu]);

  const theme = isDarkMode ? { bgMain: "bg-[#1e1e1e]", text: "text-[#cccccc]", textMuted: "text-slate-400", border: "border-[#2b2b2b]", toolbar: "bg-[#181818]", hover: "hover:bg-[#333333]", searchBg: "bg-[#2b2b2b]", searchBorder: "border-[#3c3c3c]", itemHover: "hover:bg-[#2a2d2e]", itemActive: "bg-[#37373d]", editorTabTop: "border-blue-500", shapeBorder: "border-[#4b4b4b]", shapeFill: "bg-[#252526]" } : { bgMain: "bg-white", text: "text-slate-800", textMuted: "text-slate-500", border: "border-slate-300", toolbar: "bg-[#f3f3f3]", hover: "hover:bg-[#e4e4e4]", searchBg: "bg-white", searchBorder: "border-slate-300", itemHover: "hover:bg-slate-100", itemActive: "bg-[#e4e6f1] text-blue-700", editorTabTop: "border-blue-600", shapeBorder: "border-slate-300", shapeFill: "bg-white" };
  const toggleShapeMenu = (category: string) => setOpenShapeMenus(prev => ({ ...prev, [category]: !prev[category] }));
  
  const handleMouseMove = useCallback((e: MouseEvent) => { 
    if (isDraggingExplorer) setExplorerWidth(Math.max(150, Math.min(e.clientX, 500))); 
    else if (isDraggingRightPanel) setRightPanelWidth(Math.max(150, Math.min(window.innerWidth - e.clientX, 500))); 
    else if (isDraggingEditor) { const offset = isSidebarOpen ? explorerWidth : 0; const rightPanelOffset = isRightPanelOpen ? rightPanelWidth : 0; setEditorWidth(Math.max(200, Math.min(e.clientX - offset, window.innerWidth - 300 - rightPanelOffset))); } 
  }, [isDraggingExplorer, isDraggingEditor, isDraggingRightPanel, isSidebarOpen, explorerWidth, isRightPanelOpen, rightPanelWidth]);
  
  const handleMouseUpDrag = useCallback(() => { setIsDraggingExplorer(false); setIsDraggingEditor(false); setIsDraggingRightPanel(false); }, []);
  
  useEffect(() => { 
    if (isDraggingExplorer || isDraggingEditor || isDraggingRightPanel) { 
      document.addEventListener("mousemove", handleMouseMove); document.addEventListener("mouseup", handleMouseUpDrag); document.body.style.userSelect = "none"; 
    } else { 
      document.removeEventListener("mousemove", handleMouseMove); document.removeEventListener("mouseup", handleMouseUpDrag); document.body.style.userSelect = "auto"; 
    } 
    return () => { document.removeEventListener("mousemove", handleMouseMove); document.removeEventListener("mouseup", handleMouseUpDrag); document.body.style.userSelect = "auto"; }; 
  }, [isDraggingExplorer, isDraggingEditor, isDraggingRightPanel, handleMouseMove, handleMouseUpDrag]);

  const handleShapeMouseEnter = (e: React.MouseEvent, item: any) => {
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimeout.current = setTimeout(() => {
      setHoveredShape({ x: rect.left, y: rect.top + rect.height / 2, item });
    }, 500); 
  };

  const handleShapeMouseLeave = () => {
    clearTimeout(hoverTimeout.current);
    setHoveredShape(null);
  };

  const renderShapeItems = (category: string) => {
    const defaultPlaceholder = [...Array(4)].map((_, i) => (<div key={i} className={`aspect-square rounded ${theme.shapeBorder} border ${theme.shapeFill} cursor-not-allowed flex items-center justify-center`}><div className={`w-4 h-4 border-2 border-dashed ${theme.shapeBorder}`}></div></div>));
    if (category === "General") {
      return (
        <>
          {[ 
            { type: 'rectangle', label: 'Rectangle', icon: <div className={`w-6 h-4 border-2 ${theme.shapeBorder} ${theme.shapeFill}`}></div> }, 
            { type: 'rounded', label: 'Rounded Rectangle', icon: <div className={`w-6 h-4 border-2 rounded-md ${theme.shapeBorder} ${theme.shapeFill}`}></div> }, 
            { type: 'text', label: 'Text', icon: <Type size={18} className={theme.textMuted} /> }, 
            { type: 'ellipse', label: 'Ellipse', icon: <div className={`w-7 h-4 border-2 rounded-[50%] ${theme.shapeBorder} ${theme.shapeFill}`}></div> }, 
            { type: 'square', label: 'Square', icon: <div className={`w-5 h-5 border-2 ${theme.shapeBorder} ${theme.shapeFill}`}></div> }, 
            { type: 'circle', label: 'Circle', icon: <Circle size={18} className={theme.textMuted} /> }, 
            { type: 'process', label: 'Process', icon: <div className={`w-6 h-4 border-2 ${theme.shapeBorder} ${theme.shapeFill} flex justify-between`}><div className={`border-r-2 ${theme.shapeBorder} h-full`}></div><div className={`border-l-2 ${theme.shapeBorder} h-full`}></div></div> }, 
            { type: 'diamond', label: 'Diamond', icon: <div className={`w-4 h-4 border-2 rotate-45 ${theme.shapeBorder} ${theme.shapeFill}`}></div> }, 
            { type: 'parallelogram', label: 'Data', icon: <div className={`w-5 h-4 border-2 -skew-x-[15deg] ${theme.shapeBorder} ${theme.shapeFill}`}></div> }, 
            { type: 'hexagon', label: 'Hexagon', icon: <Hexagon size={18} className={theme.textMuted} /> },
            { type: 'triangle', label: 'Triangle', icon: <Triangle size={18} className={theme.textMuted} /> },
            { type: 'cylinder', label: 'Database', icon: <Database size={18} className={theme.textMuted} /> }, 
            { type: 'cloud', label: 'Cloud', icon: <Cloud size={18} className={theme.textMuted} /> },
            { type: 'document', label: 'Document', icon: <FileText size={18} className={theme.textMuted} /> },
            { type: 'internalStorage', label: 'Internal Storage', icon: <div className={`w-6 h-5 border-2 ${theme.shapeBorder} ${theme.shapeFill} flex flex-col`}><div className={`border-b-2 ${theme.shapeBorder} w-full h-[30%]`}></div><div className={`border-r-2 ${theme.shapeBorder} h-full w-[30%] -mt-[30%]`}></div></div> }, 
            { type: 'cube', label: 'Cube', icon: <Box size={18} className={theme.textMuted} /> },
            { type: 'step', label: 'Step', icon: <div className={`w-6 h-4 border-2 ${theme.shapeBorder} ${theme.shapeFill} flex`}><div className="w-4 border-r-2 border-transparent h-full"></div><div className={`w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[8px] ${isDarkMode ? 'border-l-[#4b4b4b]' : 'border-l-slate-300'}`}></div></div> },
            { type: 'callout', label: 'Callout', icon: <MessageSquare size={18} className={theme.textMuted} /> },
            { type: 'actor', label: 'Actor', icon: <User size={18} className={theme.textMuted} /> }, 
            { type: 'note', label: 'Note', icon: <StickyNote size={18} className={theme.textMuted} /> }
          ].map(item => (
            <div 
              key={item.label} onClick={() => onShapeClick(item.type, item.label)} draggable onDragStart={(event) => onDragStart(event, item.type, item.label)} 
              onMouseEnter={(e) => handleShapeMouseEnter(e, item)} onMouseLeave={handleShapeMouseLeave}
              className={`aspect-square rounded ${theme.shapeBorder} border ${theme.shapeFill} hover:border-blue-500 hover:shadow-sm cursor-pointer active:scale-95 flex items-center justify-center transition-all`} title={item.label}
            >
              {item.icon}
            </div>
          ))}
        </>
      );
    }
    return defaultPlaceholder;
  };

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: any) => {
    monacoRef.current = { editor, monaco };
  };

  return (
    <div className={`flex flex-col h-screen w-full ${theme.bgMain} ${theme.text} font-sans overflow-hidden transition-colors duration-200`} onClick={closeContextMenu}>
      
      {/* SHAPE TOOLTIP PORTAL (Fixed) */}
      {hoveredShape && (
        <div 
          className="fixed z-[9999] bg-[#1e293b] text-white text-xs rounded-md shadow-2xl p-3 w-48 pointer-events-none transform -translate-x-full -translate-y-1/2 transition-opacity"
          style={{ top: hoveredShape.y, left: hoveredShape.x - 10 }}
        >
          <div className="flex flex-col items-center gap-2">
             <div className="w-12 h-12 flex items-center justify-center bg-[#0f172a] rounded border border-slate-600">
                {hoveredShape.item.icon}
             </div>
             <div className="font-bold text-[13px]">{hoveredShape.item.label}</div>
             <div className="text-center text-slate-300 leading-snug">{shapeDescriptions[hoveredShape.item.type]}</div>
          </div>
          <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-[#1e293b] transform rotate-45"></div>
        </div>
      )}

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div style={{ top: contextMenu.top, left: contextMenu.left }} className="fixed z-[100] bg-white border border-slate-200 shadow-xl rounded-md py-1 w-36 text-sm">
          <button onClick={handleEditItem} className="w-full text-left px-4 py-2 hover:bg-slate-100 text-slate-700 transition">Edit text</button>
          <button onClick={handleDeleteItem} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 border-t border-slate-100 transition font-medium">Delete</button>
        </div>
      )}

      <div className={`flex items-center justify-between h-10 px-3 ${theme.toolbar} border-b ${theme.border} text-sm select-none shrink-0`}>
        <div className="flex items-center gap-4">
          <Menu size={16} className={`cursor-pointer ${isDarkMode ? 'hover:text-white' : 'hover:text-black'}`} />
          <div className="hidden md:flex gap-3 text-[13px]">{['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Help'].map(item => (<span key={item} className={`cursor-pointer ${isDarkMode ? 'hover:text-white' : 'hover:text-black'}`}>{item}</span>))}</div>
        </div>
        <div className={`flex-1 max-w-md mx-4 ${theme.searchBg} rounded-md h-6 flex items-center px-2 justify-center border ${theme.searchBorder} cursor-pointer ${theme.hover} transition`}><Search size={14} className={`mr-2 ${theme.textMuted}`} /><span className={`text-xs ${theme.textMuted}`}>ba-ide-mvp</span></div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-1 mr-2 rounded transition ${theme.hover}`} title="Toggle Theme">{isDarkMode ? <Sun size={16} className="text-yellow-400" /> : <Moon size={16} className="text-slate-600" />}</button>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-1 rounded transition ${isSidebarOpen ? (isDarkMode ? 'bg-[#333333] text-white' : 'bg-[#e4e4e4] text-black') : theme.hover}`} title="Toggle Primary Side Bar"><PanelLeft size={16} /></button>
          <button onClick={() => setIsTerminalOpen(!isTerminalOpen)} className={`p-1 rounded transition ${isTerminalOpen ? (isDarkMode ? 'bg-[#333333] text-white' : 'bg-[#e4e4e4] text-black') : theme.hover}`} title="Toggle Terminal"><PanelBottom size={16} /></button>
          <button onClick={() => setIsRightPanelOpen(!isRightPanelOpen)} className={`p-1 rounded transition ${isRightPanelOpen ? (isDarkMode ? 'bg-[#333333] text-white' : 'bg-[#e4e4e4] text-black') : theme.hover}`} title="Toggle Right Panel"><PanelRight size={16} /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {isSidebarOpen && (
          <div style={{ width: explorerWidth }} className={`flex flex-col shrink-0 overflow-y-auto ${theme.bgMain}`}>
            <div className={`flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}><span>Explorer</span><MoreHorizontal size={14} className={`cursor-pointer ${isDarkMode ? 'hover:text-white' : 'hover:text-black'}`} /></div>
            <div className="flex flex-col text-[13px] mt-1">
              <div className={`flex items-center gap-1 px-2 py-1 cursor-pointer ${theme.itemHover} transition`}><ChevronDown size={14} /> <Folder size={14} className="text-blue-400" /> <span className="font-semibold">BA_WORKSPACE</span></div>
              <div onClick={() => setIsTabOpen(true)} className={`flex items-center gap-1 pl-6 pr-2 py-1 cursor-pointer ${isTabOpen ? theme.itemActive : theme.itemHover} ${isDarkMode && isTabOpen ? 'border-l-2 border-blue-500' : ''}`}><FileCode size={14} className="text-yellow-400" /> <span className={isDarkMode ? 'text-white' : 'font-medium'}>diagram.mmd</span></div>
            </div>
          </div>
        )}
        {isSidebarOpen && <div className={`w-1 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-10 ${theme.border} border-l`} onMouseDown={() => setIsDraggingExplorer(true)} />}

        <div className="flex flex-1 overflow-hidden">
          <div style={{ width: editorWidth }} className="flex flex-col shrink-0 min-w-[200px] h-full overflow-hidden">
            {isTabOpen ? (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className={`flex items-center h-9 ${theme.bgMain} border-b ${theme.border} overflow-x-auto shrink-0`}>
                  <div className={`flex items-center gap-2 px-3 py-1.5 ${theme.bgMain} border-t-2 ${theme.editorTabTop} text-[13px] cursor-pointer group`}>
                    <FileCode size={14} className="text-yellow-400" /> <span className={isDarkMode ? 'text-white' : 'text-black'}>diagram.mmd</span>
                    <div className="ml-1 p-[2px] rounded-sm opacity-0 group-hover:opacity-100 hover:bg-slate-500/30 transition-opacity" onClick={(e) => { e.stopPropagation(); setIsTabOpen(false); }} title="Close Tab"><X size={14} className={isDarkMode ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-black"} /></div>
                  </div>
                </div>
                <div className={`flex-1 overflow-hidden ${theme.bgMain}`} onKeyDown={(e) => e.stopPropagation()}>
                  <Editor height="100%" defaultLanguage="markdown" theme={isDarkMode ? "vs-dark" : "light"} value={code} onChange={(val) => setCode(val || "")} onMount={handleEditorDidMount} options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: "on", padding: { top: 16 } }} />
                </div>
              </div>
            ) : (
              <div className={`flex items-center justify-center flex-col flex-1 shrink-0 overflow-hidden ${theme.bgMain}`}><FileCode size={48} className={theme.textMuted} strokeWidth={1} /><p className={`mt-4 text-sm ${theme.textMuted}`}>No file is open</p><button onClick={() => setIsTabOpen(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Open diagram.mmd</button></div>
            )}

            {isTerminalOpen && (
              <div className={`h-48 flex flex-col shrink-0 border-t ${theme.border} ${theme.bgMain}`}>
                 <div className={`flex text-[11px] uppercase tracking-wider ${theme.textMuted} border-b ${theme.border} px-4 py-1 gap-4 shrink-0`}>
                    <span className={`cursor-pointer border-b ${isDarkMode ? 'border-blue-500 text-slate-200' : 'border-blue-600 text-slate-800'}`}>Problems</span>
                    <span className="cursor-pointer hover:text-slate-200">Output</span>
                    <span className="cursor-pointer hover:text-slate-200">Terminal</span>
                 </div>
                 <div className="p-3 text-[13px] font-mono overflow-y-auto flex-1">
                   {parseError ? (
                     <div className="text-red-500">
                       <p className="font-semibold mb-1">[{parseError.line}] {parseError.message}</p>
                       <p className="text-slate-400">{parseError.lineText}</p>
                       <p>{"^".repeat(parseError.lineText.length)}</p>
                     </div>
                   ) : (
                     <div className="text-green-500/80">No problems have been detected in the workspace.</div>
                   )}
                 </div>
              </div>
            )}
          </div>

          <div className={`w-1 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-10 ${theme.border} border-l`} onMouseDown={() => setIsDraggingEditor(true)} />

          <div className="flex-1 relative bg-slate-50 min-w-[200px] flex flex-col" ref={reactFlowWrapper}>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-lg border border-slate-200 text-slate-700">
              <button onClick={handleSyncCodeToDiagram} className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-full transition shadow-sm" title="Manual Sync Text to Diagram">
                <Play size={14} /> <span className="hidden xl:inline">Sync Code to Visual</span>
              </button>
              <div className="w-px h-5 bg-slate-300 mx-1"></div>
              <button onClick={handleAutoLayout} className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-full transition" title="Auto Layout Diagram">
                <Wand2 size={14} /> <span className="hidden xl:inline">Auto Layout</span>
              </button>
            </div>
            
            <div ref={coordsRef} className={`absolute top-4 right-4 z-10 px-3 py-1 text-[11px] font-mono rounded-md shadow border ${theme.border} ${theme.bgMain} ${theme.text}`}>
              X: 0 | Y: 0
            </div>

            <div className={`absolute top-4 left-4 z-10 px-2 py-1 text-xs font-medium rounded-md shadow border ${theme.border} ${theme.bgMain} ${theme.text}`}>{(zoomLevel * 100).toFixed(0)}%</div>
            
            <div className="flex-1 w-full h-full" onPointerMove={handleCanvasPointerMove} onMouseUp={handleCanvasMouseUp}>
              <ReactFlow 
                nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} 
                onNodeDragStop={onNodeDragStop} 
                onConnect={onConnect} onMove={handleMove} 
                onDrop={onDrop} onDragOver={onDragOver} onNodeContextMenu={onNodeContextMenu} 
                onEdgeContextMenu={onEdgeContextMenu} onPaneClick={closeContextMenu}
                panActivationKeyCode={null} 
                fitView
              >
                <Background color="#cbd5e1" gap={16} />
                <Controls className="bg-white border-slate-200 fill-slate-600 mb-4 mr-4 shadow-sm rounded-md" />
                <MiniMap nodeColor="#cbd5e1" maskColor="rgba(248, 250, 252, 0.7)" className="shadow-sm rounded-md border border-slate-200" nodeBorderRadius={8} />
              </ReactFlow>
            </div>
          </div>
        </div>

        {isRightPanelOpen && (
          <div className={`w-1 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-10 ${theme.border} border-l`} onMouseDown={() => setIsDraggingRightPanel(true)} />
        )}

        {isRightPanelOpen && (
          <div style={{ width: rightPanelWidth }} className={`flex flex-col shrink-0 overflow-y-auto ${theme.bgMain} pb-10`}>
            <div className={`flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wider ${theme.textMuted} border-b ${theme.border}`}><span>Shapes Library</span></div>
            {SHAPE_CATEGORIES.map((category) => {
              const isOpen = openShapeMenus[category];
              return (
                <div key={category} className="flex flex-col">
                  <div onClick={() => toggleShapeMenu(category)} className={`flex items-center gap-2 px-2 py-2 cursor-pointer ${theme.itemHover} border-b ${theme.border} select-none`}>
                    {isOpen ? <ChevronDown size={16} className={theme.textMuted} /> : <ChevronRight size={16} className={theme.textMuted} />} <span className="text-[13px] font-semibold">{category}</span>
                  </div>
                  {isOpen && <div className={`grid grid-cols-4 gap-2 p-3 border-b ${theme.border}`}>{renderShapeItems(category)}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default function IDEPage() {
  return <ReactFlowProvider><IDEPageContent /></ReactFlowProvider>;
}
