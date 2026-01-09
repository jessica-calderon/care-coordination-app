# Serverless Architecture & Refactor Plan
## Care Coordination App - GitHub Pages Deployment

**Status:** Architecture Planning  
**Goal:** Transition from localStorage-based persistence to serverless authoritative state while preserving UI and GitHub Pages deployment.

---

## 1. Serverless Architecture Proposal

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Pages (Static)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React SPA (Today.tsx, Landing.tsx, App.tsx)         │   │
│  │  - No local persistence of care data                 │   │
│  │  - Authenticated API client                          │   │
│  │  - Optimistic UI updates                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS (Authenticated)
                            │
┌─────────────────────────────────────────────────────────────┐
│              Serverless Backend (Hosted API)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Authentication Layer                                 │   │
│  │  - JWT-based auth (short-lived tokens)               │   │
│  │  - Caregiver identity verification                   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Endpoints                                        │   │
│  │  - GET  /api/notebook/today                           │   │
│  │  - POST /api/notebook/notes                           │   │
│  │  - PUT  /api/notebook/tasks/:id                      │   │
│  │  - POST /api/notebook/handoff                        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Data Store (Authoritative)                          │   │
│  │  - Single notebook per recipient                     │   │
│  │  - Today's state + recent history                    │   │
│  │  - Atomic handoff operations                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Technology Recommendations

**Backend Options (Choose One):**

1. **Vercel Serverless Functions + Supabase** (Recommended)
   - Vercel: Edge functions, automatic HTTPS, GitHub integration
   - Supabase: PostgreSQL with Row Level Security, built-in auth
   - Pros: Fast setup, good DX, free tier sufficient for MVP
   - Cons: Vendor lock-in (mitigated by standard SQL)

2. **AWS Lambda + DynamoDB + Cognito**
   - Pros: Enterprise-grade, scalable
   - Cons: More complex setup, higher learning curve

3. **Firebase Functions + Firestore**
   - Pros: Real-time capabilities, easy auth
   - Cons: NoSQL constraints, vendor lock-in

**Recommendation:** Vercel + Supabase for MVP. Simple, secure, cost-effective.

### Authentication Strategy

**Requirements:**
- No long-lived sessions (security)
- Caregiver identity must be verifiable
- Shared devices must work (multiple caregivers on same device)
- No password complexity (family-friendly)

**Proposed Flow:**

1. **Initial Setup (One-time per caregiver)**
   - Caregiver enters name (e.g., "Lupe", "Maria")
   - System generates unique caregiver ID + secret token
   - Token stored in secure cookie (HttpOnly, SameSite=Strict)
   - Token expires after 30 days of inactivity

2. **Subsequent Visits**
   - Client sends token in Authorization header
   - Server validates token, returns caregiver identity
   - If token invalid/expired, redirect to simple re-authentication

3. **Shared Device Handling**
   - Each caregiver has separate token
   - "Switch caregiver" action clears token, prompts for name
   - Server tracks which caregiver performed each action

**Implementation:**
- JWT tokens signed by server
- Token payload: `{ caregiverId: string, name: string, notebookId: string }`
- Client stores token in memory only (no localStorage for tokens)
- On page refresh, token retrieved from secure cookie (set by server)

### Source of Truth

**Server-side authoritative state:**
- All care data lives in server database
- Client is stateless (except for auth token)
- Every write goes through API
- Reads always fetch from server

**Why this works:**
- Single source of truth prevents conflicts
- Handoffs are atomic (server ensures consistency)
- Multiple caregivers see same state
- No client-side data corruption risk

### Read/Write Security

**Reads:**
- `GET /api/notebook/today` requires valid auth token
- Returns today's state for authenticated caregiver's notebook
- Server filters by notebookId (from token)

**Writes:**
- All mutations require valid auth token
- Server records `author` from token (not client-provided)
- Server validates caregiver identity before allowing handoff
- Rate limiting: 100 requests/minute per token

**Shared Device Security:**
- Each caregiver has separate token
- Tokens are not transferable between caregivers
- Handoff requires current caregiver's token

---

## 2. Authoritative Care State (Server-Side)

### Minimum Required State

**Database Schema (PostgreSQL/Supabase):**

```sql
-- Single notebook per care recipient
CREATE TABLE notebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_name TEXT NOT NULL,  -- "Wela"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Caregivers who can access this notebook
CREATE TABLE caregivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- "Lupe", "Maria"
  token_secret TEXT NOT NULL UNIQUE,  -- For auth
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Care notes (append-only, timestamped)
CREATE TABLE care_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,  -- "2024-01-15" (YYYY-MM-DD)
  time TEXT NOT NULL,  -- "8:30 AM" (client-formatted)
  note TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES caregivers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  INDEX (notebook_id, date_key, created_at DESC)
);

-- Tasks (mutable, per-day)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,  -- "2024-01-15"
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  INDEX (notebook_id, date_key)
);

-- Handoff metadata (append-only log)
CREATE TABLE handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  from_caregiver_id UUID NOT NULL REFERENCES caregivers(id),
  to_caregiver_id UUID NOT NULL REFERENCES caregivers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  INDEX (notebook_id, created_at DESC)
);

-- Current state (denormalized for fast reads)
CREATE TABLE notebook_state (
  notebook_id UUID PRIMARY KEY REFERENCES notebooks(id) ON DELETE CASCADE,
  current_caregiver_id UUID NOT NULL REFERENCES caregivers(id),
  last_updated_by_id UUID NOT NULL REFERENCES caregivers(id),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### State Constraints

**Single Notebook:**
- One notebook per care recipient (hardcoded for MVP)
- Notebook ID embedded in caregiver tokens
- No multi-notebook support in MVP

**Today-Focused:**
- Primary query: `GET /api/notebook/today`
- Returns today's date key notes + tasks + current state
- History (last 3 days) included in response for "Earlier" section
- No date range queries, no analytics

**Append-Only Notes:**
- Care notes are immutable (append-only)
- No edit/delete operations
- Timestamps set by server (client provides formatted time for display)

**Mutable Tasks:**
- Tasks can be toggled (completed/uncompleted)
- Tasks are date-scoped (today's tasks)
- Old tasks not shown (no history)

### What Stays Client-Side

**UI State (In-Memory Only):**
- Current view (`home` vs `today`) - can use sessionStorage for UX
- Form input state (note text, etc.)
- Loading/error states
- Optimistic UI updates (reverted on error)

**What Gets Deleted:**
- All localStorage persistence of care data
- Migration logic (no longer needed)
- Date rollover logic (server handles this)
- Mock data fallbacks (server always returns data)

---

## 3. Current Logic → Serverless Responsibilities

### Logic Migration Map

#### **Moves to Server**

**1. Date Rollover Handling**
- **Current:** Client checks date change every minute, preserves previous day's notes
- **Server Responsibility:** 
  - Server always returns notes for requested date
  - No client-side date tracking needed
  - "Today" endpoint automatically filters by current date
- **Why:** Server is authoritative, client doesn't need to manage date boundaries

**2. Care Notes Persistence**
- **Current:** `localStorage.setItem(STORAGE_KEY_NOTES_BY_DATE, ...)`
- **Server Responsibility:**
  - `POST /api/notebook/notes` creates new note
  - Server assigns timestamp, author (from token), date_key
  - Returns updated note list
- **Why:** Shared state must be server-authoritative

**3. Caregiver Attribution**
- **Current:** Client sets `author: currentCaregiver` from local state
- **Server Responsibility:**
  - Server extracts caregiver ID from auth token
  - Server looks up caregiver name from database
  - Client cannot spoof author identity
- **Why:** Security - prevent attribution fraud

**4. Handoff Atomicity**
- **Current:** Client updates `currentCaregiver` and `lastUpdatedBy` separately
- **Server Responsibility:**
  - `POST /api/notebook/handoff` atomically:
    1. Validates current caregiver (from token)
    2. Updates `notebook_state.current_caregiver_id`
    3. Updates `notebook_state.last_updated_by_id`
    4. Creates handoff log entry
    5. Creates system note ("Lupe handed off care to Maria")
  - All or nothing (transaction)
- **Why:** Prevent race conditions, ensure consistency

**5. Task State**
- **Current:** Tasks are mock data (not persisted)
- **Server Responsibility:**
  - `PUT /api/notebook/tasks/:id` toggles completion
  - Server stores tasks per date
  - Today's tasks returned in `/api/notebook/today`
- **Why:** Tasks must be shared across caregivers

**6. Notebook Existence Check**
- **Current:** `notebookExists()` checks localStorage
- **Server Responsibility:**
  - `GET /api/notebook/today` returns 404 if notebook doesn't exist
  - Client shows landing page if 404
  - `POST /api/notebook/initialize` creates notebook (first caregiver)
- **Why:** Server is source of truth

#### **Stays Client-Side**

**1. UI View State**
- **Current:** `STORAGE_KEY_VIEW` in localStorage
- **Stays:** Can use sessionStorage for UX (survives refresh, cleared on close)
- **Why:** Purely presentational, not care data

**2. Form Input State**
- **Current:** `noteText` state
- **Stays:** React state, never persisted
- **Why:** Transient UI state

**3. Date Formatting**
- **Current:** `formatTime()`, `formatDateLabel()`
- **Stays:** Client-side formatting for display
- **Why:** Presentation logic, no security implications

**4. Optimistic UI Updates**
- **Current:** Immediate state updates before persistence
- **Stays:** Update UI optimistically, revert on API error
- **Why:** Better UX, server remains authoritative

#### **Gets Deleted**

**1. Migration Logic**
- **Current:** `migrateOldData()`, author migration in `loadNotesByDate()`
- **Delete:** No longer needed - server handles all data
- **Why:** No client-side data to migrate

**2. Date Change Detection**
- **Current:** `checkDateChange()`, interval checking, `lastCheckedDateRef`
- **Delete:** Server handles date filtering
- **Why:** Server is authoritative for date boundaries

**3. localStorage Persistence Hooks**
- **Current:** Multiple `useEffect` hooks saving to localStorage
- **Delete:** Replace with API calls
- **Why:** No local persistence of care data

**4. Mock Data Fallbacks**
- **Current:** `todayData.careNotes` as fallback
- **Delete:** Server always returns data (or empty arrays)
- **Why:** Server is source of truth

**5. Local State Initialization from localStorage**
- **Current:** `useState(() => loadNotesByDate())`
- **Delete:** Replace with API fetch on mount
- **Why:** Server is source of truth

---

## 4. Client Integration Strategy (Static Frontend)

### API Client Architecture

**New File: `src/api/client.ts`**

```typescript
// Minimal API client for serverless backend
// No local persistence of care data

interface ApiConfig {
  baseUrl: string
  getAuthToken: () => string | null
}

class CareApiClient {
  private config: ApiConfig

  async getToday(): Promise<TodayState> {
    // Fetch today's state from server
    // Returns: notes, tasks, currentCaregiver, lastUpdatedBy
  }

  async addNote(noteText: string): Promise<CareNote> {
    // POST /api/notebook/notes
    // Server assigns author, timestamp, date
  }

  async toggleTask(taskId: string, completed: boolean): Promise<void> {
    // PUT /api/notebook/tasks/:id
  }

  async handoff(toCaregiverName: string): Promise<void> {
    // POST /api/notebook/handoff
    // Server validates current caregiver, updates state atomically
  }
}
```

### Data Flow Patterns

**1. App Load (Today.tsx mount)**
```
User opens app
  → Check for auth token (from secure cookie, set by server)
  → If no token: show landing page, prompt for caregiver name
  → If token exists: fetch GET /api/notebook/today
  → Render state from server response
  → No localStorage reads for care data
```

**2. Add Note**
```
User types note, clicks "Add note"
  → Optimistically add note to UI (immediate feedback)
  → POST /api/notebook/notes { note: "..." }
  → On success: server returns full note list, update UI
  → On error: revert optimistic update, show error message
  → No localStorage writes
```

**3. Handoff**
```
User clicks "Hand off care to Maria"
  → Optimistically update UI (show Maria as current caregiver)
  → POST /api/notebook/handoff { toCaregiverName: "Maria" }
  → On success: server returns updated state, refresh UI
  → On error: revert optimistic update, show error
  → No localStorage writes
```

**4. Page Refresh**
```
User refreshes page
  → Auth token retrieved from secure cookie
  → Fetch GET /api/notebook/today
  → Render server state
  → No localStorage reads for care data
  → UI state (view) can use sessionStorage for UX
```

### Error Handling

**Network Errors:**
- Show user-friendly message: "Couldn't connect to server. Please check your connection."
- Retry button for failed requests
- Optimistic updates reverted on error

**Auth Errors (401/403):**
- Clear auth token
- Redirect to landing page
- Prompt for caregiver name again

**Validation Errors (400):**
- Show specific error message from server
- Keep form state for user to fix

**Server Errors (500):**
- Show generic error: "Something went wrong. Please try again."
- Log error for debugging
- Don't expose server internals

### Loading States

**Initial Load:**
- Show loading spinner while fetching `/api/notebook/today`
- Don't show empty state until fetch completes

**Optimistic Updates:**
- Update UI immediately
- Show subtle loading indicator on button during API call
- Revert on error

**No Offline Support:**
- MVP assumes online-only
- Clear error message if offline
- No local queue of pending writes

---

## 5. Refactor Plan (Incremental, Safe)

### Phase 1: Isolate Domain Logic from localStorage

**Goal:** Extract business logic into pure functions, separate from persistence.

**Files to Modify:**
- `src/pages/Today.tsx`
- `src/App.tsx`

**Steps:**

1. **Create `src/domain/notebook.ts`**
   - Extract `getTodayDateKey()` (keep for client date formatting)
   - Extract `formatTime()`, `formatDateLabel()`
   - Extract note creation logic (pure function)
   - Extract handoff logic (pure function, no side effects)
   - No localStorage dependencies

2. **Create `src/domain/types.ts`**
   - Define `CareNote`, `Task`, `TodayState` interfaces
   - Match server response types
   - Remove mock data dependencies

3. **Refactor `Today.tsx`**
   - Keep UI components unchanged
   - Extract localStorage logic to `src/storage/localStorageAdapter.ts`
   - Create interface: `interface DataAdapter { loadToday(), saveNote(), ... }`
   - `Today.tsx` uses adapter interface, not localStorage directly

4. **Test:**
   - UI behavior unchanged
   - localStorage still works
   - Domain logic is testable in isolation

**What "Done" Looks Like:**
- `Today.tsx` imports `localStorageAdapter` instead of calling `localStorage` directly
- Domain logic functions are pure (no side effects)
- Types are centralized

---

### Phase 2: Introduce Serverless Data Adapter

**Goal:** Create API adapter that matches localStorage adapter interface.

**Files to Create:**
- `src/api/client.ts` (API client)
- `src/api/adapter.ts` (implements DataAdapter interface)
- `src/api/types.ts` (API request/response types)

**Files to Modify:**
- `src/pages/Today.tsx` (switch adapter)

**Steps:**

1. **Create API Client Stub**
   ```typescript
   // src/api/client.ts
   class CareApiClient {
     async getToday(): Promise<TodayState> {
       // Stub: return mock data for now
       return mockTodayState
     }
     // ... other methods return stubs
   }
   ```

2. **Create API Adapter**
   ```typescript
   // src/api/adapter.ts
   class ApiDataAdapter implements DataAdapter {
     private client: CareApiClient
     
     async loadToday(): Promise<TodayState> {
       return this.client.getToday()
     }
     // ... implement all DataAdapter methods
   }
   ```

3. **Add Feature Flag**
   ```typescript
   // src/pages/Today.tsx
   const USE_API = false // Feature flag
   const adapter = USE_API 
     ? new ApiDataAdapter() 
     : new LocalStorageAdapter()
   ```

4. **Test:**
   - Toggle feature flag, verify both adapters work
   - UI unchanged regardless of adapter

**What "Done" Looks Like:**
- Both adapters implement same interface
- Feature flag allows switching between them
- API adapter returns stub data (not connected to real server yet)

---

### Phase 3: Replace Local Persistence Paths One by One

**Goal:** Migrate each data operation from localStorage to API.

**Order of Migration:**

1. **Load Today's State**
   - Update `ApiDataAdapter.loadToday()` to call real API
   - Update `Today.tsx` to use API adapter
   - Remove localStorage reads for care data
   - Test: Refresh page, verify data loads from API

2. **Add Note**
   - Update `ApiDataAdapter.addNote()` to call `POST /api/notebook/notes`
   - Remove localStorage writes in `handleAddNote()`
   - Test: Add note, verify appears in UI, refresh to confirm persistence

3. **Update Tasks**
   - Update `ApiDataAdapter.toggleTask()` to call `PUT /api/notebook/tasks/:id`
   - Remove any localStorage task persistence
   - Test: Toggle task, verify state updates, refresh to confirm

4. **Handoff**
   - Update `ApiDataAdapter.handoff()` to call `POST /api/notebook/handoff`
   - Remove localStorage writes for `currentCaregiver` and `lastUpdatedBy`
   - Test: Perform handoff, verify state updates, refresh to confirm

5. **Notebook Existence Check**
   - Update `App.tsx` to check API instead of localStorage
   - `GET /api/notebook/today` returns 404 if no notebook
   - Test: New user sees landing page, existing user sees today view

**What "Done" Looks Like:**
- All care data operations go through API
- No localStorage reads/writes for care data
- Feature flag can be removed (always use API adapter)

---

### Phase 4: Remove localStorage and Migration Code

**Goal:** Clean up all client-side persistence code.

**Files to Delete/Modify:**
- `src/storage/localStorageAdapter.ts` (delete)
- `src/pages/Today.tsx` (remove migration logic, date rollover)
- `src/App.tsx` (remove `notebookExists()` localStorage checks)
- `src/mock/todayData.ts` (keep types, remove mock data)

**Steps:**

1. **Remove Migration Logic**
   - Delete `migrateOldData()` function
   - Delete author migration in `loadNotesByDate()`
   - Remove all references to old storage keys

2. **Remove Date Rollover Logic**
   - Delete `checkDateChange()` function
   - Delete `lastCheckedDateRef` and date checking interval
   - Server handles date boundaries

3. **Remove localStorage Adapter**
   - Delete `src/storage/localStorageAdapter.ts`
   - Remove feature flag
   - Always use `ApiDataAdapter`

4. **Remove Mock Data Fallbacks**
   - Delete `todayData` mock data
   - Keep type definitions
   - Server always returns data (or empty arrays)

5. **Clean Up Storage Keys**
   - Remove all `STORAGE_KEY_*` constants for care data
   - Keep `STORAGE_KEY_VIEW` if using sessionStorage for UX

**What "Done" Looks Like:**
- No localStorage code for care data
- No migration logic
- No date rollover logic
- Clean, server-focused codebase

---

### Phase 5: Validate Behavior with Multiple Caregivers

**Goal:** Ensure handoffs work correctly, no data conflicts.

**Test Scenarios:**

1. **Concurrent Updates**
   - Caregiver A adds note
   - Caregiver B adds note (different device/browser)
   - Both see each other's notes after refresh
   - No conflicts, no lost data

2. **Handoff Atomicity**
   - Caregiver A initiates handoff to B
   - Caregiver B sees handoff note and updated state
   - Caregiver A cannot perform another handoff (not current caregiver)
   - System note appears correctly

3. **Auth Token Management**
   - Caregiver A logs in, gets token
   - Caregiver B logs in on same device, gets different token
   - Each sees correct attribution
   - Tokens don't interfere

4. **Page Refresh**
   - Caregiver adds note, refreshes page
   - Note persists, state correct
   - Caregiver identity preserved (from token)

**What "Done" Looks Like:**
- All test scenarios pass
- No data loss or conflicts
- Handoffs work atomically
- Multiple caregivers can use app simultaneously

---

## Implementation Checklist

### Backend Setup
- [ ] Choose serverless platform (Vercel + Supabase recommended)
- [ ] Set up database schema
- [ ] Implement authentication (JWT tokens)
- [ ] Create API endpoints:
  - [ ] `GET /api/notebook/today`
  - [ ] `POST /api/notebook/notes`
  - [ ] `PUT /api/notebook/tasks/:id`
  - [ ] `POST /api/notebook/handoff`
  - [ ] `POST /api/notebook/initialize` (first-time setup)
- [ ] Add rate limiting
- [ ] Add error handling
- [ ] Test with multiple caregivers

### Frontend Refactor
- [ ] Phase 1: Isolate domain logic
- [ ] Phase 2: Create API adapter
- [ ] Phase 3: Migrate operations one by one
- [ ] Phase 4: Remove localStorage code
- [ ] Phase 5: Validate multi-caregiver behavior

### Security
- [ ] Auth tokens are HttpOnly, SameSite=Strict
- [ ] Server validates all caregiver identities
- [ ] No client-provided author attribution
- [ ] Rate limiting prevents abuse
- [ ] CORS configured correctly

### Testing
- [ ] Single caregiver flow works
- [ ] Multiple caregivers can use app simultaneously
- [ ] Handoffs work atomically
- [ ] Page refresh restores correct state
- [ ] Network errors handled gracefully
- [ ] Auth errors handled gracefully

---

## Success Criteria

✅ **Architecture Complete:**
- Clear serverless architecture defined
- Authentication strategy documented
- API endpoints specified

✅ **Code Changes Identified:**
- Exact files to modify listed
- Logic migration map complete
- Deletion targets identified

✅ **localStorage Removable:**
- All care data operations go through API
- No localStorage dependencies for care data
- Migration code removed

✅ **Multi-Caregiver Support:**
- Handoffs work atomically
- No data conflicts
- Attribution is secure

✅ **Preserved UI:**
- No UI changes required
- Existing interaction model intact
- User experience unchanged

---

## Next Steps

1. **Review this architecture** with team/stakeholders
2. **Set up serverless backend** (Vercel + Supabase recommended)
3. **Begin Phase 1 refactor** (isolate domain logic)
4. **Implement API endpoints** in parallel with frontend refactor
5. **Test incrementally** after each phase
6. **Deploy and validate** with real caregiver scenarios

---

**Document Status:** Ready for implementation  
**Last Updated:** Architecture planning phase  
**Next Review:** After Phase 1 completion







