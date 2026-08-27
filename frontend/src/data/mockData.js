/**
 * Valqora Mock Data Store
 * Structured for enterprise SaaS/fintech revenue decision and recovery workflows.
 * Component interfaces are designed to map directly to future backend REST/GraphQL APIs.
 */

export const mockKPIs = {
  revenueAtRisk: {
    value: '₹18.4L',
    raw: 1840000,
    change: '+12.4%',
    isIncreaseBad: true,
    trend: 'up',
    comparisonText: 'vs. last 30 days',
    secondaryMetric: '142 flagged transactions'
  },
  recoverableRevenue: {
    value: '₹12.7L',
    raw: 1270000,
    change: '69.0%',
    trend: 'neutral',
    comparisonText: 'of total risk addressable',
    secondaryMetric: '88 high-probability targets'
  },
  revenueRecovered: {
    value: '₹8.3L',
    raw: 830000,
    change: '+18.2%',
    trend: 'up',
    isPositive: true,
    comparisonText: 'recovery velocity increase',
    secondaryMetric: '₹1.1L recovered today'
  },
  recoveryRate: {
    value: '65.4%',
    raw: 65.4,
    change: '+4.1%',
    trend: 'up',
    isPositive: true,
    comparisonText: 'above industry benchmark (48%)',
    secondaryMetric: 'Avg. resolution: 4.2 hrs'
  }
};

export const mockRiskTrends = [
  { date: 'Aug 01', risk: 4.2, recovered: 2.1, baseline: 3.5 },
  { date: 'Aug 04', risk: 5.8, recovered: 3.4, baseline: 3.6 },
  { date: 'Aug 07', risk: 8.1, recovered: 4.9, baseline: 3.7 },
  { date: 'Aug 10', risk: 11.4, recovered: 6.2, baseline: 3.8 },
  { date: 'Aug 13', risk: 9.3, recovered: 6.8, baseline: 3.8 },
  { date: 'Aug 16', risk: 14.2, recovered: 7.4, baseline: 4.0 },
  { date: 'Aug 19', risk: 16.5, recovered: 7.9, baseline: 4.1 },
  { date: 'Aug 22', risk: 17.8, recovered: 8.1, baseline: 4.2 },
  { date: 'Aug 25', risk: 18.4, recovered: 8.3, baseline: 4.3 },
];

export const mockCriticalOpportunities = [
  {
    id: 'OPP-101',
    opportunity: 'Subscription Payment Failure',
    customer: 'Apex Cloud Solutions',
    customerEmail: 'billing@apexcloud.io',
    tier: 'Enterprise',
    revenueAtRisk: '₹3.2L',
    rawAmount: 320000,
    recoveryProbability: 82,
    priority: 'HIGH',
    recommendedAction: 'Payment Link',
    actionDetail: 'Dispatch 1-click tokenized smart payment link via WhatsApp & Email',
    status: 'Pending',
    failureReason: 'Card Expired / 3DS Timeout',
    detectedAt: '12 mins ago'
  },
  {
    id: 'OPP-102',
    opportunity: 'Checkout Abandonment',
    customer: 'Zenith Logistics Ltd',
    customerEmail: 'finance@zenithlogistics.in',
    tier: 'Mid-Market',
    revenueAtRisk: '₹2.1L',
    rawAmount: 210000,
    recoveryProbability: 67,
    priority: 'HIGH',
    recommendedAction: 'Reminder',
    actionDetail: 'Trigger dynamic discount & saved-cart intent recovery sequence',
    status: 'Pending',
    failureReason: 'UPI Intent Timed Out',
    detectedAt: '28 mins ago'
  },
  {
    id: 'OPP-103',
    opportunity: 'Provider Degradation',
    customer: 'Klarity Analytics Pvt Ltd',
    customerEmail: 'accounts@klarity.co',
    tier: 'Growth',
    revenueAtRisk: '₹1.8L',
    rawAmount: 180000,
    recoveryProbability: 54,
    priority: 'MEDIUM',
    recommendedAction: 'Retry',
    actionDetail: 'Reroute to secondary HDFC gateway switch with exponential backoff',
    status: 'Investigating',
    failureReason: 'Razorpay 504 Gateway Timeout',
    detectedAt: '45 mins ago'
  },
  {
    id: 'OPP-104',
    opportunity: 'Webhook Latency Dropoff',
    customer: 'Nova Healthtech',
    customerEmail: 'ops@novahealth.in',
    tier: 'Enterprise',
    revenueAtRisk: '₹1.4L',
    rawAmount: 140000,
    recoveryProbability: 78,
    priority: 'HIGH',
    recommendedAction: 'Smart Retry',
    actionDetail: 'Execute webhook signature verification sync and reconcile mandate',
    status: 'Pending',
    failureReason: 'Mandate Reconciliation Lag',
    detectedAt: '1 hour ago'
  },
  {
    id: 'OPP-105',
    opportunity: 'Gateway Timeout Spike',
    customer: 'Starlight E-Commerce',
    customerEmail: 'admin@starlight.store',
    tier: 'SMB',
    revenueAtRisk: '₹95K',
    rawAmount: 95000,
    recoveryProbability: 89,
    priority: 'HIGH',
    recommendedAction: 'Route Switch',
    actionDetail: 'Switch acquirer route to PayU Backup tunnel',
    status: 'In Progress',
    failureReason: 'Acquirer Switch Overload',
    detectedAt: '2 hours ago'
  }
];

export const mockAllOpportunities = [
  ...mockCriticalOpportunities,
  {
    id: 'OPP-106',
    opportunity: 'Mandate Authorization Failure',
    customer: 'Hyperion Media Networks',
    customerEmail: 'sub@hyperion.com',
    tier: 'Enterprise',
    revenueAtRisk: '₹2.8L',
    rawAmount: 280000,
    recoveryProbability: 75,
    priority: 'HIGH',
    recommendedAction: 'Auto-Debit Rerun',
    actionDetail: 'Align debit schedule with customer salary credit window',
    status: 'In Progress',
    failureReason: 'Insufficient Balance on Due Date',
    detectedAt: '3 hours ago'
  },
  {
    id: 'OPP-107',
    opportunity: 'Card Processing Exception',
    customer: 'Pulse SaaS Platform',
    customerEmail: 'billing@pulsesaas.dev',
    tier: 'Growth',
    revenueAtRisk: '₹1.1L',
    rawAmount: 110000,
    recoveryProbability: 61,
    priority: 'MEDIUM',
    recommendedAction: 'Dunning Email',
    actionDetail: 'Multi-channel payment update prompt with grace period',
    status: 'Pending',
    failureReason: 'Do Not Honor (Issuer Policy)',
    detectedAt: '4 hours ago'
  },
  {
    id: 'OPP-108',
    opportunity: 'Inconsistent GSTIN Rejection',
    customer: 'Vanguard Industrial Supplies',
    customerEmail: 'tax@vanguardind.com',
    tier: 'Enterprise',
    revenueAtRisk: '₹3.9L',
    rawAmount: 390000,
    recoveryProbability: 92,
    priority: 'HIGH',
    recommendedAction: 'GST Helper & Re-Invoice',
    actionDetail: 'Auto-validate GSTIN against Govt Portal and re-issue invoice',
    status: 'Recovered',
    failureReason: 'Tax ID Validation Error',
    detectedAt: '6 hours ago'
  },
  {
    id: 'OPP-109',
    opportunity: 'Micro-Transaction Batch Failure',
    customer: 'NeoPay FinTech',
    customerEmail: 'tech@neopay.in',
    tier: 'Enterprise',
    revenueAtRisk: '₹75K',
    rawAmount: 75000,
    recoveryProbability: 45,
    priority: 'LOW',
    recommendedAction: 'Manual Review',
    actionDetail: 'Batch queue retry scheduled after provider maintenance',
    status: 'Investigating',
    failureReason: 'Rate Limit Throttling (429)',
    detectedAt: '8 hours ago'
  },
  {
    id: 'OPP-110',
    opportunity: 'Annual Renewal Friction',
    customer: 'CloudMatrix IT Solutions',
    customerEmail: 'ceo@cloudmatrix.co',
    tier: 'Mid-Market',
    revenueAtRisk: '₹1.65L',
    rawAmount: 165000,
    recoveryProbability: 84,
    priority: 'HIGH',
    recommendedAction: 'VIP Account Dunning',
    actionDetail: 'Notify dedicated account manager with pre-filled renewal contract',
    status: 'Recovered',
    failureReason: 'Corporate Card Limit Exceeded',
    detectedAt: '12 hours ago'
  }
];

export const mockIncidents = [
  {
    id: 'INC-8941',
    title: 'Razorpay Gateway 504 Timeout Spike',
    severity: 'CRITICAL',
    status: 'Active Investigation',
    detectedAt: '2026-08-26 17:42 IST',
    revenueAtRisk: '₹3.45L',
    rawRisk: 345000,
    affectedTransactions: 142,
    affectedMerchants: 18,
    rootCause: 'Upstream HDFC/SBI Netbanking switch latency exceeding 12,000ms threshold',
    modelConfidence: 94.2,
    recoveryProbability: 81.5,
    aiAnalysis: 'Valqora Anomaly Detector identified a 310% surge in HTTP 504 Gateway Timeouts on primary payment routes between 17:15 and 17:40 IST. Upstream banking servers are queueing transactions without sending final debit confirmations. 81.5% of affected customers have high intent and valid mandates.',
    recommendedAction: 'Dynamic Fallback Routing & Smart Link Dispatch',
    actionSummary: 'Automatically switch traffic to backup ICICI/Axis gateway and trigger asynchronous tokenized recovery links for dropped sessions.',
    flow: {
      incident: {
        title: '504 Timeout Spike Detected',
        timestamp: '17:42:05 IST',
        metric: '142 Failed Txns / ₹3.45L Risk',
        status: 'Triggered'
      },
      rootCause: {
        title: 'Upstream Switch Latency',
        timestamp: '17:42:18 IST',
        detail: 'HDFC Netbanking node unresponsive (>12s)',
        confidence: '94.2% ML Confidence'
      },
      recoveryProb: {
        title: 'High Intent Recovery Potential',
        timestamp: '17:42:25 IST',
        probability: '81.5% Success Likelihood',
        factors: 'Strong customer credit history, active subscriptions'
      },
      recommendedAction: {
        title: 'Smart Fallback + Instant Link',
        timestamp: '17:42:30 IST',
        strategy: 'Reroute to Axis Acquirer + WhatsApp Recovery',
        expectedRecovery: '₹2.81L Projected Gain'
      }
    },
    sections: {
      whatHappened: [
        'At 17:15 IST, transaction error rate spiked from baseline 1.8% to 14.6%.',
        '142 transactions stalled in "AUTHORIZED_PENDING" state without terminal settlement.',
        'Total revenue stalled across enterprise and mid-market accounts reached ₹3.45 Lakhs.'
      ],
      whyDidItHappen: [
        'Primary payment aggregator experienced cascading socket timeouts connecting to state banking switches.',
        'Automatic client retry loops overloaded the primary gateway endpoint, causing temporary blacklisting.',
        'Standard retry logic failed because it was blindly retrying the same congested gateway tunnel.'
      ],
      whatShouldValqoraDo: [
        'Halt blind retries on congested gateway to prevent customer card locks and fraud score degradation.',
        'Switch dynamic routing rule to Axis/ICICI secondary acquiring pipeline for all incoming transactions.',
        'Dispatch Valqora Smart Recovery Links to 142 impacted users with pre-authenticated sessions.'
      ],
      whyThisAction: [
        'Historical model benchmark: Blind retry has only 22% success during banking outages.',
        'Smart Fallback + Instant Link achieves 81.5% recovery rate within a 2-hour recovery window.',
        'Prevents 87% of potential customer support tickets and eliminates involuntary churn.'
      ]
    }
  },
  {
    id: 'INC-8942',
    title: 'Recurring Mandate Auth Drop on ICICI Cards',
    severity: 'HIGH',
    status: 'Resolving',
    detectedAt: '2026-08-26 15:10 IST',
    revenueAtRisk: '₹2.10L',
    rawRisk: 210000,
    affectedTransactions: 88,
    affectedMerchants: 12,
    rootCause: 'RBI e-Mandate Pre-Debit Notification (AFA) token synchronization lag',
    modelConfidence: 91.0,
    recoveryProbability: 76.0,
    aiAnalysis: 'Recurring subscriptions failed pre-debit webhook validation due to delayed token synchronization on card network endpoints.',
    recommendedAction: 'Automated 24h Reschedule & Pre-Debit SMS Ping',
    actionSummary: 'Reschedule auto-debit batch for tomorrow 09:00 AM after token resync and send proactive SMS alert.',
    flow: {
      incident: {
        title: 'Mandate Validation Failure',
        timestamp: '15:10:12 IST',
        metric: '88 Failed Subscriptions / ₹2.10L Risk',
        status: 'Triggered'
      },
      rootCause: {
        title: 'Token Sync Lag (e-Mandate)',
        timestamp: '15:10:28 IST',
        detail: 'Pre-debit webhook delivery delay on issuer',
        confidence: '91.0% ML Confidence'
      },
      recoveryProb: {
        title: 'Moderate-High Recovery Prob',
        timestamp: '15:10:35 IST',
        probability: '76.0% Likelihood',
        factors: 'Valid customer card tokens on file'
      },
      recommendedAction: {
        title: 'Reschedule + Proactive Notification',
        timestamp: '15:10:42 IST',
        strategy: 'Auto-reschedule debit + WhatsApp pre-dunning',
        expectedRecovery: '₹1.60L Projected Gain'
      }
    },
    sections: {
      whatHappened: [
        'Batch recurring billing for 88 customers was rejected with code MANDATE_NOT_ACTIVE.',
        'Revenue of ₹2.10 Lakhs failed to debit at scheduled 15:00 IST cycle.'
      ],
      whyDidItHappen: [
        'Issuer token server had a 30-minute maintenance window delaying pre-debit regulatory notice acknowledgement.',
        'Subscriptions are completely valid, but statutory timing window was missed.'
      ],
      whatShouldValqoraDo: [
        'Schedule smart batch re-submission 24 hours later at off-peak morning hours (09:00 AM IST).',
        'Send compliance-compliant SMS update to customers preventing confusion.'
      ],
      whyThisAction: [
        'Prevents permanent subscription cancellation and saves merchant ₹45,000 in customer acquisition costs.',
        'Zero manual intervention required from merchant finance team.'
      ]
    }
  }
];

export const mockDecisionTraces = [
  {
    id: 'DEC-77291',
    transactionId: 'TXN-77291',
    customer: 'Klarity Analytics Pvt Ltd',
    amount: '₹32,000',
    rawAmount: 32000,
    timestamp: '2026-08-26 17:48:22 IST',
    model: 'Valqora-RecovNet v2.4',
    modelConfidence: '92.8%',
    policyResult: 'APPROVED',
    actionResult: 'SUCCESS',
    recoveredAmount: '₹32,000',
    steps: [
      { step: 1, title: 'Transaction Initiated', detail: 'Customer checkout for Enterprise Plan', value: '₹32,000', status: 'done' },
      { step: 2, title: 'Risk Detected', detail: 'Acquirer returned HTTP 504 Gateway Timeout', value: 'Payment Timeout', status: 'risk' },
      { step: 3, title: 'Diagnosis Engine', detail: 'Cluster failure detected on primary gateway node', value: 'Temporary Provider Failure', status: 'done' },
      { step: 4, title: 'Recovery Probability', detail: 'Calculated via RecovNet Multi-Factor Scoring', value: '82% High Confidence', status: 'highlight' },
      { step: 5, title: 'Priority Scoring', detail: 'Ranked by MRR, user churn risk, and margin', value: 'HIGH PRIORITY', status: 'highlight' },
      { step: 6, title: 'AI Recommendation', detail: 'Smart reroute to secondary payment rail + 3-min delay', value: 'RETRY VIA BACKUP ROUTE', status: 'done' },
      { step: 7, title: 'Policy Guardrail Check', detail: 'Verified: Under max retry limit (1/3) & within rate bounds', value: 'POLICY APPROVED', status: 'policy' },
      { step: 8, title: 'Action Execution', detail: 'Dispatched autonomous API retry payload to secondary switch', value: 'Retry Executed (Latency: 280ms)', status: 'action' },
      { step: 9, title: 'Outcome & Recovery', detail: 'Bank authorized payment and settled funds', value: 'SUCCESS — ₹32,000 Recovered', status: 'success' }
    ],
    telemetry: {
      customerLTV: '₹4.8L',
      previousFailures: 0,
      riskScore: 0.18,
      recommendedDelayMs: 180000,
      policyRule: 'POL-AUTO-RETRY-L1 (Max 3 attempts, Minimum 70% Confidence)'
    }
  },
  {
    id: 'DEC-88412',
    transactionId: 'TXN-88412',
    customer: 'Vanguard Industrial Supplies',
    amount: '₹78,500',
    rawAmount: 78500,
    timestamp: '2026-08-26 16:15:09 IST',
    model: 'Valqora-RecovNet v2.4',
    modelConfidence: '95.1%',
    policyResult: 'APPROVED',
    actionResult: 'SUCCESS',
    recoveredAmount: '₹78,500',
    steps: [
      { step: 1, title: 'Transaction Initiated', detail: 'B2B Procurement Quarterly Invoice', value: '₹78,500', status: 'done' },
      { step: 2, title: 'Risk Detected', detail: 'Invoice checkout abandoned at tax confirmation step', value: 'Tax Schema Mismatch', status: 'risk' },
      { step: 3, title: 'Diagnosis Engine', detail: 'GSTIN state code mismatch on billing address', value: 'GST Validation Discrepancy', status: 'done' },
      { step: 4, title: 'Recovery Probability', detail: 'High intent corporate buyer with recurring contract', value: '89% High Likelihood', status: 'highlight' },
      { step: 5, title: 'Priority Scoring', detail: 'High invoice value with zero fraud flags', value: 'HIGH PRIORITY', status: 'highlight' },
      { step: 6, title: 'AI Recommendation', detail: 'Generate corrected tax invoice & dispatch 1-click B2B payment link', value: 'RE-INVOICE + SMART LINK', status: 'done' },
      { step: 7, title: 'Policy Guardrail Check', detail: 'Verified: Auto-invoice generation enabled for B2B accounts', value: 'POLICY APPROVED', status: 'policy' },
      { step: 8, title: 'Action Execution', detail: 'Interactive WhatsApp & Email invoice portal sent to finance manager', value: 'Portal Dispatched', status: 'action' },
      { step: 9, title: 'Outcome & Recovery', detail: 'Customer completed payment via NEFT/RTGS gateway link', value: 'SUCCESS — ₹78,500 Recovered', status: 'success' }
    ],
    telemetry: {
      customerLTV: '₹14.2L',
      previousFailures: 1,
      riskScore: 0.11,
      recommendedDelayMs: 0,
      policyRule: 'POL-B2B-SMART-DUNNING (Immediate invoice correction on Tax Errors)'
    }
  },
  {
    id: 'DEC-99104',
    transactionId: 'TXN-99104',
    customer: 'Apex Cloud Solutions',
    amount: '₹15,200',
    rawAmount: 15200,
    timestamp: '2026-08-26 14:02:44 IST',
    model: 'Valqora-RecovNet v2.4',
    modelConfidence: '87.4%',
    policyResult: 'APPROVED',
    actionResult: 'PENDING_EXECUTION',
    recoveredAmount: '₹0 (Scheduled)',
    steps: [
      { step: 1, title: 'Transaction Initiated', detail: 'Monthly Server Add-on Subscription', value: '₹15,200', status: 'done' },
      { step: 2, title: 'Risk Detected', detail: 'Card issuer returned Insufficient Funds (Code 51)', value: 'Balance Insufficient', status: 'risk' },
      { step: 3, title: 'Diagnosis Engine', detail: 'End-of-month payroll cycle timing mismatch', value: 'Temporary Liquidity Lag', status: 'done' },
      { step: 4, title: 'Recovery Probability', detail: 'Probability jumps from 24% today to 79% on 1st of month', value: '71% Predictive Prob', status: 'highlight' },
      { step: 5, title: 'Priority Scoring', detail: 'Standard recurring plan with high retention probability', value: 'MEDIUM PRIORITY', status: 'highlight' },
      { step: 6, title: 'AI Recommendation', detail: 'Delay retry to 1st of next month at 10:30 AM', value: 'CALENDAR-ALIGNED RETRY', status: 'done' },
      { step: 7, title: 'Policy Guardrail Check', detail: 'Verified: Scheduled delay complies with customer SLA', value: 'POLICY APPROVED', status: 'policy' },
      { step: 8, title: 'Action Execution', detail: 'Scheduled queued execution for Sep 01, 2026 10:30 AM IST', value: 'Queued in Engine', status: 'action' },
      { step: 9, title: 'Outcome & Recovery', detail: 'Awaiting scheduled trigger window', value: 'PENDING EXECUTION', status: 'pending' }
    ],
    telemetry: {
      customerLTV: '₹2.9L',
      previousFailures: 0,
      riskScore: 0.29,
      recommendedDelayMs: 518400000,
      policyRule: 'POL-PAYDAY-SMART-SCHEDULE (Align retries with salary credit dates)'
    }
  }
];

export const mockAuditLogs = [
  {
    id: 'AUD-9901',
    timestamp: '2026-08-26 17:48:25 IST',
    event: 'ACTION_EXECUTED',
    actor: 'Valqora Engine (AI)',
    incident: 'INC-8941',
    action: 'Dispatched Smart Payment Link to Apex Cloud Solutions (₹3.2L)',
    status: 'SUCCESS',
    severity: 'info',
    payload: {
      txnId: 'TXN-77291',
      channel: ['whatsapp', 'email'],
      tokenExpiry: '24h',
      gateway: 'Axis-Secondary-02'
    }
  },
  {
    id: 'AUD-9902',
    timestamp: '2026-08-26 17:45:10 IST',
    event: 'POLICY_EVALUATED',
    actor: 'Policy Guardrails',
    incident: 'INC-8941',
    action: 'Evaluated POL-AUTO-RETRY-L1: Passed all velocity limits',
    status: 'APPROVED',
    severity: 'info',
    payload: {
      policyId: 'POL-AUTO-RETRY-L1',
      attemptCount: 1,
      maxAllowed: 3,
      result: 'ALLOW'
    }
  },
  {
    id: 'AUD-9903',
    timestamp: '2026-08-26 17:42:05 IST',
    event: 'RISK_DETECTED',
    actor: 'Anomaly Detector',
    incident: 'INC-8941',
    action: 'Flagged 142 transactions at risk due to Gateway 504 Timeout Surge',
    status: 'ALERT',
    severity: 'warning',
    payload: {
      errorRate: '14.6%',
      baseline: '1.8%',
      riskAmount: '₹3.45L',
      affectedUsers: 142
    }
  },
  {
    id: 'AUD-9904',
    timestamp: '2026-08-26 16:15:12 IST',
    event: 'REVENUE_RECOVERED',
    actor: 'Valqora Reconciler',
    incident: 'INC-8938',
    action: 'Settled ₹78,500 for Vanguard Industrial Supplies via Smart Link',
    status: 'SUCCESS',
    severity: 'success',
    payload: {
      txnId: 'TXN-88412',
      method: 'NEFT_PORTAL',
      settlementTime: '18 mins post-dispatch'
    }
  },
  {
    id: 'AUD-9905',
    timestamp: '2026-08-26 15:30:00 IST',
    event: 'MANUAL_OVERRIDE',
    actor: 'admin@acmefintech.com (Priya Sharma)',
    incident: 'INC-8937',
    action: 'Approved manual VIP recovery incentive discount of 5% for CloudMatrix',
    status: 'APPROVED',
    severity: 'info',
    payload: {
      overrideReason: 'VIP Customer Retention',
      discountAmount: '₹8,250',
      approvedBy: 'Priya Sharma (VP Finance)'
    }
  },
  {
    id: 'AUD-9906',
    timestamp: '2026-08-26 14:10:19 IST',
    event: 'POLICY_BLOCKED',
    actor: 'Policy Guardrails',
    incident: 'INC-8935',
    action: 'Blocked automated retry for TXN-44120: Exceeded max daily retry quota (3/3)',
    status: 'BLOCKED',
    severity: 'error',
    payload: {
      txnId: 'TXN-44120',
      attemptsToday: 3,
      rule: 'POL-RATE-LIMIT-CARDS',
      nextEligibleTime: '2026-08-27 00:00 IST'
    }
  },
  {
    id: 'AUD-9907',
    timestamp: '2026-08-26 12:00:00 IST',
    event: 'SYSTEM_CONFIG',
    actor: 'System Admin',
    incident: 'SYS-OPS',
    action: 'Updated ML Confidence threshold for autonomous dispatch from 75% to 80%',
    status: 'SUCCESS',
    severity: 'info',
    payload: {
      previousThreshold: 0.75,
      newThreshold: 0.80,
      updatedBy: 'System Admin'
    }
  }
];

export const mockSystemStatus = {
  status: 'System Operational',
  engineVersion: 'v2.4.1-prod',
  modelStatus: 'Active (Valqora-RecovNet)',
  latencyMs: 38,
  uptime: '99.98%',
  activePolicies: 14,
  connectedGateways: ['Razorpay', 'Stripe', 'PayU', 'HDFC SmartHub']
};
