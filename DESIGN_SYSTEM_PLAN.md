# MCP Surface - Design System & Implementation Plan

## Updated Product Direction (2026-11-07)

The first design system proposal below described a token-rich, dark developer dashboard. The routed app remained on a separate, minimal dark theme, so the implementation had two visual languages. The active redesign consolidates the routed experience around a single premium workspace language:

- **Canvas and surfaces:** soft neutral page canvas, white content surfaces, and subtly tinted inset areas. Reserve elevation for interactive cards and overlays; use borders to group operational data.
- **Color:** near-black ink for primary information, layered neutral grays for supporting information, and a restrained evergreen accent for creation, active navigation, and positive progress. Amber marks waiting/attention; red is reserved for destructive or failed states.
- **Type:** system sans for interface and editorial hierarchy, monospace only for identifiers, paths, and payloads. Small uppercase section labels orient users without competing with titles.
- **Shape and spacing:** 4px-derived rhythm, 8–13px control/card corners, and larger radii only for major containers. Controls align to a consistent 36px minimum height.
- **Component individuality:** platform cards summarize identity and scale; setup blocks group editable inputs; research status emphasizes live progress; evidence and operation results favor scanability; chat messages distinguish speaker and approvals; runtime metadata uses a code surface; share invitations use a warm trust/attention treatment.
- **Responsive behavior:** retain one information hierarchy across widths; collapse result navigation into a horizontal strip and stack operational columns on narrow screens.
- **Accessibility:** visible focus rings, readable muted text, semantic state colors with labels, reduced dependence on color alone, and reduced-motion-friendly transitions.

### Redesign sequence

1. Establish page, surface, type, color, control, focus, and responsive tokens in the active stylesheet.
2. Reshape the application header and branding around the actual routed shell.
3. Apply the new visual language to platform list/detail/setup, research status/results, chat, runtime, sharing, auth, and invite components while preserving their existing behavior.
4. Review responsive breakpoints and build output; resolve implementation issues surfaced by the review.

The current implementation is intentionally light by default and follows the operating system's dark preference. The `data-theme="light"` override is supported for a future explicit theme control.

## Overview
Transform the current functional dark-themed UI into a modern, polished interface matching the design quality of Supabase, Vercel, Linear, or similar modern developer tools.

## Current State Analysis

### Strengths
- Well-structured React + TanStack Router architecture
- Component-based features (platforms, chat, research, runtimes, sharing)
- Clerk authentication integrated
- CSS variables for theming (but limited)
- Functional dark mode

### Gaps vs Modern Services

| Aspect | Current | Target (Supabase/Vercel/Linear) |
|--------|---------|--------------------------------|
| **Color System** | Basic dark CSS vars | Comprehensive light/dark tokens, semantic colors |
| **Typography** | IBM Plex Sans only | System font stack + monospace, clear hierarchy |
| **Spacing** | Ad-hoc pixel values | 4px base unit, consistent scale (4, 8, 12, 16, 24, 32, 48, 64) |
| **Border Radius** | Mixed (14px, 24px, 999px) | Consistent: 6px (sm), 8px (md), 12px (lg), 16px (xl), 999px (full) |
| **Shadows/Elevation** | Single box-shadow | 3-4 elevation levels with subtle shadows |
| **Components** | Inline styles, duplicated patterns | Reusable component library |
| **Navigation** | Top bar only | Sidebar + top bar, responsive |
| **Data Display** | Basic grids/cards | Tables with sorting, pagination, density options |
| **Feedback** | Basic loading text | Skeletons, toasts, progress indicators |
| **Empty States** | Text only | Illustrated with clear CTAs |
| **Forms** | Basic inputs | Validated, accessible, consistent |
| **Command Palette** | None | Cmd+K for navigation/actions |

---

## Phase 1: Design System Foundation (Week 1)

### 1.1 Design Tokens (`apps/web/src/styles/tokens.css`)
- Color primitives (neutral, primary, success, warning, danger, info scales)
- Semantic color aliases (bg, surface, border, text, accent)
- Light + dark mode support via CSS custom properties
- Spacing scale (space-1 through space-16)
- Typography scale (display, heading, body, caption, mono)
- Border radius scale
- Shadow/elevation scale
- Transition durations
- Z-index scale

### 1.2 Global Styles (`apps/web/src/styles/global.css`)
- CSS reset/normalize
- Base typography
- Focus-visible styles
- Scrollbar styling
- Selection styling
- Reduced motion support

### 1.3 Base Components (`apps/web/src/components/ui/`)
```
components/ui/
├── button.tsx           # Primary, secondary, ghost, danger, link variants + sizes
├── card.tsx             # Card, CardHeader, CardContent, CardFooter
├── input.tsx            # TextInput, Textarea, Select, Checkbox, Radio, Label
├── badge.tsx            # Status badges, variants
├── avatar.tsx           # User avatar with fallback
├── dropdown.tsx         # Dropdown menu
├── tooltip.tsx          # Tooltip wrapper
├── separator.tsx        # Visual separator
├── skeleton.tsx         # Loading skeletons
├── toast.tsx            # Toast notifications + provider
├── table.tsx            # Data table with sorting/pagination
├── tabs.tsx             # Tab navigation
├── dialog.tsx           # Modal dialogs
├── sheet.tsx            # Side sheet (mobile drawer)
├── popover.tsx          # Popover component
├── command.tsx          # Command palette (Cmd+K)
├── breadcrumb.tsx       # Breadcrumb navigation
├── pagination.tsx       # Pagination controls
├── empty-state.tsx      # Illustrated empty states
├── spinner.tsx          # Loading spinner
└── index.ts             # Barrel export
```

### 1.4 Update Main Styles Import (`apps/web/src/styles.css`)
- Import tokens.css and global.css
- Remove old custom styles
- Keep only layout-specific utilities

---

## Phase 2: Layout & Navigation (Week 1-2)

### 2.1 Sidebar Navigation (`apps/web/src/components/layout/sidebar.tsx`)
- Collapsible sidebar with icon + label
- Active state indication
- Keyboard navigable
- Responsive: hidden on mobile, drawer on tablet

### 2.2 Top Bar (`apps/web/src/components/layout/topbar.tsx`)
- Logo/brand
- Global search (Cmd+K trigger)
- User menu (avatar, settings, sign out)
- Theme toggle (light/dark/system)
- Notification bell (future)

### 2.3 App Shell (`apps/web/src/components/layout/app-shell.tsx`)
- Compose sidebar + topbar + main content
- Handle responsive breakpoints
- Persist sidebar state in localStorage

### 2.4 Update Route Layout (`apps/web/src/routes/__root.tsx`)
- Use new AppShell
- Wrap with ToastProvider
- Add CommandPalette provider

---

## Phase 3: Core Pages Redesign (Week 2-3)

### 3.1 Platforms List Page (`/platforms`)
- **Table view** with columns: Name, Slug, Sources, Artifacts, Status, Updated, Actions
- **Density toggle** (comfortable/cozy/compact)
- **Sidebar filters**: status, owner, date range
- **Empty state**: Illustration + "Create your first platform" CTA
- **Row actions**: View, Chat, Settings, Delete (dropdown)
- **Bulk actions** (future): delete, export

### 3.2 Create Platform Page (`/platforms/new`)
- **Multi-step form** (wizard) or single page with sections
- **Step 1**: Basic info (name, slug, description)
- **Step 2**: Source URLs (add/remove/reorder with drag-drop)
- **Step 3**: Artifacts (file uploads)
- **Step 4**: Review & create
- **Validation** with inline errors
- **Auto-save draft** to localStorage

### 3.3 Platform Detail Page (`/platforms/$platformId`)
- **Tabbed layout**: Overview, Sources, Runtime, Research, Sharing, Settings
- **Overview tab**: Stats cards, quick actions, recent activity
- **Sources tab**: Editable source list with inline validation
- **Runtime tab**: Status, controls, configuration, logs
- **Research tab**: Results panel with collapsible sections
- **Sharing tab**: Invite users, manage permissions, share links
- **Settings tab**: Rename, delete, transfer ownership
- **Sticky header** with platform name + breadcrumb

### 3.4 Chat Page (`/platforms/$platformId/chat`)
- **Split view**: Sidebar (sessions/history) + main chat area
- **Message bubbles** with better visual distinction
- **Attachment cards** with icons, actions, copy buttons
- **Approval requests** as prominent cards with clear Approve/Reject
- **Composer** with slash commands, file upload, @mentions
- **Streaming indicator** with animated dots
- **Token usage** display (optional)
- **Keyboard shortcuts**: Enter to send, Shift+Enter for newline

---

## Phase 4: Polish & Advanced Features (Week 3-4)

### 4.1 Loading States
- Page-level skeletons for all main pages
- Component-level skeletons (cards, tables, lists)
- Smooth transitions between states

### 4.2 Empty States
- Illustrated empty states for: no platforms, no sources, no messages, no research results
- Clear primary action button
- Helpful secondary text

### 4.3 Toast Notifications
- Success, error, warning, info variants
- Auto-dismiss with progress bar
- Action buttons (undo, retry, view)
- Stack management

### 4.4 Command Palette (Cmd+K)
- Global search: platforms, chats, settings
- Quick actions: new platform, new chat, toggle theme
- Keyboard navigable
- Recent items

### 4.5 Theme System
- Light/dark/system preference
- Persist to localStorage
- Sync with OS preference
- Apply to all components

### 4.6 Accessibility
- Focus management
- ARIA labels
- Keyboard navigation
- Color contrast (WCAG AA)
- Reduced motion

---

## Design Reference: Supabase/Vercel Patterns

### Colors (Supabase-inspired)
- **Primary**: `#3ECF8E` (green) - actions, links, active states
- **Background**: `#FFFFFF` (light) / `#0D1117` (dark)
- **Surface**: `#F6F8FA` (light) / `#161B22` (dark)
- **Border**: `#D0D7DE` (light) / `#30363D` (dark)
- **Text Primary**: `#24292F` (light) / `#E6EDF3` (dark)
- **Text Secondary**: `#656D76` (light) / `#8B949E` (dark)

### Typography (Vercel-inspired)
- **Font**: System UI stack (-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)
- **Mono**: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace
- **Scale**: display (48px), h1 (32px), h2 (24px), h3 (20px), body (16px), small (14px), tiny (12px)

### Spacing
- Base unit: 4px
- Scale: 1(4px), 2(8px), 3(12px), 4(16px), 5(20px), 6(24px), 8(32px), 10(40px), 12(48px), 16(64px)

### Border Radius
- sm: 4px, md: 6px, lg: 8px, xl: 12px, 2xl: 16px, full: 9999px

### Shadows
- level1: 0 1px 2px rgba(0,0,0,0.05)
- level2: 0 4px 6px -1px rgba(0,0,0,0.1)
- level3: 0 10px 15px -3px rgba(0,0,0,0.1)
- level4: 0 20px 25px -5px rgba(0,0,0,0.1)

---

## Implementation Order & Dependencies

```
Phase 1 (Foundation)
├── 1.1 Design Tokens          → No deps
├── 1.2 Global Styles          → 1.1
├── 1.3 Base UI Components     → 1.1, 1.2
└── 1.4 Update styles.css      → 1.1, 1.2, 1.3

Phase 2 (Layout)
├── 2.1 Sidebar                → 1.3
├── 2.2 TopBar                 → 1.3
├── 2.3 AppShell               → 2.1, 2.2
└── 2.4 Update __root.tsx      → 2.3

Phase 3 (Pages)
├── 3.1 Platforms List         → 1.3, 2.4
├── 3.2 Create Platform        → 1.3, 2.4
├── 3.3 Platform Detail        → 1.3, 2.4, 3.1
└── 3.4 Chat Page              → 1.3, 2.4, 3.3

Phase 4 (Polish)
├── 4.1 Loading States         → 1.3
├── 4.2 Empty States           → 1.3
├── 4.3 Toast Notifications    → 1.3
├── 4.4 Command Palette        → 1.3, 2.4
├── 4.5 Theme System           → 1.1
└── 4.6 Accessibility          → All above
```

---

## Success Criteria

- [ ] Light/dark mode works seamlessly
- [ ] All pages follow consistent design language
- [ ] Navigation is intuitive and responsive
- [ ] Forms feel polished with validation feedback
- [ ] Data tables are functional (sort, filter, paginate)
- [ ] Loading states feel fast (skeletons)
- [ ] Empty states guide users to action
- [ ] Command palette enables power users
- [ ] Toast notifications provide clear feedback
- [ ] Mobile experience is usable (drawer nav)
- [ ] No visual regressions in existing flows
- [ ] TypeScript compiles without errors
- [ ] Build succeeds

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Incremental migration, feature flags, thorough testing |
| CSS specificity conflicts | Use CSS layers, BEM-like naming, avoid !important |
| Bundle size increase | Tree-shakeable components, dynamic imports for heavy features |
| Accessibility regressions | Test with axe-core, manual keyboard testing |
| Dark mode flash | Inline script in HTML head to apply theme before paint |

---

## Next Steps

**Ready to start with Phase 1.1: Design Tokens**

Shall we begin with creating the design tokens file (`apps/web/src/styles/tokens.css`)?
