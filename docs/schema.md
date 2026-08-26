# Valqora Data Schema (Draft)

This document outlines the core entities planned for the Valqora platform.

## 1. Customer (`customers`)
- `_id`: ObjectId
- `externalId`: String (Unique customer ID)
- `name`: String
- `email`: String
- `plan`: String (e.g., 'Starter', 'Growth', 'Enterprise')
- `mrr`: Number (Monthly Recurring Revenue)
- `status`: String ('active', 'at_risk', 'churned')
- `createdAt`: Date
- `updatedAt`: Date

## 2. Invoices / Transactions (`invoices`)
- `_id`: ObjectId
- `customerId`: ObjectId (Ref: Customer)
- `amount`: Number
- `currency`: String (Default: 'USD')
- `status`: String ('paid', 'failed', 'pending', 'recovered')
- `attemptCount`: Number
- `failureReason`: String
- `dueDate`: Date
- `createdAt`: Date

## 3. Recovery Actions (`recovery_actions`)
- `_id`: ObjectId
- `invoiceId`: ObjectId (Ref: Invoice)
- `customerId`: ObjectId (Ref: Customer)
- `strategy`: String ('smart_retry', 'dunning_email', 'discount_offer')
- `status`: String ('scheduled', 'executed', 'succeeded', 'failed')
- `executedAt`: Date
- `recoveredAmount`: Number
