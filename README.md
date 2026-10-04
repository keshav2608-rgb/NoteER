# Collaborative Notebook — End-to-End Product Implementation

A production-ready digital notebook web platform built with **Next.js (App Router)**, **JavaScript**, **Yjs / CRDTs**, **WebSockets**, and a dual-engine database architecture (zero-setup built-in SQLite for instant local dev & PostgreSQL ready for production).

---

## 🌟 Key Features

1. **Digital Notebook Engine**
   - **Multi-page notebooks**: Create, reorder, duplicate, rename, and soft-delete pages.
   - **Paper background styles**: Dot matrix, Math grid, Ruled lined, and Blank canvas.
   - **Smooth vector drawing**: Quadratic Bezier curve smoothing, Catmull-Rom interpolation, pressure sensitivity.
   - **Drawing tools**: Pen, Pencil, Highlighter (with realistic blending), Eraser with segment hit-testing.
   - **Geometric shapes**: Rectangles, Circles/ellipses, Lines, and dynamic directional Arrows.
   - **Sticky text notes**: Draggable collaborative note blocks placed anywhere in world canvas coordinates.
   - **Infinite canvas view**: Smooth two-finger/wheel panning, pinch-to-zoom (25% to 400%), and Spacebar pan shortcut.

2. **Tablet Remote-Pad Mode (PC + Tablet Pair)**
   - **First-class hardware pairing**: Turn an iPad, Android tablet, or smartphone into a low-latency touch/stylus drawing tablet for your PC desktop.
   - **Instant pairing system**: 
     - Scan animated QR code with tablet camera, or
     - Enter 6-digit pairing code (e.g. `748-291`) directly into the tablet.
   - **Local-first drawing**: Instant zero-lag drawing on the tablet while synchronously streaming vector operations over WebSockets to render in real time on the PC screen!
   - **Dedicated touch UI**: Streamlined controls designed for stylus and finger touch with large buttons and zero screen clutter.

3. **Realtime Multi-Device Collaboration**
   - **WebSocket Collaboration Server**: Long-lived Node.js server handling rooms (`notebook:[id]:page:[id]`), awareness, and presence.
   - **Live presence & cursors**: View active collaborators' floating colored cursors with user names and dedicated "Tablet Active" badges.
   - **Role-based permissions**:
     - **Owner**: Full management, member invitations, deletions, and editing.
     - **Editor**: Full editing, drawing, and page creation.
     - **Commenter**: Note viewing and commenting.
     - **Viewer**: Read-only synchronized observation.
   - **Server-enforced security**: Every HTTP mutation and WebSocket room join is verified against user roles and short-lived signed JWT collaboration tokens.

4. **Reliability, Offline Recovery & Snapshots**
   - **Offline-first resilience**: Automatic reconnect with exponential backoff (`reconnecting` state) and instant resynchronization upon reconnection.
   - **Durable snapshots**: Checkpoint version history system allowing users to save and restore past versions.
   - **Status indicators**: Real-time visual feedback: *Saved*, *Syncing...*, *Reconnecting...*, *Offline — saved locally*.

5. **In-App Notification Center**
   - Real-time notification badge and dropdown drawer for invitations, member joins, and role updates.

---

## 🏗️ Architecture Overview

```text
Browser Client (PC)                       Browser Client (Tablet Pad)
        │                                             │
        ▼                                             ▼
  Next.js App Router (UI / API)                 Remote Pad Canvas
        │                                             │
        ├──────────► HTTP API / Auth Session          │
        │                  │                          │
        │                  ▼                          │
        │          SQLite / PostgreSQL                │
        │                                             │
        └──────────► Signed Collab Token ◄────────────┘
                           │
                           ▼
          Collab WebSocket Server (Port 1234)
              │                     │
              ▼                     ▼
       In-Memory Room       Ephemeral Presence
       CRDT Document        (Cursors / Online)
              │
              ▼
    Durable Persistence
  (collab_document_updates)
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v20+ or v24+ (Node 24 built-in `node:sqlite` enabled)
- **npm**: v10+

### 2. Start Both Next.js & Collab WebSocket Server
Run a single command to start the entire full-stack platform:
```bash
npm run dev:all
```
This launches:
- **Next.js Web App**: [http://localhost:3000](http://localhost:3000)
- **Collab WebSocket Server**: `ws://localhost:1234`

### 3. Run Automated Vertical Slice Tests
```bash
npm test
```
Verifies database seeding, JWT auth, role enforcement, tablet pairing, real-time WebSocket transmission between PC & Tablet, and reconnect persistence.

---

## 👥 Instant Multi-User Demo Accounts

When opening [http://localhost:3000/login](http://localhost:3000/login), 1-click demo profiles are available to test multi-user and multi-device collaboration across separate browser tabs or devices:

| Name | Role | Email | Description |
|---|---|---|---|
| **Keshav** | Owner | `keshav@notebook.local` | Full notebook ownership, page editing, sharing & member management |
| **Alex Rivera** | Editor | `alex@notebook.local` | Collaborator with drawing and page edit access |
| **Sam Chen** | Viewer | `sam@notebook.local` | Read-only observer |

You can also enter any custom guest name or use Google Identity Services if `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is configured.

---

## 📱 How to Test Tablet-to-PC Live Drawing

1. Open [http://localhost:3000](http://localhost:3000) on your desktop browser.
2. Sign in as **Keshav (Owner)** and open the notebook **"Project Brainstorm & Architecture"**.
3. Click the **"Connect Tablet"** button in the top navbar.
4. A modal appears displaying a large **QR code** and a **6-digit pairing code** (e.g. `748-291`).
5. Open an incognito window or your tablet/phone browser:
   - Either scan the QR code, or
   - Go to [http://localhost:3000/login](http://localhost:3000/login) and type the 6-digit code into **"Connect Tablet with 6-Digit PIN"**.
6. The tablet opens in fullscreen **Remote-Pad Mode**.
7. Draw a stroke or write with a stylus on the tablet:
   - Notice the stroke renders instantly on the tablet.
   - The desktop screen immediately mirrors the stroke in realtime!
   - A blue dot indicates the active tablet stylus movement!
8. Refresh both devices: all strokes and notes remain persisted from the database!

---

## 🐳 Docker Deployment

To run production with Docker Compose and PostgreSQL:
```bash
docker compose up --build
```
This deploys:
- `notebook_web`: Next.js web application on port 3000
- `notebook_collab`: Realtime WebSocket service on port 1234
- `notebook_postgres`: PostgreSQL 16 database on port 5432
