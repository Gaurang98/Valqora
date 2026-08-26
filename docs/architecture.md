# Valqora Architecture Overview

Valqora is an AI-powered Revenue Decision & Recovery Engine designed with a modular structure.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│       Tailwind CSS UI • Recharts Visualizer • Lucide        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Node.js + Express)                │
│    API Router • Business Logic • Mongoose Data Layer        │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      MongoDB Database        │ │    Python ML Subsystem     │
│ Subscriptions, Invoices, Logs│ │ Risk Prediction & Strategy │
└──────────────────────────────┘ └────────────────────────────┘
```

## System Components

1. **Frontend**: Interactive React application providing actionable dashboards, risk alerts, and recovery metrics.
2. **Backend**: Express.js REST API managing data operations, serving endpoints, and orchestrating recovery workflows.
3. **Database**: MongoDB instance for storing customer profiles, transaction histories, and recovery tracking.
4. **ML Module**: Python pipelines for anomaly detection and recovery decision optimization.
