# UsTogether – Beta
## Software Requirements Specification

**Date Finished:** August 5, 2026

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for a web-based horizontal timeline application where individuals or couples can log, display, and share memories as interactive Polaroid-style cards.

### 1.2 Project Background

Capturing shared milestones and personal growth often relies on traditional digital photo albums or social media feeds, which lack a sense of tangible continuity and intimate, story-driven context. Existing platforms display photos vertically or in grid patterns that fail to communicate the linear passage of time. To address this need, the proposed system shall provide a web-based visual memory canvas. The system will help store and organize photos, titles, dates, and short stories onto a continuous, interactive horizontal timeline with a nostalgic Polaroid aesthetic.

### 1.3 Scope

The UsTogether Web App – Beta shall be a web-based application that manages the complete memory logging lifecycle, including:

- Dataset submission (Photos, Titles, Dates, Descriptions)
- Horizontal timeline rendering (Interactive continuous canvas)
- Workspace management (Individual and shared partner access)
- Milestone tagging (Categorization for significant events)
- Timeline archiving (Historical filtering and memory exploration)

### 1.4 System Objectives

The system aims to:

- Provide a centralized, shared repository for personal and relationship milestones.
- Support interactive memory exploration through a horizontal, chronological layout.
- Ensure uploaded memory datasets are organized chronologically regardless of upload order.
- Provide partners with tools for co-creating and managing shared life timelines.

### 1.5 Intended Users

| User Type | Description |
| --- | --- |
| **Solo Creator** | Creates an individual workspace to document personal trips, growth, and milestones. |
| **Partner / Couple** | Shares a workspace to co-create, view, and edit a joint relationship timeline. |
| **System Administrator** | Manages cloud hosting infrastructure, storage buckets, and user authentication systems. |

### 1.6 Definitions

| Term | Definition |
| --- | --- |
| **Polaroid Card** | The primary UI component rendering a 1:1 square photo, handwritten-style title, date, and short description. |
| **Horizontal Timeline** | The interactive canvas that arranges Polaroid cards along an X-axis in chronological order. |
| **Workspace** | A dedicated container housing a specific timeline (Individual or Shared Couple mode). |
| **Milestone Tag** | A special metadata flag applied to highlight key life events (e.g., *First Date*, *Anniversary*). |
| **REST API** | Representational State Transfer interface used for communication between client and server. |

---

## 2. Overall Description

### 2.1 Product Perspective

The system shall be developed as a modern web application using React (Vite) on the frontend and an Express.js (Node.js) or Flask backend paired with a PostgreSQL database. The web app operates across modern web browsers, communicating with cloud server infrastructure via HTTP REST APIs.

### 2.2 MVP Scope

For the MVP, the system shall include only the essential features needed to make memory logging functional and visually appealing. These include photo uploading with metadata (title, date, description), automatic chronological sorting, smooth horizontal timeline scrolling, and basic workspace invitations for couples. Advanced features like automated photo collage generation, AI memory summaries, and print-ready physical album exports shall be treated as future enhancements.

### 2.3 Product Functions

The system shall provide the following major functions:

- Timeline canvas viewing (Interactive horizontal drag/scroll displaying Polaroid cards)
- Polaroid memory creation and upload (Photo, date, title, caption)
- Detailed memory drill-down (Modal overlay showing full-resolution photo and text)
- Partner workspace invitation and collaborative editing
- Milestone tagging and filtering

### 2.4 User Classes & Characteristics

| User Class | Skill Level | Main Activities |
| --- | --- | --- |
| **Solo Creator** | Basic | Upload photos, enter dates and short captions, browse timeline. |
| **Partner / Couple** | Basic | Invite partner, co-upload shared memories, add milestone tags. |

### 2.5 Operating Environment

| Component | Requirement |
| --- | --- |
| **Platform** | Web Application (Desktop & Tablet optimized) |
| **Frontend Framework** | React.js (Vite, Tailwind CSS, Framer Motion) |
| **Frontend Database/State** | Zustand / React Query |
| **Backend Server** | Express.js (Node.js) or Flask |
| **Backend Database** | PostgreSQL |
| **File Storage** | AWS S3 or Cloudinary |
| **Communication** | HTTP REST, JSON payloads |

### 2.6 Design & Implementation Constraints

- The system must be accessible via any modern, standards-compliant web browser.
- The frontend must maintain 60 FPS smooth dragging/scrolling across the horizontal canvas.
- Image uploads shall be constrained to common formats (JPEG, PNG, WEBP) with client-side compression.

### 2.7 Assumptions & Dependencies

- Users will have active internet access when uploading photos and fetching timeline data.
- Cloud storage (AWS S3 or Cloudinary) will be operational for serving photo assets.
- Users will upload valid calendar dates for chronological placement.

---

## 3. System Features & Functional Requirements

### 3.1 MVP Functional Requirements

| ID | Requirement |
| --- | --- |
| **MVP-FR-01** | The system shall render an interactive horizontal timeline sorted chronologically by memory date. |
| **MVP-FR-02** | The system shall allow users to upload photos with a title, date, and description. |
| **MVP-FR-03** | The system shall display memory entries formatted as Polaroid-style cards. |
| **MVP-FR-04** | The system shall allow users to click a Polaroid card to open a full-resolution detailed view modal. |
| **MVP-FR-05** | The system shall allow timeline owners to generate partner invite codes for shared timeline editing. |
| **MVP-FR-06** | The system shall allow users to edit or delete existing memory entries. |

### 3.2 Future Enhancement Requirements

| ID | Requirement |
| --- | --- |
| **FE-FR-01** | The system may support AI-driven photo enhancement and automated caption suggestions. |
| **FE-FR-02** | The system may support exporting the horizontal timeline into a printable physical photo album PDF. |

### 3.3 Timeline & Canvas View

| ID | Requirement |
| --- | --- |
| **FR-001** | The system shall render a continuous horizontal X-axis line representing time progression. |
| **FR-002** | The system shall support trackpad horizontal scrolling, shift+scroll, and click-and-drag mouse navigation. |
| **FR-003** | The system shall display Polaroid cards with slight randomized rotational offsets (±2°) for visual authenticity. |
| **FR-004** | The system shall open a full-detail view showing complete captions and high-resolution images upon tapping a card. |

### 3.4 Memory & Data Entry

| ID | Requirement |
| --- | --- |
| **FR-005** | The system shall provide a form interface to upload an image file (JPEG, PNG, WEBP; max 10MB). |
| **FR-006** | The system shall require a Title (max 50 chars), Date (YYYY-MM-DD), and Description (max 250 chars) for each upload. |
| **FR-007** | The system shall provide an optional selection for "Milestone Tag" (e.g., *First Date*, *Anniversary*, *Trip*). |
| **FR-008** | The system shall client-side compress images before upload to optimize transfer speed. |

### 3.5 Workspace & Partner Management

| ID | Requirement |
| --- | --- |
| **FR-009** | The system shall allow registered users to create an Individual or Couple Workspace. |
| **FR-010** | The system shall generate a unique invitation link/code to invite a partner to a shared workspace. |
| **FR-011** | The system shall allow both linked partners equal permissions to create, update, and delete shared memories. |

### 3.6 Data Retrieval & Lazy Loading

| ID | Requirement |
| --- | --- |
| **FR-012** | The system shall lazily load image assets and timeline nodes as the user scrolls horizontally. |
| **FR-013** | The system shall re-sort timeline items in real time whenever a memory date is updated. |

---

## 4. External Interface Requirements

### 4.1 User Interface Requirements

| Interface | Description |
| --- | --- |
| **Timeline Canvas** | Main horizontal view displaying chronologically placed Polaroid cards along an axis. |
| **Upload Modal** | Overlay form for uploading photos and filling in date, title, and description fields. |
| **Detail Modal** | View focused on a single selected Polaroid, displaying full caption, tags, and original photo. |
| **Workspace Settings** | Interface for managing account details, workspace type, and partner invite links. |

### 4.2 Hardware Interface Requirements

The system shall operate on standard desktop computers, laptops, and tablet devices. No specialized client hardware is required.

### 4.3 Software Interface Requirements

| Software Component | Purpose |
| --- | --- |
| **React (Vite)** | Frontend user interface framework. |
| **Tailwind CSS & Framer Motion** | UI styling and gesture-driven horizontal animation engine. |
| **Express.js / Flask** | Server-side REST API application framework. |
| **PostgreSQL** | Relational backend database server. |
| **AWS S3 / Cloudinary** | Object storage for uploaded memory images. |

### 4.4 Communication Interface Requirements

| Software Component | Description |
| --- | --- |
| **HTTPS** | All browser-to-server traffic transmitted securely via TLS encryption. |
| **HTTP REST** | JSON API payloads for authenticating users, fetching memory metadata, and managing workspaces. |

---

## 5. Non-Functional Requirements

### 5.1 Security Requirements

| ID | Requirement |
| --- | --- |
| **NFR-001** | The system shall hash user passwords using bcrypt or Argon2 prior to storage. |
| **NFR-002** | The system shall authenticate API requests using JSON Web Tokens (JWT) or secure HTTP-only cookies. |

### 5.2 Privacy Requirements

| ID | Requirement |
| --- | --- |
| **NFR-003** | The system shall restrict workspace memory access strictly to authenticated workspace members. |

### 5.3 Performance Requirements

| ID | Requirement |
| --- | --- |
| **NFR-004** | The system shall load the initial timeline view within **< 2 seconds** for up to 200 items. |
| **NFR-005** | The system shall maintain smooth 60 FPS animations during drag and scroll interactions. |

### 5.4 Reliability Requirements

| ID | Requirement |
| --- | --- |
| **NFR-006** | The system shall ensure database transactions for memory deletion or creation are atomic. |

### 5.5 Usability Requirements

| ID | Requirement |
| --- | --- |
| **NFR-007** | The system shall provide a warm, intuitive UI utilizing handwritten-style fonts for Polaroid dates and titles. |
| **NFR-008** | The system shall display responsive feedback indicators during photo upload processes. |

### 5.6 Maintainability Requirements

| ID | Requirement |
| --- | --- |
| **NFR-009** | The system shall use modular, reusable UI components within the React component tree. |

### 5.7 Scalability Requirements

| ID | Requirement |
| --- | --- |
| **NFR-010** | The system shall support expanding database storage as memory entries scale over time. |

---

## 6. System Architecture

### 6.1 Architecture Pattern

The system uses a Web Client-Server Architecture. The React web client manages UI state and drag interactions, querying a RESTful Express/Flask API. The backend processes incoming JSON payloads, handles auth checks, queries PostgreSQL for metadata, and streams media uploads to cloud object storage.

### 6.2 Proposed React Structure

```
src/
├── assets/          # Custom fonts, SVG icons, background textures
├── components/      # Reusable UI (PolaroidCard, Modal, Navbar, Button)
├── features/
│   ├── auth/        # Auth forms, login hooks, route guards
│   ├── timeline/    # Canvas, HorizontalScrollContainer, TimelineAxis
│   └── workspace/   # PartnerInviteModal, WorkspaceSettings
├── hooks/           # Drag-scroll hooks, window dimension observers
├── services/        # Axios HTTP client, storage upload handlers
├── store/           # Zustand global state (active timeline, active memory)
└── utils/           # Date formatters, random angle generators
```

---

## 7. Database Requirements

### 7.1 Proposed Database Tables

| Table | Purpose |
| --- | --- |
| **users** | Stores user auth accounts, password hashes, and profiles. |
| **timelines** | Stores workspace timeline containers (Individual vs Couple). |
| **user_timelines** | Junction table linking users to timelines with authorization roles. |
| **memories** | Stores individual Polaroid memory metadata and photo links. |

### 7.2 Main Log Fields

The `memories` table includes:

| Field | Description |
| --- | --- |
| **id** | Unique UUID primary key. |
| **timeline_id** | Foreign key linking to the parent timeline. |
| **user_id** | Foreign key linking to the uploader. |
| **title** | Title string (max 50 chars). |
| **memory_date** | Calendar Date associated with the photo (YYYY-MM-DD). |
| **caption** | Short text narrative (max 250 chars). |
| **image_url** | Direct cloud bucket storage URL for the uploaded photo. |
| **is_milestone** | Boolean flag highlighting major life milestones. |
| **created_at** | Timestamp of database insertion. |

---

## 8. System Workflow

### 8.1 Memory Creation Workflow

- The user clicks the "Add Memory" button on the timeline canvas.
- The user selects an image file, sets the memory date, enters a title, and writes a short caption.
- The system compresses the image client-side and posts the payload to the backend API.
- The server stores the image in cloud storage, writes metadata to PostgreSQL, and returns `201 Created`.
- The client updates the timeline state, automatically inserting the new Polaroid card into its precise chronological position on the horizontal axis.

### 8.2 Partner Invite Workflow

- The workspace owner clicks "Invite Partner" inside workspace settings.
- The system generates a unique invite token/URL.
- The partner navigates to the URL, logs in or registers, and accepts the invitation.
- The server inserts a record into `user_timelines`, instantly granting the partner joint editing access to the shared horizontal timeline.

---

## 9. Data Privacy & Ethical Compliance

### 9.1 Permitted Uses

The system shall support memory data use for:

- Personal and relationship milestone journaling.
- Shared viewing between explicitly authorized partner accounts.
- User-initiated memory archiving and reflection.

### 9.2 Prohibited Uses

The system shall prohibit:

- Public exposure of private memories without explicit user consent.
- Uploading malicious files or unauthorized content.

---

## 10. Acceptance Criteria & System Limitations

### 10.1 Acceptance Criteria

The system shall be considered acceptable when:

- Users can log in and view their horizontal timeline canvas without errors.
- Users can upload a photo with title, date, and description, displaying it immediately as a Polaroid card.
- Cards on the horizontal axis maintain strictly correct chronological ordering.
- Clicking a Polaroid opens a detailed modal with full resolution media and complete text.
- Partners can successfully link accounts via invite codes to co-manage a shared workspace.

### 10.2 System Limitations

The initial version of the system may have the following limitations:

- Native offline synchronization is not supported; an active web connection is required.
- Native mobile apps (iOS/Android) are not included in this release (web browser optimized).
- AI memory summaries and automated print exports are reserved for future updates.

---

## 11. Conclusion

The UsTogether Web App (Beta) is proposed as an intimate, visually striking platform for capturing and exploring life's milestones chronologically. By replacing vertical feeds with a horizontal Polaroid-style timeline, the system provides immediate sentiment and utility to individuals and couples seeking a dedicated space for their shared story.
