# Admin Control Panel — Requirements

## I. Core Admin Control Panel (Full System Control)

### Authentication
- [ ] Admin secure login

### Global Settings
- [ ] Booking window configuration
- [ ] Working hours configuration
- [ ] Time slot templates
- [ ] Deposit percentage + refund policy
- [ ] Provider home location
- [ ] Bilingual message content/templates (AR/EN)

### Services Management
- [ ] Main services CRUD
- [ ] Sub-services CRUD
- [ ] Arabic/English labels
- [ ] Pricing management
- [ ] Slot template mapping per service

### Providers Management
- [ ] Create/edit providers
- [ ] Service capability mapping (which provider handles which service)
- [ ] Ratings field (average + count)

### District Management
- [ ] Place ID unique storage
- [ ] Arabic/English display names
- [ ] Merge/fix duplicates tools

### Bookings Management
- [ ] List view
- [ ] Calendar view
- [ ] Filters
- [ ] Actions: cancel / reschedule / no-show / refund
- [ ] Mark booking Completed (triggers rating timer)

### Client Profiles
- [ ] Search
- [ ] Full history timeline

### Dashboard & Logs
- [ ] Heat map dashboard (occupancy + locked district per day)
- [ ] Audit log for admin actions and system events

---

## II. Flow & Human Handoff Management

### Client Flow Control
- [ ] View each client's current flow step/state
- [ ] Reset client flow (restart without deleting history)
- [ ] Jump client to a specific step (override)
- [ ] Edit captured fields (name / service / district / date / slot) before confirmation
- [ ] Force-confirm or force-cancel bookings (with audit log entry)
- [ ] Manually message client from panel (AR/EN)
- [ ] Resume automation after human handoff ends

### Conversation Management
- [ ] Conversation status tracking: `open` / `waiting_client` / `waiting_admin` / `resolved`
- [ ] Store full transcript per client
- [ ] Inbox of active conversations
- [ ] Flag conversations requesting human handoff
- [ ] Assign conversation to CSR/agent
- [ ] Toggle bot paused/active per conversation
- [ ] Conversation notes / tags / internal comments
- [ ] SLA / waiting time indicator (optional)

### CSR (Customer Service Representative) Accounts
- [ ] Create CSR accounts
- [ ] Configurable roles and permissions
- [ ] CSR replies from panel via WhatsApp provider
