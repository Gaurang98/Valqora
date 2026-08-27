"""
ml/risk_detector.py
===================
Valqora — AI Revenue Decision & Recovery Engine
Deterministic Risk & Opportunity Detection Layer

Reads data/transactions.csv and applies deterministic business logic and safety
rules to identify revenue recovery opportunities, determine recommended actions,
assign priority ratings, and monitor payment provider health.

Important:
  - This layer uses purely deterministic business rules (no random assignments,
    no machine learning models, no LLM calls).
  - Ground-truth labels (ground_truth_action, ground_truth_priority, is_recoverable)
    are strictly isolated and only used in evaluate_against_ground_truth() for
    validation and benchmarking.

Usage:
    python ml/risk_detector.py
"""

import sys
import json
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

import numpy as np
import pandas as pd

# ── Ensure UTF-8 output on Windows consoles ───────────────────────────────────
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
TRANSACTIONS_CSV = REPO_ROOT / "data" / "transactions.csv"

# ── Constants & Action Sets ───────────────────────────────────────────────────
TEMPORARY_FAILURES = {"BANK_TIMEOUT", "PROVIDER_TIMEOUT", "NETWORK_ERROR"}
PAYMENT_METHOD_FAILURES = {"CARD_EXPIRED", "PAYMENT_METHOD_EXPIRED", "INVALID_CARD"}
ALLOWED_PRIORITIES = {"NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"}
ALLOWED_ACTIONS = {"NO_ACTION", "RETRY", "PAYMENT_LINK", "PAYMENT_METHOD_UPDATE", "WAIT", "HUMAN_REVIEW"}


# ──────────────────────────────────────────────────────────────────────────────
# 1. Data Loading
# ──────────────────────────────────────────────────────────────────────────────

def load_transactions(path: Path = TRANSACTIONS_CSV) -> pd.DataFrame:
    """
    Load transactions.csv into a pandas DataFrame with proper data types.
    """
    if not path.exists():
        raise FileNotFoundError(
            f"transactions.csv not found at {path}.\n"
            "Run 'python ml/generate_dataset.py' to generate the dataset first."
        )

    df = pd.read_csv(path, parse_dates=["timestamp"], low_memory=False)

    # Standardize string columns
    str_cols = df.select_dtypes(include="str").columns
    for col in str_cols:
        df[col] = df[col].str.strip()

    # Ensure numeric columns are properly typed
    numeric_cols = ["amount", "retry_count", "customer_lifetime_value", "previous_failures"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    return df


# ──────────────────────────────────────────────────────────────────────────────
# 2. Deterministic Action & Recoverability Detection
# ──────────────────────────────────────────────────────────────────────────────

def determine_action_and_recoverability(
    status: str,
    failure_reason: str,
    retry_count: int,
    customer_type: str,
    previous_failures: int,
    amount: float,
    timestamp: pd.Timestamp,
    payment_method: str = ""
) -> Tuple[str, bool]:
    """
    Determine recommended recovery action and recoverability flag deterministically.

    Rules:
      1. status == SUCCESS:
         -> recoverable = False, action = 'NO_ACTION'

      2. SUSPICIOUS_TRANSACTION (Risk Safety Override):
         -> ALWAYS recoverable = False, action = 'HUMAN_REVIEW'

      3. Temporary Failures (BANK_TIMEOUT, PROVIDER_TIMEOUT, NETWORK_ERROR):
         - retry_count < 2:
             recoverable = True, action = 'RETRY'
         - retry_count == 2:
             recoverable = True
             action = 'PAYMENT_LINK' if customer_type in ('HIGH_VALUE', 'REGULAR') else 'RETRY'
         - retry_count >= 3 (Hard Safety Rule: Never RETRY):
             recoverable = False
             action = 'PAYMENT_LINK' if customer_type == 'HIGH_VALUE' else 'WAIT'

      4. Payment Method Failures (CARD_EXPIRED, PAYMENT_METHOD_EXPIRED, INVALID_CARD):
         -> recoverable = True, action = 'PAYMENT_METHOD_UPDATE'

      5. Recurring Payment Failures (RECURRING_PAYMENT_FAILED):
         -> If customer_type == 'HIGH_VALUE' and previous_failures <= 1:
             recoverable = True, action = 'PAYMENT_LINK'
         -> Else:
             recoverable = True, action = 'PAYMENT_METHOD_UPDATE'

      6. Insufficient Funds (INSUFFICIENT_FUNDS):
         - Never auto-retry.
         - Payday / Salary timing rule:
             If timestamp.day in (28, 29, 30, 31, 1, 2, 3, 4, 5):
                 recoverable = True, action = 'WAIT'
             Else:
                 recoverable = True, action = 'PAYMENT_LINK'

      7. Fallback:
         -> recoverable = True, action = 'PAYMENT_LINK'

      8. Hard Safety Assertion:
         - If retry_count >= 3, action MUST NEVER be 'RETRY'.
    """
    # 1. Successful transactions
    if status == "SUCCESS":
        return "NO_ACTION", False

    # 2. Fraud & Security Risk (Hard Override)
    if failure_reason == "SUSPICIOUS_TRANSACTION":
        return "HUMAN_REVIEW", False

    # 3. Temporary Infrastructure & Gateway Failures
    if failure_reason in TEMPORARY_FAILURES:
        if retry_count < 2:
            action = "RETRY"
            recoverable = True
        else:  # retry_count >= 2
            # Never recommend RETRY automatically for 2 or more attempts.
            # Deterministically route to PAYMENT_LINK for high‑value customers,
            # otherwise WAIT. Recoverable remains True (still potentially recoverable).
            recoverable = True
            action = "PAYMENT_LINK" if customer_type == "HIGH_VALUE" else "WAIT"

    # 4. Payment Method Invalidation
    elif failure_reason in PAYMENT_METHOD_FAILURES:
        action = "PAYMENT_METHOD_UPDATE"
        recoverable = True

    # 5. Recurring Mandate / Subscription Failures
    elif failure_reason == "RECURRING_PAYMENT_FAILED":
        if customer_type == "HIGH_VALUE" and previous_failures <= 1:
            action = "PAYMENT_LINK"
            recoverable = True
        else:
            action = "PAYMENT_METHOD_UPDATE"
            recoverable = True

    # 6. Insufficient Funds
    elif failure_reason == "INSUFFICIENT_FUNDS":
        day = timestamp.day if hasattr(timestamp, "day") else 15
        if day >= 28 or day <= 5:
            action = "WAIT"
            recoverable = True
        else:
            action = "PAYMENT_LINK"
            recoverable = True

    # 7. Default fallback for other potential failure reasons
    else:
        action = "PAYMENT_LINK"
        recoverable = True

    # Hard Safety Guardrail: Never recommend automated RETRY on 3+ failed attempts
    if retry_count >= 3 and action == "RETRY":
        action = "PAYMENT_LINK" if customer_type == "HIGH_VALUE" else "WAIT"

    return action, recoverable


# ──────────────────────────────────────────────────────────────────────────────
# 3. Deterministic Priority Assignment
# ──────────────────────────────────────────────────────────────────────────────

def determine_priority(
    status: str,
    failure_reason: str,
    customer_type: str,
    amount: float,
    customer_lifetime_value: float,
    previous_failures: int,
    recoverable: bool,
    recommended_action: str
) -> str:
    """
    Assign a deterministic business priority rating (NONE, LOW, MEDIUM, HIGH, CRITICAL).

    Rules:
      1. status == SUCCESS:
         -> 'NONE'

      2. Security / Fraud Risk (SUSPICIOUS_TRANSACTION):
         -> ALWAYS 'CRITICAL' (Overrides amount, customer value, etc.)

      3. High-Value Account Exposure:
         -> If customer_type == 'HIGH_VALUE' and (amount >= 25000.0 or customer_lifetime_value >= 150000.0):
             - amount >= 60000.0 -> 'CRITICAL'
             - Else -> 'HIGH'

      4. Significant Value / High Likelihood:
         -> If recoverable and (amount >= 8000.0 or customer_type == 'HIGH_VALUE'):
             -> 'HIGH'

      5. Moderate Value Recovery:
         -> If recoverable and (customer_type == 'REGULAR' and amount >= 3000.0):
             -> 'MEDIUM'
         -> If recoverable and amount >= 5000.0:
             -> 'MEDIUM'
         -> If recoverable and recommended_action == 'RETRY':
             -> 'MEDIUM'

      6. Low Value / High Risk of Repeated Failure:
         -> If previous_failures >= 3 or amount < 1000.0:
             -> 'LOW'

      7. Default for other recoverable failures -> 'MEDIUM', non-recoverable -> 'LOW'.
    """
    if status == "SUCCESS":
        return "NONE"

    # Security Override
    if failure_reason == "SUSPICIOUS_TRANSACTION":
        return "CRITICAL"

    # High Value Customer Exposure
    if customer_type == "HIGH_VALUE" and (amount >= 25000.0 or customer_lifetime_value >= 150000.0):
        return "CRITICAL" if amount >= 60000.0 else "HIGH"

    # High Value / Easily Recoverable Opportunity
    if recoverable and (amount >= 8000.0 or customer_type == "HIGH_VALUE"):
        return "HIGH"

    # Medium Priority Opportunities
    if recoverable and (customer_type == "REGULAR" and amount >= 3000.0):
        return "MEDIUM"

    if recoverable and amount >= 5000.0:
        return "MEDIUM"

    if recoverable and recommended_action == "RETRY":
        return "MEDIUM"

    # Low Priority / Small Value / Chronic Failure History
    if previous_failures >= 3 or amount < 1000.0:
        return "LOW"

    return "MEDIUM" if recoverable else "LOW"


# ──────────────────────────────────────────────────────────────────────────────
# 4. Batch Risk & Opportunity Detection
# ──────────────────────────────────────────────────────────────────────────────

def detect_risk(df: pd.DataFrame) -> pd.DataFrame:
    """
    Run the deterministic risk and recovery detection engine across all transactions.

    Appends:
      - detected_action: str
      - detected_recoverable: bool
      - detected_priority: str
    """
    actions = []
    recoverable_flags = []
    priorities = []

    for row in df.itertuples(index=False):
        action, rec = determine_action_and_recoverability(
            status=row.status,
            failure_reason=row.failure_reason,
            retry_count=int(row.retry_count),
            customer_type=row.customer_type,
            previous_failures=int(row.previous_failures),
            amount=float(row.amount),
            timestamp=row.timestamp,
            payment_method=getattr(row, "payment_method", "")
        )

        priority = determine_priority(
            status=row.status,
            failure_reason=row.failure_reason,
            customer_type=row.customer_type,
            amount=float(row.amount),
            customer_lifetime_value=float(row.customer_lifetime_value),
            previous_failures=int(row.previous_failures),
            recoverable=rec,
            recommended_action=action
        )

        actions.append(action)
        recoverable_flags.append(rec)
        priorities.append(priority)

    df_out = df.copy()
    df_out["detected_action"] = actions
    df_out["detected_recoverable"] = recoverable_flags
    df_out["detected_priority"] = priorities

    for row in df_out.itertuples(index=False):
        validate_decision_output(row)

    return df_out


# ──────────────────────────────────────────────────────────────────────────────
# 5. Opportunity Object Creation
# ──────────────────────────────────────────────────────────────────────────────

def validate_decision_output(row: Any) -> None:
    """Validate runtime decision fields and success invariants."""
    if row.detected_priority not in ALLOWED_PRIORITIES:
        raise ValueError(f"Invalid priority: {row.detected_priority}")
    if row.detected_action not in ALLOWED_ACTIONS:
        raise ValueError(f"Invalid recommended action: {row.detected_action}")
    if not isinstance(row.detected_recoverable, (bool, np.bool_)):
        raise ValueError("Recoverable must be a boolean")
    if row.status == "SUCCESS":
        if row.detected_priority != "NONE":
            raise ValueError("Successful transactions must have NONE priority")
        if row.detected_action != "NO_ACTION":
            raise ValueError("Successful transactions must have NO_ACTION")

def create_opportunity(row: Any, opp_idx: int) -> Dict[str, Any]:
    """
    Convert a detected failed transaction into a standardized Opportunity object.
    """
    validate_decision_output(row)
    if row.status != "FAILED":
        raise ValueError("Only failed transactions can become opportunities")

    return {
        "opportunityId": f"OPP_{row.transaction_id}",
        "transactionId": row.transaction_id,
        "customerId": row.customer_id,
        "amount": round(float(row.amount), 2),
        "revenueAtRisk": round(float(row.amount), 2),
        "recoverable": bool(row.detected_recoverable),
        "failureReason": row.failure_reason,
        "priority": row.detected_priority,
        "recommendedAction": row.detected_action,
        "retryCount": int(row.retry_count),
        "provider": row.provider,
        "customerType": row.customer_type,
        "customerLifetimeValue": round(float(row.customer_lifetime_value), 2),
        "previousFailures": int(row.previous_failures),
    }


def create_opportunities(detected_df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Extract all failed transactions that require recovery or human review action
    into standardized opportunity objects with unique, deterministic IDs.
    """
    # Only failed transactions requiring action become opportunities
    failed_mask = (detected_df["status"] == "FAILED") & (detected_df["detected_action"] != "NO_ACTION")
    failed_df = detected_df[failed_mask].reset_index(drop=True)

    transaction_ids = failed_df["transaction_id"]
    if transaction_ids.duplicated().any():
        raise ValueError("Failed transactions must have unique transaction_id values")

    opportunities = []
    for idx, row in enumerate(failed_df.itertuples(index=False), start=1):
        opp = create_opportunity(row, idx)
        opportunities.append(opp)

    return opportunities


# ──────────────────────────────────────────────────────────────────────────────
# 6. Payment Provider Degradation Detection
# ──────────────────────────────────────────────────────────────────────────────

def detect_provider_degradation(
    df: pd.DataFrame,
    threshold: float = 0.05,
    window_hours: Optional[int] = 4
) -> List[Dict[str, Any]]:
    """
    Analyze provider performance and detect potential degradation.

    Computes:
      - Overall baseline dataset success rate
      - Provider overall success rate
      - Degraded flag: True if provider_success_rate < (baseline_success_rate - threshold)
      - Time-window analysis: Identifies localized incident windows where success rate dips
    """
    total_txns = len(df)
    baseline_successes = (df["status"] == "SUCCESS").sum()
    baseline_rate = baseline_successes / total_txns if total_txns > 0 else 0.0

    provider_reports = []

    for provider, p_df in df.groupby("provider"):
        p_total = len(p_df)
        p_success = (p_df["status"] == "SUCCESS").sum()
        p_failed = (p_df["status"] == "FAILED").sum()
        p_rate = p_success / p_total if p_total > 0 else 0.0

        # Dataset-wide degradation check
        is_degraded = p_rate < (baseline_rate - threshold)

        # Time-window analysis (e.g. rolling 4-hour window failure rate spikes)
        window_incidents = []
        if window_hours and p_total > 50:
            # Sort chronologically
            p_sorted = p_df.sort_values("timestamp").copy()
            p_sorted = p_sorted.set_index("timestamp")
            rolling_txns = p_sorted["status"].rolling(f"{window_hours}h").count()
            rolling_succ = (p_sorted["status"] == "SUCCESS").rolling(f"{window_hours}h").sum()
            rolling_rate = (rolling_succ / rolling_txns).dropna()

            # Find windows with severe degradation (> 25% failure rate in window)
            degraded_windows = rolling_rate[rolling_rate < 0.75]
            if len(degraded_windows) > 0:
                incident_count = len(degraded_windows)
                min_window_rate = float(rolling_rate.min())
                window_incidents.append({
                    "windowHours": window_hours,
                    "incidentPoints": incident_count,
                    "minWindowSuccessRate": round(min_window_rate, 4),
                    "status": "INCIDENTS_DETECTED"
                })

        provider_reports.append({
            "provider": provider,
            "total_transactions": int(p_total),
            "successful_transactions": int(p_success),
            "failed_transactions": int(p_failed),
            "success_rate": round(float(p_rate), 4),
            "baseline_success_rate": round(float(baseline_rate), 4),
            "degraded": bool(is_degraded),
            "window_incidents": window_incidents
        })

    return sorted(provider_reports, key=lambda x: x["total_transactions"], reverse=True)


# ──────────────────────────────────────────────────────────────────────────────
# 7. Ground-Truth Benchmarking & Evaluation
# ──────────────────────────────────────────────────────────────────────────────

def evaluate_against_ground_truth(detected_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Compare the deterministic detector's output against the dataset's ground-truth labels.
    """
    total = len(detected_df)
    failed_mask = detected_df["status"] == "FAILED"
    failed_total = int(failed_mask.sum())

    # 1. Action Agreement
    action_match = (detected_df["detected_action"] == detected_df["ground_truth_action"])
    action_agreement_all = (action_match.sum() / total) * 100
    action_agreement_failed = (action_match[failed_mask].sum() / failed_total * 100) if failed_total else 0.0

    # 2. Recoverability Agreement
    # Map ground truth: 'YES'/'POSSIBLY' -> True, 'NO' -> False
    gt_rec_bool = detected_df["is_recoverable"].isin(["YES", "POSSIBLY"])
    rec_match = (detected_df["detected_recoverable"] == gt_rec_bool)
    rec_agreement_all = (rec_match.sum() / total) * 100
    rec_agreement_failed = (rec_match[failed_mask].sum() / failed_total * 100) if failed_total else 0.0

    # 3. Priority Agreement
    priority_match = (detected_df["detected_priority"] == detected_df["ground_truth_priority"])
    priority_agreement_all = (priority_match.sum() / total) * 100
    priority_agreement_failed = (priority_match[failed_mask].sum() / failed_total * 100) if failed_total else 0.0

    # Collect sample disagreements among failed transactions
    disagreements = []
    disagreements_df = detected_df[failed_mask & (~action_match | ~priority_match | ~rec_match)]

    for row in disagreements_df.head(5).itertuples(index=False):
        disagreements.append({
            "transaction_id": row.transaction_id,
            "failure_reason": row.failure_reason,
            "retry_count": row.retry_count,
            "customer_type": row.customer_type,
            "amount": row.amount,
            "detected": {
                "action": row.detected_action,
                "recoverable": row.detected_recoverable,
                "priority": row.detected_priority
            },
            "ground_truth": {
                "action": row.ground_truth_action,
                "is_recoverable": row.is_recoverable,
                "priority": row.ground_truth_priority
            }
        })

    return {
        "action_agreement_overall_pct": round(action_agreement_all, 2),
        "action_agreement_failed_pct": round(action_agreement_failed, 2),
        "recoverability_agreement_overall_pct": round(rec_agreement_all, 2),
        "recoverability_agreement_failed_pct": round(rec_agreement_failed, 2),
        "priority_agreement_overall_pct": round(priority_agreement_all, 2),
        "priority_agreement_failed_pct": round(priority_agreement_failed, 2),
        "sample_disagreements": disagreements
    }


# ──────────────────────────────────────────────────────────────────────────────
# 8. Report Printing & Orchestrator
# ──────────────────────────────────────────────────────────────────────────────

def print_risk_report(
    detected_df: pd.DataFrame,
    opportunities: List[Dict[str, Any]],
    degradation_results: List[Dict[str, Any]],
    eval_metrics: Dict[str, Any]
) -> None:
    """
    Format and print a comprehensive, human-readable risk detection report.
    """
    total_txns = len(detected_df)
    failed_txns = (detected_df["status"] == "FAILED").sum()
    successful_txns = (detected_df["status"] == "SUCCESS").sum()

    total_opportunities = len(opportunities)
    recoverable_opps = sum(1 for o in opportunities if o["recoverable"])
    human_review_opps = sum(1 for o in opportunities if o["recommendedAction"] == "HUMAN_REVIEW")

    total_revenue_at_risk = sum(o["amount"] for o in opportunities if o["recoverable"])
    total_failed_volume = detected_df[detected_df["status"] == "FAILED"]["amount"].sum()

    W = 68

    print("\n" + "=" * W)
    print("        VALQORA — REVENUE RISK & OPPORTUNITY DETECTION ENGINE")
    print("=" * W)
    print(f"  {'Total transactions analyzed:':<38} {total_txns:>12,}")
    print(f"  {'Successful transactions:':<38} {successful_txns:>12,} ({successful_txns/total_txns*100:>5.2f}%)")
    print(f"  {'Failed transactions:':<38} {failed_txns:>12,} ({failed_txns/total_txns*100:>5.2f}%)")
    print("-" * W)
    print(f"  {'Total opportunities detected:':<38} {total_opportunities:>12,}")
    print(f"  {'Recoverable opportunities:':<38} {recoverable_opps:>12,} ({recoverable_opps/total_opportunities*100:>5.2f}%)")
    print(f"  {'Human-review opportunities (Fraud/Risk):':<38} {human_review_opps:>12,} ({human_review_opps/total_opportunities*100:>5.2f}%)")
    print("-" * W)
    print(f"  {'Total failed volume:':<38} INR {total_failed_volume:>14,.2f}")
    print(f"  {'Total revenue at risk (Recoverable):':<38} INR {total_revenue_at_risk:>14,.2f}")
    print("=" * W)

    # Action Distribution
    print("\n" + "-" * W)
    print("  RECOMMENDED ACTION DISTRIBUTION")
    print("-" * W)
    action_counts = detected_df["detected_action"].value_counts()
    for action, count in action_counts.items():
        pct = (count / total_txns) * 100
        print(f"    - {action:<28} : {count:>7,} ({pct:>5.2f}%)")

    # Priority Distribution (Failed Transactions)
    print("\n" + "-" * W)
    print("  OPPORTUNITY PRIORITY DISTRIBUTION (Failed Transactions Only)")
    print("-" * W)
    failed_df = detected_df[detected_df["status"] == "FAILED"]
    priority_counts = failed_df["detected_priority"].value_counts()
    for priority, count in priority_counts.items():
        pct = (count / failed_txns) * 100
        print(f"    - {priority:<28} : {count:>7,} ({pct:>5.2f}%)")

    # Provider Degradation
    print("\n" + "-" * W)
    print("  PROVIDER HEALTH & DEGRADATION MONITORING")
    print("-" * W)
    for p in degradation_results:
        status_tag = "[DEGRADED]" if p["degraded"] else "[HEALTHY]"
        print(f"    Provider: {p['provider']:<12} | Status: {status_tag:<9} | Success Rate: {p['success_rate']*100:>5.2f}% (Baseline: {p['baseline_success_rate']*100:.2f}%) | Txns: {p['total_transactions']:,}")
        if p.get("window_incidents"):
            for inc in p["window_incidents"]:
                print(f"       └── Window Alert: {inc['windowHours']}h rolling window dropped to {inc['minWindowSuccessRate']*100:.1f}% success ({inc['incidentPoints']} incident points)")

    # Ground Truth Agreement
    print("\n" + "=" * W)
    print("  BENCHMARK: DETECTOR VS GROUND-TRUTH AGREEMENT")
    print("=" * W)
    print(f"  {'Action Agreement (All / Failed):':<42} {eval_metrics['action_agreement_overall_pct']:>6.2f}%  /  {eval_metrics['action_agreement_failed_pct']:>6.2f}%")
    print(f"  {'Recoverability Agreement (All / Failed):':<42} {eval_metrics['recoverability_agreement_overall_pct']:>6.2f}%  /  {eval_metrics['recoverability_agreement_failed_pct']:>6.2f}%")
    print(f"  {'Priority Agreement (All / Failed):':<42} {eval_metrics['priority_agreement_overall_pct']:>6.2f}%  /  {eval_metrics['priority_agreement_failed_pct']:>6.2f}%")

    if eval_metrics.get("sample_disagreements"):
        print("\n  Sample Minor Disagreements for ML Refinement:")
        for idx, item in enumerate(eval_metrics["sample_disagreements"], 1):
            print(f"    [{idx}] Txn: {item['transaction_id']} | Reason: {item['failure_reason']} | Retries: {item['retry_count']}")
            print(f"        Detected   -> Action: {item['detected']['action']}, Priority: {item['detected']['priority']}, Recoverable: {item['detected']['recoverable']}")
            print(f"        GroundTruth-> Action: {item['ground_truth']['action']}, Priority: {item['ground_truth']['priority']}, Recoverable: {item['ground_truth']['is_recoverable']}")

    # 5 Sample Opportunities
    print("\n" + "=" * W)
    print("  SAMPLE REVENUE OPPORTUNITY OBJECTS (First 5)")
    print("=" * W)
    for i, opp in enumerate(opportunities[:5], 1):
        print(f"\n[Opportunity #{i}]")
        print(json.dumps(opp, indent=4))

    print("\n" + "=" * W)
    print("  Valqora Risk Detection Completed Successfully.")
    print("=" * W + "\n")


def run_risk_detection(path: Path = TRANSACTIONS_CSV) -> Dict[str, Any]:
    """
    Execute the complete deterministic risk detection pipeline.
    """
    df = load_transactions(path)
    detected_df = detect_risk(df)
    opportunities = create_opportunities(detected_df)
    degradation_results = detect_provider_degradation(detected_df)
    eval_metrics = evaluate_against_ground_truth(detected_df)

    print_risk_report(detected_df, opportunities, degradation_results, eval_metrics)

    return {
        "detected_df": detected_df,
        "opportunities": opportunities,
        "degradation_results": degradation_results,
        "evaluation_metrics": eval_metrics
    }


if __name__ == "__main__":
    run_risk_detection()
