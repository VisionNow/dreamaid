"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
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
  addEdge
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { 
  Play, PlusCircle, Link as LinkIcon, Save, Download,
  PanelLeft, PanelBottom, PanelRight, Search, Folder,
  FileCode, File, ChevronDown, ChevronRight, Menu,
  MoreHorizontal, Sun, Moon, Database, Cloud, FileText,
  Hexagon, Triangle, Type, Circle, User, StickyNote,
  MessageSquare, Box
} from "lucide-react";

// --- LOGIC: PARSER MERMAID & DAGRE LAYOUT ---
const parseMermaid = (code: string) => {
  const nodesMap = new Map<string, Node>();
  const edges: Edge[] = [];
  const lines = code.split('\n');
  const edgeRegex = /([a-zA-Z0-9_]+)(?:\[(.*?)\])?\s*(-+>)\s*(?:\|(.*?)\|)?\s*([a-zA-Z0-9_]+)(?:\[(.*?)\])?/;
  const nodeRegex = /^\s*([a-zA-Z0-9_]+)\[(.*?)\]\s*$/;

  lines.forEach((line, index) => {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('graph') || cleanLine.startsWith('flowchart')) return;
    const edgeMatch = cleanLine.match(edgeRegex);
    if (edgeMatch) {
      const [_, sourceId, sourceLabel, arrow, edgeLabel, targetId, targetLabel] = edgeMatch;
      if (!nodesMap.has(sourceId)) nodesMap.set(sourceId, { id: sourceId, position: { x: 0, y: 0 }, data: { label: sourceLabel || sourceId }, type: 'rectangle' });
      else if (sourceLabel) nodesMap.get(sourceId)!.data.label = sourceLabel;
      if (!nodesMap.has(targetId)) nodesMap.set(targetId, { id: targetId, position: { x: 0, y: 0 }, data: { label: targetLabel || targetId }, type: 'rectangle' });
      else if (targetLabel) nodesMap.get(targetId)!.data.label = targetLabel;
      edges.push({ id: `e${sourceId}-${targetId}-${index}`, source: sourceId, target: targetId, label: edgeLabel || undefined, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 } });
    } else {
      const nodeMatch = cleanLine.match(nodeRegex);
      if (nodeMatch) {
        const [_, nodeId, label] = nodeMatch;
        if (!nodesMap.has(nodeId)) nodesMap.set(nodeId, { id: nodeId, position: { x: 0, y: 0 }, data: { label }, type: 'rectangle' });
        else nodesMap.get(nodeId)!.data.label = label;
      }
    }
  });
  return { nodes: Array.from(nodesMap.values()), edges };
};

const generateMermaidFromFlow = (nodes: Node[], edges: Edge[]): string => {
  if (nodes.length === 0) return "";
  let mermaidCode = "graph TD;\n";
  nodes.forEach(node => { mermaidCode += `    ${node.id}[${node.data.label || node.id}];\n`; });
  mermaidCode += "\n";
  edges.forEach(edge => {
    const labelStr = edge.label ? `|${edge.label}|` : "";
    mermaidCode += `    ${edge.source} -->${labelStr} ${edge.target};\n`;
  });
  return mermaidCode;
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const nodeWidth = 172; const nodeHeight = 36;
  dagreGraph.setGraph({ rankdir: direction });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = { x: nodeWithPosition.x - nodeWidth / 2, y: nodeWithPosition.y - nodeHeight / 2 };
    return node;
  });
  return { nodes: layoutedNodes, edges };
};

const SHAPE_CATEGORIES = ["General", "Flowchart", "Misc", "Basic", "Arrows", "Entity Relation", "UML"];

// --- NỘI DUNG IDE CHÍNH ---
const IDEPageContent = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [openShapeMenus, setOpenShapeMenus] = useState<Record<string, boolean>>({ "General": true, "Flowchart": true });
  const [explorerWidth, setExplorerWidth] = useState<number>(256);
  const [editorWidth, setEditorWidth] = useState<number>(500);
  const [isDraggingExplorer, setIsDraggingExplorer] = useState(false);
  const [isDraggingEditor, setIsDraggingEditor] = useState(false);

  // State Context Menu (Chuột phải)
  const [contextMenu, setContextMenu] = useState<{ id: string; top: number; left: number; type: 'node' | 'edge' } | null>(null);

  const [code, setCode] = useState<string>("graph TD;\n    KH[Khách hàng];\n    BA[Business Analyst];\n    DEV[Developer];\n\n    KH -->|Gửi yêu cầu| BA;\n    BA -->|Phân tích| DEV;");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [idCounter, setIdCounter] = useState<number>(0);

  const handleSyncCodeToDiagram = useCallback(() => {
    try {
      const parsedData = parseMermaid(code);
      const layoutedData = getLayoutedElements(parsedData.nodes, parsedData.edges);
      setNodes([...layoutedData.nodes]);
      setEdges([...layoutedData.edges]);
    } catch (error) { console.error("Lỗi parse Mermaid:", error); }
  }, [code]);

  useEffect(() => { handleSyncCodeToDiagram(); }, [handleSyncCodeToDiagram]);

  const updateCodeFromFlow = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    const generatedMermaid = generateMermaidFromFlow(currentNodes, currentEdges);
    if (generatedMermaid.trim() !== code.trim()) setCode(generatedMermaid);
  }, [code]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  
  const onNodeDragStop = useCallback(() => { updateCodeFromFlow(nodes, edges); }, [nodes, edges, updateCodeFromFlow]);
  const onConnect = useCallback((params: Connection) => {
    const newEdge = addEdge({ ...params, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 } }, edges);
    setEdges(newEdge);
    updateCodeFromFlow(nodes, newEdge);
  }, [nodes, edges, updateCodeFromFlow]);

  const handleEditorChange = (value: string | undefined) => { if (value) setCode(value); };
  const handleMove = useCallback((event: any, viewport: Viewport) => { setZoomLevel(viewport.zoom); }, []);

  // --- SỰ KIỆN: DRAG, DROP & CLICK SHAPES ---
  const onDragStart = (event: React.DragEvent, shapeType: string, defaultLabel: string) => {
    event.dataTransfer.setData("application/reactflow-type", shapeType);
    event.dataTransfer.setData("application/reactflow-label", defaultLabel);
    event.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }, []);
  
  const addNodeToCanvas = useCallback((type: string, label: string, position: {x: number, y: number}) => {
    const newNodeId = `node_${type}_${idCounter}`;
    const newNode: Node = { id: newNodeId, type: 'rectangle', position, data: { label: `${label} ${idCounter}` } };
    const newNodes = nodes.concat(newNode);
    setNodes(newNodes);
    setIdCounter(idCounter + 1);
    updateCodeFromFlow(newNodes, edges);
  }, [idCounter, nodes, edges, updateCodeFromFlow]);

  const onDrop = useCallback((event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow-type");
      const label = event.dataTransfer.getData("application/reactflow-label");
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNodeToCanvas(type, label, position);
  }, [screenToFlowPosition, addNodeToCanvas]);

  const onShapeClick = useCallback((type: string, label: string) => {
      // Đặt vị trí node mới ở chính giữa màn hình khi Click
      const centerPosition = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      // Thêm offset ngẫu nhiên nhẹ để các node click liên tục không đè khít lên nhau
      centerPosition.x += (idCounter % 5) * 20;
      centerPosition.y += (idCounter % 5) * 20;
      addNodeToCanvas(type, label, centerPosition);
  }, [screenToFlowPosition, addNodeToCanvas, idCounter]);


  // --- SỰ KIỆN: CONTEXT MENU (CHUỘT PHẢI) ---
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ id: node.id, top: event.clientY, left: event.clientX, type: 'node' });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setContextMenu({ id: edge.id, top: event.clientY, left: event.clientX, type: 'edge' });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleEditItem = useCallback(() => {
    if (!contextMenu) return;
    const currentLabel = contextMenu.type === 'node' 
        ? nodes.find(n => n.id === contextMenu.id)?.data.label 
        : edges.find(e => e.id === contextMenu.id)?.label;

    const newLabel = prompt("Nhập nội dung mới:", currentLabel || "");
    if (newLabel !== null) {
      if (contextMenu.type === 'node') {
        const newNodes = nodes.map(n => n.id === contextMenu.id ? { ...n, data: { ...n.data, label: newLabel } } : n);
        setNodes(newNodes);
        updateCodeFromFlow(newNodes, edges);
      } else {
        const newEdges = edges.map(e => e.id === contextMenu.id ? { ...e, label: newLabel } : e);
        setEdges(newEdges);
        updateCodeFromFlow(nodes, newEdges);
      }
    }
    closeContextMenu();
  }, [contextMenu, nodes, edges, updateCodeFromFlow, closeContextMenu]);

  const handleDeleteItem = useCallback(() => {
    if (!contextMenu) return;
    if (contextMenu.type === 'node') {
      const newNodes = nodes.filter((n) => n.id !== contextMenu.id);
      // Xoá luôn các cạnh kết nối tới Node bị xoá
      const newEdges = edges.filter((e) => e.source !== contextMenu.id && e.target !== contextMenu.id);
      setNodes(newNodes);
      setEdges(newEdges);
      updateCodeFromFlow(newNodes, newEdges);
    } else {
      const newEdges = edges.filter((e) => e.id !== contextMenu.id);
      setEdges(newEdges);
      updateCodeFromFlow(nodes, newEdges);
    }
    closeContextMenu();
  }, [contextMenu, nodes, edges, updateCodeFromFlow, closeContextMenu]);


  // --- RESIZE & THEME LOGIC ---
  const theme = isDarkMode ? { bgMain: "bg-[#1e1e1e]", text: "text-[#cccccc]", textMuted: "text-slate-400", border: "border-[#2b2b2b]", toolbar: "bg-[#181818]", hover: "hover:bg-[#333333]", searchBg: "bg-[#2b2b2b]", searchBorder: "border-[#3c3c3c]", itemHover: "hover:bg-[#2a2d2e]", itemActive: "bg-[#37373d]", editorTabTop: "border-blue-500", shapeBorder: "border-[#4b4b4b]", shapeFill: "bg-[#252526]" } : { bgMain: "bg-white", text: "text-slate-800", textMuted: "text-slate-500", border: "border-slate-300", toolbar: "bg-[#f3f3f3]", hover: "hover:bg-[#e4e4e4]", searchBg: "bg-white", searchBorder: "border-slate-300", itemHover: "hover:bg-slate-100", itemActive: "bg-[#e4e6f1] text-blue-700", editorTabTop: "border-blue-600", shapeBorder: "border-slate-300", shapeFill: "bg-white" };
  const toggleShapeMenu = (category: string) => setOpenShapeMenus(prev => ({ ...prev, [category]: !prev[category] }));
  
  const handleMouseMove = useCallback((e: MouseEvent) => { 
    if (isDraggingExplorer) setExplorerWidth(Math.max(150, Math.min(e.clientX, 500))); 
    else if (isDraggingEditor) { const offset = isSidebarOpen ? explorerWidth : 0; const rightPanelOffset = isRightPanelOpen ? 256 : 0; setEditorWidth(Math.max(200, Math.min(e.clientX - offset, window.innerWidth - 300 - rightPanelOffset))); } 
  }, [isDraggingExplorer, isDraggingEditor, isSidebarOpen, explorerWidth, isRightPanelOpen]);
  
  const handleMouseUp = useCallback(() => { setIsDraggingExplorer(false); setIsDraggingEditor(false); }, []);
  
  useEffect(() => { 
    if (isDraggingExplorer || isDraggingEditor) { document.addEventListener("mousemove", handleMouseMove); document.addEventListener("mouseup", handleMouseUp); document.body.style.userSelect = "none"; } 
    else { document.removeEventListener("mousemove", handleMouseMove); document.removeEventListener("mouseup", handleMouseUp); document.body.style.userSelect = "auto"; } 
    return () => { document.removeEventListener("mousemove", handleMouseMove); document.removeEventListener("mouseup", handleMouseUp); document.body.style.userSelect = "auto"; }; 
  }, [isDraggingExplorer, isDraggingEditor, handleMouseMove, handleMouseUp]);

  // --- RENDER ICONS (Đầy đủ Draw.io General) ---
  const renderShapeItems = (category: string) => {
    const defaultPlaceholder = [...Array(4)].map((_, i) => (<div key={i} className={`aspect-square rounded ${theme.shapeBorder} border ${theme.shapeFill} hover:border-blue-500 cursor-not-allowed flex items-center justify-center`}><div className={`w-4 h-4 border-2 border-dashed ${theme.shapeBorder}`}></div></div>));
    
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
              key={item.label} 
              onClick={() => onShapeClick(item.type, item.label)}
              draggable 
              onDragStart={(event) => onDragStart(event, item.type, item.label)} 
              className={`aspect-square rounded ${theme.shapeBorder} border ${theme.shapeFill} hover:border-blue-500 hover:shadow-sm cursor-grab active:cursor-grabbing flex items-center justify-center transition-all`} 
              title={item.label}
            >
              {item.icon}
            </div>
          ))}
        </>
      );
    }
    return defaultPlaceholder;
  };

  return (
    <div className={`flex flex-col h-screen w-full ${theme.bgMain} ${theme.text} font-sans overflow-hidden transition-colors duration-200`} onClick={closeContextMenu}>
      
      {/* MENU CHUỘT PHẢI (Context Menu overlay) */}
      {contextMenu && (
        <div 
          style={{ top: contextMenu.top, left: contextMenu.left }} 
          className="fixed z-[100] bg-white border border-slate-200 shadow-xl rounded-md py-1 w-36 text-sm"
        >
          <button onClick={handleEditItem} className="w-full text-left px-4 py-2 hover:bg-slate-100 text-slate-700 transition">
            Edit text
          </button>
          <button onClick={handleDeleteItem} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 border-t border-slate-100 transition">
            Delete
          </button>
        </div>
      )}

      {/* 1. TOP TOOLBAR */}
      <div className={`flex items-center justify-between h-10 px-3 ${theme.toolbar} border-b ${theme.border} text-sm select-none shrink-0`}>
        <div className="flex items-center gap-4">
          <Menu size={16} className={`cursor-pointer ${isDarkMode ? 'hover:text-white' : 'hover:text-black'}`} />
          <div className="hidden md:flex gap-3 text-[13px]">{['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Help'].map(item => (<span key={item} className={`cursor-pointer ${isDarkMode ? 'hover:text-white' : 'hover:text-black'}`}>{item}</span>))}</div>
        </div>
        <div className={`flex-1 max-w-md mx-4 ${theme.searchBg} rounded-md h-6 flex items-center px-2 justify-center border ${theme.searchBorder} cursor-pointer ${theme.hover} transition`}><Search size={14} className={`mr-2 ${theme.textMuted}`} /><span className={`text-xs ${theme.textMuted}`}>ba-ide-mvp</span></div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-1 mr-2 rounded transition ${theme.hover}`} title="Toggle Theme">{isDarkMode ? <Sun size={16} className="text-yellow-400" /> : <Moon size={16} className="text-slate-600" />}</button>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-1 rounded transition ${isSidebarOpen ? (isDarkMode ? 'bg-[#333333] text-white' : 'bg-[#e4e4e4] text-black') : theme.hover}`} title="Toggle Primary Side Bar"><PanelLeft size={16} /></button>
          <button className={`p-1 ${theme.hover} rounded transition`}><PanelBottom size={16} /></button>
          <button onClick={() => setIsRightPanelOpen(!isRightPanelOpen)} className={`p-1 rounded transition ${isRightPanelOpen ? (isDarkMode ? 'bg-[#333333] text-white' : 'bg-[#e4e4e4] text-black') : theme.hover}`} title="Toggle Right Panel"><PanelRight size={16} /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 2. EXPLORER TRAY */}
        {isSidebarOpen && (
          <div style={{ width: explorerWidth }} className={`flex flex-col shrink-0 overflow-y-auto ${theme.bgMain}`}>
            <div className={`flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}><span>Explorer</span><MoreHorizontal size={14} className={`cursor-pointer ${isDarkMode ? 'hover:text-white' : 'hover:text-black'}`} /></div>
            <div className="flex flex-col text-[13px] mt-1">
              <div className={`flex items-center gap-1 px-2 py-1 cursor-pointer ${theme.itemHover} transition`}><ChevronDown size={14} /> <Folder size={14} className="text-blue-400" /> <span className="font-semibold">BA_WORKSPACE</span></div>
              <div className={`flex items-center gap-1 pl-6 pr-2 py-1 cursor-pointer ${theme.itemActive} ${isDarkMode ? 'border-l-2 border-blue-500' : ''}`}><FileCode size={14} className="text-yellow-400" /> <span className={isDarkMode ? 'text-white' : 'font-medium'}>diagram.mmd</span></div>
              <div className={`flex items-center gap-1 pl-6 pr-2 py-1 cursor-pointer ${theme.itemHover} transition ${theme.textMuted}`}><File size={14} /> <span>requirements.md</span></div>
            </div>
          </div>
        )}
        {isSidebarOpen && <div className={`w-1 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-10 ${theme.border} border-l`} onMouseDown={() => setIsDraggingExplorer(true)} />}

        <div className="flex flex-1 overflow-hidden">
          {/* 3. EDITOR PANEL */}
          <div style={{ width: editorWidth }} className="flex flex-col shrink-0 min-w-[200px]">
            <div className={`flex items-center h-9 ${theme.bgMain} border-b ${theme.border} overflow-x-auto shrink-0`}><div className={`flex items-center gap-2 px-4 py-2 ${theme.bgMain} border-t-2 ${theme.editorTabTop} text-[13px] cursor-pointer`}><FileCode size={14} className="text-yellow-400" /> <span className={isDarkMode ? 'text-white' : 'text-black'}>diagram.mmd</span></div></div>
            <div className={`flex-1 ${theme.bgMain}`}>
              <Editor height="100%" defaultLanguage="markdown" theme={isDarkMode ? "vs-dark" : "light"} value={code} onChange={handleEditorChange} options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: "on", padding: { top: 16 } }} />
            </div>
          </div>
          <div className={`w-1 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-10 ${theme.border} border-l`} onMouseDown={() => setIsDraggingEditor(true)} />

          {/* 4. CANVAS AREA */}
          <div className="flex-1 relative bg-slate-50 min-w-[200px] flex flex-col" ref={reactFlowWrapper}>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-lg border border-slate-200 text-slate-700">
              <button onClick={handleSyncCodeToDiagram} className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-full transition shadow-sm" title="Manual Sync Text to Diagram">
                <Play size={14} /> <span className="hidden xl:inline">Manual Sync</span>
              </button>
            </div>
            <div className={`absolute top-4 left-4 z-10 px-2 py-1 text-xs font-medium rounded-md shadow border ${theme.border} ${theme.bgMain} ${theme.text}`}>{(zoomLevel * 100).toFixed(0)}%</div>
            
            <div className="flex-1 w-full h-full">
              <ReactFlow 
                nodes={nodes} edges={edges} 
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} 
                onNodeDragStop={onNodeDragStop} onConnect={onConnect} onMove={handleMove} 
                onDrop={onDrop} onDragOver={onDragOver} 
                onNodeContextMenu={onNodeContextMenu} // Sự kiện chuột phải Node
                onEdgeContextMenu={onEdgeContextMenu} // Sự kiện chuột phải Edge
                onPaneClick={closeContextMenu} // Click ra ngoài để đóng menu
                fitView
              >
                <Background color="#cbd5e1" gap={16} />
                <Controls className="bg-white border-slate-200 fill-slate-600 mb-4 mr-4 shadow-sm rounded-md" />
                <MiniMap nodeColor="#94a3b8" maskColor="rgba(248, 250, 252, 0.7)" className="shadow-sm rounded-md border border-slate-200" />
              </ReactFlow>
            </div>
          </div>
        </div>

        {/* 5. SHAPES LIBRARY PANEL */}
        {isRightPanelOpen && (
          <div className={`w-64 border-l ${theme.border} flex flex-col shrink-0 overflow-y-auto ${theme.bgMain} pb-10`}>
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
  return (
    <ReactFlowProvider>
      <IDEPageContent />
    </ReactFlowProvider>
  );
}
