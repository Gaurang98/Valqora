"""Valqora Step 12: ML model exploration and baseline for recovery prediction.

This script performs a controlled, reproducible baseline experiment to determine
whether a supervised classifier can predict recoverability of failed transactions.
It intentionally does not modify the deterministic safety layer or production API.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd
import numpy as np

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
RESULTS_PATH = Path(__file__).resolve().parent / "model_results.json"

TARGET_VALUES = ["YES", "POSSIBLY", "NO"]
ALLOWED_TARGETS = {"YES", "POSSIBLY", "NO"}


def print_section(title: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def load_and_inspect_data(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    print_section("PHASE 1 — DATASET INSPECTION")
    print(f"Dataset shape: {df.shape}")
    print("\nColumn names:")
    print(list(df.columns))
    print("\nData types:")
    print(df.dtypes)
    print("\nMissing values:")
    print(df.isna().sum().sort_values(ascending=False).head(20))

    dupes = df["transaction_id"].duplicated().sum()
    print(f"\nDuplicate transaction IDs: {dupes}")

    print("\nStatus distribution:")
    print(df["status"].value_counts(dropna=False))

    print("\nTarget raw distribution (all rows):")
    print(df["is_recoverable"].value_counts(dropna=False))

    print("\nFailure-reason distribution:")
    print(df["failure_reason"].value_counts(dropna=False).head(20))

    print("\nGround-truth action distribution:")
    print(df["ground_truth_action"].value_counts(dropna=False).head(20))

    print("\nGround-truth priority distribution:")
    print(df["ground_truth_priority"].value_counts(dropna=False).head(20))

    return df


def define_targets(failed_df: pd.DataFrame) -> Dict[str, pd.Series]:
    print_section("PHASE 2 — DEFINE THE ML TARGET")
    raw_values = failed_df["is_recoverable"].dropna()
    print("Raw failed-row target values and counts:")
    print(raw_values.value_counts(dropna=False))
    print("Raw unique values:")
    print(sorted(raw_values.unique().tolist()))

    strict = failed_df["is_recoverable"].map(lambda v: 1 if v == "YES" else 0)
    potential = failed_df["is_recoverable"].map(lambda v: 1 if v in {"YES", "POSSIBLY"} else 0)

    print("\nA) Strict recovery target (YES=1, NO/POSSIBLY=0):")
    print(strict.value_counts().sort_index())
    print("B) Potential recovery target (YES/POSSIBLY=1, NO=0):")
    print(potential.value_counts().sort_index())

    return {"strict": strict, "potential": potential}


def build_features(failed_df: pd.DataFrame) -> pd.DataFrame:
    print_section("PHASE 3 — FEATURE ENGINEERING")
    df = failed_df.copy()

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["day_of_month"] = df["timestamp"].dt.day
    df["month"] = df["timestamp"].dt.month

    feature_cols = [
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

    X = df[feature_cols].copy()
    print("Feature list:")
    print(feature_cols)
    return X


def build_preprocessor(numeric_features: List[str], categorical_features: List[str]) -> ColumnTransformer:
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    return ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ]
    )


def evaluate_model(
    model_name: str,
    estimator: object,
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    selected_target_name: str,
) -> Dict[str, object]:
    pipeline = Pipeline(
        steps=[
            ("preprocessor", build_preprocessor(list(X_train.select_dtypes(include=[np.number]).columns), list(X_train.select_dtypes(exclude=[np.number]).columns))),
            ("model", estimator),
        ]
    )
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "model": model_name,
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1": f1_score(y_test, y_pred, zero_division=0),
        "roc_auc": roc_auc_score(y_test, y_prob),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
    }

    print_section(f"PHASE 7 — {model_name} EVALUATION")
    print(f"Model: {model_name}")
    print(f"Accuracy: {metrics['accuracy']:.4f}")
    print(f"Precision: {metrics['precision']:.4f}")
    print(f"Recall: {metrics['recall']:.4f}")
    print(f"F1-score: {metrics['f1']:.4f}")
    print(f"ROC-AUC: {metrics['roc_auc']:.4f}")
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))
    print("Classification report:")
    from sklearn.metrics import classification_report
    print(classification_report(y_test, y_pred, target_names=[f"{selected_target_name}=0", f"{selected_target_name}=1"]))

    return metrics


def top_feature_importance(model_name: str, pipeline: Pipeline, feature_names: List[str], top_n: int = 20) -> List[Dict[str, float]]:
    model = pipeline.named_steps["model"]
    if hasattr(model, "coef_"):
        importances = np.abs(model.coef_[0])
    elif hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    else:
        raise ValueError(f"Model {model_name} has no coefficient or feature importance array.")

    ranked = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
    return [
        {"feature": feature, "importance": float(importance)}
        for feature, importance in ranked[:top_n]
    ]


def main() -> None:
    df = load_and_inspect_data(DATA_PATH)
    failed_df = df[df["status"] == "FAILED"].copy()
    print(f"\nFailed transactions used for ML: {len(failed_df)}")

    targets = define_targets(failed_df)
    target_choice = "potential"
    y = targets[target_choice]
    print(f"\nSelected target definition: {target_choice}")
    print("(YES/POSSIBLY = 1, NO = 0)")

    X = build_features(failed_df)
    X["is_recoverable"] = y

    feature_columns = [
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
    X = X[feature_columns]
    y = X.pop("is_recoverable") if "is_recoverable" in X.columns else y

    # Rebuild explicit target for the chosen interpretation.
    y = failed_df["is_recoverable"].map(lambda v: 1 if v in {"YES", "POSSIBLY"} else 0)

    print_section("PHASE 4 — TRAIN / TEST SPLIT")
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    print(f"Training rows: {len(X_train)}")
    print(f"Testing rows: {len(X_test)}")
    print("Training class distribution:")
    print(pd.Series(y_train).value_counts().sort_index())
    print("Testing class distribution:")
    print(pd.Series(y_test).value_counts().sort_index())

    print_section("PHASE 5 — PREPROCESSING")
    numeric_features = list(X.select_dtypes(include=[np.number]).columns)
    categorical_features = list(X.select_dtypes(exclude=[np.number]).columns)
    print("Numeric features:")
    print(numeric_features)
    print("Categorical features:")
    print(categorical_features)

    model_specs = {
        "Logistic Regression": LogisticRegression(max_iter=2000, random_state=42, class_weight="balanced"),
        "Random Forest": RandomForestClassifier(
            n_estimators=300,
            random_state=42,
            class_weight="balanced_subsample",
            min_samples_leaf=2,
            n_jobs=-1,
        ),
    }

    results = []
    selected_pipeline = None
    selected_name = ""

    print_section("PHASE 6 — BASELINE MODELS")
    for model_name, estimator in model_specs.items():
        metric_result = evaluate_model(
            model_name=model_name,
            estimator=estimator,
            X_train=X_train,
            X_test=X_test,
            y_train=y_train,
            y_test=y_test,
            selected_target_name="potential",
        )
        results.append(metric_result)

    results_df = pd.DataFrame(results)
    print_section("PHASE 8 — MODEL COMPARISON")
    print(results_df[["model", "accuracy", "precision", "recall", "f1", "roc_auc"]].to_string(index=False))

    selected_name = results_df.sort_values(["recall", "f1", "roc_auc"], ascending=False).reset_index(drop=True).iloc[0]["model"]
    print(f"\nSelected baseline model by recall/F1/ROC-AUC: {selected_name}")

    selected_estimator = model_specs[selected_name]
    pipeline = Pipeline(
        steps=[
            ("preprocessor", build_preprocessor(numeric_features, categorical_features)),
            ("model", selected_estimator),
        ]
    )
    pipeline.fit(X_train, y_train)

    print_section("PHASE 9 — FEATURE IMPORTANCE / INTERPRETABILITY")
    feature_names = pipeline.named_steps["preprocessor"].get_feature_names_out().tolist()
    importance = top_feature_importance(selected_name, pipeline, feature_names, top_n=20)
    print(f"Top features for {selected_name}:")
    for item in importance:
        print(f"{item['feature']}: {item['importance']:.6f}")

    print_section("PHASE 11 — LEAKAGE CHECK")
    forbidden = {"is_recoverable", "ground_truth_action", "ground_truth_priority", "transaction_id", "customer_id"}
    forbidden_found = [col for col in feature_columns if col in forbidden]
    if forbidden_found:
        raise ValueError(f"Leakage columns present in feature set: {forbidden_found}")
    if "is_recoverable" in X.columns:
        raise ValueError("Target leak still present in feature matrix")
    print("LEAKAGE CHECK: PASSED")

    results_payload = {
        "dataset": {
            "path": str(DATA_PATH),
            "shape": list(df.shape),
            "failed_transactions_used": int(len(failed_df)),
            "total_transactions": int(len(df)),
            "failed_transactions": int(len(failed_df)),
            "target_values_found": sorted(failed_df["is_recoverable"].dropna().unique().tolist()),
            "target_values_counts": failed_df["is_recoverable"].value_counts(dropna=False).to_dict(),
        },
        "target_definition": {
            "name": "potential_recovery",
            "mapping": {"YES": 1, "POSSIBLY": 1, "NO": 0},
            "chosen_reason": "Valqora should prioritize recoverable and possibly recoverable revenue opportunities; missing either class would reduce revenue recovery recall.",
        },
        "features": feature_columns,
        "train_test": {
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "train_target_distribution": pd.Series(y_train).value_counts().sort_index().astype(int).to_dict(),
            "test_target_distribution": pd.Series(y_test).value_counts().sort_index().astype(int).to_dict(),
        },
        "metrics": [{
            "model": row["model"],
            "accuracy": float(row["accuracy"]),
            "precision": float(row["precision"]),
            "recall": float(row["recall"]),
            "f1": float(row["f1"]),
            "roc_auc": float(row["roc_auc"]),
            "confusion_matrix": row["confusion_matrix"],
        } for _, row in results_df.iterrows()],
        "selected_model": selected_name,
        "important_features": importance,
        "leakage_check": "PASSED",
    }

    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(results_payload, f, indent=2)

    print(f"\nSaved experiment results to: {RESULTS_PATH}")


if __name__ == "__main__":
    main()
