"""
Valqora ML Inference Direct Unit Tests (Day 3 Step 2)
=====================================================
Directly verifies the Python ML inference layer (ml/src/inference.py):
1. Loads recovery_model.joblib correctly.
2. Generates numeric probability in [0, 1].
3. Rejects successful transactions.
4. Verifies absence of forbidden leakage columns.
5. Verifies absence of transaction_id and customer_id in features.
6. Tests deterministic output for identical inputs.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.src.inference import (
    load_model,
    build_feature_dict,
    predict_recovery_probability,
    FEATURE_COLUMNS,
    FORBIDDEN_FEATURES,
    MODEL_PATH,
)


class TestMLInference(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sample_failed_txn = {
            "transaction_id": "TXN_000023",
            "customer_id": "CUST_09274",
            "timestamp": "2026-08-01 10:32:00",
            "amount": 4999.0,
            "currency": "INR",
            "payment_method": "UPI",
            "provider": "Provider_A",
            "status": "FAILED",
            "failure_reason": "BANK_TIMEOUT",
            "retry_count": 0,
            "customer_type": "REGULAR",
            "customer_lifetime_value": 57349.2,
            "previous_failures": 0,
            # Ground truth fields (must be stripped / ignored)
            "is_recoverable": "YES",
            "ground_truth_action": "RETRY",
            "ground_truth_priority": "MEDIUM",
        }

        cls.sample_success_txn = {
            "transaction_id": "TXN_000001",
            "customer_id": "CUST_00001",
            "timestamp": "2026-08-01 09:00:00",
            "amount": 1500.0,
            "currency": "INR",
            "payment_method": "UPI",
            "provider": "Provider_B",
            "status": "SUCCESS",
            "failure_reason": "NONE",
            "retry_count": 0,
            "customer_type": "REGULAR",
            "customer_lifetime_value": 12000.0,
            "previous_failures": 0,
        }

    def test_01_model_loading(self):
        """1. Model artifact exists and loads as a valid scikit-learn Pipeline."""
        self.assertTrue(MODEL_PATH.exists(), f"Model file missing at {MODEL_PATH}")
        model = load_model()
        self.assertIsNotNone(model)
        self.assertTrue(hasattr(model, "predict_proba"))

    def test_02_feature_extraction_leakage(self):
        """2. Feature dictionary contains exactly 13 features with zero leakage."""
        features = build_feature_dict(self.sample_failed_txn)
        self.assertEqual(len(features), 13)
        self.assertEqual(sorted(features.keys()), sorted(FEATURE_COLUMNS))

        # Assert no forbidden fields exist in features
        for forbidden in FORBIDDEN_FEATURES:
            self.assertNotIn(forbidden, features)

    def test_03_numeric_prediction_range(self):
        """3. Prediction returns a float between 0.0 and 1.0."""
        prob = predict_recovery_probability(self.sample_failed_txn)
        self.assertIsInstance(prob, float)
        self.assertGreaterEqual(prob, 0.0)
        self.assertLessEqual(prob, 1.0)

    def test_04_deterministic_prediction(self):
        """4. Identical inputs produce identical probability scores."""
        prob1 = predict_recovery_probability(self.sample_failed_txn)
        prob2 = predict_recovery_probability(self.sample_failed_txn)
        self.assertEqual(prob1, prob2)

    def test_05_reject_success_transactions(self):
        """5. Successful transactions raise ValueError when passed to inference."""
        with self.assertRaises(ValueError):
            build_feature_dict(self.sample_success_txn)

        with self.assertRaises(ValueError):
            predict_recovery_probability(self.sample_success_txn)


if __name__ == "__main__":
    unittest.main(verbosity=2)
