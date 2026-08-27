# Chadrey Wholesale Admin Dashboard

## Product intent

The admin portal is a protected operations workspace. It is not a second storefront. Every surface either reports live Supabase data or opens a workflow that changes a real business record. No demo counts, sample customers, or fabricated quote records belong in this interface.

## Route map

| Route | Component | Purpose | Primary action |
|---|---|---|---|
| `/admin/login` | `AdminLogin` | Separate administrator sign-in | Sign in with Supabase Google or email |
| `/admin` | `AdminDashboard` | Operational overview | Open live quote, quotation, invoice, and order workflows |
| `/admin/analytics` | `AdminAnalytics` | Live operational metrics | Drill into the linked operational view |
| `/admin/users` | `AdminUsers` | Account and role management | Change another profile between customer and admin |
| `/admin/quote` | `AdminQuoteComposer` | Price and issue quotations | Send or update a quotation |
| `/admin/fulfilment` | `AdminFulfilment` | Manage order execution | Update status, carrier, tracking, and shipping details |
| `/admin/products/new` | `AdminProductCreate` | Publish catalogue products | Upload 10–30 images and choose a primary image |

## Desktop wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ CHADREY OPERATIONS                         Analytics   User   Sign out       │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ OPERATIONS    │ OPERATIONS / OVERVIEW                                        │
│ • Overview    │ Good morning, team.                                         │
│ • Analytics   │ Live activity across requests, quotations, invoices, orders. │
│ • Quotes      │                                                              │
│ • Quotations  │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ • Invoices    │ │Quote reqs  │ │Quotations  │ │Invoices    │ │Orders      │ │
│ • Orders      │ │live count  │ │live count  │ │live count  │ │live count  │ │
│ • Payments    │ │→ inbox     │ │→ composer   │ │→ billing   │ │→ fulfilment│ │
│ DIRECTORY     │ └────────────┘ └────────────┘ └────────────┘ └────────────┘ │
│ • Users       │                                                              │
│ • Products    │ ┌───────────────────────────────┐ ┌───────────────────────┐ │
│ • Messages    │ │ Recent quote requests          │ │ Orders to watch       │ │
│               │ │ ref · customer · status  →    │ │ order · carrier · →   │ │
│               │ │ ref · customer · status  →    │ │ empty/live state      │ │
│               │ └───────────────────────────────┘ └───────────────────────┘ │
│               │ ┌───────────────────────────────┐ ┌───────────────────────┐ │
│               │ │ Owner alerts                  │ │ Quick actions          │ │
│               │ │ verified events only          │ │ New product            │ │
│               │ │ quote · payment               │ │ Manage users           │ │
│               │ └───────────────────────────────┘ └───────────────────────┘ │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

## Mobile wireframe

```text
┌─────────────────────────────┐
│ ☰  CHADREY       ◯  ⋮        │
├─────────────────────────────┤
│ OPERATIONS / OVERVIEW        │
│ Good morning, team.          │
│                             │
│ ┌─────────────────────────┐ │
│ │ Quote requests       →  │ │
│ │ 0 · live               │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Quotations           →  │ │
│ │ 0 · live               │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Invoices             →  │ │
│ │ 0 · live               │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Orders               →  │ │
│ │ 0 · live               │ │
│ └─────────────────────────┘ │
│                             │
│ Recent requests             │
│ Empty state or live rows →  │
│                             │
│ Quick actions               │
│ [New product] [Users]       │
└─────────────────────────────┘
```

## Component contract

`AdminDashboard` owns authentication gating and composes `AdminNav`, `LiveMetricCard`, `QuoteInboxPanel`, `FulfilmentPanel`, `OwnerAlertPanel`, and `QuickActionPanel`. `AdminAnalytics` reuses `LiveMetricCard` and adds `SignalPanel` and `DirectoryPanel`. `AdminUsers` owns profile loading and role updates, while the server enforces the administrator boundary. Each metric card receives a label, live value, destination, icon, and loading/error/empty state.

## Interaction rules

A link or button must either navigate to a registered route, submit a real mutation, open an accessible menu, or expose a truthful unavailable state. Summary cards are links, row chevrons open the relevant workflow, the analytics icon opens `/admin/analytics`, the Users item opens `/admin/users`, and the product item opens `/admin/products/new`. Empty states explain how a real record will appear and never substitute invented records.

## Data and security boundary

The browser uses the Supabase publishable key only. Supabase Auth establishes the session. The `profiles.role` field controls the customer/admin boundary through RLS. Customers can see their own quotes, quotations, invoices, payments, orders, messages, notifications, and addresses. Administrators can operate marketplace records. Role changes are restricted to administrators and the current administrator cannot self-demote from the user-management UI. `admin_audit_logs` records sensitive administrator actions.
