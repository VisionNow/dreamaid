# 🎨 Dream Maid: The Ultimate Diagramming IDE Online

*Dream Maid, Dream Aid*

Welcome to **Dream Maid**, a cutting-edge web-based Integrated Development Environment designed specifically for Business Analysts, Software Architects, and Systems Engineers. 

We asked ourselves a simple question: *If [Mermaid.js](https://github.com/mermaid-js/mermaid.git) can magically generate diagrams from code, what if we could edit the diagram visually and instantly get the code back?* Dream Maid is the answer: A true **Two-Way Synchronization** engine between Markdown (Mermaid syntax) and a highly interactive, Draw.io-level visual canvas.

## ✨ Core Features

* **🔄 Two-Way Live Sync**: Write Mermaid code to see the diagram. Drag, drop, connect, and rename shapes on the canvas to instantly regenerate the Mermaid code. 
* **📐 Infinite Drag-and-Drop Canvas**: Powered by React Flow. Featuring smart guides, snapping, and a collapsible MiniMap.
* **🧠 Smart Auto-Routing Edges**: 
    * Say goodbye to "spiderwebs"! Our custom edge routing dynamically attaches to the nearest node boundary (Top/Bottom/Left/Right).
    * **Self-Loops**: Beautiful cubic-bezier loops that dynamically resize with your text.
    * **Bi-directional Consolidation**: Drawing an arrow `A -> B` and another `B -> A`? We automatically turn them into two gorgeous, perfectly symmetrical elliptical curves (or consolidate them into a double-headed arrow `<-->` if the text is identical).
* **🏛️ Extensive Shape Library**: 30+ meticulously crafted SVG shapes covering General Flowcharts, System Engineering, Cloud architectures, and Annotations.
* **🖼️ Custom Image Upload**: Upload any SVG/PNG/JPG from your computer. The engine stores the base64 securely in LocalStorage and injects a clean ID into the Mermaid code to keep your source files tidy.
* **🖌️ Art Mode (Freehand Drawing)**: Sometimes you just need to draw a circle around a component to make a point. Toggle "Art Mode" to sketch directly on the canvas using pencils, dashed pens, or highlighters. These drawings are treated as native SVG nodes but are deliberately *ignored* by the Mermaid parser, allowing free-form annotations over strict architectural diagrams.
* **🚨 Strict Syntax Parser & Terminal**: Make a typo in your Mermaid code? Our custom parser will immediately halt, highlight the exact line with a red squiggly error in Monaco Editor, and print the detailed exception in the integrated Terminal.

## 🚀 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/RevDra/dreamaid.git](https://github.com/RevDra/dreamaid.git)
    cd Beauty-Maid
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🛠️ Built With

* **Next.js 16.2** (App Router)
* **React Flow** (Visual Node Engine)
* **Monaco Editor** (VS Code's internal editor engine)
* **Dagre** (Directed graph auto-layout algorithm)
* **Tailwind CSS** & **Lucide Icons**
