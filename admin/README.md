# WhatsApp Booking System — Admin Panel

A web-based admin control panel for managing a WhatsApp-powered booking system. Built with **Next.js 16**, **React 19**, **TypeScript**, and **Tailwind CSS v4**.

---

## Overview

This admin panel is the back-office interface for the WhatsApp Booking System. It gives admins and customer service representatives (CSRs) full control over bookings, providers, services, districts, client conversations, and bot flow management — all in one place.

The booking system itself runs over WhatsApp (chatbot), and this panel connects to the same backend to let admins monitor, intervene, and configure everything.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Linting | ESLint 9 |

---

## Features

### Core Admin Control

- **Authentication** — Secure admin login
- **Global Settings** — Booking window, working hours, time slot templates, deposit %, refund policy, provider home location, bilingual message templates (AR/EN)
- **Services Management** — Main services and sub-services with Arabic/English labels, pricing, and slot template mapping
- **Providers Management** — Create/edit providers, map service capabilities, track ratings (avg + count)
- **District Management** — Place ID storage, AR/EN display names, merge/fix duplicate districts
- **Bookings Management** — List view, calendar view, filters, and actions (cancel / reschedule / no-show / refund / complete)
- **Client Profiles** — Search clients and view full booking history timeline
- **Dashboard** — Heat map of daily occupancy and locked districts per day
- **Audit Log** — Full log of admin actions and system events

### Flow & Human Handoff Management

- **Client Flow Control** — View current flow state, reset flow, jump to any step, edit captured fields, force-confirm/cancel bookings
- **Conversation Management** — Status tracking (`open` / `waiting_client` / `waiting_admin` / `resolved`), full transcript storage, inbox, conversation notes/tags, bot toggle per conversation
- **CSR Accounts** — Create CSR accounts with configurable roles/permissions; CSRs reply via WhatsApp directly from the panel
- **Handoff** — Flag conversations needing human, assign to CSR/agent, resume bot automation after handoff ends
- **SLA Indicator** — Waiting time tracker per conversation (optional)

---

## Project Structure

```
whatsapp-booking-system-admin/
├── src/
│   └── app/              # Next.js App Router pages
├── public/               # Static assets
├── docs/
│   └── admin-control-panel-requirements.md
├── next.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm / yarn / pnpm

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

---

## Documentation

- [Admin Control Panel Requirements](./docs/admin-control-panel-requirements.md)

---

## Related

This admin panel is part of the **WhatsApp Booking System** — a full-stack system that includes:

- **WhatsApp Bot** — Handles client conversations, booking flow, and automated messaging
- **Backend API** — Shared database and business logic
- **Admin Panel** — This repository
