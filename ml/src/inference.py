"""
Valqora Model Inference & Prediction Module
============================================
Provides an isolated, leak-free inference layer for the trained recovery model
(ml/models/recovery_model.joblib).

Key design invariants:
1. Strictly evaluates only FAILED transactions (rejects SUCCESS).
2. Input features are strictly limited to the 13 features used during training:
   amount, retry_count, customer_lifetime_value, previous_failures,
   hour, day_of_week, day_of_month, month, currency, payment_method,
   provider, failure_reason, customer_type.
3. NEVER accepts or includes leakage/ground-truth fields (is_recoverable,
   ground_truth_action, ground_truth_priority) or identifiers (transaction_id, customer_id).
4. Returns a numeric recovery probability in [0.0, 1.0].
5. Advisory only — does not bypass deterministic safety rules.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MODEL_PATH = REPO_ROOT / "ml" / "models" / "recovery_model.joblib"

FORBIDDEN_FEATURES = frozenset({
    "is_recoverable",
    "ground_truth_action",
    "ground_truth_priority",
    "transaction_id",
    "customer_id",
})

FEATURE_COLUMNS = [
    "amount",
    "retry_count",
    "customer_lifetime_value",
    "previous_failures",
    "hour",
    "day_of_week",
    "day_of_month",
    "month",
    "currency",
    "payment_method",
    "provider",
    "failure_reason",
    "customer_type",
]

_CACHED_MODEL: Optional[Any] = None


def load_model(path: Path = MODEL_PATH) -> Any:
    """
    Safely load and cache the trained recovery prediction pipeline.
    """
    global _CACHED_MODEL
    if _CACHED_MODEL is not None:
        return _CACHED_MODEL

    if not path.exists():
        raise FileNotFoundError(f"Recovery model artifact not found at {path}")

    _CACHED_MODEL = joblib.load(path)
    return _CACHED_MODEL


def build_feature_dict(txn: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a transaction payload into the exact 13 features expected by the model.
    Enforces strict leakage protection and validation.
    """
    # 1. Validation: Only failed transactions can be evaluated
    status = txn.get("status")
    if status == "SUCCESS":
        raise ValueError("Successful transactions cannot be evaluated for recovery probability.")

    # 2. Extract and parse timestamp features
    ts_val = txn.get("timestamp")
    if ts_val:
        ts = pd.to_datetime(ts_val, errors="coerce")
        if pd.isna(ts):
            ts = pd.Timestamp.utcnow()
    else:
        ts = pd.Timestamp.utcnow()

    hour = int(ts.hour)
    day_of_week = int(ts.dayofweek)
    day_of_month = int(ts.day)
    month = int(ts.month)

    # 3. Extract numeric and categorical features
    amount = float(txn.get("amount", 0.0))
    retry_count = int(txn.get("retry_count", txn.get("retryCount", 0)))
    clv = float(txn.get("customer_lifetime_value", txn.get("customerLifetimeValue", 0.0)))
    prev_failures = int(txn.get("previous_failures", txn.get("previousFailures", 0)))

    currency = str(txn.get("currency", "INR")).strip()
    payment_method = str(txn.get("payment_method", txn.get("paymentMethod", "UPI"))).strip()
    provider = str(txn.get("provider", "Provider_A")).strip()
    failure_reason = str(txn.get("failure_reason", txn.get("failureReason", "UNKNOWN"))).strip()
    customer_type = str(txn.get("customer_type", txn.get("customerType", "REGULAR"))).strip()

    features = {
        "amount": amount,
        "retry_count": retry_count,
        "customer_lifetime_value": clv,
        "previous_failures": prev_failures,
        "hour": hour,
        "day_of_week": day_of_week,
        "day_of_month": day_of_month,
        "month": month,
        "currency": currency,
        "payment_method": payment_method,
        "provider": provider,
        "failure_reason": failure_reason,
        "customer_type": customer_type,
    }

    # 4. Leakage assertion
    forbidden_present = FORBIDDEN_FEATURES.intersection(features.keys())
    if forbidden_present:
        raise AssertionError(f"Leakage detected! Forbidden features present: {forbidden_present}")

    return features


def predict_recovery_probability(txn: Dict[str, Any], model_path: Path = MODEL_PATH) -> float:
    """
    Predict the numeric recovery probability for a single failed transaction.
    Returns a float in [0.0, 1.0].
    """
    features = build_feature_dict(txn)
    feature_df = pd.DataFrame([features])[FEATURE_COLUMNS]

    model = load_model(model_path)
    proba = model.predict_proba(feature_df)

    # Return probability of positive class (recoverable / potential recovery)
    return float(proba[:, 1][0])


def main() -> None:
    """
    CLI interface for Node.js backend bridge and offline testing.
    Accepts JSON from sys.argv[1] or stdin and returns structured JSON output.
    """
    try:
        if len(sys.argv) > 1:
            raw_input = sys.argv[1]
        else:
            raw_input = sys.stdin.read().strip()

        if not raw_input:
            print(json.dumps({"success": False, "error": "No input payload provided"}))
            sys.exit(1)

        payload = json.loads(raw_input)
        prob = predict_recovery_probability(payload)

        result = {
            "success": True,
            "recoveryProbability": round(prob, 4),
            "model": "RandomForestClassifier",
            "isAvailable": True,
        }
        print(json.dumps(result))
    except Exception as exc:
        err_res = {
            "success": False,
            "error": str(exc),
            "recoveryProbability": None,
            "isAvailable": False,
        }
        print(json.dumps(err_res))
        sys.exit(0 if "Successful transactions cannot be evaluated" in str(exc) else 1)


if __name__ == "__main__":
    main()
