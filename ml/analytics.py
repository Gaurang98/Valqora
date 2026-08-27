"""
ml/analytics.py
================
Valqora — AI Revenue Decision & Recovery Engine
Analytics Engine

Reads data/transactions.csv and computes a complete analytical breakdown:
  - Summary KPIs
  - Provider-level metrics
  - Failure reason distribution
  - Customer-type breakdown
  - Ground-truth action distribution
  - Ground-truth priority distribution

All results are stored in Python dicts/DataFrames so this module can be
imported by other scripts without re-running the full pipeline.

Usage:
    python ml/analytics.py
"""

import sys
import os
from pathlib import Path

import numpy as np
import pandas as pd

# ── Encoding safety for Windows consoles ────────────────────────────────────
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ── Paths ────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
TRANSACTIONS_CSV = REPO_ROOT / "data" / "transactions.csv"

# Columns whose dtype should be coerced after loading
NUMERIC_COLS = ["amount", "retry_count", "customer_lifetime_value", "previous_failures"]
DATE_COLS = ["timestamp"]

# Rows where is_recoverable is YES or POSSIBLY count as "revenue at risk"
RECOVERABLE_VALUES = {"YES", "POSSIBLY"}


# ─────────────────────────────────────────────────────────────────────────────
# Data Loading
# ─────────────────────────────────────────────────────────────────────────────

def load_transactions(path: Path = TRANSACTIONS_CSV) -> pd.DataFrame:
    """
    Load transactions.csv into a DataFrame with correct dtypes.

    Raises FileNotFoundError if the CSV has not been generated yet.
    """
    if not path.exists():
        raise FileNotFoundError(
            f"transactions.csv not found at: {path}\n"
            "Run  python ml/generate_dataset.py  first."
        )

    df = pd.read_csv(path, parse_dates=DATE_COLS, low_memory=False)

    # Ensure numeric types (they should already be, but be explicit)
    for col in NUMERIC_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Normalise string columns: strip whitespace
    str_cols = df.select_dtypes(include="str").columns
    for col in str_cols:
        df[col] = df[col].str.strip()

    return df


# ─────────────────────────────────────────────────────────────────────────────
# 1. Summary KPIs
# ─────────────────────────────────────────────────────────────────────────────

def calculate_summary(df: pd.DataFrame) -> dict:
    """
    Calculate top-level KPI metrics for the full transaction dataset.

    Returns a dict with:
        total_transactions, successful_transactions, failed_transactions,
        total_volume, successful_revenue, revenue_at_risk,
        success_rate, failure_rate, average_transaction_value
    """
    total = len(df)
    success_mask = df["status"] == "SUCCESS"
    failed_mask  = df["status"] == "FAILED"

    successful = int(success_mask.sum())
    failed     = int(failed_mask.sum())

    total_volume        = float(df["amount"].sum())
    successful_revenue  = float(df.loc[success_mask, "amount"].sum())

    # Revenue at risk: failed transactions that are YES or POSSIBLY recoverable
    at_risk_mask = failed_mask & df["is_recoverable"].isin(RECOVERABLE_VALUES)
    revenue_at_risk = float(df.loc[at_risk_mask, "amount"].sum())

    success_rate = successful / total if total else 0.0
    failure_rate = failed     / total if total else 0.0
    avg_txn_value = total_volume / total if total else 0.0

    return {
        "total_transactions":     total,
        "successful_transactions": successful,
        "failed_transactions":    failed,
        "total_volume":           round(total_volume,       2),
        "successful_revenue":     round(successful_revenue, 2),
        "revenue_at_risk":        round(revenue_at_risk,    2),
        "success_rate":           round(success_rate * 100, 4),   # percent
        "failure_rate":           round(failure_rate * 100, 4),   # percent
        "average_transaction_value": round(avg_txn_value,   2),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Provider Analytics
# ─────────────────────────────────────────────────────────────────────────────

def calculate_provider_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Per-provider breakdown:
        provider, total_transactions, successful_transactions,
        failed_transactions, success_rate (%),
        total_amount, failed_amount
    """
    grp = df.groupby("provider")

    total_txns  = grp["transaction_id"].count().rename("total_transactions")
    success_txns = df[df["status"] == "SUCCESS"].groupby("provider")["transaction_id"].count().rename("successful_transactions")
    failed_txns  = df[df["status"] == "FAILED"].groupby("provider")["transaction_id"].count().rename("failed_transactions")
    total_amt   = grp["amount"].sum().rename("total_amount")
    failed_amt  = df[df["status"] == "FAILED"].groupby("provider")["amount"].sum().rename("failed_amount")

    result = pd.concat(
        [total_txns, success_txns, failed_txns, total_amt, failed_amt], axis=1
    ).fillna(0)

    result["successful_transactions"] = result["successful_transactions"].astype(int)
    result["failed_transactions"]     = result["failed_transactions"].astype(int)
    result["success_rate"]            = (
        result["successful_transactions"] / result["total_transactions"] * 100
    ).round(2)

    result["total_amount"]  = result["total_amount"].round(2)
    result["failed_amount"] = result["failed_amount"].round(2)

    return result.reset_index().sort_values("total_transactions", ascending=False)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Failure Reason Distribution
# ─────────────────────────────────────────────────────────────────────────────

def calculate_failure_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Distribution of failure reasons across FAILED transactions.

    Returns a DataFrame with:
        failure_reason, count, percentage, total_amount, avg_amount
    """
    failed_df = df[df["status"] == "FAILED"].copy()
    total_failed = len(failed_df)

    grp = failed_df.groupby("failure_reason")

    counts  = grp["transaction_id"].count().rename("count")
    amounts = grp["amount"].sum().rename("total_amount")
    avg_amt = grp["amount"].mean().rename("avg_amount")

    result = pd.concat([counts, amounts, avg_amt], axis=1).reset_index()
    result["percentage"]   = (result["count"] / total_failed * 100).round(2)
    result["total_amount"] = result["total_amount"].round(2)
    result["avg_amount"]   = result["avg_amount"].round(2)

    return result.sort_values("count", ascending=False).reset_index(drop=True)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Customer-Type Analytics
# ─────────────────────────────────────────────────────────────────────────────

def calculate_customer_type_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Breakdown by customer_type (NEW, REGULAR, HIGH_VALUE).

    Returns a DataFrame with:
        customer_type, transaction_count, success_rate (%),
        total_amount, failed_amount
    """
    grp = df.groupby("customer_type")

    total_txns   = grp["transaction_id"].count().rename("transaction_count")
    success_txns = df[df["status"] == "SUCCESS"].groupby("customer_type")["transaction_id"].count().rename("successful_transactions")
    failed_txns  = df[df["status"] == "FAILED"].groupby("customer_type")["transaction_id"].count().rename("failed_transactions")
    total_amt    = grp["amount"].sum().rename("total_amount")
    failed_amt   = df[df["status"] == "FAILED"].groupby("customer_type")["amount"].sum().rename("failed_amount")

    result = pd.concat(
        [total_txns, success_txns, failed_txns, total_amt, failed_amt], axis=1
    ).fillna(0)

    result["successful_transactions"] = result["successful_transactions"].astype(int)
    result["failed_transactions"]     = result["failed_transactions"].astype(int)
    result["success_rate"]            = (
        result["successful_transactions"] / result["transaction_count"] * 100
    ).round(2)
    result["total_amount"]  = result["total_amount"].round(2)
    result["failed_amount"] = result["failed_amount"].round(2)

    # Fixed display order
    order = ["NEW", "REGULAR", "HIGH_VALUE"]
    result = result.reindex([x for x in order if x in result.index])

    return result.reset_index()


# ─────────────────────────────────────────────────────────────────────────────
# 5. Ground-Truth Action Distribution
# ─────────────────────────────────────────────────────────────────────────────

def calculate_action_distribution(df: pd.DataFrame) -> pd.DataFrame:
    """
    Distribution of ground_truth_action values across all transactions.

    Returns:
        ground_truth_action, count, percentage
    """
    counts = df["ground_truth_action"].value_counts().rename("count")
    total  = len(df)

    result = counts.reset_index()
    result.columns = ["ground_truth_action", "count"]
    result["percentage"] = (result["count"] / total * 100).round(4)

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 6. Ground-Truth Priority Distribution
# ─────────────────────────────────────────────────────────────────────────────

def calculate_priority_distribution(df: pd.DataFrame) -> pd.DataFrame:
    """
    Distribution of ground_truth_priority values across all transactions.

    Returns:
        ground_truth_priority, count, percentage
    """
    counts = df["ground_truth_priority"].value_counts().rename("count")
    total  = len(df)

    result = counts.reset_index()
    result.columns = ["ground_truth_priority", "count"]
    result["percentage"] = (result["count"] / total * 100).round(4)

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Pretty Printing Helpers
# ─────────────────────────────────────────────────────────────────────────────

W = 65  # output width constant

def _header(title: str) -> None:
    print("\n" + "=" * W)
    print(f"  {title}")
    print("=" * W)

def _divider() -> None:
    print("-" * W)

def _fmt_inr(value: float) -> str:
    """Format a float as an INR amount string."""
    return f"INR {value:>18,.2f}"


def print_summary(s: dict) -> None:
    _header("VALQORA  -  TRANSACTION ANALYTICS SUMMARY")
    print(f"  {'Total transactions:':<35} {s['total_transactions']:>10,}")
    print(f"  {'Successful transactions:':<35} {s['successful_transactions']:>10,}")
    print(f"  {'Failed transactions:':<35} {s['failed_transactions']:>10,}")
    _divider()
    print(f"  {'Total transaction volume:':<35} {_fmt_inr(s['total_volume'])}")
    print(f"  {'Successful revenue:':<35} {_fmt_inr(s['successful_revenue'])}")
    print(f"  {'Revenue at risk (recoverable):':<35} {_fmt_inr(s['revenue_at_risk'])}")
    _divider()
    print(f"  {'Success rate:':<35} {s['success_rate']:>9.2f} %")
    print(f"  {'Failure rate:':<35} {s['failure_rate']:>9.2f} %")
    print(f"  {'Average transaction value:':<35} {_fmt_inr(s['average_transaction_value'])}")
    print("=" * W)


def print_provider_metrics(df: pd.DataFrame) -> None:
    _header("PROVIDER ANALYTICS")
    for _, row in df.iterrows():
        print(f"\n  Provider : {row['provider']}")
        _divider()
        print(f"    {'Total transactions:':<30} {int(row['total_transactions']):>8,}")
        print(f"    {'Successful:':<30} {int(row['successful_transactions']):>8,}")
        print(f"    {'Failed:':<30} {int(row['failed_transactions']):>8,}")
        print(f"    {'Success rate:':<30} {row['success_rate']:>7.2f} %")
        print(f"    {'Total amount:':<30} {_fmt_inr(row['total_amount'])}")
        print(f"    {'Failed amount:':<30} {_fmt_inr(row['failed_amount'])}")


def print_failure_metrics(df: pd.DataFrame) -> None:
    _header("FAILURE REASON DISTRIBUTION  (Failed transactions only)")
    print(f"  {'Failure Reason':<32} {'Count':>7}  {'%':>6}  {'Total Amount (INR)':>20}  {'Avg Amount':>12}")
    _divider()
    for _, row in df.iterrows():
        print(
            f"  {row['failure_reason']:<32} "
            f"{int(row['count']):>7,}  "
            f"{row['percentage']:>5.1f}%  "
            f"INR {row['total_amount']:>16,.2f}  "
            f"INR {row['avg_amount']:>8,.2f}"
        )


def print_customer_type_metrics(df: pd.DataFrame) -> None:
    _header("CUSTOMER-TYPE ANALYTICS")
    print(f"  {'Type':<12} {'Txns':>8}  {'Success%':>9}  {'Total Amt (INR)':>20}  {'Failed Amt (INR)':>20}")
    _divider()
    for _, row in df.iterrows():
        print(
            f"  {row['customer_type']:<12} "
            f"{int(row['transaction_count']):>8,}  "
            f"{row['success_rate']:>8.2f}%  "
            f"INR {row['total_amount']:>16,.2f}  "
            f"INR {row['failed_amount']:>16,.2f}"
        )


def print_action_distribution(df: pd.DataFrame) -> None:
    _header("GROUND-TRUTH ACTION DISTRIBUTION")
    print(f"  {'Action':<30} {'Count':>8}  {'%':>8}")
    _divider()
    for _, row in df.iterrows():
        print(
            f"  {row['ground_truth_action']:<30} "
            f"{int(row['count']):>8,}  "
            f"{row['percentage']:>7.4f}%"
        )


def print_priority_distribution(df: pd.DataFrame) -> None:
    _header("GROUND-TRUTH PRIORITY DISTRIBUTION")
    print(f"  {'Priority':<12} {'Count':>8}  {'%':>8}")
    _divider()
    for _, row in df.iterrows():
        print(
            f"  {row['ground_truth_priority']:<12} "
            f"{int(row['count']):>8,}  "
            f"{row['percentage']:>7.4f}%"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point — runs all analytics and prints the full report
# ─────────────────────────────────────────────────────────────────────────────

def run_analytics(path: Path = TRANSACTIONS_CSV) -> dict:
    """
    Execute the full analytics pipeline.

    Returns a dict of all computed metrics so this function can be imported
    and used by other modules (e.g., a backend API endpoint):

        {
            "summary":             dict,
            "provider_metrics":    pd.DataFrame,
            "failure_metrics":     pd.DataFrame,
            "customer_type_metrics": pd.DataFrame,
            "action_distribution": pd.DataFrame,
            "priority_distribution": pd.DataFrame,
        }
    """
    print(f"\nLoading transactions from: {path}")
    df = load_transactions(path)
    print(f"Loaded {len(df):,} rows with {len(df.columns)} columns.")

    summary             = calculate_summary(df)
    provider_metrics    = calculate_provider_metrics(df)
    failure_metrics     = calculate_failure_metrics(df)
    customer_metrics    = calculate_customer_type_metrics(df)
    action_dist         = calculate_action_distribution(df)
    priority_dist       = calculate_priority_distribution(df)

    # ── Print full report ────────────────────────────────────────────────────
    print_summary(summary)
    print_provider_metrics(provider_metrics)
    print_failure_metrics(failure_metrics)
    print_customer_type_metrics(customer_metrics)
    print_action_distribution(action_dist)
    print_priority_distribution(priority_dist)

    print("\n" + "=" * W)
    print("  Analytics complete.")
    print("=" * W + "\n")

    return {
        "summary":                summary,
        "provider_metrics":       provider_metrics,
        "failure_metrics":        failure_metrics,
        "customer_type_metrics":  customer_metrics,
        "action_distribution":    action_dist,
        "priority_distribution":  priority_dist,
    }


if __name__ == "__main__":
    run_analytics()
