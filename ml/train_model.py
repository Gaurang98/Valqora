"""Reusable training pipeline for Valqora recovery prediction.

This script trains a baseline binary classifier for recovery prediction on failed
transactions. It intentionally does not modify the deterministic risk detector,
backend, frontend, or synthetic dataset generator.

Key design note:
The synthetic target label is generated from deterministic business rules and is
not production-ready evidence of real predictive performance. The goal here is to
validate the ML pipeline structure and reproducibility, not to claim model quality.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "data" / "transactions.csv"
MODEL_DIR = REPO_ROOT / "ml" / "models"
MODEL_PATH = MODEL_DIR / "recovery_model.joblib"
RESULTS_PATH = REPO_ROOT / "ml" / "model_results.json"

RANDOM_STATE = 42
TARGET_VALUES = ["YES", "POSSIBLY", "NO"]
ALLOWED_TARGETS = {"YES", "POSSIBLY", "NO"}
FORBIDDEN_FEATURES = {
    "is_recoverable",
    "ground_truth_action",
    "ground_truth_priority",
    "transaction_id",
    "customer_id",
}
DATASET_WARNING = (
    "Synthetic target is generated from deterministic business rules; "
    "model metrics demonstrate pipeline functionality, not production predictive performance."
)

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


def print_section(title: str) -> None:
    print("\n" + "=" * 88)
    print(title)
    print("=" * 88)


def load_transactions(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    if "status" not in df.columns:
        raise ValueError("Dataset is missing required status column.")
    return df


def validate_target_raw(raw_target: pd.Series) -> None:
    unknown = sorted(set(raw_target.dropna().unique()) - ALLOWED_TARGETS)
    if unknown:
        raise ValueError(f"Target contains unexpected values: {unknown}")

    if raw_target.isna().any():
        raise ValueError("Target column contains missing values.")


def build_feature_frame(df: pd.DataFrame) -> pd.DataFrame:
    feature_df = df.copy()
    feature_df["timestamp"] = pd.to_datetime(feature_df["timestamp"], errors="coerce")
    feature_df["hour"] = feature_df["timestamp"].dt.hour
    feature_df["day_of_week"] = feature_df["timestamp"].dt.dayofweek
    feature_df["day_of_month"] = feature_df["timestamp"].dt.day
    feature_df["month"] = feature_df["timestamp"].dt.month

    missing = [col for col in FEATURE_COLUMNS if col not in feature_df.columns]
    if missing:
        raise ValueError(f"Required feature columns missing: {missing}")

    return feature_df[FEATURE_COLUMNS].copy()


def build_preprocessor(numeric_features: List[str], categorical_features: List[str]) -> ColumnTransformer:
    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    return ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline, numeric_features),
            ("cat", categorical_pipeline, categorical_features),
        ]
    )


def evaluate_model(
    model_name: str,
    pipeline: Pipeline,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> Dict[str, object]:
    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "model": model_name,
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, y_prob)),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
    }

    print(f"{model_name}: accuracy={metrics['accuracy']:.6f}, precision={metrics['precision']:.6f}, recall={metrics['recall']:.6f}, f1={metrics['f1']:.6f}, roc_auc={metrics['roc_auc']:.6f}")
    return metrics


def compute_feature_importance(model_name: str, pipeline: Pipeline, feature_names: List[str], top_n: int = 10) -> List[Dict[str, float]]:
    model = pipeline.named_steps["model"]

    if hasattr(model, "coef_"):
        importances = np.abs(model.coef_[0])
    elif hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    else:
        return []

    ranked = sorted(zip(feature_names, importances), key=lambda item: item[1], reverse=True)
    return [{"feature": feature, "importance": float(importance)} for feature, importance in ranked[:top_n]]


def validate_leakage(X: pd.DataFrame, y: pd.Series) -> None:
    forbidden_in_X = sorted(FORBIDDEN_FEATURES.intersection(set(X.columns)))
    if forbidden_in_X:
        raise AssertionError(f"Forbidden target/ground-truth columns present in X: {forbidden_in_X}")

    valid_targets = {0, 1}
    unexpected = sorted(set(y.unique()) - valid_targets)
    if unexpected:
        raise AssertionError(f"Target contains invalid class values: {unexpected}")


def validate_stratification(y: pd.Series, y_train: pd.Series, y_test: pd.Series) -> None:
    overall = y.value_counts(normalize=True).sort_index()
    train = y_train.value_counts(normalize=True).sort_index()
    test = y_test.value_counts(normalize=True).sort_index()

    if not overall.index.equals(train.index) or not overall.index.equals(test.index):
        raise AssertionError("Train/test split class index mismatch; split is not stratified correctly.")

    for label in overall.index:
        if abs(float(train.get(label, 0.0) - overall[label])) > 0.08:
            raise AssertionError(f"Train split deviates too far from overall target distribution for label {label}.")
        if abs(float(test.get(label, 0.0) - overall[label])) > 0.08:
            raise AssertionError(f"Test split deviates too far from overall target distribution for label {label}.")


def main() -> None:
    print_section("Valqora Recovery Prediction — Training Pipeline")
    print(DATASET_WARNING)

    df = load_transactions(DATA_PATH)
    print(f"Dataset shape: {df.shape}")

    validate_target_raw(df["is_recoverable"])

    failed_df = df[df["status"] == "FAILED"].copy()
    print(f"FAILED rows used for prediction experiment: {len(failed_df)}")

    X_raw = build_feature_frame(failed_df)
    y_raw = failed_df["is_recoverable"].map({"NO": 0, "YES": 1, "POSSIBLY": 1}).astype(int)

    print("Target distribution:")
    print(y_raw.value_counts().sort_index().to_dict())

    print("Feature columns used:")
    print(X_raw.columns.tolist())

    numeric_features = list(X_raw.select_dtypes(include=[np.number]).columns)
    categorical_features = list(X_raw.select_dtypes(exclude=[np.number]).columns)

    X = X_raw.copy()
    y = y_raw.copy()

    validate_leakage(X, y)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    validate_stratification(y, y_train, y_test)

    print(f"Train rows: {len(X_train)}")
    print(f"Test rows: {len(X_test)}")
    print("Train target distribution:")
    print(y_train.value_counts().sort_index().to_dict())
    print("Test target distribution:")
    print(y_test.value_counts().sort_index().to_dict())

    model_specs = {
        "Logistic Regression": LogisticRegression(
            max_iter=2000,
            random_state=RANDOM_STATE,
            class_weight="balanced",
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=300,
            random_state=RANDOM_STATE,
            class_weight="balanced_subsample",
            min_samples_leaf=2,
            n_jobs=-1,
        ),
    }

    results = []
    fitted_pipelines = {}

    for model_name, estimator in model_specs.items():
        pipeline = Pipeline(
            steps=[
                ("preprocessor", build_preprocessor(numeric_features, categorical_features)),
                ("model", estimator),
            ]
        )

        pipeline.fit(X_train, y_train)
        fitted_pipelines[model_name] = pipeline
        results.append({"model": model_name, **evaluate_model(model_name, pipeline, X_test, y_test)})

    results_df = pd.DataFrame(results)
    print_section("Model Comparison")
    print(results_df[["model", "accuracy", "precision", "recall", "f1", "roc_auc"]].to_string(index=False))

    selected_name = (
        results_df.sort_values(["recall", "f1", "roc_auc", "accuracy"], ascending=False)
        .reset_index(drop=True)
        .iloc[0]["model"]
    )
    selected_pipeline = fitted_pipelines[selected_name]

    feature_names = selected_pipeline.named_steps["preprocessor"].get_feature_names_out().tolist()
    top_features = compute_feature_importance(selected_name, selected_pipeline, feature_names, top_n=10)
    print("Top feature importance (selected model):")
    for item in top_features:
        print(f"  {item['feature']}: {item['importance']:.6f}")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(selected_pipeline, MODEL_PATH)

    payload = {
        "dataset_warning": DATASET_WARNING,
        "dataset": {
            "path": str(DATA_PATH),
            "shape": [int(df.shape[0]), int(df.shape[1])],
            "failed_rows_used": int(len(failed_df)),
            "total_rows": int(len(df)),
            "target_values": {k: int(v) for k, v in y_raw.value_counts().sort_index().to_dict().items()},
        },
        "features": FEATURE_COLUMNS,
        "target_definition": {
            "name": "potential_recovery",
            "mapping": {"YES": 1, "POSSIBLY": 1, "NO": 0},
        },
        "train_test": {
            "test_size": 0.2,
            "random_state": RANDOM_STATE,
            "stratified": True,
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "train_target_distribution": y_train.value_counts().sort_index().astype(int).to_dict(),
            "test_target_distribution": y_test.value_counts().sort_index().astype(int).to_dict(),
        },
        "metrics": results,
        "selected_model": selected_name,
        "top_features": top_features,
        "leakage_checks": {
            "forbidden_columns_absent_from_X": True,
            "target_classes_valid": True,
            "train_test_stratified": True,
        },
        "model_artifact": str(MODEL_PATH),
    }

    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print_section("Summary")
    print(f"Selected model: {selected_name}")
    print(f"Model artifact saved to: {MODEL_PATH}")
    print(f"Results saved to: {RESULTS_PATH}")
    print("Leakage checks: passed")
    print(DATASET_WARNING)


if __name__ == "__main__":
    main()
