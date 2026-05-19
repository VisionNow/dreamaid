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
  Play, Search, Folder, FileCode, ChevronDown, ChevronRight, Menu,
  MoreHorizontal, Sun, Moon, Type, Circle, User, StickyNote,
  MessageSquare, Box, X, Wand2, PanelLeft, PanelBottom, PanelRight,
  Hexagon, Triangle, Database, Cloud, FileText, RotateCw, Upload,
  Minus, Square
} from "lucide-react";

// --- QUẢN LÝ ẢNH UPLOAD ---
const globalImageRegistry: Record<string, string> = {};

// --- SHAPE DESCRIPTIONS ---
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
  'multiDocument': 'Multiple documents or reports.',
  'internalStorage': 'Internal memory or storage.',
  'cube': 'A 3D cube representation.',
  'step': 'A step in a sequential process.',
  'callout': 'A callout or speech bubble for comments.',
  'actor': 'A user, actor, or person.',
  'note': 'A sticky note for documentation.',
  'image': 'Custom uploaded image.',
  'terminator': 'Terminator / Start or End point.',
  'delay': 'A delay or waiting period.',
  'display': 'Information displayed to a user.',
  'manualInput': 'Data manually entered into the system.',
  'manualOperation': 'A manual operation or process.',
  'offPageConnector': 'Off-page connector.',
  'card': 'Punched card.',
  'collate': 'Collate data or materials.',
  'sort': 'Sorting of materials or data.',
  'merge': 'Merge multiple processes or paths.',
  'extract': 'Extract or split a process.',
  'or': 'Logical OR.',
  'summingJunction': 'Logical AND / Summing junction.',
  'annotationLeft': 'Left bracket annotation.',
  'annotationRight': 'Right bracket annotation.'
};

// --- BỘ MÁY VẼ HÌNH HỌC SVG CHUẨN XÁC ---
const ShapeSvgRenderer = ({ type, fill, stroke, strokeWidth = 2, selected, isLibrary }: any) => {
  const common = { fill, stroke, strokeWidth, vectorEffect: "non-scaling-stroke", strokeLinejoin: "round" as const };
  const commonNone = { ...common, fill: "none" };

  let content = <rect x="0" y="0" width="100" height="100" {...common} />; 
  
  if (type === 'rectangle') content = <rect x={isLibrary ? 5 : 0} y={isLibrary ? 25 : 0} width={isLibrary ? 90 : 100} height={isLibrary ? 50 : 100} {...common} />;
  else if (type === 'square') content = <rect x={isLibrary ? 15 : 0} y={isLibrary ? 15 : 0} width={isLibrary ? 70 : 100} height={isLibrary ? 70 : 100} {...common} />;
  else if (type === 'rounded') content = <rect x={isLibrary ? 5 : 0} y={isLibrary ? 25 : 0} width={isLibrary ? 90 : 100} height={isLibrary ? 50 : 100} rx="10" ry="10" {...common} />;
  else if (type === 'terminator') content = <rect x={isLibrary ? 5 : 0} y={isLibrary ? 25 : 0} width={isLibrary ? 90 : 100} height={isLibrary ? 50 : 100} rx="25" ry="25" {...common} />;
  else if (type === 'ellipse') content = <ellipse cx="50" cy="50" rx={isLibrary ? 45 : 50} ry={isLibrary ? 25 : 50} {...common} />;
  else if (type === 'circle') content = <circle cx="50" cy="50" r={isLibrary ? 35 : 50} {...common} />;
  else if (type === 'diamond') content = <polygon points="50,0 100,50 50,100 0,50" {...common} />;
  else if (type === 'parallelogram') content = <polygon points="15,0 100,0 85,100 0,100" {...common} />;
  else if (type === 'hexagon') content = <polygon points="15,0 85,0 100,50 85,100 15,100 0,50" {...common} />;
  else if (type === 'triangle' || type === 'extract') content = <polygon points="50,0 100,100 0,100" {...common} />;
  else if (type === 'merge') content = <polygon points="0,0 100,0 50,100" {...common} />;
  else if (type === 'cylinder') content = <><path d="M 0 15 C 0 0, 100 0, 100 15 L 100 85 C 100 100, 0 100, 0 85 Z" {...common}/><path d="M 0 15 C 0 30, 100 30, 100 15" {...commonNone}/></>;
  else if (type === 'process') content = <><rect x="0" y="0" width="100" height="100" {...common} /><line x1="15" y1="0" x2="15" y2="100" {...commonNone} /><line x1="85" y1="0" x2="85" y2="100" {...commonNone} /></>;
  else if (type === 'internalStorage') content = <><rect x="0" y="0" width="100" height="100" {...common} /><line x1="0" y1="15" x2="100" y2="15" {...commonNone} /><line x1="15" y1="0" x2="15" y2="100" {...commonNone} /></>;
  else if (type === 'step') content = <polygon points="0,0 85,0 100,50 85,100 0,100 15,50" {...common} />;
  else if (type === 'cube') content = <path d="M 0 20 L 80 20 L 100 0 L 20 0 Z M 80 20 L 100 0 L 100 80 L 80 100 Z M 0 20 L 80 20 L 80 100 L 0 100 Z" {...common} />;
  else if (type === 'note') content = <><path d="M 0 0 L 80 0 L 100 20 L 100 100 L 0 100 Z" {...common} /><path d="M 80 0 L 80 20 L 100 20" {...commonNone} /></>;
  else if (type === 'document') content = <path d="M 0 0 L 100 0 L 100 85 C 75 100, 25 70, 0 85 Z" {...common} />;
  else if (type === 'multiDocument') content = <><path d="M 10 10 L 100 10 L 100 85 C 75 100, 25 70, 10 85 Z" {...common}/><path d="M 0 0 L 90 0 L 90 75 C 65 90, 15 60, 0 75 Z" {...common}/></>;
  else if (type === 'callout') content = <path d="M 0 0 L 100 0 L 100 70 L 40 70 L 20 100 L 20 70 L 0 70 Z" {...common} />;
  else if (type === 'actor') content = <><circle cx="50" cy="25" r="25" {...common} /><path d="M 0 100 Q 0 50 50 50 Q 100 50 100 100 Z" {...common} /></>;
  else if (type === 'cloud') content = <path d="M 25 80 C 5 80 5 45 25 40 C 25 15 70 10 75 35 C 95 35 95 75 85 80 C 85 90 25 90 25 80 Z" {...common} />;
  else if (type === 'delay') content = <path d="M 0 0 L 50 0 C 100 0, 100 100, 50 100 L 0 100 Z" {...common} />;
  else if (type === 'display') content = <path d="M 0 50 L 25 0 L 75 0 C 100 0, 100 100, 75 100 L 25 100 Z" {...common} />;
  else if (type === 'manualInput') content = <polygon points="0,25 100,0 100,100 0,100" {...common} />;
  else if (type === 'manualOperation') content = <polygon points="20,0 80,0 100,100 0,100" {...common} />;
  else if (type === 'offPageConnector') content = <polygon points="0,0 100,0 100,50 50,100 0,50" {...common} />;
  else if (type === 'card') content = <polygon points="0,20 20,0 100,0 100,100 0,100" {...common} />;
  else if (type === 'collate') content = <polygon points="0,0 100,0 0,100 100,100" {...common} />;
  else if (type === 'sort') content = <><polygon points="50,0 100,50 50,100 0,50" {...common} /><line x1="0" y1="50" x2="100" y2="50" {...commonNone} /></>;
  else if (type === 'or') content = <><circle cx="50" cy="50" r="50" {...common}/><line x1="15" y1="15" x2="85" y2="85" {...commonNone}/><line x1="15" y1="85" x2="85" y2="15" {...commonNone}/></>;
  else if (type === 'summingJunction') content = <><circle cx="50" cy="50" r="50" {...common}/><line x1="50" y1="0" x2="50" y2="100" {...commonNone}/><line x1="0" y1="50" x2="100" y2="50" {...commonNone}/></>;
  else if (type === 'annotationLeft') content = <path d="M 20 0 L 15 0 C 5 0 5 20 5 40 C 5 45 0 50 0 50 C 5 50 5 55 5 60 C 5 80 5 100 15 100 L 20 100" {...commonNone} />;
  else if (type === 'annotationRight') content = <path d="M 80 0 L 85 0 C 95 0 95 20 95 40 C 95 45 100 50 100 50 C 95 50 95 55 95 60 C 95 80 95 100 85 100 L 80 100" {...commonNone} />;
  else if (type === 'text' || type === 'image') content = <></>;

  return (
    <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
      {content}
      {['text', 'image', 'annotationLeft', 'annotationRight'].includes(type) && selected && (
        <rect x="0" y="0" width="100" height="100" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
};

// --- 1. CUSTOM SHAPE NODE ---
const CustomShapeNode = ({ id, data, selected, style }: any) => {
  const { shapeType, label, imageUrl, rotation = 0 } = data;
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const [rotAngle, setRotAngle] = useState(rotation);
  
  const nodeRef = useRef<HTMLDivElement>(null);
  const { setNodes } = useReactFlow();
  const connectionNodeId = useStore((state) => state.connectionNodeId);
  const isConnecting = !!connectionNodeId;
  const showHandles = selected || isHovered || isConnecting;

  useEffect(() => { setEditValue(label); }, [label]);
  useEffect(() => { setRotAngle(rotation); }, [rotation]);

  const saveEdit = () => {
    setIsEditing(false);
    setNodes((nds) => {
      const newNodes = nds.map((n) => n.id === id ? { ...n, data: { ...n.data, label: editValue } } : n);
      setTimeout(() => window.dispatchEvent(new CustomEvent('mermaid-rebuild', { detail: { nodes: newNodes } })), 0);
      return newNodes;
    });
  };

  const onRotateMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const rect = nodeRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - centerX;
      const dy = moveEvent.clientY - centerY;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      angle = (angle + 360) % 360;
      angle = Math.round(angle / 15) * 15;
      setRotAngle(angle);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setNodes((nds) => {
        const newNodes = nds.map((n) => n.id === id ? { ...n, data: { ...n.data, rotation: rotAngle } } : n);
        setTimeout(() => window.dispatchEvent(new CustomEvent('mermaid-rebuild', { detail: { nodes: newNodes } })), 0);
        return newNodes;
      });
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const isTransparent = ['text', 'image', 'annotationLeft', 'annotationRight'].includes(shapeType);
  const fillColor = isTransparent ? 'transparent' : '#ffffff';
  const strokeColor = selected ? '#3b82f6' : '#1e293b';
  const strokeWidth = selected ? 3 : 2;

  const handleStyle = { width: '8px', height: '8px', background: '#3b82f6', opacity: showHandles ? 1 : 0, transition: 'opacity 0.2s', border: '1px solid white' };

  const displayUrl = imageUrl?.startsWith('custom_') ? (globalImageRegistry[imageUrl] || '') : imageUrl;

  return (
    <div className="relative group w-full h-full" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      {selected && (
        <div 
          className="nodrag absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border border-blue-500 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-sm z-50 text-blue-600 hover:bg-blue-50"
          onMouseDown={onRotateMouseDown}
        >
          <RotateCw size={12} strokeWidth={3} />
        </div>
      )}

      <div ref={nodeRef} style={{ width: '100%', height: '100%', transform: `rotate(${rotAngle}deg)`, transformOrigin: 'center center' }}>
        <NodeResizer color="#3b82f6" isVisible={selected} minWidth={isTransparent ? 20 : 50} minHeight={isTransparent ? 20 : 40} handleStyle={{ width: '8px', height: '8px', borderRadius: '2px' }} lineStyle={{ borderWidth: '2px' }} />

        <Handle type="target" position={Position.Top} id="top-t" style={{...handleStyle, top: '-4px'}} />
        <Handle type="source" position={Position.Top} id="top-s" style={{...handleStyle, top: '-4px'}} />
        <Handle type="target" position={Position.Bottom} id="bot-t" style={{...handleStyle, bottom: '-4px'}} />
        <Handle type="source" position={Position.Bottom} id="bot-s" style={{...handleStyle, bottom: '-4px'}} />
        <Handle type="target" position={Position.Right} id="right-t" style={{...handleStyle, right: '-4px'}} />
        <Handle type="source" position={Position.Right} id="right-s" style={{...handleStyle, right: '-4px'}} />
        <Handle type="target" position={Position.Left} id="left-t" style={{...handleStyle, left: '-4px'}} />
        <Handle type="source" position={Position.Left} id="left-s" style={{...handleStyle, left: '-4px'}} />
        
        <div className="absolute inset-0 z-0 pointer-events-none">
           {shapeType === 'image' && displayUrl && <img src={displayUrl} className="w-full h-full object-contain pointer-events-none p-1" />}
           <ShapeSvgRenderer type={shapeType} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} selected={selected} />
        </div>

        <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center p-2 text-[#0f172a] text-xs font-medium text-center ${shapeType === 'actor' ? 'justify-end pb-0' : ''} ${shapeType === 'image' ? 'justify-end -bottom-6 h-auto drop-shadow-md' : ''}`} onDoubleClick={() => setIsEditing(true)}>
          {isEditing ? (
            <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="w-[90%] text-center text-slate-800 bg-white/80 outline-none border-b border-blue-400" />
          ) : label}
        </div>
      </div>
    </div>
  );
};

// --- 2. SMART EDGE ---
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

  if (source === target) {
    const labelLength = typeof label === 'string' ? label.length : 0;
    const radiusX = Math.max(40, sWidth * 0.4) + labelLength * 2; 
    const radiusY = Math.max(50, sHeight * 0.5) + labelLength * 2;
    const startX = sourceNode.position.x + sWidth * 0.75; const startY = sourceNode.position.y;
    const endX = sourceNode.position.x + sWidth; const endY = sourceNode.position.y + sHeight * 0.25;
    const c1X = startX + radiusX * 0.8; const c1Y = startY - radiusY;
    const c2X = endX + radiusX; const c2Y = endY - radiusY * 0.8;

    const edgePath = `M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`;
    const labelX = startX + radiusX * 0.6; const labelY = startY - radiusY * 0.6;

    return (
      <>
        <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} markerStart={markerStart} />
        {(label || isEditing) ? (
          <EdgeLabelRenderer>
            <div onDoubleClick={() => setIsEditing(true)} className="nodrag nopan" style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, background: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: 11, fontWeight: 600, color: '#334155', zIndex: 20, pointerEvents: 'all' }}>
              {isEditing ? <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="text-center text-slate-800 bg-transparent outline-none border-b border-blue-400" style={{minWidth: '40px'}} /> : label}
            </div>
          </EdgeLabelRenderer>
        ) : null}
      </>
    );
  }

  const sX = sourceNode.position.x + sWidth / 2; const sY = sourceNode.position.y + sHeight / 2;
  const tX = targetNode.position.x + tWidth / 2; const tY = targetNode.position.y + tHeight / 2;
  const dx = tX - sX; const dy = tY - sY;
  
  let sPos = Position.Right, tPos = Position.Left;
  if (Math.abs(dx) > Math.abs(dy)) { sPos = dx > 0 ? Position.Right : Position.Left; tPos = dx > 0 ? Position.Left : Position.Right; } 
  else { sPos = dy > 0 ? Position.Bottom : Position.Top; tPos = dy > 0 ? Position.Top : Position.Bottom; }

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
    let sShift = 0; let tShift = 0;
    if (!data?.bidirectional) { sShift = -8; tShift = 8; }
    let fSX = sourceX, fSY = sourceY, fTX = targetX, fTY = targetY;
    if (sPos === Position.Right || sPos === Position.Left) { fSY += sShift; fTY += tShift; } else { fSX += sShift; fTX += tShift; }
    [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX: fSX, sourceY: fSY, sourcePosition: sPos, targetX: fTX, targetY: fTY, targetPosition: tPos, borderRadius: 16 });
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} markerStart={markerStart} />
      {(label || isEditing) ? (
        <EdgeLabelRenderer>
          <div onDoubleClick={() => setIsEditing(true)} className="nodrag nopan" style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, background: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: 11, fontWeight: 600, color: '#334155', zIndex: 20, pointerEvents: 'all' }}>
            {isEditing ? <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="text-center text-slate-800 bg-transparent outline-none border-b border-blue-400" style={{minWidth: '40px'}} /> : label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
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
      if ((forwardEdge.label || "") === (backwardEdge.label || "")) {
        forwardEdge.markerStart = { type: MarkerType.ArrowClosed, width: 20, height: 20 };
        forwardEdge.data = { ...forwardEdge.data, bidirectional: true, isCurved: false };
        consolidated.push(forwardEdge);
      } else {
        forwardEdge.data = { ...forwardEdge.data, bidirectional: false, isCurved: true };
        backwardEdge.data = { ...backwardEdge.data, bidirectional: false, isCurved: true };
        consolidated.push(forwardEdge, backwardEdge);
      }
    } else if (forwardEdge) {
      forwardEdge.data = { ...forwardEdge.data, isCurved: false }; consolidated.push(forwardEdge);
    } else if (backwardEdge) {
      backwardEdge.data = { ...backwardEdge.data, isCurved: false }; consolidated.push(backwardEdge);
    }
  });

  return consolidated;
};

// --- 4. STRICT PARSER ---
const parseMermaid = (code: string) => {
  const nodesMap = new Map<string, Node>();
  const edges: Edge[] = [];
  const lines = code.split('\n');
  const edgeRegex = /([a-zA-Z0-9_]+)(?:\["(.*?)"\]|\[(.*?)\])?\s*(<--+>|-+>)\s*(?:\|(.*?)\|)?\s*([a-zA-Z0-9_]+)(?:\["(.*?)"\]|\[(.*?)\])?/;
  const nodeRegex = /^\s*([a-zA-Z0-9_]+)(?:\["(.*?)"\]|\[(.*?)\])?/;

  lines.forEach((line, index) => {
    let cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('graph') || cleanLine.startsWith('flowchart') || cleanLine.startsWith('%%')) return;
    
    let metadata = { shapeType: 'rectangle', x: undefined as number|undefined, y: undefined as number|undefined, w: 120, h: 40, rot: 0, img: undefined as string|undefined };
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
       const rMatch = metaStr.match(/rot:(-?\d+)/); if (rMatch) metadata.rot = parseInt(rMatch[1]);
       const imgMatch = metaStr.match(/img:([^\s]+)/); if (imgMatch) metadata.img = imgMatch[1];
    }
    
    if (!codePart) return; 

    const edgeMatch = codePart.match(edgeRegex);
    if (edgeMatch) {
      const [_, sourceId, sQ, sNQ, arrow, edgeLabel, targetId, tQ, tNQ] = edgeMatch;
      const sourceLabel = sQ || sNQ || sourceId; const targetLabel = tQ || tNQ || targetId;
      const isBidirectional = arrow.includes('<');

      if (!nodesMap.has(sourceId)) nodesMap.set(sourceId, { id: sourceId, position: { x: metadata.x || 0, y: metadata.y || 0 }, data: { label: sourceLabel, shapeType: metadata.shapeType, imageUrl: metadata.img, rotation: metadata.rot }, style: { width: metadata.w, height: metadata.h }, type: 'customShape' });
      if (!nodesMap.has(targetId)) nodesMap.set(targetId, { id: targetId, position: { x: (metadata.x || 0) + 200, y: (metadata.y || 0) + 100 }, data: { label: targetLabel, shapeType: 'rectangle' }, style: { width: 120, height: 40 }, type: 'customShape' });
      
      edges.push({ id: `e${sourceId}-${targetId}-${index}`, source: sourceId, target: targetId, label: edgeLabel || undefined, type: 'smart', markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 }, markerStart: isBidirectional ? { type: MarkerType.ArrowClosed, width: 20, height: 20 } : undefined, data: { bidirectional: isBidirectional } });
      return;
    } 
    
    const nodeMatch = codePart.match(nodeRegex);
    if (nodeMatch) {
      const [_, nodeId, lQ, lNQ] = nodeMatch;
      const label = lQ || lNQ || nodeId;
      if (!nodesMap.has(nodeId)) {
        nodesMap.set(nodeId, { id: nodeId, position: { x: metadata.x !== undefined ? metadata.x : Math.random() * 200, y: metadata.y !== undefined ? metadata.y : Math.random() * 200 }, data: { label, shapeType: metadata.shapeType, imageUrl: metadata.img, rotation: metadata.rot }, style: { width: metadata.w, height: metadata.h }, type: 'customShape' });
      } else {
        const existingNode = nodesMap.get(nodeId)!;
        existingNode.data.label = label; existingNode.data.shapeType = metadata.shapeType; existingNode.data.imageUrl = metadata.img; existingNode.data.rotation = metadata.rot;
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
    const rot = node.data.rotation || 0;
    const imgStr = node.data.imageUrl ? ` img:${node.data.imageUrl}` : "";
    const x = Math.round(node.position.x); const y = Math.round(node.position.y);
    const w = Math.round(node.style?.width as number || node.width || 120);
    const h = Math.round(node.style?.height as number || node.height || 40);
    mermaidCode += `    ${node.id}["${label}"] %% shape:${shape}${imgStr} x:${x} y:${y} w:${w} h:${h} rot:${rot}\n`; 
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

const SHAPE_CATEGORIES = ["Custom", "General", "Flowchart"];

// --- NỘI DUNG IDE CHÍNH ---
const IDEPageContent = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const coordsRef = useRef<HTMLDivElement>(null); 
  const monacoRef = useRef<any>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { screenToFlowPosition } = useReactFlow();

  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [isTabOpen, setIsTabOpen] = useState<boolean>(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(false); 
  const [isMiniMapOpen, setIsMiniMapOpen] = useState<boolean>(true);
  const [isMiniMapHovered, setIsMiniMapHovered] = useState<boolean>(false);
  const [parseError, setParseError] = useState<{line: number, message: string, lineText: string} | null>(null);

  const [openShapeMenus, setOpenShapeMenus] = useState<Record<string, boolean>>({ "Custom": true, "General": true, "Flowchart": true });
  
  const [customShapes, setCustomShapes] = useState<any[]>([]);

  const [explorerWidth, setExplorerWidth] = useState<number>(256);
  const [editorWidth, setEditorWidth] = useState<number>(500);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(280);
  
  const [isDraggingExplorer, setIsDraggingExplorer] = useState(false);
  const [isDraggingEditor, setIsDraggingEditor] = useState(false);
  const [isDraggingRightPanel, setIsDraggingRightPanel] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ id: string; top: number; left: number; type: 'node' | 'edge' } | null>(null);
  const [activeCustomShape, setActiveCustomShape] = useState<string | null>(null);
  const [hoveredShape, setHoveredShape] = useState<{ x: number, y: number, item: any } | null>(null);
  const hoverTimeout = useRef<any>(null);

  const [code, setCode] = useState<string>("graph TD;\n    KH[\"Customer\"] %% shape:actor x:100 y:100 w:80 h:80 rot:0\n    BA[\"Business Analyst\"] %% shape:rectangle x:300 y:250 w:120 h:40 rot:0\n\n    KH -->|Send Request| BA;\n");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const updateCodeFromFlow = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    setCode(generateMermaidFromFlow(currentNodes, currentEdges));
    setParseError(null);
    if (monacoRef.current) monacoRef.current.monaco.editor.setModelMarkers(monacoRef.current.editor.getModel(), "mermaid", []);
  }, []);

  useEffect(() => {
    try {
      const savedShapes = JSON.parse(localStorage.getItem('custom_shapes_list') || '[]');
      savedShapes.forEach((s: any) => {
        const base64 = localStorage.getItem(s.url);
        if (base64) {
          globalImageRegistry[s.url] = base64;
        }
      });
      setCustomShapes(savedShapes);
    } catch (e) {}
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const imgId = `custom_${Date.now()}`;
      globalImageRegistry[imgId] = base64;
      
      const newShapeInfo = { label: file.name.split('.')[0].substring(0, 15), url: imgId };

      try {
        localStorage.setItem(imgId, base64);
        const savedShapes = JSON.parse(localStorage.getItem('custom_shapes_list') || '[]');
        savedShapes.push(newShapeInfo);
        localStorage.setItem('custom_shapes_list', JSON.stringify(savedShapes));
      } catch (err) {
        console.warn("LocalStorage may be full, saving in memory only.");
      }

      setCustomShapes(prev => [...prev, newShapeInfo]);
      setOpenShapeMenus(prev => ({ ...prev, "Custom": true }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const renameCustomShape = (url: string) => {
    const shape = customShapes.find(s => s.url === url);
    if (!shape) return;
    const newName = prompt("Enter new name:", shape.label);
    if (newName) {
      const updated = customShapes.map(s => s.url === url ? { ...s, label: newName } : s);
      setCustomShapes(updated);
      localStorage.setItem('custom_shapes_list', JSON.stringify(updated));
    }
    setActiveCustomShape(null);
  };

  const deleteCustomShape = (url: string) => {
    if (confirm("Are you sure you want to delete this custom shape?")) {
      const updated = customShapes.filter(s => s.url !== url);
      setCustomShapes(updated);
      localStorage.setItem('custom_shapes_list', JSON.stringify(updated));
      localStorage.removeItem(url);
    }
    setActiveCustomShape(null);
  };

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
      if (monacoRef.current) {
        monacoRef.current.monaco.editor.setModelMarkers(monacoRef.current.editor.getModel(), "mermaid", []);
      }
    } catch (err: any) { 
      setParseError(err);
      setIsTerminalOpen(true);
      if (monacoRef.current && err.line) {
        monacoRef.current.monaco.editor.setModelMarkers(monacoRef.current.editor.getModel(), "mermaid", [{
          startLineNumber: err.line, startColumn: 1, endLineNumber: err.line, endColumn: err.lineText.length + 1,
          message: err.message, severity: monacoRef.current.monaco.MarkerSeverity.Error
        }]);
      }
    }
  }, [code]);

  useEffect(() => { handleSyncCodeToDiagram(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAutoLayout = useCallback(() => {
    const layoutedNodes = autoLayoutElements(nodes, edges);
    setNodes(layoutedNodes);
    setCode(generateMermaidFromFlow(layoutedNodes, edges));
  }, [nodes, edges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onNodeDragStop = useCallback(() => { updateCodeFromFlow(nodes, edges); }, [nodes, edges, updateCodeFromFlow]);
  const onNodeResizeStop = useCallback(() => { updateCodeFromFlow(nodes, edges); }, [nodes, edges, updateCodeFromFlow]);
  
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
      const xSpan = coordsRef.current.querySelector('#coord-x');
      const ySpan = coordsRef.current.querySelector('#coord-y');
      if(xSpan) xSpan.innerHTML = `X: ${Math.round(flowPos.x)}`;
      if(ySpan) ySpan.innerHTML = `Y: ${Math.round(flowPos.y)}`;
    }
  }, [screenToFlowPosition]);

  const onDragStart = (event: React.DragEvent, shapeType: string, defaultLabel: string, imageUrl?: string) => {
    event.dataTransfer.setData("application/reactflow-type", shapeType);
    event.dataTransfer.setData("application/reactflow-label", defaultLabel);
    if (imageUrl) event.dataTransfer.setData("application/reactflow-image", imageUrl);
    event.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }, []);
  
  const addNodeToCanvas = useCallback((type: string, label: string, position: {x: number, y: number}, imageUrl?: string) => {
    const uniqueId = Date.now().toString().slice(-4);
    const newNodeId = `node_${type}_${uniqueId}`;
    
    let w = 120, h = 40;
    if (['square', 'circle', 'hexagon', 'cube', 'actor', 'image', 'or', 'summingJunction'].includes(type)) { w = 80; h = 80; }
    else if (type === 'ellipse' || type === 'cloud') { w = 120; h = 60; }
    else if (type === 'text') { w = 50; h = 30; }
    else if (type === 'annotationLeft' || type === 'annotationRight') { w = 100; h = 50; }

    const initialLabel = type === 'text' ? 'Text' : '';

    const newNode: Node = { 
      id: newNodeId, type: 'customShape', position, 
      data: { label: initialLabel, shapeType: type, imageUrl, rotation: 0 }, 
      style: { width: w, height: h } 
    };
    const newNodes = nodes.concat(newNode);
    setNodes(newNodes); updateCodeFromFlow(newNodes, edges);
  }, [nodes, edges, updateCodeFromFlow]);

  const onDrop = useCallback((event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow-type");
      const label = event.dataTransfer.getData("application/reactflow-label");
      const imageUrl = event.dataTransfer.getData("application/reactflow-image");
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNodeToCanvas(type, label, position, imageUrl);
  }, [screenToFlowPosition, addNodeToCanvas]);

  const onShapeClick = useCallback((type: string, label: string, imageUrl?: string) => {
      const offset = (Math.random() * 40) - 20; 
      const centerPosition = screenToFlowPosition({ x: window.innerWidth / 2 + offset, y: window.innerHeight / 2 + offset });
      addNodeToCanvas(type, label, centerPosition, imageUrl);
  }, [screenToFlowPosition, addNodeToCanvas]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault(); setContextMenu({ id: node.id, top: event.clientY, left: event.clientX, type: 'node' });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault(); setContextMenu({ id: edge.id, top: event.clientY, left: event.clientX, type: 'edge' });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setActiveCustomShape(null);
  }, []);

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

  const theme = isDarkMode ? { bgMain: "bg-[#1e1e1e]", text: "text-[#cccccc]", textMuted: "text-slate-400", border: "border-[#2b2b2b]", toolbar: "bg-[#181818]", hover: "hover:bg-[#333333]", searchBg: "bg-[#2b2b2b]", searchBorder: "border-[#3c3c3c]", itemHover: "hover:bg-[#2a2d2e]", itemActive: "bg-[#37373d]", editorTabTop: "border-blue-500" } : { bgMain: "bg-white", text: "text-slate-800", textMuted: "text-slate-500", border: "border-slate-300", toolbar: "bg-[#f3f3f3]", hover: "hover:bg-[#e4e4e4]", searchBg: "bg-white", searchBorder: "border-slate-300", itemHover: "hover:bg-slate-100", itemActive: "bg-[#e4e6f1] text-blue-700", editorTabTop: "border-blue-600" };
  
  const libFill = isDarkMode ? '#333333' : '#ffffff';
  const libStroke = isDarkMode ? '#cccccc' : '#1e293b';

  const toggleShapeMenu = (category: string) => setOpenShapeMenus(prev => ({ ...prev, [category]: !prev[category] }));
  
  const handleMouseMove = useCallback((e: MouseEvent) => { 
    if (isDraggingExplorer) setExplorerWidth(Math.max(150, Math.min(e.clientX, 500))); 
    else if (isDraggingRightPanel) setRightPanelWidth(Math.max(180, Math.min(window.innerWidth - e.clientX, 600))); 
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
    if (category === "Custom") {
      return (
        <>
          <input type="file" accept="image/png, image/jpeg, image/jpg, image/svg+xml" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
          
          <div 
             onClick={() => fileInputRef.current?.click()}
             className={`w-14 h-14 rounded border border-dashed ${isDarkMode ? 'border-[#4b4b4b] hover:border-blue-500 text-slate-400' : 'border-slate-300 hover:border-blue-500 text-slate-500'} cursor-pointer flex flex-col items-center justify-center transition-colors`}
             title="Upload Custom Image Shape"
          >
             <Upload size={16} className="mb-1" />
             <span className="text-[9px] text-center leading-tight">Insert<br/>Shape</span>
          </div>

          {customShapes.map(item => {
            const displayUrl = globalImageRegistry[item.url] || '';
            const customItem = { type: 'image', label: item.label, icon: <img src={displayUrl} style={{width: 24}}/>, url: item.url };
            
            return (
              <div key={item.url} className="relative w-14 h-14">
                 <div 
                    onClick={(e) => { e.stopPropagation(); setActiveCustomShape(activeCustomShape === item.url ? null : item.url); }} 
                    draggable 
                    onDragStart={(event) => onDragStart(event, 'image', item.label, item.url)}
                    onMouseEnter={(e) => handleShapeMouseEnter(e, customItem)} 
                    onMouseLeave={handleShapeMouseLeave}
                    className={`w-full h-full rounded border ${isDarkMode ? 'border-[#3c3c3c] bg-[#1e1e1e] hover:bg-[#2a2d2e]' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'} hover:border-blue-500 cursor-pointer flex flex-col items-center justify-center p-1`} 
                    title={item.label}
                 >
                    <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
                       <img src={displayUrl} alt={item.label} className="w-[80%] h-[80%] object-contain" />
                    </div>
                    <div className={`w-full text-[9px] text-center truncate ${theme.textMuted}`}>{item.label}</div>
                 </div>

                 {activeCustomShape === item.url && (
                    <div className="absolute top-full left-0 z-[100] mt-1 bg-white border border-slate-200 shadow-lg rounded text-xs flex flex-col w-24 overflow-hidden">
                       <button className="px-3 py-2 text-left hover:bg-slate-100 text-slate-700" onClick={(e) => { e.stopPropagation(); onShapeClick('image', item.label, item.url); setActiveCustomShape(null); }}>Insert</button>
                       <button className="px-3 py-2 text-left hover:bg-slate-100 text-slate-700" onClick={(e) => { e.stopPropagation(); renameCustomShape(item.url); }}>Rename</button>
                       <button className="px-3 py-2 text-left hover:bg-red-50 text-red-600 font-medium" onClick={(e) => { e.stopPropagation(); deleteCustomShape(item.url); }}>Delete</button>
                    </div>
                 )}
              </div>
            )
          })}
        </>
      );
    }

    if (category === "General") {
      return (
        <>
          {[ 
            { type: 'rectangle', label: 'Rectangle', icon: <ShapeSvgRenderer type="rectangle" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'rounded', label: 'Rounded Rectangle', icon: <ShapeSvgRenderer type="rounded" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'text', label: 'Text', icon: <Type size={18} className={theme.textMuted} /> }, 
            { type: 'ellipse', label: 'Ellipse', icon: <ShapeSvgRenderer type="ellipse" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'square', label: 'Square', icon: <ShapeSvgRenderer type="square" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'circle', label: 'Circle', icon: <ShapeSvgRenderer type="circle" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'process', label: 'Process', icon: <ShapeSvgRenderer type="process" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'diamond', label: 'Diamond', icon: <ShapeSvgRenderer type="diamond" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'parallelogram', label: 'Data', icon: <ShapeSvgRenderer type="parallelogram" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'hexagon', label: 'Hexagon', icon: <ShapeSvgRenderer type="hexagon" fill={libFill} stroke={libStroke} isLibrary={true} /> },
            { type: 'triangle', label: 'Triangle', icon: <ShapeSvgRenderer type="triangle" fill={libFill} stroke={libStroke} isLibrary={true} /> },
            { type: 'cylinder', label: 'Database', icon: <ShapeSvgRenderer type="cylinder" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'cloud', label: 'Cloud', icon: <ShapeSvgRenderer type="cloud" fill={libFill} stroke={libStroke} isLibrary={true} /> },
            { type: 'document', label: 'Document', icon: <ShapeSvgRenderer type="document" fill={libFill} stroke={libStroke} isLibrary={true} /> },
            { type: 'internalStorage', label: 'Internal Storage', icon: <ShapeSvgRenderer type="internalStorage" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'cube', label: 'Cube', icon: <ShapeSvgRenderer type="cube" fill={libFill} stroke={libStroke} isLibrary={true} /> },
            { type: 'step', label: 'Step', icon: <ShapeSvgRenderer type="step" fill={libFill} stroke={libStroke} isLibrary={true} /> },
            { type: 'callout', label: 'Callout', icon: <ShapeSvgRenderer type="callout" fill={libFill} stroke={libStroke} isLibrary={true} /> },
            { type: 'actor', label: 'Actor', icon: <ShapeSvgRenderer type="actor" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'note', label: 'Note', icon: <ShapeSvgRenderer type="note" fill={libFill} stroke={libStroke} isLibrary={true} /> }
          ].map(item => (
            <div 
              key={item.label} onClick={() => onShapeClick(item.type, item.label)} draggable onDragStart={(event) => onDragStart(event, item.type, item.label)} 
              onMouseEnter={(e) => handleShapeMouseEnter(e, item)} onMouseLeave={handleShapeMouseLeave}
              className={`w-14 h-14 rounded border ${isDarkMode ? 'border-[#3c3c3c] bg-[#1e1e1e] hover:bg-[#2a2d2e]' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'} hover:border-blue-500 cursor-pointer flex items-center justify-center p-2`} title={item.label}
            >
              {item.type === 'text' ? item.icon : <div className="w-full h-full pointer-events-none">{item.icon}</div>}
            </div>
          ))}
        </>
      );
    }
    
    if (category === "Flowchart") {
      return (
        <>
          {[ 
            { type: 'annotationLeft', label: 'Annotation 1', icon: <ShapeSvgRenderer type="annotationLeft" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'annotationRight', label: 'Annotation 2', icon: <ShapeSvgRenderer type="annotationRight" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'diamond', label: 'Decision', icon: <ShapeSvgRenderer type="diamond" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'parallelogram', label: 'Data', icon: <ShapeSvgRenderer type="parallelogram" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'process', label: 'Predefined Process', icon: <ShapeSvgRenderer type="process" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'internalStorage', label: 'Internal Storage', icon: <ShapeSvgRenderer type="internalStorage" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'document', label: 'Document', icon: <ShapeSvgRenderer type="document" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'multiDocument', label: 'Multi-Document', icon: <ShapeSvgRenderer type="multiDocument" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'terminator', label: 'Terminator', icon: <ShapeSvgRenderer type="terminator" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'hexagon', label: 'Preparation', icon: <ShapeSvgRenderer type="hexagon" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'manualInput', label: 'Manual Input', icon: <ShapeSvgRenderer type="manualInput" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'manualOperation', label: 'Manual Operation', icon: <ShapeSvgRenderer type="manualOperation" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'circle', label: 'Connector', icon: <ShapeSvgRenderer type="circle" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'offPageConnector', label: 'Off-Page Connector', icon: <ShapeSvgRenderer type="offPageConnector" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'card', label: 'Card', icon: <ShapeSvgRenderer type="card" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'or', label: 'Or', icon: <ShapeSvgRenderer type="or" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'summingJunction', label: 'Summing Junction', icon: <ShapeSvgRenderer type="summingJunction" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'collate', label: 'Collate', icon: <ShapeSvgRenderer type="collate" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'sort', label: 'Sort', icon: <ShapeSvgRenderer type="sort" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'extract', label: 'Extract', icon: <ShapeSvgRenderer type="extract" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'merge', label: 'Merge', icon: <ShapeSvgRenderer type="merge" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'cylinder', label: 'Database', icon: <ShapeSvgRenderer type="cylinder" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'delay', label: 'Delay', icon: <ShapeSvgRenderer type="delay" fill={libFill} stroke={libStroke} isLibrary={true} /> }, 
            { type: 'display', label: 'Display', icon: <ShapeSvgRenderer type="display" fill={libFill} stroke={libStroke} isLibrary={true} /> }
          ].map(item => (
            <div 
              key={item.label} onClick={() => onShapeClick(item.type, item.label)} draggable onDragStart={(event) => onDragStart(event, item.type, item.label)} 
              onMouseEnter={(e) => handleShapeMouseEnter(e, item)} onMouseLeave={handleShapeMouseLeave}
              className={`w-14 h-14 rounded border ${isDarkMode ? 'border-[#3c3c3c] bg-[#1e1e1e] hover:bg-[#2a2d2e]' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'} hover:border-blue-500 cursor-pointer flex items-center justify-center p-2`} title={item.label}
            >
              <div className="w-full h-full pointer-events-none">{item.icon}</div>
            </div>
          ))}
        </>
      );
    }
    
    return null;
  };

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: any) => {
    monacoRef.current = { editor, monaco };
  };

  return (
    <div className={`flex flex-col h-screen w-full ${theme.bgMain} ${theme.text} font-sans overflow-hidden transition-colors duration-200`} onClick={closeContextMenu}>
      
      {/* SHAPE TOOLTIP PORTAL */}
      {hoveredShape && (
        <div 
          className={`fixed z-[9999] text-xs rounded-md shadow-2xl p-3 w-48 pointer-events-none transform -translate-x-full -translate-y-1/2 transition-opacity ${isDarkMode ? 'bg-[#252526] text-white border border-[#4b4b4b]' : 'bg-white text-slate-800 border border-slate-300'}`}
          style={{ top: hoveredShape.y, left: hoveredShape.x - 10 }}
        >
          <div className="flex flex-col items-center gap-2">
             <div className={`w-12 h-12 flex items-center justify-center p-1 rounded border ${isDarkMode ? 'bg-[#1e1e1e] border-[#4b4b4b]' : 'bg-slate-50 border-slate-200'}`}>
                {hoveredShape.item.type === 'text' || hoveredShape.item.type === 'image' ? hoveredShape.item.icon : <div className="w-full h-full">{hoveredShape.item.icon}</div>}
             </div>
             <div className="font-bold text-[13px] text-center">{hoveredShape.item.label}</div>
             <div className={`text-center leading-snug ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{shapeDescriptions[hoveredShape.item.type] || 'A flowchart shape.'}</div>
          </div>
          <div className={`absolute right-[-5px] top-1/2 -translate-y-1/2 w-2 h-2 transform rotate-45 border-t border-r ${isDarkMode ? 'bg-[#252526] border-[#4b4b4b]' : 'bg-white border-slate-300'}`}></div>
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
            
            <div ref={coordsRef} className={`absolute top-4 right-4 z-10 flex flex-wrap justify-end gap-x-2 max-w-[120px] px-3 py-1 text-[11px] font-mono rounded-md shadow border ${theme.border} ${theme.bgMain} ${theme.text}`}>
              <span id="coord-x">X: 0</span>
              <span id="coord-y">Y: 0</span>
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
                <Controls position="bottom-left" className="bg-white border-slate-200 fill-slate-600 mb-4 ml-4 shadow-sm rounded-md" />
                
                <div 
                   className="absolute bottom-4 right-4 z-[101] flex flex-col items-end"
                   onMouseEnter={() => setIsMiniMapHovered(true)} onMouseLeave={() => setIsMiniMapHovered(false)}
                >
                   {isMiniMapOpen ? (
                      <div className="relative rounded-md shadow border border-slate-200 overflow-hidden bg-white">
                         <MiniMap style={{ position: 'relative', bottom: 'auto', right: 'auto', margin: 0 }} nodeColor="#cbd5e1" maskColor="rgba(248, 250, 252, 0.7)" nodeBorderRadius={8} />
                         {isMiniMapHovered && (
                            <button onClick={() => setIsMiniMapOpen(false)} className="absolute top-1 right-1 p-1 bg-white/90 hover:bg-slate-100 text-slate-600 hover:text-blue-600 rounded shadow-sm z-50">
                               <Minus size={12} strokeWidth={3} />
                            </button>
                         )}
                      </div>
                   ) : (
                      <button onClick={() => setIsMiniMapOpen(true)} className={`p-2 rounded-md shadow border ${theme.border} ${theme.bgMain} text-slate-600 hover:text-blue-600 cursor-pointer`}>
                         <Square size={16} strokeWidth={2} />
                      </button>
                   )}
                </div>

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
                  {isOpen && <div className={`flex flex-wrap content-start gap-2 p-3 border-b ${theme.border}`}>{renderShapeItems(category)}</div>}
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
